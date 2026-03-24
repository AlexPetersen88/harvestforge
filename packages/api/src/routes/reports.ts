import type { FastifyInstance } from "fastify";

export async function reportsRoutes(app: FastifyInstance) {
  // TODO: Implement reports endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "reports" } });
  });
}
