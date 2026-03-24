-- ============================================================
-- HarvestForge Logistics Planner — Database Schema v3.0
-- PostgreSQL 16 + PostGIS 3.4
-- March 2026
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- for exclusion constraints

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'owner', 'foreman', 'crew_lead', 'support_coordinator', 'admin'
);

CREATE TYPE machine_type AS ENUM (
    'combine', 'grain_cart', 'truck', 'fuel_tender', 'service_rig', 'other'
);

CREATE TYPE machine_status AS ENUM (
    'harvesting', 'moving', 'idle', 'breakdown', 'maintenance', 'offline'
);

CREATE TYPE data_source AS ENUM (
    'jdlink_live', 'manual', 'third_party'
);

CREATE TYPE display_capability AS ENUM (
    'gen4', 'g5', 'none'
);

CREATE TYPE crop_type AS ENUM (
    'wheat', 'corn', 'soybeans', 'sorghum', 'canola', 'barley', 'oats', 'other'
);

CREATE TYPE field_status AS ENUM (
    'not_started', 'ready', 'in_progress', 'completed', 'on_hold'
);

CREATE TYPE rule_type AS ENUM (
    'constraint', 'priority'
);

CREATE TYPE rule_action AS ENUM (
    'block', 'alert', 'prefer', 'deprioritize', 'require_support', 'exclude'
);

CREATE TYPE assignment_status AS ENUM (
    'planned', 'dispatched', 'in_progress', 'completed', 'cancelled', 'reassigned'
);

CREATE TYPE plan_status AS ENUM (
    'draft', 'active', 'completed', 'archived'
);

CREATE TYPE alert_level AS ENUM (
    'critical', 'warning', 'info'
);

CREATE TYPE alert_status AS ENUM (
    'active', 'acknowledged', 'resolved', 'dismissed'
);

CREATE TYPE anomaly_type AS ENUM (
    'slow_performance', 'high_fuel_burn', 'early_finish', 'late_start',
    'route_deviation', 'diagnostic_flag', 'idle_extended'
);

CREATE TYPE briefing_action AS ENUM (
    'applied', 'modified', 'dismissed', 'deferred'
);

CREATE TYPE replan_trigger AS ENUM (
    'breakdown', 'weather', 'early_completion', 'customer_change',
    'morning_briefing', 'manual'
);

CREATE TYPE notification_channel AS ENUM (
    'push', 'in_app', 'in_cab_display', 'email'
);


-- ============================================================
-- ORGANIZATIONS & USERS
-- ============================================================

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    jd_org_id       TEXT UNIQUE,            -- JD Ops Center organization ID
    jd_oauth_token  TEXT,                   -- encrypted OAuth access token
    jd_refresh_token TEXT,                  -- encrypted refresh token
    jd_token_expires_at TIMESTAMPTZ,
    timezone        TEXT NOT NULL DEFAULT 'America/Chicago',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    name            TEXT NOT NULL,
    role            user_role NOT NULL,
    phone           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    auth0_sub       TEXT UNIQUE,            -- Auth0 subject identifier
    preferences     JSONB DEFAULT '{}',     -- UI prefs: dark_mode, harvest_mode, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, email)
);

CREATE INDEX idx_users_org ON users(org_id) WHERE is_active = true;


-- ============================================================
-- CREW MANAGEMENT
-- ============================================================

CREATE TABLE crew_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),  -- nullable: not all crew have app accounts
    name            TEXT NOT NULL,
    phone           TEXT,
    role            user_role NOT NULL DEFAULT 'crew_lead',
    skills          TEXT[] DEFAULT '{}',         -- e.g., {'s790', 'x9', 'header_repair'}
    certifications  TEXT[] DEFAULT '{}',
    max_shift_hours NUMERIC(4,1) NOT NULL DEFAULT 12.0,
    min_rest_hours  NUMERIC(4,1) NOT NULL DEFAULT 8.0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crew_org ON crew_members(org_id) WHERE is_active = true;

