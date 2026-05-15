import type { FastifyInstance } from "fastify";
import prisma from "../db.js";
import { ensureUser } from "../services/user.service.js";

export async function goalRoutes(app: FastifyInstance) {
  // List goals
  app.get("/", async (request) => {
    const { userId } = request.query as { userId?: string };
    return prisma.goal.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: "desc" },
    });
  });

  // Create goal
  app.post("/", async (request) => {
    const body = request.body as any;
    await ensureUser(body.userId);
    return prisma.goal.create({ data: body });
  });

  // Update goal
  app.put("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.goal.update({ where: { id }, data: request.body as any });
  });

  // Delete goal
  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    await prisma.goal.delete({ where: { id } });
    return { ok: true };
  });

  // Goal progress — for a given goal, show this week/daily progress
  app.get("/progress", async (request) => {
    const { userId, goalId } = request.query as { userId: string; goalId?: string };

    const goals = goalId
      ? [await prisma.goal.findUnique({ where: { id: goalId } })].filter(Boolean)
      : await prisma.goal.findMany({ where: { userId, status: "active" } });

    const enriched = [];
    for (const goal of goals) {
      if (!goal) continue;

      // Determine date range
      let rangeStart: Date, rangeEnd: Date;
      const now = new Date();

      if (goal.period === "daily") {
        rangeStart = new Date(now.toISOString().slice(0, 10));
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + 1);
      } else {
        // weekly: Monday to now
        rangeStart = new Date(now);
        rangeStart.setDate(rangeStart.getDate() - ((now.getDay() + 6) % 7));
        rangeStart = new Date(rangeStart.toISOString().slice(0, 10));
        rangeEnd = now;
      }

      const sessions = await prisma.trackingSession.findMany({
        where: { userId, startTime: { gte: rangeStart, lt: rangeEnd } },
      });
      const totalMin = sessions.reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;
      const pct = goal.targetMin > 0 ? Math.round((totalMin / goal.targetMin) * 100) : 0;

      enriched.push({
        id: goal.id,
        title: goal.title,
        period: goal.period,
        targetMin: goal.targetMin,
        currentMin: Math.round(totalMin),
        progress: pct,
        status: goal.targetMin > 0 && totalMin >= goal.targetMin ? "completed" : "in_progress",
      });
    }

    return enriched;
  });
}
