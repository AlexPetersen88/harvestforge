// ─── What-If Simulator — Scenario Types & Mock Data ──────────────────────────
// Scenarios are a list of "events" applied to the baseline schedule.
// The simulation engine recalculates KPIs and assignment timelines after
// applying all events in order.

export type ScenarioEventType =
  | 'breakdown'
  | 'reassign'
  | 'delay_field'
  | 'add_field'
  | 'weather_block';

export interface ScenarioEvent {
  id: string;
  type: ScenarioEventType;
  // breakdown
  machine_id?: string;
  machine_name?: string;
  breakdown_days?: number;
  // reassign
  reassign_machine_id?: string;
  reassign_machine_name?: string;
  from_field?: string;
  to_field?: string;
  // delay_field
  delay_field_name?: string;
  delay_days?: number;
  // add_field
  new_field_name?: string;
  new_field_acreage?: number;
  new_field_priority?: 'urgent' | 'normal';
  // weather_block
  weather_fields?: string[];
  weather_block_days?: number;
}

export interface SimulatedAssignment {
  id: string;
  machine_id: string;
  machine_name: string;
  field_name: string;
  operator: string;
  // Baseline timing
  baseline_start: number;
  baseline_duration: number;
  // Simulated timing (after events applied)
  sim_start: number;
  sim_duration: number;
  // Visual
  color: string;
  affected: boolean; // true if this assignment shifted due to an event
}

export interface SimulationResult {
  completion_delta_days: number;    // + = later (worse), - = earlier (better)
  miles_delta: number;              // + = more miles (worse), - = fewer (better)
  fuel_delta_gal: number;           // + = more fuel (worse)
  idle_delta_hrs: number;           // + = more idle (worse)
  utilization_delta_pct: number;    // + = higher util (better), - = lower (worse)
  assignments: SimulatedAssignment[];
  warnings: string[];
  overall: 'good' | 'mixed' | 'poor';
}

// ── Preset scenarios ──────────────────────────────────────────────────────────
export interface ScenarioPreset {
  id: string;
  label: string;
  description: string;
  events: ScenarioEvent[];
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'c06_breakdown',
    label: 'C-06 Extended Breakdown',
    description: 'Combine 06 down for 3 days — what gets delayed?',
    events: [
      {
        id: 'e1',
        type: 'breakdown',
        machine_id: 'c06',
        machine_name: 'Combine 06',
        breakdown_days: 3,
      },
    ],
  },
  {
    id: 'rain_delay',
    label: 'Thursday Rain Event',
    description: 'Harvey County fields blocked 2 days due to 70% rain forecast',
    events: [
      {
        id: 'e1',
        type: 'weather_block',
        weather_fields: ['Harvey County 90', 'Harvey County West'],
        weather_block_days: 2,
      },
    ],
  },
  {
    id: 'add_urgent',
    label: 'Urgent Field Added',
    description: 'Customer calls in 480-acre emergency field — how does it fit?',
    events: [
      {
        id: 'e1',
        type: 'add_field',
        new_field_name: 'Thornton Emergency 480',
        new_field_acreage: 480,
        new_field_priority: 'urgent',
      },
    ],
  },
  {
    id: 'two_breakdowns',
    label: 'Worst Case: 2 Breakdowns',
    description: 'C-04 and C-06 both down — stress test the fleet',
    events: [
      {
        id: 'e1',
        type: 'breakdown',
        machine_id: 'c06',
        machine_name: 'Combine 06',
        breakdown_days: 2,
      },
      {
        id: 'e2',
        type: 'breakdown',
        machine_id: 'c04',
        machine_name: 'Combine 04',
        breakdown_days: 1.5,
      },
    ],
  },
  {
    id: 'blank',
    label: 'Blank — build your own',
    description: 'Start from scratch and add events manually',
    events: [],
  },
];

// ── Event templates (for the Add Event dropdown) ───────────────────────────────
export const EVENT_TEMPLATES: { type: ScenarioEventType; label: string; icon: string; description: string }[] = [
  { type: 'breakdown',     label: 'Machine Breakdown',   icon: '🔴', description: 'Take a machine offline for N days' },
  { type: 'reassign',      label: 'Reassign Machine',    icon: '🔀', description: 'Move a machine to a different field' },
  { type: 'delay_field',   label: 'Delay Field Start',   icon: '⏱️', description: 'Push a field\'s start date forward' },
  { type: 'add_field',     label: 'Add Urgent Field',    icon: '📍', description: 'Insert a new field into the schedule' },
  { type: 'weather_block', label: 'Weather Block',       icon: '🌧️', description: 'Block fields due to rain / wet conditions' },
];

// ── Machine options (for dropdowns) ──────────────────────────────────────────
export const MACHINE_OPTIONS = [
  { id: 'c01', name: 'Combine 01' },
  { id: 'c02', name: 'Combine 02' },
  { id: 'c03', name: 'Combine 03' },
  { id: 'c04', name: 'Combine 04' },
  { id: 'c05', name: 'Combine 05' },
  { id: 'c06', name: 'Combine 06' },
  { id: 'c07', name: 'Combine 07' },
  { id: 'c08', name: 'Combine 08' },
];

// ── Field options (for dropdowns) ─────────────────────────────────────────────
export const FIELD_OPTIONS = [
  'Johnson North 40',
  'Miller South 80',
  'Anderson East 120',
  'Wilson Flat 160',
  'Peterson West 200',
  'Harvey County 90',
  'Smith Ridge 300',
  'Dunlap SE 60',
];
