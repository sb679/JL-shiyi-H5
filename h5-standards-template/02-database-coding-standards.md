# 数据库设计与编码规范

## 版本历史
| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-06-08 | AI | H5 版本数据库与编码规范 |

## 1. 数据库选型
推荐使用 PostgreSQL 15+。理由：
- 支持事务、唯一约束、行级锁，适合“想买人数不能超过库存”等并发场景。
- 支持 JSONB，方便存储少量扩展字段。
- 支持全文检索、ILIKE、pg_trgm 扩展，MVP 阶段足够支撑书籍搜索。
- 迁移工具成熟，可用 Prisma、Drizzle 或 Knex 管理 schema。

MVP 不建议把核心业务数据放在浏览器本地存储、纯对象存储或无权限边界的公共表格中。

## 2. 设计原则
- 所有写操作必须经过后端 API，不允许前端直接连数据库。
- 用户 ID 使用内部生成的 UUID，不暴露数据库自增 ID。
- 联系方式拆分存储或加密存储，不进入公开查询模型。
- 所有表包含 `created_at`，可变业务表包含 `updated_at`。
- 删除优先软删除，保留交易和举报审计记录。
- 枚举字段使用受控字符串或数据库 enum。
- 复杂写操作使用事务，例如表达想买、确认售出、下架。

## 3. 核心实体总览
| 表名 | 用途 |
|------|------|
| `users` | 用户账号与公开资料 |
| `user_private_profiles` | 用户私密资料，可选，用于拆分敏感字段 |
| `books` | 二手书主体信息 |
| `book_images` | 书籍图片 |
| `book_interests` | 想买记录 |
| `messages` | 交易留言 |
| `evaluations` | 双向评价 |
| `reports` | 举报记录 |
| `campus_configs` | 校区/学院/专业配置 |
| `audit_logs` | 关键操作审计日志 |
| `sessions` | Cookie Session 模式下的登录会话，可选 |

## 4. 字段设计
### 4.1 `users`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | 是 | 主键 |
| `login_identifier` | varchar(128) | 是 | 手机号或邮箱，唯一，建议加密或哈希后辅助索引 |
| `login_type` | varchar(16) | 是 | phone/email |
| `nickname` | varchar(40) | 是 | 展示昵称 |
| `avatar_url` | text | 否 | 头像 URL |
| `campus` | varchar(80) | 否 | 校区 |
| `college` | varchar(80) | 否 | 学院 |
| `major` | varchar(80) | 否 | 专业 |
| `role` | varchar(20) | 是 | user/admin |
| `status` | varchar(20) | 是 | active/banned/deleted |
| `created_at` | timestamptz | 是 | 创建时间 |
| `updated_at` | timestamptz | 是 | 更新时间 |

索引：
- `unique(login_type, login_identifier)`
- `index(status)`

### 4.2 `books`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | 是 | 主键 |
| `seller_id` | uuid | 是 | 发布者，关联 users.id |
| `title` | varchar(120) | 是 | 书名 |
| `author` | varchar(120) | 是 | 作者，未知可填“未知” |
| `isbn` | varchar(20) | 否 | ISBN10/ISBN13 |
| `category` | varchar(20) | 是 | textbook/novel/reference/other |
| `price_cents` | integer | 是 | 价格，单位分，避免浮点误差 |
| `quantity` | integer | 是 | 库存，默认 1 |
| `condition` | varchar(20) | 是 | new/like_new/annotated/worn |
| `description` | text | 否 | 描述，最多 500 字 |
| `contact_encrypted` | text | 是 | 加密联系方式 |
| `contact_hint` | varchar(40) | 否 | 脱敏提示，如 wechat 或 phone 尾号 |
| `campus` | varchar(80) | 否 | 校区 |
| `college` | varchar(80) | 否 | 学院 |
| `major` | varchar(80) | 否 | 专业 |
| `status` | varchar(20) | 是 | available/reserved/sold/removed |
| `buyer_id` | uuid | 否 | 最终买家 |
| `sold_at` | timestamptz | 否 | 售出时间 |
| `last_message_at` | timestamptz | 否 | 最后留言时间 |
| `created_at` | timestamptz | 是 | 发布时间 |
| `updated_at` | timestamptz | 是 | 更新时间 |
| `removed_at` | timestamptz | 否 | 下架时间 |

约束：
- `price_cents >= 0`
- `quantity >= 1`
- `status in ('available','reserved','sold','removed')`
- `buyer_id is not null` only when `status='sold'`

索引：
- `index(status, created_at desc)`
- `index(category, status, created_at desc)`
- `index(seller_id, status, created_at desc)`
- `index(isbn)`
- 可选：`gin(to_tsvector('simple', title || ' ' || author || ' ' || coalesce(isbn,'')))`
- 可选：启用 `pg_trgm` 后对 `title`、`author` 建 trigram 索引

