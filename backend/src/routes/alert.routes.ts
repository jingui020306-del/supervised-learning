import type { FastifyInstance } from "fastify";
import prisma from "../db.js";

export async function alertRoutes(app: FastifyInstance) {
  // List alert configs
  app.get("/config", async (request) => {
    const { userId, planId } = request.query as { userId?: string; planId?: string };
    const where: any = {};
    if (userId) where.userId = userId;
    if (planId) where.planId = planId;
    return prisma.alertConfig.findMany({ where, include: { plan: true } });
  });

  // Create alert config
  app.post("/config", async (request) => {
    const body = request.body as any;
    return prisma.alertConfig.create({ data: body });
  });

  // Update alert config
  app.put("/config/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.alertConfig.update({ where: { id }, data: body });
  });

  // Delete alert config
  app.delete("/config/:id", async (request) => {
    const { id } = request.params as { id: string };
    await prisma.alertConfig.delete({ where: { id } });
    return { ok: true };
  });

  // Alert history
  app.get("/history", async (request) => {
    const { userId, status, limit } = request.query as { userId?: string; status?: string; limit?: string };
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    return prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit, 10) : 50,
      include: { plan: true },
    });
  });

  // Acknowledge alert
  app.post("/:id/acknowledge", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.alert.update({
      where: { id },
      data: { status: "acknowledged", acknowledgedAt: new Date() },
    });
  });

  // Resolve alert
  app.post("/:id/resolve", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.alert.update({
      where: { id },
      data: { status: "resolved", resolvedAt: new Date() },
    });
  });
}
