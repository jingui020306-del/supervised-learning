import "./setup.js"; // Must be first: loads .env and sets DATABASE_URL
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
import os from "node:os";
import { authPlugin } from "./plugins/auth.js";
import { registerRoutes } from "./routes/index.js";
import { config } from "./config.js";
import { startAlertChecker } from "./jobs/alert-checker.js";
import { viewRoutes } from "./routes/view.routes.js";
import { BASE_DIR } from "./setup.js";

function getLanIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  const lanIp = getLanIp();

  // Make LAN IP available to all view templates
  app.decorateReply("locals", null);
  app.addHook("onRequest", async (_req, reply) => {
    (reply as any).locals = { lanIp, port: config.port };
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

  const eta = new Eta({ views: path.join(BASE_DIR, "views") });
  await app.register(fastifyView, {
    engine: { eta },
    templates: path.join(BASE_DIR, "views"),
  });

  await app.register(authPlugin);
  await registerRoutes(app);

  await app.register(fastifyStatic, {
    root: path.join(BASE_DIR, "views", "partials"),
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
    const url = `http://localhost:${config.port}/dashboard`;
    app.log.info(`Server running at ${url}`);
    // Auto-open browser (macOS/Windows/Linux)
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    import("node:child_process").then(({ exec }) => exec(`${cmd} ${url}`)).catch(() => {});
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
