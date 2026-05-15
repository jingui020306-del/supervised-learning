import prisma from "../db.js";

/**
 * Auto-close orphaned tracking sessions (>30 min without end event).
 */
export async function autoCloseOrphanSessions() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  const orphans = await prisma.trackingSession.findMany({
    where: { endTime: null, startTime: { lt: thirtyMinAgo } },
  });

  for (const session of orphans) {
    const endTime = new Date(new Date(session.startTime).getTime() + 30 * 60 * 1000);
    const durationSec = Math.round((endTime.getTime() - new Date(session.startTime).getTime()) / 1000);

    await prisma.trackingSession.update({
      where: { id: session.id },
      data: { endTime, durationSec },
    });
  }

  return orphans.length;
}
