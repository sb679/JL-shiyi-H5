# JL拾遗 H5 项目复盘与经验记录

本文档记录 JL拾遗 H5 项目从本地演示版推进到 ECS + OSS + RDS 持久化过程中的主要聊天脉络、遇到的困难、排查过程、已经形成的工程经验和后续操作清单。

注意：本文档不会记录真实密码、AccessKeySecret、数据库密码、ECS 登录凭据等敏感信息。所有真实密钥只能保存在 ECS 本地 `.env`、Windows 系统环境变量或云平台密钥管理能力中，不能写入 GitHub 仓库。

## 1. 项目当前目标

JL拾遗 H5 是一个校园二手书 H5 单页应用，当前目标是从本地 mock 演示版逐步变成可上线试用的版本。

当前已完成或正在接入的能力包括：

- React + Vite H5 页面。
- 书城列表、搜索、分类、校区/学部/学院/专业筛选。
- 发布书籍、图片上传、联系方式展示、想买、留言、成交确认、评价、举报。
- Node + Express 后端提供静态页面、上传接口、业务 API。
- 阿里云 OSS 用于图片存储。
- 阿里云 RDS MySQL 用于用户、书籍、图片 URL、想买、留言、成交、评价、举报等数据持久化。
- Windows ECS 部署，Node 服务监听 `8080`。
- GitHub Actions CI 检查 `npm ci`、`npm run lint`、`npm run build`。
- ECS 可通过 Windows 计划任务启动服务，也可使用自动更新脚本定期从 GitHub 拉取新代码。

## 2. 重要目录与文件

本地项目主目录：

```text
D:\xunlei\litterxunlei\JL拾遗\standards-template\jl-shiyi-h5
```

ECS 主项目目录（当前实际使用 — Gitee 版）：

```text
C:\jl-shiyi-h5-gitee
```

ECS 旧主项目目录（已废弃 — 原 GitHub 版）：

```text
C:\jl-shiyi-h5
```

ECS 静态镜像目录：

```text
C:\wwwroot\JL-shiyi-H5
```

这三个 ECS 目录不要混淆：

- `C:\jl-shiyi-h5-gitee` 是**当前主项目目录**，从 Gitee 拉取、安装依赖、构建、启动 Node、保存 `.env` 都应以它为准。
- `C:\jl-shiyi-h5` 是**旧目录（已废弃）**，原用于从 GitHub 拉取。国内 ECS 访问 GitHub 网络不可靠，已迁移至 Gitee 版。
- `C:\wwwroot\JL-shiyi-H5` 是静态页面镜像目录，可能被 IIS/Nginx 或旧静态服务读取。更新脚本会把 `dist` 同步到这里。

关键文件：

```text
server/index.js                         # Express 服务入口，提供静态页面、上传接口、业务 API
server/database.js                      # RDS MySQL 连接、建表、业务数据读写
src/App.tsx                             # 前端主应用、登录、发布、缓存、业务交互
src/mockData.ts                         # 本地 mock 数据
vite.config.ts                          # 本地 Vite 代理配置，/api 代理到 127.0.0.1:8080
scripts/start-server.ps1                # Windows 计划任务调用的启动脚本
scripts/windows-ecs-deploy.ps1          # 首次部署或重新填写环境配置
scripts/windows-ecs-update.ps1          # 旧更新脚本（从 GitHub 拉取，已废弃，用 gitee 版替代）
scripts/windows-ecs-enable-auto-update.ps1 # 旧自动更新任务（从 GitHub，已废弃）
scripts/windows-ecs-config-env.ps1      # 在 ECS 上配置系统环境变量
scripts/windows-local-release.ps1       # 本地一键 build/lint/commit/push（已支持双推 GitHub + Gitee）
scripts/windows-gitee-mirror-setup.ps1  # 本地配置 Gitee 镜像 remote
scripts/windows-ecs-deploy-gitee.ps1    # ECS 首次从 Gitee 部署（推荐用于国内 ECS）★
scripts/windows-ecs-update-gitee.ps1    # ECS 日常从 Gitee 更新（推荐用于国内 ECS）★
scripts/windows-ecs-enable-auto-update-gitee.ps1 # ECS 从 Gitee 自动更新任务（推荐用于国内 ECS）★
.github/workflows/ci.yml                # GitHub Actions CI
.env.example                            # 可提交的环境变量示例，不含真实密码
```

