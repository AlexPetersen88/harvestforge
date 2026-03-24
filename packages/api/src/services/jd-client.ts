/**
 * John Deere Operations Center API Client
 * Handles OAuth 2.0 token lifecycle and all JD Platform API calls.
 *
 * API Reference: https://developer.deere.com
 * Endpoints used:
 *   - Equipment API (fleet list)
 *   - Machine Locations API (GPS breadcrumbs)
 *   - Machine Device State Reports (connectivity, diagnostics)
 *   - Field Operations API (harvest progress, boundaries)
 *   - Setup/Plan APIs (field boundaries, clients)
 *   - Work Plans API (push to Gen4/G5 in-cab displays)
 */

import { config, JD_AUTH_URL, JD_API_URL, JD_API_URL_PROD, isProd } from "../config/index.js";
import { query } from "../models/db.js";
import { cache } from "../models/redis.js";
import { logger } from "../utils/logger.js";

const API_BASE = isProd ? JD_API_URL_PROD : JD_API_URL;

// ─── Token Management ──────────────────────────────────────

interface JDTokens {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

/**
 * Get a valid access token for the organization.
 * Refreshes automatically if expired or expiring within 5 minutes.
 */
export async function getAccessToken(orgId: string): Promise<string> {
  // Check cache first
  const cached = await cache.get<{ token: string; expires_at: string }>(`jd:token:${orgId}`);
  if (cached && new Date(cached.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return cached.token;
  }

  // Fetch from DB
  const { rows } = await query(
    `SELECT jd_oauth_token, jd_refresh_token, jd_token_expires_at
     FROM organizations WHERE id = $1`,
    [orgId]
  );

  if (!rows[0]?.jd_oauth_token) {
    throw new JDAuthError("JD Ops Center not connected. Complete OAuth setup first.");
  }

  const { jd_oauth_token, jd_refresh_token, jd_token_expires_at } = rows[0];

  // If token is still valid, cache and return
  if (new Date(jd_token_expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    await cache.set(`jd:token:${orgId}`, {
      token: jd_oauth_token,
      expires_at: jd_token_expires_at,
    }, 3600);
    return jd_oauth_token;
  }

  // Token expired or expiring soon — refresh
  logger.info({ orgId }, "Refreshing JD OAuth token");
  return refreshToken(orgId, jd_refresh_token);
}

/**
 * Exchange authorization code for tokens during initial OAuth setup.
 */
export async function exchangeCodeForTokens(
  orgId: string,
  code: string
): Promise<{ jd_org_id: string; equipment_count: number }> {
  const tokenUrl = `${JD_AUTH_URL}/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.JD_REDIRECT_URI || "",
      client_id: config.JD_CLIENT_ID || "",
      client_secret: config.JD_CLIENT_SECRET || "",
      scope: config.JD_SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, "JD token exchange failed");
    throw new JDAuthError("Failed to connect to JD Ops Center. Please try again.");
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Store tokens (encrypted in production via app-level encryption)
  await query(
    `UPDATE organizations
     SET jd_oauth_token = $2, jd_refresh_token = $3, jd_token_expires_at = $4, updated_at = now()
     WHERE id = $1`,
    [orgId, data.access_token, data.refresh_token, expiresAt]
  );

  // Discover the JD org and equipment count
  const orgInfo = await fetchJDOrganization(data.access_token);
  const equipmentCount = await countEquipment(data.access_token, orgInfo.id);

  await query(
    `UPDATE organizations SET jd_org_id = $2 WHERE id = $1`,
    [orgId, orgInfo.id]
  );

  return { jd_org_id: orgInfo.id, equipment_count: equipmentCount };
}

async function refreshToken(orgId: string, refreshToken: string): Promise<string> {
  const tokenUrl = `${JD_AUTH_URL}/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.JD_CLIENT_ID || "",
      client_secret: config.JD_CLIENT_SECRET || "",
    }),
  });

  if (!response.ok) {
    logger.error({ orgId, status: response.status }, "JD token refresh failed");
    // Clear stale token so UI shows re-auth prompt
    await query(
      `UPDATE organizations SET jd_oauth_token = NULL, jd_token_expires_at = NULL WHERE id = $1`,
      [orgId]
    );
    throw new JDAuthError("JD connection expired. Please re-authorize.");
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await query(
    `UPDATE organizations
     SET jd_oauth_token = $2, jd_refresh_token = COALESCE($3, jd_refresh_token), jd_token_expires_at = $4
     WHERE id = $1`,
    [orgId, data.access_token, data.refresh_token, expiresAt]
  );

  await cache.set(`jd:token:${orgId}`, {
    token: data.access_token,
    expires_at: expiresAt.toISOString(),
  }, 3600);

  return data.access_token;
}

