import { useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Edit2, X, Check, Zap } from 'lucide-react';
import clsx from 'clsx';
import {
  type Rule, type RuleType, type RuleAction, type ConditionField, type ConditionOp,
  ACTION_LABEL, ACTION_COLOR, FIELD_LABEL, MOCK_RULE_SET
} from '@/data/mockRules';

interface RuleFlowEditorProps {
  onRuleChange?: (rules: Rule[]) => void;
}

const CONDITION_FIELDS: ConditionField[] = [
  'move_distance', 'fuel_pct', 'field_yield', 'distance_to_field',
  'engine_hours', 'weather_risk', 'crew_hours', 'field_acreage',
];
const CONDITION_OPS: ConditionOp[] = ['>', '<', '>=', '<='];
const ACTIONS: RuleAction[] = ['block', 'alert', 'prefer', 'deprioritize', 'require_support', 'exclude'];

const UNITS: Partial<Record<ConditionField, string>> = {
  move_distance: 'miles', fuel_pct: '%', field_yield: 'bu/ac',
  distance_to_field: 'miles', engine_hours: 'hrs', weather_risk: '%',
  crew_hours: 'hrs', field_acreage: 'acres',
};

function RuleTypeTag({ type }: { type: RuleType }) {
  return (
    <span className={clsx(
      'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
      type === 'constraint'
        ? 'bg-red-500/15 text-red-400 border border-red-500/20'
        : 'bg-green-500/15 text-green-400 border border-green-500/20'
    )}>
      {type === 'constraint' ? 'Hard Limit' : 'Priority'}
    </span>
  );
}

interface RuleCardProps {
  rule: Rule;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (updated: Rule) => void;
  onDelete: () => void;
  onToggle: () => void;
}