## 3. 我们的主要聊天与操作脉络

### 3.1 起点：本地演示版不能持久化

最初项目主要依赖 React state 和 mock 数据。用户发布书籍、表达想买、留言等行为只保存在浏览器运行时内存中，刷新页面会丢失。

我们确认后做了以下调整：

- 新增 `mysql2` 依赖。
- 新增 `server/database.js`，通过环境变量读取 RDS MySQL 配置。
- 后端启动时按需创建表：`users`、`books`、`book_images`、`book_interests`、`messages`、`evaluations`、`reports`。
- `server/index.js` 新增业务 API：
  - `GET /api/health`
  - `GET /api/state`
  - `POST /api/login`
  - `POST /api/books`
  - `POST /api/books/:bookId/interests`
  - `POST /api/books/:bookId/messages`
  - `POST /api/books/:bookId/confirm-sold`
  - `POST /api/books/:bookId/evaluations`
  - `POST /api/books/:bookId/reports`
- 前端 `src/App.tsx` 改成优先走 API，后端不可用时保留 mock 兜底。

经验：

- RDS 不是简单写一个地址就能生效，必须同时有后端 API、表结构、读写逻辑和前端请求逻辑。
- 前端只保存图片 URL；图片文件本体进入 OSS，业务数据进入 RDS。

### 3.2 图片上传提示 `Failed to fetch`

用户上传图片时看到：

```text
Failed to fetch 已先加入本地预览，仍可继续发布。
```

我们判断这不是 RDS 问题。图片上传走 OSS 和后端 `/api/uploads/images`，RDS 不负责图片上传。

发现的问题：

- 本地 Vite 代理原来指向 `127.0.0.1:3000`。
- 项目后端默认监听 `8080`。

修复：

```ts
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://127.0.0.1:8080',
  },
}
```

经验：

- 浏览器里的 `Failed to fetch` 通常表示请求根本没有到业务逻辑层，优先检查接口地址、端口、代理、CORS、服务是否启动。
- 图片上传失败和数据库失败要分开排查。

### 3.3 发布页草稿丢失

用户发现：发布页填写信息后切到“书城”或“我的”，再回来内容消失。

原因：

- `PublishPage` 组件卸载后，本地 state 丢失。

修复：

- 使用 `localStorage` 保存发布草稿。
- 草稿 key：`jl-shiyi-publish-draft-v1`。
- 提交成功后清草稿。
- 上次发布地点使用 `jl-shiyi-last-location-v1` 记住。

经验：

- H5 多页面路由切换会卸载组件。重要表单草稿不能只放组件 state。
- 草稿缓存应在提交成功后清理，避免下次误带旧信息。

### 3.4 发布页地点候选不记忆

用户发现：书城筛选能看到新校区/学部/学院/专业，但发布页仍只显示默认地点。

修复：

- 发布页候选项合并：当前草稿、上次发布地点、已发布书籍、用户资料、内置校区配置。
- 提交成功后保存本次地点为上次地点。

经验：

- 筛选页和发布页的数据来源要统一，否则用户会感觉系统“记住一半”。

### 3.5 登录不是正式登录

用户发现不同设备打开都是同一个默认用户：`拾遗用户A9K2`。

原因：

- 原代码默认使用 `currentUserSeed`。

调整过程：

- 先改为输入邮箱或手机号演示登录。
- 用户认为手机号/微信登录太麻烦。
- 最终改为自定义账号登录。

当前规则：

- 用户输入自定义账号即可登录。
- 账号只能包含中文、英文字母、数字。
- 最多 60 个字符。
- 账号作为唯一标识。
- 新账号自动创建用户。
- 同账号再次登录会回到同一用户身份。

