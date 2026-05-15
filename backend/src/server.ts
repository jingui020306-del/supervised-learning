import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
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
  const app = Fastify({
    logger: true,
    // Prisma SQLite connection pooling — single connection is optimal for SQLite
    // (SQLite serializes writes anyway, multiple connections add overhead)
  });

  // Compression: gzip/brotli responses, reduces bandwidth ~70%
  await app.register(compress, { global: true });

  // Rate limiting: 100 req/min per IP, prevents CPU abuse
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (req: any) => req.ip,
  });

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

  await app.register(fastifyStatic, {
    root: path.join(__dirname, "views", "partials"),
    prefix: "/static/",
    decorateReply: true,
  });

  await app.register(viewRoutes, { prefix: "/dashboard" });

  // Health check (excluded from rate limit)
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage().heapUsed / 1024 / 1024,
  }));

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
