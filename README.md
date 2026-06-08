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

## 图片上传说明

现在的“选择本地图片”支持一次选择多张，前端不设置照片数量上限。它只是在浏览器里读取图片并立即预览，不会上传到云端，也不会永久保存。刷新页面后，本地状态会丢失。

正式上线时需要接入对象存储。你已经开通阿里云 OSS，推荐流程是：

1. 后端保存 OSS `AccessKeyId` / `AccessKeySecret` / Bucket / Region。
2. 前端请求后端接口，例如 `POST /api/uploads/oss-policy`。
3. 后端校验登录态后，签发短时有效的 OSS 上传策略或预签名 URL。
4. 前端把图片直传到 OSS。
5. 后端把最终图片 URL 保存到数据库的 `book_images` 表。

不要把 OSS AccessKeySecret 写到 H5 前端代码里，否则任何访问网页的人都能看到。

前端后续会用 `.env.local` 里的配置读取上传入口：

```env
VITE_UPLOAD_POLICY_ENDPOINT=/api/uploads/oss-policy
VITE_OSS_PUBLIC_BASE_URL=https://your-bucket.oss-cn-hangzhou.aliyuncs.com
```

目前还没有后端签名接口，所以只能做本地预览。

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
```

`dist/` 可以部署到 Nginx、Caddy、对象存储 + CDN，或任意静态站点服务。由于这是单页应用，服务器需要把未知路径回退到 `index.html`。

## Git 使用建议

本地代码用 Git 管理后，推荐流程是：

```bash
git add .
git commit -m "初始化 JL拾遗 H5"
git remote add origin <你的远程仓库地址>
git push -u origin main
```

服务器部署时就不需要复制粘贴源码，可以在服务器 `git pull` 拉取更新，或者配置自动部署流水线。