CREATE TABLE crew_availability (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_member_id  UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
    available_from  DATE NOT NULL,
    available_to    DATE NOT NULL,
    region          TEXT,                       -- geographic availability constraint
    notes           TEXT,
    CONSTRAINT valid_date_range CHECK (available_to >= available_from)
);

CREATE TABLE crew_shift_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_member_id  UUID NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
    shift_start     TIMESTAMPTZ NOT NULL,
    shift_end       TIMESTAMPTZ,
    hours_worked    NUMERIC(5,2),
    fatigue_score   NUMERIC(3,1),              -- computed: 0-10 scale
    hos_compliant   BOOLEAN,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shift_log_crew ON crew_shift_log(crew_member_id, shift_start DESC);


-- ============================================================
-- FLEET / MACHINES
-- ============================================================

CREATE TABLE machines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    jd_equipment_id TEXT,                       -- JD Equipment API ID
    machine_type    machine_type NOT NULL,
    name            TEXT NOT NULL,              -- display name, e.g., "Combine 23"
    make            TEXT,
    model           TEXT,
    serial_number   TEXT,
    year            INT,
    engine_hours    NUMERIC(10,1),
    jdlink_enabled  BOOLEAN NOT NULL DEFAULT true,
    display_type    display_capability NOT NULL DEFAULT 'none',
    data_source     data_source NOT NULL DEFAULT 'jdlink_live',
    capacity        TEXT,                       -- e.g., "1200 bu" for grain cart, "300 gal" for tender
    is_active       BOOLEAN NOT NULL DEFAULT true,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_machines_org_type ON machines(org_id, machine_type) WHERE is_active = true;
CREATE INDEX idx_machines_jd_id ON machines(jd_equipment_id) WHERE jd_equipment_id IS NOT NULL;

CREATE TABLE machine_locations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id      UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    position        GEOGRAPHY(Point, 4326) NOT NULL,
    heading         NUMERIC(5,1),              -- degrees
    speed_mph       NUMERIC(5,1),
    fuel_pct        NUMERIC(5,1),
    engine_state    TEXT,                       -- 'running', 'off', 'idle'
    status          machine_status NOT NULL DEFAULT 'offline',
    data_source     data_source NOT NULL DEFAULT 'jdlink_live',
    recorded_at     TIMESTAMPTZ NOT NULL,       -- when JD recorded this
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_stale        BOOLEAN GENERATED ALWAYS AS (
                        recorded_at < now() - INTERVAL '15 minutes'
                    ) STORED
);

-- Partition by time for efficient querying of location history
CREATE INDEX idx_machine_loc_latest ON machine_locations(machine_id, recorded_at DESC);
CREATE INDEX idx_machine_loc_geo ON machine_locations USING GIST(position);

-- Materialized view for current positions (refreshed by sync service)
CREATE MATERIALIZED VIEW machine_current_positions AS
SELECT DISTINCT ON (machine_id)
    machine_id,
    position,
    heading,
    speed_mph,
    fuel_pct,
    engine_state,
    status,
    data_source,
    recorded_at,
    received_at,
    (recorded_at < now() - INTERVAL '15 minutes') AS is_stale
FROM machine_locations
ORDER BY machine_id, recorded_at DESC;

CREATE UNIQUE INDEX idx_mcp_machine ON machine_current_positions(machine_id);
CREATE INDEX idx_mcp_geo ON machine_current_positions USING GIST(position);

-- Performance baselines for anomaly detection
CREATE TABLE machine_performance_baselines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id      UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    crop_type       crop_type NOT NULL,
    avg_speed_mph   NUMERIC(5,2),
    avg_fuel_rate   NUMERIC(5,2),              -- gal/hr
    avg_acres_hr    NUMERIC(5,2),
    sample_hours    NUMERIC(8,1),              -- hours of data behind this baseline
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (machine_id, crop_type)
);


-- ============================================================
-- CUSTOMERS & FIELDS
-- ============================================================

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    jd_client_id    TEXT,                      -- JD Setup API client ID
    name            TEXT NOT NULL,
    contact_name    TEXT,
    contact_phone   TEXT,
    contact_email   TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_org ON customers(org_id);

