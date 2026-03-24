import { useState, useMemo } from 'react';
import { Save, AlertTriangle, CheckCircle, Eye, EyeOff, ChevronDown, Zap, ShieldAlert, Sliders } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import clsx from 'clsx';
import RuleFlowEditor from '@/components/rules/RuleFlowEditor';
import WeightSliders from '@/components/rules/WeightSliders';
import { MOCK_RULE_SET, RULE_TEMPLATES, type Rule, type OptimizationWeight } from '@/data/mockRules';

// ── Mock field scoring data (shown in live preview) ──────────────────────────
const MOCK_FIELDS = [
  { name: 'Johnson N40',  base: 72, lat: 37.725, lng: -98.835 },
  { name: 'Miller S80',   base: 58, lat: 37.688, lng: -98.790 },
  { name: 'Anderson E120',base: 81, lat: 37.735, lng: -98.710 },
  { name: 'Wilson Flat',  base: 64, lat: 37.695, lng: -98.912 },
  { name: 'Peterson W200',base: 47, lat: 37.593, lng: -98.760 },
  { name: 'Harvey Co 90', base: 69, lat: 37.643, lng: -98.855 },
  { name: 'Dunlap SE 60', base: 53, lat: 37.670, lng: -98.770 },
  { name: 'Reed N 110',   base: 76, lat: 37.752, lng: -98.680 },
];

// ── Score a field against enabled rules ──────────────────────────────────────
function scoreField(field: typeof MOCK_FIELDS[0], rules: Rule[]): number {
  let score = field.base;
  for (const rule of rules) {
    if (!rule.is_enabled || rule.rule_type !== 'priority') continue;
    const delta = rule.action_params?.score_delta ?? 0;
    // Simulate condition match loosely based on field name patterns
    if (rule.condition_field === 'weather_risk' && field.name.includes('Peterson')) {
      score += delta;
    } else if (rule.condition_field === 'field_yield' && field.base > 65) {
      score += delta;
    } else if (rule.condition_field === 'distance_to_field' && field.base > 60) {
      score += delta;
    } else if (rule.condition_field === 'field_acreage' && field.base < 60) {
      score += delta;
    }
  }
  return Math.max(0, Math.min(100, score));
}

// ── Score color ───────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 80) return '#4CAF50';
  if (score >= 65) return '#8BC34A';
  if (score >= 50) return '#FF9800';
  if (score >= 35) return '#F44336';
  return '#9E9E9E';
}

