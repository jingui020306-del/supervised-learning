import type { FastifyInstance } from "fastify";
import prisma from "../db.js";

export async function dashboardRoutes(app: FastifyInstance) {
  // Today's overview
  app.get("/today", async (request) => {
    const { userId } = request.query as { userId: string };
    if (!userId) return { error: "userId required" };

    const today = new Date();
    const dayOfWeek = today.getDay();
    const dateStr = today.toISOString().slice(0, 10);
    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const plans = await prisma.plan.findMany({
      where: {
        userId,
        status: "active",
        OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
      },
      include: {
        sessions: {
          where: { startTime: { gte: dayStart, lt: dayEnd } },
        },
        alertConfigs: true,
      },
      orderBy: { startTime: "asc" },
    });

    const enriched = plans.map((plan) => {
      const actualMin = plan.sessions.reduce(
        (sum, s) => sum + (s.durationSec || 0),
        0
      ) / 60;
      return {
        id: plan.id,
        title: plan.title,
        appName: plan.appName,
        startTime: plan.startTime,
        endTime: plan.endTime,
        plannedMin: plan.durationMin,
        actualMin: Math.round(actualMin),
        progress: plan.durationMin > 0 ? Math.round((actualMin / plan.durationMin) * 100) : 0,
        sessions: plan.sessions,
        hasAlert: plan.alertConfigs.length > 0,
      };
    });

    const totalPlanned = plans.reduce((s, p) => s + p.durationMin, 0);
    const totalActual = enriched.reduce((s, p) => s + p.actualMin, 0);

    return {
      date: dateStr,
      dayOfWeek,
      plans: enriched,
      summary: {
        totalPlanned,
        totalActual,
        completionRate: totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0,
      },
    };
  });

  // Weekly summary
  app.get("/weekly", async (request) => {
    const { userId } = request.query as { userId: string };
    if (!userId) return { error: "userId required" };

    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayStart = new Date(dateStr);
      const dayEnd = new Date(dateStr);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const sessions = await prisma.trackingSession.findMany({
        where: { userId, startTime: { gte: dayStart, lt: dayEnd } },
        include: { plan: true },
      });

      const totalMin = sessions.reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;
      const matchedMin = sessions.filter((s) => s.matched).reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;

      days.push({
        date: dateStr,
        dayOfWeek: d.getDay(),
        totalSessions: sessions.length,
        totalMin: Math.round(totalMin),
        matchedMin: Math.round(matchedMin),
        apps: [...new Set(sessions.map((s) => s.appName))],
      });
    }

    return { days };
  });

  // Summary stats
  app.get("/summary", async (request) => {
    const { userId } = request.query as { userId: string };
    if (!userId) return { error: "userId required" };

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const [totalPlans, activePlans, recentSessions, recentAlerts] = await Promise.all([
      prisma.plan.count({ where: { userId } }),
      prisma.plan.count({ where: { userId, status: "active" } }),
      prisma.trackingSession.count({ where: { userId, startTime: { gte: weekStart } } }),
      prisma.alert.count({ where: { userId, createdAt: { gte: weekStart } } }),
    ]);

    const weeklySessions = await prisma.trackingSession.findMany({
      where: { userId, startTime: { gte: weekStart } },
    });
    const totalTrackedMin = weeklySessions.reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;

    return {
      totalPlans,
      activePlans,
      weeklySessions: recentSessions,
      weeklyTrackedMin: Math.round(totalTrackedMin),
      weeklyAlerts: recentAlerts,
    };
  });
}
