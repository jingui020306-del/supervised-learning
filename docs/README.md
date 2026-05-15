# 学习监督系统 · 文档

## 更新日志

### 2026-05-15 — 初始版本 (v1.0.0)

- 监督后端骨架搭建（Fastify + TypeScript + Prisma）
- 学习计划 CRUD API
- iPad 快捷指令追踪数据接收
- 计划 vs 实际比对引擎
- Bark / Server酱(微信) / 飞书 三通道通知
- 移动端仪表盘（今日概览）
- Super Productivity Docker 部署
- Super Productivity 插件基础框架
- ActivityWatch 桌面端适配器（可选）
- 每日汇总定时推送 (21:00)

### 2026-05-15 (下午) — 自动监控 + UI 重设计 + 灵活 App 选择

- 计划创建时自动建立默认告警配置（无需手动配置）
- 计划窗口内每分钟连续检查进度（不再依赖精确 checkTime 匹配）
- 智能防骚扰：同一计划+级别 20 分钟内不重复告警
- 计划开始前 5 分钟预提醒 + 计划结束后自动完成检查
- 每日早 7:00 推送今日学习计划预览
- 每日汇总增加每项计划的完成率详情（✅/⚠️/❌）
- 全面 UI 重设计：白色+绿色简约风格，干净现代
- App 权限管理系统：用户自由添加/移除任意 App
- 通知模板编辑器：自定义推送消息内容（支持变量占位）
- 联系人管理：添加多个通知接收人
- 6 个仪表盘页面：今日/周报/计划/App 权限/告警/通知设置
- 一键打包脚本 `scripts/release.sh` 生成跨平台可执行文件 (macOS/Windows/Linux)

### 2026-05-15 (晚间) — 运行时修复 + Excel/日历联动 + 回归测试

- 修复外键约束错误：Plan/TrackingSession/AppPermission 创建时自动 seed User
- Alert 表 configId 改为可选，支持无配置的自动告警
- 修复静态文件 404：CSS 改为 /static/ 路径服务
- Excel 上传 API：POST /api/v1/excel/upload 解析 .xlsx 提取任务
- Excel + 日历自动排程：POST /api/v1/excel/auto-schedule 读取 iPad 日历空闲时段自动安排任务
- iCal/CalDAV 日历解析：支持 iPad 日历共享链接，自动避开已有事件
- 贪心算法将任务分配至空闲时段，返回已排程/未排程结果
- 完整回归测试：24 项 API 全部通过 (200)

### 2026-05-15 (深夜) — CPU 优化 + 目标系统 + 日历拖拽 + 静默时段

- 后端 CPU 优化：@fastify/compress (gzip/brotli 压缩)、@fastify/rate-limit (100req/min 限流)
- SQLite 单连接策略避免写锁争用，告警频率降至每5分钟
- 静默时段用户可配置：/dashboard/settings 前端设置免打扰时间
- Health 端点新增 uptime + heap 内存监控
- 学习目标系统：/api/v1/goals CRUD + 进度追踪（日/周目标）
- /dashboard/goals 目标页面，含进度条
- 课程表 Excel 解析：POST /api/v1/excel/course-schedule (网格格式)
- 拖拽日历排程：/dashboard/calendar 任务拖入空格自动安排
- 追踪粒度选择：30分钟/1小时/2小时/按天
- 系统设置页面：/dashboard/settings (静默时段+粒度)
- 仪表盘扩展至 9 页 (新增日历/目标/设置)
- 完整回归测试：32 项全部通过 (200)