### 4.3 `book_images`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | 是 | 主键 |
| `book_id` | uuid | 是 | 关联 books.id |
| `url` | text | 是 | 图片访问 URL |
| `object_key` | text | 是 | 对象存储 key |
| `sort_order` | integer | 是 | 展示顺序，0 为封面 |
| `width` | integer | 否 | 宽度 |
| `height` | integer | 否 | 高度 |
| `size_bytes` | integer | 否 | 文件大小 |
| `created_at` | timestamptz | 是 | 上传时间 |

约束：
- 同一 `book_id` 最多 5 张，业务层校验。
- `unique(book_id, sort_order)`。

### 4.4 `book_interests`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | 是 | 主键 |
| `book_id` | uuid | 是 | 书籍 ID |
| `buyer_id` | uuid | 是 | 表达想买的用户 |
| `status` | varchar(20) | 是 | active/cancelled/chosen |
| `created_at` | timestamptz | 是 | 创建时间 |

约束：
- `unique(book_id, buyer_id)` 防止重复表达想买。
- 不能对自己的书表达想买，业务层和事务中校验。

索引：
- `index(book_id, created_at)`
- `index(buyer_id, created_at desc)`

### 4.5 `messages`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | 是 | 主键 |
| `book_id` | uuid | 是 | 书籍 ID |
| `from_user_id` | uuid | 是 | 发送者 |
| `to_user_id` | uuid | 否 | 接收者，MVP 可为空表示书籍会话 |
| `content` | varchar(500) | 是 | 留言内容 |
| `created_at` | timestamptz | 是 | 发送时间 |
| `deleted_at` | timestamptz | 否 | 管理删除时间 |

索引：
- `index(book_id, created_at asc)`
- `index(from_user_id, created_at desc)`

### 4.6 `evaluations`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | 是 | 主键 |
| `book_id` | uuid | 是 | 书籍 ID |
| `from_user_id` | uuid | 是 | 评价者 |
| `to_user_id` | uuid | 是 | 被评价者 |
| `from_role` | varchar(20) | 是 | buyer/seller |
| `rating` | integer | 是 | 1-5 |
| `comment` | varchar(200) | 否 | 评论 |
| `tags` | jsonb | 否 | 标签数组 |
| `created_at` | timestamptz | 是 | 创建时间 |

约束：
- `unique(book_id, from_user_id)` 防重复评价。
- `rating between 1 and 5`。

索引：
- `index(book_id, created_at desc)`
- `index(to_user_id, created_at desc)`

### 4.7 `reports`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | 是 | 主键 |
| `target_type` | varchar(20) | 是 | book/user |
| `target_id` | uuid | 是 | 举报目标 |
| `reporter_id` | uuid | 是 | 举报者 |
| `reason` | varchar(40) | 是 | 举报原因 |
| `detail` | varchar(200) | 否 | 补充说明 |
| `status` | varchar(20) | 是 | pending/reviewing/resolved/rejected |
| `created_at` | timestamptz | 是 | 创建时间 |
| `handled_at` | timestamptz | 否 | 处理时间 |
| `handler_id` | uuid | 否 | 管理员 |

约束：
- `unique(target_type, target_id, reporter_id)`。

索引：
- `index(status, created_at desc)`
- `index(target_type, target_id)`

### 4.8 `campus_configs`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | 是 | 主键 |
| `version` | integer | 是 | 配置版本 |
| `data` | jsonb | 是 | 校区/学院/专业树 |
| `is_active` | boolean | 是 | 是否当前生效 |
| `created_at` | timestamptz | 是 | 创建时间 |
| `updated_at` | timestamptz | 是 | 更新时间 |

## 5. 关键事务
### 5.1 表达想买
事务步骤：
1. `select * from books where id = ? for update`。
2. 校验书籍存在、状态可购买、调用者不是卖家。
3. 查询当前 active interest 数量。
4. 若数量已达到 `quantity`，返回库存已满。
5. 插入 `book_interests`，依赖唯一约束防重复。
6. 若插入后数量达到库存，更新 `books.status='reserved'`。
7. 写入 `audit_logs`。

### 5.2 确认售出
事务步骤：
1. 锁定书籍行。
2. 校验调用者是 `seller_id`。
3. 校验状态为 available/reserved。
4. 校验 `buyer_id` 在 active interest 中。
5. 更新书籍 `status='sold'`、`buyer_id`、`sold_at`。
6. 更新对应 interest 为 `chosen`。
7. 写审计日志。

### 5.3 下架书籍
事务步骤：
1. 锁定书籍行。
2. 校验调用者是卖家。
3. 校验状态不是 sold。
4. 更新 `status='removed'`、`removed_at`。
5. 写审计日志。

