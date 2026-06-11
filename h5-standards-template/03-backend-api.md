# H5 后端 API 参考

## 版本历史
| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-06-08 | AI | 将原云函数 API 重写为 H5 REST API |

## 1. 通用规范
### 1.1 Base URL
- 开发环境：`http://localhost:3000/api`
- 生产环境：`https://api.example.com/api` 或与前端同域 `/api`

### 1.2 认证方式
推荐使用 HttpOnly Cookie Session：
- 登录成功后服务端设置 `Set-Cookie: sid=...; HttpOnly; Secure; SameSite=Lax; Path=/`。
- 前端请求使用 `credentials: 'include'`。
- 所有写接口校验 session。

如使用 JWT：
- access token 有效期 15 分钟。
- refresh token 放 HttpOnly Cookie。
- 不把长期 token 放 localStorage。

### 1.3 响应结构
成功：
```json
{
  "success": true,
  "data": {},
  "message": "ok"
}
```

失败：
```json
{
  "success": false,
  "error": {
    "code": "BOOK_NOT_FOUND",
    "message": "书籍不存在"
  }
}
```

### 1.4 分页结构
```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 128,
  "hasMore": true
}
```

### 1.5 通用错误码
| HTTP | code | 说明 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | 参数校验失败 |
| 401 | `UNAUTHORIZED` | 未登录或会话过期 |
| 403 | `FORBIDDEN` | 无权限 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `CONFLICT` | 状态冲突、重复操作 |
| 429 | `RATE_LIMITED` | 请求过于频繁 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

## 2. API 总览
| 模块 | 方法 | 路径 | 用途 | 登录 |
|------|------|------|------|------|
| Auth | POST | `/auth/send-code` | 发送登录验证码 | 否 |
| Auth | POST | `/auth/login` | 验证码登录 | 否 |
| Auth | POST | `/auth/logout` | 退出登录 | 是 |
| Auth | GET | `/auth/me` | 获取当前用户 | 可选 |
| Users | PATCH | `/users/me` | 更新个人资料 | 是 |
| Uploads | POST | `/uploads/presign` | 获取图片上传签名 | 是 |
| Config | GET | `/configs/campus` | 获取校区配置 | 否 |
| Books | GET | `/books` | 书城列表 | 否 |
| Books | POST | `/books` | 发布新书 | 是 |
| Books | GET | `/books/:id` | 书籍详情 | 否 |
| Books | PATCH | `/books/:id` | 编辑书籍 | 是，v2 可实现 |
| Books | DELETE | `/books/:id` | 下架书籍 | 是 |
| Books | POST | `/books/:id/express-interest` | 表达想买 | 是 |
| Books | GET | `/books/:id/contact` | 获取联系方式 | 是 |
| Books | POST | `/books/:id/confirm-sold` | 卖家确认售出 | 是 |
| ISBN | GET | `/isbn/:isbn` | 查询 ISBN 信息 | 否/可选登录 |
| Messages | GET | `/books/:id/messages` | 获取留言 | 是 |
| Messages | POST | `/books/:id/messages` | 发送留言 | 是 |
| Evaluations | GET | `/books/:id/evaluations` | 获取评价 | 否 |
| Evaluations | POST | `/books/:id/evaluations` | 提交评价 | 是 |
| Reports | POST | `/reports` | 提交举报 | 是 |
| Admin | GET | `/admin/reports` | 举报列表 | 管理员，v2 |

## 3. 认证 API
### 3.1 发送验证码
`POST /auth/send-code`

请求：
```json
{
  "loginType": "email",
  "identifier": "student@example.edu"
}
```

规则：
- `loginType` 为 `email` 或 `phone`。
- 同一 identifier 60 秒内只能发送一次。
- 同一 IP 每小时限制发送次数。
- 生产环境验证码不得写入日志。

响应：
```json
{
  "success": true,
  "message": "验证码已发送"
}
```

### 3.2 验证码登录
`POST /auth/login`

请求：
```json
{
  "loginType": "email",
  "identifier": "student@example.edu",
  "code": "123456"
}
```

