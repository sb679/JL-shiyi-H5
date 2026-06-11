# 云函数 API 参考

## 版本历史
| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-06-08 | AI | 初始版本，基于 v1 MVP 全部 13 个云函数 |

## 1. 通用规范

### 返回值统一结构
```json
{
  "success": true,
  "data": {},
  "message": "操作说明"
}
```

### 调用方约定
- **前端**：通过 `wx.cloud.callFunction({ name, data })` 调用
- **云函数间调用**：通过 `cloud.callFunction({ name, data })` 调用
- **openid 获取**：云函数内通过 `cloud.getWXContext().OPENID` 获取当前用户

### 部署说明
所有云函数必须右键 → "上传并部署：云端安装依赖"，不可只上传不安装依赖。

---

## 2. 云函数列表总览

| 序号 | 云函数 | 用途 | 调用方 | 权限配置 |
|------|--------|------|--------|----------|
| 1 | `getOpenid` | 获取用户 openid | app.js 启动时 | `{}` |
| 2 | `getBookList` | 获取书城书籍列表 | bookmall / myBooks | `{}` |
| 3 | `publishBook` | 发布新书 | publish | `{}` |
| 4 | `expressInterest` | 表达"想买"意向 | bookDetail | `{}` |
| 5 | `confirmSold` | 卖家确认售出 | bookDetail | `{}` |
| 6 | `getContact` | 获取卖家联系方式 | bookDetail | `{}` |
| 7 | `searchByISBN` | ISBN 查询书籍信息 | publish | `{}` |
| 8 | `getCampusConfig` | 获取校区配置 | bookmall / publish | `{ openapi: [] }` |
| 9 | `initDatabase` | 数据库初始化/修复 | myBooks | `{ openapi: [] }` |
| 10 | `submitEvaluation` | 提交交易评价 | bookDetail | `{}` |
| 11 | `getEvaluations` | 获取历史评价 | bookDetail | `{ openapi: [] }` |
| 12 | `sendMessage` | 发送交易留言 | bookDetail | `{ openapi: [] }` |
| 13 | `getMessages` | 获取交易留言 | bookDetail | `{ openapi: [] }` |
| 14 | `submitReport` | 提交举报 | bookDetail | `{ openapi: [] }` |

---

## 3. 云函数详细文档

### 3.1 `getOpenid`

**用途**：获取当前微信用户的 openid。

**输入**：无

**输出**：
```json
{
  "openid": "oABC123...",
  "appid": "wx426f180c892e5844",
  "unionid": "xxx"
}
```

**前端调用示例**：
```javascript
const res = await wx.cloud.callFunction({ name: 'getOpenid' });
const openid = res.result.openid;
```

**依赖**：`wx-server-sdk ~2.6.3`

---

### 3.2 `getBookList`

**用途**：获取书城书籍列表，支持分类、校区、学院、专业筛选、关键词搜索、排序、分页。同时可用于"自己的书"页面（`mine=true`）。

**输入参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `mine` | boolean | 否 | false | true=查当前用户自己的书 |
| `status` | string | 否 | 'available' | 书籍状态筛选 |
| `category` | string | 否 | '' | 分类筛选 |
| `campus` | string | 否 | '' | 校区筛选 |
| `college` | string | 否 | '' | 学院筛选 |
| `major` | string | 否 | '' | 专业筛选 |
| `sortType` | string | 否 | 'time' | time / price-asc |
| `keyword` | string | 否 | '' | 搜索关键词 |
| `page` | number | 否 | 1 | 页码 |
| `pageSize` | number | 否 | 20 | 每页条数 |

**输出**：
```json
{
  "success": true,
  "data": [
    {
      "_id": "book_001",
      "title": "深入理解计算机系统",
      "author": "Randal E. Bryant",
      "isbn": "9787111544937",
      "category": "textbook",
      "coverImage": "cloud://xxx.jpg",
      "price": 35.0,
      "quantity": 1,
      "condition": "likeNew",
      "status": "available",
      "isLocked": false,
      "campus": "三江校区东园",
      "college": "数理学院",
      "major": "信息与计算科学",
      "createTime": "2026-06-07T08:30:00Z",
      "interestedUsers": [{ "openid": "oDEF456...", "nickname": "李四", "createTime": "..." }]
    }
  ]
}
```

