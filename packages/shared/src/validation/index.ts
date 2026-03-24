import { z } from "zod";

// GeoJSON validators
export const geoPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});

export const geoPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

// Machine
export const createMachineSchema = z.object({
  machine_type: z.enum(["combine", "grain_cart", "truck", "fuel_tender", "service_rig", "other"]),
  name: z.string().min(1).max(100),
  make: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  year: z.number().int().min(1990).max(2030).optional(),
  capacity: z.string().optional(),
  data_source: z.enum(["jdlink_live", "manual", "third_party"]).default("manual"),
  display_type: z.enum(["gen4", "g5", "none"]).default("none"),
});

export const manualLocationSchema = z.object({
  location: geoPointSchema,
  fuel_pct: z.number().min(0).max(100).optional(),
  status: z.enum(["harvesting", "moving", "idle", "breakdown", "maintenance", "offline"]).optional(),
});

// Field
export const createFieldSchema = z.object({
  customer_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  boundary: geoPolygonSchema.optional(),
  entry_point: geoPointSchema.optional(),
  entry_point_desc: z.string().max(200).optional(),
  acreage: z.number().positive().optional(),
  crop_type: z.enum(["wheat", "corn", "soybeans", "sorghum", "canola", "barley", "oats", "other"]).optional(),
  readiness_date: z.string().date().optional(),
  priority: z.number().int().min(1).max(10).default(5),
  estimated_yield: z.number().positive().optional(),
  county: z.string().optional(),
  state: z.string().max(2).optional(),
});

export const updateEntryPointSchema = z.object({
  entry_point: geoPointSchema,
  entry_point_desc: z.string().max(200).optional(),
});

// Crew
export const createCrewSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  role: z.enum(["owner", "foreman", "crew_lead", "support_coordinator", "admin"]).default("crew_lead"),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  max_shift_hours: z.number().min(4).max(24).default(12),
  min_rest_hours: z.number().min(4).max(24).default(8),
});

// Campaign
export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  crop_type: z.enum(["wheat", "corn", "soybeans", "sorghum", "canola", "barley", "oats", "other"]).optional(),
  region: z.string().optional(),
  state: z.string().max(2).optional(),
  start_date: z.string().date(),
  end_date: z.string().date().optional(),
  field_ids: z.array(z.string().uuid()).optional(),
});

// Assignment
export const createAssignmentSchema = z.object({
  daily_plan_id: z.string().uuid(),
  machine_id: z.string().uuid(),
  field_id: z.string().uuid(),
  crew_member_id: z.string().uuid().optional(),
  scheduled_start: z.string().datetime().optional(),
  scheduled_end: z.string().datetime().optional(),
});

export const updateAssignmentStatusSchema = z.object({
  status: z.enum(["planned", "dispatched", "in_progress", "completed", "cancelled", "reassigned"]),
  source: z.enum(["app", "voice", "system"]).optional(),
  raw_voice_text: z.string().optional(),
  location: geoPointSchema.optional(),
});

// Rules
export const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  rule_type: z.enum(["constraint", "priority"]),
  condition_field: z.string(),
  condition_op: z.enum([">", "<", "=", ">=", "<="]),
  condition_value: z.string(),
  condition_unit: z.string().optional(),
  action: z.enum(["block", "alert", "prefer", "deprioritize", "require_support", "exclude"]),
  action_params: z.record(z.any()).default({}),
  weight_pct: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
});

export const updateWeightsSchema = z.object({
  weights: z.array(z.object({
    factor: z.string(),
    weight_pct: z.number().min(0).max(100),
  })).refine(
    (w) => Math.abs(w.reduce((sum, x) => sum + x.weight_pct, 0) - 100) < 0.01,
    { message: "Weights must sum to 100%" }
  ),
});

// Replan
export const triggerReplanSchema = z.object({
  trigger: z.enum(["breakdown", "weather", "early_completion", "customer_change", "morning_briefing", "manual"]),
  trigger_ref_id: z.string().uuid().optional(),
  daily_plan_id: z.string().uuid(),
  constraints: z.object({
    preserve_assignments: z.array(z.string().uuid()).optional(),
    exclude_machines: z.array(z.string().uuid()).optional(),
  }).optional(),
});

// Simulate
export const simulateSchema = z.object({
  base_plan_id: z.string().uuid(),
  modifications: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("remove_machine"), machine_id: z.string().uuid(), duration_days: z.number().int().positive() }),
    z.object({ type: z.literal("add_weather_delay"), field_ids: z.array(z.string().uuid()), delay_hours: z.number().positive() }),
    z.object({ type: z.literal("change_readiness"), field_id: z.string().uuid(), new_date: z.string().date() }),
  ])),
});

// Breakdown report
export const reportBreakdownSchema = z.object({
  machine_id: z.string().uuid(),
  description: z.string().optional(),
  location: geoPointSchema.optional(),
  voice_note_url: z.string().url().optional(),
  photo_urls: z.array(z.string().url()).default([]),
});

// Voice status
export const voiceStatusSchema = z.object({
  raw_text: z.string().min(1),
  audio_url: z.string().url().optional(),
  location: geoPointSchema.optional(),
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
});
