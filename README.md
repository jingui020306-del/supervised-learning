<div align="center">

<img src="https://img.shields.io/badge/status-active-success?style=flat-square" alt="Status">
<img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
<img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat-square" alt="Node">
<img src="https://img.shields.io/badge/platform-iPad%20%7C%20Mac%20%7C%20Windows-lightgrey?style=flat-square" alt="Platform">

</div>

<h1 align="center">Supervised Learning</h1>

<p align="center">
  <strong>学习监督系统</strong><br>
  计划 · 追踪 · 比对 · 告警
</p>

<p align="center">
  <sub>基于 Super Productivity 和 ActivityWatch 的二开项目</sub>
</p>

---

## 这是什么？

一个面向**学生和家长**的学习监督系统。

学生在 iPad 上使用学习 App（新东方大学考试、小鹅通学员版、网易有道词典），系统自动追踪学习时长，比对学习计划，在任务未完成时发送提醒通知给学生和监督者。

### 核心能力

- **计划管理** — 制定每日/每周学习计划，设定时间框和目标时长
- **自动追踪** — iPad 打开/关闭学习 App 时自动记录（iOS 快捷指令）
- **智能比对** — 实时比较计划 vs 实际，量化学习进度
- **多通道告警** — 进度落后时，Bark 推送提醒学生，微信/飞书通知监督者
- **移动仪表盘** — 监督者手机端查看学习进度和告警历史

## 架构

```
学生 iPad (学习App + Bark)
     │
     │ 快捷指令自动上报
     ▼
监督后端 (Fastify + SQLite) ← Super Productivity (计划端)
     │
     ├──→ Bark (学生推送)
     ├──→ 微信/飞书 (监督者通知)
     └──→ 移动仪表盘 (监督者查看)
```

## 快速开始

### 环境要求

- Node.js >= 22
- npm >= 10
- Docker (可选，运行 Super Productivity)

### 1. 安装依赖

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
```

### 2. 配置环境变量

```bash
cp ../.env.example .env
# 编辑 .env，填入 Bark DeviceKey、Server酱 SendKey、飞书 Webhook 等
```

### 3. 启动开发服务器

```bash
npm run dev
```

后端运行在 `http://localhost:3001`

### 4. 启动 Super Productivity（可选）

```bash
docker compose up -d super-productivity
```

SP Web 界面在 `http://localhost:8080`

### 5. 配置 iPad 快捷指令

参见 [`shortcuts/README.md`](shortcuts/README.md)

## 项目结构

```
supervised-learning/
├── backend/                    # 监督后端
│   ├── src/
│   │   ├── server.ts           # Fastify 服务器
│   │   ├── routes/             # API 路由
│   │   ├── services/           # 业务逻辑
│   │   │   ├── comparator.service.ts  # 计划 vs 实际比对引擎
│   │   │   └── notification/   # 通知分发（Bark/微信/飞书）
│   │   ├── jobs/               # 定时任务
│   │   ├── adapters/           # ActivityWatch / SP 适配器
│   │   └── views/              # SSR 仪表盘
│   ├── prisma/                 # 数据模型
│   └── Dockerfile
├── sp-plugin/                  # Super Productivity 插件
├── shortcuts/                  # iPad 快捷指令配置
├── docs/                       # 文档
├── docker-compose.yml          # 容器编排
└── .env.example
```

## API 概览

| 端点 | 用途 |
|------|------|
| `POST /api/v1/tracking/push` | iPad 快捷指令上报 |
| `GET /api/v1/plans/today/:userId` | 今日计划 |
| `CRUD /api/v1/plans/*` | 计划管理 |
| `GET /api/v1/alerts/history` | 告警历史 |
| `GET /api/v1/dashboard/today` | 今日仪表盘 |
| `GET /api/v1/dashboard/weekly` | 周汇总 |
| `GET /health` | 健康检查 |

## 通知渠道

| 渠道 | 目标 | 说明 |
|------|------|------|
| **Bark** | 学生 iPad | 免费 iOS 推送，中国区可用 |
| **Server酱** | 监督者微信 | 免费额度 5条/天 |
| **飞书 Webhook** | 监督者飞书 | 免费，即时推送 |

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Node.js + Fastify + TypeScript |
| 数据库 | SQLite + Prisma |
| 模板 | Eta (服务端渲染) |
| 容器化 | Docker + Docker Compose |
| 计划端 | Super Productivity (Angular + Electron) |
| 桌面追踪 | ActivityWatch (Python) |

## 一键打包

```bash
npm run build          # 编译 TypeScript
npm run package        # 打包为独立可执行文件 (pkg)
```

输出 → `dist/supervised-learning-backend` (macOS/Linux) 或 `dist/supervised-learning-backend.exe` (Windows)

## 相关项目

- [Super Productivity](https://github.com/johannesjo/super-productivity) — 任务计划与时间盒
- [ActivityWatch](https://github.com/ActivityWatch/activitywatch) — 开源自动时间追踪器
- [Bark](https://github.com/Finb/Bark) — iOS 自定义推送
- [Server酱](https://sct.ftqq.com/) — 微信消息推送

## License

MIT
