# JL拾遗 H5

> 🔗 **在线访问地址：http://47.99.71.207:8080/**

JL拾遗 H5 是基于 React + Vite 的校园二手书 H5 单页应用，对应的产品和接口文档在 `../h5-standards-template`。

当前版本优先通过同源后端 API 保存到 MySQL/RDS；本地只启动 Vite、没有后端或数据库不可用时，会退回 mock 数据方便界面开发。

项目推进过程中的部署排错、RDS/OSS/ECS/GitHub 经验和复盘记录见 [docs/project-retrospective.md](docs/project-retrospective.md)。

## 技术栈

- React 18
- TypeScript
- Vite 5
- React Router
- TanStack Query
- lucide-react
- Express 5
- MySQL/RDS via mysql2

## 本地运行

```bash
npm install
npm start
npm run dev
```

本地开发时，`npm run dev` 只启动 Vite 页面；图片上传和数据库接口由 `npm start` 的 Node 服务提供。Vite 已把 `/api` 代理到 `http://127.0.0.1:8080`，所以两边都启动后，本地页面可以直接请求同源 `/api/...`。

如需启用 Google Books ISBN 查询，先创建本地环境变量文件：

```bash
cp .env.example .env.local
```

然后把 `.env.local` 里的 `VITE_GOOGLE_BOOKS_API_KEY` 改成真实 key。不要把 `.env.local` 提交到 Git。

修改 `.env.local` 后必须停止并重新运行 `npm run dev`，Vite 不会在运行中自动重新读取新的环境变量。

Vite 默认访问地址通常是：

```text
http://localhost:5173/
```

## 验证命令

```bash
npm run build
npm run lint
npm run test
```

上线或接入后端前，建议保证以上三个命令都通过。`npm run test` 会运行 vitest，验证前端 mock 数据格式、类型守卫逻辑等（详见 `src/__tests__/` 下的 `data-format.test.ts` 和 `validators.test.ts`，共 56 个测试）。

## ISBN 查询排查

如果页面提示"尚未读取到 Google Books API Key"，按顺序检查：

1. `.env.local` 是否在 `jl-shiyi-h5` 项目根目录。
2. 变量名是否完全是 `VITE_GOOGLE_BOOKS_API_KEY`。
3. 保存 `.env.local` 后是否重启过 `npm run dev`。
4. 是否从正确目录启动：`D:\xunlei\litterxunlei\JL拾遗\standards-template\jl-shiyi-h5`。

Google Books API Key 属于前端可见配置，上线后建议在 Google Cloud 控制台限制 HTTP Referrer，只允许自己的域名使用。

## 当前已实现

- 书城列表：搜索、分类筛选、校区/学院/专业叠加筛选、排序、响应式卡片、按销售状态筛选（全部状态 / 在售 / 已预定 / 已售出）
- 书籍详情：联系方式隐私门槛、想买、留言、举报、关键操作时间戳展示（买家想买时间、卖家同意成交时间）
- 发布书籍：Google Books ISBN 查询、图片 URL、本地多图选择与预览；除数量外，其余内容均可为空；不强制默认图片
- 库存与购买数量：发布时指定库存数量，买家选择购买数量，剩余库存实时展示，全部成交后自动标记售罄
- 用户头像上传与展示：后台上传图片到 OSS，支持本地预览回退，导航栏、书籍卡片、买家列表等多处展示
- 管理员账号设计与功能：使用 `admin` 账号登录获得管理员角色，可查看全站书籍、待处理举报、全部举报记录，支持强制下架和举报处理
- 我的书籍：状态切换、下架操作
- 个人资料编辑
- 自定义账号演示登录，账号由中文、英文、数字组成且不超过 60 个字符，用户资料保存到后端
- 发布、想买、留言、成交确认、评价、举报保存到 MySQL/RDS
- 数据格式单元测试（vitest，56 个测试覆盖 AppData 形状验证与各字段格式约束）

## 安全配置

真实 OSS AccessKey、ECS 密码、数据库密码、webhook 密钥等隐私信息不能写入源码或提交到 GitHub。配置规则见 [SECURITY.md](SECURITY.md)。

## 图片上传说明

