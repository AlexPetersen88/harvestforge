// ============================================================
// HarvestForge Shared Types v3.0
// Domain types used across API, Web, Mobile, and Solver
// ============================================================

// ─── Enums ─────────────────────────────────────────────────

export type UserRole =
  | "owner"
  | "foreman"
  | "crew_lead"
  | "support_coordinator"
  | "admin";

export type MachineType =
  | "combine"
  | "grain_cart"
  | "truck"
  | "fuel_tender"
  | "service_rig"
  | "other";

export type MachineStatus =
  | "harvesting"
  | "moving"
  | "idle"
  | "breakdown"
  | "maintenance"
  | "offline";

export type DataSource = "jdlink_live" | "manual" | "third_party";

export type DisplayCapability = "gen4" | "g5" | "none";

export type CropType =
  | "wheat"
  | "corn"
  | "soybeans"
  | "sorghum"
  | "canola"
  | "barley"
  | "oats"
  | "other";

export type FieldStatus =
  | "not_started"
  | "ready"
  | "in_progress"
  | "completed"
  | "on_hold";

export type RuleType = "constraint" | "priority";

export type RuleAction =
  | "block"
  | "alert"
  | "prefer"
  | "deprioritize"
  | "require_support"
  | "exclude";

export type AssignmentStatus =
  | "planned"
  | "dispatched"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "reassigned";

export type PlanStatus = "draft" | "active" | "completed" | "archived";

export type AlertLevel = "critical" | "warning" | "info";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "dismissed";

export type AnomalyType =
  | "slow_performance"
  | "high_fuel_burn"
  | "early_finish"
  | "late_start"
  | "route_deviation"
  | "diagnostic_flag"
  | "idle_extended";

export type BriefingAction = "applied" | "modified" | "dismissed" | "deferred";

export type ReplanTrigger =
  | "breakdown"
  | "weather"
  | "early_completion"
  | "customer_change"
  | "morning_briefing"
  | "manual";

export type HarvestWindow = "clear" | "marginal" | "unsuitable";

// ─── GeoJSON ───────────────────────────────────────────────

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

export interface GeoLineString {
  type: "LineString";
  coordinates: [number, number][];
}

// ─── Core Entities ─────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  jd_org_id?: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  preferences: UserPreferences;
}

export interface UserPreferences {
  dark_mode?: boolean;
  harvest_mode?: boolean;
  default_region?: string;
  notification_level?: AlertLevel;
}

// ─── Fleet ─────────────────────────────────────────────────

export interface Machine {
  id: string;
  org_id: string;
  jd_equipment_id?: string;
  machine_type: MachineType;
  name: string;
  make?: string;
  model?: string;
  serial_number?: string;
  year?: number;
  engine_hours?: number;
  jdlink_enabled: boolean;
  display_type: DisplayCapability;
  data_source: DataSource;
  capacity?: string;
  is_active: boolean;
  notes?: string;
}

export interface MachinePosition {
  location: GeoPoint;
  heading?: number;
  speed_mph?: number;
  fuel_pct?: number;
  engine_state?: string;
  status: MachineStatus;
  data_source: DataSource;
  recorded_at: string;
  is_stale: boolean;
}

export interface MachineWithPosition extends Machine {
  current_position?: MachinePosition;
}

export interface PerformanceBaseline {
  crop_type: CropType;
  avg_speed_mph: number;
  avg_acres_hr: number;
  avg_fuel_rate: number;
  sample_hours: number;
}

// ─── Crew ──────────────────────────────────────────────────

export interface CrewMember {
  id: string;
  org_id: string;
  user_id?: string;
  name: string;
  phone?: string;
  role: UserRole;
  skills: string[];
  certifications: string[];
  max_shift_hours: number;
  min_rest_hours: number;
  is_active: boolean;
  notes?: string;
}

export interface HOSStatus {
  crew_member_id: string;
  name: string;
  hours_today: number;
  max_shift_hours: number;
  hours_remaining: number;
  is_compliant: boolean;
  last_rest_hours: number;
  fatigue_score?: number;
}

// ─── Customers & Fields ────────────────────────────────────