// ─── Core API Methods ──────────────────────────────────────

interface JDRequestOptions {
  etag?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Make an authenticated request to the JD Platform API.
 * Handles pagination, rate limiting, and retries.
 */
async function jdFetch<T = any>(
  token: string,
  path: string,
  options: JDRequestOptions = {}
): Promise<{ data: T; etag?: string; total?: number } | null> {
  const url = new URL(path, API_BASE);

  if (options.page) url.searchParams.set("page", String(options.page));
  if (options.pageSize) url.searchParams.set("pageSize", String(options.pageSize));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.deere.axiom.v3+json",
  };
  if (options.etag) headers["If-None-Match"] = options.etag;

  let retries = 0;
  const maxRetries = 3;

  while (retries <= maxRetries) {
    const response = await fetch(url.toString(), { headers });

    // Not modified — data hasn't changed
    if (response.status === 304) return null;

    // Rate limited — exponential backoff
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "5");
      const delay = retryAfter * 1000 * Math.pow(2, retries);
      logger.warn({ path, retries, delay }, "JD rate limited, backing off");
      await sleep(delay);
      retries++;
      continue;
    }

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      logger.error({ path, status: response.status, error }, "JD API error");
      throw new JDApiError(`JD API error: ${response.status}`, response.status);
    }

    const data = await response.json();
    const etag = response.headers.get("ETag") || undefined;
    const total = data.total !== undefined ? data.total : undefined;

    return { data, etag, total };
  }

  throw new JDApiError("JD API request failed after retries", 503);
}

/**
 * Fetch all pages of a paginated JD endpoint.
 */
async function jdFetchAll<T = any>(
  token: string,
  path: string,
  pageSize = 100
): Promise<T[]> {
  const results: T[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await jdFetch<{ values: T[]; total: number }>(
      token, path, { page, pageSize }
    );

    if (!response) break;

    const items = response.data.values || [];
    results.push(...items);

    hasMore = results.length < (response.data.total || 0);
    page++;
  }

  return results;
}

// ─── Equipment Sync ────────────────────────────────────────

interface JDEquipment {
  id: string;
  name: string;
  make: string;
  model: string;
  serialNumber?: string;
  modelYear?: number;
  engineHours?: number;
  telematicsState?: string;
  category?: string;
}

/**
 * Import/update all equipment from JD Ops Center.
 * Called daily or on-demand during onboarding.
 */
export async function syncEquipment(orgId: string): Promise<{
  imported: number;
  updated: number;
  total: number;
}> {
  const token = await getAccessToken(orgId);
  const { rows: [org] } = await query(
    `SELECT jd_org_id FROM organizations WHERE id = $1`,
    [orgId]
  );

  const equipment = await jdFetchAll<JDEquipment>(
    token,
    `/organizations/${org.jd_org_id}/machines`
  );

  let imported = 0;
  let updated = 0;

  for (const eq of equipment) {
    const machineType = inferMachineType(eq);
    const displayType = inferDisplayType(eq);

    const { rows } = await query(
      `INSERT INTO machines (org_id, jd_equipment_id, machine_type, name, make, model, serial_number, year, engine_hours, display_type, jdlink_enabled, data_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'jdlink_live')
       ON CONFLICT (org_id, jd_equipment_id)
         WHERE jd_equipment_id IS NOT NULL
       DO UPDATE SET
         name = EXCLUDED.name,
         model = EXCLUDED.model,
         engine_hours = EXCLUDED.engine_hours,
         updated_at = now()
       RETURNING (xmax = 0) AS is_new`,
      [
        orgId, eq.id, machineType, eq.name || `${eq.make} ${eq.model}`,
        eq.make, eq.model, eq.serialNumber, eq.modelYear,
        eq.engineHours, displayType,
        eq.telematicsState === "active",
      ]
    );

    if (rows[0]?.is_new) imported++;
    else updated++;
  }

  await updateSyncState(orgId, "equipment", null);
  logger.info({ orgId, imported, updated, total: equipment.length }, "Equipment sync complete");

  return { imported, updated, total: equipment.length };
}

// ─── Machine Locations Sync ────────────────────────────────

interface JDBreadcrumb {
  machineId: string;
  timestamp: string;
  geometry: { type: string; coordinates: [number, number] };
  heading?: number;
  speed?: { value: number; unit: string };
  fuelPercent?: number;
  engineState?: string;
}

