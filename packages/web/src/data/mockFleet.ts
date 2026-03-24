// ─── Mock Fleet Data ──────────────────────────────────────────────────────────
// Realistic seed data for local dev / demo. Mirrors the API response shapes
// from harvestforge_api_contract.md so swapping in real data requires no changes.

export type MachineStatus = 'harvesting' | 'moving' | 'idle' | 'breakdown' | 'offline';
export type MachineType = 'combine' | 'grain_cart' | 'truck' | 'fuel_tender' | 'service_rig';

export interface MockMachine {
  id: string;
  name: string;
  machine_type: MachineType;
  make: string;
  model: string;
  year: number;
  engine_hours: number;
  fuel_pct: number;
  status: MachineStatus;
  speed_mph: number;
  jdlink_enabled: boolean;
  position: [number, number]; // [lng, lat]
  heading: number;
  current_field?: string;
  pct_complete?: number;
  operator?: string;
}

export interface MockAssignment {
  id: string;
  machine_id: string;
  machine_name: string;
  machine_type: MachineType;
  field_name: string;
  operator: string;
  status: 'planned' | 'in_progress' | 'completed';
  start_day: number;   // 0 = today
  duration_days: number;
  acreage: number;
  color: string;
}

export interface MockKPIs {
  utilization_pct: number;
  idle_time_pct: number;
  fuel_burn_gal: number;
  eta_variance_min: number;
  machines_online: number;
  machines_total: number;
  acres_today: number;
  acres_campaign: number;
  acres_total: number;
}

export interface MockAlert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  machine_name: string;
  created_at: string;
}

// ── Kansas wheat belt coordinates (centered ~Pratt County KS) ─────────────────
const BASE_LNG = -98.74;
const BASE_LAT = 37.65;

function jitter(base: number, range: number) {
  return base + (Math.random() - 0.5) * range;
}