响应：
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "nickname": "拾遗用户A9K2",
      "avatarUrl": null,
      "campus": null,
      "college": null,
      "major": null
    }
  }
}
```

### 3.3 获取当前用户
`GET /auth/me`

未登录时可返回：
```json
{
  "success": true,
  "data": { "user": null }
}
```

已登录时返回用户公开资料。

### 3.4 退出登录
`POST /auth/logout`

响应：
```json
{
  "success": true,
  "message": "已退出登录"
}
```

## 4. 用户 API
### 4.1 更新个人资料
`PATCH /users/me`

请求：
```json
{
  "nickname": "张三",
  "avatarUrl": "https://cdn.example.com/avatars/xxx.webp",
  "campus": "三江校区东园",
  "college": "数理学院",
  "major": "信息与计算科学"
}
```

校验：
- 昵称 2-40 字。
- 头像必须来自本站对象存储或白名单域名。
- 校区/学院/专业必须存在于配置树中，允许为空。

## 5. 上传 API
### 5.1 获取预签名上传 URL
`POST /uploads/presign`

请求：
```json
{
  "fileName": "cover.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 1536000,
  "purpose": "book-image"
}
```

响应：
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://storage.example.com/presigned-url",
    "objectKey": "books/2026/06/uuid.webp",
    "publicUrl": "https://cdn.example.com/books/2026/06/uuid.webp",
    "expiresIn": 300
  }
}
```

规则：
- 仅登录用户可请求。
- 单张最大 5MB，推荐前端压缩到 2MB 内。
- 只允许 image/jpeg、image/png、image/webp。
- objectKey 由服务端生成，不接受前端自定义路径。

## 6. 配置 API
### 6.1 获取校区配置
`GET /configs/campus`

响应：
```json
{
  "success": true,
  "data": {
    "campuses": [
      {
        "name": "三江校区东园",
        "colleges": [
          { "name": "数理学院", "majors": ["信息与计算科学", "应用数学"] }
        ]
      }
    ]
  }
}
```

## 7. 书籍 API
### 7.1 获取书城列表
`GET /books`

Query 参数：
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `mine` | boolean | false | 是否只查我的发布，需登录 |
| `status` | string | available | available/reserved/sold/removed |
| `category` | string | all | 分类 |
| `campus` | string | 空 | 校区 |
| `college` | string | 空 | 学院 |
| `major` | string | 空 | 专业 |
| `sort` | string | latest | latest/price_asc/price_desc/interest_desc |
| `keyword` | string | 空 | 书名/作者/ISBN |
| `page` | number | 1 | 页码 |
| `pageSize` | number | 20 | 每页条数，最大 50 |

响应项示例：
```json
{
  "id": "book_uuid",
  "title": "深入理解计算机系统",
  "author": "Randal E. Bryant",
  "isbn": "9787111544937",
  "category": "textbook",
  "coverImageUrl": "https://cdn.example.com/books/cover.webp",
  "priceCents": 3500,
  "quantity": 1,
  "condition": "like_new",
  "status": "available",
  "campus": "三江校区东园",
  "college": "数理学院",
  "major": "信息与计算科学",
  "interestCount": 2,
  "lastMessageAt": "2026-06-08T10:00:00.000Z",
  "seller": {
    "id": "user_uuid",
    "nickname": "张**",
    "avatarUrl": null
  },
  "createdAt": "2026-06-08T08:00:00.000Z"
}
```

注意：列表响应不得包含完整联系方式或 `contactEncrypted`。

### 7.2 发布新书
`POST /books`

请求：
```json
{
  "title": "深入理解计算机系统",
  "author": "Randal E. Bryant",
  "isbn": "9787111544937",
  "category": "textbook",
  "imageObjectKeys": ["books/2026/06/a.webp"],
  "priceCents": 3500,
  "quantity": 1,
  "condition": "like_new",
  "contact": "wxid_abc123",
  "description": "几乎全新，少量笔记",
  "campus": "三江校区东园",
  "college": "数理学院",
  "major": "信息与计算科学"
}
```

响应：
```json
{
  "success": true,
  "data": { "bookId": "book_uuid" }
}
```

校验：
- 图片 objectKey 必须属于当前用户近期预签名上传记录。
- `contact` 加密后存储，不明文写日志。
- `priceCents` 为非负整数。

### 7.3 获取书籍详情
`GET /books/:id`

响应：
```json
{
  "success": true,
  "data": {
    "id": "book_uuid",
    "title": "深入理解计算机系统",
    "author": "Randal E. Bryant",
    "isbn": "9787111544937",
    "category": "textbook",
    "images": [{ "url": "https://cdn.example.com/books/a.webp", "sortOrder": 0 }],
    "priceCents": 3500,
    "quantity": 1,
    "condition": "like_new",
    "description": "几乎全新",
    "contactHint": "微信号已隐藏",
    "campus": "三江校区东园",
    "college": "数理学院",
    "major": "信息与计算科学",
    "status": "available",
    "interestCount": 2,
    "hasExpressedInterest": false,
    "canViewContact": false,
    "canConfirmSold": false,
    "canEvaluate": false,
    "seller": { "id": "user_uuid", "nickname": "张三", "avatarUrl": null },
    "createdAt": "2026-06-08T08:00:00.000Z"
  }
}
```

