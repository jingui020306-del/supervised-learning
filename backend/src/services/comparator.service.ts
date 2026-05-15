import prisma from "../db.js";

// ── In-memory cache ──
let cachedPlans: any[] = [];
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function getActivePlans() {
  const now = Date.now();
  if (now < cacheExpiry) return cachedPlans;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const dateStr = today.toISOString().slice(0, 10);

  cachedPlans = await prisma.plan.findMany({
    where: {
      status: "active",
      OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
    },
    include: { alertConfigs: true, user: true },
  });
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedPlans;
}

export function invalidatePlanCache() {
  cacheExpiry = 0;
}

// ── Match session to plan ──
export async function matchSessionToPlan(sessionId: string) {
  const session = await prisma.trackingSession.findUnique({ where: { id: sessionId } });
  if (!session || !session.endTime) return null;

  const dayOfWeek = session.startTime.getDay();
  const dateStr = session.startTime.toISOString().slice(0, 10);

  const plans = await prisma.plan.findMany({
    where: {
      userId: session.userId,
      status: "active",
      OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
    },
  });

  let bestPlan: (typeof plans)[0] | null = null;
  let bestScore = 0;

  const sessionStart = session.startTime;
  const sessionEnd = session.endTime;

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
      if (plan.appName === session.appName) score += 1000;
      else if (session.appName.includes(plan.appName) || plan.appName.includes(session.appName)) score += 500;
    } else if (!plan.appName) {
      score += 200;
    }
    if (score > bestScore) { bestScore = score; bestPlan = plan; }
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

// ── Optimized alert check (called every 5 min) ──
export async function runAlertCheck() {
  // Sleep hours skip (23:00-06:00) — no alerts needed
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 23 || hour < 6) return [];

  const plans = await getActivePlans();
  if (plans.length === 0) return [];

  const timeStr = `${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const dateStr = now.toISOString().slice(0, 10);
  const dayStart = new Date(dateStr);
  const dayEnd = new Date(dateStr);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Batch: get all today tracking data in ONE query per user
  const userIds = [...new Set(plans.map((p) => p.userId))];
  const sessionsByUser: Record<string, any[]> = {};

  for (const uid of userIds) {
    sessionsByUser[uid] = await prisma.trackingSession.findMany({
      where: { userId: uid, startTime: { gte: dayStart, lt: dayEnd } },
    });
  }

  const results: any[] = [];

  for (const plan of plans) {
    const plannedMin = plan.durationMin;
    const [sh, sm] = plan.startTime.split(":").map(Number);
    const [eh, em] = plan.endTime.split(":").map(Number);
    const planStart = new Date(now);
    planStart.setHours(sh, sm, 0, 0);
    const planEnd = new Date(now);
    planEnd.setHours(eh, em, 0, 0);

    const sessions = (sessionsByUser[plan.userId] || []).filter((s: any) => s.planId === plan.id);
    const actualMin = sessions.reduce((s: number, sess: any) => s + (sess.durationSec || 0), 0) / 60;

    // 1. Pre-start reminder (within 5 min window before start)
    const fiveMinBefore = new Date(planStart.getTime() - 5 * 60 * 1000);
    const tenMinBefore = new Date(planStart.getTime() - 10 * 60 * 1000);
    if (now >= tenMinBefore && now < planStart) {
      const already = await prisma.alert.findFirst({
        where: { planId: plan.id, createdAt: { gte: tenMinBefore } },
      });
      if (!already && plan.alertConfigs.length > 0) {
        await createAlert(plan, null, plannedMin, Math.round(actualMin), plannedMin - Math.round(actualMin));
        const { dispatchAlert } = await import("./notification/dispatcher.js");
        await dispatchAlert({
          level: "behind",
          planTitle: `⏰ ${plan.title} 即将开始`,
          plannedMin, actualMin: 0, deficitMin: plannedMin,
          notifyStudent: true, notifySupervisor: false,
          supervisorChannel: "wechat",
        });
        results.push({ type: "pre_start", plan: plan.title });
      }
    }

    // 2. In-window progress check
    if (now >= planStart && now <= planEnd) {
      const elapsedRatio = Math.min(1, Math.max(0, (now.getTime() - planStart.getTime()) / (planEnd.getTime() - planStart.getTime())));
      const expectedMin = plannedMin * elapsedRatio;
      let level: string | null = null;
      if (elapsedRatio > 0.3 && actualMin < expectedMin * 0.3) level = "critical";
      else if (elapsedRatio > 0.3 && actualMin < expectedMin * 0.7) level = "behind";

      if (level) {
        const ok = await checkCooldown(plan.id, 20);
        if (ok && plan.alertConfigs.length > 0) {
          const deficitMin = Math.round(expectedMin - actualMin);
          await createAlert(plan, plan.alertConfigs[0], plannedMin, Math.round(actualMin), deficitMin);
          const { dispatchAlert } = await import("./notification/dispatcher.js");
          await dispatchAlert({
            level: level as any,
            planTitle: plan.title, plannedMin, actualMin: Math.round(actualMin), deficitMin,
            notifyStudent: plan.alertConfigs[0]?.notifyStudent ?? true,
            notifySupervisor: plan.alertConfigs[0]?.notifySupervisor ?? true,
            supervisorChannel: plan.alertConfigs[0]?.supervisorChannel || "wechat",
          });
          results.push({ type: level, plan: plan.title });
        }
      }
    }

    // 3. Post-window completion check
    const fiveMinAfter = new Date(planEnd.getTime() + 5 * 60 * 1000);
    if (now >= planEnd && now <= fiveMinAfter && actualMin < plannedMin * 0.9) {
      const ok = await checkCooldown(plan.id, 30);
      if (ok && plan.alertConfigs.length > 0) {
        const deficitMin = plannedMin - Math.round(actualMin);
        await createAlert(plan, plan.alertConfigs[0], plannedMin, Math.round(actualMin), deficitMin);
        const { dispatchAlert } = await import("./notification/dispatcher.js");
        await dispatchAlert({
          level: "incomplete",
          planTitle: plan.title, plannedMin, actualMin: Math.round(actualMin), deficitMin,
          notifyStudent: plan.alertConfigs[0]?.notifyStudent ?? true,
          notifySupervisor: plan.alertConfigs[0]?.notifySupervisor ?? true,
          supervisorChannel: plan.alertConfigs[0]?.supervisorChannel || "wechat",
        });
        results.push({ type: "incomplete", plan: plan.title });
      }
    }
  }

  return results;
}

async function createAlert(plan: any, cfg: any, plannedMin: number, actualMin: number, deficitMin: number) {
  return prisma.alert.create({
    data: {
      configId: cfg?.id || null,
      userId: plan.userId,
      planId: plan.id,
      planTitle: plan.title,
      checkTime: new Date().toISOString().slice(11, 16),
      plannedMin, actualMin, deficitMin,
      status: "sent",
    },
  });
}

async function checkCooldown(planId: string, cooldownMin: number): Promise<boolean> {
  const cooldownAgo = new Date(Date.now() - cooldownMin * 60 * 1000);
  const recent = await prisma.alert.findFirst({
    where: { planId, createdAt: { gte: cooldownAgo } },
  });
  return !recent;
}
