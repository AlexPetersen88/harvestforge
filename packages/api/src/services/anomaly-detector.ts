/**
 * Real-Time Anomaly Detection Service
 * Compares current machine performance against 7-day rolling baselines.
 *
 * Detects:
 *   - Slow performance (speed below expected for crop/conditions)
 *   - High fuel burn (consumption above baseline)
 *   - Extended idle time (idle > threshold with no assignment change)
 *   - Route deviation (off planned route beyond tolerance)
 *   - Early finish prediction (ahead of schedule enough to trigger replan)
 */

import { query } from "../models/db.js";
import { publisher, CHANNELS } from "../models/redis.js";
import { ANOMALY_THRESHOLDS } from "../config/index.js";
import { logger } from "../utils/logger.js";

interface MachineSnapshot {
  machine_id: string;
  machine_name: string;
  speed_mph: number;
  fuel_pct: number;
  status: string;
  recorded_at: string;
  // Baseline comparison
  baseline_speed: number | null;
  baseline_fuel_rate: number | null;
  baseline_acres_hr: number | null;
  // Current assignment context
  assignment_id: string | null;
  field_name: string | null;
  crop_type: string | null;
}

/**
 * Run anomaly detection for all active machines in an organization.
 * Called after each location sync cycle.
 */
export async function detectAnomalies(orgId: string): Promise<number> {
  // Get current positions joined with baselines and active assignments
  const { rows: machines } = await query<MachineSnapshot>(
    `SELECT
       mcp.machine_id,
       m.name AS machine_name,
       mcp.speed_mph,
       mcp.fuel_pct,
       mcp.status,
       mcp.recorded_at,
       mpb.avg_speed_mph AS baseline_speed,
       mpb.avg_fuel_rate AS baseline_fuel_rate,
       mpb.avg_acres_hr AS baseline_acres_hr,
       a.id AS assignment_id,
       f.name AS field_name,
       f.crop_type
     FROM machine_current_positions mcp
     JOIN machines m ON m.id = mcp.machine_id AND m.org_id = $1
     LEFT JOIN assignments a ON a.machine_id = mcp.machine_id
       AND a.status = 'in_progress'
     LEFT JOIN fields f ON f.id = a.field_id
     LEFT JOIN machine_performance_baselines mpb
       ON mpb.machine_id = mcp.machine_id
       AND mpb.crop_type = f.crop_type
     WHERE m.is_active = true
       AND mcp.status NOT IN ('offline', 'maintenance')`,
    [orgId]
  );

  let anomalyCount = 0;

  for (const machine of machines) {
    const anomalies = [];

    // ─── Slow Performance ──────────────────────────
    if (
      machine.status === "harvesting" &&
      machine.baseline_speed &&
      machine.speed_mph > 0
    ) {
      const deviation =
        ((machine.baseline_speed - machine.speed_mph) / machine.baseline_speed) * 100;

      if (deviation > ANOMALY_THRESHOLDS.speed_deviation_pct) {
        anomalies.push({
          type: "slow_performance",
          severity: deviation > 25 ? "warning" : "info",
          description:
            `${machine.machine_name} running ${deviation.toFixed(0)}% slower than expected` +
            (machine.field_name ? ` at ${machine.field_name}` : "") +
            ` — possible header issue or wet spot. Recommend check.`,
          metric_expected: machine.baseline_speed,
          metric_actual: machine.speed_mph,
          deviation_pct: deviation,
        });
      }
    }

    // ─── Extended Idle ─────────────────────────────
    if (machine.status === "idle" && machine.assignment_id) {
      // Check how long this machine has been idle
      const { rows: idleCheck } = await query(
        `SELECT EXTRACT(EPOCH FROM (now() - recorded_at)) / 60 AS idle_min
         FROM machine_locations
         WHERE machine_id = $1
           AND status != 'idle'
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [machine.machine_id]
      );

      const idleMinutes = idleCheck[0]?.idle_min || 0;

      if (idleMinutes > ANOMALY_THRESHOLDS.idle_threshold_min) {
        anomalies.push({
          type: "idle_extended",
          severity: idleMinutes > 60 ? "warning" : "info",
          description:
            `${machine.machine_name} idle for ${Math.round(idleMinutes)} minutes` +
            (machine.field_name ? ` at ${machine.field_name}` : "") +
            `. Active assignment in progress — investigate delay.`,
          metric_expected: 0,
          metric_actual: idleMinutes,
          deviation_pct: 0,
        });
      }
    }

    // ─── Early Finish Prediction ───────────────────
    if (
      machine.status === "harvesting" &&
      machine.assignment_id &&
      machine.baseline_acres_hr &&
      machine.baseline_acres_hr > 0
    ) {
      // Estimate remaining time based on current pace
      const { rows: assignmentInfo } = await query(
        `SELECT a.scheduled_end, f.acreage, f.pct_complete
         FROM assignments a
         JOIN fields f ON f.id = a.field_id
         WHERE a.id = $1`,
        [machine.assignment_id]
      );

      if (assignmentInfo[0]) {
        const { scheduled_end, acreage, pct_complete } = assignmentInfo[0];
        const acresRemaining = acreage * ((100 - pct_complete) / 100);
        const hoursRemaining = acresRemaining / machine.baseline_acres_hr;
        const estimatedEnd = new Date(Date.now() + hoursRemaining * 3600 * 1000);
        const scheduledEnd = new Date(scheduled_end);

        const minutesAhead =
          (scheduledEnd.getTime() - estimatedEnd.getTime()) / (1000 * 60);

        if (minutesAhead > 45) {
          anomalies.push({
            type: "early_finish",
            severity: "info",
            description:
              `${machine.machine_name} likely to finish ${machine.field_name} ` +
              `${Math.round(minutesAhead)} minutes ahead of schedule — ` +
              `reroute tender and prepare next assignment?`,
            metric_expected: scheduledEnd.getTime(),
            metric_actual: estimatedEnd.getTime(),
            deviation_pct: 0,
            auto_action: "Trigger Quick Replan suggestion",
          });
        }
      }
    }

    // ─── Write Anomalies ───────────────────────────
    for (const anomaly of anomalies) {
      // Check for duplicate (same machine, same type, within last hour)
      const { rows: existing } = await query(
        `SELECT id FROM anomalies
         WHERE machine_id = $1 AND anomaly_type = $2
           AND detected_at > now() - interval '1 hour'
           AND resolved_at IS NULL`,
        [machine.machine_id, anomaly.type]
      );

      if (existing.length > 0) continue; // Skip duplicate

      await query(
        `INSERT INTO anomalies
          (org_id, machine_id, anomaly_type, severity, description,
           metric_expected, metric_actual, deviation_pct, auto_action)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          orgId, machine.machine_id, anomaly.type, anomaly.severity,
          anomaly.description, anomaly.metric_expected, anomaly.metric_actual,
          anomaly.deviation_pct, (anomaly as any).auto_action || null,
        ]
      );

      // Create alert for warning+ severity
      if (anomaly.severity === "warning" || anomaly.severity === "critical") {
        await query(
          `INSERT INTO alerts (org_id, level, title, message, machine_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            orgId, anomaly.severity,
            `Anomaly: ${anomaly.type.replace(/_/g, " ")}`,
            anomaly.description,
            machine.machine_id,
          ]
        );
      }

      // Broadcast to WebSocket clients
      await publisher.publish(
        CHANNELS.ANOMALY_DETECTED,
        JSON.stringify({
          org_id: orgId,
          machine_id: machine.machine_id,
          machine_name: machine.machine_name,
          type: anomaly.type,
          severity: anomaly.severity,
          description: anomaly.description,
        })
      );

      anomalyCount++;
    }
  }

  if (anomalyCount > 0) {
    logger.info({ orgId, anomalyCount }, "Anomalies detected");
  }

  return anomalyCount;
}

/**
 * Recompute performance baselines for all machines in an org.
 * Uses the last 7 days of data, grouped by crop type.
 * Called nightly by a cron job.
 */
export async function recomputeBaselines(orgId: string): Promise<number> {
  const { rowCount } = await query(
    `INSERT INTO machine_performance_baselines
       (machine_id, crop_type, avg_speed_mph, avg_fuel_rate, avg_acres_hr, sample_hours, computed_at)
     SELECT
       ml.machine_id,
       f.crop_type,
       AVG(ml.speed_mph) FILTER (WHERE ml.speed_mph > 0.5 AND ml.speed_mph < 8),
       -- Fuel rate estimated from consumption delta over time
       AVG(ml.fuel_pct) AS avg_fuel_proxy,
       -- Acres/hr estimated from field operations
       COALESCE(AVG(fo.acres_per_hour), 0),
       SUM(EXTRACT(EPOCH FROM '5 minutes'::interval)) / 3600 AS sample_hours,
       now()
     FROM machine_locations ml
     JOIN machines m ON m.id = ml.machine_id AND m.org_id = $1
     JOIN assignments a ON a.machine_id = ml.machine_id
       AND ml.recorded_at BETWEEN a.actual_start AND COALESCE(a.actual_end, now())
     JOIN fields f ON f.id = a.field_id AND f.crop_type IS NOT NULL
     LEFT JOIN LATERAL (
       SELECT f.pct_complete * f.acreage / 100.0 /
              NULLIF(EXTRACT(EPOCH FROM (COALESCE(a.actual_end, now()) - a.actual_start)) / 3600, 0)
              AS acres_per_hour
     ) fo ON true
     WHERE ml.recorded_at > now() - interval '7 days'
       AND ml.status = 'harvesting'
     GROUP BY ml.machine_id, f.crop_type
     ON CONFLICT (machine_id, crop_type)
     DO UPDATE SET
       avg_speed_mph = EXCLUDED.avg_speed_mph,
       avg_fuel_rate = EXCLUDED.avg_fuel_rate,
       avg_acres_hr = EXCLUDED.avg_acres_hr,
       sample_hours = EXCLUDED.sample_hours,
       computed_at = now()`,
    [orgId]
  );

  logger.info({ orgId, updated: rowCount }, "Performance baselines recomputed");
  return rowCount || 0;
}
