# 安全与隐私配置

本项目会上传到 GitHub，因此任何真实密钥、密码、服务器凭据都不能写入源码、README、提交记录或前端环境变量。

## 不提交的文件

这些文件已由 `.gitignore` 忽略：

```text
.env
.env.*
*.local
node_modules/
dist/
*.log
```

`.env.example` 可以提交，但只能写演示值或占位符。

## 本地或 ECS 运行时变量

在本地开发或 ECS 部署时，真实值只放在服务器本地 `.env` 或系统环境变量里：

```env
PORT=8080
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket-name
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_PUBLIC_BASE_URL=https://your-bucket-name.oss-cn-hangzhou.aliyuncs.com
UPLOAD_MAX_FILE_SIZE=8388608
UPLOAD_MAX_FILES=30
MYSQL_HOST=rm-bp15742960i2w1hh8.mysql.rds.aliyuncs.com
MYSQL_PORT=3306
MYSQL_DATABASE=jl_shiyi_app
MYSQL_USER=jl_shiyi_app
MYSQL_PASSWORD=demo-change-me
DEPLOY_WEBHOOK_PORT=9000
DEPLOY_WEBHOOK_SECRET=your-webhook-secret
```

GitHub Actions 的 webhook 密钥须在仓库 Settings → Secrets and variables → Actions 中配置 `DEPLOY_WEBHOOK_SECRET` 和 `ECS_HOST`，不要写在 `.env.example` 或源代码中。

- **为什么 webhook 密钥需要保密**：拥有密钥即可向 ECS 发送部署请求（触发 git pull + 构建 + 重启），泄露等于开放未经授权的远端执行权限。
- **为什么 ECS_HOST 也需要保密**：暴露 ECS 公网 IP 会增加扫描和攻击面，应保持在 Secrets 中。

前端只能使用非敏感配置：

```env
VITE_GOOGLE_BOOKS_API_KEY=demo-google-books-api-key
VITE_UPLOAD_ENDPOINT=/api/uploads/images
```

注意：所有 `VITE_` 开头的变量都会被打包进浏览器代码，不能放 OSS Secret、ECS 密码、数据库密码等敏感值。

## OSS AccessKey 建议

- 使用 RAM 子账号，不要使用阿里云主账号 AccessKey。
- 只授予当前 Bucket 所需的最小权限。
- 如果密钥曾经通过聊天、截图、邮件等方式暴露，建议立即禁用并重新生成。
- 后端只在服务器环境变量中读取密钥，通过 `/api/uploads/images` 上传图片。

## ECS 登录信息建议

- 不要把 ECS 密码写入仓库或脚本。
- 部署时如果终端提示输入密码，请直接在终端输入，不要粘贴到代码或文档里。
- 上线后建议改用 SSH Key 登录，并关闭密码登录。

## 提交前检查

提交前建议运行：

```bash
git status --short
git diff --check
git grep -n -I -E "AccessKey|AccessKeySecret|password|secret|BEGIN .*PRIVATE KEY|OSS_ACCESS_KEY_SECRET|DEPLOY_WEBHOOK_SECRET|ECS_HOST"
npm run build
npm run lint
```

如果检查输出里出现真实密钥或密码，先删除并确认提交历史没有包含它。
