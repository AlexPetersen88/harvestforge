import type { FastifyInstance } from "fastify";

export async function plansRoutes(app: FastifyInstance) {
  // TODO: Implement plans endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "plans" } });
  });
}
