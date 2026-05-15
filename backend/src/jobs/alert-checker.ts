import cron from "node-cron";
import { runAlertCheck } from "../services/comparator.service.js";
import { autoCloseOrphanSessions } from "../services/tracking.service.js";

let started = false;

export function startAlertChecker(logger?: any) {
  if (started) return;
  started = true;

  // Run every minute: continuous plan monitoring + alert evaluation
  cron.schedule("* * * * *", async () => {
    try {
      const results = await runAlertCheck();
      if (results.length > 0 && logger) {
        for (const r of results) {
          logger.info(`Alert: [${r.type}] ${r.alert?.planTitle || "unknown"} — progress ${r.progressPct ?? "?"}%`);
        }
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

  // Morning plan preview at 07:00
  cron.schedule("0 7 * * *", async () => {
    try {
      const prisma = (await import("../db.js")).default;
      const { sendBark } = await import("../services/notification/bark.js");

      const dateStr = new Date().toISOString().slice(0, 10);
      const dayOfWeek = new Date().getDay();

      const plans = await prisma.plan.findMany({
        where: {
          status: "active",
          OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
        },
      });

      if (plans.length > 0) {
        const planList = plans.map((p) => `${p.startTime}-${p.endTime} ${p.title}`).join("\n");
        await sendBark("今日学习计划", `${plans.length} 项计划:\n${planList}`, "学习监督");
        if (logger) logger.info(`Morning preview: ${plans.length} plans for today`);
      }
    } catch (err) {
      if (logger) logger.error(err, "Morning plan preview failed");
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
            userId: user.id,
            status: "active",
            OR: [{ dayOfWeek: new Date().getDay() }, { dayOfWeek: -1, specificDate: dateStr }],
          },
        });

        const planDetails: string[] = [];
        let totalPlanned = 0;
        let totalActual = 0;

        for (const plan of plans) {
          const sessions = await prisma.trackingSession.findMany({
            where: { userId: user.id, planId: plan.id, startTime: { gte: dayStart, lt: dayEnd } },
          });
          const actual = sessions.reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;
          const pct = plan.durationMin > 0 ? Math.round((actual / plan.durationMin) * 100) : 0;
          const icon = pct >= 90 ? "✅" : pct >= 50 ? "⚠️" : "❌";
          planDetails.push(`${icon} ${plan.title}: ${Math.round(actual)}/${plan.durationMin}分钟 (${pct}%)`);
          totalPlanned += plan.durationMin;
          totalActual += actual;
        }

        const overallPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
        const stats = `## 今日学习报告 (${dateStr})\n\n${planDetails.join("\n") || "无计划"}\n\n---\n**总计**: ${Math.round(totalActual)}/${totalPlanned} 分钟 (${overallPct}%)`;

        await dispatchDailySummary(user.id, stats);
        if (logger) logger.info(`Daily summary sent for user ${user.name}`);
      }
    } catch (err) {
      if (logger) logger.error(err, "Daily summary failed");
    }
  });

  if (logger) logger.info("Alert checker cron jobs started (auto-monitoring active)");
}
