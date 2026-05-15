import prisma from "../db.js";

/**
 * Receive task sync from Super Productivity plugin.
 * Accepts task data and converts to Plan records.
 */
export async function syncFromSP(payload: {
  userId: string;
  tasks: Array<{
    id: string;
    title: string;
    timeEstimate?: number;
    tagIds?: string[];
    isDone?: boolean;
  }>;
}) {
  const results = [];

  for (const task of payload.tasks) {
    const existing = await prisma.plan.findFirst({
      where: { spTaskId: task.id, userId: payload.userId },
    });

    if (existing) {
      const updated = await prisma.plan.update({
        where: { id: existing.id },
        data: {
          title: task.title,
          durationMin: task.timeEstimate ? Math.round(task.timeEstimate / 60000) : existing.durationMin,
          status: task.isDone ? "archived" : existing.status,
        },
      });
      results.push(updated);
    } else if (!task.isDone) {
      const created = await prisma.plan.create({
        data: {
          userId: payload.userId,
          spTaskId: task.id,
          title: task.title,
          durationMin: task.timeEstimate ? Math.round(task.timeEstimate / 60000) : 30,
          startTime: "09:00",
          endTime: "10:00",
          status: "active",
        },
      });
      results.push(created);
    }
  }

  return results;
}
