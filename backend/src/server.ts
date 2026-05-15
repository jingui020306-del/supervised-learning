import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import fastifyView from "@fastify/view";
import { Eta } from "eta";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authPlugin } from "./plugins/auth.js";
import { registerRoutes } from "./routes/index.js";
import { config } from "./config.js";
import { startAlertChecker } from "./jobs/alert-checker.js";
import { viewRoutes } from "./routes/view.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(formbody);

  const eta = new Eta({ views: path.join(__dirname, "views") });
  await app.register(fastifyView, {
    engine: { eta },
    templates: path.join(__dirname, "views"),
  });

  await app.register(authPlugin);

  await registerRoutes(app);
  await app.register(viewRoutes, { prefix: "/dashboard" });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  return app;
}

export async function startServer() {
  const app = await buildServer();
  try {
    await app.listen({ port: config.port, host: config.host });
    startAlertChecker(app.log);
    app.log.info(`Server running at http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
