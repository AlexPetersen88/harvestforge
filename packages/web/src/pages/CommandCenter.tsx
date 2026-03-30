import { useState, useEffect } from 'react';
import { Sun, Search, Wifi, AlertTriangle, Send } from 'lucide-react';
import FleetMap from '@/components/map/FleetMap';
import GanttPanel from '@/components/gantt/GanttPanel';
import KPIPanel from '@/components/kpi/KPIPanel';
import MorningBriefingWizard from '@/components/briefing/MorningBriefingWizard';
import DispatchPanel from '@/components/dispatch/DispatchPanel';
import { useWebSocket } from '@/hooks/useWebSocket';
import { MOCK_KPIS, MOCK_ALERTS, type MockMachine } from '@/data/mockFleet';

// Simplified from original:
// - Removed layout mode toggle (Command Center / Live Fleet / Gantt Only)
// - Removed auto-show briefing on page load
// - Added Dispatch button (toolbar + machine banner)

export default function CommandCenter() {
  const [showBriefing, setShowBriefing] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<MockMachine | null>(null);
  const [search, setSearch] = useState('');
  const [liveAlerts, setLiveAlerts] = useState(MOCK_ALERTS);

  const { subscribe } = useWebSocket({ mock: true });

  useEffect(() => {
    const unsub = subscribe('alert.created', (payload) => {
      const alert = payload as typeof MOCK_ALERTS[0];
      setLiveAlerts(prev => [alert, ...prev]);
    });
    return unsub;
  }, [subscribe]);

  const criticalCount = liveAlerts.filter(a => a.level === 'critical').length;

  return (
    <div className="flex flex-col h-[calc(100vh-44px)] bg-[var(--hf-bg)] overflow-hidden">

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-green-900/20 bg-[var(--hf-card)] flex-shrink-0">

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBriefing(true)}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-lg shadow-green-900/30 relative">
            <Sun size={13} />
            Morning Briefing
            {criticalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                {criticalCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowDispatch(true)}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-slate-600">
            <Send size={12} />
            Dispatch
          </button>
        </div>

        {/* Search */}
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

        {/* Status indicators */}
        <div className="flex items-center gap-3">
          {liveAlerts.some(a => a.level === 'critical') && (
            <div className="flex items-center gap-1 text-red-400 text-xs animate-pulse">
              <AlertTriangle size={13} />
              <span>C-06 breakdown</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <Wifi size={12} className="text-green-500" />
            <span className="text-green-400 font-mono font-semibold">
              {MOCK_KPIS.machines_online}/{MOCK_KPIS.machines_total}
            </span>
            <span className="text-slate-600">Online</span>
          </div>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDispatch(true)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-green-300 border border-slate-700 hover:border-green-700/50 rounded px-2 py-0.5 transition-colors">
              <Send size={11} />
              Dispatch
            </button>
            <button onClick={() => setSelectedMachine(null)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
          </div>
        </div>
      )}

      {/* ── Main panels ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-2 gap-2 flex">

        {/* Map */}
        <div className="flex-1 min-w-0">
          <FleetMap
            onSelectMachine={setSelectedMachine}
            selectedMachineId={selectedMachine?.id ?? null}
          />
        </div>

        {/* Gantt / daily plan */}
        <div className="flex-1 min-w-0">
          <GanttPanel />
        </div>

        {/* KPI sidebar */}
        <div className="w-[220px] flex-shrink-0 overflow-y-auto">
          <KPIPanel />
        </div>
      </div>

      {/* ── Morning Briefing Wizard ────────────────────────────────────────── */}
      {showBriefing && (
        <MorningBriefingWizard onClose={() => setShowBriefing(false)} />
      )}

      {/* ── Dispatch Panel ────────────────────────────────────────────────── */}
      {showDispatch && (
        <DispatchPanel
          preselectedMachine={selectedMachine}
          onClose={() => setShowDispatch(false)}
        />
      )}
    </div>
  );
}
