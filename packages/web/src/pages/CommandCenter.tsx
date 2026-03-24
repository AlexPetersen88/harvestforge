import { useState, useEffect } from 'react';
import { Sun, Search, Wifi, AlertTriangle, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import FleetMap from '@/components/map/FleetMap';
import GanttPanel from '@/components/gantt/GanttPanel';
import KPIPanel from '@/components/kpi/KPIPanel';
import MorningBriefingWizard from '@/components/briefing/MorningBriefingWizard';
import { useWebSocket } from '@/hooks/useWebSocket';
import { MOCK_KPIS, MOCK_ALERTS, type MockMachine } from '@/data/mockFleet';

// ── Layout mode toggle ────────────────────────────────────────────────────────
type LayoutMode = 'map-gantt-kpi' | 'map-full' | 'gantt-full';

const LAYOUT_OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: 'map-gantt-kpi', label: 'Command Center' },
  { value: 'map-full',      label: 'Live Fleet' },
  { value: 'gantt-full',    label: 'Gantt Only' },
];

export default function CommandCenter() {
  const [showBriefing, setShowBriefing] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>('map-gantt-kpi');
  const [selectedMachine, setSelectedMachine] = useState<MockMachine | null>(null);
  const [search, setSearch] = useState('');
  const [newAlertCount, setNewAlertCount] = useState(MOCK_ALERTS.filter(a => a.level === 'critical').length);
  const [liveAlerts, setLiveAlerts] = useState(MOCK_ALERTS);

  // ── Wire WebSocket ────────────────────────────────────────────────────────
  const { subscribe } = useWebSocket({ mock: true });

  useEffect(() => {
    const unsub = subscribe('alert.created', (payload) => {
      const alert = payload as typeof MOCK_ALERTS[0];
      setLiveAlerts(prev => [alert, ...prev]);
      if (alert.level === 'critical') setNewAlertCount(n => n + 1);
    });
    return unsub;
  }, [subscribe]);

  // ── Briefing auto-show on first load (demo) ────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setShowBriefing(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-44px)] bg-[var(--hf-bg)] overflow-hidden">

      {/* ── Subheader ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-green-900/20 bg-[var(--hf-card)] flex-shrink-0">

        {/* Left: Morning Briefing CTA + layout toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBriefing(true)}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-lg shadow-green-900/30 relative">
            <Sun size={13} />
            Morning Briefing Wizard
            {newAlertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                {newAlertCount}
              </span>
            )}
          </button>

          {/* Layout selector */}
          <div className="flex items-center gap-0.5 bg-black/30 rounded-lg p-0.5 border border-green-900/20">
            {LAYOUT_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setLayout(opt.value)}
                className={clsx(
                  'px-2 py-1 text-[10px] font-medium rounded-md transition-colors',
                  layout === opt.value
                    ? 'bg-green-700/40 text-green-300'
                    : 'text-slate-500 hover:text-slate-300'
                )}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Search */}
        <div className="relative max-w-[240px] w-full mx-4">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search machines, fields, crew…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/30 border border-green-900/30 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-green-700/50"
          />
        </div>

        {/* Right: Status indicators */}
        <div className="flex items-center gap-3">
          {/* Critical alert badge */}
          {liveAlerts.some(a => a.level === 'critical') && (
            <div className="flex items-center gap-1 text-red-400 text-xs animate-pulse">
              <AlertTriangle size={13} />
              <span>C-06 breakdown</span>
            </div>
          )}
          {/* Online count */}
          <div className="flex items-center gap-1.5 text-xs">
            <Wifi size={12} className="text-green-500" />
            <span className="text-green-400 font-mono font-semibold">
              {MOCK_KPIS.machines_online}/{MOCK_KPIS.machines_total}
            </span>
            <span className="text-slate-600">Online</span>
          </div>
          {/* Campaign selector */}
          <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 border border-green-900/20 rounded px-2 py-1">
            KS Wheat Jun 2026 <ChevronDown size={11} />
          </button>
        </div>
      </div>

      {/* ── Selected machine banner ───────────────────────────────────────── */}
      {selectedMachine && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-green-900/20 border-b border-green-700/30 flex-shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-green-300">{selectedMachine.name}</span>
            <span className="text-slate-400 capitalize">{selectedMachine.status}</span>
            {selectedMachine.current_field && (
              <span className="text-slate-500">→ {selectedMachine.current_field}</span>
            )}
            {selectedMachine.pct_complete != null && (
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-20 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${selectedMachine.pct_complete}%` }} />
                </div>
                <span className="text-green-400">{selectedMachine.pct_complete}%</span>
              </div>
            )}
            <span className="text-slate-600">
              Fuel: <span className={selectedMachine.fuel_pct < 40 ? 'text-yellow-400' : 'text-slate-400'}>
                {selectedMachine.fuel_pct}%
              </span>
            </span>
            {selectedMachine.operator && (
              <span className="text-slate-600">Op: <span className="text-slate-400">{selectedMachine.operator}</span></span>
            )}
          </div>
          <button onClick={() => setSelectedMachine(null)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
        </div>
      )}

      {/* ── Main panels ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-2 gap-2 flex">

        {/* Map panel */}
        <div className={clsx(
          'transition-all duration-300',
          layout === 'map-full'      ? 'flex-1' :
          layout === 'gantt-full'    ? 'hidden' :
          'flex-1 min-w-0'
        )}>
          <FleetMap
            onSelectMachine={setSelectedMachine}
            selectedMachineId={selectedMachine?.id ?? null}
          />
        </div>

        {/* Gantt panel */}
        <div className={clsx(
          'transition-all duration-300 relative',
          layout === 'gantt-full'    ? 'flex-1' :
          layout === 'map-full'      ? 'hidden' :
          'flex-1 min-w-0'
        )} data-gantt>
          <GanttPanel />
        </div>

        {/* KPI sidebar */}
        {layout === 'map-gantt-kpi' && (
          <div className="w-[220px] flex-shrink-0 overflow-y-auto">
            <KPIPanel />
          </div>
        )}
      </div>

      {/* ── Morning Briefing Wizard ────────────────────────────────────────── */}
      {showBriefing && (
        <MorningBriefingWizard onClose={() => setShowBriefing(false)} />
      )}
    </div>
  );
}
