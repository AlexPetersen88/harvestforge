import type { FastifyInstance } from "fastify";

export async function alertsRoutes(app: FastifyInstance) {
  // TODO: Implement alerts endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "alerts" } });
  });
}