CREATE TABLE fields (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    jd_field_id     TEXT,                      -- JD Field Operations API ID
    name            TEXT NOT NULL,
    boundary        GEOGRAPHY(Polygon, 4326),  -- field boundary polygon
    centroid        GEOGRAPHY(Point, 4326),    -- computed center
    entry_point     GEOGRAPHY(Point, 4326),    -- gate / access road location
    entry_point_desc TEXT,                     -- e.g., "County Rd 4 gate (south)"
    acreage         NUMERIC(8,1),
    crop_type       crop_type,
    status          field_status NOT NULL DEFAULT 'not_started',
    readiness_date  DATE,
    priority        INT NOT NULL DEFAULT 5,    -- 1 (highest) to 10 (lowest)
    estimated_yield NUMERIC(6,1),              -- bu/acre
    actual_yield    NUMERIC(6,1),
    pct_complete    NUMERIC(5,2) DEFAULT 0,
    county          TEXT,
    state           TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fields_org ON fields(org_id);
CREATE INDEX idx_fields_customer ON fields(customer_id);
CREATE INDEX idx_fields_status ON fields(org_id, status);
CREATE INDEX idx_fields_geo ON fields USING GIST(boundary);
CREATE INDEX idx_fields_entry ON fields USING GIST(entry_point);


-- ============================================================
-- CAMPAIGNS & PLANS
-- ============================================================

CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,             -- e.g., "Kansas Wheat — June 2026"
    crop_type       crop_type,
    region          TEXT,
    state           TEXT,
    start_date      DATE NOT NULL,
    end_date        DATE,
    status          plan_status NOT NULL DEFAULT 'draft',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_org ON campaigns(org_id, status);

CREATE TABLE campaign_fields (
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    field_id        UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    sequence_order  INT,                       -- planned harvest sequence
    PRIMARY KEY (campaign_id, field_id)
);

CREATE TABLE daily_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    plan_date       DATE NOT NULL,
    status          plan_status NOT NULL DEFAULT 'draft',
    rule_set_id     UUID,                      -- FK added after rule_sets table
    optimizer_score NUMERIC(6,2),
    generation_time_ms INT,                    -- how long the solver took
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, plan_date, status)         -- one active plan per day
);

CREATE INDEX idx_daily_plans_org ON daily_plans(org_id, plan_date DESC);

CREATE TABLE assignments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_plan_id   UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
    machine_id      UUID NOT NULL REFERENCES machines(id),
    field_id        UUID NOT NULL REFERENCES fields(id),
    crew_member_id  UUID REFERENCES crew_members(id),
    status          assignment_status NOT NULL DEFAULT 'planned',
    sequence_order  INT,                       -- order within the day
    scheduled_start TIMESTAMPTZ,
    scheduled_end   TIMESTAMPTZ,
    actual_start    TIMESTAMPTZ,
    actual_end      TIMESTAMPTZ,
    route_geom      GEOGRAPHY(LineString, 4326), -- planned route geometry
    route_distance_mi NUMERIC(7,1),
    route_eta_min   INT,
    optimizer_score NUMERIC(6,2),
    pushed_to_display BOOLEAN DEFAULT false,
    pushed_at       TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignments_plan ON assignments(daily_plan_id);
CREATE INDEX idx_assignments_machine ON assignments(machine_id, status);
CREATE INDEX idx_assignments_field ON assignments(field_id, status);
CREATE INDEX idx_assignments_crew ON assignments(crew_member_id) WHERE crew_member_id IS NOT NULL;


-- ============================================================
-- CONVOY SYNCHRONIZATION
-- ============================================================

CREATE TABLE convoys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_plan_id   UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
    field_id        UUID NOT NULL REFERENCES fields(id),
    name            TEXT,                       -- auto-generated or user-set
    target_arrival  TIMESTAMPTZ,
    max_gap_min     INT NOT NULL DEFAULT 15,   -- alert threshold
    is_synced       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE convoy_members (
    convoy_id       UUID NOT NULL REFERENCES convoys(id) ON DELETE CASCADE,
    machine_id      UUID NOT NULL REFERENCES machines(id),
    assignment_id   UUID REFERENCES assignments(id),
    eta_min         INT,
    actual_arrival  TIMESTAMPTZ,
    is_lead         BOOLEAN DEFAULT false,     -- the combine is usually the lead
    PRIMARY KEY (convoy_id, machine_id)
);


