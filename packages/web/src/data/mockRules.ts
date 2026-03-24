// ─── Mock Rules Engine Data ───────────────────────────────────────────────────

export type RuleType = 'constraint' | 'priority';
export type RuleAction = 'block' | 'alert' | 'prefer' | 'deprioritize' | 'require_support' | 'exclude';
export type ConditionField =
  | 'move_distance' | 'fuel_pct' | 'field_yield' | 'distance_to_field'
  | 'engine_hours' | 'weather_risk' | 'crew_hours' | 'field_acreage' | 'pct_complete';
export type ConditionOp = '>' | '<' | '>=' | '<=' | '==' | '!=';

export interface Rule {
  id: string;
  name: string;
  rule_type: RuleType;
  is_enabled: boolean;
  condition_field: ConditionField;
  condition_op: ConditionOp;
  condition_value: string;
  condition_unit: string;
  action: RuleAction;
  action_params?: { score_delta?: number; support_type?: string };
  description: string;
  triggered_count: number; // times triggered in last 7 days
  color: string;
}

export interface OptimizationWeight {
  factor: string;
  label: string;
  weight_pct: number;
  color: string;
  icon: string;
}

export interface RuleSet {
  id: string;
  name: string;
  is_active: boolean;
  version: number;
  rules: Rule[];
  weights: OptimizationWeight[];
}

// ── Rule templates ────────────────────────────────────────────────────────────
export const RULE_TEMPLATES: { label: string; value: string }[] = [
  { label: 'Wheat Harvest Standard', value: 'wheat_standard' },
  { label: 'Corn Harvest — High Yield', value: 'corn_high_yield' },
  { label: 'Weather Emergency', value: 'weather_emergency' },
  { label: 'Fuel Conservation', value: 'fuel_conservation' },
  { label: 'Custom Rule Set', value: 'custom' },
];

// ── Active rule set ───────────────────────────────────────────────────────────
export const MOCK_RULE_SET: RuleSet = {
  id: 'rs-001',
  name: 'Wheat Harvest Standard',
  is_active: true,
  version: 3,
  rules: [
    // ── Constraints (hard limits) ─────────────────────────────────────────
    {
      id: 'r01',
      name: 'Max Daily Move Distance',
      rule_type: 'constraint',
      is_enabled: true,
      condition_field: 'move_distance',
      condition_op: '>',
      condition_value: '200',
      condition_unit: 'miles',
      action: 'block',
      description: 'Prevents assignments requiring more than 200 miles of travel in a single day.',
      triggered_count: 3,
      color: '#F44336',
    },
    {
      id: 'r02',
      name: 'Low Fuel Warning',
      rule_type: 'constraint',
      is_enabled: true,
      condition_field: 'fuel_pct',
      condition_op: '<',
      condition_value: '20',
      condition_unit: '%',
      action: 'require_support',
      action_params: { support_type: 'fuel_tender' },
      description: 'Requires a fuel tender assignment when combine fuel drops below 20%.',
      triggered_count: 7,
      color: '#FF9800',
    },
    {
      id: 'r03',
      name: 'Crew Hours Limit',
      rule_type: 'constraint',
      is_enabled: true,
      condition_field: 'crew_hours',
      condition_op: '>',
      condition_value: '12',
      condition_unit: 'hrs',
      action: 'block',
      description: 'Blocks new assignments when crew member exceeds 12 hours worked in a shift.',
      triggered_count: 1,
      color: '#F44336',
    },
    {
      id: 'r04',
      name: 'High Engine Hours Alert',
      rule_type: 'constraint',
      is_enabled: true,
      condition_field: 'engine_hours',
      condition_op: '>',
      condition_value: '7000',
      condition_unit: 'hrs',
      action: 'alert',
      description: 'Flags machines approaching major service interval for inspection scheduling.',
      triggered_count: 2,
      color: '#FF9800',
    },
    // ── Priorities (soft preferences) ─────────────────────────────────────
    {
      id: 'r05',
      name: 'Prefer Nearby Fields',
      rule_type: 'priority',
      is_enabled: true,
      condition_field: 'distance_to_field',
      condition_op: '<',
      condition_value: '50',
      condition_unit: 'miles',
      action: 'prefer',
      action_params: { score_delta: 15 },
      description: 'Gives a +15 score bonus to field assignments within 50 miles of current position.',
      triggered_count: 42,
      color: '#4CAF50',
    },
    {
      id: 'r06',
      name: 'Prioritize High-Yield Fields',
      rule_type: 'priority',
      is_enabled: true,
      condition_field: 'field_yield',
      condition_op: '>',
      condition_value: '65',
      condition_unit: 'bu/ac',
      action: 'prefer',
      action_params: { score_delta: 20 },
      description: 'Boosts score for fields with expected yield above 65 bu/ac — harvest before weather window.',
      triggered_count: 28,
      color: '#4CAF50',
    },
    {
      id: 'r07',
      name: 'Deprioritize Small Fields',
      rule_type: 'priority',
      is_enabled: false,
      condition_field: 'field_acreage',
      condition_op: '<',
      condition_value: '80',
      condition_unit: 'acres',
      action: 'deprioritize',
      action_params: { score_delta: -10 },
      description: 'Reduces score for fields under 80 acres to improve fleet efficiency on larger blocks.',
      triggered_count: 0,
      color: '#9E9E9E',
    },
    {
      id: 'r08',
      name: 'Weather Risk Exclusion',
      rule_type: 'priority',
      is_enabled: true,
      condition_field: 'weather_risk',
      condition_op: '>',
      condition_value: '60',
      condition_unit: '%',
      action: 'exclude',
      action_params: { score_delta: -50 },
      description: 'Effectively removes fields from today\'s plan when rain probability exceeds 60%.',
      triggered_count: 5,
      color: '#2196F3',
    },
  ],
  weights: [
    { factor: 'travel_distance', label: 'Travel Distance', weight_pct: 40, color: '#4CAF50', icon: '📍' },
    { factor: 'yield',           label: 'Yield Priority',  weight_pct: 30, color: '#FF9800', icon: '🌾' },
    { factor: 'workload',        label: 'Crew Balance',    weight_pct: 20, color: '#2196F3', icon: '👷' },
    { factor: 'fuel',            label: 'Fuel Efficiency', weight_pct: 10, color: '#9C27B0', icon: '⛽' },
  ],
};

export const ACTION_LABEL: Record<RuleAction, string> = {
  block:           'Block',
  alert:           'Alert',
  prefer:          'Prefer',
  deprioritize:    'Deprioritize',
  require_support: 'Require Support',
  exclude:         'Exclude',
};

export const ACTION_COLOR: Record<RuleAction, string> = {
  block:           '#F44336',
  alert:           '#FF9800',
  prefer:          '#4CAF50',
  deprioritize:    '#9E9E9E',
  require_support: '#2196F3',
  exclude:         '#7B1FA2',
};

export const FIELD_LABEL: Record<ConditionField, string> = {
  move_distance:    'Move Distance',
  fuel_pct:         'Fuel Level',
  field_yield:      'Field Yield',
  distance_to_field:'Distance to Field',
  engine_hours:     'Engine Hours',
  weather_risk:     'Weather Risk',
  crew_hours:       'Crew Hours',
  field_acreage:    'Field Acreage',
  pct_complete:     '% Complete',
};
