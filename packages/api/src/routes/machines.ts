import type { FastifyInstance } from "fastify";
import { sendSuccess, sendPaginated, sendError, parsePagination } from "../utils/response.js";
import { query } from "../models/db.js";

export async function machineRoutes(app: FastifyInstance) {
  /** GET /machines — List all machines with current positions */
  app.get("/", async (request, reply) => {
    const { page, perPage, offset } = parsePagination(request.query);
    const q = request.query as any;

    let whereClause = "WHERE m.org_id = (SELECT id FROM organizations LIMIT 1)";
    const params: any[] = [];
    let paramIdx = 1;

    if (q.type) { whereClause += ` AND m.machine_type = $${paramIdx++}`; params.push(q.type); }
    if (q.status) { whereClause += ` AND mcp.status = $${paramIdx++}`; params.push(q.status); }
    if (q.is_active !== undefined) { whereClause += ` AND m.is_active = $${paramIdx++}`; params.push(q.is_active === "true"); }

    const countResult = await query(`SELECT COUNT(*) FROM machines m LEFT JOIN machine_current_positions mcp ON mcp.machine_id = m.id ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const { rows } = await query(
      `SELECT m.*,
              json_build_object(
                'location', json_build_object('type', 'Point', 'coordinates', ARRAY[ST_X(mcp.position::geometry), ST_Y(mcp.position::geometry)]),
                'heading', mcp.heading,
                'speed_mph', mcp.speed_mph,
                'fuel_pct', mcp.fuel_pct,
                'engine_state', mcp.engine_state,
                'status', mcp.status,
                'data_source', mcp.data_source,
                'recorded_at', mcp.recorded_at,
                'is_stale', mcp.is_stale
              ) AS current_position
       FROM machines m
       LEFT JOIN machine_current_positions mcp ON mcp.machine_id = m.id
       ${whereClause}
       ORDER BY m.machine_type, m.name
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, perPage, offset]
    );

    return sendPaginated(reply, rows, total, page, perPage);
  });

  /** GET /machines/:id — Single machine detail */
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { rows } = await query(
      `SELECT m.*,
              json_build_object(
                'location', json_build_object('type', 'Point', 'coordinates', ARRAY[ST_X(mcp.position::geometry), ST_Y(mcp.position::geometry)]),
                'heading', mcp.heading, 'speed_mph', mcp.speed_mph,
                'fuel_pct', mcp.fuel_pct, 'engine_state', mcp.engine_state,
                'status', mcp.status, 'recorded_at', mcp.recorded_at, 'is_stale', mcp.is_stale
              ) AS current_position,
              (SELECT json_agg(json_build_object(
                'location', json_build_object('type', 'Point', 'coordinates', ARRAY[ST_X(ml.position::geometry), ST_Y(ml.position::geometry)]),
                'speed_mph', ml.speed_mph, 'fuel_pct', ml.fuel_pct, 'recorded_at', ml.recorded_at
              ) ORDER BY ml.recorded_at DESC)
               FROM machine_locations ml WHERE ml.machine_id = m.id AND ml.recorded_at > now() - interval '4 hours'
               LIMIT 50
              ) AS location_history,
              (SELECT row_to_json(a) FROM (
                SELECT a.id, f.name AS field_name, a.status, f.pct_complete
                FROM assignments a JOIN fields f ON f.id = a.field_id
                WHERE a.machine_id = m.id AND a.status = 'in_progress' LIMIT 1
              ) a) AS current_assignment,
              (SELECT row_to_json(b) FROM (
                SELECT crop_type, avg_speed_mph, avg_acres_hr, avg_fuel_rate
                FROM machine_performance_baselines WHERE machine_id = m.id LIMIT 1
              ) b) AS performance_baseline
       FROM machines m
       LEFT JOIN machine_current_positions mcp ON mcp.machine_id = m.id
       WHERE m.id = $1`,
      [id]
    );

    if (rows.length === 0) return sendError(reply, "NOT_FOUND", "Machine not found", 404);
    return sendSuccess(reply, rows[0]);
  });

  /** POST /machines — Add non-JD support equipment */
  app.post("/", async (request, reply) => {
    const body = request.body as any;
    const { rows } = await query(
      `INSERT INTO machines (org_id, machine_type, name, make, model, capacity, data_source, jdlink_enabled, display_type)
       VALUES ((SELECT id FROM organizations LIMIT 1), $1, $2, $3, $4, $5, $6, false, 'none')
       RETURNING *`,
      [body.machine_type, body.name, body.make, body.model, body.capacity, body.data_source || "manual"]
    );
    return sendSuccess(reply, rows[0], 201);
  });

  /** PATCH /machines/:id — Update machine */
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const { rows } = await query(
      `UPDATE machines SET
        name = COALESCE($2, name), notes = COALESCE($3, notes),
        is_active = COALESCE($4, is_active), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, body.name, body.notes, body.is_active]
    );
    if (rows.length === 0) return sendError(reply, "NOT_FOUND", "Machine not found", 404);
    return sendSuccess(reply, rows[0]);
  });

  /** POST /machines/:id/location — Manual location update */
  app.post("/:id/location", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const [lng, lat] = body.location.coordinates;

    await query(
      `INSERT INTO machine_locations (machine_id, position, fuel_pct, status, data_source, recorded_at)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, 'manual', now())`,
      [id, lng, lat, body.fuel_pct, body.status || "idle"]
    );
    await query("SELECT refresh_machine_positions()");

    return sendSuccess(reply, { updated: true });
  });

  /** GET /machines/:id/nearest-support — Find closest support equipment */
  app.get("/:id/nearest-support", async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as any;
    const supportType = q.type || "fuel_tender";
    const limit = Math.min(parseInt(q.limit) || 3, 10);

    const { rows } = await query(
      `SELECT * FROM nearest_support($1, $2::machine_type, $3)`,
      [id, supportType, limit]
    );

    return sendSuccess(reply, rows);
  });
}
