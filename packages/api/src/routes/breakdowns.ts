import type { FastifyInstance } from "fastify";

export async function breakdownsRoutes(app: FastifyInstance) {
  // TODO: Implement breakdowns endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "breakdowns" } });
  });
}