export interface Customer {
  id: string;
  org_id: string;
  jd_client_id?: string;
  name: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface Field {
  id: string;
  org_id: string;
  customer_id: string;
  customer?: Pick<Customer, "id" | "name">;
  jd_field_id?: string;
  name: string;
  boundary?: GeoPolygon;
  centroid?: GeoPoint;
  entry_point?: GeoPoint;
  entry_point_desc?: string;
  acreage?: number;
  crop_type?: CropType;
  status: FieldStatus;
  readiness_date?: string;
  priority: number;
  estimated_yield?: number;
  actual_yield?: number;
  pct_complete: number;
  county?: string;
  state?: string;
}

export interface FieldWeather {
  next_24h: HarvestWindow;
  next_48h: HarvestWindow;
  next_72h: HarvestWindow;
  precip_prob_24h: number;
  precip_prob_48h: number;
  precip_prob_72h: number;
}

export interface FieldWithWeather extends Field {
  weather?: FieldWeather;
}

// ─── Campaigns & Plans ─────────────────────────────────────

export interface Campaign {
  id: string;
  org_id: string;
  name: string;
  crop_type?: CropType;
  region?: string;
  state?: string;
  start_date: string;
  end_date?: string;
  status: PlanStatus;
}

export interface DailyPlan {
  id: string;
  org_id: string;
  campaign_id?: string;
  campaign?: Pick<Campaign, "id" | "name">;
  plan_date: string;
  status: PlanStatus;
  rule_set_id?: string;
  rule_set?: Pick<RuleSet, "id" | "name">;
  optimizer_score?: number;
  generation_time_ms?: number;
  assignments?: Assignment[];
  convoys?: Convoy[];
  metrics?: PlanMetrics;
}

export interface PlanMetrics {
  total_assignments: number;
  total_miles: number;
  estimated_acres: number;
  avg_utilization_pct: number;
}

export interface Assignment {
  id: string;
  daily_plan_id: string;
  machine_id: string;
  machine?: Pick<Machine, "id" | "name" | "machine_type">;
  field_id: string;
  field?: Pick<Field, "id" | "name" | "acreage">;
  crew_member_id?: string;
  crew_member?: Pick<CrewMember, "id" | "name">;
  status: AssignmentStatus;
  sequence_order?: number;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  route_geom?: GeoLineString;
  route_distance_mi?: number;
  route_eta_min?: number;
  optimizer_score?: number;
  pushed_to_display: boolean;
  pushed_at?: string;
  notes?: string;
}

// ─── Convoys ───────────────────────────────────────────────

export interface Convoy {
  id: string;
  daily_plan_id: string;
  field_id: string;
  field?: Pick<Field, "id" | "name">;
  name?: string;
  target_arrival?: string;
  max_gap_min: number;
  is_synced: boolean;
  members: ConvoyMember[];
}

export interface ConvoyMember {
  machine_id: string;
  machine?: Pick<Machine, "id" | "name" | "machine_type">;
  assignment_id?: string;
  eta_min?: number;
  actual_arrival?: string;
  is_lead: boolean;
}

// ─── Rules Engine ──────────────────────────────────────────

export interface RuleSet {
  id: string;
  org_id: string;
  name: string;
  is_template: boolean;
  is_active: boolean;
  version: number;
  parent_id?: string;
  rules?: Rule[];
  optimization_weights?: OptimizationWeight[];
  version_history?: RuleVersionEntry[];
}

export interface Rule {
  id: string;
  rule_set_id: string;
  name: string;
  rule_type: RuleType;
  is_enabled: boolean;
  condition_field: string;
  condition_op: string;
  condition_value: string;
  condition_unit?: string;
  action: RuleAction;
  action_params: Record<string, any>;
  weight_pct?: number;
  sort_order: number;
  description?: string;
}

export interface OptimizationWeight {
  factor: string;
  weight_pct: number;
}

export interface RuleVersionEntry {
  version: number;
  changed_by: string;
  changed_at: string;
  changes_summary: string;
}

// ─── Morning Briefing ──────────────────────────────────────

export interface MorningBriefing {
  id: string;
  briefing_date: string;
  generated_at: string;
  changes_detected: number;
  changes: BriefingChange[];
  suggested_replans: BriefingReplan[];
  action_taken?: BriefingAction;
  completed_at?: string;
}

export interface BriefingChange {
  type: string;
  severity: AlertLevel;
  title: string;
  description: string;
  affected_fields?: string[];
  affected_machines?: string[];
}

export interface BriefingReplan {
  rank: number;
  name: string;
  score: number;
  description: string;
  delta: ReplanDelta;
  replan_id: string;
}

// ─── Replans ───────────────────────────────────────────────

export interface ReplanDelta {
  miles_change: number;
  hours_change: number;
  fuel_change_pct: number;
  score_change?: number;
  completion_date_change_days?: number;
  convoy_disruptions?: number;
}

export interface ReplanProposal {
  replan_id: string;
  solver_time_ms: number;
  proposed_plan: {
    optimizer_score: number;
    changes: ReplanChange[];
    delta: ReplanDelta;
  };
}

export interface ReplanChange {
  type: "reassign" | "cancel" | "add" | "reschedule";
  machine: Pick<Machine, "id" | "name">;
  from_field?: Pick<Field, "id" | "name">;
  to_field?: Pick<Field, "id" | "name">;
  reason: string;
}

// ─── Anomalies & Alerts ────────────────────────────────────

export interface Anomaly {
  id: string;
  machine_id: string;
  machine?: Pick<Machine, "id" | "name">;
  anomaly_type: AnomalyType;
  severity: AlertLevel;
  description: string;
  metric_expected?: number;
  metric_actual?: number;
  deviation_pct?: number;
  detected_at: string;
  resolved_at?: string;
  auto_action?: string;
  user_action?: string;
}

export interface Alert {
  id: string;
  level: AlertLevel;
  status: AlertStatus;
  title: string;
  message: string;
  machine_id?: string;
  field_id?: string;
  anomaly_id?: string;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

// ─── Breakdowns ────────────────────────────────────────────

export interface Breakdown {
  id: string;
  machine_id: string;
  machine?: Pick<Machine, "id" | "name">;
  reported_by?: string;
  reported_at: string;
  location?: GeoPoint;
  description?: string;
  voice_note_url?: string;
  photo_urls: string[];
  nearest_service_rig?: {
    machine_id: string;
    name: string;
    distance_mi: number;
    eta_min: number;
  };
  resolved_at?: string;
  resolution_notes?: string;
}

// ─── Weather ───────────────────────────────────────────────

export interface WeatherForecast {
  forecast_time: string;
  conditions: string;
  temp_f: number;
  precip_prob_pct: number;
  precip_inches?: number;
  wind_mph: number;
  humidity_pct?: number;
  harvest_window: HarvestWindow;
}

// ─── Mobile ────────────────────────────────────────────────

export interface MobileAssignmentView {
  crew_member: Pick<CrewMember, "id" | "name">;
  current?: {
    assignment_id: string;
    machine_name: string;
    field_name: string;
    status: AssignmentStatus;
    pct_complete: number;
    fuel_pct: number;
    eta_done: string;
  };
  next?: {
    assignment_id: string;
    field_name: string;
    entry_point?: GeoPoint;
    entry_point_desc?: string;
    distance_mi: number;
    eta_min: number;
    acreage: number;
    crop_type?: CropType;
  };
  convoy?: {
    members: {
      name: string;
      type: MachineType;
      eta_label?: string;
      eta_min?: number;
    }[];
  };
  hos: Pick<HOSStatus, "hours_worked" | "hours_remaining" | "is_compliant">;
}

export interface VoiceStatusParsed {
  machine: string;
  action: string;
  field: string;
  next_action?: string;
}

// ─── Reports ───────────────────────────────────────────────

export interface UtilizationReport {
  machine_id: string;
  machine_name: string;
  hours_harvesting: number;
  hours_moving: number;
  hours_idle: number;
  utilization_pct: number;
}

export interface CostPerFieldReport {
  field: Pick<Field, "id" | "name" | "acreage">;
  customer: Pick<Customer, "id" | "name">;
  total_hours: number;
  total_miles: number;
  estimated_fuel_gal: number;
  crew_hours: number;
  cost_per_acre: number;
}

// ─── Reconciliation ────────────────────────────────────────

export interface Reconciliation {
  plan_date: string;
  planned_assignments: number;
  completed_assignments: number;
  completion_rate_pct: number;
  variance_items: VarianceItem[];
  anomaly_summary: AnomalySummaryItem[];
  confirmed_by?: string;
  confirmed_at?: string;
}

export interface VarianceItem {
  type: string;
  machine_name: string;
  planned: string;
  actual: string;
  duration_min?: number;
  needs_review: boolean;
}

export interface AnomalySummaryItem {
  anomaly_id: string;
  machine_name: string;
  type: AnomalyType;
  recommended_action: string;
}

// ─── WebSocket Events ──────────────────────────────────────

export type WSEventType =
  | "machine.position_updated"
  | "assignment.status_changed"
  | "alert.created"
  | "convoy.desync"
  | "plan.dispatched"
  | "replan.proposed"
  | "briefing.ready"
  | "breakdown.reported"
  | "anomaly.detected"
  | "field.completed";

export interface WSEvent<T = any> {
  type: WSEventType;
  payload: T;
  timestamp: string;
}

// ─── API Response Envelope ─────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta: {
    request_id: string;
    timestamp: string;
  };
}

export interface ApiPaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
  meta: {
    request_id: string;
    timestamp: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any[];
  };
  meta: {
    request_id: string;
    timestamp: string;
  };
}
