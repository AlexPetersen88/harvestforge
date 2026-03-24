import type { FastifyInstance } from "fastify";
import { checkHealth } from "../models/db.js";
import { redis } from "../models/redis.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    const dbOk = await checkHealth();
    let redisOk = false;
    try {
      await redis.ping();
      redisOk = true;
    } catch {}

    const healthy = dbOk && redisOk;

    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? "healthy" : "degraded",
      services: {
        database: dbOk ? "up" : "down",
        redis: redisOk ? "up" : "down",
      },
      version: "3.0.0",
      timestamp: new Date().toISOString(),
    });
  });
}
