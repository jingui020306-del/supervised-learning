import type { FastifyInstance } from "fastify";
import prisma from "../db.js";
import { matchSessionToPlan } from "../services/comparator.service.js";

export async function trackingRoutes(app: FastifyInstance) {
  // iPad Shortcuts: push tracking event
  app.post("/push", async (request) => {
    const { userId, action, appName, timestamp } = request.body as {
      userId: string;
      action: "start" | "end";
      appName: string;
      timestamp: string;
    };

    const ts = new Date(timestamp);

    if (action === "start") {
      // Check for orphaned open sessions (timeout > 30 min)
      const orphanSession = await prisma.trackingSession.findFirst({
        where: { userId, appName, endTime: null },
        orderBy: { startTime: "desc" },
      });
      if (orphanSession) {
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
        const orphanStart = new Date(orphanSession.startTime);
        if (orphanStart < thirtyMinAgo) {
          await prisma.trackingSession.update({
            where: { id: orphanSession.id },
            data: { endTime: new Date(Math.min(orphanStart.getTime() + 30 * 60 * 1000, Date.now())) },
          });
        }
      }

      const session = await prisma.trackingSession.create({
        data: { userId, appName, source: "ipad_shortcut", startTime: ts },
      });
      return { status: "started", sessionId: session.id };
    }

    // action === "end"
    const activeSession = await prisma.trackingSession.findFirst({
      where: { userId, appName, endTime: null },
      orderBy: { startTime: "desc" },
    });

    if (!activeSession) {
      // No open session — create a standalone record
      const session = await prisma.trackingSession.create({
        data: { userId, appName, source: "ipad_shortcut", startTime: ts, endTime: ts },
      });
      return { status: "recorded", sessionId: session.id };
    }

    const endTime = ts;
    const durationSec = Math.round((endTime.getTime() - new Date(activeSession.startTime).getTime()) / 1000);

    await prisma.trackingSession.update({
      where: { id: activeSession.id },
      data: { endTime, durationSec },
    });

    // Auto-match to plan
    await matchSessionToPlan(activeSession.id);

    return { status: "ended", sessionId: activeSession.id, durationSec };
  });

  // Query tracking sessions
  app.get("/sessions", async (request) => {
    const { userId, planId, date } = request.query as { userId?: string; planId?: string; date?: string };
    const where: any = {};
    if (userId) where.userId = userId;
    if (planId) where.planId = planId;
    if (date) {
      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.startTime = { gte: dayStart, lt: dayEnd };
    }
    return prisma.trackingSession.findMany({ where, orderBy: { startTime: "desc" }, include: { plan: true } });
  });

  // Manual time log
  app.post("/manual", async (request) => {
    const body = request.body as any;
    const session = await prisma.trackingSession.create({
      data: { ...body, source: body.source || "manual_student" },
    });
    await matchSessionToPlan(session.id);
    return session;
  });

  // Supervisor override
  app.put("/sessions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const session = await prisma.trackingSession.update({ where: { id }, data: body });
    if (body.planId !== undefined || body.startTime || body.endTime) {
      await matchSessionToPlan(id);
    }
    return session;
  });
}
