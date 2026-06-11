# H5 页面架构与数据流

## 版本历史
| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-06-08 | AI | H5 页面、组件、状态和数据流设计 |

## 1. 页面总览
| 页面 | 路由 | 访问权限 | 用途 |
|------|------|----------|------|
| 书城首页 | `/` 或 `/books` | 公开 | 浏览、搜索、筛选在售书籍 |
| 登录页 | `/login` | 公开 | 验证码登录 |
| 发布新书 | `/publish` | 登录 | ISBN/手动录入并发布书籍 |
| 书籍详情 | `/books/:id` | 公开，部分操作需登录 | 查看详情、想买、留言、售出、评价、举报 |
| 我的发布 | `/me/books` | 登录 | 管理自己的在售、已售、下架书籍 |
| 个人资料 | `/me/profile` | 登录 | 修改昵称、头像、校区、学院、专业 |
| 用户协议 | `/terms` | 公开 | 平台规则与交易边界 |
| 隐私政策 | `/privacy` | 公开 | 个人信息使用说明 |
| 管理后台 | `/admin` | 管理员，v2 | 举报与内容管理 |

## 2. 移动端导航结构
H5 不使用小程序 TabBar。推荐使用移动端底部导航加顶部搜索：

| 导航项 | 路由 | 图标 | 说明 |
|--------|------|------|------|
| 书城 | `/books` | 书本/搜索 | 默认首页 |
| 发布 | `/publish` | 加号 | 登录后发布 |
| 我的 | `/me/books` | 用户 | 我的发布与资料 |

桌面端可改为顶部导航栏，主内容最大宽度建议 1120px，列表区域自适应栅格。

## 3. 前端应用结构
```text
src/
├── app/
│   ├── router.tsx              # 路由定义
│   ├── App.tsx                 # 全局布局
│   └── providers.tsx           # QueryClient、AuthProvider、ThemeProvider
├── pages/
│   ├── BookMallPage.tsx
│   ├── BookDetailPage.tsx
│   ├── PublishPage.tsx
│   ├── MyBooksPage.tsx
│   ├── ProfilePage.tsx
│   ├── LoginPage.tsx
│   ├── TermsPage.tsx
│   └── PrivacyPage.tsx
├── features/
│   ├── auth/
│   ├── books/
│   ├── uploads/
│   ├── messages/
│   ├── evaluations/
│   └── reports/
├── components/
│   ├── layout/
│   ├── BookCard.tsx
│   ├── SearchBar.tsx
│   ├── FilterSheet.tsx
│   ├── PriceText.tsx
│   ├── ImageUploader.tsx
│   ├── RatingInput.tsx
│   ├── EmptyState.tsx
│   └── ConfirmDialog.tsx
├── api/
│   ├── client.ts
│   ├── auth.ts
│   ├── books.ts
│   ├── uploads.ts
│   └── configs.ts
├── utils/
│   ├── format.ts
│   ├── validators.ts
│   └── image.ts
└── styles/
    └── globals.css
```

## 4. 全局状态
### 4.1 AuthProvider
维护：
```ts
type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshMe: () => Promise<void>;
};
```

启动流程：
```text
App mount
  → GET /auth/me
  → user 存入 AuthProvider
  → 渲染路由
```

### 4.2 TanStack Query
推荐 Query Key：
- `['me']`
- `['campus-config']`
- `['books', filters]`
- `['book', bookId]`
- `['book-contact', bookId]`
- `['messages', bookId]`
- `['evaluations', bookId]`
- `['my-books', status]`

写操作成功后按需 invalidate 对应 query。

## 5. 页面详细设计
### 5.1 书城首页 `/books`
#### 数据依赖
- `GET /configs/campus`
- `GET /books?status=available&...`
- `GET /auth/me` 可选，用于登录态展示

#### 页面状态
```ts
type BookMallState = {
  keyword: string;
  category: 'all' | 'textbook' | 'novel' | 'reference' | 'other';
  campus?: string;
  college?: string;
  major?: string;
  sort: 'latest' | 'price_asc' | 'price_desc' | 'interest_desc';
  page: number;
};
```

#### UI 结构
```text
顶部区域
  搜索框
  筛选按钮
  发布入口

筛选区域
  分类横向标签
  校区/学院/专业筛选
  排序菜单

内容区域
  书籍卡片列表
  加载更多
  空状态

底部导航
  书城 / 发布 / 我的
```

#### 交互规则
- 搜索输入 300ms 防抖。
- 修改任一筛选项重置 page=1。
- 移动端筛选可用底部抽屉，桌面端可展开在列表上方。
- 列表卡片点击进入详情。
- 游客点击发布，跳转登录并带 `redirect=/publish`。

### 5.2 登录页 `/login`
#### 数据依赖
- `POST /auth/send-code`
- `POST /auth/login`

#### UI 结构
```text
Logo/项目名
登录方式切换：邮箱 / 手机号
账号输入框
验证码输入框 + 获取验证码按钮
登录按钮
用户协议与隐私政策确认
```

#### 交互规则
- 获取验证码前必须勾选协议。
- 发送验证码后按钮倒计时 60 秒。
- 登录成功后回到 redirect 路径或书城。
- 验证码错误显示具体提示，不清空账号输入。

### 5.3 发布新书 `/publish`
#### 数据依赖
- `GET /configs/campus`
- `GET /isbn/:isbn`
- `POST /uploads/presign`
- `POST /books`

