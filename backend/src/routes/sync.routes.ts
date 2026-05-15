import type { FastifyInstance } from "fastify";
import prisma from "../db.js";
import { syncFromSP } from "../adapters/sp-sync.js";

export async function syncRoutes(app: FastifyInstance) {
  // SP plugin sync hook
  app.post("/sp-hook", async (request) => {
    const body = request.body as any;

    if (body.event === "finish_day") {
      return { status: "ok", event: "finish_day" };
    }

    // Task sync
    if (body.tasks && Array.isArray(body.tasks)) {
      const results = await syncFromSP({
        userId: body.userId || "student-1",
        tasks: body.tasks,
      });
      return { status: "synced", count: results.length };
    }

    return { status: "ok" };
  });
}
