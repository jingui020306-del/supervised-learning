import prisma from "../db.js";

/**
 * Match a tracking session to a plan based on appName + time window overlap.
 */
export async function matchSessionToPlan(sessionId: string) {
  const session = await prisma.trackingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || !session.endTime) return null;

  const sessionStart = session.startTime;
  const sessionEnd = session.endTime;
  const dayOfWeek = sessionStart.getDay();
  const dateStr = sessionStart.toISOString().slice(0, 10);

  // Find candidate plans
  const plans = await prisma.plan.findMany({
    where: {
      userId: session.userId,
      status: "active",
      OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
    },
  });

  let bestPlan: typeof plans[0] | null = null;
  let bestScore = 0;

  for (const plan of plans) {
    const [sh, sm] = plan.startTime.split(":").map(Number);
    const [eh, em] = plan.endTime.split(":").map(Number);
    const planStart = new Date(sessionStart);
    planStart.setHours(sh, sm, 0, 0);
    const planEnd = new Date(sessionStart);
    planEnd.setHours(eh, em, 0, 0);

    // Check time overlap
    const overlapStart = new Date(Math.max(sessionStart.getTime(), planStart.getTime()));
    const overlapEnd = new Date(Math.min(sessionEnd.getTime(), planEnd.getTime()));
    const overlapMin = (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
    if (overlapMin <= 0) continue;

    let score = overlapMin;

    // Bonus for app name match
    if (plan.appName && session.appName) {
      if (plan.appName === session.appName) {
        score += 1000;
      } else if (session.appName.includes(plan.appName) || plan.appName.includes(session.appName)) {
        score += 500;
      }
    } else if (!plan.appName) {
      // Plan without app restriction — time-only match, lower priority
      score += 200;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPlan = plan;
    }
  }

  if (bestPlan) {
    await prisma.trackingSession.update({
      where: { id: sessionId },
      data: { planId: bestPlan.id, matched: true },
    });
    return bestPlan;
  }

  return null;
}

/**
 * Check all enabled alert configs and trigger alerts if behind schedule.
 */
export async function runAlertCheck() {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const configs = await prisma.alertConfig.findMany({
    where: { enabled: true, checkTime: timeStr },
    include: { plan: true, user: true },
  });

  const results = [];

  for (const cfg of configs) {
    // Get today's tracked time for this plan
    const dateStr = now.toISOString().slice(0, 10);
    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const sessions = await prisma.trackingSession.findMany({
      where: {
        userId: cfg.userId,
        planId: cfg.planId,
        startTime: { gte: dayStart, lt: dayEnd },
      },
    });

    const actualMin = sessions.reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;
    const plannedMin = cfg.plan.durationMin;

    // Parse plan time window
    const [sh, sm] = cfg.plan.startTime.split(":").map(Number);
    const [eh, em] = cfg.plan.endTime.split(":").map(Number);
    const planStart = new Date(now);
    planStart.setHours(sh, sm, 0, 0);
    const planEnd = new Date(now);
    planEnd.setHours(eh, em, 0, 0);

    const elapsedRatio = Math.min(1, Math.max(0,
      (now.getTime() - planStart.getTime()) / (planEnd.getTime() - planStart.getTime())
    ));
    const expectedMin = plannedMin * elapsedRatio;
    const deficitMin = Math.round(expectedMin - actualMin);

    let level: "behind" | "critical" | "incomplete" | null = null;

    if (now > planEnd && actualMin < plannedMin * 0.9) {
      level = "incomplete";
    } else if (actualMin < expectedMin * 0.3) {
      level = "critical";
    } else if (actualMin < expectedMin * 0.7) {
      level = "behind";
    }

    if (level) {
      const alert = await prisma.alert.create({
        data: {
          configId: cfg.id,
          userId: cfg.userId,
          planId: cfg.planId,
          planTitle: cfg.plan.title,
          checkTime: timeStr,
          plannedMin,
          actualMin: Math.round(actualMin),
          deficitMin,
          status: "sent",
        },
      });

      // Dispatch notifications
      const { dispatchAlert } = await import("./notification/dispatcher.js");
      const notifyResults = await dispatchAlert({
        level,
        planTitle: cfg.plan.title,
        plannedMin,
        actualMin: Math.round(actualMin),
        deficitMin,
        notifyStudent: cfg.notifyStudent,
        notifySupervisor: cfg.notifySupervisor,
        supervisorChannel: cfg.supervisorChannel,
      });

      results.push({ alert, notifications: notifyResults });
    }
  }

  return results;
}
