

```markdown
# 数据库设计文档

## 版本历史
| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-06-07 | AI | 初始版本，基于 JL拾遗 v1 需求 |

## 1. 概述
本项目使用 **微信云开发数据库**（NoSQL，类 MongoDB）。所有集合均位于云开发环境 `cloud1`（环境ID按实际填写）。

### 设计原则
- 不涉及复杂关联查询，优先保证读写性能
- 每个集合均包含 `_openid` 字段，用于云数据库权限控制
- 字段命名使用驼峰式（camelCase）
- 时间统一使用 `Date` 对象（云开发服务器时间）

## 2. 集合列表

| 集合名 | 用途 |
|--------|------|
| `users` | 存储用户基本信息（昵称、头像等公开信息可被其他用户读取） |
| `books` | 存储所有二手书籍（含"想买"列表） |
| `evaluations` | 存储买卖双方的互评记录 |
| `messages` | 交易留言板消息（买卖双方沟通） |
| `reports` | 举报记录（仅管理员可见） |
| `configs` | 全局配置数据（校区等） |

> v1 不需要独立的 `orders` 集合，交易状态直接记录在 `books` 中。

## 3. 集合详细设计

### 3.1 `users` 集合

#### 字段说明
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 自动 | 系统自动生成 |
| `_openid` | string | 自动 | 微信用户唯一标识（写入时自动注入） |
| `nickname` | string | 是 | 用户昵称（当前默认"拾遗用户"，因微信已废弃自动获取） |
| `avatarUrl` | string | 是 | 用户头像URL（当前默认空，v1.1 支持自定义上传） |
| `campus` | string | 否 | 关联的校区（由"自动关联"功能写入） |
| `college` | string | 否 | 关联的学院 |
| `major` | string | 否 | 关联的专业 |
| `createTime` | date | 是 | 用户首次登录时间（`new Date()`） |
| `updateTime` | date | 否 | 最后一次登录或个人信息更新时间 |

#### 索引
- `_openid` 唯一索引（自动，由云开发维护）
- 无需其他索引

#### 安全规则（云开发权限）
```json
{
  "read": true,
  "write": "doc._openid == auth.openid"
}
```
> **说明**：所有登录用户可读其他用户的基本信息（昵称、头像），用于书城列表和详情页展示。
> 仅本人可写入/修改自己的记录。
> 如需更严格的隐私控制，可将敏感字段拆分到子集合。

#### 示例文档
```json
{
  "_id": "abcd1234...",
  "_openid": "oABC123...",
  "nickname": "张三",
  "avatarUrl": "https://thirdwx.qlogo.cn/...",
  "createTime": {"$date": "2026-06-07T08:00:00Z"},
  "updateTime": {"$date": "2026-06-07T08:00:00Z"}
}
```

---

### 3.2 `books` 集合

#### 字段说明
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 自动 | 系统自动生成 |
| `_openid` | string | 自动 | 发布者的微信 openid |
| `title` | string | 是 | 书名 |
| `author` | string | 是 | 作者（手动录入时若未知可填"未知"） |
| `isbn` | string | 否 | ISBN 号（13位或10位），用于去重和自动补全 |
| `category` | string | 是 | 分类，枚举值：`'textbook'`（教材）、`'novel'`（小说）、`'reference'`（教辅）、`'other'`（其他） |
| `coverImage` | string | 是 | 封面图片的云存储 fileID（取自 `images` 的第一张） |
| `images` | array | 是 | 所有图片的 fileID 数组（至少1张，最多5张） |
| `price` | number | 是 | 售价（单位：元） |
| `quantity` | number | 是 | 库存数量（默认1） |
| `condition` | string | 是 | 新旧程度，枚举值：`'new'`（全新）、`'likeNew'`（几乎全新）、`'annotated'`（有笔记）、`'worn'`（较旧） |
| `contact` | string | 是 | 联系方式（微信号/手机号，**不通过前端直接读库返回**，仅通过云函数鉴权后返回） |
| `description` | string | 否 | 自定义补充描述（最多200字） |
| `campus` | string | 否 | 校区 |
| `college` | string | 否 | 学院 |
| `major` | string | 否 | 专业 |
| `status` | string | 是 | 书籍状态，枚举值：`'available'`（在售）、`'sold'`（已售罄）、`'removed'`（已下架/软删除） |
| `isLocked` | boolean | 否 | 是否已锁定（interestedUsers达到quantity时自动设置为true） |
| `createTime` | date | 是 | 发布时间（服务器时间） |
| `interestedUsers` | array | 否 | 表达"想买"意向的用户列表，元素：`{ openid, nickname, createTime }` |
| `buyerOpenid` | string | 否 | 最终购买者的 openid（仅在 `status='sold'` 时存在） |
| `purchaseTime` | date | 否 | 成交时间（仅在 `status='sold'` 时存在） |
| `lastMessageTime` | date | 否 | 最后一条留言的时间（用于"自己的书"页显示"· 有留言"提示） |

#### 索引
在云开发控制台按**优先级**手动创建以下索引（索引数有配额限制，按需创建）：

| 优先级 | 索引字段 | 用途 |
|-------|---------|------|
| **必须** | `category` + `status` + `createTime`（降序） | 书城列表默认查询：按分类筛选在售书籍，按时间排序 |
| **必须** | `_openid` + `status` | "自己的书"页面查询：查某用户的所有在售/已售罄书籍 |
| **推荐** | `category` + `status` + `price`（升序） | 按价格排序（各分类内） |
| 可选 | `isbn` | 按 ISBN 查重 |

#### 安全规则（云开发权限）
```json
{
  "read": true,
  "write": "doc._openid == auth.openid"
}
```
> **说明**：所有登录用户可读取书籍列表和详情。仅发布者可写入/更新。
>
> **重要**：`contact` 字段虽在集合中可读，但**前端代码不应直接从数据库读取展示**。
> 正确做法：
> - 列表/详情页查询时通过 `.field({ contact: false })` 排除 `contact` 字段
> - 用户点击"我想买"后，调用云函数 `getContact(bookId)`，云函数内验证用户已表达意向后再返回联系方式
>
> **售罄操作**：卖家确认售出时，更新 `status='sold'` 并写入 `buyerOpenid`。由于买家 openid 不等于文档的 `_openid`，此操作通过云函数 `confirmSold(bookId, buyerOpenid)` 以管理员权限完成。云函数内校验：调用者 === 发布者、书籍在售、buyerOpenid 在 `interestedUsers` 中。

#### 示例文档（在售）
```json
{
  "_id": "book_001",
  "_openid": "oABC123...",
  "title": "深入理解计算机系统",
  "author": "Randal E. Bryant",
  "isbn": "9787111544937",
  "category": "textbook",
  "coverImage": "cloud://xxx.jpg",
  "images": ["cloud://xxx.jpg", "cloud://yyy.jpg"],
  "price": 35.0,
  "quantity": 1,
  "condition": "likeNew",
  "contact": "wxid_abc123",
  "campus": "三江校区东园",
  "college": "数理学院",
  "major": "信息与计算科学",
  "description": "几乎全新，只有前两章有铅笔笔记",
  "status": "available",
  "isLocked": false,
  "createTime": {"$date": "2026-06-07T08:30:00Z"},
  "interestedUsers": [
    { "openid": "oDEF456...", "nickname": "李四", "createTime": {"$date": "2026-06-07T09:00:00Z"} }
  ],
  "lastMessageTime": null
}
```

#### 示例文档（已售罄）
```json
{
  "_id": "book_001",
  "_openid": "oABC123...",
  "title": "深入理解计算机系统",
  "...": "...（同上）",
  "status": "sold",
  "buyerOpenid": "oXYZ789...",
  "purchaseTime": {"$date": "2026-06-07T10:00:00Z"}
}
```

---

### 3.3 `evaluations` 集合

#### 用途
存储买卖双方的互评记录。独立于 `books` 集合，支持一个用户多次交易的信用积累。

#### 字段说明
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 自动 | 系统自动生成 |
| `bookId` | string | 是 | 关联的书籍 `_id` |
| `fromOpenid` | string | 是 | 评价发起者 openid |
| `fromRole` | string | 是 | 评价者角色：`'buyer'` / `'seller'` |
| `toOpenid` | string | 是 | 被评价者 openid |
| `rating` | number | 是 | 1-5 星 |
| `comment` | string | 否 | 文字评价（最多 100 字） |
| `tags` | array | 否 | 快捷标签，如 `["爽快交易", "书况如实"]` |
| `createTime` | date | 是 | 评价时间 |

#### 索引
| 优先级 | 索引字段 | 用途 |
|-------|---------|------|
| **必须** | `toOpenid` + `createTime`（降序） | 查某用户收到的所有评价（信用页） |
| **必须** | `bookId` | 查某书籍关联的所有评价 |

#### 安全规则
```json
{
  "read": true,
  "write": "doc.fromOpenid == auth.openid"
}
```
> 所有用户可读评价，仅评价者本人可创建。

#### 示例文档
```json
{
  "_id": "eval_001",
  "bookId": "book_001",
  "fromOpenid": "oXYZ789...",
  "fromRole": "buyer",
  "toOpenid": "oABC123...",
  "rating": 5,
  "comment": "书很新，卖家很爽快",
  "tags": ["爽快交易", "书况如实"],
  "createTime": {"$date": "2026-06-07T11:00:00Z"}
}
```

---

### 3.4 `messages` 集合

#### 用途
存储交易留言板消息，买卖双方在书籍售出前可通过留言板进行文字交流。

#### 字段说明
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 自动 | 系统自动生成 |
| `bookId` | string | 是 | 关联的书籍 `_id` |
| `fromOpenid` | string | 是 | 留言发送者 openid |
| `toOpenid` | string | 是 | 留言接收者 openid |
| `content` | string | 是 | 留言内容（最多500字） |
| `createTime` | date | 是 | 发送时间 |

#### 索引
| 优先级 | 索引字段 | 用途 |
|-------|---------|------|
| **必须** | `bookId` + `createTime`（升序） | 按书籍查询留言列表（按时间正序展示） |

#### 安全规则
```json
{
  "read": "doc.bookId 对应的书籍交易方可见",
  "write": "doc.fromOpenid == auth.openid"
}
```
> 仅留言发送者可写；读权限通过云函数 `getMessages` 鉴权控制，前端不可直接读。

#### 示例文档
```json
{
  "_id": "msg_001",
  "bookId": "book_001",
  "fromOpenid": "oDEF456...",
  "toOpenid": "oABC123...",
  "content": "你好，书还在吗？",
  "createTime": {"$date": "2026-06-07T09:30:00Z"}
}
```

#### 业务约束
- 每笔交易（每个 bookId）最多 50 条留言
- 书籍售罄（status='sold'）后不允许再发新留言
- 留言仅卖家和已表达"想买"意向的买家可见

---

### 3.5 `reports` 集合

#### 用途
存储用户提交的举报记录。v1 仅记录，不做任何自动处理。

#### 字段说明
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 自动 | 系统自动生成 |
| `type` | string | 是 | 举报类型：`'book'` / `'user'` |
| `targetId` | string | 是 | 举报目标ID（书籍 _id 或用户 openid） |
| `reporterOpenid` | string | 是 | 举报者 openid |
| `reason` | string | 是 | 举报原因：虚假信息 / 诈骗 / 违禁品 / 骚扰 / 其他 |
| `detail` | string | 否 | 补充说明（最多200字） |
| `status` | string | 是 | 处理状态：`'pending'`（待处理） |
| `createTime` | date | 是 | 举报时间 |

#### 索引
| 优先级 | 索引字段 | 用途 |
|-------|---------|------|
| **必须** | `targetId` | 查询同一目标的所有举报 |
| **必须** | `reporterOpenid` + `targetId` | 防重复举报判断 |

#### 安全规则
```json
{
  "read": false,
  "write": "doc.reporterOpenid == auth.openid"
}
```
> 普通用户不可读举报记录（仅管理员可见），仅举报者本人可创建。

#### 示例文档
```json
{
  "_id": "report_001",
  "type": "book",
  "targetId": "book_001",
  "reporterOpenid": "oXYZ123...",
  "reason": "虚假信息",
  "detail": "ISBN与书籍不符",
  "status": "pending",
  "createTime": {"$date": "2026-06-07T10:00:00Z"}
}
```

---

### 3.6 `configs` 集合

#### 用途
存储全局配置数据，如校区/学院/专业列表。

#### 字段说明
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `_id` | string | 自动 | 系统自动生成 |
| `type` | string | 是 | 配置类型标识，如 `'campus'` |
| `data` | object | 是 | 配置数据内容 |
| `createTime` | date | 是 | 创建时间 |
| `updateTime` | date | 是 | 最后更新时间 |

#### 索引
| 优先级 | 索引字段 | 用途 |
|-------|---------|------|
| **必须** | `type` 唯一索引 | 按类型获取配置 |

#### 安全规则
```json
{
  "read": true,
  "write": false
}
```
> 所有用户可读，仅云函数（管理权限）可写。

#### 示例文档
```json
{
  "_id": "config_001",
  "type": "campus",
  "data": {
    "campuses": [
      {
        "name": "三江校区东园",
        "colleges": [
          {
            "name": "数理学院",
            "majors": ["信息与计算科学", "应用数学"]
          }
        ]
      }
    ]
  },
  "createTime": {"$date": "2026-06-07T08:00:00Z"},
  "updateTime": {"$date": "2026-06-07T08:00:00Z"}
}
```

---

## 4. 云函数专用环境变量
- `ISBN_API_KEY`（可选）：第三方 ISBN 查询 API 的 key（如使用 `api.jike.xyz`）
- `GOOGLE_BOOKS_API_KEY`（推荐）：Google Books API Key，当前硬编码在 searchByISBN 云函数中，应迁移到环境变量
- 不涉及其他第三方密钥

## 5. 数据迁移与初始化
- 首次发布时，不需要预置数据。
- 可通过 `initDatabase` 云函数批量修复旧数据和初始化配置。
- 云函数自动补全旧书籍缺失字段（status, isLocked, quantity, interestedUsers）。
```