经验：

- 早期试用版可以先采用低摩擦登录方式。
- 即便是演示登录，也要避免所有用户共享同一个默认身份。
- 前后端都应做同一套账号校验，不能只依赖前端校验。

### 3.6 RDS 配置与安全

用户提供过 RDS 地址、端口、库名、账号和密码。

我们保留在代码和文档里的非敏感配置：

```env
MYSQL_HOST=rm-bp15742960i2w1hh8.mysql.rds.aliyuncs.com
MYSQL_PORT=3306
MYSQL_DATABASE=jl_shiyi_app
MYSQL_USER=jl_shiyi_app
```

没有写入仓库的敏感信息：

```env
MYSQL_PASSWORD=真实密码
OSS_ACCESS_KEY_SECRET=真实密钥
```

新增脚本：

```text
scripts/windows-ecs-config-env.ps1
```

作用：在 ECS 上将 OSS/RDS 配置写入 Windows Machine 级系统环境变量。密码项使用隐藏输入。

经验：

- `.env.example` 只能写 demo 值或占位符。
- 真实 `.env`、数据库密码、OSS Secret 不能提交 GitHub。
- 即使用户在聊天里提供过密码，也不应该在后续文档或命令里复述。
- Machine 级系统环境变量写入后，当前已打开 PowerShell 不会自动刷新，需要重新打开窗口、手动加载或重启服务/机器。

### 3.7 RDS 健康检查

新版 `/api/health` 返回格式：

```json
{
  "ok": true,
  "database": {
    "configured": true,
    "ok": true
  }
}
```

排查过程中出现过：

```text
database @{configured=False; ok=False}
```

含义：后端没读到数据库环境变量。

之后出现：

```text
database @{configured=True; ok=False}
```

含义：后端读到了环境变量，但连接 RDS 或初始化表失败。

最小连接测试：

```powershell
node -e "import('mysql2/promise').then(async mysql=>{try{const c=await mysql.createConnection({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE}); const [r]=await c.query('SELECT 1 AS ok'); console.log(r); await c.end();}catch(e){console.error(e.code, e.errno, e.sqlState, e.message); process.exit(1);}})"
```

可能错误：

- `ER_ACCESS_DENIED_ERROR`：账号或密码错误，或账号不允许该来源登录。
- `ER_BAD_DB_ERROR`：数据库不存在。
- `ER_DBACCESS_DENIED_ERROR`：账号没有该库权限。
- `ECONNREFUSED` / `ETIMEDOUT`：网络、白名单、安全组、端口或环境变量读取问题。

经验：

- `configured=True` 只说明读到了配置，不代表数据库连接成功。
- 数据库密码错通常不是 `ECONNREFUSED`，而更可能是 `ER_ACCESS_DENIED_ERROR`。
- 先检查环境变量，再检查端口连通，再检查账号权限。

### 3.8 ECS 到 GitHub 网络失败（已解决 — 采用 Gitee 镜像）

用户在 ECS 上运行更新脚本，多次出现：

```text
fatal: unable to access 'https://github.com/sb679/JL-shiyi-H5.git/': Recv failure: Connection was reset
```

我们尝试过：

```powershell
git config --global http.version HTTP/1.1
git config --global http.sslBackend schannel
git fetch origin main
```

仍失败。

**根因分析**：阿里云国内 ECS 到 github.com 的 TCP 443 链路被 GFW 的 RST 注入干扰。不是 TLS 协商问题，而是 TCP 连接层面即被阻断。DNS 污染、CDN 节点不可达、gist/codeload 等子域名也被干扰。

**最终解决方案 — Gitee 镜像**：

在 Gitee（码云）创建 `JL-shiyi-H5` 镜像仓库。本地通过双 remote 机制同时推送到 GitHub 和 Gitee，ECS 从 Gitee 拉取代码（国内服务器访问 Gitee 非常稳定）。

新增脚本：

