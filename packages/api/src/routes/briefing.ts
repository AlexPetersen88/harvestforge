import type { FastifyInstance } from "fastify";

export async function briefingRoutes(app: FastifyInstance) {
  // TODO: Implement briefing endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "briefing" } });
  });
}
