import { useState } from 'react';
import { X, Send } from 'lucide-react';
import clsx from 'clsx';
import { MOCK_MACHINES, TYPE_ICON, type MockMachine } from '@/data/mockFleet';

const MESSAGE_TEMPLATES = [
  { label: 'Move to field',  template: 'Move to: ' },
  { label: 'Return to yard', template: 'Return to yard immediately.' },
  { label: 'Fuel up',        template: 'Stop and fuel up at the tender before continuing.' },
  { label: 'Check in',       template: 'Please check in with a status update.' },
  { label: 'Custom',         template: '' },
];

interface DispatchPanelProps {
  preselectedMachine?: MockMachine | null;
  onClose: () => void;
}

export default function DispatchPanel({ preselectedMachine, onClose }: DispatchPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    preselectedMachine ? new Set([preselectedMachine.id]) : new Set()
  );
  const [templateIndex, setTemplateIndex] = useState(0);
  const [message, setMessage] = useState(MESSAGE_TEMPLATES[0].template);
  const [sent, setSent] = useState(false);

  // Only crew-operated machines shown as dispatch targets
  const crewMachines = MOCK_MACHINES.filter(
    m => m.machine_type === 'combine' || m.machine_type === 'grain_cart'
  );

  function toggleMachine(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectTemplate(i: number) {
    setTemplateIndex(i);
    if (MESSAGE_TEMPLATES[i].template) setMessage(MESSAGE_TEMPLATES[i].template);
    else setMessage('');
  }

  function handleSend() {
    if (!message.trim() || selectedIds.size === 0) return;
    setSent(true);
    // TODO: call POST /api/mobile/dispatch with { machine_ids, message }
    setTimeout(() => {
      setSent(false);
      onClose();
    }, 1800);
  }

  const canSend = message.trim().length > 0 && selectedIds.size > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f1a0f] border border-green-900/40 rounded-xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-green-900/30">
          <div className="flex items-center gap-2">
            <Send size={14} className="text-green-400" />
            <span className="text-sm font-bold text-white">Dispatch to Crew</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">

          {/* Machine selector */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-2 block">
              Send to ({selectedIds.size} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {crewMachines.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleMachine(m.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    selectedIds.has(m.id)
                      ? 'bg-green-500/15 border-green-500/40 text-green-300'
                      : 'bg-black/30 border-green-900/20 text-slate-500 hover:text-slate-300 hover:border-green-900/40'
                  )}>
                  <span>{TYPE_ICON[m.machine_type]}</span>
                  <span>{m.name}</span>
                  {m.operator && (
                    <span className="text-[10px] opacity-60">· {m.operator.split(' ')[0]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Template picker */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-2 block">
              Message type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MESSAGE_TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => selectTemplate(i)}
                  className={clsx(
                    'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                    templateIndex === i
                      ? 'bg-green-500/15 border-green-500/30 text-green-300'
                      : 'bg-black/20 border-green-900/20 text-slate-500 hover:text-slate-300'
                  )}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message input */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-2 block">
              Message
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Type your message…"
              className="w-full bg-black/30 border border-green-900/30 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-green-700/50 resize-none"
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend || sent}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors',
              sent
                ? 'bg-green-700/40 text-green-300 border border-green-700/30'
                : canSend
                  ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            )}>
            {sent
              ? <>✓ Sent to {selectedIds.size} machine{selectedIds.size > 1 ? 's' : ''}</>
              : <><Send size={14} />Send to {selectedIds.size > 0 ? `${selectedIds.size} machine${selectedIds.size > 1 ? 's' : ''}` : 'selected machines'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