## 6. 编码规范
### 6.1 目录结构建议
```text
jl-shiyi-h5/
├── apps/
│   ├── web/                    # H5 前端
│   │   ├── src/
│   │   │   ├── app/            # 路由、全局布局
│   │   │   ├── pages/          # 页面
│   │   │   ├── components/     # 可复用组件
│   │   │   ├── features/       # book/auth/message 等业务模块
│   │   │   ├── api/            # API client
│   │   │   ├── hooks/          # React hooks
│   │   │   ├── utils/          # 工具函数
│   │   │   └── styles/         # 全局样式
│   │   └── package.json
│   └── api/                    # 后端 API
│       ├── src/
│       │   ├── modules/        # auth/users/books/messages/evaluations/reports
│       │   ├── common/         # guards/errors/logger/validators
│       │   ├── config/         # env config
│       │   └── main.ts
│       └── package.json
├── packages/
│   └── shared/                 # 共享类型、枚举、校验 schema
├── prisma/                     # 数据库 schema 与 migrations
├── docs/
├── docker-compose.yml
└── README.md
```

### 6.2 TypeScript
- 开启 `strict`。
- 禁止 `any` 作为常规类型，必要时用 `unknown` 并显式收窄。
- 共享 DTO 放在 shared 包或由 OpenAPI 生成。
- 枚举值集中定义，前后端复用。

### 6.3 前端代码
- API 请求统一封装，统一处理 401、403、网络错误和重试。
- 表单使用 schema 校验，例如 Zod。
- 服务端状态使用 TanStack Query，不手写多份 loading/error 状态。
- 图片上传先请求预签名，再直传对象存储，最后提交 object key。
- 不在 localStorage 存储长期有效 token；如必须存储，使用短期 token 并做好 XSS 防护。

### 6.4 后端代码
- Controller 只做参数解析和响应，业务逻辑放 Service。
- 所有输入使用 DTO/schema 校验。
- 业务错误使用明确错误码，不直接返回数据库错误。
- 日志必须脱敏手机号、邮箱、联系方式、验证码和 token。
- 写接口必须校验当前用户权限。
- 文件上传签名接口必须绑定 userId、contentType、size、过期时间。

### 6.5 命名规范
| 类型 | 规范 | 示例 |
|------|------|------|
| 数据库字段 | snake_case | `created_at`, `seller_id` |
| TypeScript 变量 | camelCase | `bookList`, `sellerId` |
| React 组件 | PascalCase | `BookCard`, `PublishPage` |
| API 路径 | kebab-case/资源名 | `/api/books/:id/express-interest` |
| 环境变量 | UPPER_SNAKE_CASE | `DATABASE_URL` |

## 7. 环境变量规范
生产环境不得硬编码任何密钥。建议 `.env.example`：

```env
NODE_ENV=development
APP_ORIGIN=http://localhost:5173
API_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/jl_shiyi
SESSION_SECRET=demo-change-me
JWT_SECRET=demo-change-me
REDIS_URL=redis://localhost:6379
OBJECT_STORAGE_ENDPOINT=https://s3.example.com
OBJECT_STORAGE_BUCKET=jl-shiyi-demo
OBJECT_STORAGE_ACCESS_KEY_ID=demo-key
OBJECT_STORAGE_SECRET_ACCESS_KEY=demo-secret
ISBN_API_BASE=https://openlibrary.org
EMAIL_PROVIDER_API_KEY=demo-email-key
SMS_PROVIDER_API_KEY=demo-sms-key
LOG_LEVEL=info
```

## 8. 安全与隐私落点
- `contact_encrypted` 使用服务端密钥加密，密钥来自环境变量或 KMS。
- 返回列表和详情时只返回 `contact_hint`，不返回密文或明文。
- `GET /books/:id/contact` 单独鉴权并记录审计日志。
- 验证码接口限流：同一 IP、同一账号标识均限流。
- 所有 POST/PUT/PATCH/DELETE 接口需要 CSRF 防护或 Bearer token 策略。
- 上传图片必须使用随机 object key，例如 `books/2026/06/{uuid}.webp`。

## 9. 搜索策略
MVP：
- 标题、作者、ISBN 使用 `ILIKE` 或 trigram。
- 必须配合 `status`、`category` 等条件分页。
- 限制关键词长度 1-50 字。

数据量超过 5 万本后：
- 引入 Meilisearch、Typesense 或 Elasticsearch。
- 保留数据库作为事实源，搜索索引异步同步。

## 10. 数据备份
- 每日自动备份数据库。
- 对象存储开启生命周期和防误删策略。
- 生产备份恢复流程至少每季度演练一次。
