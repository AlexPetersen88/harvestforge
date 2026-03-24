import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { config, isDev } from "./config/index.js";
import { logger } from "./utils/logger.js";

// Route imports
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { machineRoutes } from "./routes/machines.js";
import { fieldRoutes } from "./routes/fields.js";
import { crewRoutes } from "./routes/crew.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { planRoutes } from "./routes/plans.js";
import { assignmentRoutes } from "./routes/assignments.js";
import { ruleRoutes } from "./routes/rules.js";
import { replanRoutes } from "./routes/replan.js";
import { briefingRoutes } from "./routes/briefing.js";
import { alertRoutes } from "./routes/alerts.js";
import { breakdownRoutes } from "./routes/breakdowns.js";
import { reconciliationRoutes } from "./routes/reconciliation.js";
import { reportRoutes } from "./routes/reports.js";
import { mobileRoutes } from "./routes/mobile.js";
import { weatherRoutes } from "./routes/weather.js";
import { syncRoutes } from "./routes/sync.js";
import { convoyRoutes } from "./routes/convoys.js";
import { registerWebSocket } from "./services/websocket.js";

export async function buildApp() {
  const app = Fastify({
    logger: false, // we use our own pino instance
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // ─── Plugins ─────────────────────────────────────────────
  await app.register(cors, {
    origin: isDev ? true : ["https://app.harvestforge.io"],
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(websocket);

  // ─── Global hooks ────────────────────────────────────────
  app.addHook("onRequest", async (request) => {
    logger.debug(
      { method: request.method, url: request.url },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration: reply.elapsedTime?.toFixed(1),
      },
      "Request completed"
    );
  });

  // ─── Auth decorator ──────────────────────────────────────
  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired token",
        },
      });
    }
  });

  // ─── Routes ──────────────────────────────────────────────
  // Public
  await app.register(healthRoutes, { prefix: "/v1" });
  await app.register(authRoutes, { prefix: "/v1/auth" });

  // Protected — all require authentication
  await app.register(
    async (protectedApp) => {
      protectedApp.addHook("onRequest", (app as any).authenticate);

      await protectedApp.register(machineRoutes, { prefix: "/machines" });
      await protectedApp.register(fieldRoutes, { prefix: "/fields" });
      await protectedApp.register(crewRoutes, { prefix: "/crew" });
      await protectedApp.register(campaignRoutes, { prefix: "/campaigns" });
      await protectedApp.register(planRoutes, { prefix: "/plans" });
      await protectedApp.register(assignmentRoutes, { prefix: "/assignments" });
      await protectedApp.register(ruleRoutes, { prefix: "/rule-sets" });
      await protectedApp.register(replanRoutes, { prefix: "/replan" });
      await protectedApp.register(briefingRoutes, { prefix: "/briefing" });
      await protectedApp.register(alertRoutes, { prefix: "/alerts" });
      await protectedApp.register(breakdownRoutes, { prefix: "/breakdowns" });
      await protectedApp.register(reconciliationRoutes, { prefix: "/reconciliation" });
      await protectedApp.register(reportRoutes, { prefix: "/reports" });
      await protectedApp.register(mobileRoutes, { prefix: "/mobile" });
      await protectedApp.register(weatherRoutes, { prefix: "/weather" });
      await protectedApp.register(syncRoutes, { prefix: "/sync" });
      await protectedApp.register(convoyRoutes, { prefix: "/convoys" });
    },
    { prefix: "/v1" }
  );

  // ─── WebSocket ───────────────────────────────────────────
  await registerWebSocket(app);

  return app;
}
