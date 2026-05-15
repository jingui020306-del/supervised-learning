import cron from "node-cron";
import { runAlertCheck } from "../services/comparator.service.js";
import { autoCloseOrphanSessions } from "../services/tracking.service.js";

let started = false;

export function startAlertChecker(logger?: any) {
  if (started) return;
  started = true;

  // Run every minute for alert checks
  cron.schedule("* * * * *", async () => {
    try {
      const results = await runAlertCheck();
      if (results.length > 0 && logger) {
        logger.info(`Alert check: ${results.length} alerts triggered`);
      }
    } catch (err) {
      if (logger) logger.error(err, "Alert check failed");
    }
  });

  // Auto-close orphan sessions every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const closed = await autoCloseOrphanSessions();
      if (closed > 0 && logger) {
        logger.info(`Auto-closed ${closed} orphan tracking sessions`);
      }
    } catch (err) {
      if (logger) logger.error(err, "Orphan session cleanup failed");
    }
  });

  // Daily summary at 21:00
  cron.schedule("0 21 * * *", async () => {
    try {
      const prisma = (await import("../db.js")).default;
      const { dispatchDailySummary } = await import("../services/notification/dispatcher.js");

      const users = await prisma.user.findMany({ where: { role: "supervisor" } });
      for (const user of users) {
        const dateStr = new Date().toISOString().slice(0, 10);
        const dayStart = new Date(dateStr);
        const dayEnd = new Date(dateStr);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const sessions = await prisma.trackingSession.findMany({
          where: { startTime: { gte: dayStart, lt: dayEnd } },
          include: { plan: true },
        });

        const totalMin = sessions.reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;
        const matchedMin = sessions.filter((s) => s.matched).reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;
        const appCount = new Set(sessions.map((s) => s.appName)).size;

        const stats = `## 今日学习报告 (${dateStr})\n\n- 追踪应用数：${appCount}\n- 总学习时长：${Math.round(totalMin)} 分钟\n- 匹配计划时长：${Math.round(matchedMin)} 分钟\n- 记录条数：${sessions.length}`;

        await dispatchDailySummary("wechat", stats);
      }
    } catch (err) {
      if (logger) logger.error(err, "Daily summary failed");
    }
  });

  if (logger) logger.info("Alert checker cron jobs started");
}
