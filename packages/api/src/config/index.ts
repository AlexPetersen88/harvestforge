import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../../.env" });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3001),

  // Database
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // Solver
  SOLVER_URL: z.string().url().default("http://localhost:8001"),

  // Auth
  JWT_SECRET: z.string().min(16),
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_CLIENT_ID: z.string().optional(),
  AUTH0_CLIENT_SECRET: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),

  // John Deere
  JD_CLIENT_ID: z.string().optional(),
  JD_CLIENT_SECRET: z.string().optional(),
  JD_REDIRECT_URI: z.string().url().optional(),
  JD_SCOPES: z.string().default("ag1 ag2 ag3 eq1 eq2"),

  // External services
  MAPBOX_TOKEN: z.string().optional(),
  WEATHER_API_KEY: z.string().optional(),
  WEATHER_PROVIDER: z
    .enum(["tomorrow_io", "openweather"])
    .default("tomorrow_io"),

  // AWS
  AWS_REGION: z.string().default("us-east-1"),
  AWS_S3_BUCKET: z.string().default("harvestforge-media"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

// Derived config
export const isDev = config.NODE_ENV === "development";
export const isProd = config.NODE_ENV === "production";

// JD API base URLs
export const JD_AUTH_URL = "https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7";
export const JD_API_URL = "https://sandboxapi.deere.com/platform";
export const JD_API_URL_PROD = "https://api.deere.com/platform";

// Polling intervals (seconds)
export const POLL_INTERVALS = {
  machine_locations: 300,     // 5 min
  field_operations: 600,      // 10 min
  device_state: 900,          // 15 min
  equipment: 86400,           // daily
  setup_plans: 86400,         // daily
} as const;

// Anomaly detection thresholds
export const ANOMALY_THRESHOLDS = {
  speed_deviation_pct: 15,        // flag if 15% below baseline
  fuel_deviation_pct: 20,         // flag if 20% above baseline fuel burn
  idle_threshold_min: 30,         // flag if idle > 30 min
  stale_data_threshold_min: 15,   // gray out if no data for 15 min
  convoy_gap_threshold_min: 15,   // alert if convoy members > 15 min apart
} as const;