```text
scripts/windows-gitee-mirror-setup.ps1       # 本地配置双 remote，推送代码到 Gitee
scripts/windows-ecs-deploy-gitee.ps1          # ECS 首次从 Gitee 部署
scripts/windows-ecs-update-gitee.ps1          # ECS 日常从 Gitee 更新（替代原 GitHub 版）
scripts/windows-ecs-enable-auto-update-gitee.ps1 # ECS 自动更新计划任务（从 Gitee）
```

本地发布流程修改：

- `windows-local-release.ps1` 现在先推送到 GitHub (origin)，再推送到 Gitee (gitee)。
- 如果 Gitee remote 不存在，会提示先运行 `windows-gitee-mirror-setup.ps1`。

ECS 部署操作流程：

```powershell
# 首次部署（在 ECS 上）
powershell -ExecutionPolicy Bypass -File "C:\jl-shiyi-h5-gitee\scripts\windows-ecs-deploy-gitee.ps1"

# 日常更新（在 ECS 上）
powershell -ExecutionPolicy Bypass -File "C:\jl-shiyi-h5-gitee\scripts\windows-ecs-update-gitee.ps1"

# 启用自动更新（每 5 分钟从 Gitee 拉取）
powershell -ExecutionPolicy Bypass -File "C:\jl-shiyi-h5-gitee\scripts\windows-ecs-enable-auto-update-gitee.ps1"
```

旧版 GitHub 脚本仍保留（`windows-ecs-deploy.ps1`、`windows-ecs-update.ps1`、`windows-ecs-enable-auto-update.ps1`），但如果 GitHub 不可用应使用 Gitee 版本。

临时绕过方式（备用）：

```powershell
Invoke-WebRequest "https://github.com/sb679/JL-shiyi-H5/archive/refs/heads/main.zip" -OutFile "C:\jl-shiyi-main.zip"
```

GitHub zip 下载成功后，使用 `Expand-Archive` 解压并替换 `C:\jl-shiyi-h5`。

经验：

- `git fetch` 失败后旧脚本仍输出 `Already up to date` 是误导。
- `Already up to date` 不代表真的更新成功，必须先确认 `git fetch` 没有 fatal 错误。
- Gitee 是国内 ECS 访问 Git 仓库的首选方案，速度稳定。
- 本地保持双 push（GitHub + Gitee），GitHub 用于 CI/CD，Gitee 用于 ECS 部署。
- 私有仓库需要在 ECS 上配置 Gitee 凭据（用户名/密码或 SSH key）。

### 3.9 Windows 计划任务丢失

用户运行：

```powershell
Start-ScheduledTask -TaskName "JL拾遗 H5 Server"
```

曾出现：

```text
系统找不到指定的文件
```

原因：计划任务不存在，或计划任务引用脚本路径不存在。

临时启动：

```powershell
Start-Process -FilePath "node" -ArgumentList "server/index.js" -WorkingDirectory "C:\jl-shiyi-h5"
```

重新注册计划任务：

```powershell
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\jl-shiyi-h5\scripts\start-server.ps1`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Register-ScheduledTask -TaskName "JL拾遗 H5 Server" -Action $Action -Trigger $Trigger -Principal $Principal -Force
```

经验：

- 计划任务不是文件，它是 Windows Task Scheduler 中的注册项。
- 项目目录存在不代表计划任务存在。
- 替换项目目录后，要确认 `scripts/start-server.ps1` 存在。

### 3.10 终端输出异常

本地 VS Code 工具中的 PowerShell 曾出现：

- `npm run build` 无回显。
- `Write-Output` 无回显。
- 命令看似执行但日志文件没生成。
- Git 命令看似执行但未 staged。

后来确认构建和 lint 实际可在真实终端中通过。

经验：

- 不要在终端无输出时无限等待。
- 对长命令设置超时。
- 使用 VS Code Git 状态、文件日志、`get_errors`、实际截图交叉验证。
- 自动化工具的终端状态不一定等同于真实 PowerShell 状态。

## 4. 当前部署流程建议

### 4.1 本地开发

本地项目目录：

```powershell
cd "D:\xunlei\litterxunlei\JL拾遗\standards-template\jl-shiyi-h5"
```

安装依赖：

```powershell
npm install
```

启动后端：

```powershell
npm start
```

启动 Vite：

```powershell
npm run dev
```

本地 Vite 代理：

```text
/api -> http://127.0.0.1:8080
```

### 4.2 本地发布到 GitHub

一键脚本：

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\windows-local-release.ps1" "提交说明"
```

