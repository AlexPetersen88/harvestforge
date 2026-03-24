import type { FastifyInstance } from "fastify";

export async function fieldsRoutes(app: FastifyInstance) {
  // TODO: Implement fields endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "fields" } });
  });
}