/**
 * Poll machine locations (breadcrumbs) from JD.
 * Called every 1-5 minutes by the sync job.
 */
export async function syncMachineLocations(orgId: string): Promise<number> {
  const token = await getAccessToken(orgId);
  const { rows: [org] } = await query(
    `SELECT jd_org_id FROM organizations WHERE id = $1`,
    [orgId]
  );

  // Get existing sync state for conditional request
  const syncState = await getSyncState(orgId, "machine_locations");
  const etag = syncState?.last_etag;

  const response = await jdFetch<{ values: JDBreadcrumb[] }>(
    token,
    `/organizations/${org.jd_org_id}/machines/locations`,
    { etag }
  );

  // 304 Not Modified — nothing changed
  if (!response) {
    await updateSyncState(orgId, "machine_locations", etag);
    return 0;
  }

  const breadcrumbs = response.data.values || [];
  let inserted = 0;

  for (const bc of breadcrumbs) {
    // Look up internal machine ID
    const { rows: machines } = await query(
      `SELECT id FROM machines WHERE org_id = $1 AND jd_equipment_id = $2`,
      [orgId, bc.machineId]
    );
    if (machines.length === 0) continue;

    const machineId = machines[0].id;
    const [lng, lat] = bc.geometry.coordinates;
    const speedMph = bc.speed?.unit === "mph"
      ? bc.speed.value
      : bc.speed?.unit === "km/h"
        ? bc.speed.value * 0.621371
        : bc.speed?.value || 0;

    // Determine status from speed and engine state
    const status = inferStatus(speedMph, bc.engineState, bc.fuelPercent);

    await query(
      `INSERT INTO machine_locations
        (machine_id, position, heading, speed_mph, fuel_pct, engine_state, status, data_source, recorded_at)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, $7, $8, 'jdlink_live', $9)`,
      [
        machineId, lng, lat, bc.heading || 0,
        speedMph, bc.fuelPercent, bc.engineState || "unknown",
        status, bc.timestamp,
      ]
    );
    inserted++;
  }

  // Refresh the materialized view for current positions
  if (inserted > 0) {
    await query("SELECT refresh_machine_positions()");
  }

  await updateSyncState(orgId, "machine_locations", response.etag);
  logger.info({ orgId, inserted, total: breadcrumbs.length }, "Location sync complete");

  return inserted;
}

// ─── Field Operations Sync ─────────────────────────────────

interface JDFieldOperation {
  id: string;
  field?: { id: string; name: string };
  machine?: { id: string };
  operationType?: string;
  startTime?: string;
  endTime?: string;
  area?: { value: number; unit: string };
  averageYield?: { value: number; unit: string };
}

/**
 * Sync harvest progress from JD Field Operations API.
 * Updates field completion percentages and yields.
 */
export async function syncFieldOperations(orgId: string): Promise<number> {
  const token = await getAccessToken(orgId);
  const { rows: [org] } = await query(
    `SELECT jd_org_id FROM organizations WHERE id = $1`,
    [orgId]
  );

  const syncState = await getSyncState(orgId, "field_operations");

  const operations = await jdFetchAll<JDFieldOperation>(
    token,
    `/organizations/${org.jd_org_id}/fieldOperations`
  );

  let updated = 0;

  for (const op of operations) {
    if (!op.field?.id) continue;

    // Map JD field ID to internal field
    const { rows: fields } = await query(
      `SELECT id, acreage FROM fields WHERE org_id = $1 AND jd_field_id = $2`,
      [orgId, op.field.id]
    );
    if (fields.length === 0) continue;

    const field = fields[0];

    // Convert area to acres if needed
    let acresCompleted = op.area?.value || 0;
    if (op.area?.unit === "ha") acresCompleted *= 2.47105;

    // Update completion percentage
    const pctComplete = field.acreage > 0
      ? Math.min(100, (acresCompleted / field.acreage) * 100)
      : 0;

    // Convert yield to bu/acre if available
    let yieldBuAcre = op.averageYield?.value;
    if (op.averageYield?.unit === "kg/ha" && yieldBuAcre) {
      yieldBuAcre = yieldBuAcre * 0.0148; // approximate wheat kg/ha to bu/acre
    }

    await query(
      `UPDATE fields
       SET pct_complete = GREATEST(pct_complete, $2),
           actual_yield = COALESCE($3, actual_yield),
           status = CASE
             WHEN $2 >= 100 THEN 'completed'::field_status
             WHEN $2 > 0 THEN 'in_progress'::field_status
             ELSE status
           END,
           updated_at = now()
       WHERE id = $1`,
      [field.id, pctComplete, yieldBuAcre]
    );
    updated++;
  }

  await updateSyncState(orgId, "field_operations", null);
  logger.info({ orgId, updated }, "Field operations sync complete");

  return updated;
}

