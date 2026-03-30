import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Wifi, Fuel, Clock, Target, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { MOCK_KPIS, MOCK_ALERTS, MOCK_MACHINES, STATUS_COLOR } from '@/data/mockFleet';

// Simplified from original: removed ETA Variance card (3 KPI cards → 3, but removed the
// "avg behind schedule" metric which was more of an automated-suggestion feature).

interface KPICardProps {
  label: string;
  value: string;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  trendGood?: boolean;
  icon: React.ReactNode;
  accent?: string;
  sublabel?: string;
}

function KPICard({ label, value, unit, trend, trendLabel, trendGood = true, icon, accent = '#4CAF50', sublabel }: KPICardProps) {
  const trendIcon = trend === 'up' ? <TrendingUp size={11} />
    : trend === 'down' ? <TrendingDown size={11} />
    : <Minus size={11} />;
  const trendColor = trend === 'flat' ? 'text-slate-500'
    : ((trend === 'up') === trendGood) ? 'text-green-400' : 'text-red-400';

  return (
    <div className="bg-[var(--hf-bg)] border border-green-900/20 rounded-lg p-3 hover:border-green-700/40 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="text-slate-500" style={{ color: accent }}>{icon}</div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
        </div>
        <button className="text-slate-700 hover:text-slate-400">
          <MoreHorizontal size={13} />
        </button>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-black text-white leading-none tracking-tight">{value}</span>
        {unit && <span className="text-xs text-slate-500 mb-0.5">{unit}</span>}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {sublabel && <span className="text-[10px] text-slate-600">{sublabel}</span>}
        {trend && trendLabel && (
          <div className={clsx('flex items-center gap-0.5 text-[10px]', trendColor, !sublabel && 'ml-auto')}>
            {trendIcon}
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FleetStatusBar() {
  const counts = MOCK_MACHINES.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const total = MOCK_MACHINES.length;
  const segments = [
    { key: 'harvesting', color: STATUS_COLOR.harvesting },
    { key: 'moving',     color: STATUS_COLOR.moving },
    { key: 'idle',       color: STATUS_COLOR.idle },
    { key: 'breakdown',  color: STATUS_COLOR.breakdown },
    { key: 'offline',    color: STATUS_COLOR.offline },
  ];

  return (
    <div className="bg-[var(--hf-bg)] border border-green-900/20 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Wifi size={13} className="text-green-500" />
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Fleet Status</span>
        </div>
        <span className="text-xs font-bold text-green-400">
          {MOCK_KPIS.machines_online}/{MOCK_KPIS.machines_total} Online
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-2">
        {segments.map(({ key, color }) => {
          const pct = ((counts[key] || 0) / total) * 100;
          return pct > 0 ? (
            <div key={key} style={{ width: `${pct}%`, backgroundColor: color }} />
          ) : null;
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {segments.map(({ key, color }) => (
          <div key={key} className="flex items-center gap-1 text-[9px] text-slate-500">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{key}</span>
            <span className="ml-auto text-slate-400">{counts[key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsList() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = MOCK_ALERTS.filter(a => !dismissed.has(a.id));

  const levelColor = { critical: '#F44336', warning: '#FF9800', info: '#2196F3' };
  const levelBg    = { critical: '#F4433610', warning: '#FF980010', info: '#2196F310' };

  return (
    <div className="bg-[var(--hf-bg)] border border-green-900/20 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={13} className="text-yellow-500" />
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Active Alerts</span>
        </div>
        <span className="text-[10px] text-slate-600">{visible.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
        {visible.length === 0 ? (
          <div className="text-[10px] text-slate-600 text-center py-2">All clear</div>
        ) : (
          visible.map(alert => (
            <div key={alert.id}
              className="rounded px-2 py-1.5 flex items-start gap-2"
              style={{ backgroundColor: levelBg[alert.level] }}>
              <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0"
                style={{ backgroundColor: levelColor[alert.level] }} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-200 font-medium truncate">{alert.title}</div>
                <div className="text-[9px] text-slate-500">{alert.machine_name} · {alert.created_at}</div>
              </div>
              <button
                onClick={() => setDismissed(d => new Set([...d, alert.id]))}
                className="text-slate-700 hover:text-slate-400 text-[10px] ml-1 flex-shrink-0">
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CampaignProgress() {
  const pct = Math.round((MOCK_KPIS.acres_campaign / MOCK_KPIS.acres_total) * 100);
  return (
    <div className="bg-[var(--hf-bg)] border border-green-900/20 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Target size={13} className="text-green-500" />
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Kansas Wheat — June 2026</span>
      </div>
      <div className="flex items-end gap-1 mb-1.5">
        <span className="text-xl font-black text-white">{pct}%</span>
        <span className="text-xs text-slate-500 mb-0.5">complete</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[9px] text-slate-600">
        <span>{MOCK_KPIS.acres_campaign.toLocaleString()} ac done</span>
        <span>{(MOCK_KPIS.acres_total - MOCK_KPIS.acres_campaign).toLocaleString()} ac remain</span>
      </div>
      <div className="mt-1.5 text-[9px] text-slate-600 flex justify-between">
        <span>Today</span>
        <span className="text-slate-400">{MOCK_KPIS.acres_today.toLocaleString()} ac</span>
      </div>
    </div>
  );
}

export default function KPIPanel() {
  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto pr-0.5">
      <KPICard
        label="Utilization"
        value={`${MOCK_KPIS.utilization_pct}%`}
        trend="up"
        trendLabel="+3% vs yesterday"
        trendGood={true}
        icon={<TrendingUp size={13} />}
        accent="#4CAF50"
        sublabel="of fleet active"
      />
      <KPICard
        label="Idle Time"
        value={`${MOCK_KPIS.idle_time_pct}%`}
        trend="down"
        trendLabel="−5% vs yesterday"
        trendGood={false}
        icon={<Clock size={13} />}
        accent="#2196F3"
        sublabel="fleet avg"
      />
      <KPICard
        label="Fuel Burn"
        value={MOCK_KPIS.fuel_burn_gal.toLocaleString()}
        unit="gal/day"
        trend="flat"
        trendLabel="on target"
        icon={<Fuel size={13} />}
        accent="#FF9800"
        sublabel="est. today"
      />
      <FleetStatusBar />
      <CampaignProgress />
      <AlertsList />
    </div>
  );
}
