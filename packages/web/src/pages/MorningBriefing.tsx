import { useState } from 'react';
import { Sun, CheckCircle, AlertTriangle, Cloud, Thermometer, Wind, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { MOCK_MACHINES, MOCK_ASSIGNMENTS, MOCK_ALERTS, STATUS_COLOR, STATUS_LABEL } from '@/data/mockFleet';

// Returns today's machines (combines + grain carts) with their active/near-start assignment
function getTodayItems() {
  return MOCK_MACHINES
    .filter(m => m.machine_type === 'combine' || m.machine_type === 'grain_cart')
    .map(machine => {
      const assignment = MOCK_ASSIGNMENTS.find(
        a => a.machine_id === machine.id &&
          (a.status === 'in_progress' || (a.status === 'planned' && a.start_day <= 0.5))
      ) ?? null;
      return { machine, assignment };
    });
}

export default function MorningBriefing() {
  const [confirmed, setConfirmed] = useState(false);
  const todayItems = getTodayItems();
  const criticalAlerts = MOCK_ALERTS.filter(a => a.level === 'critical');
  const warnings = MOCK_ALERTS.filter(a => a.level === 'warning');
  const assignedCount = todayItems.filter(i => i.assignment).length;

  return (
    <div className="h-[calc(100vh-44px)] overflow-y-auto bg-[var(--hf-bg)] p-4">
      <div className="max-w-4xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sun size={18} className="text-yellow-400" />
              <h1 className="text-xl font-black text-white">Morning Briefing</h1>
            </div>
            <p className="text-slate-500 text-sm">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
              {' · '}Kansas Wheat Campaign
            </p>
          </div>

          {!confirmed ? (
            <button
              onClick={() => setConfirmed(true)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-green-900/30">
              <CheckCircle size={15} />
              Confirm & Send to Crew
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/40 text-green-400 text-sm font-semibold px-4 py-2 rounded-lg">
              <CheckCircle size={15} />
              Plan Confirmed — Sent to Crew
            </div>
          )}
        </div>

        {/* ── Critical alerts ────────────────────────────────────────────── */}
        {criticalAlerts.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-red-300 mb-1">
                {criticalAlerts.length} Critical Issue{criticalAlerts.length > 1 ? 's' : ''} — Review Before Confirming
              </div>
              {criticalAlerts.map(a => (
                <div key={a.id} className="text-xs text-red-400">{a.title} — {a.machine_name}</div>
              ))}
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              {warnings.map(a => (
                <div key={a.id} className="text-xs text-yellow-400">{a.title}</div>
              ))}
            </div>
          </div>
        )}

        {/* ── Weather strip ──────────────────────────────────────────────── */}
        <div className="bg-[var(--hf-card)] border border-green-900/20 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Cloud size={15} className="text-blue-400" />
            <span className="font-medium">Partly cloudy</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <Thermometer size={13} className="text-orange-400" />
            <span>High 84°F</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <Wind size={13} className="text-slate-500" />
            <span>SW 12 mph</span>
          </div>
          <div className="ml-auto text-xs text-yellow-400 font-medium">
            ⚠ Rain 70% Thursday PM — prioritize exposed fields
          </div>
        </div>

        {/* ── Today's assignments ────────────────────────────────────────── */}
        <div className="bg-[var(--hf-card)] border border-green-900/20 rounded-lg overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-green-900/20">
            <h2 className="text-sm font-semibold text-slate-200">Today's Assignments</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {assignedCount} of {todayItems.length} machines assigned
            </p>
          </div>

          <div className="divide-y divide-green-900/10">
            {todayItems.map(({ machine, assignment }) => (
              <div
                key={machine.id}
                className={clsx(
                  'flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors',
                  machine.status === 'breakdown' && 'bg-red-500/5'
                )}>

                {/* Name + operator */}
                <div className="flex items-center gap-2 w-[190px] flex-shrink-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLOR[machine.status] }} />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{machine.name}</div>
                    <div className="text-[10px] text-slate-600">{machine.operator ?? '—'}</div>
                  </div>
                </div>

                {/* Status badge */}
                <div className="w-[90px] flex-shrink-0">
                  <span className={clsx(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded',
                    machine.status === 'breakdown'  ? 'bg-red-500/15 text-red-400' :
                    machine.status === 'harvesting' ? 'bg-green-500/15 text-green-400' :
                    machine.status === 'moving'     ? 'bg-blue-500/15 text-blue-400' :
                    'bg-slate-700 text-slate-400'
                  )}>
                    {STATUS_LABEL[machine.status]}
                  </span>
                </div>

                {/* Field assignment */}
                <div className="flex-1 min-w-0">
                  {assignment ? (
                    <div className="flex items-center gap-2">
                      <ChevronRight size={12} className="text-slate-600 flex-shrink-0" />
                      <span className="text-xs text-slate-300 truncate">{assignment.field_name}</span>
                      {assignment.acreage > 0 && (
                        <span className="text-[10px] text-slate-600 flex-shrink-0">
                          {assignment.acreage.toLocaleString()} ac
                        </span>
                      )}
                    </div>
                  ) : machine.status === 'breakdown' ? (
                    <span className="text-xs text-red-400">⚠ Down — awaiting service</span>
                  ) : (
                    <span className="text-xs text-slate-600">— Unassigned</span>
                  )}
                </div>

                {/* Fuel bar */}
                <div className="flex items-center gap-1.5 w-[70px] flex-shrink-0">
                  <div className="h-1 w-10 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full',
                        machine.fuel_pct < 40 ? 'bg-yellow-500' : 'bg-green-500'
                      )}
                      style={{ width: `${machine.fuel_pct}%` }}
                    />
                  </div>
                  <span className={clsx('text-[10px]',
                    machine.fuel_pct < 40 ? 'text-yellow-400' : 'text-slate-500'
                  )}>
                    {machine.fuel_pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Campaign progress ──────────────────────────────────────────── */}
        <div className="bg-[var(--hf-card)] border border-green-900/20 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Campaign Progress</h2>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '64%' }} />
            </div>
            <span className="text-sm font-bold text-green-400">64%</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>24,600 ac complete</span>
            <span>13,800 ac remaining</span>
            <span className="text-green-400">Est. completion: Jun 14</span>
          </div>
        </div>

      </div>
    </div>
  );
}