// ── Dot map bounds (same as FleetMap) ─────────────────────────────────────────
const BOUNDS = { minLng: -99.2, maxLng: -98.3, minLat: 37.35, maxLat: 37.95 };
const DW = 320, DH = 160;
function toXY(lng: number, lat: number): [number, number] {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * DW;
  const y = (1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * DH;
  return [x, y];
}

// ── Conflict detector ─────────────────────────────────────────────────────────
function detectConflicts(rules: Rule[]): string[] {
  const issues: string[] = [];
  const enabled = rules.filter(r => r.is_enabled);

  // Check: same field, opposing prefer/deprioritize
  const byField = new Map<string, Rule[]>();
  for (const r of enabled) {
    const k = r.condition_field;
    byField.set(k, [...(byField.get(k) ?? []), r]);
  }
  for (const [field, rs] of byField) {
    const hasPrefer = rs.some(r => r.action === 'prefer');
    const hasDeprio = rs.some(r => r.action === 'deprioritize');
    if (hasPrefer && hasDeprio) {
      issues.push(`"${field}" field has conflicting prefer + deprioritize rules`);
    }
    const hasBlock = rs.some(r => r.action === 'block');
    const hasExclude = rs.some(r => r.action === 'exclude');
    if (hasBlock && hasExclude) {
      issues.push(`"${field}" field has redundant block + exclude rules`);
    }
  }
  return issues;
}

// ── Custom bar tooltip ────────────────────────────────────────────────────────
function CustomBarTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; score: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-black/90 border border-green-700/40 rounded px-2 py-1 text-[10px]">
      <div className="text-slate-200 font-semibold">{d.name}</div>
      <div style={{ color: scoreColor(d.score) }}>Score: {d.score}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RulesEngine() {
  const [rules, setRules] = useState<Rule[]>(MOCK_RULE_SET.rules);
  const [weights, setWeights] = useState<OptimizationWeight[]>(MOCK_RULE_SET.weights);
  const [template, setTemplate] = useState('wheat_standard');
  const [showPreview, setShowPreview] = useState(true);
  const [saved, setSaved] = useState(false);

  const conflicts = useMemo(() => detectConflicts(rules), [rules]);
  const enabledCount = rules.filter(r => r.is_enabled).length;
  const weeklyTriggers = rules.reduce((s, r) => s + r.triggered_count, 0);
  const totalWeightPct = weights.reduce((s, w) => s + w.weight_pct, 0);

  const scoredFields = useMemo(() =>
    MOCK_FIELDS.map(f => ({ ...f, score: scoreField(f, rules) }))
      .sort((a, b) => b.score - a.score),
    [rules]
  );

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col h-full bg-[var(--hf-bg)] overflow-hidden">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-green-900/30 bg-[var(--hf-card)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Sliders size={15} className="text-green-500" />
            <span className="text-sm font-bold text-slate-100">Rules Engine</span>
          </div>

          {/* Template selector */}
          <div className="relative flex items-center gap-1 bg-black/30 border border-green-900/30 rounded-lg px-2.5 py-1.5">
            <select
              value={template}
              onChange={e => setTemplate(e.target.value)}
              className="bg-transparent text-xs text-slate-300 focus:outline-none appearance-none pr-4 cursor-pointer"
            >
              {RULE_TEMPLATES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 text-slate-500 pointer-events-none" />
          </div>

          {/* Version badge */}
          <span className="text-[10px] font-mono text-slate-500 bg-black/30 border border-slate-800 rounded px-1.5 py-0.5">
            v{MOCK_RULE_SET.version}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Conflict detector */}
          {conflicts.length === 0 ? (
            <div className="flex items-center gap-1.5 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-2.5 py-1.5">
              <CheckCircle size={12} />
              No conflicts
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
              <AlertTriangle size={12} />
              {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-black/30 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <ShieldAlert size={11} className="text-slate-600" />
            {enabledCount}/{rules.length} active
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-black/30 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <Zap size={11} className="text-yellow-600" />
            {weeklyTriggers} triggers/wk
          </div>

          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview(p => !p)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border transition-colors',
              showPreview
                ? 'bg-green-600/20 border-green-600/40 text-green-400'
                : 'bg-black/30 border-slate-700 text-slate-500 hover:text-slate-300'
            )}
          >
            {showPreview ? <Eye size={12} /> : <EyeOff size={12} />}
            Live Preview
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={totalWeightPct !== 100}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all',
              saved
                ? 'bg-green-600/30 border-green-500/50 text-green-300'
                : totalWeightPct !== 100
                  ? 'bg-black/30 border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-green-600 border-green-500 text-white hover:bg-green-500'
            )}
          >
            <Save size={12} />
            {saved ? 'Saved!' : 'Save Version'}
          </button>
        </div>
      </div>

      {/* ── Conflict warnings ──────────────────────────────────────────────── */}
      {conflicts.length > 0 && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-900/30 flex-shrink-0">
          {conflicts.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-red-300">
              <AlertTriangle size={11} />
              {c}
            </div>
          ))}
        </div>
      )}

      {/* ── Main body ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: Rule flow editor */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-green-900/20">
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <RuleFlowEditor onRuleChange={setRules} />
          </div>
        </div>

        {/* Right: Weight sliders + summary */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3 p-3 overflow-y-auto border-r border-green-900/20">
          <WeightSliders weights={weights} onChange={setWeights} />

          {/* Rule summary card */}
          <div className="bg-[var(--hf-card)] border border-green-900/30 rounded-lg p-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Summary</div>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Hard Limits', value: rules.filter(r => r.rule_type === 'constraint' && r.is_enabled).length, color: '#F44336' },
                { label: 'Priority Rules', value: rules.filter(r => r.rule_type === 'priority' && r.is_enabled).length, color: '#4CAF50' },
                { label: 'Disabled', value: rules.filter(r => !r.is_enabled).length, color: '#555' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-slate-400">{item.label}</span>
                  </div>
                  <span className="text-[11px] font-bold font-mono" style={{ color: item.color }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview panel */}
        {showPreview && (
          <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-green-900/20">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Live Score Preview
              </div>
              <div className="text-[9px] text-slate-600 mt-0.5">
                Fields ranked by optimizer score
              </div>
            </div>

            {/* Field dot map */}
            <div className="p-3 border-b border-green-900/20">
              <svg viewBox={`0 0 ${DW} ${DH}`} className="w-full rounded bg-[#0d1a0f] border border-green-900/20">
                {/* Grid */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <line key={`v${i}`} x1={(i + 1) * DW / 6} y1={0} x2={(i + 1) * DW / 6} y2={DH}
                    stroke="#1a2e1a" strokeWidth={0.5} />
                ))}
                {Array.from({ length: 3 }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={(i + 1) * DH / 4} x2={DW} y2={(i + 1) * DH / 4}
                    stroke="#1a2e1a" strokeWidth={0.5} />
                ))}
                {/* Field dots */}
                {scoredFields.map((f) => {
                  const [x, y] = toXY(f.lng, f.lat);
                  const color = scoreColor(f.score);
                  return (
                    <g key={f.name}>
                      <circle cx={x} cy={y} r={10} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1} strokeOpacity={0.6} />
                      <text x={x} y={y - 13} textAnchor="middle" fill={color} fontSize={6} fontFamily="monospace">
                        {f.name.split(' ')[0]}
                      </text>
                      <text x={x} y={y + 4} textAnchor="middle" fill={color} fontSize={7} fontFamily="monospace" fontWeight="bold">
                        {f.score}
                      </text>
                    </g>
                  );
                })}
              </svg>
              {/* Score legend */}
              <div className="flex items-center gap-3 mt-1.5 px-0.5">
                {[
                  { label: '80+', color: '#4CAF50' },
                  { label: '65–79', color: '#8BC34A' },
                  { label: '50–64', color: '#FF9800' },
                  { label: '<50', color: '#F44336' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-[8px] text-slate-500">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar chart */}
            <div className="flex-1 p-3 min-h-0">
              <div className="text-[9px] text-slate-600 uppercase tracking-wide mb-2">Assignment Score by Field</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={scoredFields} margin={{ top: 0, right: 4, bottom: 20, left: -20 }} barSize={18}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#555', fontSize: 7 }}
                    tickFormatter={n => n.split(' ')[0]}
                    axisLine={false}
                    tickLine={false}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#555', fontSize: 7 }}
                    axisLine={false}
                    tickLine={false}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <RechartsTooltip content={<CustomBarTooltip />} cursor={{ fill: '#ffffff08' }} />
                  <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                    {scoredFields.map((f) => (
                      <Cell key={f.name} fill={scoreColor(f.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
