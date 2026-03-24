import type { FastifyInstance } from "fastify";

export async function crewRoutes(app: FastifyInstance) {
  // TODO: Implement crew endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "crew" } });
  });
}
