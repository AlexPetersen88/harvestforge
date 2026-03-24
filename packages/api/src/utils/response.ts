import type { FastifyReply } from "fastify";

/**
 * Standard API response envelope
 */
export function sendSuccess(reply: FastifyReply, data: any, statusCode = 200) {
  return reply.status(statusCode).send({
    data,
    meta: {
      request_id: reply.request.id,
      timestamp: new Date().toISOString(),
    },
  });
}

export function sendPaginated(
  reply: FastifyReply,
  data: any[],
  total: number,
  page: number,
  perPage: number
) {
  return reply.status(200).send({
    data,
    pagination: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    },
    meta: {
      request_id: reply.request.id,
      timestamp: new Date().toISOString(),
    },
  });
}

export function sendError(
  reply: FastifyReply,
  code: string,
  message: string,
  statusCode = 400,
  details?: any[]
) {
  return reply.status(statusCode).send({
    error: { code, message, details },
    meta: {
      request_id: reply.request.id,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Parse pagination params with defaults
 */
export function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(query.per_page) || 50));
  const offset = (page - 1) * perPage;
  return { page, perPage, offset };
}