// ─── Work Plans Push (In-Cab Display) ──────────────────────

interface WorkPlanPayload {
  fieldName: string;
  customerName: string;
  acreage: number;
  route: { type: string; coordinates: [number, number][] };
  entryPoint: { type: string; coordinates: [number, number] };
  entryPointDesc?: string;
  instructions?: string;
}

/**
 * Push a work plan to a combine's Gen4/G5 in-cab display.
 * Falls back to mobile push after 3 retries.
 */
export async function pushWorkPlan(
  orgId: string,
  assignmentId: string,
  machineId: string,
  payload: WorkPlanPayload
): Promise<{ pushed: boolean; fallback: boolean }> {
  // Check display capability
  const { rows: machines } = await query(
    `SELECT jd_equipment_id, display_type FROM machines WHERE id = $1`,
    [machineId]
  );

  if (!machines[0]?.jd_equipment_id || machines[0].display_type === "none") {
    // No display capability — mark as fallback immediately
    await query(
      `INSERT INTO jd_work_plan_pushes (assignment_id, machine_id, payload, fallback_to_mobile)
       VALUES ($1, $2, $3, true)`,
      [assignmentId, machineId, JSON.stringify(payload)]
    );
    return { pushed: false, fallback: true };
  }

  const token = await getAccessToken(orgId);

  // Format for JD Work Plans API
  const workPlan = {
    title: payload.fieldName,
    description: `${payload.customerName} — ${payload.acreage} acres`,
    route: payload.route,
    destination: payload.entryPoint,
    destinationDescription: payload.entryPointDesc || "",
    notes: payload.instructions || "",
  };

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch(
        `${API_BASE}/machines/${machines[0].jd_equipment_id}/workPlans`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/vnd.deere.axiom.v3+json",
          },
          body: JSON.stringify(workPlan),
        }
      );

      if (response.ok) {
        await query(
          `INSERT INTO jd_work_plan_pushes (assignment_id, machine_id, payload, ack_received, ack_at)
           VALUES ($1, $2, $3, true, now())`,
          [assignmentId, machineId, JSON.stringify(payload)]
        );

        await query(
          `UPDATE assignments SET pushed_to_display = true, pushed_at = now() WHERE id = $1`,
          [assignmentId]
        );

        logger.info({ machineId, assignmentId }, "Work plan pushed to display");
        return { pushed: true, fallback: false };
      }

      if (response.status === 429) {
        const delay = Math.pow(2, retryCount) * 2000;
        await sleep(delay);
        retryCount++;
        continue;
      }

      // Non-retryable error
      const errorText = await response.text().catch(() => "");
      logger.warn({ machineId, status: response.status, error: errorText }, "Work plan push failed");
      break;

    } catch (err) {
      logger.warn({ machineId, err, retryCount }, "Work plan push network error");
      retryCount++;
      await sleep(Math.pow(2, retryCount) * 1000);
    }
  }

  // All retries exhausted — fallback to mobile
  await query(
    `INSERT INTO jd_work_plan_pushes (assignment_id, machine_id, payload, retry_count, fallback_to_mobile, error)
     VALUES ($1, $2, $3, $4, true, 'Exhausted retries — falling back to mobile')`,
    [assignmentId, machineId, JSON.stringify(payload), retryCount]
  );

  logger.warn({ machineId, assignmentId }, "Work plan push failed, falling back to mobile");
  return { pushed: false, fallback: true };
}

/**
 * Push work plans for all assignments in a dispatched plan.
 * Returns summary of push results.
 */
