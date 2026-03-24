/**
 * JD Ops Center Sync Scheduler
 * Runs independently of user sessions to keep fleet data fresh.
 *
 * Polling intervals (configurable per endpoint):
 *   - machine_locations:  1-5 min (GPS breadcrumbs)
 *   - field_operations:   5-10 min (harvest progress)
 *   - device_state:       5-15 min (connectivity, diagnostics)
 *   - equipment:          daily (fleet list)
 *   - setup_plans:        daily (field boundaries, clients)
 */

import { CronJob } from "cron";
import { query } from "../models/db.js";
import { publisher, CHANNELS } from "../models/redis.js";
import { logger } from "../utils/logger.js";
import {
  syncMachineLocations,
  syncFieldOperations,
  syncEquipment,
  recordSyncError,
} from "./jd-client.js";
import { detectAnomalies } from "./anomaly-detector.js";

interface SyncTarget {
  org_id: string;
  endpoint: string;
  next_sync_at: Date;
  poll_interval_sec: number;
  error_count: number;
}

let isRunning = false;

/**
 * Main sync loop. Checks for due sync tasks and executes them.
 * Called every 30 seconds by the cron scheduler.
 */
async function runSyncCycle() {
  if (isRunning) {
    logger.debug("Sync cycle already running, skipping");
    return;
  }
  isRunning = true;

  try {
    // Find all sync tasks that are due
    const { rows: dueTasks } = await query<SyncTarget>(
      `SELECT org_id, endpoint, next_sync_at, poll_interval_sec, error_count
       FROM jd_sync_state
       WHERE next_sync_at <= now()
       ORDER BY next_sync_at ASC
       LIMIT 10`
    );

    if (dueTasks.length === 0) return;

    logger.debug({ count: dueTasks.length }, "Processing due sync tasks");

    for (const task of dueTasks) {
      try {
        await executeSyncTask(task);
      } catch (err: any) {
        logger.error(
          { orgId: task.org_id, endpoint: task.endpoint, err: err.message },
          "Sync task failed"
        );
        await recordSyncError(task.org_id, task.endpoint, err.message);
      }
    }
  } catch (err) {
    logger.error({ err }, "Sync cycle error");
  } finally {
    isRunning = false;
  }
}

/**
 * Execute a single sync task based on endpoint type.
 */
async function executeSyncTask(task: SyncTarget) {
  const { org_id, endpoint } = task;

  switch (endpoint) {
    case "machine_locations": {
      const count = await syncMachineLocations(org_id);
      if (count > 0) {
        // Broadcast position updates to WebSocket clients
        await publisher.publish(
          CHANNELS.MACHINE_UPDATE,
          JSON.stringify({ org_id, updated_count: count })
        );
        // Run anomaly detection on fresh data
        await detectAnomalies(org_id);
      }
      break;
    }

    case "field_operations": {
      const count = await syncFieldOperations(org_id);
      if (count > 0) {
        // Check for early completions that might trigger replans
        await checkEarlyCompletions(org_id);
      }
      break;
    }

    case "equipment": {
      await syncEquipment(org_id);
      break;
    }

    case "device_state": {
      // TODO: Implement device state sync
      // Updates connectivity status, diagnostic flags
      logger.debug({ org_id }, "Device state sync — not yet implemented");
      break;
    }

    case "setup_plans": {
      // TODO: Implement setup/plans sync
      // Updates field boundaries, customer records
      logger.debug({ org_id }, "Setup/plans sync — not yet implemented");
      break;
    }

    default:
      logger.warn({ endpoint }, "Unknown sync endpoint");
  }
}

/**
 * Check if any fields have completed ahead of schedule.
 * Surfaces as an anomaly and triggers a Quick Replan suggestion.
 */
async function checkEarlyCompletions(orgId: string) {
  const { rows: earlyFields } = await query(
    `SELECT f.id, f.name, a.machine_id, m.name AS machine_name,
            a.scheduled_end, a.id AS assignment_id
     FROM fields f
     JOIN assignments a ON a.field_id = f.id
     JOIN machines m ON m.id = a.machine_id
     WHERE f.org_id = $1
       AND f.status = 'completed'
       AND a.status = 'in_progress'
       AND a.scheduled_end > now() + interval '30 minutes'`,
    [orgId]
  );

  for (const field of earlyFields) {
    // Mark assignment complete
    await query(
      `UPDATE assignments SET status = 'completed', actual_end = now() WHERE id = $1`,
      [field.assignment_id]
    );

    // Create anomaly for early finish
    await query(
      `INSERT INTO anomalies (org_id, machine_id, anomaly_type, severity, description, detected_at)
       VALUES ($1, $2, 'early_finish', 'info',
               $3 || ' finished ' || $4 || ' ahead of schedule — ready for reassignment',
               now())`,
      [orgId, field.machine_id, field.machine_name, field.name]
    );

    // Broadcast for dashboard
    await publisher.publish(
      CHANNELS.FIELD_COMPLETED,
      JSON.stringify({
        org_id: orgId,
        field_id: field.id,
        field_name: field.name,
        machine_id: field.machine_id,
        machine_name: field.machine_name,
      })
    );

    logger.info(
      { orgId, fieldId: field.id, machineId: field.machine_id },
      "Early field completion detected"
    );
  }
}

/**
 * Initialize sync state for a newly connected organization.
 * Creates sync entries for all polled endpoints.
 */
export async function initializeSyncState(orgId: string) {
  const endpoints = [
    { endpoint: "machine_locations", interval: 300 },
    { endpoint: "field_operations", interval: 600 },
    { endpoint: "device_state", interval: 900 },
    { endpoint: "equipment", interval: 86400 },
    { endpoint: "setup_plans", interval: 86400 },
  ];

  for (const { endpoint, interval } of endpoints) {
    await query(
      `INSERT INTO jd_sync_state (org_id, endpoint, poll_interval_sec, next_sync_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (org_id, endpoint) DO NOTHING`,
      [orgId, endpoint, interval]
    );
  }

  logger.info({ orgId, endpoints: endpoints.length }, "Sync state initialized");
}

// ─── Cron Setup ────────────────────────────────────────────

let syncJob: CronJob | null = null;

/**
 * Start the sync scheduler. Runs every 30 seconds.
 */
export function startSyncScheduler() {
  if (syncJob) {
    logger.warn("Sync scheduler already running");
    return;
  }

  syncJob = new CronJob(
    "*/30 * * * * *", // every 30 seconds
    runSyncCycle,
    null,
    true, // start immediately
    "America/Chicago"
  );

  logger.info("JD sync scheduler started (30s cycle)");
}

/**
 * Stop the sync scheduler (for graceful shutdown).
 */
export function stopSyncScheduler() {
  if (syncJob) {
    syncJob.stop();
    syncJob = null;
    logger.info("JD sync scheduler stopped");
  }
}

/**
 * Manually trigger a sync for specific endpoints.
 * Used by the POST /sync/trigger endpoint.
 */
export async function triggerManualSync(
  orgId: string,
  endpoints: string[]
): Promise<void> {
  for (const endpoint of endpoints) {
    await query(
      `UPDATE jd_sync_state SET next_sync_at = now() WHERE org_id = $1 AND endpoint = $2`,
      [orgId, endpoint]
    );
  }
  // Run immediately rather than waiting for next cron tick
  await runSyncCycle();
}
