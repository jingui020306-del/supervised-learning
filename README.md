<div align="center">

<img src="https://img.shields.io/badge/Trackly-v1.0-16a34a?style=flat-square">
<img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=flat-square">
<img src="https://img.shields.io/badge/tests-22%2F22-brightgreen?style=flat-square">
<img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square">

<h1>Trackly</h1>
<h3>学习监督 · 养树激励 · 自动追踪</h3>

</div>

---

## 这是什么

学生在 iPad 上学习，系统自动追踪、比对计划、在落后时推送提醒。每完成一个任务，仪表盘上的树就长大一级。没完成？树会枯萎。

## 养树

| 养大 | 成活 | 枯萎 |
|:--:|:--:|:--:|
| ![grown](docs/screenshots/1-dashboard.png) | — | ![dead](docs/screenshots/7-dead-tree.png) |
| 完成任务 → 浇水 → 树生长 | 部分完成 → 半大树 | 0 完成 → 灰色死树 |

> 树的状态由任务完成数决定，不跟时钟走。每个任务完成即时浇一次水。

## 截图

<div align="center">

<a href="docs/screenshots/1-dashboard.png"><img src="docs/screenshots/1-dashboard.png" width="200"></a>
<a href="docs/screenshots/7-dead-tree.png"><img src="docs/screenshots/7-dead-tree.png" width="200"></a>
<a href="docs/screenshots/2-calendar.png"><img src="docs/screenshots/2-calendar.png" width="200"></a>
<a href="docs/screenshots/3-apps.png"><img src="docs/screenshots/3-apps.png" width="200"></a>

</div>

## 快速开始

```bash
cd backend && npm install
npx prisma generate && npx prisma db push
cp ../.env.example .env
npm run dev
# → http://localhost:3001/dashboard?userId=student-1
```

## 功能

- 学习计划管理 + Excel 课程表导入
- iPad 日历(iCal)联动，自动找空闲时段排任务
- 日历拖拽排程，30分/1时/2时/按天 粒度
- 打开/关闭学习 App 自动记录时长（iOS 快捷指令）
- 进度落后自动推送到学生和监督者（Bark/微信/飞书）
- 计划结束后 15 分钟未完成 → 通知监督者
- 静默时段自定义，夜间自动休眠省资源
- 9 页移动端仪表盘

## 安装

### Mac / Windows (管理端)

```bash
# 一键启动
cd backend && npm install && npx prisma generate && npx prisma db push
cp ../.env.example .env
npm run dev
# 浏览器打开 http://localhost:3001/dashboard?userId=admin
```

或打包为独立 EXE：`bash scripts/release.sh`

### iPad / iPhone (学生学习端)

1. Safari 打开 `http://服务器IP:3001/dashboard?userId=student-1`
2. 添加到主屏幕 → 像原生 App 一样使用
3. 配置快捷指令自动上报 → 见 `shortcuts/README.md`

### Android (学生学习端)

1. Chrome 打开 `http://服务器IP:3001/dashboard?userId=student-1`
2. 添加到主屏幕
3. 安装 Tasker，创建 App 打开/关闭触发器 POST 到后端

### 监督者 (手机查看)

1. Safari/Chrome 打开 `http://服务器IP:3001/dashboard?userId=student-1`
2. 查看今日进度、告警历史、周报
3. 微信关注 Server酱 接收推送通知

## API

| 端点 | 用途 |
|------|------|
| `POST /api/v1/tracking/push` | 设备上报追踪 |
| `CRUD /api/v1/plans/*` | 计划管理 |
| `POST /api/v1/excel/upload` | Excel 任务表 |
| `POST /api/v1/excel/auto-schedule` | 日历自动排程 |
| `CRUD /api/v1/goals/*` | 学习目标 |
| `GET /api/v1/dashboard/today` | 今日数据 |
| `GET/PUT /api/v1/settings` | 静默时段/粒度 |

## 技术

Fastify + TypeScript + Prisma + SQLite · gzip/brotli · 限流 · Canvas 养树

## License

MIT