#### 页面状态
```ts
type PublishForm = {
  mode: 'isbn' | 'manual';
  title: string;
  author: string;
  isbn?: string;
  category: BookCategory;
  priceYuan: string;
  quantity: number;
  condition: BookCondition;
  contact: string;
  description?: string;
  campus?: string;
  college?: string;
  major?: string;
  images: UploadedImage[];
};
```

#### UI 结构
```text
录入方式分段控件
ISBN 输入 + 查询 + 扫描按钮
基础信息表单
校区/学院/专业选择
价格、数量、新旧程度
联系方式 + 隐私提示
描述文本域
图片上传网格
底部固定发布按钮
```

#### H5 扫码策略
- 支持的浏览器优先使用 `BarcodeDetector`。
- 不支持时显示上传图片识别或手动输入入口。
- 扫码失败不阻塞发布流程。

#### 图片上传流程
```text
选择图片
  → 前端压缩/裁剪预览
  → POST /uploads/presign
  → PUT uploadUrl 直传对象存储
  → 保存 objectKey/publicUrl
  → POST /books 时提交 objectKey 列表
```

### 5.4 书籍详情 `/books/:id`
#### 数据依赖
- `GET /books/:id`
- `POST /books/:id/express-interest`
- `GET /books/:id/contact`
- `POST /books/:id/confirm-sold`
- `GET /books/:id/messages`
- `POST /books/:id/messages`
- `GET /books/:id/evaluations`
- `POST /books/:id/evaluations`
- `POST /reports`

#### 角色判断
后端详情接口返回：
```ts
type BookPermissions = {
  hasExpressedInterest: boolean;
  canViewContact: boolean;
  canConfirmSold: boolean;
  canEvaluate: boolean;
  canSendMessage: boolean;
  isOwner: boolean;
};
```

#### UI 结构
```text
图片轮播
书名、作者、ISBN、分类
价格、新旧程度、校区
卖家信息
描述
联系方式区域（默认隐藏）
想买用户列表（仅卖家可见）
留言板（卖家/已想买买家可见）
评价列表
举报入口
底部操作栏
```

#### 底部操作栏状态机
```text
游客 → 登录后想买
自己发布 + available/reserved + 有想买用户 → 确认售出
自己发布 + 无想买用户 → 等待买家
非卖家 + 未想买 + available → 我想买
非卖家 + 已想买 → 查看联系方式 / 留言
sold → 已售罄 / 评价入口
removed → 已下架
```

### 5.5 我的发布 `/me/books`
#### 数据依赖
- `GET /books?mine=true&status=available`
- `GET /books?mine=true&status=sold`
- `GET /books?mine=true&status=removed`
- `DELETE /books/:id`

#### UI 结构
```text
用户资料摘要
发布按钮
状态标签：在售 / 已售 / 已下架
书籍列表
每张卡片：想买人数、留言提示、状态、操作按钮
```

#### 交互规则
- 切换标签刷新对应列表。
- 下架按钮只在 available/reserved 展示。
- 下架需二次确认。
- 已售书籍展示买家脱敏昵称、成交时间、评价状态。

### 5.6 个人资料 `/me/profile`
#### 数据依赖
- `GET /auth/me`
- `POST /uploads/presign`
- `PATCH /users/me`

#### 功能
- 修改昵称。
- 上传头像。
- 选择校区、学院、专业。
- 查看账号绑定方式。

## 6. 组件规范
### 6.1 `BookCard`
Props：
```ts
type BookCardProps = {
  book: BookListItem;
  variant?: 'mall' | 'mine';
  onClick?: () => void;
  onRemove?: () => void;
};
```

显示规则：
- 价格使用 `PriceText` 统一格式化。
- 状态标签颜色：available 绿色，reserved 橙色，sold 灰色，removed 灰色。
- 长标题最多两行，超出省略。

### 6.2 `FilterSheet`
- 移动端底部抽屉。
- 桌面端可复用为弹出菜单。
- 应支持重置和确认按钮。

### 6.3 `ImageUploader`
- 最大 5 张。
- 支持拖拽排序可作为 v2。
- 上传失败支持单张重试。

### 6.4 `RatingInput`
- 1-5 星。
- 支持键盘操作。
- 选中状态明确。

## 7. 数据保护策略
| 位置 | 策略 |
|------|------|
| 书城列表 | 不返回联系方式 |
| 详情初始响应 | 不返回联系方式明文 |
| 联系方式按钮 | 单独请求 `/contact`，鉴权后返回 |
| 前端日志 | 不打印接口完整响应中的敏感字段 |
| 浏览器缓存 | 不把联系方式写入 localStorage/sessionStorage |
| SSR/HTML | 不把联系方式写入初始 HTML |

## 8. SEO 与分享
- 公开详情页可设置 `<title>` 为 `【¥35】书名 - JL拾遗`。
- Open Graph 图片使用封面图。
- 详情页公开元信息不含联系方式。
- 若使用 SPA，仍应保证直接打开 `/books/:id` 能正常渲染。

## 9. 可访问性
- 表单输入都应有 label。
- 图标按钮应有 aria-label。
- 弹窗打开后焦点进入弹窗，关闭后回到触发元素。
- 颜色不能作为唯一状态提示。
- 移动端点击目标建议不小于 44px。
