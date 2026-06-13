# JL拾遗 · 编程规约与项目模板

本仓库是 **JL拾遗 H5** 项目的编程规约、架构文档和部署手册的集中管理仓库，同时包含项目源代码。

在线地址：**[http://47.99.71.207:8080/](http://47.99.71.207:8080/)**

---

## 目录结构

```
standards-template/
├── jl-shiyi-h5/                  ← H5 应用源代码（React + Vite + Express）
│   ├── README.md                 ← 应用技术文档（技术栈、本地运行、功能清单）
│   ├── src/                      ← 前端源码
│   ├── server/                   ← Node 后端（Express API + webhook）
│   ├── scripts/                  ← ECS 部署与更新脚本
│   └── .github/workflows/        ← CI/CD 流水线
├── h5-standards-template/        ← 编程规约模板（可复用到其他项目）
└── *.md                          ← 当前项目的具体规约文档
```

---

## 编程规约（当前项目）

| 文档 | 说明 |
|------|------|
| [00-project-context.md](00-project-context.md) | 项目背景与技术上下文 |
| [01-requirements.md](01-requirements.md) | 需求文档 |
| [02-database-coding-standards.md](02-database-coding-standards.md) | 数据库编码规范 |
| [03-cloud-functions.md](03-cloud-functions.md) | 云函数 / 后端接口规范 |
| [04-page-architecture.md](04-page-architecture.md) | 页面架构设计 |
| [05-user-flows.md](05-user-flows.md) | 用户流程文档 |
| [06-deployment-testing.md](06-deployment-testing.md) | 部署与测试指南 |
| [07-known-issues-roadmap.md](07-known-issues-roadmap.md) | 已知问题与路线图 |

---

## 规约模板（可复用）

`h5-standards-template/` 目录下为通用编程规约模板，适用于类似的 H5 全栈项目。

| 模板 | 说明 |
|------|------|
| [00-project-context.md](h5-standards-template/00-project-context.md) | 项目上下文模板 |
| [01-requirements.md](h5-standards-template/01-requirements.md) | 需求文档模板 |
| [02-database-coding-standards.md](h5-standards-template/02-database-coding-standards.md) | 数据库规范模板 |
| [03-backend-api.md](h5-standards-template/03-backend-api.md) | 后端 API 规范模板 |
| [04-page-architecture.md](h5-standards-template/04-page-architecture.md) | 页面架构模板 |
| [05-user-flows.md](h5-standards-template/05-user-flows.md) | 用户流程模板 |
| [06-deployment-testing.md](h5-standards-template/06-deployment-testing.md) | 部署测试模板 |
| [07-known-issues-roadmap.md](h5-standards-template/07-known-issues-roadmap.md) | 问题与路线图模板 |

---

## 快速开始

详见 **[jl-shiyi-h5/README.md](jl-shiyi-h5/README.md)** —— 包含技术栈、本地运行、功能清单和 API 说明。

```bash
cd jl-shiyi-h5
npm install
npm start       # 启动 Express 后端（端口 8080）
npm run dev     # 启动 Vite 前端（端口 5173，代理到 8080）
```

---

## 技术栈

- **前端**：React 18 + TypeScript + Vite 5 + TanStack Query + React Router
- **后端**：Express 5 + MySQL/RDS（阿里云）
- **存储**：阿里云 OSS（图片上传）
- **部署**：阿里云 ECS（Windows Server）+ GitHub Actions CI/CD
- **测试**：Vitest（56 个单元测试）

---

## 项目复盘

项目推进过程中的部署排错、RDS/OSS/ECS/GitHub 经验和复盘记录见：

**[jl-shiyi-h5/docs/project-retrospective.md](jl-shiyi-h5/docs/project-retrospective.md)**

---

## 安全提醒

真实 OSS AccessKey、ECS 密码、数据库密码、webhook 密钥等隐私信息不应写入源码或提交到仓库。配置规则见 **[jl-shiyi-h5/SECURITY.md](jl-shiyi-h5/SECURITY.md)**。