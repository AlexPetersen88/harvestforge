import Redis from "ioredis";
import { config, isDev } from "../config/index.js";
import { logger } from "../utils/logger.js";

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error({ err }, "Redis error"));

// Cache helpers with JSON serialization
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, raw);
    } else {
      await redis.set(key, raw);
    }
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },
};

// Pub/Sub for real-time events (WebSocket broadcasts)
export const publisher = redis.duplicate();
export const subscriber = redis.duplicate();

export const CHANNELS = {
  MACHINE_UPDATE: "hf:machine:update",
  ASSIGNMENT_UPDATE: "hf:assignment:update",
  ALERT_CREATED: "hf:alert:created",
  CONVOY_DESYNC: "hf:convoy:desync",
  PLAN_DISPATCHED: "hf:plan:dispatched",
  REPLAN_PROPOSED: "hf:replan:proposed",
  BRIEFING_READY: "hf:briefing:ready",
  BREAKDOWN_REPORTED: "hf:breakdown:reported",
  ANOMALY_DETECTED: "hf:anomaly:detected",
  FIELD_COMPLETED: "hf:field:completed",
} as const;