function RuleCard({ rule, isEditing, onEdit, onCancelEdit, onSave, onDelete, onToggle }: RuleCardProps) {
  const [draft, setDraft] = useState<Rule>(rule);
  const actionColor = ACTION_COLOR[rule.action];

  if (isEditing) {
    return (
      <div className="bg-[#0d1a0f] border-2 border-green-600/50 rounded-xl p-3 shadow-lg shadow-green-900/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-green-300">Edit Rule</span>
          <button onClick={onCancelEdit} className="text-slate-500 hover:text-slate-300">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          <input
            className="w-full bg-black/40 border border-green-900/40 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-green-600"
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="Rule name"
          />

          {/* Condition row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 font-semibold">IF</span>
            <select
              className="bg-black/40 border border-green-900/40 rounded px-1.5 py-1 text-[10px] text-slate-300 focus:outline-none"
              value={draft.condition_field}
              onChange={e => setDraft(d => ({ ...d, condition_field: e.target.value as ConditionField, condition_unit: UNITS[e.target.value as ConditionField] ?? '' }))}
            >
              {CONDITION_FIELDS.map(f => <option key={f} value={f}>{FIELD_LABEL[f]}</option>)}
            </select>
            <select
              className="bg-black/40 border border-green-900/40 rounded px-1.5 py-1 text-[10px] text-slate-300 focus:outline-none"
              value={draft.condition_op}
              onChange={e => setDraft(d => ({ ...d, condition_op: e.target.value as ConditionOp }))}
            >
              {CONDITION_OPS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <input
              className="w-14 bg-black/40 border border-green-900/40 rounded px-1.5 py-1 text-[10px] text-slate-300 focus:outline-none text-center"
              value={draft.condition_value}
              onChange={e => setDraft(d => ({ ...d, condition_value: e.target.value }))}
            />
            <span className="text-[10px] text-slate-500">{draft.condition_unit}</span>
          </div>

          {/* Action row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 font-semibold">THEN</span>
            <select
              className="bg-black/40 border border-green-900/40 rounded px-1.5 py-1 text-[10px] text-slate-300 focus:outline-none"
              value={draft.action}
              onChange={e => setDraft(d => ({ ...d, action: e.target.value as RuleAction }))}
            >
              {ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
            </select>
            {(draft.action === 'prefer' || draft.action === 'deprioritize') && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500">score</span>
                <input
                  className="w-12 bg-black/40 border border-green-900/40 rounded px-1.5 py-1 text-[10px] text-slate-300 focus:outline-none text-center"
                  value={draft.action_params?.score_delta ?? 0}
                  onChange={e => setDraft(d => ({ ...d, action_params: { score_delta: parseInt(e.target.value) || 0 } }))}
                />
              </div>
            )}
          </div>

          <textarea
            className="w-full bg-black/40 border border-green-900/40 rounded px-2 py-1.5 text-[10px] text-slate-400 focus:outline-none resize-none"
            rows={2}
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            placeholder="Description (optional)"
          />
        </div>

        <div className="flex justify-end gap-1.5">
          <button onClick={onCancelEdit}
            className="px-2.5 py-1 text-xs border border-slate-700 text-slate-400 rounded hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={() => onSave(draft)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 transition-colors">
            <Check size={11} /> Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(
      'group rounded-xl border p-3 transition-all cursor-default',
      rule.is_enabled
        ? 'bg-[#0d1a0f] border-green-900/30 hover:border-green-700/50'
        : 'bg-[#0a0d0a] border-slate-800/50 opacity-50'
    )}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <RuleTypeTag type={rule.rule_type} />
          {rule.triggered_count > 0 && (
            <span className="text-[9px] text-slate-600 flex items-center gap-0.5">
              <Zap size={9} className="text-yellow-600" />
              {rule.triggered_count}× this week
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onEdit} className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-green-400 transition-colors">
            <Edit2 size={11} />
          </button>
          <button onClick={onDelete} className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Rule name */}
      <div className="text-xs font-semibold text-slate-200 mb-1.5">{rule.name}</div>

      {/* Condition → Action visual */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {/* Condition pill */}
        <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/50 rounded-full px-2 py-0.5">
          <span className="text-[9px] text-slate-500 font-semibold">IF</span>
          <span className="text-[10px] text-slate-300 font-mono">
            {FIELD_LABEL[rule.condition_field]} {rule.condition_op} {rule.condition_value} {rule.condition_unit}
          </span>
        </div>

        {/* Arrow */}
        <svg width="16" height="10" className="flex-shrink-0">
          <path d="M0 5 L10 5 M7 2 L10 5 L7 8" stroke="#4a5568" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Action pill */}
        <div className="flex items-center gap-1 rounded-full px-2 py-0.5 border"
          style={{ backgroundColor: actionColor + '15', borderColor: actionColor + '40' }}>
          <span className="text-[9px] font-semibold" style={{ color: actionColor }}>
            {ACTION_LABEL[rule.action].toUpperCase()}
          </span>
          {rule.action_params?.score_delta != null && (
            <span className="text-[9px] font-mono" style={{ color: actionColor }}>
              {rule.action_params.score_delta > 0 ? '+' : ''}{rule.action_params.score_delta}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-[10px] text-slate-500 leading-snug mb-2">{rule.description}</p>

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-slate-600">{rule.is_enabled ? 'Active' : 'Disabled'}</span>
        <button onClick={onToggle} className="flex items-center gap-1 transition-colors"
          style={{ color: rule.is_enabled ? '#4CAF50' : '#555' }}>
          {rule.is_enabled
            ? <ToggleRight size={18} />
            : <ToggleLeft size={18} />}
        </button>
      </div>
    </div>
  );
}

// ── New Rule blank template ────────────────────────────────────────────────────
const BLANK_RULE: Omit<Rule, 'id'> = {
  name: 'New Rule',
  rule_type: 'priority',
  is_enabled: true,
  condition_field: 'distance_to_field',
  condition_op: '<',
  condition_value: '50',
  condition_unit: 'miles',
  action: 'prefer',
  action_params: { score_delta: 10 },
  description: '',
  triggered_count: 0,
  color: '#4CAF50',
};

export default function RuleFlowEditor({ onRuleChange }: RuleFlowEditorProps) {
  const [rules, setRules] = useState<Rule[]>(MOCK_RULE_SET.rules);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'constraint' | 'priority'>('all');

  function handleToggle(id: string) {
    const updated = rules.map(r => r.id === id ? { ...r, is_enabled: !r.is_enabled } : r);
    setRules(updated);
    onRuleChange?.(updated);
  }

  function handleSave(id: string, updated: Rule) {
    const newRules = rules.map(r => r.id === id ? updated : r);
    setRules(newRules);
    setEditingId(null);
    onRuleChange?.(newRules);
  }

  function handleDelete(id: string) {
    const newRules = rules.filter(r => r.id !== id);
    setRules(newRules);
    onRuleChange?.(newRules);
  }

  function handleAddRule() {
    const id = `r${Date.now()}`;
    const newRule: Rule = { ...BLANK_RULE, id };
    setRules(prev => [...prev, newRule]);
    setEditingId(id);
  }

  const constraints = rules.filter(r => r.rule_type === 'constraint');
  const priorities  = rules.filter(r => r.rule_type === 'priority');
  const filtered    = filter === 'all' ? rules : filter === 'constraint' ? constraints : priorities;

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs + add button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-0.5 bg-black/30 rounded-lg p-0.5 border border-green-900/20">
          {(['all', 'constraint', 'priority'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx(
                'px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors capitalize',
                filter === f ? 'bg-green-700/40 text-green-300' : 'text-slate-500 hover:text-slate-300'
              )}>
              {f === 'all' ? `All (${rules.length})` : f === 'constraint' ? `Hard Limits (${constraints.length})` : `Priorities (${priorities.length})`}
            </button>
          ))}
        </div>
        <button onClick={handleAddRule}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 border border-green-600/40 text-green-400 text-xs font-medium rounded-lg hover:bg-green-600/30 transition-colors">
          <Plus size={13} /> Add Rule
        </button>
      </div>

      {/* Two-column layout: Hard Limits | Priorities */}
      <div className="flex-1 overflow-y-auto">
        {filter === 'all' ? (
          <div className="grid grid-cols-2 gap-3 items-start">
            {/* Column headers */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Hard Limits</span>
                <span className="text-[9px] text-slate-600">— violated = blocked</span>
              </div>
              <div className="flex flex-col gap-2">
                {constraints.map(rule => (
                  <RuleCard key={rule.id} rule={rule}
                    isEditing={editingId === rule.id}
                    onEdit={() => setEditingId(rule.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={updated => handleSave(rule.id, updated)}
                    onDelete={() => handleDelete(rule.id)}
                    onToggle={() => handleToggle(rule.id)}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Priorities</span>
                <span className="text-[9px] text-slate-600">— affect score ±</span>
              </div>
              <div className="flex flex-col gap-2">
                {priorities.map(rule => (
                  <RuleCard key={rule.id} rule={rule}
                    isEditing={editingId === rule.id}
                    onEdit={() => setEditingId(rule.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={updated => handleSave(rule.id, updated)}
                    onDelete={() => handleDelete(rule.id)}
                    onToggle={() => handleToggle(rule.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(rule => (
              <RuleCard key={rule.id} rule={rule}
                isEditing={editingId === rule.id}
                onEdit={() => setEditingId(rule.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={updated => handleSave(rule.id, updated)}
                onDelete={() => handleDelete(rule.id)}
                onToggle={() => handleToggle(rule.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