export async function dispatchPlanToDisplays(
  orgId: string,
  planId: string
): Promise<{
  mobile_pushed: number;
  display_pushed: number;
  display_fallback_to_mobile: number;
  display_failed: number;
}> {
  const { rows: assignments } = await query(
    `SELECT a.id, a.machine_id, a.field_id, a.route_geom,
            f.name AS field_name, f.acreage, f.entry_point, f.entry_point_desc,
            c.name AS customer_name,
            m.display_type
     FROM assignments a
     JOIN fields f ON f.id = a.field_id
     JOIN customers c ON c.id = f.customer_id
     JOIN machines m ON m.id = a.machine_id
     WHERE a.daily_plan_id = $1 AND a.status IN ('planned', 'dispatched')`,
    [planId]
  );

  const results = { mobile_pushed: 0, display_pushed: 0, display_fallback_to_mobile: 0, display_failed: 0 };

  for (const assignment of assignments) {
    if (assignment.display_type === "none") {
      results.mobile_pushed++;
      continue;
    }

    const payload: WorkPlanPayload = {
      fieldName: assignment.field_name,
      customerName: assignment.customer_name,
      acreage: assignment.acreage || 0,
      route: assignment.route_geom || { type: "LineString", coordinates: [] },
      entryPoint: assignment.entry_point || { type: "Point", coordinates: [0, 0] },
      entryPointDesc: assignment.entry_point_desc,
    };

    try {
      const result = await pushWorkPlan(orgId, assignment.id, assignment.machine_id, payload);
      if (result.pushed) results.display_pushed++;
      else if (result.fallback) results.display_fallback_to_mobile++;
      else results.display_failed++;
    } catch {
      results.display_failed++;
    }
  }

  // Update all assignments to dispatched status
  await query(
    `UPDATE assignments SET status = 'dispatched' WHERE daily_plan_id = $1 AND status = 'planned'`,
    [planId]
  );

  logger.info({ orgId, planId, ...results }, "Plan dispatched to displays");
  return results;
}

// ─── Sync State Management ─────────────────────────────────

async function getSyncState(orgId: string, endpoint: string) {
  const { rows } = await query(
    `SELECT last_sync_at, last_etag, poll_interval_sec, error_count
     FROM jd_sync_state WHERE org_id = $1 AND endpoint = $2`,
    [orgId, endpoint]
  );
  return rows[0] || null;
}

async function updateSyncState(orgId: string, endpoint: string, etag: string | null | undefined) {
  await query(
    `INSERT INTO jd_sync_state (org_id, endpoint, last_sync_at, last_etag, next_sync_at, error_count)
     VALUES ($1, $2, now(), $3, now() + (poll_interval_sec || 300) * interval '1 second', 0)
     ON CONFLICT (org_id, endpoint)
     DO UPDATE SET
       last_sync_at = now(),
       last_etag = COALESCE($3, jd_sync_state.last_etag),
       next_sync_at = now() + jd_sync_state.poll_interval_sec * interval '1 second',
       error_count = 0`,
    [orgId, endpoint, etag]
  );
}

export async function recordSyncError(orgId: string, endpoint: string, error: string) {
  await query(
    `UPDATE jd_sync_state
     SET error_count = error_count + 1,
         last_error = $3,
         next_sync_at = now() + LEAST(poll_interval_sec * POWER(2, error_count), 3600) * interval '1 second'
     WHERE org_id = $1 AND endpoint = $2`,
    [orgId, endpoint, error]
  );
}

// ─── Helper Functions ──────────────────────────────────────

async function fetchJDOrganization(token: string) {
  const response = await jdFetch<{ values: { id: string; name: string }[] }>(
    token, "/organizations"
  );
  if (!response?.data.values?.[0]) {
    throw new JDApiError("No JD organization found for this account", 404);
  }
  return response.data.values[0];
}

async function countEquipment(token: string, jdOrgId: string): Promise<number> {
  const response = await jdFetch<{ total: number }>(
    token, `/organizations/${jdOrgId}/machines`, { pageSize: 1 }
  );
  return response?.data.total || 0;
}

function inferMachineType(eq: JDEquipment): string {
  const name = (eq.name + " " + eq.model).toLowerCase();
  if (name.includes("combine") || name.includes("s790") || name.includes("s780") || name.includes("x9")) return "combine";
  if (name.includes("cart") || name.includes("grain")) return "grain_cart";
  if (name.includes("truck") || name.includes("semi")) return "truck";
  if (name.includes("tender") || name.includes("fuel")) return "fuel_tender";
  if (name.includes("service") || name.includes("rig")) return "service_rig";
  return "other";
}

function inferDisplayType(eq: JDEquipment): string {
  // In production, this would come from JD device capability data
  // For now, assume newer combines have G5
  if (eq.modelYear && eq.modelYear >= 2024) return "g5";
  if (eq.modelYear && eq.modelYear >= 2020) return "gen4";
  return "none";
}

function inferStatus(speedMph: number, engineState?: string, fuelPct?: number): string {
  if (engineState === "off" || engineState === "OFF") return "offline";
  if (speedMph > 1.0) return speedMph < 8 ? "harvesting" : "moving";
  return "idle";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Error Classes ─────────────────────────────────────────

export class JDAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JDAuthError";
  }
}

export class JDApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "JDApiError";
    this.statusCode = statusCode;
  }
}
