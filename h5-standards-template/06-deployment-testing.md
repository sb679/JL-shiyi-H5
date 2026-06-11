# H5 部署与测试指南

## 版本历史
| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| v1.0 | 2026-06-08 | AI | H5 版本开发、部署、测试与上线指南 |

## 1. 开发环境
### 1.1 必要工具
| 工具 | 版本建议 | 用途 |
|------|----------|------|
| Node.js | 20 LTS | 前后端运行环境 |
| npm/pnpm | pnpm 9+ 推荐 | 包管理 |
| PostgreSQL | 15+ | 业务数据库 |
| Redis | 7+ 可选 | 验证码、限流、缓存 |
| Docker Desktop | 最新稳定版 | 本地依赖服务和容器构建 |
| Git | 最新稳定版 | 版本控制 |

### 1.2 推荐本地端口
| 服务 | 端口 |
|------|------|
| H5 前端 Vite | `5173` |
| 后端 API | `3000` |
| PostgreSQL | `5432` |
| Redis | `6379` |
| 对象存储模拟 MinIO，可选 | `9000` / `9001` |

### 1.3 本地启动建议
```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

如果使用 Docker 管理依赖服务：
```bash
docker compose up -d postgres redis minio
pnpm dev
```

## 2. 环境变量
生产环境必须通过平台环境变量、密钥管理服务或 CI Secret 注入，不提交 `.env`。

```env
NODE_ENV=production
APP_ORIGIN=https://example.com
API_ORIGIN=https://api.example.com
DATABASE_URL=postgresql://user:password@db:5432/jl_shiyi
SESSION_SECRET=replace-with-strong-random-secret
JWT_SECRET=replace-with-strong-random-secret
REDIS_URL=redis://redis:6379
OBJECT_STORAGE_ENDPOINT=https://s3.example.com
OBJECT_STORAGE_BUCKET=jl-shiyi
OBJECT_STORAGE_ACCESS_KEY_ID=replace-me
OBJECT_STORAGE_SECRET_ACCESS_KEY=replace-me
OBJECT_STORAGE_PUBLIC_BASE_URL=https://cdn.example.com
CONTACT_ENCRYPTION_KEY=replace-with-32-byte-key
ISBN_API_BASE=https://openlibrary.org
GOOGLE_BOOKS_API_KEY=
EMAIL_PROVIDER_API_KEY=
SMS_PROVIDER_API_KEY=
LOG_LEVEL=info
```

安全要求：
- `SESSION_SECRET`、`JWT_SECRET`、`CONTACT_ENCRYPTION_KEY` 不得使用演示值。
- 不在日志、错误响应、前端构建产物中输出密钥。
- `.env*` 加入 `.gitignore`，只提交 `.env.example`。

## 3. 数据库部署
### 3.1 迁移流程
```bash
pnpm db:migrate
pnpm db:seed
```

`seed` 建议只初始化：
- 校区/学院/专业配置。
- 管理员账号，可通过环境变量指定。
- 本地开发演示数据，生产环境默认不导入演示数据。

### 3.2 必建索引
| 表 | 索引 | 用途 |
|----|------|------|
| `books` | `(status, created_at desc)` | 默认列表 |
| `books` | `(category, status, created_at desc)` | 分类筛选 |
| `books` | `(seller_id, status, created_at desc)` | 我的发布 |
| `books` | `(isbn)` | ISBN 查询/去重 |
| `book_interests` | `unique(book_id, buyer_id)` | 防重复想买 |
| `messages` | `(book_id, created_at asc)` | 留言列表 |
| `evaluations` | `unique(book_id, from_user_id)` | 防重复评价 |
| `reports` | `unique(target_type, target_id, reporter_id)` | 防重复举报 |

### 3.3 备份
- 生产数据库每日自动备份，保留至少 7-30 天。
- 上线前验证一次从备份恢复到临时库。
- 对象存储开启版本控制或定期清单备份。

## 4. 前端部署
### 4.1 构建
```bash
pnpm --filter web build
```

构建产物通常位于 `apps/web/dist`。

### 4.2 静态资源部署
可部署到：
- Nginx 静态站点
- Vercel/Netlify/Cloudflare Pages
- 阿里云 OSS 静态网站 + CDN
- 腾讯云 COS 静态网站 + CDN

SPA 路由必须配置回退：所有未知路径返回 `index.html`，否则直接打开 `/books/:id` 会 404。

Nginx 示例：
```nginx
server {
  listen 443 ssl http2;
  server_name example.com;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://api:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

## 5. 后端部署
### 5.1 构建
```bash
pnpm --filter api build
pnpm --filter api start:prod
```

### 5.2 Docker 部署建议
Dockerfile 要点：
- 多阶段构建。
- 生产镜像只包含运行所需文件。
- 非 root 用户运行。
- 健康检查 `/api/health`。
- 日志输出到 stdout/stderr。

### 5.3 健康检查
`GET /api/health`

响应：
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "ok",
    "storage": "ok"
  }
}
```

## 6. HTTPS、域名与备案
H5 生产环境必须：
- 使用 HTTPS。
- Cookie 设置 Secure。
- 配置 HSTS，确认无兼容问题后开启长期 max-age。
- 国内服务器和域名按实际要求完成备案。
- 隐私政策、用户协议、联系方式在页面可访问。

## 7. 测试策略
### 7.1 单元测试
覆盖：
- 表单校验。
- 价格格式化。
- ISBN 格式校验。
- 联系方式脱敏。
- 权限判断函数。

### 7.2 后端集成测试
重点覆盖：
- 登录验证码发送与校验。
- 发布书籍字段校验。
- 表达想买事务和唯一约束。
- 卖家确认售出权限。
- 联系方式鉴权。
- 留言权限。
- 评价防重复。
- 举报防重复。

### 7.3 前端 E2E 测试
推荐 Playwright。

核心链路：
1. 用户 A 登录并发布书籍。
2. 用户 B 登录，搜索并打开书籍详情。
3. 用户 B 点击我想买并查看联系方式。
4. 用户 B 留言。
5. 用户 A 确认售出给用户 B。
6. 双方分别评价。
7. 用户 C 尝试查看联系方式失败。

### 7.4 移动端兼容测试
至少覆盖：
| 环境 | 重点 |
|------|------|
| iOS Safari | 图片上传、键盘遮挡、摄像头权限 |
| Android Chrome | 图片压缩、扫码、滚动加载 |
| 微信内置浏览器 | 分享、Cookie、返回行为 |
| 桌面 Chrome/Edge | 响应式布局、键盘操作 |

### 7.5 安全测试清单
- [ ] 列表接口不返回联系方式。
- [ ] 详情初始接口不返回联系方式。
- [ ] 未想买用户请求 `/contact` 返回 403。
- [ ] 非卖家确认售出返回 403。
- [ ] 重复想买返回 409。
- [ ] 重复评价返回 409。
- [ ] 上传非图片文件被拒绝。
- [ ] 超大图片被拒绝。
- [ ] XSS 输入不会执行脚本。
- [ ] CSRF 防护有效。
- [ ] 日志中无验证码、token、联系方式、密钥。

## 8. 手工验收清单
| 编号 | 场景 | 预期 |
|------|------|------|
| T1 | 游客打开书城 | 可浏览在售书籍 |
| T2 | 游客点击发布 | 跳转登录，登录后回到发布页 |
| T3 | 验证码登录 | 成功创建或读取用户 |
| T4 | 发布手动书籍 | 校验通过后创建书籍 |
| T5 | ISBN 自动补全 | 成功填充或失败可手动录入 |
| T6 | 图片上传 | 压缩、上传、预览正常 |
| T7 | 搜索筛选排序 | 查询结果正确，分页正常 |
| T8 | 想买 | 买家获得查看联系方式权限 |
| T9 | 联系方式保护 | 未授权用户看不到联系方式 |
| T10 | 留言 | 交易双方可留言，其他人不可见 |
| T11 | 确认售出 | 卖家选择买家后状态变 sold |
| T12 | 评价 | 买卖双方各评价一次 |
| T13 | 举报 | 同一目标不可重复举报 |
| T14 | 下架 | 卖家可下架在售书籍 |
| T15 | 移动端布局 | 360px 宽度无遮挡和溢出 |

## 9. 上线前检查
- [ ] 域名、HTTPS、备案完成。
- [ ] 环境变量已配置且无演示密钥。
- [ ] 数据库迁移已执行。
- [ ] 校区配置已初始化。
- [ ] 对象存储 bucket、CORS、CDN 已配置。
- [ ] 邮件或短信服务已配置并限流。
- [ ] 用户协议和隐私政策可访问。
- [ ] 日志脱敏生效。
- [ ] 数据库备份开启。
- [ ] 核心 E2E 测试通过。

## 10. 常见问题排查
### 10.1 登录后仍显示未登录
检查：
- Cookie 是否被浏览器拦截。
- 前端请求是否带 `credentials: 'include'`。
- API 与前端是否跨站，SameSite 设置是否合适。
- HTTPS 下 Cookie 是否设置 Secure。

### 10.2 图片上传失败
检查：
- 对象存储 CORS 是否允许 PUT。
- 预签名 URL 是否过期。
- content-type 是否与签名一致。
- 文件大小是否超过限制。

### 10.3 直接打开详情页 404
检查静态站点是否配置 SPA fallback 到 `index.html`。

### 10.4 联系方式异常暴露
立即检查：
- `GET /books` 和 `GET /books/:id` 响应字段。
- 前端错误日志平台是否采集完整响应。
- 服务端日志是否打印请求体或数据库实体。

## 11. 监控指标
- API 错误率。
- P95 响应时间。
- 登录验证码发送成功率。
- 图片上传失败率。
- 每日发布数、想买数、售出数。
- 举报数量和处理时长。
- 数据库连接池使用率。
- 对象存储流量和费用。
