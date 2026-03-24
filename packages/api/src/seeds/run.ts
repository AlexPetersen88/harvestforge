/**
 * HarvestForge Seed Data Generator
 * Creates a realistic 97-combine fleet with crews, fields, and sample campaigns
 * Run: npx tsx src/seeds/run.ts
 */

import { pool, transaction } from "../models/db.js";
import { logger } from "../utils/logger.js";

const COMBINE_MODELS = ["S790", "S780", "X9 1100", "S770", "S760"];
const CART_MODELS = ["Brent 2596", "J&M 1501", "Unverferth 1319"];
const TRUCK_MODELS = ["Peterbilt 579", "Kenworth T680", "Freightliner Cascadia"];
const CROP_TYPES = ["wheat", "corn", "soybeans", "sorghum"];
const STATES = ["TX", "OK", "KS", "NE", "SD", "ND"];
const SKILLS = ["s790", "x9", "s780", "s770", "header_repair", "electrical", "hydraulic"];

// Kansas wheat belt center for generating positions
const CENTER_LAT = 38.5;
const CENTER_LNG = -98.0;
const SPREAD = 1.5; // degrees spread for position randomization

function rng(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(rng(min, max));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function seed() {
  logger.info("Seeding database with development data...");

  await transaction(async (client) => {
    // ─── Organization ────────────────────────────────
    const { rows: [org] } = await client.query(
      `INSERT INTO organizations (name, timezone)
       VALUES ('Smith Custom Harvesting', 'America/Chicago')
       ON CONFLICT DO NOTHING
       RETURNING id`
    );
    const orgId = org?.id;
    if (!orgId) {
      logger.warn("Organization already exists, skipping seed");
      return;
    }

    // ─── Owner User ──────────────────────────────────
    await client.query(
      `INSERT INTO users (org_id, email, name, role, phone)
       VALUES ($1, 'owner@smithharvesting.com', 'Mike Smith', 'owner', '316-555-0100')`,
      [orgId]
    );

    // ─── 97 Combines ─────────────────────────────────
    logger.info("Creating 97 combines...");
    for (let i = 1; i <= 97; i++) {
      const model = pick(COMBINE_MODELS);
      const displayType = rng(0, 1) > 0.3 ? (rng(0, 1) > 0.5 ? "g5" : "gen4") : "none";
      const year = Math.floor(rng(2019, 2026));

      const { rows: [machine] } = await client.query(
        `INSERT INTO machines (org_id, machine_type, name, make, model, year, engine_hours, display_type, jdlink_enabled)
         VALUES ($1, 'combine', $2, 'John Deere', $3, $4, $5, $6, true)
         RETURNING id`,
        [orgId, `Combine ${String(i).padStart(2, "0")}`, model, year, Math.floor(rng(1000, 8000)), displayType]
      );

      // Insert a current position
      const lat = CENTER_LAT + rng(-SPREAD, SPREAD);
      const lng = CENTER_LNG + rng(-SPREAD, SPREAD);
      const statuses = ["harvesting", "harvesting", "harvesting", "moving", "idle", "idle"];

      await client.query(
        `INSERT INTO machine_locations (machine_id, position, heading, speed_mph, fuel_pct, engine_state, status, recorded_at)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, $7, $8, now() - interval '${Math.floor(rng(0, 10))} minutes')`,
        [machine.id, lng, lat, rng(0, 360), rng(0, 5), rng(20, 95), rng(0, 1) > 0.3 ? "running" : "idle", pick(statuses)]
      );
    }

    // ─── Support Equipment ───────────────────────────
    logger.info("Creating support equipment...");
    for (let i = 1; i <= 24; i++) {
      const type = i <= 12 ? "grain_cart" : i <= 20 ? "truck" : i <= 22 ? "fuel_tender" : "service_rig";
      const model = type === "grain_cart" ? pick(CART_MODELS) : type === "truck" ? pick(TRUCK_MODELS) : "Custom";
      const name = type === "grain_cart" ? `Cart ${String(i).padStart(2, "0")}`
        : type === "truck" ? `Truck ${String(i - 12).padStart(2, "0")}`
        : type === "fuel_tender" ? `Tender ${String(i - 20).padStart(2, "0")}`
        : `Service Rig ${String(i - 22).padStart(2, "0")}`;

      await client.query(
        `INSERT INTO machines (org_id, machine_type, name, make, model, data_source, jdlink_enabled, display_type)
         VALUES ($1, $2, $3, $4, $5, 'manual', false, 'none')`,
        [orgId, type, name, type === "grain_cart" ? pick(["Brent", "J&M", "Unverferth"]) : pick(["Peterbilt", "Kenworth"]), model]
      );
    }

    // ─── Crew Members ────────────────────────────────
    logger.info("Creating 65 crew members...");
    const firstNames = ["Jake", "Ryan", "Travis", "Cody", "Kyle", "Tyler", "Austin", "Brandon", "Dustin", "Logan", "Cole", "Brett", "Chase", "Blake", "Derek", "Shane", "Wyatt", "Caleb", "Mason", "Hunter"];
    const lastNames = ["Mitchell", "Johnson", "Anderson", "Thompson", "Davis", "Wilson", "Miller", "Brown", "Garcia", "Martinez", "Clark", "Lewis", "Walker", "Hall", "Young", "King", "Wright", "Hill", "Scott", "Green"];

    for (let i = 0; i < 65; i++) {
      const role = i < 8 ? "foreman" : i < 55 ? "crew_lead" : "support_coordinator";
      await client.query(
        `INSERT INTO crew_members (org_id, name, phone, role, skills, max_shift_hours, min_rest_hours)
         VALUES ($1, $2, $3, $4, $5, 12, 8)`,
        [orgId, `${pick(firstNames)} ${pick(lastNames)}`, `316-555-${String(1000 + i).slice(1)}`, role, randomSubset(SKILLS, 2, 5)]
      );
    }

    // ─── Customers & Fields ──────────────────────────
    logger.info("Creating customers and fields...");
    const customerNames = [
      "Johnson Farms", "Miller & Sons", "Peterson Agricultural", "Davis Creek Ranch",
      "Thompson Ridge Farms", "Wilson Flat Co-op", "Anderson West Holdings",
      "Clark Bottom Farms", "Harper South LLC", "Evans North Ranch",
      "Baker Family Farms", "Ross Field Operations", "Carter Plains Inc",
      "Morgan Wheat Corp", "Bennett Grain Co",
    ];

    for (const custName of customerNames) {
      const { rows: [customer] } = await client.query(
        `INSERT INTO customers (org_id, name, contact_name, contact_phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [orgId, custName, custName.split(" ")[0] + " Owner", `316-555-${String(Math.floor(rng(2000, 9000)))}` ]
      );

      // 3-6 fields per customer
      const fieldCount = Math.floor(rng(3, 7));
      const fieldSuffixes = ["North 40", "South 80", "East Quarter", "West Half", "Creek Bottom", "Ridge Top", "Home Place"];

      for (let f = 0; f < fieldCount; f++) {
        const lat = CENTER_LAT + rng(-SPREAD, SPREAD);
        const lng = CENTER_LNG + rng(-SPREAD, SPREAD);
        const acreage = Math.floor(rng(80, 640));
        const crop = pick(CROP_TYPES);
        const status = pick(["not_started", "ready", "in_progress", "in_progress", "completed"]);

        await client.query(
          `INSERT INTO fields (org_id, customer_id, name, centroid, entry_point, entry_point_desc, acreage, crop_type, status, readiness_date, priority, estimated_yield, pct_complete, state)
           VALUES ($1, $2, $3,
                   ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
                   ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
                   $8, $9, $10, $11, $12, $13, $14, $15, 'KS')`,
          [
            orgId, customer.id, `${custName.split(" ")[0]} ${pick(fieldSuffixes)}`,
            lng, lat,
            lng + rng(-0.005, 0.005), lat + rng(-0.005, 0.005),
            `County Rd ${Math.floor(rng(1, 40))} gate (${pick(["north", "south", "east", "west"])})`,
            acreage, crop, status,
            `2026-06-${String(Math.floor(rng(1, 30))).padStart(2, "0")}`,
            Math.floor(rng(1, 8)),
            crop === "wheat" ? rng(40, 70) : crop === "corn" ? rng(150, 220) : rng(35, 60),
            status === "completed" ? 100 : status === "in_progress" ? rng(10, 90) : 0,
          ]
        );
      }
    }

    // ─── Default Rule Set ────────────────────────────
    logger.info("Creating default rule set...");
    const { rows: [ruleSet] } = await client.query(
      `INSERT INTO rule_sets (org_id, name, is_active, version)
       VALUES ($1, 'Wheat Standard 2026', true, 1)
       RETURNING id`,
      [orgId]
    );

    // Hard constraints
    const constraints = [
      ["Max Daily Move Distance", "move_distance", ">", "200", "miles", "block"],
      ["Crew Shift Limit", "shift_duration", ">", "12", "hours", "block"],
      ["Grain Cart Proximity", "cart_distance", ">", "5", "miles", "alert"],
      ["Min Rest Between Shifts", "rest_hours", "<", "8", "hours", "block"],
    ];
    for (const [name, field, op, val, unit, action] of constraints) {
      await client.query(
        `INSERT INTO rules (rule_set_id, name, rule_type, condition_field, condition_op, condition_value, condition_unit, action, sort_order)
         VALUES ($1, $2, 'constraint', $3, $4, $5, $6, $7, $8)`,
        [ruleSet.id, name, field, op, val, unit, action, constraints.indexOf([name, field, op, val, unit, action])]
      );
    }

    // Optimization weights
    const weights = [
      ["travel_distance", 40], ["yield", 30], ["workload", 20], ["fuel", 10],
    ];
    for (const [factor, pct] of weights) {
      await client.query(
        `INSERT INTO optimization_weights (rule_set_id, factor, weight_pct)
         VALUES ($1, $2, $3)`,
        [ruleSet.id, factor, pct]
      );
    }

    // ─── Sample Campaign ─────────────────────────────
    await client.query(
      `INSERT INTO campaigns (org_id, name, crop_type, region, state, start_date, end_date, status)
       VALUES ($1, 'Kansas Wheat — June 2026', 'wheat', 'Central Kansas', 'KS', '2026-06-10', '2026-07-05', 'active')`,
      [orgId]
    );

    logger.info("Seed complete: 97 combines, 24 support, 65 crew, 15 customers, ~70 fields, 1 rule set, 1 campaign");
  });
}

// Run directly
seed()
  .then(() => {
    logger.info("Seed finished successfully");
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, "Seed failed");
    process.exit(1);
  });
