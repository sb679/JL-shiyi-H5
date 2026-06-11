# JL拾遗 H5 项目文档

本目录是基于原微信小程序项目文档重写的 H5 网页版本项目文档。原 `standards-template` 下的旧文档未修改。

## 阅读顺序
1. `00-project-context.md`：先了解项目定位、H5 化后的技术选型和 MVP 边界。
2. `01-requirements.md`：查看产品功能、角色权限、验收标准和非功能需求。
3. `02-database-coding-standards.md`：查看数据库设计、事务规则、编码规范和安全约束。
4. `03-backend-api.md`：按 REST API 实现后端接口。
5. `04-page-architecture.md`：按 H5 路由、组件和数据流实现前端页面。
6. `05-user-flows.md`：按用户端到端流程做联调和验收。
7. `06-deployment-testing.md`：按部署、环境变量、测试清单准备上线。
8. `07-known-issues-roadmap.md`：跟踪风险、技术债、安全待办和后续版本。

## H5 版本核心变化
- 不再使用微信小程序、微信云开发、云函数、openid、fileID、wx.scanCode。
- 改用 H5 前端、独立后端 API、PostgreSQL、对象存储预签名上传、Cookie Session/JWT 鉴权。
- 保留原业务核心：书城、发布书籍、想买、联系方式保护、留言、确认售出、评价、举报。
- 新增 H5 必需内容：域名 HTTPS、备案、Web 安全、CSRF/XSS、对象存储 CORS、移动端浏览器兼容。

## 建议默认实现栈
- 前端：React + Vite + TypeScript + React Router + TanStack Query。
- 后端：Node.js + NestJS/Express + TypeScript。
- 数据库：PostgreSQL。
- ORM：Prisma 或 Drizzle。
- 存储：S3 兼容对象存储、阿里 OSS、腾讯 COS 或 Cloudflare R2。
- 部署：Docker + Nginx + HTTPS。
