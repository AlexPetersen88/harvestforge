import { useState, useMemo, useCallback } from 'react';
import {
  FlaskConical, Plus, Trash2, Play, CheckCircle, RotateCcw,
  ChevronDown, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Clock, Fuel, MapPin, Activity, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import {
  type ScenarioEvent, type ScenarioEventType, type SimulationResult,
  type SimulatedAssignment, SCENARIO_PRESETS, EVENT_TEMPLATES,
  MACHINE_OPTIONS, FIELD_OPTIONS,
} from '@/data/mockScenario';
import { MOCK_ASSIGNMENTS } from '@/data/mockFleet';

// ── Simulation engine (pure function) ────────────────────────────────────────
function runSimulation(events: ScenarioEvent[]): SimulationResult {
  // Start from a copy of baseline assignments
  const assignments: SimulatedAssignment[] = MOCK_ASSIGNMENTS
    .filter(a => a.machine_id !== 'conflict')
    .map(a => ({
      id: a.id,
      machine_id: a.machine_id,
      machine_name: a.machine_name,
      field_name: a.field_name,
      operator: a.operator,
      baseline_start: a.start_day,
      baseline_duration: a.duration_days,
      sim_start: a.start_day,
      sim_duration: a.duration_days,
      color: a.color,
      affected: false,
    }));

  const warnings: string[] = [];
  let completionDelta = 0;
  let milesDelta = 0;
  let fuelDelta = 0;
  let idleDelta = 0;

  for (const event of events) {
    if (event.type === 'breakdown') {
      const days = event.breakdown_days ?? 1;
      const mid = event.machine_id ?? '';
      // Shift all assignments for this machine forward by breakdown_days
      assignments.forEach(a => {
        if (a.machine_id === mid) {
          a.sim_start += days;
          a.affected = true;
        }
      });
      completionDelta += days * 0.65; // partial campaign impact
      idleDelta += days * 8;           // ~8 idle hrs per down day per machine
      milesDelta += days * 40;         // service rig dispatched
      fuelDelta += days * 120;         // service + rerouting
      warnings.push(`${event.machine_name ?? 'Machine'} offline ${days}d — ${Math.round(days * 0.65 * 10) / 10} day campaign slip`);
    }

    if (event.type === 'weather_block') {
      const days = event.weather_block_days ?? 1;
      const fields = event.weather_fields ?? [];
      assignments.forEach(a => {
        if (fields.some(f => a.field_name.toLowerCase().includes(f.split(' ')[0].toLowerCase()))) {
          a.sim_start += days;
          a.affected = true;
        }
      });
      completionDelta += days * 0.4;
      idleDelta += days * 6 * fields.length;
      fuelDelta += days * 80;
      warnings.push(`${fields.length} field(s) blocked ${days}d — rain delay cascade`);
    }

    if (event.type === 'delay_field') {
      const days = event.delay_days ?? 1;
      const fname = event.delay_field_name ?? '';
      assignments.forEach(a => {
        if (a.field_name === fname) {
          a.sim_start += days;
          a.affected = true;
        }
      });
      completionDelta += days * 0.2;
      warnings.push(`${fname} delayed ${days}d`);
    }

    if (event.type === 'add_field') {
      const acreage = event.new_field_acreage ?? 200;
      const daysNeeded = acreage / 300; // ~300 ac/day per combine
      const isUrgent = event.new_field_priority === 'urgent';
      // Urgent: push all current planned assignments out; Normal: append
      if (isUrgent) {
        assignments.forEach(a => {
          if (a.sim_start >= 0.5 && a.machine_id === 'c07') {
            a.sim_start += daysNeeded;
            a.affected = true;
          }
        });
        completionDelta += daysNeeded * 0.5;
      } else {
        completionDelta += daysNeeded * 0.25;
      }
      milesDelta += 85; // travel to new field
      fuelDelta += daysNeeded * 90;
      warnings.push(`${event.new_field_name ?? 'New field'} (${acreage} ac) inserted — ~${Math.round(daysNeeded * 10) / 10} days`);
    }

    if (event.type === 'reassign') {
      milesDelta -= 55;  // shorter route
      fuelDelta -= 40;
      // No significant delay
    }
  }

  // Clamp
  milesDelta = Math.round(milesDelta);
  fuelDelta = Math.round(fuelDelta);
  idleDelta = Math.round(idleDelta * 10) / 10;
  completionDelta = Math.round(completionDelta * 10) / 10;

  const utilizationDelta = events.length === 0 ? 0
    : -Math.round(events.filter(e => e.type === 'breakdown').length * 4.5);

  const badCount = (completionDelta > 1 ? 1 : 0) + (idleDelta > 10 ? 1 : 0) + (fuelDelta > 300 ? 1 : 0);
  const overall: SimulationResult['overall'] =
    events.length === 0 ? 'good'
    : badCount >= 2 ? 'poor'
    : badCount === 1 ? 'mixed'
    : 'good';

  return { completion_delta_days: completionDelta, miles_delta: milesDelta, fuel_delta_gal: fuelDelta, idle_delta_hrs: idleDelta, utilization_delta_pct: utilizationDelta, assignments, warnings, overall };
}

// ── Delta badge ───────────────────────────────────────────────────────────────
function DeltaBadge({ value, unit, goodWhenNeg = true, prefix = '' }: {
  value: number; unit: string; goodWhenNeg?: boolean; prefix?: string;
}) {
  if (value === 0) return (
    <span className="flex items-center gap-0.5 text-slate-500 text-xs font-mono">
      <Minus size={10} /> —
    </span>
  );
  const isGood = goodWhenNeg ? value < 0 : value > 0;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={clsx('flex items-center gap-0.5 text-xs font-bold font-mono', isGood ? 'text-green-400' : 'text-red-400')}>
      <Icon size={11} />
      {prefix}{value > 0 ? '+' : ''}{value} {unit}
    </span>
  );
}

