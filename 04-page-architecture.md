# 页面架构与数据流

## 版本历史
| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-06-08 | AI | 初始版本，基于 v1 MVP 全部 4 个页面 |

## 1. 页面总览

| 页面 | 路径 | 类型 | 用途 |
|------|------|------|------|
| 书城 | `pages/bookmall/bookmall` | Tab1 | 浏览在售书籍、搜索、筛选、排序 |
| 自己的书 | `pages/myBooks/myBooks` | Tab2 | 管理我的发布、用户基本信息 |
| 书籍详情 | `pages/bookDetail/bookDetail` | 子页 | 完整信息展示、交易操作、评价、留言、举报 |
| 发布新书 | `pages/publish/publish` | 子页 | ISBN 或手动录入发布新书 |

---

## 2. 全局架构

### 2.1 app.js 启动流程

```
用户打开小程序
  ↓
wx.cloud.init()           # 初始化云开发
  ↓
getOpenid()               # 调用云函数获取 openid
  ↓
syncUserInfo()            # 检查/创建 users 记录
  ↓
globalData.isLoginReady = true   # 全局登录就绪标志
  ↓
[进入 Tab1: 书城]
```

### 2.2 全局数据 (app.globalData)

| 字段 | 类型 | 说明 |
|------|------|------|
| `isLoginReady` | boolean | 登录是否完成 |
| `openid` | string | 当前用户 openid |

### 2.3 全局样式变量 (app.wxss)

| CSS 变量 | 值 | 用途 |
|---------|-----|------|
| `--primary-color` | `#5847ff` | 主题色 |
| `--primary-gradient` | `linear-gradient(135deg, #5847ff, #7c6fff)` | 主题渐变 |
| `--primary-light` | `rgba(88, 71, 255, 0.08)` | 浅色主题背景 |
| `--primary-dark` | (继承主题色) | 主题文字色 |
| `--bg-gray` | `#f5f5f5` | 页面背景 |
| `--bg-white` | `#ffffff` | 卡片/内容区背景 |
| `--text-dark` | `#333333` | 主文字 |
| `--text-gray` | `#666666` | 次要文字 |
| `--text-light` | `#999999` | 辅助文字 |
| `--border-color` | `#eeeeee` | 边框分割线 |
| `--border-radius` | `16rpx` | 卡片圆角 |
| `--shadow-card` | `0 2rpx 16rpx rgba(0,0,0,0.06)` | 卡片阴影 |

### 2.4 工具函数模块 (utils/)

| 文件 | 导出方法 | 用途 |
|------|---------|------|
| `api.js` | `callFunction(name, data, options)` | 统一封装云函数调用（loading + 错误处理） |
| `date.js` | `formatRelativeTime(date)` | 相对时间（刚刚/x分钟前/x小时前/x天前） |
| `date.js` | `formatDateTime(date)` | 格式化日期时间（yyyy-MM-dd HH:mm） |
| `image.js` | `compressImage(src)` | 压缩图片（quality 80, maxLength 1920） |
| `image.js` | `uploadImage(filePath, prefix)` | 上传单张图片到云存储 |
| `image.js` | `batchUploadImages(tempPaths, onProgress)` | 批量压缩并上传 |
| `validator.js` | `title/author/price/contact/isbn/images` | 表单字段校验规则 |

---

## 3. 页面详细架构

### 3.1 书城页 (bookmall)

#### 生命周期

```
onLoad()
  ↓
loadCampusConfig()          # 获取校区/学院/专业配置
  ↓
loadBookList(reset=true)    # 加载第一页数据
  ↓
onShow() → loadBookList()   # 每次显示时刷新
```

#### 数据字段 (data)

```
categories:        []     # 分类选项（全部/教材/小说/教辅/其他）
activeCategory:    'all'  # 当前分类
campusList:        []     # 校区列表
campusIndex:       -1     # 校区选择器索引
collegeList:       []     # 学院列表
collegeIndex:      -1     # 学院选择器索引
majorList:         []     # 专业列表
majorIndex:        -1     # 专业选择器索引
activeCampus:      ''     # 当前选中校区
activeCollege:     ''     # 当前选中学院
activeMajor:       ''     # 当前选中专业
sortType:          'time' # 排序方式
searchKeyword:     ''     # 搜索关键词
searchTimer:       null   # 防抖定时器
bookList:          []     # 书籍列表
page:              1      # 当前页码
pageSize:          20     # 每页条数
hasMore:           true   # 是否有更多数据
loading:           false  # 是否加载中
loadingMore:       false  # 是否加载更多中
refreshing:        false  # 是否刷新中
```

#### 关键方法

