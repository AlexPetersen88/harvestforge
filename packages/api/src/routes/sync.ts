import type { FastifyInstance } from "fastify";
import { triggerManualSync } from "../services/sync-scheduler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { query } from "../models/db.js";

export async function syncRoutes(app: FastifyInstance) {
  /** POST /sync/trigger — Manual sync (owner only) */
  app.post("/trigger", async (request, reply) => {
    const { endpoints } = request.body as { endpoints: string[] };
    const validEndpoints = ["machine_locations", "field_operations", "device_state", "equipment", "setup_plans"];
    const filtered = endpoints.filter((e: string) => validEndpoints.includes(e));

    if (filtered.length === 0) {
      return sendError(reply, "VALIDATION_ERROR", `Valid endpoints: ${validEndpoints.join(", ")}`);
    }

    const { rows } = await query(`SELECT id FROM organizations LIMIT 1`);
    if (!rows[0]) return sendError(reply, "NO_ORG", "No organization found", 404);

    await triggerManualSync(rows[0].id, filtered);
    return sendSuccess(reply, { triggered: filtered, status: "syncing" });
  });

  /** GET /sync/status — Current sync state */
  app.get("/status", async (_request, reply) => {
    const { rows } = await query(
      `SELECT endpoint, last_sync_at, next_sync_at, poll_interval_sec, error_count, last_error
       FROM jd_sync_state
       WHERE org_id = (SELECT id FROM organizations LIMIT 1)
       ORDER BY endpoint`
    );

    return sendSuccess(reply, rows);
  });
}