"选择本地图片"支持一次选择多张，前端不设置照片数量上限。生产环境会通过后端接口 `POST /api/uploads/images` 上传到阿里云 OSS，并把 OSS 返回的图片 URL 放入书籍图片列表。

本地开发时，如果只启动 `npm run dev` 而没有启动后端服务，图片上传会失败并先加入本地预览；需要另开一个终端运行 `npm start`，或部署到 ECS 后通过同一个 Node 服务访问。

当前推荐部署方式是：Node 服务直接监听 `8080`，同时提供 H5 静态页面和 `/api/uploads/images` 上传接口。这样只需要维护一个公网端口，服务器重启后也只需要恢复一个计划任务。

本项目已新增后端上传接口 `POST /api/uploads/images`：

1. 后端保存 OSS `AccessKeyId` / `AccessKeySecret` / Bucket / Region。
2. 前端把图片提交到后端接口 `POST /api/uploads/images`。
3. 后端把图片上传到 OSS，并返回公开图片 URL。
4. 前端把返回的图片 URL 保存进当前书籍数据。
5. 正式数据库接入后，后端再把最终图片 URL 保存到数据库的 `book_images` 表。

不要把 OSS AccessKeySecret 写到 H5 前端代码里，否则任何访问网页的人都能看到。

前端后续会用 `.env.local` 里的配置读取上传入口：

```env
VITE_UPLOAD_ENDPOINT=/api/uploads/images
VITE_OSS_PUBLIC_BASE_URL=https://your-bucket.oss-cn-hangzhou.aliyuncs.com
```

后端需要在 ECS 上配置这些变量：

```env
PORT=8080
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=你的Bucket名称
OSS_ACCESS_KEY_ID=你的AccessKeyId
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
OSS_PUBLIC_BASE_URL=https://你的Bucket名称.oss-cn-hangzhou.aliyuncs.com
UPLOAD_MAX_FILE_SIZE=8388608
UPLOAD_MAX_FILES=30
MYSQL_HOST=rm-bp15742960i2w1hh8.mysql.rds.aliyuncs.com
MYSQL_PORT=3306
MYSQL_DATABASE=jl_shiyi_app
MYSQL_USER=jl_shiyi_app
MYSQL_PASSWORD=你的RDS密码
DEPLOY_WEBHOOK_PORT=9000
DEPLOY_WEBHOOK_SECRET=你设定的webhook密钥
```

不要把真实 `.env` 提交到 Git。

ECS 的主项目目录是 `C:\jl-shiyi-h5-gitee`（从 Gitee 拉取、安装依赖、构建、运行服务），
`C:\jl-shiyi-h5` 是旧目录（已废弃）。如果需要使用 Windows 系统环境变量而不是 `.env` 文件，可以在 ECS PowerShell 中运行：

```powershell
powershell -ExecutionPolicy Bypass -File C:\jl-shiyi-h5-gitee\scripts\windows-ecs-config-env.ps1
```

脚本会提示输入 OSS 和 RDS 配置，密码项使用隐藏输入。配置完成后，需要重启 JL拾遗计划任务或重启 ECS，让 Node 服务读取新的系统环境变量。

## 登录和数据保存说明

当前登录仍是演示登录，不需要真实验证码，也没有服务端 session。用户输入一个自定义账号即可进入，账号只能由中文、英文、数字组成，最多 60 个字符；这个账号会作为唯一标识。但在 ECS 配置 MySQL/RDS 后，用户、书籍、图片 URL、想买、留言、成交、评价和举报会保存到数据库，刷新页面后仍能读取。

正式版本后续还需要补强验证码登录、服务端 session/JWT、权限审计和联系方式加密。

## 后端接口与数据库

后端在启动时会按需创建 MySQL 表：`users`、`books`、`book_images`、`book_interests`、`messages`、`evaluations`、`reports`。主要接口包括：

- `GET /api/health`：检查服务和数据库状态
- `GET /api/state`：读取完整页面数据
- `POST /api/login`：演示登录或创建用户
- `POST /api/books`：发布书籍并保存图片 URL
- `POST /api/books/:bookId/interests`：表达想买
- `POST /api/books/:bookId/messages`：留言
- `POST /api/books/:bookId/confirm-sold`：卖家确认成交
- `POST /api/books/:bookId/evaluations`：交易评价
- `POST /api/books/:bookId/reports`：举报