它会执行：

```text
npm run build
npm run lint
git add .
git commit
git push origin main
```

如果脚本异常，可以手动执行：

```powershell
npm run build
npm run lint
git status --short
git add .
git commit -m "提交说明"
git push origin main
```

### 4.3 ECS 常规更新

**重要：当前 ECS 主目录已切换为 `C:\jl-shiyi-h5-gitee`（Gitee 镜像），旧 `C:\jl-shiyi-h5` 已废弃。**

如果 ECS 能访问 Gitee（推荐，国内网络更稳定）：

```powershell
powershell -ExecutionPolicy Bypass -File "C:\jl-shiyi-h5-gitee\scripts\windows-ecs-update-gitee.ps1"
```

如果 ECS 能访问 GitHub（旧方案，网络不稳定）：

```powershell
powershell -ExecutionPolicy Bypass -File "C:\jl-shiyi-h5\scripts\windows-ecs-update.ps1"
```

如果 ECS 无法 `git fetch`，但能下载 zip：

```powershell
Invoke-WebRequest "https://github.com/sb679/JL-shiyi-H5/archive/refs/heads/main.zip" -OutFile "C:\jl-shiyi-main.zip"
```

解压：

```powershell
Remove-Item "C:\jl-shiyi-main" -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive "C:\jl-shiyi-main.zip" "C:\jl-shiyi-main" -Force
```

确认项目根目录：

```powershell
Get-ChildItem "C:\jl-shiyi-main" -Recurse -Filter package.json | Select-Object FullName
```

当前确认过的 zip 项目目录：

```text
C:\jl-shiyi-main\JL-shiyi-H5-main
```

### 4.4 ECS 启动服务

直接启动（使用 Gitee 目录）：

```powershell
Start-Process -FilePath "node" -ArgumentList "server/index.js" -WorkingDirectory "C:\jl-shiyi-h5-gitee"
```

通过计划任务启动：

```powershell
Start-ScheduledTask -TaskName "JL拾遗 H5 Server"
```

健康检查：

```powershell
Invoke-RestMethod "http://127.0.0.1:8080/api/health"
```

## 5. 环境变量清单

