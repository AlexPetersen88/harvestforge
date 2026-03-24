import type { FastifyInstance } from "fastify";
import { config, JD_AUTH_URL } from "../config/index.js";
import { exchangeCodeForTokens, JDAuthError } from "../services/jd-client.js";
import { initializeSyncState } from "../services/sync-scheduler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { query } from "../models/db.js";

export async function authRoutes(app: FastifyInstance) {
  /** POST /auth/jd/connect — Initiate JD OAuth flow */
  app.post("/jd/connect", async (request, reply) => {
    if (!config.JD_CLIENT_ID || !config.JD_REDIRECT_URI) {
      return sendError(reply, "CONFIG_ERROR", "JD OAuth not configured. Set JD_CLIENT_ID and JD_REDIRECT_URI in .env", 500);
    }

    const state = crypto.randomUUID();
    const { cache } = await import("../models/redis.js");
    await cache.set(`jd:oauth_state:${state}`, { created: Date.now() }, 600);

    const redirectUrl = new URL(`${JD_AUTH_URL}/v2.0/authorize`);
    redirectUrl.searchParams.set("response_type", "code");
    redirectUrl.searchParams.set("client_id", config.JD_CLIENT_ID);
    redirectUrl.searchParams.set("redirect_uri", config.JD_REDIRECT_URI);
    redirectUrl.searchParams.set("scope", config.JD_SCOPES);
    redirectUrl.searchParams.set("state", state);

    return sendSuccess(reply, { redirect_url: redirectUrl.toString(), state });
  });

  /** POST /auth/jd/callback — Exchange code for tokens */
  app.post("/jd/callback", async (request, reply) => {
    const { code, state } = request.body as { code: string; state: string };
    if (!code || !state) {
      return sendError(reply, "VALIDATION_ERROR", "Missing code or state parameter");
    }

    const { cache } = await import("../models/redis.js");
    const storedState = await cache.get(`jd:oauth_state:${state}`);
    if (!storedState) {
      return sendError(reply, "INVALID_STATE", "OAuth state expired or invalid. Try again.");
    }
    await cache.del(`jd:oauth_state:${state}`);

    const { rows: orgs } = await query(`SELECT id FROM organizations LIMIT 1`);
    if (orgs.length === 0) {
      return sendError(reply, "NO_ORG", "No organization found.", 404);
    }

    try {
      const result = await exchangeCodeForTokens(orgs[0].id, code);
      await initializeSyncState(orgs[0].id);
      return sendSuccess(reply, {
        connected: true,
        jd_org_id: result.jd_org_id,
        equipment_count: result.equipment_count,
      });
    } catch (err) {
      if (err instanceof JDAuthError) {
        return sendError(reply, "JD_AUTH_FAILED", err.message);
      }
      throw err;
    }
  });

  /** GET /auth/jd/status — Connection health check */
  app.get("/jd/status", async (_request, reply) => {
    const { rows } = await query(
      `SELECT o.jd_org_id, o.jd_token_expires_at,
              (SELECT MAX(last_sync_at) FROM jd_sync_state WHERE org_id = o.id) AS last_sync,
              (SELECT COALESCE(SUM(error_count), 0) FROM jd_sync_state WHERE org_id = o.id) AS sync_errors
       FROM organizations o LIMIT 1`
    );

    if (!rows[0]?.jd_org_id) {
      return sendSuccess(reply, { connected: false, token_expires_at: null, last_sync: null, sync_errors: 0 });
    }

    return sendSuccess(reply, {
      connected: true,
      token_expires_at: rows[0].jd_token_expires_at,
      last_sync: rows[0].last_sync,
      sync_errors: parseInt(rows[0].sync_errors) || 0,
    });
  });
}
