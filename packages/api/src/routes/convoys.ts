import type { FastifyInstance } from "fastify";

export async function convoysRoutes(app: FastifyInstance) {
  // TODO: Implement convoys endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "convoys" } });
  });
}
