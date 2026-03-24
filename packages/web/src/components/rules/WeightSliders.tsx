import { useState } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import type { OptimizationWeight } from '@/data/mockRules';
import clsx from 'clsx';

interface WeightSlidersProps {
  weights: OptimizationWeight[];
  onChange?: (weights: OptimizationWeight[]) => void;
}

const DEFAULTS = [40, 30, 20, 10];

export default function WeightSliders({ weights: initialWeights, onChange }: WeightSlidersProps) {
  const [weights, setWeights] = useState(initialWeights);
  const total = weights.reduce((s, w) => s + w.weight_pct, 0);
  const isBalanced = total === 100;

  function handleChange(index: number, newVal: number) {
    const updated = weights.map((w, i) => i === index ? { ...w, weight_pct: newVal } : w);
    setWeights(updated);
    onChange?.(updated);
  }

  function handleReset() {
    const reset = weights.map((w, i) => ({ ...w, weight_pct: DEFAULTS[i] }));
    setWeights(reset);
    onChange?.(reset);
  }

  return (
    <div className="bg-[var(--hf-card)] border border-green-900/30 rounded-lg p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-green-500" />
          <span className="text-sm font-semibold text-slate-200">Priority Weight</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-xs font-mono font-bold px-2 py-0.5 rounded',
            isBalanced ? 'text-green-400 bg-green-500/15' : 'text-red-400 bg-red-500/15'
          )}>
            {total}%
          </span>
          <button onClick={handleReset}
            className="text-slate-600 hover:text-slate-300 transition-colors" title="Reset to defaults">
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Must sum to 100 warning */}
      {!isBalanced && (
        <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
          Weights must sum to 100% before saving
        </div>
      )}

      {/* Sliders */}
      <div className="flex flex-col gap-5">
        {weights.map((w, i) => (
          <div key={w.factor}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{w.icon}</span>
                <span className="text-xs text-slate-300 font-medium">{w.label}</span>
              </div>
              <span className="text-sm font-bold font-mono" style={{ color: w.color }}>
                {w.weight_pct}%
              </span>
            </div>

            {/* Track + thumb */}
            <div className="relative h-2 rounded-full bg-slate-800">
              {/* Filled portion */}
              <div className="absolute h-full rounded-full transition-all"
                style={{ width: `${w.weight_pct}%`, backgroundColor: w.color, opacity: 0.8 }} />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={w.weight_pct}
                onChange={e => handleChange(i, parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                style={{ zIndex: 10 }}
              />
              {/* Thumb */}
              <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all pointer-events-none"
                style={{ left: `calc(${w.weight_pct}% - 8px)`, backgroundColor: w.color }} />
            </div>

            {/* Tick marks at 0/25/50/75/100 */}
            <div className="flex justify-between mt-1 px-0.5">
              {[0, 25, 50, 75, 100].map(tick => (
                <span key={tick} className="text-[8px] text-slate-700">{tick}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Stacked bar visualization */}
      <div>
        <div className="text-[10px] text-slate-600 mb-1.5 uppercase tracking-wide">Distribution</div>
        <div className="flex h-3 rounded-full overflow-hidden gap-px">
          {weights.map(w => (
            <div key={w.factor}
              className="transition-all duration-300 flex items-center justify-center"
              style={{ width: `${w.weight_pct}%`, backgroundColor: w.color }}
              title={`${w.label}: ${w.weight_pct}%`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
          {weights.map(w => (
            <div key={w.factor} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: w.color }} />
              <span className="text-[9px] text-slate-500">{w.label.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