-- ============================================================
-- RULES ENGINE
-- ============================================================

CREATE TABLE rule_sets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,             -- e.g., "Wheat Standard 2026"
    is_template     BOOLEAN DEFAULT false,     -- pre-built templates
    is_active       BOOLEAN DEFAULT false,     -- currently active rule set
    version         INT NOT NULL DEFAULT 1,
    parent_id       UUID REFERENCES rule_sets(id), -- version chain
    created_by      UUID REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rule_sets_org ON rule_sets(org_id);
-- Only one active rule set per org
CREATE UNIQUE INDEX idx_rule_sets_active ON rule_sets(org_id) WHERE is_active = true;

ALTER TABLE daily_plans
    ADD CONSTRAINT fk_daily_plans_rule_set
    FOREIGN KEY (rule_set_id) REFERENCES rule_sets(id);

CREATE TABLE rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_set_id     UUID NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    rule_type       rule_type NOT NULL,
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    -- Condition
    condition_field TEXT NOT NULL,              -- e.g., 'move_distance', 'shift_duration', 'fuel_pct'
    condition_op    TEXT NOT NULL,              -- '>', '<', '=', '>=', '<='
    condition_value TEXT NOT NULL,              -- the threshold value
    condition_unit  TEXT,                       -- 'miles', 'hours', '%'
    -- Action
    action          rule_action NOT NULL,
    action_params   JSONB DEFAULT '{}',        -- additional params, e.g., {"score_delta": 15}
    -- Weight (for priority rules)
    weight_pct      NUMERIC(5,2),              -- percentage weight in optimization
    -- Display
    sort_order      INT NOT NULL DEFAULT 0,
    description     TEXT,                      -- plain-language explanation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rules_set ON rules(rule_set_id) WHERE is_enabled = true;

CREATE TABLE optimization_weights (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_set_id     UUID NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
    factor          TEXT NOT NULL,              -- 'travel_distance', 'yield', 'workload', 'fuel'
    weight_pct      NUMERIC(5,2) NOT NULL,
    UNIQUE (rule_set_id, factor)
);


-- ============================================================
-- WEATHER
-- ============================================================

CREATE TABLE weather_forecasts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location        GEOGRAPHY(Point, 4326) NOT NULL,
    field_id        UUID REFERENCES fields(id),
    forecast_time   TIMESTAMPTZ NOT NULL,      -- the forecasted time
    precip_prob_pct NUMERIC(5,1),
    precip_inches   NUMERIC(5,2),
    temp_f          NUMERIC(5,1),
    wind_mph        NUMERIC(5,1),
    humidity_pct    NUMERIC(5,1),
    conditions      TEXT,                      -- 'clear', 'rain', 'storm', etc.
    harvest_window  TEXT,                      -- 'clear', 'marginal', 'unsuitable'
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_weather_field ON weather_forecasts(field_id, forecast_time);
CREATE INDEX idx_weather_geo ON weather_forecasts USING GIST(location);


-- ============================================================
-- MORNING BRIEFING
-- ============================================================

CREATE TABLE morning_briefings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    briefing_date   DATE NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    changes_detected INT NOT NULL DEFAULT 0,
    changes_summary JSONB NOT NULL DEFAULT '[]',   -- structured overnight changes
    suggested_replans JSONB NOT NULL DEFAULT '[]', -- ranked replan options with scores
    action_taken    briefing_action,
    applied_plan_id UUID REFERENCES daily_plans(id),
    completed_at    TIMESTAMPTZ,
    completed_by    UUID REFERENCES users(id),
    UNIQUE (org_id, briefing_date)
);


-- ============================================================
-- ANOMALIES & ALERTS
-- ============================================================