| 方法 | 触发 | 说明 |
|------|------|------|
| `loadCampusConfig()` | onLoad | 加载校区配置，fallback 本地默认数据 |
| `loadBookList(reset)` | onLoad/onShow/筛选变化 | 调用 getBookList 云函数，reset=true 重置分页 |
| `onRefresh()` | 下拉刷新 | 重置列表重新加载 |
| `onReachBottom()` | 触底 | 加载更多 |
| `onCategoryChange(e)` | 点击分类标签 | 切换分类筛选 |
| `onSortChange()` | 点击排序 | 切换 time ↔ price-asc |
| `onSearchInput(e)` | 输入搜索 | 300ms 防抖后搜索 |
| `onCampusFilterChange(e)` | 选择校区 | 级联清空学院/专业 |
| `onTapBook(e)` | 点击卡片 | 跳转 bookDetail?id=xxx |

#### UI 结构

```
┌─────────────────────────────────┐
│  [搜索框] [清除]                 │
├─────────────────────────────────┤
│  [校区▾] [学院▾] [专业▾]        │  ← 横向滚动筛选
├─────────────────────────────────┤
│  [全部] [教材] [小说] [教辅] ... │  ← 分类标签
├─────────────────────────────────┤
│  排序：[最新发布 ▼]             │  ← 排序栏
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ [封面] 书名                 │  │
│  │        作者 · 校区          │  │
│  │        [标签] [标签]        │  │
│  │        ¥35  余1件  卖家昵称  │  │  ← 书籍卡片
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ...                        │  │
│  └───────────────────────────┘  │
│                                 │
│         没有更多了               │  ← 加载完毕提示
└─────────────────────────────────┘
```

---

### 3.2 "自己的书"页 (myBooks)

#### 生命周期

```
onShow()
  ↓
等待 app.globalData.isLoginReady
  ↓
loadUserInfo()    # 加载用户昵称/头像
loadBookList()    # 加载我的书籍
```

#### 数据字段 (data)

```
userInfo:     { nickname: '拾遗用户', avatarUrl: '' }  # 用户信息
tabs:         ['在售中', '已售罄']                      # 标签页
activeTab:    'available'                              # 当前标签
bookList:     []                                       # 书籍列表
loading:      true                                     # 加载中
```

#### 关键方法

| 方法 | 触发 | 说明 |
|------|------|------|
| `loadUserInfo()` | onShow | 从 users 集合读取昵称/头像 |
| `loadBookList()` | onShow/切换Tab | 调用 getBookList(mine=true) |
| `onTabChange(e)` | 点击Tab | 切换在售中/已售罄 |
| `onRemoveBook(e)` | 点击下架 | 二次确认 → status='removed' |
| `onInitDatabase()` | 点击修复 | 调用 initDatabase 云函数 |
| `onTapPublish()` | 点击发布 | 跳转 publish |

#### UI 结构

```
┌─────────────────────────────────┐
│  ╔═══════════════════════════╗  │
│  ║ [头像]  昵称               ║  │  ← 渐变头部
│  ╚═══════════════════════════╝  │
├─────────────────────────────────┤
│  [在售中]  [已售罄]              │  ← 标签切换
│  ─────                           │  ← 下划线指示器
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ [封面] 书名                 │  │
│  │        ¥35  3人想买·有留言  │  │  ← 状态栏含留言提示
│  │                    [下架]  │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│        [+ 发布新书]              │  ← 固定底部按钮
└─────────────────────────────────┘
```

**空状态**：当列表为空时显示空状态图 + "数据异常？点击修复旧数据"入口。

**留言提示**：当 `lastMessageTime` 字段有值时，在"在售中"tab 的书籍状态栏追加橙色 "· 有留言" 提示。

---

### 3.3 书籍详情页 (bookDetail)

#### 生命周期

```
onLoad(options)         # 获取 bookId
  ↓
loadBookDetail()        # 从数据库直接读取书籍详情
  ↓
判断角色：
  isOwner    = _openid === book._openid
  isSeller   = _openid === book.buyerOpenid
  hasExpressedInterest = openid 在 interestedUsers 中
  ↓
showMessageBoard = isOwner || hasExpressedInterest || isSeller
  ↓
if showMessageBoard → loadMessages()   # 加载留言
loadEvaluations()                      # 加载历史评价
```

#### 数据字段 (data)

```
# 基础信息
bookId:              ''       # 书籍ID
book:                null     # 书籍完整数据
loading:             true     # 加载中

# 用户角色
isOwner:             false    # 是否发布者
isSeller:            false    # 是否成交买家
hasExpressedInterest:false    # 是否已表达想买
showContact:         false    # 是否显示联系方式
isLocked:            false    # 是否已锁定
remainCount:         0        # 剩余数量

# 评价
showEvaluation:      false    # 评价弹窗
evaluationRating:    0        # 评分
evaluationComment:   ''       # 评价文字
canEvaluate:         false    # 是否可评价
evaluationList:      []       # 历史评价列表
myEvaluation:        null     # 我的评价

# 举报
showReport:          false    # 举报弹窗
reportReason:        ''       # 举报原因
reportDetail:        ''       # 举报详情
reportReasons:       []       # 举报原因选项列表

# 留言板
showMessageBoard:    false    # 是否显示留言板
messages:            []       # 留言列表
messageInput:        ''       # 留言输入
messagesLoading:     false    # 留言加载中
```

