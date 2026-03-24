import { pool } from "../models/db.js";
import { logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

async function reset() {
  logger.info("Resetting database...");
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await pool.query("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; CREATE EXTENSION IF NOT EXISTS \"postgis\"; CREATE EXTENSION IF NOT EXISTS \"btree_gist\";");

  const migrationPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations/001_initial_schema.sql");
  const sql = fs.readFileSync(migrationPath, "utf-8");
  await pool.query(sql);

  logger.info("Schema recreated. Run npm run db:seed to populate.");
  process.exit(0);
}

reset().catch((err) => { logger.error({ err }, "Reset failed"); process.exit(1); });