CREATE TABLE anomalies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    machine_id      UUID NOT NULL REFERENCES machines(id),
    anomaly_type    anomaly_type NOT NULL,
    severity        alert_level NOT NULL DEFAULT 'warning',
    description     TEXT NOT NULL,
    metric_expected NUMERIC(8,2),
    metric_actual   NUMERIC(8,2),
    deviation_pct   NUMERIC(5,1),
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    auto_action     TEXT,                      -- what the system suggested
    user_action     TEXT,                      -- what the user did
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_anomalies_machine ON anomalies(machine_id, detected_at DESC);
CREATE INDEX idx_anomalies_org_active ON anomalies(org_id) WHERE resolved_at IS NULL;

CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    level           alert_level NOT NULL,
    status          alert_status NOT NULL DEFAULT 'active',
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    machine_id      UUID REFERENCES machines(id),
    field_id        UUID REFERENCES fields(id),
    anomaly_id      UUID REFERENCES anomalies(id),
    target_roles    user_role[] DEFAULT '{owner}',
    channels        notification_channel[] DEFAULT '{push, in_app}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_alerts_org_active ON alerts(org_id, level) WHERE status = 'active';


-- ============================================================
-- BREAKDOWNS & REPLANS
-- ============================================================

CREATE TABLE breakdowns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    machine_id      UUID NOT NULL REFERENCES machines(id),
    reported_by     UUID REFERENCES crew_members(id),
    reported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    location        GEOGRAPHY(Point, 4326),
    description     TEXT,
    voice_note_url  TEXT,                      -- S3 path to voice recording
    photo_urls      TEXT[] DEFAULT '{}',
    service_rig_id  UUID REFERENCES machines(id),
    service_dispatched_at TIMESTAMPTZ,
    service_eta_min INT,
    estimated_repair_hrs NUMERIC(4,1),
    resolved_at     TIMESTAMPTZ,
    resolution_notes TEXT
);

CREATE INDEX idx_breakdowns_org ON breakdowns(org_id, reported_at DESC);
CREATE INDEX idx_breakdowns_machine ON breakdowns(machine_id);

CREATE TABLE replan_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    trigger         replan_trigger NOT NULL,
    trigger_ref_id  UUID,                      -- breakdown_id, anomaly_id, etc.
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    previous_plan_id UUID REFERENCES daily_plans(id),
    new_plan_id     UUID REFERENCES daily_plans(id),
    proposed_changes JSONB NOT NULL DEFAULT '{}',
    delta_metrics   JSONB DEFAULT '{}',        -- {miles_saved, hours_gained, fuel_delta}
    solver_time_ms  INT,
    was_accepted    BOOLEAN,
    decided_by      UUID REFERENCES users(id),
    decided_at      TIMESTAMPTZ
);

CREATE INDEX idx_replan_org ON replan_log(org_id, triggered_at DESC);


-- ============================================================
-- RECONCILIATION
-- ============================================================

CREATE TABLE daily_reconciliations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_date       DATE NOT NULL,
    daily_plan_id   UUID NOT NULL REFERENCES daily_plans(id),
    planned_assignments INT,
    completed_assignments INT,
    variance_items  JSONB DEFAULT '[]',        -- list of discrepancies
    anomaly_summary JSONB DEFAULT '[]',        -- day's anomalies with follow-ups
    confirmed_by    UUID REFERENCES users(id),
    confirmed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, plan_date)
);


-- ============================================================
-- JD SYNC STATE
-- ============================================================

CREATE TABLE jd_sync_state (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL,              -- e.g., 'machine_locations', 'field_operations'
    last_sync_at    TIMESTAMPTZ,
    last_etag       TEXT,                       -- for conditional requests
    next_sync_at    TIMESTAMPTZ,
    poll_interval_sec INT NOT NULL DEFAULT 300,
    error_count     INT DEFAULT 0,
    last_error      TEXT,
    UNIQUE (org_id, endpoint)
);

