/**
 * WebSocket Real-Time Event Handler
 * Subscribes to Redis pub/sub channels and broadcasts to connected clients.
 *
 * Events: machine.position_updated, assignment.status_changed, alert.created,
 *         convoy.desync, plan.dispatched, replan.proposed, briefing.ready,
 *         breakdown.reported, anomaly.detected, field.completed
 */

import type { FastifyInstance } from "fastify";
import { subscriber, CHANNELS } from "../models/redis.js";
import { logger } from "../utils/logger.js";
import type { WebSocket } from "ws";

interface ConnectedClient {
  ws: WebSocket;
  orgId: string;
  userId: string;
  subscribedEvents: Set<string>;
}

const clients = new Map<string, ConnectedClient>();

// Map Redis channels to WebSocket event types
const CHANNEL_TO_EVENT: Record<string, string> = {
  [CHANNELS.MACHINE_UPDATE]: "machine.position_updated",
  [CHANNELS.ASSIGNMENT_UPDATE]: "assignment.status_changed",
  [CHANNELS.ALERT_CREATED]: "alert.created",
  [CHANNELS.CONVOY_DESYNC]: "convoy.desync",
  [CHANNELS.PLAN_DISPATCHED]: "plan.dispatched",
  [CHANNELS.REPLAN_PROPOSED]: "replan.proposed",
  [CHANNELS.BRIEFING_READY]: "briefing.ready",
  [CHANNELS.BREAKDOWN_REPORTED]: "breakdown.reported",
  [CHANNELS.ANOMALY_DETECTED]: "anomaly.detected",
  [CHANNELS.FIELD_COMPLETED]: "field.completed",
};

/**
 * Register WebSocket route and set up Redis pub/sub bridge.
 */
export async function registerWebSocket(app: FastifyInstance) {
  // Subscribe to all HarvestForge channels
  const channels = Object.values(CHANNELS);
  await subscriber.subscribe(...channels);

  subscriber.on("message", (channel: string, message: string) => {
    const eventType = CHANNEL_TO_EVENT[channel];
    if (!eventType) return;

    try {
      const payload = JSON.parse(message);
      const orgId = payload.org_id;

      // Broadcast to all clients in this org
      for (const [, client] of clients) {
        if (client.orgId !== orgId) continue;
        if (client.ws.readyState !== 1) continue; // OPEN

        client.ws.send(
          JSON.stringify({
            type: eventType,
            payload,
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (err) {
      logger.error({ channel, err }, "Failed to broadcast WebSocket event");
    }
  });

  // WebSocket endpoint
  app.get("/ws", { websocket: true }, (socket, request) => {
    const clientId = crypto.randomUUID();

    // TODO: Extract orgId and userId from JWT in production
    const orgId = "default";
    const userId = "default";

    clients.set(clientId, {
      ws: socket,
      orgId,
      userId,
      subscribedEvents: new Set(Object.values(CHANNEL_TO_EVENT)),
    });

    logger.info({ clientId, total: clients.size }, "WebSocket client connected");

    // Send initial connection confirmation
    socket.send(
      JSON.stringify({
        type: "connected",
        payload: { client_id: clientId, subscribed_events: Object.values(CHANNEL_TO_EVENT) },
        timestamp: new Date().toISOString(),
      })
    );

    // Handle client messages (e.g., subscribe/unsubscribe)
    socket.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "subscribe" && msg.events) {
          const client = clients.get(clientId);
          if (client) {
            for (const evt of msg.events) client.subscribedEvents.add(evt);
          }
        }

        if (msg.type === "unsubscribe" && msg.events) {
          const client = clients.get(clientId);
          if (client) {
            for (const evt of msg.events) client.subscribedEvents.delete(evt);
          }
        }

        // Ping/pong keepalive
        if (msg.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on("close", () => {
      clients.delete(clientId);
      logger.debug({ clientId, total: clients.size }, "WebSocket client disconnected");
    });

    socket.on("error", (err) => {
      logger.warn({ clientId, err: err.message }, "WebSocket error");
      clients.delete(clientId);
    });
  });

  logger.info({ channels: channels.length }, "WebSocket handler registered");
}

/**
 * Get count of currently connected WebSocket clients.
 */
export function getConnectedClientCount(): number {
  return clients.size;
}
