import type { FastifyInstance } from "fastify";

export async function weatherRoutes(app: FastifyInstance) {
  // TODO: Implement weather endpoints per API contract
  app.get("/", async (_req, reply) => {
    reply.send({ data: [], meta: { stub: true, resource: "weather" } });
  });
}
