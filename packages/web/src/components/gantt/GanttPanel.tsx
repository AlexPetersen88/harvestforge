import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { MOCK_ASSIGNMENTS, MOCK_MACHINES, STATUS_COLOR, type MockAssignment, type MachineType } from '@/data/mockFleet';
import clsx from 'clsx';

interface GanttPanelProps {
  onSelectAssignment?: (assignment: MockAssignment | null) => void;
}

type ViewMode = '3 Day' | '7 Day' | '14 Day';
const VIEW_DAYS: Record<ViewMode, number> = { '3 Day': 3, '7 Day': 7, '14 Day': 14 };

// ── Group config ──────────────────────────────────────────────────────────────
const GROUPS: { label: string; types: MachineType[]; color: string }[] = [
  { label: 'Combines',    types: ['combine'],                   color: '#4CAF50' },
  { label: 'Grain Carts', types: ['grain_cart'],                color: '#2196F3' },
  { label: 'Trucks',      types: ['truck'],                     color: '#F57C00' },
  { label: 'Support',     types: ['fuel_tender', 'service_rig'], color: '#7B1FA2' },
];

const ROW_H = 26; // px per machine row
const HEADER_H = 22; // px per group header row

export default function GanttPanel({ onSelectAssignment }: GanttPanelProps) {
  const today = startOfDay(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('7 Day');
  const [startOffset, setStartOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [tooltip, setTooltip] = useState<{ a: MockAssignment; x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const numDays = VIEW_DAYS[viewMode];
  const days = Array.from({ length: numDays }, (_, i) => addDays(today, i + startOffset));
  const dayPct = 100 / numDays;

  // ── Today marker position ─────────────────────────────────────────────────
  const todayPct = ((0 - startOffset) / numDays) * 100;
  const showToday = todayPct >= 0 && todayPct <= 100;

  // ── Bar helpers ───────────────────────────────────────────────────────────
  function barStyle(a: MockAssignment) {
    const left = Math.max(0, (a.start_day - startOffset) / numDays) * 100;
    const right = Math.min(100, ((a.start_day + a.duration_days - startOffset) / numDays) * 100);
    const width = right - left;
    if (width <= 0) return null;
    return { left: `${left}%`, width: `${width}%` };
  }

  function handleBarClick(a: MockAssignment) {
    setSelectedId(a.id === selectedId ? null : a.id);
    onSelectAssignment?.(a.id === selectedId ? null : a);
  }

  function handleMouseEnter(e: React.MouseEvent, a: MockAssignment) {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ a, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  // ── Build rows: group header + one row per machine ────────────────────────
  type RowItem =
    | { kind: 'header'; label: string; color: string; groupKey: string; count: number }
    | { kind: 'machine'; machineId: string; machineName: string; machineType: MachineType; assignments: MockAssignment[]; statusColor: string };

  const rows: RowItem[] = [];

  for (const group of GROUPS) {
    const machines = MOCK_MACHINES.filter(m => group.types.includes(m.machine_type));
    if (machines.length === 0) continue;

    rows.push({ kind: 'header', label: group.label, color: group.color, groupKey: group.label, count: machines.length });

    if (!collapsed[group.label]) {
      for (const machine of machines) {
        const assignments = MOCK_ASSIGNMENTS.filter(a => a.machine_id === machine.id);
        rows.push({
          kind: 'machine',
          machineId: machine.id,
          machineName: machine.name,
          machineType: machine.machine_type,
          assignments,
          statusColor: STATUS_COLOR[machine.status],
        });
      }
    }
  }

  // Conflict row
  const conflictAssignments = MOCK_ASSIGNMENTS.filter(a => a.machine_id === 'conflict');
  if (conflictAssignments.length > 0) {
    rows.push({ kind: 'header', label: 'Conflict', color: '#D32F2F', groupKey: 'Conflict', count: 1 });
    if (!collapsed['Conflict']) {
      rows.push({
        kind: 'machine',
        machineId: 'conflict',
        machineName: 'C-06 Gap',
        machineType: 'combine',
        assignments: conflictAssignments,
        statusColor: '#D32F2F',
      });
    }
  }

  return (
    <div ref={panelRef} className="flex flex-col h-full bg-[var(--hf-card)] rounded-lg border border-green-900/30 overflow-hidden relative">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-green-900/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-green-500" />
          <span className="text-xs font-semibold text-slate-200">Gantt</span>
          <span className="text-[10px] text-slate-600">
            {MOCK_MACHINES.length} machines · {MOCK_ASSIGNMENTS.filter(a => a.status === 'in_progress').length} active
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(['3 Day', '7 Day', '14 Day'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={clsx(
                'px-2 py-0.5 text-[10px] rounded font-medium transition-colors',
                viewMode === v
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              )}>
              {v}
            </button>
          ))}
          <button onClick={() => setStartOffset(s => s - numDays)}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-200 ml-1">
            <ChevronLeft size={13} />
          </button>
          <button onClick={() => setStartOffset(0)}
            className="px-1.5 py-0.5 text-[10px] text-green-400 hover:text-green-300 font-medium">
            Today
          </button>
          <button onClick={() => setStartOffset(s => s + numDays)}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-200">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* ── Day header row ───────────────────────────────────────────────────── */}
      <div className="flex border-b border-green-900/20 flex-shrink-0 bg-[#0d140d]">
        <div className="w-[130px] flex-shrink-0 border-r border-green-900/20 px-2 py-1">
          <span className="text-[9px] text-slate-600 uppercase tracking-wide">Machine</span>
        </div>
        <div className="flex-1 flex">
          {days.map((day, i) => {
            const isToday = i + startOffset === 0;
            return (
              <div key={i} className={clsx(
                'flex-1 text-center py-1 border-r border-green-900/10 last:border-r-0',
                isToday && 'bg-green-500/5'
              )}>
                <div className={clsx('text-[9px] font-semibold', isToday ? 'text-green-400' : 'text-slate-400')}>
                  {format(day, 'EEE')}
                </div>
                <div className={clsx('text-[8px]', isToday ? 'text-green-400' : 'text-slate-600')}>
                  {format(day, 'M/d')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Rows ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {rows.map((row, rowIdx) => {
          if (row.kind === 'header') {
            const isCollapsed = collapsed[row.groupKey];
            return (
              <div key={`h-${row.groupKey}`}
                className="flex items-center border-b border-green-900/20 bg-[#0d140d] cursor-pointer select-none hover:bg-green-900/10 transition-colors"
                style={{ minHeight: HEADER_H }}
                onClick={() => setCollapsed(c => ({ ...c, [row.groupKey]: !c[row.groupKey] }))}>
                <div className="w-[130px] flex-shrink-0 flex items-center gap-1.5 px-2 border-r border-green-900/20" style={{ minHeight: HEADER_H }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="text-[10px] font-semibold text-slate-300">{row.label}</span>
                  <span className="text-[9px] text-slate-600 ml-0.5">{row.count}</span>
                  <span className="ml-auto text-slate-600">
                    {isCollapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                  </span>
                </div>
                <div className="flex-1 relative" style={{ minHeight: HEADER_H }}>
                  {/* Column shading */}
                  {days.map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-green-900/10"
                      style={{ left: `${i * dayPct}%`, width: `${dayPct}%` }} />
                  ))}
                  {showToday && (
                    <div className="absolute top-0 bottom-0 w-px bg-green-500/20"
                      style={{ left: `${todayPct}%` }} />
                  )}
                </div>
              </div>
            );
          }

          // Machine row
          return (
            <div key={`m-${row.machineId}`}
              className="flex items-center border-b border-green-900/10 hover:bg-white/[0.02] transition-colors"
              style={{ minHeight: ROW_H }}>

              {/* Label */}
              <div className="w-[130px] flex-shrink-0 flex items-center gap-1.5 px-2 border-r border-green-900/15"
                style={{ minHeight: ROW_H }}>
                {/* Live status dot */}
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: row.statusColor }} />
                <span className="text-[10px] text-slate-400 truncate leading-none">
                  {row.machineName}
                </span>
              </div>

              {/* Timeline */}
              <div className="flex-1 relative" style={{ minHeight: ROW_H }}>
                {/* Column backgrounds */}
                {days.map((_, i) => (
                  <div key={i}
                    className="absolute top-0 bottom-0 border-r border-green-900/10"
                    style={{
                      left: `${i * dayPct}%`,
                      width: `${dayPct}%`,
                      backgroundColor: i + startOffset === 0 ? '#4CAF5006' : 'transparent',
                    }} />
                ))}

                {/* Today line */}
                {showToday && (
                  <div className="absolute top-0 bottom-0 w-px bg-green-500/30 z-10"
                    style={{ left: `${todayPct}%` }} />
                )}

                {/* Assignment bars */}
                {row.assignments.map(a => {
                  const style = barStyle(a);
                  if (!style) return null;
                  const isSelected = a.id === selectedId;
                  const isActive = a.status === 'in_progress';

                  return (
                    <div key={a.id}
                      className={clsx(
                        'absolute rounded cursor-pointer transition-all flex items-center overflow-hidden',
                        isSelected ? 'ring-1 ring-white/60 z-20' : 'hover:brightness-110 z-10'
                      )}
                      style={{
                        ...style,
                        top: 3,
                        height: ROW_H - 6,
                        backgroundColor: a.color,
                        opacity: a.status === 'planned' ? 0.65 : 1,
                      }}
                      onClick={() => handleBarClick(a)}
                      onMouseEnter={e => handleMouseEnter(e, a)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {/* Stripe overlay for in-progress */}
                      {isActive && (
                        <div className="absolute inset-0 opacity-15 pointer-events-none"
                          style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.5) 4px, rgba(255,255,255,0.5) 6px)' }} />
                      )}
                      <span className="text-[9px] text-white font-medium px-1.5 truncate relative z-10 leading-none">
                        {a.field_name.split(' ').slice(0, 2).join(' ')}
                      </span>
                    </div>
                  );
                })}

                {/* Empty row hint */}
                {row.assignments.length === 0 && (
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[9px] text-slate-700">— unassigned</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-green-900/20 flex-shrink-0 bg-[#0d140d]">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-2.5 rounded"
            style={{ background: 'repeating-linear-gradient(45deg, #4CAF50 0,#4CAF50 4px,#2e7d32 4px,#2e7d32 6px)' }} />
          <span className="text-[9px] text-slate-500">In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-2.5 rounded bg-green-700/40" />
          <span className="text-[9px] text-slate-500">Planned</span>
        </div>
        <div className="ml-auto text-[9px] text-slate-600">
          {MOCK_ASSIGNMENTS.filter(a => a.status === 'in_progress').length} active ·{' '}
          {MOCK_ASSIGNMENTS.filter(a => a.status === 'planned').length} planned
        </div>
      </div>

      {/* ── Tooltip ─────────────────────────────────────────────────────────── */}
      {tooltip && (
        <div className="absolute z-30 pointer-events-none bg-black/95 border border-green-700/50 rounded-lg px-3 py-2 text-xs backdrop-blur-sm min-w-[170px] shadow-xl"
          style={{
            left: Math.min(tooltip.x + 10, (panelRef.current?.offsetWidth ?? 400) - 190),
            top: Math.min(tooltip.y - 10, (panelRef.current?.offsetHeight ?? 400) - 120),
          }}>
          <div className="font-bold text-white mb-1">{tooltip.a.machine_name}</div>
          <div className="text-slate-300 mb-0.5">{tooltip.a.field_name}</div>
          {tooltip.a.operator !== '—' && (
            <div className="text-slate-500">Op: {tooltip.a.operator}</div>
          )}
          {tooltip.a.acreage > 0 && (
            <div className="text-slate-500">{tooltip.a.acreage.toLocaleString()} acres</div>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tooltip.a.color }} />
            <span className={clsx('text-[10px] capitalize font-medium',
              tooltip.a.status === 'in_progress' ? 'text-green-400' : 'text-slate-400')}>
              {tooltip.a.status.replace('_', ' ')}
            </span>
          </div>
          <div className="text-[9px] text-slate-600 mt-0.5">
            Day {tooltip.a.start_day.toFixed(1)} → Day {(tooltip.a.start_day + tooltip.a.duration_days).toFixed(1)}
          </div>
        </div>
      )}
    </div>
  );
}