注意：即使当前用户可查看联系方式，也建议详情接口只返回 `canViewContact`，完整联系方式仍走单独接口。

### 7.4 表达想买
`POST /books/:id/express-interest`

响应：
```json
{
  "success": true,
  "data": {
    "interestId": "interest_uuid",
    "canViewContact": true,
    "bookStatus": "reserved"
  },
  "message": "已表达想买意向"
}
```

失败示例：
- 自己的书：403 `CANNOT_BUY_OWN_BOOK`
- 重复表达：409 `INTEREST_ALREADY_EXISTS`
- 库存已满：409 `BOOK_RESERVED`

### 7.5 获取联系方式
`GET /books/:id/contact`

响应：
```json
{
  "success": true,
  "data": {
    "contact": "wxid_abc123",
    "contactType": "wechat"
  }
}
```

鉴权：
- 卖家本人可查看。
- 已表达想买的用户可查看。
- 其他用户返回 403。

### 7.6 卖家确认售出
`POST /books/:id/confirm-sold`

请求：
```json
{
  "buyerId": "user_uuid"
}
```

响应：
```json
{
  "success": true,
  "message": "已确认售出"
}
```

### 7.7 下架书籍
`DELETE /books/:id`

响应：
```json
{
  "success": true,
  "message": "已下架"
}
```

规则：
- 仅卖家可下架。
- 已售书籍不可下架，只能保留历史记录。

## 8. ISBN API
### 8.1 查询 ISBN
`GET /isbn/:isbn`

响应：
```json
{
  "success": true,
  "data": {
    "title": "深入理解计算机系统",
    "author": "Randal E. Bryant",
    "publisher": "机械工业出版社",
    "publishDate": "2016",
    "coverUrl": "https://covers.openlibrary.org/...",
    "category": "textbook"
  }
}
```

策略：
- 优先 OpenLibrary。
- 可选 fallback 到 Google Books 或国内 ISBN API。
- 超时 3 秒。
- 第三方 API Key 必须使用环境变量。

## 9. 留言 API
### 9.1 获取留言
`GET /books/:id/messages`

响应：
```json
{
  "success": true,
  "data": [
    {
      "id": "message_uuid",
      "content": "你好，书还在吗？",
      "isMine": true,
      "role": "buyer",
      "createdAt": "2026-06-08T10:00:00.000Z"
    }
  ]
}
```

### 9.2 发送留言
`POST /books/:id/messages`

请求：
```json
{
  "content": "你好，书还在吗？"
}
```

规则：
- 仅卖家或已表达想买的买家可发送。
- 书籍 sold/removed 后不可发送。
- 每本书最多 50 条留言。

## 10. 评价 API
### 10.1 获取评价
`GET /books/:id/evaluations`

响应：
```json
{
  "success": true,
  "data": [
    {
      "id": "eval_uuid",
      "role": "buyer",
      "rating": 5,
      "comment": "书况如实，交易顺利",
      "tags": ["书况如实", "沟通顺畅"],
      "createdAt": "2026-06-08T11:00:00.000Z"
    }
  ]
}
```

### 10.2 提交评价
`POST /books/:id/evaluations`

请求：
```json
{
  "rating": 5,
  "comment": "书况如实，交易顺利",
  "tags": ["书况如实", "沟通顺畅"]
}
```

规则：
- 仅最终买家或卖家可评价。
- 每人每本书只能评价一次。
- 评论最多 200 字。

## 11. 举报 API
### 11.1 提交举报
`POST /reports`

请求：
```json
{
  "targetType": "book",
  "targetId": "book_uuid",
  "reason": "虚假信息",
  "detail": "ISBN 与图片不一致"
}
```

响应：
```json
{
  "success": true,
  "message": "已收到举报"
}
```

规则：
- 同一用户对同一目标只能举报一次。
- 普通用户不能查询举报列表。

## 12. 前端调用约定
推荐封装统一 client：
```ts
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new ApiError(body.error?.code || 'UNKNOWN_ERROR', body.error?.message || '请求失败');
  }
  return body.data;
}
```

## 13. 审计日志建议
以下操作写入 `audit_logs`：
- 登录成功和失败次数异常。
- 发布书籍。
- 查看联系方式。
- 表达想买。
- 确认售出。
- 下架书籍。
- 提交举报。
- 管理员处理举报。

审计日志中不得记录完整联系方式、验证码、token、对象存储密钥。
