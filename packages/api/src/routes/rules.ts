import type { FastifyInstance } from "fastify";

export async function rulesRoutes(app: FastifyInstance) {
  // TODO: Implement rules endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "rules" } });
  });
}