#### 关键方法

| 方法 | 说明 |
|------|------|
| `loadBookDetail()` | 直接从数据库读取（`db.collection('books').doc(id).get()`），判断角色 |
| `loadEvaluations()` | 调用 `getEvaluations` 云函数 |
| `loadMessages()` | 调用 `getMessages` 云函数 |
| `onExpressInterest()` | 二次确认 → `expressInterest` |
| `getContact()` | 调用 `getContact` 云函数 |
| `onCopyContact()` | 复制联系方式到剪贴板 |
| `onConfirmSold()` | ActionSheet 选买家 → 二次确认 → `confirmSold` |
| `onShowEvaluation()` | 打开评价弹窗 |
| `onSubmitEvaluation()` | 调用 `submitEvaluation` 云函数 |
| `onSendMessage()` | 调用 `sendMessage` 云函数 |
| `onShowReport()` | 打开举报弹窗 |
| `onSubmitReport()` | 调用 `submitReport` 云函数 |
| `onPreviewImage(e)` | 图片预览 |
| `onShareAppMessage()` | 分享到聊天 |
| `onShareTimeline()` | 分享到朋友圈 |

#### UI 结构

```
┌─────────────────────────────────┐
│  [图片轮播 swiper]               │  ← 多图左右滑动
├─────────────────────────────────┤
│  书名                             │
│  作者 · ISBN · 分类               │  ← 基本信息卡片
│  校区 / 学院 / 专业               │
│  ¥35 · 库存1 · 几乎全新           │
│  发布时间                         │
├─────────────────────────────────┤
│  卖家：昵称                       │  ← 卖家信息卡片
│  联系方式：****  [复制]           │  ← 条件显示
├─────────────────────────────────┤
│  卖家描述：...                    │  ← 条件显示（有描述时）
├─────────────────────────────────┤
│  想买的用户：                     │  ← 仅卖家可见
│  · 李四                           │
│  [确认售出]                       │
├─────────────────────────────────┤
│  [评价对方]                       │  ← 售罄后可见
├─────────────────────────────────┤
│  交易评价（3条）                   │  ← 历史评价列表
│  卖家 ★★★★★  爽快交易             │  ← 匿名，仅显示角色
│  买家 ★★★★☆  书况如实             │
├─────────────────────────────────┤
│  交易留言                         │  ← 仅交易双方可见
│  ┌───────────────────────────┐  │
│  │ 买家：你好，书还在吗？       │  │
│  │ 卖家：在的                    │  │
│  └───────────────────────────┘  │
│  [输入留言...] [发送]            │  ← 售罄后关闭
├─────────────────────────────────┤
│  举报此书                         │  ← 极隐链接
└─────────────────────────────────┘

底部操作栏（动态显示）：
- 非卖家 + 非锁定："[我想买]"
- 已表达意向："[查看联系方式]"
- 卖家 + 有想买用户："[确认售出]"
- 已被全部预定：显示"已被全部预定"
- 已售罄：显示"已售罄"
```

#### 底部操作栏状态机

```
book.status === 'sold'           → "已售罄"
isOwner && status==='available'  → "确认售出"（如有想买用户）
isLocked                          → "已被全部预定"
hasExpressedInterest              → "查看联系方式" + 联系方式显示
!hasExpressedInterest             → "我想买"
```

---

### 3.4 发布新书页 (publish)

#### 生命周期

```
onLoad()
  ↓
loadCampusConfig()       # 加载校区配置
restoreUserCampus()      # 从 users 记录恢复上次选择的校区
```

#### 数据字段 (data)

```
isbnMode:            true      # 录入模式（true=ISBN / false=手动）
isbn:                ''        # ISBN 输入
isbnLoading:         false     # ISBN 查询中
isbnResult:          null      # ISBN 查询结果
formData:            {         # 表单数据
  title: '', author: '', isbn: '',
  category: 'other', price: '', quantity: 1,
  condition: 'likeNew', contact: '',
  description: '', campus: '', college: '', major: ''
}
categories:          []        # 分类选项
categoryIndex:       3         # 分类索引
conditions:          []        # 新旧程度选项
conditionIndex:      1         # 新旧程度索引
campusList:          []        # 校区列表
campusIndex:         -1        # 校区索引
collegeList:         []        # 学院列表
collegeIndex:        -1        # 学院索引
majorList:           []        # 专业列表
majorIndex:          -1        # 专业索引
autoAssociate:       false     # 自动关联开关
submitting:          false     # 提交中
```

