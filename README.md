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

## 各设备使用方法

### 部署后端（Mac / Windows / Linux 任选一台）

电脑上启动后端服务，iPad/手机通过局域网或公网访问。

**方式 A — 源码启动**
```bash
cd backend && npm install
npx prisma generate && npx prisma db push
cp ../.env.example .env   # 编辑填入 Bark Key 等
npm run dev               # → http://localhost:3001
```

**方式 B — 独立 EXE（无需装 Node.js）**
```bash
bash scripts/release.sh   # 生成 supervised-learning-macos / -win.exe / -linux
# 双击运行即可
```

**方式 C — Docker**
```bash
docker compose up -d      # 后端 + Super Productivity 一起启动
```

### iPad / iPhone（学生学习端）

| 步骤 | 操作 |
|------|------|
| 1 | Safari 打开 `http://服务器IP:3001/dashboard?userId=student-1` |
| 2 | 点分享 → 添加到主屏幕 → 像原生 App |
| 3 | 打开系统「快捷指令」App |
| 4 | 自动化 → 创建个人自动化 → App → 选学习 App → 已打开 |
| 5 | 添加动作「获取 URL 内容」→ POST `http://服务器IP:3001/api/v1/tracking/push` |
| 6 | Body: `{"userId":"student-1","action":"start","appName":"新东方","timestamp":"当前日期"}` |
| 7 | 再创建一个「已关闭」的自动化，action 改为 `"end"` |
| 8 | 每个学习 App 重复步骤 4-7 |

安装 **Bark** App 接收推送：App Store 搜 Bark → 安装 → 复制 DeviceKey 填入 `.env`

### Android（学生学习端）

| 步骤 | 操作 |
|------|------|
| 1 | Chrome 打开 `http://服务器IP:3001/dashboard?userId=student-1` |
| 2 | 添加到主屏幕 |
| 3 | 安装 Tasker 或 Macrodroid |
| 4 | 创建触发器：App 打开/关闭 → HTTP Request POST 到后端 |
| 5 | Body 同上，`action` 用 `"start"` / `"end"` |

### 监督者（家长手机查看）

| 步骤 | 操作 |
|------|------|
| 1 | 手机浏览器打开 `http://服务器IP:3001/dashboard?userId=student-1` |
| 2 | 查看今日进度、周报、告警历史 |
| 3 | 打开 sct.ftqq.com 微信扫码 → 获取 SendKey |
| 4 | 在推送页面填入 SendKey → 接收 15 分钟未完成通知 |
| 5 | 或配置飞书群机器人 Webhook |

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
