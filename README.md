# JL拾遗 H5

JL拾遗 H5 是基于 React + Vite 的校园二手书 H5 单页应用，对应的产品和接口文档在 `../h5-standards-template`。

当前版本是前端本地演示版：使用 mock 数据和 React 本地状态模拟登录、发布书籍、表达想买、联系方式解锁、留言、确认成交、评价和举报。刷新页面后会回到初始 mock 数据。

## 技术栈

- React 18
- TypeScript
- Vite 5
- React Router
- TanStack Query
- lucide-react

## 本地运行

```bash
npm install
npm run dev
```

如需启用 Google Books ISBN 查询，先创建本地环境变量文件：

```bash
cp .env.example .env.local
```

然后把 `.env.local` 里的 `VITE_GOOGLE_BOOKS_API_KEY` 改成真实 key。不要把 `.env.local` 提交到 Git。

Vite 默认访问地址通常是：

```text
http://localhost:5173/
```

## 验证命令

```bash
npm run build
npm run lint
```

上线或接入后端前，建议保证以上两个命令都通过。

## 当前已实现

- 书城列表：搜索、分类筛选、校区/学院/专业叠加筛选、排序、响应式卡片
- 书籍详情：联系方式隐私门槛、想买、留言、举报
- 发布书籍：Google Books ISBN 查询、图片 URL、本地多图选择与预览
- 我的书籍：状态切换、下架操作
- 个人资料编辑
- 本地演示登录
- 本地模拟成交确认、评价、举报

## 安全配置

真实 OSS AccessKey、ECS 密码、数据库密码等隐私信息不能写入源码或提交到 GitHub。配置规则见 [SECURITY.md](SECURITY.md)。

## 图片上传说明

“选择本地图片”支持一次选择多张，前端不设置照片数量上限。生产环境会通过后端接口 `POST /api/uploads/images` 上传到阿里云 OSS，并把 OSS 返回的图片 URL 放入书籍图片列表。

本地开发时，如果只启动 `npm run dev` 而没有启动后端服务，图片上传会失败；需要另开一个终端运行 `npm start`，或部署到 ECS 后通过同一个 Node 服务访问。

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
PORT=3000
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=你的Bucket名称
OSS_ACCESS_KEY_ID=你的AccessKeyId
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
OSS_PUBLIC_BASE_URL=https://你的Bucket名称.oss-cn-hangzhou.aliyuncs.com
UPLOAD_MAX_FILE_SIZE=8388608
UPLOAD_MAX_FILES=30
```

不要把真实 `.env` 提交到 Git。

## 登录和数据保存说明

现在的登录是演示登录，不需要真实验证码，也没有服务端 session。个人上传的书籍只保存在当前浏览器页面运行时的 React state 中：页面不刷新时能看到，刷新后会丢失。

正式版本需要后端登录和数据库保存：用户表保存账号，书籍表保存书籍信息，图片表保存 OSS 图片 URL。

## 后端接入位置

等云服务器、域名和对象存储确定后，把 `src/App.tsx` 里的本地状态操作替换为 REST API 请求。接口边界参考：

```text
../h5-standards-template/03-backend-api.md
```

建议优先接入：

- 登录与会话持久化
- 书籍增删改查
- 图片上传凭证或预签名 URL
- 想买与联系方式解锁事务
- 留言接口
- 成交确认与评价接口
- 举报与后台审核接口

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

如果后端直接监听 `3000` 且安全组放行 `3000`，访问地址是：

```text
http://<ECS_PUBLIC_IP>:3000/
```

如果使用 Nginx 把 `80` 端口反向代理到 `3000`，访问地址是：

```text
http://<ECS_PUBLIC_IP>/
```

单页应用需要把未知路径回退到 `index.html`。本项目的 Node 服务已经处理了这个回退。

### Windows ECS 一键部署

当前 ECS 只开放了远程桌面端口时，可以通过 Windows 远程桌面登录服务器，然后在服务器 PowerShell 中执行：

```powershell
powershell -ExecutionPolicy Bypass -Command "iwr https://raw.githubusercontent.com/sb679/JL-shiyi-H5/main/scripts/windows-ecs-deploy.ps1 -OutFile $env:TEMP\jl-shiyi-deploy.ps1; & $env:TEMP\jl-shiyi-deploy.ps1"
```

脚本会提示输入 OSS 配置。真实 AccessKey 只会写入服务器本地 `C:\jl-shiyi-h5\.env`，不会提交到 GitHub。

脚本完成后，应用会运行在：

```text
http://<ECS_PUBLIC_IP>:3000/
```

如果打不开，需要在阿里云安全组中放行入方向 TCP `3000` 端口，或后续配置 Nginx/IIS 反向代理到 `3000`。

## Git 使用建议

本地代码用 Git 管理后，推荐流程是：

```bash
git add .
git commit -m "初始化 JL拾遗 H5"
git remote add origin <你的远程仓库地址>
git push -u origin main
```

服务器部署时就不需要复制粘贴源码，可以在服务器 `git pull` 拉取更新，或者配置自动部署流水线。