// ── Event card (editable) ─────────────────────────────────────────────────────
function EventCard({
  event, index, onUpdate, onRemove,
}: {
  event: ScenarioEvent;
  index: number;
  onUpdate: (id: string, patch: Partial<ScenarioEvent>) => void;
  onRemove: (id: string) => void;
}) {
  const tmpl = EVENT_TEMPLATES.find(t => t.type === event.type)!;
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-[var(--hf-card)] border border-green-900/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm">{tmpl.icon}</span>
        <span className="text-xs font-semibold text-slate-200 flex-1">{tmpl.label}</span>
        <span className="text-[9px] font-mono text-slate-600 bg-black/30 px-1.5 py-0.5 rounded">
          #{index + 1}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onRemove(event.id); }}
          className="text-slate-700 hover:text-red-400 transition-colors p-0.5 rounded"
        >
          <Trash2 size={11} />
        </button>
        <ChevronDown size={11} className={clsx('text-slate-600 transition-transform', open && 'rotate-180')} />
      </div>

      {/* Fields */}
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-green-900/20">
          {event.type === 'breakdown' && (
            <>
              <label className="flex flex-col gap-1 mt-2">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Machine</span>
                <select
                  value={event.machine_id ?? ''}
                  onChange={e => onUpdate(event.id, {
                    machine_id: e.target.value,
                    machine_name: MACHINE_OPTIONS.find(m => m.id === e.target.value)?.name,
                  })}
                  className="bg-black/40 border border-green-900/30 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="">Select machine…</option>
                  {MACHINE_OPTIONS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Down for (days)</span>
                <input
                  type="number" min={0.5} max={14} step={0.5}
                  value={event.breakdown_days ?? 1}
                  onChange={e => onUpdate(event.id, { breakdown_days: parseFloat(e.target.value) })}
                  className="bg-black/40 border border-green-900/30 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none w-full"
                />
              </label>
            </>
          )}

          {event.type === 'weather_block' && (
            <>
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Affected fields</span>
                <div className="flex flex-col gap-1">
                  {FIELD_OPTIONS.slice(0, 5).map(f => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(event.weather_fields ?? []).includes(f)}
                        onChange={e => {
                          const cur = event.weather_fields ?? [];
                          onUpdate(event.id, {
                            weather_fields: e.target.checked
                              ? [...cur, f]
                              : cur.filter(x => x !== f),
                          });
                        }}
                        className="accent-green-500 w-3 h-3"
                      />
                      <span className="text-[10px] text-slate-400">{f}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Block duration (days)</span>
                <input
                  type="number" min={1} max={7} step={1}
                  value={event.weather_block_days ?? 2}
                  onChange={e => onUpdate(event.id, { weather_block_days: parseInt(e.target.value) })}
                  className="bg-black/40 border border-green-900/30 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none w-full"
                />
              </label>
            </>
          )}

          {event.type === 'delay_field' && (
            <>
              <label className="flex flex-col gap-1 mt-2">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Field</span>
                <select
                  value={event.delay_field_name ?? ''}
                  onChange={e => onUpdate(event.id, { delay_field_name: e.target.value })}
                  className="bg-black/40 border border-green-900/30 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="">Select field…</option>
                  {FIELD_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Delay (days)</span>
                <input
                  type="number" min={0.5} max={7} step={0.5}
                  value={event.delay_days ?? 1}
                  onChange={e => onUpdate(event.id, { delay_days: parseFloat(e.target.value) })}
                  className="bg-black/40 border border-green-900/30 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none w-full"
                />
              </label>
            </>
          )}

          {event.type === 'add_field' && (
            <>
              <label className="flex flex-col gap-1 mt-2">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Field name</span>
                <input
                  type="text"
                  value={event.new_field_name ?? ''}
                  placeholder="e.g. Thornton West 320"
                  onChange={e => onUpdate(event.id, { new_field_name: e.target.value })}
                  className="bg-black/40 border border-green-900/30 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none w-full"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Acreage</span>
                <input
                  type="number" min={40} max={2000} step={40}
                  value={event.new_field_acreage ?? 200}
                  onChange={e => onUpdate(event.id, { new_field_acreage: parseInt(e.target.value) })}
                  className="bg-black/40 border border-green-900/30 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none w-full"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Priority</span>
                <select
                  value={event.new_field_priority ?? 'normal'}
                  onChange={e => onUpdate(event.id, { new_field_priority: e.target.value as 'urgent' | 'normal' })}
                  className="bg-black/40 border border-green-900/30 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="urgent">🔴 Urgent — insert now</option>
                  <option value="normal">🟢 Normal — append to queue</option>
                </select>
              </label>
            </>
          )}

          {event.type === 'reassign' && (
            <>
              <label className="flex flex-col gap-1 mt-2">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Machine</span>
                <select
                  value={event.reassign_machine_id ?? ''}
                  onChange={e => onUpdate(event.id, {
                    reassign_machine_id: e.target.value,
                    reassign_machine_name: MACHINE_OPTIONS.find(m => m.id === e.target.value)?.name,
                  })}
                  className="bg-black/40 border border-green-900/30 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="">Select machine…</option>
                  {MACHINE_OPTIONS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Reassign to field</span>
                <select
                  value={event.to_field ?? ''}
                  onChange={e => onUpdate(event.id, { to_field: e.target.value })}
                  className="bg-black/40 border border-green-900/30 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="">Select field…</option>
                  {FIELD_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mini Gantt comparison ─────────────────────────────────────────────────────
const VIEW_DAYS = 7;

function ComparisonGantt({ result }: { result: SimulationResult | null }) {
  const rows = useMemo(() => {
    const machines = Array.from(new Set(
      MOCK_ASSIGNMENTS.filter(a => a.machine_id !== 'conflict').map(a => a.machine_id)
    )).slice(0, 10);
    return machines.map(mid => {
      const name = MOCK_ASSIGNMENTS.find(a => a.machine_id === mid)?.machine_name ?? mid;
      const baseline = MOCK_ASSIGNMENTS.filter(a => a.machine_id === mid && a.machine_id !== 'conflict');
      const simulated = result?.assignments.filter(a => a.machine_id === mid) ?? [];
      return { machine_id: mid, name, baseline, simulated };
    });
  }, [result]);

  const dayLabels = Array.from({ length: VIEW_DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  });

  function barStyle(start: number, duration: number) {
    const left = Math.max(0, (start / VIEW_DAYS) * 100);
    const width = Math.min(100 - left, (duration / VIEW_DAYS) * 100);
    return { left: `${left}%`, width: `${Math.max(width, 0.5)}%` };
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day header */}
      <div className="flex-shrink-0 flex border-b border-green-900/20">
        <div className="w-28 flex-shrink-0" />
        <div className="flex-1 flex">
          {dayLabels.map((d, i) => (
            <div key={i} className="flex-1 text-center text-[8px] text-slate-600 py-1 border-l border-green-900/10">
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {rows.map(row => (
          <div key={row.machine_id} className="flex border-b border-green-900/10 hover:bg-white/3">
            {/* Machine label */}
            <div className="w-28 flex-shrink-0 flex items-center px-2 py-0.5">
              <span className="text-[9px] text-slate-500 truncate">{row.name}</span>
            </div>

            {/* Timeline */}
            <div className="flex-1 relative" style={{ minHeight: result ? 36 : 20 }}>
              {/* Grid lines */}
              {dayLabels.map((_, i) => (
                <div key={i}
                  className="absolute top-0 bottom-0 border-l border-green-900/10"
                  style={{ left: `${(i / VIEW_DAYS) * 100}%` }}
                />
              ))}

              {/* Today line */}
              <div className="absolute top-0 bottom-0 w-px bg-green-500/40 z-10"
                style={{ left: `${(0.01 / VIEW_DAYS) * 100}%` }} />

              {/* Baseline bars (always shown, dimmed when sim is active) */}
              {row.baseline.map(a => (
                <div
                  key={`b-${a.id}`}
                  className={clsx(
                    'absolute rounded-sm flex items-center overflow-hidden transition-all duration-300',
                    result ? 'top-0.5 h-3 opacity-30' : 'top-1 h-4 opacity-80'
                  )}
                  style={{ ...barStyle(a.start_day, a.duration_days), backgroundColor: a.color }}
                >
                  <span className="text-[7px] text-white/80 truncate px-1 leading-none">
                    {a.field_name.split(' ').slice(0, 2).join(' ')}
                  </span>
                </div>
              ))}

              {/* Simulated bars (only when simulation run) */}
              {result && row.simulated.map(a => (
                <div
                  key={`s-${a.id}`}
                  className="absolute top-4 h-4 rounded-sm flex items-center overflow-hidden transition-all duration-300"
                  style={{
                    ...barStyle(a.sim_start, a.sim_duration),
                    backgroundColor: a.affected ? '#FF9800' : a.color,
                    outline: a.affected ? '1px solid #FF9800' : 'none',
                    outlineOffset: '1px',
                  }}
                >
                  <span className="text-[7px] text-white truncate px-1 leading-none">
                    {a.field_name.split(' ').slice(0, 2).join(' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 flex items-center gap-4 px-3 py-1.5 border-t border-green-900/20 bg-black/20">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 rounded-sm bg-green-600 opacity-30" />
          <span className="text-[8px] text-slate-600">Baseline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 rounded-sm bg-green-600" />
          <span className="text-[8px] text-slate-600">Simulated (unchanged)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 rounded-sm bg-orange-500" />
          <span className="text-[8px] text-slate-600">Simulated (shifted)</span>
        </div>
      </div>
    </div>
  );
}

// ── Impact panel ──────────────────────────────────────────────────────────────
function ImpactPanel({ result, onApply }: { result: SimulationResult | null; onApply: () => void }) {
  const overallConfig = {
    good: { label: 'Low Impact', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: '✅' },
    mixed: { label: 'Mixed Impact', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: '⚠️' },
    poor: { label: 'High Impact', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: '🔴' },
  };

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Impact Summary</div>

      {!result ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <FlaskConical size={28} className="text-slate-700" />
          <p className="text-[10px] text-slate-600 leading-relaxed">
            Add events to your scenario<br />then hit Run Simulation
          </p>
        </div>
      ) : (
        <>
          {/* Overall */}
          <div className={clsx('flex items-center gap-2 rounded-lg p-2.5 border text-xs font-semibold', overallConfig[result.overall].bg, overallConfig[result.overall].color)}>
            <span>{overallConfig[result.overall].icon}</span>
            {overallConfig[result.overall].label}
          </div>

          {/* KPI deltas */}
          {[
            {
              icon: Clock,
              label: 'Completion',
              value: result.completion_delta_days,
              unit: 'days',
              goodWhenNeg: true,
              color: '#4CAF50',
            },
            {
              icon: MapPin,
              label: 'Total Miles',
              value: result.miles_delta,
              unit: 'mi',
              goodWhenNeg: true,
              color: '#2196F3',
            },
            {
              icon: Fuel,
              label: 'Fuel',
              value: result.fuel_delta_gal,
              unit: 'gal',
              goodWhenNeg: true,
              color: '#FF9800',
            },
            {
              icon: Activity,
              label: 'Idle Time',
              value: result.idle_delta_hrs,
              unit: 'hrs',
              goodWhenNeg: true,
              color: '#9C27B0',
            },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="flex items-center justify-between bg-black/30 border border-green-900/20 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon size={13} style={{ color: kpi.color }} />
                  <span className="text-[10px] text-slate-400">{kpi.label}</span>
                </div>
                <DeltaBadge value={kpi.value} unit={kpi.unit} goodWhenNeg={kpi.goodWhenNeg} />
              </div>
            );
          })}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="text-[9px] text-slate-600 uppercase tracking-wide">Cascade Effects</div>
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[9px] text-yellow-300/80 bg-yellow-900/10 border border-yellow-900/20 rounded px-2 py-1.5">
                  <AlertTriangle size={9} className="flex-shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Apply button */}
          <button
            onClick={onApply}
            className="w-full mt-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors border border-green-500"
          >
            <CheckCircle size={13} />
            Apply to Schedule
          </button>
          <p className="text-[8px] text-slate-700 text-center leading-relaxed">
            Applies scenario to live schedule.<br />Original saved as a restore point.
          </p>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
let nextEventId = 100;

export default function WhatIfSimulator() {
  const [scenarioName, setScenarioName] = useState('New Scenario');
  const [events, setEvents] = useState<ScenarioEvent[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showEventMenu, setShowEventMenu] = useState(false);

  const addEvent = useCallback((type: ScenarioEventType) => {
    const id = `e${++nextEventId}`;
    const newEvent: ScenarioEvent = {
      id,
      type,
      breakdown_days: 1,
      weather_block_days: 2,
      delay_days: 1,
      new_field_acreage: 200,
      new_field_priority: 'normal',
    };
    setEvents(prev => [...prev, newEvent]);
    setResult(null);
    setShowEventMenu(false);
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<ScenarioEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    setResult(null);
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    setResult(null);
  }, []);

  function loadPreset(presetId: string) {
    const preset = SCENARIO_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setScenarioName(preset.label);
    setEvents(preset.events.map(e => ({ ...e, id: `e${++nextEventId}` })));
    setResult(null);
    setApplied(false);
    setShowPresetMenu(false);
  }

  function runSim() {
    const r = runSimulation(events);
    setResult(r);
  }

  function handleApply() {
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  }

  function reset() {
    setEvents([]);
    setResult(null);
    setScenarioName('New Scenario');
    setApplied(false);
  }

  return (
    <div className="flex flex-col h-full bg-[var(--hf-bg)] overflow-hidden">

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-green-900/30 bg-[var(--hf-card)] flex-shrink-0">
        <div className="flex items-center gap-1.5 mr-1">
          <FlaskConical size={15} className="text-green-500" />
          <span className="text-sm font-bold text-slate-100">What-If Simulator</span>
        </div>

        {/* Scenario name */}
        <input
          value={scenarioName}
          onChange={e => setScenarioName(e.target.value)}
          className="bg-black/40 border border-green-900/30 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-green-600/50 w-44"
        />

        {/* Presets */}
        <div className="relative">
          <button
            onClick={() => { setShowPresetMenu(p => !p); setShowEventMenu(false); }}
            className="flex items-center gap-1.5 bg-black/30 border border-green-900/30 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Load Preset
            <ChevronDown size={11} className={clsx('transition-transform', showPresetMenu && 'rotate-180')} />
          </button>
          {showPresetMenu && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-[#0d1a0f] border border-green-900/40 rounded-lg shadow-xl z-50 overflow-hidden">
              {SCENARIO_PRESETS.map(p => (
                <button key={p.id} onClick={() => loadPreset(p.id)}
                  className="w-full flex flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-white/5 border-b border-green-900/10 last:border-0">
                  <span className="text-xs font-semibold text-slate-200">{p.label}</span>
                  <span className="text-[9px] text-slate-500">{p.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Event count badge */}
        {events.length > 0 && (
          <span className="text-[9px] font-mono text-slate-500 bg-black/30 border border-slate-800 rounded px-1.5 py-0.5">
            {events.length} event{events.length > 1 ? 's' : ''}
          </span>
        )}

        {/* Reset */}
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 rounded-lg bg-black/30 transition-colors"
        >
          <RotateCcw size={11} />
          Reset
        </button>

        {/* Run */}
        <button
          onClick={runSim}
          disabled={events.length === 0}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all',
            events.length === 0
              ? 'bg-black/30 border-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-green-600 border-green-500 text-white hover:bg-green-500'
          )}
        >
          <Play size={12} fill="currentColor" />
          Run Simulation
        </button>
      </div>

      {/* ── Applied banner ─────────────────────────────────────────────────── */}
      {applied && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-900/30 border-b border-green-700/30 flex-shrink-0">
          <CheckCircle size={13} className="text-green-400" />
          <span className="text-xs text-green-300 font-semibold">
            Scenario applied to live schedule. Previous schedule saved as restore point.
          </span>
        </div>
      )}

      {/* ── 3-column body ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT — scenario builder */}
        <div className="w-64 flex-shrink-0 flex flex-col border-r border-green-900/20 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-green-900/20 flex-shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              Scenario Events
            </span>
            {/* Add event */}
            <div className="relative">
              <button
                onClick={() => { setShowEventMenu(p => !p); setShowPresetMenu(false); }}
                className="flex items-center gap-1 bg-green-700/30 hover:bg-green-700/50 border border-green-600/40 rounded-md px-2 py-1 text-[10px] text-green-400 font-semibold transition-colors"
              >
                <Plus size={10} /> Add
              </button>
              {showEventMenu && (
                <div className="absolute top-full right-0 mt-1 w-52 bg-[#0d1a0f] border border-green-900/40 rounded-lg shadow-xl z-50 overflow-hidden">
                  {EVENT_TEMPLATES.map(t => (
                    <button key={t.type} onClick={() => addEvent(t.type)}
                      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-white/5 border-b border-green-900/10 last:border-0">
                      <span className="text-sm mt-0.5">{t.icon}</span>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-200">{t.label}</div>
                        <div className="text-[8px] text-slate-500">{t.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Event list */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
            {events.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-green-900/20 border border-green-900/30 flex items-center justify-center">
                  <Plus size={18} className="text-green-700" />
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Add events or load a preset to build your scenario
                </p>
                <div className="flex flex-col gap-1.5 w-full">
                  {EVENT_TEMPLATES.slice(0, 3).map(t => (
                    <button
                      key={t.type}
                      onClick={() => addEvent(t.type)}
                      className="flex items-center gap-2 bg-black/30 border border-green-900/20 rounded-lg px-2.5 py-2 hover:border-green-700/40 hover:bg-green-900/10 transition-colors text-left"
                    >
                      <span className="text-base">{t.icon}</span>
                      <span className="text-[10px] text-slate-400">{t.label}</span>
                      <ChevronRight size={9} className="ml-auto text-slate-700" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              events.map((event, i) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={i}
                  onUpdate={updateEvent}
                  onRemove={removeEvent}
                />
              ))
            )}
          </div>
        </div>

        {/* CENTER — Gantt comparison */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2 border-b border-green-900/20 flex-shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              Schedule Comparison
            </span>
            <span className="text-[9px] text-slate-600">7-day view</span>
            {result && (
              <span className="text-[9px] text-orange-400 bg-orange-900/20 border border-orange-900/30 rounded px-1.5 py-0.5">
                {result.assignments.filter(a => a.affected).length} assignments shifted
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ComparisonGantt result={result} />
          </div>
        </div>

        {/* RIGHT — impact summary */}
        <div className="w-52 flex-shrink-0 border-l border-green-900/20 overflow-hidden">
          <ImpactPanel result={result} onApply={handleApply} />
        </div>
      </div>
    </div>
  );
}