**核心逻辑**：
- `mine=true` 时按 `_openid` 过滤
- `mine=false` 时仅返回 `status='available'` 且 `isLocked=false` 的书
- 关键词搜索使用 `db.RegExp` 模糊匹配书名/作者/ISBN
- 自动修复旧书籍记录（补全 status/isLocked/quantity/interestedUsers 字段）
- **重要**：返回值中不包含 `contact` 字段

**调用方**：
- `bookmall.js`：`mine=false`，加载书城列表
- `myBooks.js`：`mine=true`，加载自己的书

---

### 3.3 `publishBook`

**用途**：发布新书，校验数据并写入 `books` 集合。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 书名（1-100字） |
| `author` | string | 是 | 作者 |
| `isbn` | string | 否 | ISBN |
| `category` | string | 是 | textbook/novel/reference/other |
| `coverImage` | string | 是 | 封面 fileID |
| `images` | array | 是 | 图片 fileID 数组（1-5张） |
| `price` | number | 是 | 价格（元） |
| `quantity` | number | 是 | 库存数量（≥1） |
| `condition` | string | 是 | new/likeNew/annotated/worn |
| `contact` | string | 是 | 联系方式（≥3字） |
| `description` | string | 否 | 描述（最多200字） |
| `campus` | string | 否 | 校区 |
| `college` | string | 否 | 学院 |
| `major` | string | 否 | 专业 |

**输出**：
```json
{
  "success": true,
  "data": { "bookId": "book_001" }
}
```

**校验规则**：
- 书名非空
- 库存 ≥ 1
- 图片 1-5 张
- 分类枚举值校验
- 新旧程度枚举值校验

**写入字段**：title, author, isbn, category, coverImage, images, price, quantity, condition, contact, description, campus, college, major, status='available', isLocked=false, createTime, interestedUsers=[]

**调用方**：`publish.js` → `onSubmit()`

---

### 3.4 `expressInterest`

**用途**：表达"想买"意向，将用户加入书籍的 `interestedUsers` 数组。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bookId` | string | 是 | 书籍ID |

**输出**：
```json
{
  "success": true,
  "message": "已表达购买意向"
}
```

**失败返回**：
```json
{
  "success": false,
  "message": "不能购买自己发布的书籍"
}
```

**校验逻辑**（按顺序）：
1. 书籍存在
2. 书籍状态为 `available`
3. 书籍未锁定（`isLocked === false`）
4. 不能买自己的书（`_openid !== book._openid`）
5. 不能重复表达意向（不在 `interestedUsers` 中）
6. 库存未耗尽（检查 `interestedUsers.length < quantity`）

**副作用**：当 `interestedUsers` 数量达到 `quantity` 时，自动设置 `isLocked=true`。

**调用方**：`bookDetail.js` → `onExpressInterest()`

---

### 3.5 `confirmSold`

**用途**：卖家确认售出，选择最终买家，更新书籍状态。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bookId` | string | 是 | 书籍ID |
| `buyerOpenid` | string | 是 | 选择的买家 openid |

**输出**：
```json
{
  "success": true,
  "message": "已确认售出"
}
```

**校验逻辑**：
1. 书籍存在
2. 调用者是发布者（`_openid === book._openid`）
3. 书籍状态为 `available`
4. buyerOpenid 在 `interestedUsers` 中

**写入字段**：`status='sold'`, `buyerOpenid`, `purchaseTime`

**调用方**：`bookDetail.js` → `onConfirmSold()`

---

### 3.6 `getContact`

