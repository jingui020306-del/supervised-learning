<div align="center">

<img src="https://img.shields.io/badge/status-active-success?style=flat-square" alt="Status">
<img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
<img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat-square" alt="Node">
<img src="https://img.shields.io/badge/platform-iPad%20%7C%20Mac%20%7C%20Windows%20%7C%20Web-lightgrey?style=flat-square" alt="Platform">
<img src="https://img.shields.io/badge/tests-32%2F32-brightgreen?style=flat-square" alt="Tests">

</div>

<h1 align="center">Supervised Learning</h1>

<p align="center">
  <strong>学习监督系统</strong><br>
  计划 · 追踪 · 比对 · 告警 · 日历排程 · 目标管理
</p>

<p align="center">
  <sub>基于 Super Productivity 和 ActivityWatch 的二开项目</sub>
</p>

---

## 这是什么？

一个面向**学生和家长**的学习监督系统。

学生在 iPad 上使用学习 App，系统自动追踪学习时长，比对学习计划，在任务未完成时发送提醒通知。支持 Excel 课程表导入、拖拽日历排程、学习目标管理。

### 核心能力

- **计划管理** — 制定每日/每周学习计划，设定时间框和目标时长
- **自动追踪** — iPad 打开/关闭学习 App 时自动记录（iOS 快捷指令）
- **Excel 导入** — 上传 Excel 任务表或课程表，自动解析排程
- **日历联动** — 读取 iPad 日历(iCal)，自动找到空闲时段安排任务
- **拖拽排程** — `/dashboard/calendar` 拖任务到日历空格，支持 30分/1时/2时/按天 粒度
- **智能比对** — 实时比较计划 vs 实际，量化学习进度
- **多通道告警** — 进度落后时，Bark 推送提醒学生，微信/飞书通知监督者
- **目标追踪** — 设定日/周学习目标，自动统计完成进度
- **移动仪表盘** — 9 个移动端页面：今日/周报/计划/日历/App管理/告警/通知/目标/设置
- **静默时段** — 用户自定义免打扰时间，节省系统资源

## 架构