#### 关键方法

| 方法 | 说明 |
|------|------|
| `loadCampusConfig()` | 同书城页，加载校区配置 |
| `restoreUserCampus()` | 从 users 集合恢复上次选择的校区/学院/专业 |
| `switchToIsbnMode()` | 切换到 ISBN 录入模式 |
| `switchToManualMode()` | 切换到手动录入模式 |
| `onScanIsbn()` | `wx.scanCode` 扫码 ISBN |
| `searchByIsbn(isbn)` | 调用 `searchByISBN` 云函数，自动填充表单 |
| `onChooseImage()` | `wx.chooseMedia` 选图（最多5张） |
| `uploadImages(tempPaths)` | 压缩并上传到云存储 |
| `onSubmit()` | 表单校验 → 二次确认 → `publishBook` 云函数 → 同步用户校区 → 跳转 myBooks |
| `validateForm()` | 前端表单校验 |
| `syncUserCampus()` | 自动关联：更新 users 集合的校区/学院/专业字段 |

#### UI 结构

```
┌─────────────────────────────────┐
│  [ISBN 快速录入] [手动录入]       │  ← 模式切换
├─────────────────────────────────┤
│  ISBN：[_ _ _ _ _ _] [扫码] [查] │  ← ISBN 模式
│  或                               │
│  书名：[____________]             │  ← 手动模式
│  作者：[____________]             │
│  ISBN：[____________]             │
│  分类：[其他 ▼]                   │
│  校区：[_ _ ▼] 学院：[_ _ ▼]     │  ← 三级联选
│  专业：[_ _ ▼]                    │
│  [✓] 自动关联                     │
│  价格：[____] 元                  │
│  数量：[—] 1 [+]                 │  ← +/— 按钮
│  新旧：[几乎全新 ▼]               │
│  联系方式：[____________]         │
│  ┌──隐私提示──────────────┐      │
│  │ 联系方式仅想买用户可见   │      │
│  └────────────────────────┘      │
│  描述：[__________________] 0/200 │
├─────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │ 图1 │ │ 图2 │ │ 图3 │ │ +  │  │  ← 图片网格
│  │ [X] │ │ [X] │ │     │ │    │  │
│  └────┘ └────┘ └────┘ └────┘   │
│         至少上传 1 张封面图        │
├─────────────────────────────────┤
│  [立即发布]                      │  ← 固定底部按钮
└─────────────────────────────────┘
```

---

## 4. 数据保护策略

### 4.1 联系方式保护

| 位置 | 策略 |
|------|------|
| 书城列表 | `getBookList` 云函数不返回 `contact` 字段 |
| 详情页 | 默认隐藏；仅表达"想买"后通过 `getContact` 云函数鉴权返回 |
| 数据库直接读 | ⚠ bookDetail.js 中 `loadBookDetail()` 直接读库，未过滤 `contact` 字段 |

### 4.2 写操作鉴权

| 操作 | 鉴权方式 |
|------|---------|
| 发布新书 | 云函数自动注入 `_openid` |
| 我想买 | 云函数校验不能买自己的书 |
| 确认售出 | 云函数校验调用者是发布者 |
| 评价 | 云函数校验调用者是交易方 |
| 留言 | 云函数校验调用者是交易方 |
| 下架书籍 | `_openid` 匹配（前端权限） |

---

## 5. 前后端数据流

```
前端页面                     云函数                   数据库集合
─────────                   ────────                 ──────────
bookmall.onLoad()  ──────→ getBookList  ──────────→ books
                   ←──────  data[]     ←──────────

publish.onSubmit() ──────→ publishBook  ──────────→ books
                   ←──────  { bookId }  ←──────────

bookDetail          ──────→ expressInterest ──────→ books
onExpressInterest() ←──────  { success }

bookDetail          ──────→ getContact ───────────→ books
getContact()        ←──────  { contact }

bookDetail          ──────→ confirmSold ──────────→ books
onConfirmSold()     ←──────  { success }

bookDetail          ──────→ submitEvaluation ─────→ evaluations
onSubmitEvaluation()←──────  { success }

bookDetail          ──────→ getEvaluations ───────→ evaluations
loadEvaluations()   ←──────  data[]

bookDetail          ──────→ sendMessage ──────────→ messages
onSendMessage()     ←──────  { success }           → books.lastMessageTime

bookDetail          ──────→ getMessages ───────────→ messages
loadMessages()      ←──────  data[]

bookDetail          ──────→ submitReport ─────────→ reports
onSubmitReport()    ←──────  { success }
```
