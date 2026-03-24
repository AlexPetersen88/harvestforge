import type { FastifyInstance } from "fastify";

export async function replanRoutes(app: FastifyInstance) {
  // TODO: Implement replan endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "replan" } });
  });
}
