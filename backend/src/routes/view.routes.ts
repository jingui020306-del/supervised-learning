import type { FastifyInstance } from "fastify";
import prisma from "../db.js";

export async function viewRoutes(app: FastifyInstance) {
  // Dashboard — today view
  app.get("/", async (request, reply) => {
    const { userId } = request.query as { userId: string };
    if (!userId) {
      return reply.view("dashboard/today.eta", {
        date: new Date().toISOString().slice(0, 10),
        plans: [],
        summary: { totalPlanned: 0, totalActual: 0, completionRate: 0 },
      });
    }

    const today = new Date();
    const dayOfWeek = today.getDay();
    const dateStr = today.toISOString().slice(0, 10);
    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const plans = await prisma.plan.findMany({
      where: {
        userId,
        status: "active",
        OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
      },
      include: {
        sessions: { where: { startTime: { gte: dayStart, lt: dayEnd } } },
      },
      orderBy: { startTime: "asc" },
    });

    const enriched = plans.map((plan) => {
      const actualMin = plan.sessions.reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60;
      return {
        ...plan,
        actualMin: Math.round(actualMin),
        progress: plan.durationMin > 0 ? Math.round((actualMin / plan.durationMin) * 100) : 0,
      };
    });

    const totalPlanned = plans.reduce((s, p) => s + p.durationMin, 0);
    const totalActual = enriched.reduce((s, p) => s + p.actualMin, 0);

    return reply.view("dashboard/today.eta", {
      date: dateStr,
      plans: enriched,
      summary: {
        totalPlanned,
        totalActual,
        completionRate: totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0,
      },
    });
  });

  // Weekly view — simple SSR
  app.get("/weekly", async (request, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8");
    return reply.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>周报 · 学习监督</title></head>
<body><h1>周报</h1><p><a href="/dashboard">← 返回</a></p></body></html>`);
  });

  // Plans view
  app.get("/plans", async (request, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8");
    return reply.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>计划管理 · 学习监督</title></head>
<body><h1>计划管理</h1><p><a href="/dashboard">← 返回</a></p></body></html>`);
  });

  // Alerts view
  app.get("/alerts", async (request, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8");
    return reply.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>告警历史 · 学习监督</title></head>
<body><h1>告警历史</h1><p><a href="/dashboard">← 返回</a></p></body></html>`);
  });
}