```markdown
# 编码规范

## 版本历史
| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-06-07 | AI | 初始版本，基于微信小程序 + 云开发 |

## 1. 项目目录结构

```
JL拾遗/
├── miniprogram/               # 小程序前端代码
│   ├── pages/                 # 页面目录
│   │   ├── bookmall/          # 首页（书城）Tab1 - 浏览在售书籍
│   │   ├── myBooks/           # "自己的书"页面 Tab2 - 我的发布
│   │   ├── bookDetail/        # 书籍详情页
│   │   ├── publish/           # 发布新书页面
│   │   ├── editBook/          # 编辑书籍页面
│   │   └── userProfile/       # 用户主页（查看信用评价，可选 v2）
│   ├── components/            # 自定义组件
│   │   ├── book-card/         # 书籍卡片组件（书城/"自己的书"复用）
│   │   ├── search-bar/        # 搜索栏组件（含防抖）
│   │   ├── rating/            # 星级评价组件
│   │   └── condition-tag/     # 新旧程度标签
│   ├── utils/                 # 工具函数
│   │   ├── api.js             # 封装云函数调用（统一错误处理）
│   │   ├── date.js            # 日期格式化
│   │   ├── validator.js       # 表单校验规则
│   │   └── image.js           # 图片压缩/上传工具
│   ├── app.js                 # 小程序入口（云开发初始化、登录）
│   ├── app.json               # 全局配置（路由、tabBar 等）
│   └── app.wxss               # 全局样式（主题色、通用类）
├── cloudfunctions/            # 云函数目录
│   ├── confirmSold/           # 卖家确认售出（写 books + 通知）
│   ├── getBookList/           # 获取书城列表（分页、搜索、排序）
│   ├── getContact/            # 获取卖家联系方式（需鉴权）
│   ├── publishBook/           # 发布新书（校验 + 写入）
│   ├── searchByISBN/          # 通过 ISBN 查询书籍信息（第三方 API）
│   └── sendNotification/      # 发送微信订阅消息（可合并到其他云函数）
├── project.config.json        # 项目配置
└── README.md                  # 项目说明
```

## 2. 命名规范

### 2.1 文件与文件夹
- **页面文件夹**：使用小驼峰（lowerCamelCase），例如 `bookDetail`、`mybooks`
- **页面文件**：必须为 `.js`、`.wxml`、`.wxss`、`.json`，主文件名与文件夹名相同（`bookDetail.js`）
- **组件文件夹**：使用 kebab-case（短横线），例如 `book-card`，组件内文件名为 `index.js`、`index.wxml`
- **工具函数文件**：小驼峰，例如 `api.js`、`date.js`
- **云函数**：小驼峰，例如 `confirmSold`

### 2.2 变量与函数（JS）
- **普通变量**：小驼峰，如 `bookList`、`price`
- **常量**：全大写 + 下划线，如 `MAX_IMAGES_COUNT = 5`
- **布尔值**：以 `is` / `has` / `can` 开头，如 `isAvailable`、`hasContact`
- **函数**：小驼峰 + 动词开头，如 `getBookList()`、`formatDate()`、`handleBuy()`
- **回调函数**：以 `on` 开头，如 `onLoad`、`onTapBuy`
- **云函数返回值**：统一结构 `{ success: boolean, data: any, message: string }`

### 2.3 数据库字段（已在数据库文档中定义）
- 使用小驼峰，如 `coverImage`、`createTime`

### 2.4 WXML 中的 `data-*` 属性
- 使用短横线连接，如 `data-book-id`、`data-index`

## 3. 代码风格

### 3.1 JavaScript
- 使用 ES6+ 语法（`let` / `const`、箭头函数、模板字符串、解构）
- 每条语句后加分号（防止自动插入导致的歧义）
- 使用 `===` 和 `!==`，避免 `==`
- 异步操作优先使用 `async/await`，避免回调地狱
- 云函数调用示例：
  ```javascript
  async getBookList() {
    wx.showLoading({ title: '加载中' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getBookList',
        data: { page: 1, pageSize: 20 }
      });
      if (res.result.success) {
        this.setData({ bookList: res.result.data });
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' });
      }
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
  ```

### 3.2 WXML
- 使用 `wx:for` 时，必须提供 `wx:key`（优先使用 `_id` 或 `index`）
- 尽量避免过深的嵌套（不超过5层）
- 条件渲染 `wx:if` 与 `hidden` 的选择：频繁切换用 `hidden`，条件性显示用 `wx:if`
- 事件绑定使用 `bind:`（如 `bind:tap`），避免使用 `catch` 阻止冒泡除非必要

### 3.3 WXSS
- 使用 `rpx` 作为主要尺寸单位（1rpx = 1物理像素/屏幕宽度750）
- 全局样式定义在 `app.wxss`，页面样式局部定义
- **主题色**：
  ```css
  page {
    --primary-color: #5847ff;
    --primary-gradient: linear-gradient(135deg, #5847ff, #7c6fff);
    --bg-gray: #f5f5f5;
    --card-white: #ffffff;
    --text-dark: #333333;
    --text-light: #666666;
    --border-radius: 12rpx;
  }
  ```
- 避免使用 `!important`

### 3.4 JSON 配置文件
- `app.json` 中的 `pages` 数组第一项为首页
- `tabBar` 的 `list` 最多5项（本项目为2项）
- 每个页面需配置 `navigationBarTitleText`

## 4. Git 工作流（简化版）
由于个人开发，采用简单分支策略：
- `main` 分支：稳定版本，与线上小程序对应
- `dev` 分支：日常开发
- 每完成一个功能点，合并 `dev` 到 `main` 并打 tag（如 `v1.0.0`）

提交信息格式：
```
<type>(<scope>): <subject>
```
- type: feat / fix / docs / style / refactor / test / chore
- scope: 可选，如 `book`、`user`、`cloudfunction`
- subject: 简短描述，不超过50字

示例：
```
feat(book): 添加书籍详情页"我想买"和"确认售出"按钮
fix(cloudfunction): 修复confirmSold中buyerOpenid校验的bug
```

## 5. 云开发使用规范

### 5.1 数据库操作
- **优先使用云函数**进行复杂查询或需要跳过权限的操作（如 `confirmSold`、`getContact`）
- 前端直接操作数据库仅限简单的查询当前用户数据（如 `db.collection('users').where({ _openid: '{openid}' }).get()`）
- 所有数据库查询必须考虑分页（`skip` + `limit`），防止一次性拉取过多数据

### 5.2 云函数
- 每个云函数应独立，单一职责
- 云函数入口 `index.js` 结构：
  ```javascript
  exports.main = async (event, context) => {
    const { OPENID } = context; // 自动注入
    try {
      // 业务逻辑
      return { success: true, data: result };
    } catch (err) {
      console.error(err);
      return { success: false, message: err.message };
    }
  };
  ```
- 云函数中调用其他云函数：使用 `cloud.callFunction`

### 5.3 云存储
- 图片上传后返回的 `fileID` 可直接用于 `<image src="{{fileID}}">`
- 上传路径规范：`books/{timestamp}_{random}.jpg`（**不包含 openid**，避免路径泄露用户标识）
- 用户头像不需要上传到云存储，直接使用微信头像 URL
- 上传前必须压缩：`wx.compressImage({ quality: 80, maxLength: 1920 })`，单张上限 2MB

## 6. 错误处理与日志
- 所有 `wx.cloud.callFunction` 必须 `try...catch`
- 关键操作（发布、购买）需二次确认弹窗
- 使用 `console.error` 输出错误，开发阶段辅助调试，正式环境自动忽略

## 7. 性能与体验
- 列表图片使用懒加载（`<image lazy-load>`）
- 分页加载时，避免重复请求（设置 `loadingMore` 标志）
- 用户输入防抖（搜索框输入延迟300ms后再请求）

## 8. 安全规范
- **严禁**在小程序前端代码中硬编码任何密钥、密码
- 用户上传图片需在前端提示"不得包含违规内容"（v1先提示，后续可接入安全接口）
- 联系方式**不在前端列表/详情页直接展示**，仅在用户表达"想买"意向后通过云函数鉴权返回（见 `getContact` 云函数）

```

