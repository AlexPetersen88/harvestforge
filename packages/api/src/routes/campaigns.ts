import type { FastifyInstance } from "fastify";

export async function campaignsRoutes(app: FastifyInstance) {
  // TODO: Implement campaigns endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "campaigns" } });
  });
}
