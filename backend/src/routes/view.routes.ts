import type { FastifyInstance } from "fastify";
import prisma from "../db.js";

export async function viewRoutes(app: FastifyInstance) {
  // Today dashboard (SSR)
  app.get("/", async (request, reply) => {
    const { userId } = request.query as { userId: string };
    const { lanIp, port } = (reply as any).locals || {};
    if (!userId) {
      return reply.view("dashboard/today.eta", {
        date: new Date().toISOString().slice(0, 10),
        plans: [],
        summary: { totalPlanned: 0, totalActual: 0, completionRate: 0 },
        lanIp, port,
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
      lanIp, port,
    });
  });

  function locals(reply: any) {
    const { lanIp, port } = reply.locals || {};
    return { lanIp, port };
  }

  // Weekly view — static page with JS fetch
  app.get("/weekly", async (_request, reply) => {
    return reply.view("dashboard/weekly.eta", locals(reply));
  });

  // Plans management — static page with JS fetch
  app.get("/plans", async (_request, reply) => {
    return reply.view("dashboard/plans.eta", locals(reply));
  });

  // App permissions manager
  app.get("/apps", async (_request, reply) => {
    return reply.view("dashboard/apps.eta", locals(reply));
  });

  // Alert history
  app.get("/alerts", async (_request, reply) => {
    return reply.view("dashboard/alerts.eta", locals(reply));
  });

  // Notification settings
  app.get("/notify", async (_request, reply) => {
    return reply.view("dashboard/notify.eta", locals(reply));
  });

  // Calendar (drag-and-drop scheduling)
  app.get("/calendar", async (_request, reply) => {
    return reply.view("dashboard/calendar.eta", locals(reply));
  });

  // Goals
  app.get("/goals", async (_request, reply) => {
    return reply.view("dashboard/goals.eta", locals(reply));
  });

  // Settings
  app.get("/settings", async (_request, reply) => {
    return reply.view("dashboard/settings.eta", locals(reply));
  });
}