## 部署说明

生产构建产物在 `dist/`：

```bash
npm run build
npm start
```

`npm start` 会启动 `server/index.js`，同时提供静态 H5 页面和 `/api/uploads/images` 上传接口。

把服务部署到 ECS 后，公网 IP 访问形式是：

```text
<ECS_PUBLIC_IP>
```

如果后端直接监听 `8080` 且安全组放行 `8080`，访问地址是：

```text
http://<ECS_PUBLIC_IP>:8080/
```

如果使用 Nginx 把 `80` 端口反向代理到 `8080`，访问地址是：

```text
http://<ECS_PUBLIC_IP>/
```

单页应用需要把未知路径回退到 `index.html`。本项目的 Node 服务已经处理了这个回退。

### Windows ECS 一键部署（Gitee 版）

**重要：当前 ECS 主目录是 `C:\jl-shiyi-h5-gitee`，旧目录 `C:\jl-shiyi-h5` 已废弃。以下所有命令都使用 Gitee 版脚本和路径。**

这个脚本只用于首次部署，或需要重新填写 OSS / 端口配置时使用。它会从 Gitee 克隆代码、安装依赖、构建项目、写入服务器本地 `.env`、注册开机启动任务，所以会比普通更新慢。

当前 ECS 只开放了远程桌面端口时，可以通过 Windows 远程桌面登录服务器，然后在服务器 PowerShell 中执行：

```powershell
powershell -ExecutionPolicy Bypass -File C:\jl-shiyi-h5-gitee\scripts\windows-ecs-deploy-gitee.ps1
```

脚本会提示输入 OSS 配置和 Gitee 用户名。真实 AccessKey 只会写入服务器本地 `C:\jl-shiyi-h5-gitee\.env`，不会提交到 GitHub。

脚本也会提示输入 `PORT`，直接回车会使用默认端口 `8080`。

脚本完成后，应用会运行在：

```text
http://<ECS_PUBLIC_IP>:8080/
```

如果打不开，需要在阿里云安全组中放行入方向 TCP `8080` 端口，或后续配置 Nginx/IIS 反向代理到 `8080`。

注意：`http://127.0.0.1:5173/` 或 `http://127.0.0.1:5174/` 是本机开发地址，只能在本机访问；ECS 上线地址需要打开 `http://<ECS_PUBLIC_IP>:8080/`。

### 更新代码到 ECS

日常更新不要再跑部署脚本，跑更新脚本即可。以后在本地更新代码后，同步流程是：

1. 本地提交并推送到 GitHub（双推同时推 Gitee，见 `windows-local-release.ps1`）。
2. 登录 ECS，执行 Gitee 版更新脚本。

```powershell
powershell -ExecutionPolicy Bypass -File C:\jl-shiyi-h5-gitee\scripts\windows-ecs-update-gitee.ps1
```

**不要使用旧版 `windows-ecs-update.ps1`**（它从 GitHub 拉取，国内 ECS 网络不可靠且指向已废弃的 `C:\jl-shiyi-h5` 目录）。

Windows ECS 当前有两份目录：

```text
C:\jl-shiyi-h5-gitee        # Gitee 拉取、安装依赖、构建的主目录（当前实际使用）
C:\wwwroot\JL-shiyi-H5      # Nginx/IIS 对外服务的静态目录（构建产物同步目标）
```

更新脚本会以 `C:\jl-shiyi-h5-gitee` 为准构建，然后把 `dist` 同步到 `C:\wwwroot\JL-shiyi-H5`，避免公网页面仍显示旧版本。

Node 服务使用 `PORT=8080`，H5 页面和上传 API 都通过同一个服务访问：页面是 `http://<ECS_PUBLIC_IP>:8080/`，上传接口是 `http://<ECS_PUBLIC_IP>:8080/api/uploads/images`。

### Webhook 自动部署（推荐）

本项目已实现 CI → CD webhook 自动部署链路，替代旧的 5 分钟轮询方案。代码推送到 GitHub `main` 分支后，CI 通过 lint、测试、构建，然后触发 ECS 上的 webhook 自动拉取、构建并重启服务。

