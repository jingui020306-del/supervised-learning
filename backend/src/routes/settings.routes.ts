import type { FastifyInstance } from "fastify";
import prisma from "../db.js";

export async function settingsRoutes(app: FastifyInstance) {
  // Get settings for a user (with defaults)
  app.get("/", async (request) => {
    const { userId } = request.query as { userId: string };
    if (!userId) return { error: "userId required" };

    let s = await prisma.setting.findUnique({ where: { userId } });
    if (!s) {
      s = await prisma.setting.create({
        data: { userId, quietStart: "23:00", quietEnd: "06:00", granularity: 60, data: "{}" },
      });
    }
    return {
      ...s,
      data: s.data ? JSON.parse(s.data) : {},
    };
  });

  // Update settings
  app.put("/", async (request) => {
    const { userId, quietStart, quietEnd, granularity, data } = request.body as any;
    if (!userId) return { error: "userId required" };

    const update: any = {};
    if (quietStart !== undefined) update.quietStart = quietStart;
    if (quietEnd !== undefined) update.quietEnd = quietEnd;
    if (granularity !== undefined) update.granularity = granularity;
    if (data !== undefined) update.data = typeof data === "string" ? data : JSON.stringify(data);

    const s = await prisma.setting.upsert({
      where: { userId },
      create: {
        userId,
        quietStart: quietStart || "23:00",
        quietEnd: quietEnd || "06:00",
        granularity: granularity || 60,
        data: data ? JSON.stringify(data) : "{}",
      },
      update,
    });

    return { ...s, data: s.data ? JSON.parse(s.data) : {} };
  });
}