后端运行需要：

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
```

说明：

- `.env.example` 中只能放占位值。
- ECS 的真实值可以放 `C:\jl-shiyi-h5-gitee\.env`。
- 也可以用 `scripts/windows-ecs-config-env.ps1` 写入 Windows Machine 环境变量。
- 如果修改 Machine 环境变量，建议重启 Node 服务，必要时重启 ECS。

## 6. 当前仍需确认的问题

### 6.1 RDS 是否完全连通

当前已经进入 RDS 配置排查阶段。

需要确认：

- 当前 PowerShell 是否能读到 `MYSQL_*` 环境变量。
- `Test-NetConnection rm-bp15742960i2w1hh8.mysql.rds.aliyuncs.com -Port 3306` 是否 `TcpTestSucceeded: True`。
- `node -e` 最小 MySQL 连接测试是否返回 `[ { ok: 1 } ]`。
- RDS 白名单是否放行 ECS IP。
- 数据库 `jl_shiyi_app` 是否存在。
- 账号 `jl_shiyi_app` 是否有该库权限。

### 6.2 OSS 是否完全可用

需要确认：

- OSS Bucket 名称。
- OSS Region。
- AccessKeyId / AccessKeySecret 是否有效。
- Bucket 是否允许后端写入。
- 公开访问 URL 是否能访问上传后的图片。

### 6.3 自动更新已切换为 Gitee 镜像

GitHub 在国内 ECS 的网络不可靠问题已通过 **Gitee 镜像** 方案解决：

- 本地通过 `windows-local-release.ps1` 双推 GitHub + Gitee。
- ECS 通过 `windows-ecs-update-gitee.ps1` 从 Gitee 拉取代码。
- 自动更新计划任务也切换到 `windows-ecs-enable-auto-update-gitee.ps1`。

如需在 ECS 上首次部署，运行 `windows-ecs-deploy-gitee.ps1`（而非旧的 `windows-ecs-deploy.ps1`）。

如果 Gitee 也无法访问（极少见），备用方案：
- GitHub zip 下载更新。
- 本地打包后远程桌面复制到 ECS。

## 7. 不要再踩的坑

1. 不要把真实密码写进 `.env.example`、README、脚本或 GitHub。
2. 不要从 `C:\wwwroot\JL-shiyi-H5` 当主项目目录更新。
3. 不要看到 `Already up to date` 就认为更新成功，先看前面有没有 `fatal`。
4. 不要在 `PS C:\jl-shiyi-h5-gitee>` 里删除 `C:\jl-shiyi-h5-gitee` 自己。
5. 不要把图片上传失败误判为 RDS 失败。
6. 不要把计划任务和脚本文件混为一谈，计划任务是 Windows 注册项。
7. 不要让终端卡住超过 10 分钟，必须及时换验证方式。
8. 不要公开截图包含 AccessKeyId、AccessKeySecret、数据库密码。

## 8. 建议学习清单

为了更顺畅地维护这个项目，建议按优先级学习：

1. Git 基础：`status`、`add`、`commit`、`push`、`fetch`、`reset --hard origin/main`。
2. Windows PowerShell 基础：路径、引号、`Test-Path`、`Get-ChildItem`、`Copy-Item`、`Remove-Item`、`Move-Item`。
3. Windows 计划任务：`Register-ScheduledTask`、`Start-ScheduledTask`、任务名与脚本路径区别。
4. Node 部署：`npm ci`、`npm run build`、`npm start`、端口监听。
5. Vite 与 API 代理：本地 `5173/5174` 页面如何请求后端 `8080`。
6. OSS 基础：Bucket、Region、AccessKey、公开 URL、上传权限。
7. RDS MySQL 基础：白名单、账号、数据库、权限、3306 端口、连接测试。
8. 环境变量安全：`.env`、`.env.example`、系统环境变量、不要提交密钥。
9. CI/CD 基础：GitHub Actions 能自动检查代码，但不能读取本地未推送代码。
10. 故障排查思路：先判断是前端、后端、网络、数据库、权限还是配置问题。

## 9. 建议的下一步验收

完成 RDS/OSS 配置后，按以下顺序验收：

1. `GET /api/health` 返回 `database.configured=True` 且 `database.ok=True`。
2. 使用自定义账号登录。
3. 发布一本书。
4. 刷新页面后书籍仍存在。
5. 上传图片能进入 OSS，并在页面显示。
6. 另一个账号表达想买。
7. 卖家确认成交。
8. 留言和评价能保存。
9. 手机访问公网地址测试同样流程。
10. 重启 ECS 后网站自动恢复。

## 10. 复盘结论

这次最大的问题不是单点代码 bug，而是多个系统边界同时出现：

- 本地 mock 到真实 RDS 持久化的边界。
- 图片 OSS 与业务 RDS 的边界。
- 本地 Vite 与 ECS Node 的端口边界。
- GitHub 与 ECS 网络的边界。
- Windows 计划任务与普通进程的边界。
- `.env`、系统环境变量、当前 PowerShell 进程环境的边界。

后续维护这个项目时，最重要的经验是：先确认“当前问题处在哪一层”，再动手。不要把所有失败都归因于代码，也不要把所有失败都归因于配置。每一步都要有明确的成功信号。
