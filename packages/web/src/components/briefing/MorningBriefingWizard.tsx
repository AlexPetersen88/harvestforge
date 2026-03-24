import { useState } from 'react';
import { X, ChevronRight, CheckCircle, Sun, CloudRain, Wrench, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import clsx from 'clsx';

interface ReplanOption {
  rank: number;
  name: string;
  score: number;
  description: string;
  tag: 'Recommended' | 'Weather Priority' | 'Breakdown Recovery';
  tagColor: string;
  miles_change: number;
  hours_change: number;
  fuel_change_pct: number;
  idle_change_pct: number;
  completion_change_days: number;
}

const REPLAN_OPTIONS: ReplanOption[] = [
  {
    rank: 1,
    name: 'Accelerate Harvey + Reassign C-07',
    score: 94,
    tag: 'Recommended',
    tagColor: '#4CAF50',
    description: 'Move C-07 to Harvey County to beat Thursday rain window. Saves 42 miles, finishes 3 hrs early.',
    miles_change: -42,
    hours_change: -3.0,
    fuel_change_pct: -8,
    idle_change_pct: -12,
    completion_change_days: -0.3,
  },
  {
    rank: 2,
    name: 'Weather-First Shuffle',
    score: 94,
    tag: 'Weather Priority',
    tagColor: '#2196F3',
    description: 'Prioritize all Harvey County fields first regardless of distance. Maximizes rain protection.',
    miles_change: 18,
    hours_change: 1.2,
    fuel_change_pct: 4,
    idle_change_pct: -8,
    completion_change_days: 0,
  },
  {
    rank: 3,
    name: 'C-06 Breakdown Recovery',
    score: 94,
    tag: 'Breakdown Recovery',
    tagColor: '#F57C00',
    description: 'Redistribute C-06 assignments across C-07, C-03, and C-05. Minimizes schedule slip.',
    miles_change: 24,
    hours_change: 2.4,
    fuel_change_pct: 9,
    idle_change_pct: 19,
    completion_change_days: 0.5,
  },
];

interface Change {
  type: 'weather_update' | 'field_completed_early' | 'diagnostic_alert' | 'customer_change';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
}

const OVERNIGHT_CHANGES: Change[] = [
  { type: 'diagnostic_alert', severity: 'critical', title: 'Hydraulic failure — Combine 06', description: 'Reported at 6:14 AM. Service Rig 1 dispatched, ETA 35 min.' },
  { type: 'weather_update', severity: 'warning', title: 'Rain probability increased', description: '70% chance Thursday PM. Harvey County fields affected — 3 fields at risk.' },
  { type: 'field_completed_early', severity: 'info', title: 'Wilson Flat 160 completed early', description: 'Combine 08 finished at 11:43 PM, 3 hrs ahead of schedule.' },
  { type: 'customer_change', severity: 'warning', title: 'Peterson schedule change', description: 'Peterson requested harvest start moved from Wednesday to Tuesday.' },
];

const SEVERITY_COLOR = { critical: '#F44336', warning: '#FF9800', info: '#4CAF50' };
const SEVERITY_BG    = { critical: '#F4433615', warning: '#FF980015', info: '#4CAF5015' };

function ChangeIcon({ type }: { type: Change['type'] }) {
  if (type === 'weather_update')      return <CloudRain size={14} className="text-blue-400" />;
  if (type === 'diagnostic_alert')    return <Wrench size={14} className="text-red-400" />;
  if (type === 'field_completed_early') return <CheckCircle size={14} className="text-green-400" />;
  return <Sun size={14} className="text-yellow-400" />;
}

function DeltaBadge({ value, unit, goodIfNegative = true }: { value: number; unit: string; goodIfNegative?: boolean }) {
  const isGood = goodIfNegative ? value < 0 : value > 0;
  return (
    <div className={clsx('flex items-center gap-0.5 text-[11px] font-semibold',
      value === 0 ? 'text-slate-400' : isGood ? 'text-green-400' : 'text-red-400')}>
      {value > 0 ? <TrendingUp size={10} /> : value < 0 ? <TrendingDown size={10} /> : null}
      <span>{value > 0 ? '+' : ''}{value}{unit}</span>
    </div>
  );
}

interface MorningBriefingWizardProps {
  onClose: () => void;
}

export default function MorningBriefingWizard({ onClose }: MorningBriefingWizardProps) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);
  const TOTAL_STEPS = 3;

  function handleApply(rank: number) {
    setSelected(rank);
    setApplied(true);
    setTimeout(onClose, 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111a11] border border-green-800/50 rounded-xl shadow-2xl w-[760px] max-w-[95vw] overflow-hidden">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-green-900/30">
          <div className="flex items-center gap-3">
            <Sun size={18} className="text-green-400" />
            <div>
              <div className="text-sm font-bold text-white">Morning Briefing Wizard</div>
              <div className="text-xs text-slate-500">Good morning, Alex — {OVERNIGHT_CHANGES.length} overnight changes detected</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ── Step indicator ────────────────────────────────────────────────── */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-2 mb-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={clsx('h-1 flex-1 rounded-full transition-colors',
                i + 1 <= step ? 'bg-green-500' : 'bg-slate-700')} />
            ))}
          </div>
          <div className="text-[10px] text-slate-500">Step {step} of {TOTAL_STEPS}</div>
        </div>

        {/* ── Step 1: Overnight changes ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Overnight Changes</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {OVERNIGHT_CHANGES.map((change, i) => (
                <div key={i} className="rounded-lg p-3 border"
                  style={{ backgroundColor: SEVERITY_BG[change.severity], borderColor: SEVERITY_COLOR[change.severity] + '40' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <ChangeIcon type={change.type} />
                    <span className="text-[11px] font-semibold text-white">{change.title}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">{change.description}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep(2)}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Review Replans <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Replan options ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Suggested Replans</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {REPLAN_OPTIONS.map((opt) => (
                <div key={opt.rank}
                  className={clsx(
                    'rounded-xl border p-3 cursor-pointer transition-all',
                    selected === opt.rank
                      ? 'border-green-500/70 bg-green-900/20'
                      : 'border-green-900/30 hover:border-green-700/50 bg-[#0d140d]'
                  )}
                  onClick={() => setSelected(opt.rank)}
                >
                  {/* Tag */}
                  <div className="text-[9px] font-bold px-1.5 py-0.5 rounded mb-2 inline-block"
                    style={{ backgroundColor: opt.tagColor + '25', color: opt.tagColor }}>
                    #{opt.rank} {opt.tag}
                  </div>

                  {/* Score */}
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-3xl font-black text-white leading-none">{opt.score}</span>
                    <div className="text-[10px] text-slate-500 mb-0.5">/ 100</div>
                  </div>

                  {/* Mini map placeholder */}
                  <div className="w-full h-[52px] bg-[#0a0f0a] rounded border border-green-900/20 mb-2 flex items-center justify-center">
                    <div className="text-[9px] text-slate-700">Route preview</div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-snug mb-2">{opt.description}</p>

                  {/* Deltas */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <div className="text-[9px] text-slate-600">Miles</div>
                    <DeltaBadge value={opt.miles_change} unit=" mi" goodIfNegative />
                    <div className="text-[9px] text-slate-600">Idle</div>
                    <DeltaBadge value={opt.idle_change_pct} unit="%" goodIfNegative />
                    <div className="text-[9px] text-slate-600">Fuel</div>
                    <DeltaBadge value={opt.fuel_change_pct} unit="%" goodIfNegative />
                    <div className="text-[9px] text-slate-600">Completion</div>
                    <DeltaBadge value={opt.completion_change_days} unit=" days" goodIfNegative />
                  </div>

                  {/* Apply / Edit buttons */}
                  <div className="flex gap-1.5 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleApply(opt.rank); }}
                      className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors">
                      Apply
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg border border-green-700/40 text-green-400 hover:bg-green-900/30 transition-colors">
                      Edit Rules
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-300">← Back</button>
              <div className="flex gap-2">
                <button onClick={() => setStep(3)}
                  className="flex items-center gap-1.5 border border-green-700/40 text-green-400 hover:bg-green-900/30 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  <Zap size={14} /> Run Full Optimization
                </button>
                <button
                  disabled={selected === null}
                  onClick={() => selected && handleApply(selected)}
                  className={clsx(
                    'flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors',
                    selected !== null
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  )}>
                  Apply Selected <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ───────────────────────────────────────────────── */}
        {step === 3 && !applied && (
          <div className="p-5 text-center">
            <Zap size={32} className="text-green-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white mb-2">Running Full Optimization</h3>
            <p className="text-xs text-slate-400 mb-4">Solving for 97 machines with current rules and constraints...</p>
            <div className="flex justify-center gap-1 mb-6">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
            <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-300">← Back</button>
          </div>
        )}

        {/* ── Applied confirmation ──────────────────────────────────────────── */}
        {applied && (
          <div className="p-8 text-center">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Replan Applied!</h3>
            <p className="text-xs text-slate-400">
              {REPLAN_OPTIONS.find(o => o.rank === selected)?.name} dispatched to {Math.floor(Math.random() * 10 + 35)} devices.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
