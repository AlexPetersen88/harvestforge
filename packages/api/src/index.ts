import { buildApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { pool } from "./models/db.js";
import { startSyncScheduler, stopSyncScheduler } from "./services/sync-scheduler.js";

async function start() {
  const app = await buildApp();

  // Start JD sync polling
  startSyncScheduler();

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info({ signal }, "Shutting down...");
      stopSyncScheduler();
      await app.close();
      await pool.end();
      process.exit(0);
    });
  });

  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info(
      `
  ╔══════════════════════════════════════════════╗
  ║   🌾  HarvestForge API v3.0                 ║
  ║   Running on port ${config.PORT}                     ║
  ║   Environment: ${config.NODE_ENV.padEnd(28)}║
  ╚══════════════════════════════════════════════╝
    `.trim()
    );
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

start();
