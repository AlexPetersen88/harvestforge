import type { FastifyInstance } from "fastify";

export async function mobileRoutes(app: FastifyInstance) {
  // TODO: Implement mobile endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "mobile" } });
  });
}
