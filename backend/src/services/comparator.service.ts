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

  const plans = await prisma.plan.findMany({
    where: {
      userId: session.userId,
      status: "active",
      OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
    },
  });

  let bestPlan: (typeof plans)[0] | null = null;
  let bestScore = 0;

  for (const plan of plans) {
    const [sh, sm] = plan.startTime.split(":").map(Number);
    const [eh, em] = plan.endTime.split(":").map(Number);
    const planStart = new Date(sessionStart);
    planStart.setHours(sh, sm, 0, 0);
    const planEnd = new Date(sessionStart);
    planEnd.setHours(eh, em, 0, 0);

    const overlapStart = new Date(Math.max(sessionStart.getTime(), planStart.getTime()));
    const overlapEnd = new Date(Math.min(sessionEnd.getTime(), planEnd.getTime()));
    const overlapMin = (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
    if (overlapMin <= 0) continue;

    let score = overlapMin;

    if (plan.appName && session.appName) {
      if (plan.appName === session.appName) {
        score += 1000;
      } else if (session.appName.includes(plan.appName) || plan.appName.includes(session.appName)) {
        score += 500;
      }
    } else if (!plan.appName) {
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
 * Get today's actual minutes for a plan.
 */
async function getTodayActualMin(planId: string, userId: string) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(dateStr);
  const dayEnd = new Date(dateStr);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const sessions = await prisma.trackingSession.findMany({
    where: { userId, planId, startTime: { gte: dayStart, lt: dayEnd } },
  });
  return sessions.reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;
}

/**
 * Main alert check — runs every minute.
 * Instead of exact checkTime matching, it evaluates ALL active plans
 * that are within or near their scheduled window.
 */
export async function runAlertCheck() {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const dateStr = now.toISOString().slice(0, 10);
  const dayOfWeek = now.getDay();

  // Get all active plans scheduled for today
  const plans = await prisma.plan.findMany({
    where: {
      status: "active",
      OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
    },
    include: { alertConfigs: true, user: true },
  });

  const results: any[] = [];

  for (const plan of plans) {
    const plannedMin = plan.durationMin;
    const [sh, sm] = plan.startTime.split(":").map(Number);
    const [eh, em] = plan.endTime.split(":").map(Number);
    const planStart = new Date(now);
    planStart.setHours(sh, sm, 0, 0);
    const planEnd = new Date(now);
    planEnd.setHours(eh, em, 0, 0);

    // 1. Pre-start reminder (5 min before plan start)
    const fiveMinBefore = new Date(planStart.getTime() - 5 * 60 * 1000);
    if (now >= fiveMinBefore && now < planStart) {
      const alreadyReminded = await prisma.alert.findFirst({
        where: { planId: plan.id, checkTime: timeStr, status: "sent" },
      });
      if (!alreadyReminded) {
        const alert = await prisma.alert.create({
          data: {
            configId: plan.alertConfigs[0]?.id || null,
            userId: plan.userId,
            planId: plan.id,
            planTitle: plan.title,
            checkTime: timeStr,
            plannedMin,
            actualMin: 0,
            deficitMin: plannedMin,
            status: "sent",
          },
        });

        const { dispatchAlert } = await import("./notification/dispatcher.js");
        await dispatchAlert({
          level: "behind",
          planTitle: `⏰ ${plan.title} 即将开始`,
          plannedMin,
          actualMin: 0,
          deficitMin: plannedMin,
          notifyStudent: true,
          notifySupervisor: false,
          supervisorChannel: plan.alertConfigs[0]?.supervisorChannel || "wechat",
        });

        results.push({ alert, type: "pre_start" });
      }
    }

    // 2. During the plan window — check progress
    if (now >= planStart && now <= planEnd) {
      const actualMin = await getTodayActualMin(plan.id, plan.userId);
      const elapsedRatio = Math.min(1, Math.max(0,
        (now.getTime() - planStart.getTime()) / (planEnd.getTime() - planStart.getTime())
      ));
      const expectedMin = plannedMin * elapsedRatio;
      const deficitMin = Math.round(expectedMin - actualMin);
      const progressPct = plannedMin > 0 ? Math.round((actualMin / plannedMin) * 100) : 0;

      // Determine level
      let level: "behind" | "critical" | null = null;

      if (elapsedRatio > 0.3 && actualMin < expectedMin * 0.3) {
        level = "critical";
      } else if (elapsedRatio > 0.3 && actualMin < expectedMin * 0.7) {
        level = "behind";
      }

      if (level) {
        const cooldownOk = await checkCooldown(plan.id, level, 20); // 20-min cooldown
        if (cooldownOk) {
          const cfg = plan.alertConfigs[0];
          const alert = await prisma.alert.create({
            data: {
              configId: cfg?.id || null,
              userId: plan.userId,
              planId: plan.id,
              planTitle: plan.title,
              checkTime: timeStr,
              plannedMin,
              actualMin: Math.round(actualMin),
              deficitMin,
              status: "sent",
            },
          });

          const { dispatchAlert } = await import("./notification/dispatcher.js");
          const notifyResults = await dispatchAlert({
            level,
            planTitle: plan.title,
            plannedMin,
            actualMin: Math.round(actualMin),
            deficitMin,
            notifyStudent: cfg?.notifyStudent ?? true,
            notifySupervisor: cfg?.notifySupervisor ?? true,
            supervisorChannel: cfg?.supervisorChannel || "wechat",
          });

          results.push({ alert, notifications: notifyResults, type: level, progressPct });
        }
      }
    }

    // 3. Plan just ended — check completion
    const fiveMinAfter = new Date(planEnd.getTime() + 5 * 60 * 1000);
    if (now >= planEnd && now <= fiveMinAfter) {
      const actualMin = await getTodayActualMin(plan.id, plan.userId);
      const progressPct = plannedMin > 0 ? Math.round((actualMin / plannedMin) * 100) : 0;

      if (progressPct < 90) {
        const cooldownOk = await checkCooldown(plan.id, "incomplete", 30);
        if (cooldownOk) {
          const cfg = plan.alertConfigs[0];
          const deficitMin = plannedMin - Math.round(actualMin);
          const alert = await prisma.alert.create({
            data: {
              configId: cfg?.id || null,
              userId: plan.userId,
              planId: plan.id,
              planTitle: plan.title,
              checkTime: timeStr,
              plannedMin,
              actualMin: Math.round(actualMin),
              deficitMin,
              status: "sent",
            },
          });

          const { dispatchAlert } = await import("./notification/dispatcher.js");
          const notifyResults = await dispatchAlert({
            level: "incomplete",
            planTitle: plan.title,
            plannedMin,
            actualMin: Math.round(actualMin),
            deficitMin,
            notifyStudent: cfg?.notifyStudent ?? true,
            notifySupervisor: cfg?.notifySupervisor ?? true,
            supervisorChannel: cfg?.supervisorChannel || "wechat",
          });

          results.push({ alert, notifications: notifyResults, type: "incomplete", progressPct });
        }
      }
    }
  }

  // Also check explicitly configured AlertConfigs (backward compat)
  const explicitConfigs = await prisma.alertConfig.findMany({
    where: { enabled: true, checkTime: timeStr },
    include: { plan: true, user: true },
  });

  for (const cfg of explicitConfigs) {
    const actualMin = await getTodayActualMin(cfg.planId, cfg.userId);
    const plannedMin = cfg.plan.durationMin;
    const deficitMin = plannedMin - Math.round(actualMin);

    if (actualMin < cfg.thresholdMin) {
      const cooldownOk = await checkCooldown(cfg.planId, "behind", 15);
      if (cooldownOk) {
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

        const { dispatchAlert } = await import("./notification/dispatcher.js");
        await dispatchAlert({
          level: "behind",
          planTitle: cfg.plan.title,
          plannedMin,
          actualMin: Math.round(actualMin),
          deficitMin,
          notifyStudent: cfg.notifyStudent,
          notifySupervisor: cfg.notifySupervisor,
          supervisorChannel: cfg.supervisorChannel,
        });

        results.push({ alert, type: "explicit_config" });
      }
    }
  }

  return results;
}

/**
 * Prevent alert spam: don't re-alert the same plan+level within cooldown minutes.
 */
async function checkCooldown(planId: string, level: string, cooldownMin: number): Promise<boolean> {
  const cooldownAgo = new Date(Date.now() - cooldownMin * 60 * 1000);
  const recent = await prisma.alert.findFirst({
    where: {
      planId,
      createdAt: { gte: cooldownAgo },
    },
  });
  return !recent;
}