// ── Machines ──────────────────────────────────────────────────────────────────
export const MOCK_MACHINES: MockMachine[] = [
  // Combines — active harvest
  { id: 'c01', name: 'Combine 01', machine_type: 'combine', make: 'John Deere', model: 'S790', year: 2023, engine_hours: 4281, fuel_pct: 64, status: 'harvesting', speed_mph: 4.2, jdlink_enabled: true, position: [-98.82, 37.71], heading: 270, current_field: 'Johnson North 40', pct_complete: 72, operator: 'Jake Mitchell' },
  { id: 'c02', name: 'Combine 02', machine_type: 'combine', make: 'John Deere', model: 'S790', year: 2023, engine_hours: 3914, fuel_pct: 51, status: 'harvesting', speed_mph: 4.0, jdlink_enabled: true, position: [-98.79, 37.68], heading: 90, current_field: 'Miller South 80', pct_complete: 38, operator: 'Tyler Brooks' },
  { id: 'c03', name: 'Combine 03', machine_type: 'combine', make: 'John Deere', model: 'X9', year: 2024, engine_hours: 1204, fuel_pct: 88, status: 'harvesting', speed_mph: 4.8, jdlink_enabled: true, position: [-98.71, 37.73], heading: 180, current_field: 'Anderson East 120', pct_complete: 55, operator: 'Carl Reeves' },
  { id: 'c04', name: 'Combine 04', machine_type: 'combine', make: 'John Deere', model: 'S780', year: 2022, engine_hours: 5102, fuel_pct: 33, status: 'moving', speed_mph: 18.4, jdlink_enabled: true, position: [-98.68, 37.61], heading: 315, operator: 'Dean Fowler' },
  { id: 'c05', name: 'Combine 05', machine_type: 'combine', make: 'John Deere', model: 'S790', year: 2023, engine_hours: 3677, fuel_pct: 71, status: 'harvesting', speed_mph: 3.9, jdlink_enabled: true, position: [-98.76, 37.59], heading: 90, current_field: 'Peterson West 200', pct_complete: 21, operator: 'Nate Quinn' },
  { id: 'c06', name: 'Combine 06', machine_type: 'combine', make: 'John Deere', model: 'S780', year: 2021, engine_hours: 6882, fuel_pct: 58, status: 'breakdown', speed_mph: 0, jdlink_enabled: true, position: [-98.85, 37.64], heading: 0, current_field: 'Harvey County 90', operator: 'Sam Torres' },
  { id: 'c07', name: 'Combine 07', machine_type: 'combine', make: 'John Deere', model: 'S790', year: 2023, engine_hours: 4105, fuel_pct: 82, status: 'idle', speed_mph: 0, jdlink_enabled: true, position: [-98.61, 37.70], heading: 0, operator: 'Mike Hansen' },
  { id: 'c08', name: 'Combine 08', machine_type: 'combine', make: 'John Deere', model: 'X9', year: 2024, engine_hours: 988, fuel_pct: 76, status: 'harvesting', speed_mph: 5.1, jdlink_enabled: true, position: [-98.91, 37.69], heading: 270, current_field: 'Wilson Flat 160', pct_complete: 88, operator: 'Roy Barnes' },
  // Support — grain carts
  { id: 'gc01', name: 'Grain Cart 1', machine_type: 'grain_cart', make: 'Kinze', model: '1100', year: 2022, engine_hours: 1840, fuel_pct: 55, status: 'moving', speed_mph: 8.2, jdlink_enabled: false, position: [-98.81, 37.70], heading: 270 },
  { id: 'gc02', name: 'Grain Cart 2', machine_type: 'grain_cart', make: 'Kinze', model: '1100', year: 2022, engine_hours: 1791, fuel_pct: 60, status: 'idle', speed_mph: 0, jdlink_enabled: false, position: [-98.78, 37.67], heading: 90 },
  { id: 'gc03', name: 'Grain Cart 3', machine_type: 'grain_cart', make: 'J&M', model: '1312', year: 2023, engine_hours: 940, fuel_pct: 72, status: 'harvesting', speed_mph: 3.8, jdlink_enabled: false, position: [-98.70, 37.73], heading: 180 },
  // Trucks
  { id: 't01', name: 'Truck 01', machine_type: 'truck', make: 'Peterbilt', model: '389', year: 2021, engine_hours: 12400, fuel_pct: 88, status: 'moving', speed_mph: 55, jdlink_enabled: false, position: [-98.74, 37.66], heading: 45 },
  { id: 't02', name: 'Truck 02', machine_type: 'truck', make: 'Kenworth', model: 'W900', year: 2020, engine_hours: 15200, fuel_pct: 61, status: 'idle', speed_mph: 0, jdlink_enabled: false, position: [-98.80, 37.62], heading: 0 },
  // Fuel tenders
  { id: 'ft01', name: 'Fuel Tender 1', machine_type: 'fuel_tender', make: 'Peterbilt', model: '579', year: 2022, engine_hours: 8100, fuel_pct: 92, status: 'moving', speed_mph: 42, jdlink_enabled: false, position: [-98.86, 37.63], heading: 180 },
  // Service rig
  { id: 'sr01', name: 'Service Rig 1', machine_type: 'service_rig', make: 'Ford', model: 'F-550', year: 2023, engine_hours: 3200, fuel_pct: 78, status: 'moving', speed_mph: 58, jdlink_enabled: false, position: [-98.87, 37.64], heading: 90 },
];

