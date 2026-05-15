import type { FastifyInstance } from "fastify";
import prisma from "../db.js";

export async function planRoutes(app: FastifyInstance) {
  // List plans
  app.get("/", async (request) => {
    const { userId } = request.query as { userId?: string };
    const where = userId ? { userId } : {};
    return prisma.plan.findMany({ where, orderBy: { createdAt: "desc" } });
  });

  // Get one plan
  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.plan.findUnique({ where: { id }, include: { sessions: true, alertConfigs: true } });
  });

  // Create plan
  app.post("/", async (request) => {
    const body = request.body as any;
    return prisma.plan.create({ data: body });
  });

  // Update plan
  app.put("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.plan.update({ where: { id }, data: body });
  });

  // Delete plan
  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    await prisma.plan.delete({ where: { id } });
    return { ok: true };
  });

  // Get today's plans
  app.get("/today/:userId", async (request) => {
    const { userId } = request.params as { userId: string };
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dateStr = today.toISOString().slice(0, 10);

    const plans = await prisma.plan.findMany({
      where: {
        userId,
        status: "active",
        OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
      },
      include: { sessions: true },
      orderBy: { startTime: "asc" },
    });

    return plans;
  });
}
