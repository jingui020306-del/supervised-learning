import type { FastifyInstance } from "fastify";
import prisma from "../db.js";

export async function planRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const { userId } = request.query as { userId?: string };
    const where = userId ? { userId } : {};
    return prisma.plan.findMany({ where, orderBy: { createdAt: "desc" } });
  });

  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.plan.findUnique({ where: { id }, include: { sessions: true, alertConfigs: true } });
  });

  // Create plan — auto-create default alert config
  app.post("/", async (request) => {
    const body = request.body as any;
    const plan = await prisma.plan.create({ data: body });

    // Auto-create default alert config
    const autoCheckTime = calculateAutoCheckTime(plan.startTime, plan.endTime, plan.durationMin);
    if (autoCheckTime) {
      await prisma.alertConfig.create({
        data: {
          planId: plan.id,
          userId: plan.userId,
          checkTime: autoCheckTime,
          thresholdMin: Math.round(plan.durationMin * 0.5),
          notifyStudent: true,
          notifySupervisor: true,
          supervisorChannel: "wechat",
          enabled: true,
        },
      });
    }

    return prisma.plan.findUnique({
      where: { id: plan.id },
      include: { alertConfigs: true },
    });
  });

  app.put("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return prisma.plan.update({ where: { id }, data: body });
  });

  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    // Also delete associated alert configs and tracking sessions
    await prisma.alertConfig.deleteMany({ where: { planId: id } });
    await prisma.alert.deleteMany({ where: { planId: id } });
    await prisma.plan.delete({ where: { id } });
    return { ok: true };
  });

  app.get("/today/:userId", async (request) => {
    const { userId } = request.params as { userId: string };
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dateStr = today.toISOString().slice(0, 10);

    return prisma.plan.findMany({
      where: {
        userId,
        status: "active",
        OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
      },
      include: { sessions: true },
      orderBy: { startTime: "asc" },
    });
  });
}

/**
 * Calculate a sensible default check time: roughly halfway through the plan.
 */
function calculateAutoCheckTime(startTime: string, endTime: string, durationMin: number): string | null {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (isNaN(sh) || isNaN(eh)) return null;

  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  const midTotal = Math.round(startTotal + (endTotal - startTotal) * 0.5);
  const h = Math.floor(midTotal / 60);
  const m = midTotal % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