// ── 7-day Gantt assignments ───────────────────────────────────────────────────
export const MOCK_ASSIGNMENTS: MockAssignment[] = [
  // Combines
  { id: 'a01', machine_id: 'c01', machine_name: 'Combine 01', machine_type: 'combine', field_name: 'Johnson North 40', operator: 'Jake Mitchell', status: 'in_progress', start_day: 0, duration_days: 1.2, acreage: 240, color: '#4CAF50' },
  { id: 'a02', machine_id: 'c01', machine_name: 'Combine 01', machine_type: 'combine', field_name: 'Miller South 80', operator: 'Jake Mitchell', status: 'planned', start_day: 1.2, duration_days: 2.1, acreage: 320, color: '#388E3C' },
  { id: 'a03', machine_id: 'c02', machine_name: 'Combine 02', machine_type: 'combine', field_name: 'Miller South 80', operator: 'Tyler Brooks', status: 'in_progress', start_day: 0, duration_days: 1.8, acreage: 320, color: '#4CAF50' },
  { id: 'a04', machine_id: 'c02', machine_name: 'Combine 02', machine_type: 'combine', field_name: 'Peterson West 200', operator: 'Tyler Brooks', status: 'planned', start_day: 1.8, duration_days: 3.0, acreage: 480, color: '#388E3C' },
  { id: 'a05', machine_id: 'c03', machine_name: 'Combine 03', machine_type: 'combine', field_name: 'Anderson East 120', operator: 'Carl Reeves', status: 'in_progress', start_day: 0, duration_days: 1.5, acreage: 200, color: '#4CAF50' },
  { id: 'a06', machine_id: 'c03', machine_name: 'Combine 03', machine_type: 'combine', field_name: 'Harvey County 90', operator: 'Carl Reeves', status: 'planned', start_day: 1.5, duration_days: 2.2, acreage: 280, color: '#388E3C' },
  { id: 'a07', machine_id: 'c04', machine_name: 'Combine 04', machine_type: 'combine', field_name: 'Wilson Flat 160', operator: 'Dean Fowler', status: 'planned', start_day: 0.4, duration_days: 2.0, acreage: 360, color: '#388E3C' },
  { id: 'a08', machine_id: 'c05', machine_name: 'Combine 05', machine_type: 'combine', field_name: 'Peterson West 200', operator: 'Nate Quinn', status: 'in_progress', start_day: 0, duration_days: 2.5, acreage: 480, color: '#4CAF50' },
  { id: 'a09', machine_id: 'c07', machine_name: 'Combine 07', machine_type: 'combine', field_name: 'Smith Ridge 300', operator: 'Mike Hansen', status: 'planned', start_day: 1.0, duration_days: 3.5, acreage: 600, color: '#388E3C' },
  { id: 'a10', machine_id: 'c08', machine_name: 'Combine 08', machine_type: 'combine', field_name: 'Wilson Flat 160', operator: 'Roy Barnes', status: 'in_progress', start_day: 0, duration_days: 0.5, acreage: 160, color: '#4CAF50' },
  // Support
  { id: 'a11', machine_id: 'gc01', machine_name: 'Grain Cart 1', machine_type: 'grain_cart', field_name: 'Johnson / Miller loop', operator: '—', status: 'in_progress', start_day: 0, duration_days: 1.5, acreage: 0, color: '#1565C0' },
  { id: 'a12', machine_id: 'gc03', machine_name: 'Grain Cart 3', machine_type: 'grain_cart', field_name: 'Anderson support', operator: '—', status: 'in_progress', start_day: 0, duration_days: 2.0, acreage: 0, color: '#1565C0' },
  { id: 'a13', machine_id: 't01', machine_name: 'Truck 01', machine_type: 'truck', field_name: 'Grain haul — elevator run', operator: '—', status: 'in_progress', start_day: 0, duration_days: 3.0, acreage: 0, color: '#F57C00' },
  { id: 'a14', machine_id: 'ft01', machine_name: 'Fuel Tender 1', machine_type: 'fuel_tender', field_name: 'Circuit — all combines', operator: '—', status: 'in_progress', start_day: 0, duration_days: 7.0, acreage: 0, color: '#7B1FA2' },
  // Conflict row
  { id: 'cx1', machine_id: 'conflict', machine_name: 'Conflict', machine_type: 'combine', field_name: 'C06 breakdown gap', operator: '—', status: 'planned', start_day: 0, duration_days: 1.0, acreage: 0, color: '#D32F2F' },
];

// ── KPIs ──────────────────────────────────────────────────────────────────────
export const MOCK_KPIS: MockKPIs = {
  utilization_pct: 87,
  idle_time_pct: 12,
  fuel_burn_gal: 2340,
  eta_variance_min: 18,
  machines_online: 97,
  machines_total: 97,
  acres_today: 1840,
  acres_campaign: 24600,
  acres_total: 38400,
};

// ── Alerts ────────────────────────────────────────────────────────────────────
export const MOCK_ALERTS: MockAlert[] = [
  { id: 'al01', level: 'critical', title: 'Hydraulic failure reported', machine_name: 'Combine 06', created_at: '14 min ago' },
  { id: 'al02', level: 'warning', title: 'Low fuel — 33%', machine_name: 'Combine 04', created_at: '28 min ago' },
  { id: 'al03', level: 'warning', title: 'Rain window: 70% prob Thu PM', machine_name: '3 Harvey fields', created_at: '1 hr ago' },
  { id: 'al04', level: 'info', title: 'Wilson Flat 160 complete', machine_name: 'Combine 08', created_at: '2 hr ago' },
];

// ── Status colors ─────────────────────────────────────────────────────────────
export const STATUS_COLOR: Record<MachineStatus, string> = {
  harvesting: '#4CAF50',
  moving:     '#2196F3',
  idle:       '#757575',
  breakdown:  '#F44336',
  offline:    '#37474F',
};

export const STATUS_LABEL: Record<MachineStatus, string> = {
  harvesting: 'Harvesting',
  moving:     'Moving',
  idle:       'Idle',
  breakdown:  'Breakdown',
  offline:    'Offline',
};

export const TYPE_ICON: Record<MachineType, string> = {
  combine:     '🌾',
  grain_cart:  '🚜',
  truck:       '🚛',
  fuel_tender: '⛽',
  service_rig: '🔧',
};
