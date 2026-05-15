import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { planRoutes } from "./plan.routes.js";
import { trackingRoutes } from "./tracking.routes.js";
import { alertRoutes } from "./alert.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { syncRoutes } from "./sync.routes.js";
import { appPermissionRoutes } from "./app-permission.routes.js";
import { excelRoutes } from "./excel.routes.js";
import { goalRoutes } from "./goal.routes.js";
import { settingsRoutes } from "./settings.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(planRoutes, { prefix: "/api/v1/plans" });
  await app.register(trackingRoutes, { prefix: "/api/v1/tracking" });
  await app.register(alertRoutes, { prefix: "/api/v1/alerts" });
  await app.register(dashboardRoutes, { prefix: "/api/v1/dashboard" });
  await app.register(syncRoutes, { prefix: "/api/v1/sync" });
  await app.register(appPermissionRoutes, { prefix: "/api/v1/apps" });
  await app.register(excelRoutes, { prefix: "/api/v1/excel" });
  await app.register(goalRoutes, { prefix: "/api/v1/goals" });
  await app.register(settingsRoutes, { prefix: "/api/v1/settings" });
}
