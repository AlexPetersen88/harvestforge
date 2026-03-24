import type { FastifyInstance } from "fastify";

export async function assignmentsRoutes(app: FastifyInstance) {
  // TODO: Implement assignments endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "assignments" } });
  });
}