CREATE TABLE jd_work_plan_pushes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id   UUID NOT NULL REFERENCES assignments(id),
    machine_id      UUID NOT NULL REFERENCES machines(id),
    payload         JSONB NOT NULL,            -- the work plan sent to JD
    pushed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ack_received    BOOLEAN DEFAULT false,
    ack_at          TIMESTAMPTZ,
    retry_count     INT DEFAULT 0,
    fallback_to_mobile BOOLEAN DEFAULT false,
    error           TEXT
);

CREATE INDEX idx_work_plan_pushes ON jd_work_plan_pushes(assignment_id);


-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    action          TEXT NOT NULL,              -- 'plan_created', 'rule_updated', 'assignment_changed', etc.
    entity_type     TEXT NOT NULL,              -- 'daily_plan', 'rule_set', 'assignment', etc.
    entity_id       UUID NOT NULL,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Refresh current positions (called by sync service every poll cycle)
CREATE OR REPLACE FUNCTION refresh_machine_positions()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY machine_current_positions;
END;
$$ LANGUAGE plpgsql;

-- Compute distance between two machines (miles)
CREATE OR REPLACE FUNCTION machine_distance_mi(machine_a UUID, machine_b UUID)
RETURNS NUMERIC AS $$
SELECT ST_Distance(a.position, b.position) / 1609.34
FROM machine_current_positions a, machine_current_positions b
WHERE a.machine_id = machine_a AND b.machine_id = machine_b;
$$ LANGUAGE sql STABLE;

-- Get nearest support equipment to a machine
CREATE OR REPLACE FUNCTION nearest_support(
    p_machine_id UUID,
    p_support_type machine_type,
    p_limit INT DEFAULT 3
)
RETURNS TABLE (
    machine_id UUID,
    name TEXT,
    distance_mi NUMERIC,
    fuel_pct NUMERIC,
    status machine_status
) AS $$
SELECT
    m.id,
    m.name,
    ROUND((ST_Distance(cp.position, target.position) / 1609.34)::NUMERIC, 1),
    cp.fuel_pct,
    cp.status
FROM machines m
JOIN machine_current_positions cp ON cp.machine_id = m.id
CROSS JOIN (
    SELECT position FROM machine_current_positions WHERE machine_id = p_machine_id
) target
WHERE m.machine_type = p_support_type
  AND m.is_active = true
  AND cp.status NOT IN ('breakdown', 'offline')
ORDER BY ST_Distance(cp.position, target.position)
LIMIT p_limit;
$$ LANGUAGE sql STABLE;

-- Check HOS compliance for a crew member
CREATE OR REPLACE FUNCTION check_hos_compliance(p_crew_id UUID)
RETURNS TABLE (
    hours_today NUMERIC,
    hours_remaining NUMERIC,
    is_compliant BOOLEAN,
    last_rest_hours NUMERIC
) AS $$
WITH today_shifts AS (
    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (COALESCE(shift_end, now()) - shift_start)) / 3600
    ), 0) AS total_hours
    FROM crew_shift_log
    WHERE crew_member_id = p_crew_id
      AND shift_start >= CURRENT_DATE
),
last_rest AS (
    SELECT EXTRACT(EPOCH FROM (
        COALESCE(
            (SELECT shift_start FROM crew_shift_log
             WHERE crew_member_id = p_crew_id
             ORDER BY shift_start DESC LIMIT 1),
            now()
        ) -
        COALESCE(
            (SELECT shift_end FROM crew_shift_log
             WHERE crew_member_id = p_crew_id
               AND shift_end IS NOT NULL
             ORDER BY shift_end DESC LIMIT 1),
            now() - INTERVAL '24 hours'
        )
    )) / 3600 AS rest_hrs
)
SELECT
    ts.total_hours,
    cm.max_shift_hours - ts.total_hours,
    ts.total_hours <= cm.max_shift_hours,
    lr.rest_hrs
FROM today_shifts ts
CROSS JOIN last_rest lr
JOIN crew_members cm ON cm.id = p_crew_id;
$$ LANGUAGE sql STABLE;


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema = 'public'
          AND table_name NOT LIKE 'machine_current%'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_timestamp()',
            t
        );
    END LOOP;
END;
$$;
