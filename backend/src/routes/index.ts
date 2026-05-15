import type { FastifyInstance } from "fastify";
import { planRoutes } from "./plan.routes.js";
import { trackingRoutes } from "./tracking.routes.js";
import { alertRoutes } from "./alert.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { syncRoutes } from "./sync.routes.js";
import { appPermissionRoutes } from "./app-permission.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(planRoutes, { prefix: "/api/v1/plans" });
  await app.register(trackingRoutes, { prefix: "/api/v1/tracking" });
  await app.register(alertRoutes, { prefix: "/api/v1/alerts" });
  await app.register(dashboardRoutes, { prefix: "/api/v1/dashboard" });
  await app.register(syncRoutes, { prefix: "/api/v1/sync" });
  await app.register(appPermissionRoutes, { prefix: "/api/v1/apps" });
}