**用途**：获取卖家联系方式（鉴权后返回）。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bookId` | string | 是 | 书籍ID |

**输出**：
```json
{
  "success": true,
  "data": { "contact": "wxid_abc123" }
}
```

**鉴权逻辑**：
- 卖家本人（`_openid === book._openid`）可直接查看
- 其他用户必须在 `interestedUsers` 中才能查看
- 不符合条件返回 `success: false`

**调用方**：`bookDetail.js` → `getContact()`

---

### 3.7 `searchByISBN`

**用途**：通过 ISBN 查询书籍信息（双源查询）。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `isbn` | string | 是 | ISBN 号（10位或13位） |

**输出**：
```json
{
  "success": true,
  "data": {
    "title": "深入理解计算机系统",
    "author": "Randal E. Bryant",
    "publisher": "机械工业出版社",
    "publishDate": "2016",
    "coverUrl": "https://...",
    "category": "textbook"
  }
}
```

**查询策略**：
1. 优先调用 OpenLibrary API（免费、无限制）
2. 失败后 fallback 到 Google Books API（有每日限额）
3. 超时 3 秒

**分类推断**：根据 API 返回的 subjects/categories 映射到 textbook/novel/reference/other

**⚠ 安全风险**：Google Books API Key 硬编码在代码中，应迁移到云函数环境变量。

**调用方**：`publish.js` → `searchByIsbn()`

---

### 3.8 `getCampusConfig`

**用途**：获取校区/学院/专业配置数据。

**输入参数**：无

**输出**：
```json
{
  "success": true,
  "data": {
    "campuses": [
      {
        "name": "三江校区东园",
        "colleges": [
          {
            "name": "数理学院",
            "majors": ["信息与计算科学"]
          }
        ]
      }
    ]
  }
}
```

**逻辑**：
- 优先从 `configs` 集合读取
- 无数据时自动创建/更新默认配置
- 默认包含：三江校区东园、三江校区西园、红旗校区、南昌校区

**调用方**：
- `bookmall.js`：加载校区筛选器
- `publish.js`：加载校区选择器

---

### 3.9 `initDatabase`

**用途**：一键初始化数据库，包括创建/更新配置和修复旧书籍数据。

**输入参数**：无

**输出**：
```json
{
  "success": true,
  "results": [
    "✅ 校区配置已更新",
    "✅ 扫描并修复了 3 本书籍的缺失字段"
  ]
}
```

**操作步骤**：
1. 创建或更新 `configs` 集合中的校区配置
2. 扫描所有 `books`，补全旧记录缺失的 status/isLocked/quantity/interestedUsers 字段

**调用方**：`myBooks.js` → `onInitDatabase()`（"数据异常？点击修复旧数据"按钮）

---

### 3.10 `submitEvaluation`

**用途**：提交交易评价。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bookId` | string | 是 | 书籍ID |
| `rating` | number | 是 | 评分（1-5） |
| `comment` | string | 否 | 文字评价（最多100字） |
| `tags` | array | 否 | 快捷标签（最多5个） |

**输出**：
```json
{
  "success": true,
  "message": "评价成功"
}
```

**校验逻辑**：
1. 书籍存在且状态为 `sold`
2. 当前用户是卖家（`_openid === book._openid`）或买家（`_openid === book.buyerOpenid`）
3. 未重复评价（检查 `evaluations` 集合中是否已有记录）
4. 评分在 1-5 之间

**写入字段**：bookId, fromOpenid, fromRole (buyer/seller), toOpenid, rating, comment, tags, createTime

**调用方**：`bookDetail.js` → `onSubmitEvaluation()`

---

### 3.11 `getEvaluations`

**用途**：获取书籍或用户的历史评价（匿名化，仅显示角色）。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bookId` | string | 二选一 | 按书籍查评价 |
| `targetOpenid` | string | 二选一 | 按用户查评价 |

**输出**：
```json
{
  "success": true,
  "data": [
    {
      "_id": "eval_001",
      "bookId": "book_001",
      "role": "seller",
      "rating": 5,
      "comment": "爽快交易",
      "tags": ["爽快交易", "书况如实"],
      "createTime": "2026-06-07T11:00:00Z"
    }
  ]
}
```

**匿名策略**：不返回 `fromOpenid` 和昵称，仅返回 `fromRole`（'seller'/'buyer'）。

**调用方**：`bookDetail.js` → `loadEvaluations()`

---

### 3.12 `sendMessage`

**用途**：交易留言板 - 发送留言。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bookId` | string | 是 | 书籍ID |
| `content` | string | 是 | 留言内容（最多500字） |

