import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";

export async function authPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      reply.code(401).send({ error: "Missing authorization token" });
      return;
    }
    const token = authHeader.slice(7);
    if (token !== config.apiToken) {
      reply.code(403).send({ error: "Invalid token" });
      return;
    }
  });
}