ECS 上的 webhook 服务固定在 `C:\jl-shiyi-h5-gitee` 目录执行所有操作（代码已内置硬编码路径，不依赖 process.cwd()）。在 ECS 上启动 webhook 服务：

```powershell
powershell -ExecutionPolicy Bypass -File C:\jl-shiyi-h5-gitee\scripts\windows-ecs-enable-auto-update-gitee.ps1
```

**不要使用旧版 `windows-ecs-enable-auto-update.ps1`**（指向已废弃的 `C:\jl-shiyi-h5` 目录）。

脚本会创建 Windows 计划任务启动 webhook（`server/deploy-webhook.js`），监听 `DEPLOY_WEBHOOK_PORT`（默认 9000）接收 GitHub Actions 的 POST 请求。该端口需要在阿里云安全组中放行入方向 TCP 9000。

Webhook 收到验证通过的请求后，在 ECS 上执行 `git pull origin main → npm ci → npm run build → wwwroot 同步 → 重启 Windows Scheduled Task`，审计日志写入 `C:\jl-shiyi-h5-gitee\deploy-audit.log`。

**注意：ECS 未安装 pm2，服务通过 Windows Scheduled Task "JL拾遗 H5 Server" 管理。** 部署后 webhook 会先停止 node 进程，再通过计划任务重新启动服务。

## Git 使用建议

本地代码用 Git 管理后，推荐流程是：

```bash
git add .
git commit -m "初始化 JL拾遗 H5"
git remote add origin <你的远程仓库地址>
git push -u origin main
```

服务器部署时就不需要复制粘贴源码，可以在服务器 `git pull` 拉取更新，或者配置自动部署流水线。

## CI/CD 说明

本项目通过 GitHub Actions 实现 CI → CD 自动部署链路（`.github/workflows/ci.yml`）：

### CI 阶段

每次推送到 `main` 或创建指向 `main` 的 Pull Request 时自动执行。流程分两个 Job：

| Job | 步骤 |
|-----|------|
| **test** | `npm ci` → `npm run lint` → `npm run test -- --run` |
| **build** | `npm ci` → `npm run build` → 上传 dist artifact |

- **为什么 `build` 依赖 `test`**：lint 或测试未通过时不应构建，避免将有问题的代码标记为"可部署"。
- **为什么 CI 阶段加 `npm run test`**：单元测试成本低、反馈快，在 CI 中跑能防止字段格式退化。

### CD 阶段（webhook 部署）

CI 的 `build` job 通过后，`deploy` job 向 ECS 发送 webhook：

```text
curl -X POST http://<ECS_HOST>:9000/deploy \
  -H "Authorization: Bearer <DEPLOY_WEBHOOK_SECRET>"
```

ECS 上的 webhook 服务（`server/deploy-webhook.js`）收到请求后依次执行 `git pull origin main → npm ci → npm run build → wwwroot 同步 → 重启 Windows Scheduled Task`。所有操作固定在 `C:\jl-shiyi-h5-gitee` 目录执行。

- **为什么 webhook 替代了 5 分钟轮询**：轮询有延迟且有资源消耗；webhook 是事件驱动，CI 通过后立即触发，部署效率和一致性更高。
- **为什么 webhook 要求 Bearer token 而非 IP 白名单**：GitHub Actions 出口 IP 是动态的，IP 白名单不可行；token 校验简单且安全。
- **为什么用 Windows Scheduled Task 而非 pm2**：ECS 未安装 pm2（npm 全局工具），实际通过计划任务管理 Node 进程。

### GitHub Actions 所需的 Secrets

在仓库 Settings → Secrets and variables → Actions 中配置：

| Secret | 说明 |
|--------|------|
| `ECS_HOST` | ECS 公网 IP |
| `DEPLOY_WEBHOOK_SECRET` | 与 ECS `.env` 中的值一致 |

### 本地一键发布

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows-local-release.ps1 "你的提交说明"
```

这个脚本在本地依次执行构建、lint、`git add .`、`git commit` 和 `git push origin main`。推送后 GitHub Actions 自动跑 CI，通过后自动触发 webhook 部署到 ECS。