```
学生 iPad (学习App + Bark)
     │
     │ 快捷指令自动上报
     ▼
监督后端 (Fastify + SQLite) ← Super Productivity (计划端)
     │                         ← iPad 日历 (iCal)
     │                         ← Excel 课程表
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

后端运行在 `http://localhost:3001`，仪表盘在 `http://localhost:3001/dashboard?userId=student-1`

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
├── backend/
│   ├── src/
│   │   ├── server.ts              # Fastify 服务器 (压缩+限流)
│   │   ├── routes/                # 11 组 API 路由
│   │   │   ├── plan.routes.ts     # 计划 CRUD
│   │   │   ├── tracking.routes.ts # 追踪上报
│   │   │   ├── alert.routes.ts    # 告警配置/历史
│   │   │   ├── dashboard.routes.ts# 仪表盘数据
│   │   │   ├── excel.routes.ts    # Excel 上传+课程表
│   │   │   ├── goal.routes.ts     # 学习目标
│   │   │   ├── settings.routes.ts # 系统设置
│   │   │   ├── app-permission.routes.ts
│   │   │   ├── sync.routes.ts     # SP 插件同步
│   │   │   └── view.routes.ts     # 9 个 SSR 页面
│   │   ├── services/
│   │   │   ├── comparator.service.ts   # 计划 vs 实际比对引擎
│   │   │   ├── calendar.service.ts     # iCal 日历解析+排程算法
│   │   │   ├── course-schedule.service.ts # 课程表 Excel 解析
│   │   │   ├── tracking.service.ts     # 追踪会话管理
│   │   │   ├── user.service.ts         # 用户自动创建
│   │   │   └── notification/           # Bark/微信/飞书 通知分发
│   │   ├── jobs/
│   │   │   └── alert-checker.ts        # 定时任务 (5min间隔, 静默时段)
│   │   ├── adapters/                   # ActivityWatch / SP 适配器
│   │   ├── views/
│   │   │   ├── dashboard/              # 9 个 SSR 仪表盘页面
│   │   │   └── partials/               # 设计系统 CSS
│   │   ├── lib/api.ts                  # 前端 API 客户端
│   │   └── logger.ts                   # 日志系统
│   ├── prisma/schema.prisma            # 7 个数据模型
│   └── Dockerfile
├── sp-plugin/                  # Super Productivity 插件
├── shortcuts/                  # iPad 快捷指令配置
├── scripts/release.sh          # 一键打包脚本
├── docs/                       # 更新日志
├── docker-compose.yml
└── .env.example
```

## API 概览

| 分类 | 端点 | 用途 |
|------|------|------|
| 追踪 | `POST /api/v1/tracking/push` | iPad 快捷指令上报 |
| 计划 | `CRUD /api/v1/plans/*` | 计划管理 |
| | `GET /api/v1/plans/today/:userId` | 今日计划 |
| 告警 | `CRUD /api/v1/alerts/config/*` | 告警规则 |
| | `GET /api/v1/alerts/history` | 告警历史 |
| 仪表盘 | `GET /api/v1/dashboard/today` | 今日概览 |
| | `GET /api/v1/dashboard/weekly` | 周汇总 |
| Excel | `POST /api/v1/excel/upload` | 上传任务表 |
| | `POST /api/v1/excel/auto-schedule` | 日历自动排程 |
| | `POST /api/v1/excel/course-schedule` | 课程表解析 |
| 目标 | `CRUD /api/v1/goals/*` | 目标管理 |
| | `GET /api/v1/goals/progress` | 目标进度 |
| App | `GET/PUT /api/v1/apps/*` | App 权限管理 |
| 设置 | `GET/PUT /api/v1/settings` | 静默时段/粒度 |
| 系统 | `GET /health` | 健康检查 (uptime+内存) |

## 仪表盘页面

| 路由 | 功能 |
|------|------|
| `/dashboard` | 今日概览 — 计划vs实际卡片+进度条 |
| `/dashboard/weekly` | 周报 — 7天学习时长统计 |
| `/dashboard/plans` | 计划管理 — 快速创建+列表 |
| `/dashboard/calendar` | 日历排程 — 拖拽任务到空格 |
| `/dashboard/apps` | App 权限 — 添加/开关任意 App |
| `/dashboard/alerts` | 告警历史 — 确认/解决 |
| `/dashboard/notify` | 通知设置 — 模板编辑+联系人 |
| `/dashboard/goals` | 学习目标 — 进度条追踪 |
| `/dashboard/settings` | 系统设置 — 静默时段+粒度 |

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
| 数据库 | SQLite + Prisma (7 模型) |
| 模板 | Eta (服务端渲染，移动优先) |
| 优化 | gzip/brotli 压缩 + 限流 + 内存缓存 |
| 容器化 | Docker + Docker Compose |
| 计划端 | Super Productivity (Angular + Electron) |
| 桌面追踪 | ActivityWatch (Python) |
| 打包 | pkg → 独立可执行文件 |

## 一键打包

```bash
# 编译 + 打包
npm run build
npm run package

# 或使用发布脚本
bash scripts/release.sh
```

输出：
- `release/supervised-learning-macos` (macOS)
- `release/supervised-learning-win.exe` (Windows)
- `release/supervised-learning-linux` (Linux)

无需安装 Node.js，双击即可运行。

## 相关项目

- [Super Productivity](https://github.com/johannesjo/super-productivity) — 任务计划与时间盒
- [ActivityWatch](https://github.com/ActivityWatch/activitywatch) — 开源自动时间追踪器
- [Bark](https://github.com/Finb/Bark) — iOS 自定义推送
- [Server酱](https://sct.ftqq.com/) — 微信消息推送

## License

MIT
