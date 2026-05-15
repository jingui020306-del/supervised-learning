import type { FastifyInstance } from "fastify";
import prisma from "../db.js";

export async function viewRoutes(app: FastifyInstance) {
  // Today dashboard (SSR)
  app.get("/", async (request, reply) => {
    const { userId } = request.query as { userId: string };
    if (!userId) {
      return reply.view("dashboard/today.eta", {
        date: new Date().toISOString().slice(0, 10),
        plans: [],
        summary: { totalPlanned: 0, totalActual: 0, completionRate: 0 },
      });
    }

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
        sessions: { where: { startTime: { gte: dayStart, lt: dayEnd } } },
      },
      orderBy: { startTime: "asc" },
    });

    const enriched = plans.map((plan) => {
      const actualMin = plan.sessions.reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;
      return {
        ...plan,
        actualMin: Math.round(actualMin),
        progress: plan.durationMin > 0 ? Math.round((actualMin / plan.durationMin) * 100) : 0,
      };
    });

    const totalPlanned = plans.reduce((s, p) => s + p.durationMin, 0);
    const totalActual = enriched.reduce((s, p) => s + p.actualMin, 0);

    return reply.view("dashboard/today.eta", {
      date: dateStr,
      plans: enriched,
      summary: {
        totalPlanned,
        totalActual,
        completionRate: totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0,
      },
    });
  });

  // Weekly view — static page with JS fetch
  app.get("/weekly", async (_request, reply) => {
    return reply.view("dashboard/weekly.eta", {});
  });

  // Plans management — static page with JS fetch
  app.get("/plans", async (_request, reply) => {
    return reply.view("dashboard/plans.eta", {});
  });

  // App permissions manager
  app.get("/apps", async (_request, reply) => {
    return reply.view("dashboard/apps.eta", {});
  });

  // Alert history
  app.get("/alerts", async (_request, reply) => {
    return reply.view("dashboard/alerts.eta", {});
  });

  // Notification settings
  app.get("/notify", async (_request, reply) => {
    return reply.view("dashboard/notify.eta", {});
  });
}
