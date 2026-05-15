import cron from "node-cron";
import { runAlertCheck, invalidatePlanCache } from "../services/comparator.service.js";
import { autoCloseOrphanSessions } from "../services/tracking.service.js";

let started = false;

export function startAlertChecker(logger?: any) {
  if (started) return;
  started = true;

  // Alert check: every 5 minutes (not every minute — saves CPU)
  cron.schedule("*/5 * * * *", async () => {
    try {
      const results = await runAlertCheck();
      if (results.length > 0 && logger) {
        for (const r of results) {
          logger.info(`Alert: [${r.type}] ${r.plan}`);
        }
      }
    } catch (err) {
      if (logger) logger.error(err, "Alert check failed");
    }
  });

  // Plan cache refresh: every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    invalidatePlanCache();
  });

  // Orphan session cleanup: every 15 minutes (was every 5)
  cron.schedule("*/15 * * * *", async () => {
    try {
      const closed = await autoCloseOrphanSessions();
      if (closed > 0 && logger) logger.info(`Auto-closed ${closed} orphan sessions`);
    } catch (err) {
      if (logger) logger.error(err, "Orphan cleanup failed");
    }
  });

  // Morning plan preview at 07:00
  cron.schedule("0 7 * * *", async () => {
    try {
      const prisma = (await import("../db.js")).default;
      const { sendBark } = await import("../services/notification/bark.js");
      const dateStr = new Date().toISOString().slice(0, 10);
      const dayOfWeek = new Date().getDay();
      const plans = await prisma.plan.findMany({
        where: { status: "active", OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }] },
      });
      if (plans.length > 0) {
        const list = plans.map((p: any) => `${p.startTime}-${p.endTime} ${p.title}`).join("\n");
        await sendBark("今日学习计划", `${plans.length} 项:\n${list}`, "学习监督");
        if (logger) logger.info(`Morning preview: ${plans.length} plans`);
      }
    } catch (err) {
      if (logger) logger.error(err, "Morning preview failed");
    }
  });

  // Daily summary at 21:00
  cron.schedule("0 21 * * *", async () => {
    try {
      const prisma = (await import("../db.js")).default;
      const { dispatchDailySummary } = await import("../services/notification/dispatcher.js");
      const users = await prisma.user.findMany({ where: { role: "supervisor" } });
      const dateStr = new Date().toISOString().slice(0, 10);
      const dayStart = new Date(dateStr);
      const dayEnd = new Date(dateStr);
      dayEnd.setDate(dayEnd.getDate() + 1);
      for (const user of users) {
        const plans = await prisma.plan.findMany({
          where: {
            userId: user.id, status: "active",
            OR: [{ dayOfWeek: new Date().getDay() }, { dayOfWeek: -1, specificDate: dateStr }],
          },
        });
        const details: string[] = [];
        let tp = 0, ta = 0;
        for (const plan of plans) {
          const sessions = await prisma.trackingSession.findMany({
            where: { userId: user.id, planId: plan.id, startTime: { gte: dayStart, lt: dayEnd } },
          });
          const actual = sessions.reduce((s: number, sess: any) => s + (sess.durationSec || 0), 0) / 60;
          const pct = plan.durationMin > 0 ? Math.round((actual / plan.durationMin) * 100) : 0;
          details.push(`${pct >= 90 ? "✅" : pct >= 50 ? "⚠️" : "❌"} ${plan.title}: ${Math.round(actual)}/${plan.durationMin}min (${pct}%)`);
          tp += plan.durationMin; ta += actual;
        }
        const stats = `## 今日学习报告 (${dateStr})\n\n${details.join("\n") || "无计划"}\n\n---\n**总计**: ${Math.round(ta)}/${tp} 分钟 (${tp > 0 ? Math.round((ta / tp) * 100) : 0}%)`;
        await dispatchDailySummary(user.id, stats);
      }
    } catch (err) {
      if (logger) logger.error(err, "Daily summary failed");
    }
  });

  if (logger) logger.info("Cron started (optimized: 5min checks, 23-6 sleep, in-memory cache)");
}