**输出**：
```json
{
  "success": true,
  "message": "留言成功"
}
```

**校验逻辑**：
1. 书籍存在
2. 书籍状态非 `sold`（售罄后关闭留言板）
3. 发送者是卖家或已在 `interestedUsers` 中的买家
4. 留言非空
5. 每笔交易最多 50 条留言（数量上限）

**副作用**：同步更新 `books` 集合的 `lastMessageTime` 字段

**写入字段**：bookId, fromOpenid, toOpenid, content, createTime

**调用方**：`bookDetail.js` → `onSendMessage()`

---

### 3.13 `getMessages`

**用途**：交易留言板 - 获取留言列表。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bookId` | string | 是 | 书籍ID |

**输出**：
```json
{
  "success": true,
  "data": [
    {
      "_id": "msg_001",
      "content": "你好，书还在吗？",
      "createTime": "2026-06-07T09:00:00Z",
      "isMine": false,
      "role": "buyer"
    }
  ]
}
```

**鉴权逻辑**：仅卖家或已在 `interestedUsers` 中的买家可读。

**输出标记**：
- `isMine`：是否当前用户发送
- `role`：发送者角色（'seller'/'buyer'）

**调用方**：`bookDetail.js` → `loadMessages()`

---

### 3.14 `submitReport`

**用途**：举报违规书籍或用户。

**输入参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 'book' 或 'user' |
| `targetId` | string | 是 | 举报目标ID |
| `reason` | string | 是 | 举报原因：虚假信息/诈骗/违禁品/骚扰/其他 |
| `detail` | string | 否 | 补充说明（最多200字） |

**输出**：
```json
{
  "success": true,
  "message": "举报成功"
}
```

**防重复**：同一人对同一目标只能举报一次（检查 `reports` 集合）。

**写入字段**：type, targetId, reporterOpenid, reason, detail, status='pending', createTime

**调用方**：`bookDetail.js` → `onSubmitReport()`

---

## 4. 云函数部署清单

部署时需在微信开发者工具中对每个云函数右键 → "上传并部署：云端安装依赖"。

| 云函数 | Node.js 版本 | 依赖 | 是否需要环境变量 |
|--------|-------------|------|----------------|
| getOpenid | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| getBookList | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| publishBook | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| expressInterest | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| confirmSold | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| getContact | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| searchByISBN | Node.js 12+ | wx-server-sdk ~2.6.3 | 建议：ISBN_API_KEY |
| getCampusConfig | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| initDatabase | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| submitEvaluation | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| getEvaluations | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| sendMessage | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| getMessages | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |
| submitReport | Node.js 12+ | wx-server-sdk ~2.6.3 | 否 |

---

## 5. 调用链路总览

```
app.js 启动
  ├── getOpenid → 获取 openid
  └── db.collection('users').get() → 同步用户信息

书城页 (bookmall)
  ├── getCampusConfig → 加载校区筛选器
  ├── getBookList(mine=false) → 加载书籍列表
  └── [跳转] → bookDetail / publish

自己的书页 (myBooks)
  ├── getBookList(mine=true) → 加载我的书籍
  ├── initDatabase → 数据修复
  └── [跳转] → bookDetail / publish

发布页 (publish)
  ├── getCampusConfig → 加载校区选择器
  ├── searchByISBN → ISBN 自动补全
  └── publishBook → 提交发布

详情页 (bookDetail)
  ├── db.collection('books').doc(id).get() → 直接读详情
  ├── expressInterest → 我想买
  ├── getContact → 获取联系方式
  ├── confirmSold → 确认售出
  ├── getEvaluations → 加载评价列表
  ├── submitEvaluation → 提交评价
  ├── getMessages → 加载留言
  ├── sendMessage → 发送留言
  └── submitReport → 提交举报
```
