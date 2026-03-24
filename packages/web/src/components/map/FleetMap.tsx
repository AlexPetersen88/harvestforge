import { useEffect, useRef, useState } from 'react';
import { Layers, Navigation, ZoomIn, ZoomOut } from 'lucide-react';
import { MOCK_MACHINES, STATUS_COLOR, STATUS_LABEL, type MockMachine, type MachineStatus } from '@/data/mockFleet';

interface FleetMapProps {
  onSelectMachine?: (machine: MockMachine | null) => void;
  selectedMachineId?: string | null;
}

// ── Status legend items ───────────────────────────────────────────────────────
const LEGEND: { status: MachineStatus; label: string }[] = [
  { status: 'harvesting', label: 'Harvesting' },
  { status: 'moving',     label: 'Moving' },
  { status: 'idle',       label: 'Idle' },
  { status: 'breakdown',  label: 'Breakdown' },
  { status: 'offline',    label: 'Offline' },
];

// ── Coordinate → SVG pixel (simple equirectangular projection) ─────────────────
const MAP_BOUNDS = { minLng: -99.2, maxLng: -98.3, minLat: 37.35, maxLat: 37.95 };
const W = 800, H = 480;

function lngLatToXY(lng: number, lat: number): [number, number] {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * W;
  const y = (1 - (lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * H;
  return [x, y];
}

// ── Field boundary shapes (simplified polygons for demo) ─────────────────────
const DEMO_FIELDS = [
  { name: 'Johnson North 40',   points: [[-98.845,-98.825], [37.72, 37.74]].map(([a]) => a), color: '#4CAF5030',
    poly: [[-98.845,37.725],[-98.825,37.725],[-98.825,37.715],[-98.845,37.715]] },
  { name: 'Miller South 80',    color: '#2196F330',
    poly: [[-98.805,37.695],[-98.775,37.695],[-98.775,37.680],[-98.805,37.680]] },
  { name: 'Anderson East 120',  color: '#9C27B030',
    poly: [[-98.725,37.745],[-98.695,37.745],[-98.695,37.725],[-98.725,37.725]] },
  { name: 'Wilson Flat 160',    color: '#FF980030',
    poly: [[-98.930,37.705],[-98.895,37.705],[-98.895,37.685],[-98.930,37.685]] },
  { name: 'Peterson West 200',  color: '#00BCD430',
    poly: [[-98.780,37.605],[-98.740,37.605],[-98.740,37.580],[-98.780,37.580]] },
  { name: 'Harvey County 90',   color: '#F4433630',
    poly: [[-98.870,37.655],[-98.840,37.655],[-98.840,37.630],[-98.870,37.630]] },
];

function polyToSVG(poly: [number, number][]) {
  return poly.map(([lng, lat]) => lngLatToXY(lng, lat).join(',')).join(' ');
}

// ── Mapbox token check ────────────────────────────────────────────────────────
const MAPBOX_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN;

export default function FleetMap({ onSelectMachine, selectedMachineId }: FleetMapProps) {
  const mapRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [useMapbox, setUseMapbox] = useState(!!MAPBOX_TOKEN);
  const [zoom, setZoom] = useState(1);
  const [tooltip, setTooltip] = useState<{ machine: MockMachine; x: number; y: number } | null>(null);

  // ── Try to init Mapbox if token is present ────────────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return;
    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.default.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-98.74, 37.65],
        zoom: 9,
      });
      mapRef.current = map;
      // TODO: add machine markers, field boundaries, convoy lines
      return () => map.remove();
    }).catch(() => setUseMapbox(false));
  }, []);

  // ── SVG fallback map ──────────────────────────────────────────────────────
  const counts = MOCK_MACHINES.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="relative w-full h-full bg-[#0d1a0f] rounded-lg overflow-hidden border border-green-900/30">

      {useMapbox ? (
        <div ref={containerRef} className="w-full h-full" />
      ) : (
        /* ── SVG Demo Map ─────────────────────────────────────────────────── */
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s' }}
        >
          {/* Background */}
          <rect width={W} height={H} fill="#0d1a0f" />

          {/* Grid lines */}
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`v${i}`} x1={(i + 1) * W / 10} y1={0} x2={(i + 1) * W / 10} y2={H}
              stroke="#1a2e1a" strokeWidth={1} />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={(i + 1) * H / 6} x2={W} y2={(i + 1) * H / 6}
              stroke="#1a2e1a" strokeWidth={1} />
          ))}

          {/* Field boundaries */}
          {DEMO_FIELDS.map((f) => (
            <polygon key={f.name}
              points={polyToSVG(f.poly as [number, number][])}
              fill={f.color} stroke={f.color.replace('30', 'aa')} strokeWidth={1.5} />
          ))}

          {/* Road — rough east-west highway */}
          <path d={`M 0 ${H * 0.55} Q ${W * 0.5} ${H * 0.52} ${W} ${H * 0.54}`}
            stroke="#2a3a2a" strokeWidth={6} fill="none" />
          <path d={`M 0 ${H * 0.55} Q ${W * 0.5} ${H * 0.52} ${W} ${H * 0.54}`}
            stroke="#ffffff18" strokeWidth={1} fill="none" strokeDasharray="20,12" />

          {/* Machine markers */}
          {MOCK_MACHINES.map((m) => {
            const [x, y] = lngLatToXY(m.position[0], m.position[1]);
            const color = STATUS_COLOR[m.status];
            const isSelected = m.id === selectedMachineId;
            const r = m.machine_type === 'combine' ? 10 : 7;
            return (
              <g key={m.id}
                className="cursor-pointer"
                onClick={() => onSelectMachine?.(m)}
                onMouseEnter={(e) => {
                  const svgRect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
                  const parentRect = (e.currentTarget.closest('.relative') as HTMLElement).getBoundingClientRect();
                  setTooltip({ machine: m, x: e.clientX - parentRect.left, y: e.clientY - parentRect.top });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Pulse ring for harvesting — SVG-native animate avoids transform-origin issues */}
                {m.status === 'harvesting' && (
                  <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={1.5}>
                    <animate attributeName="r" values={`${r};${r + 10}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Breakdown pulse — faster, more urgent */}
                {m.status === 'breakdown' && (
                  <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={2}>
                    <animate attributeName="r" values={`${r};${r + 14}`} dur="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0" dur="1s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Selected ring */}
                {isSelected && (
                  <circle cx={x} cy={y} r={r + 5} fill="none" stroke="#fff" strokeWidth={2} />
                )}
                {/* Main dot */}
                <circle cx={x} cy={y} r={r} fill={color} stroke="#0d1a0f" strokeWidth={1.5} />
                {/* Heading tick for moving machines */}
                {m.status === 'moving' && (
                  <line
                    x1={x} y1={y}
                    x2={x + Math.sin(m.heading * Math.PI / 180) * (r + 6)}
                    y2={y - Math.cos(m.heading * Math.PI / 180) * (r + 6)}
                    stroke={color} strokeWidth={2} strokeLinecap="round" />
                )}
                {/* Name label for combines only */}
                {m.machine_type === 'combine' && (
                  <text x={x} y={y + r + 12} textAnchor="middle"
                    fill="#ffffff99" fontSize={7} fontFamily="monospace">
                    {m.name.replace('Combine ', 'C')}
                  </text>
                )}
              </g>
            );
          })}

          {/* Convoy lines — Cart 1 follows Combine 01 */}
          {(() => {
            const c01 = MOCK_MACHINES.find(m => m.id === 'c01');
            const gc01 = MOCK_MACHINES.find(m => m.id === 'gc01');
            if (!c01 || !gc01) return null;
            const [x1, y1] = lngLatToXY(c01.position[0], c01.position[1]);
            const [x2, y2] = lngLatToXY(gc01.position[0], gc01.position[1]);
            return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4CAF5055" strokeWidth={1} strokeDasharray="4,4" />;
          })()}

          {/* Weather overlay (northwest rain front) */}
          <defs>
            <radialGradient id="rainGrad" cx="20%" cy="20%">
              <stop offset="0%" stopColor="#1a4a8a" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1a4a8a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx={W * 0.15} cy={H * 0.15} rx={W * 0.18} ry={H * 0.18}
            fill="url(#rainGrad)" />
          <text x={W * 0.12} y={H * 0.09} fill="#60a5fa99" fontSize={9} fontFamily="sans-serif">
            🌧 Thu 70%
          </text>
        </svg>
      )}

      {/* ── Region selector ─────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 flex gap-2">
        <select className="bg-black/60 border border-green-700/40 text-green-300 text-xs px-2 py-1 rounded backdrop-blur-sm">
          <option>Region 1 — Central KS</option>
          <option>All Regions</option>
          <option>Region 2 — South KS</option>
        </select>
      </div>

      {/* ── Zoom controls ─────────────────────────────────────────────────── */}
      {!useMapbox && (
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          <button onClick={() => setZoom(z => Math.min(z + 0.2, 2.5))}
            className="w-7 h-7 bg-black/60 border border-green-700/40 rounded text-green-400 flex items-center justify-center hover:bg-green-900/40 backdrop-blur-sm">
            <ZoomIn size={13} />
          </button>
          <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.6))}
            className="w-7 h-7 bg-black/60 border border-green-700/40 rounded text-green-400 flex items-center justify-center hover:bg-green-900/40 backdrop-blur-sm">
            <ZoomOut size={13} />
          </button>
          <button onClick={() => setZoom(1)}
            className="w-7 h-7 bg-black/60 border border-green-700/40 rounded text-green-400 flex items-center justify-center hover:bg-green-900/40 backdrop-blur-sm">
            <Navigation size={13} />
          </button>
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm border border-green-900/30 rounded px-3 py-2 flex flex-col gap-1">
        {LEGEND.map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: STATUS_COLOR[status] }} />
            <span className="text-[10px] text-slate-400">{label}</span>
            <span className="text-[10px] text-slate-600 ml-1">
              {counts[status] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* ── Layer toggle ──────────────────────────────────────────────────── */}
      <button className="absolute bottom-3 right-3 w-8 h-8 bg-black/60 border border-green-700/40 rounded text-green-400 flex items-center justify-center hover:bg-green-900/40 backdrop-blur-sm">
        <Layers size={14} />
      </button>

      {/* ── Machine tooltip ───────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none bg-black/90 border border-green-700/50 rounded-lg px-3 py-2 text-xs backdrop-blur-sm min-w-[160px]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <div className="font-bold text-white mb-1">{tooltip.machine.name}</div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[tooltip.machine.status] }} />
            <span className="text-slate-300">{STATUS_LABEL[tooltip.machine.status]}</span>
          </div>
          {tooltip.machine.current_field && (
            <div className="text-slate-400">{tooltip.machine.current_field}</div>
          )}
          {tooltip.machine.pct_complete != null && (
            <div className="mt-1">
              <div className="flex justify-between text-slate-500 mb-0.5">
                <span>Complete</span>
                <span className="text-green-400">{tooltip.machine.pct_complete}%</span>
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full"
                  style={{ width: `${tooltip.machine.pct_complete}%` }} />
              </div>
            </div>
          )}
          <div className="mt-1 text-slate-500 flex justify-between">
            <span>Fuel</span>
            <span className={tooltip.machine.fuel_pct < 40 ? 'text-yellow-400' : 'text-slate-300'}>
              {tooltip.machine.fuel_pct}%
            </span>
          </div>
          {tooltip.machine.operator && (
            <div className="text-slate-500 flex justify-between">
              <span>Operator</span>
              <span className="text-slate-300">{tooltip.machine.operator}</span>
            </div>
          )}
          <div className="text-slate-500 flex justify-between">
            <span>Speed</span>
            <span className="text-slate-300">{tooltip.machine.speed_mph} mph</span>
          </div>
        </div>
      )}

      {/* ── No Mapbox token notice ─────────────────────────────────────────── */}
      {!useMapbox && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-yellow-900/60 border border-yellow-700/40 rounded px-3 py-1 text-[10px] text-yellow-300 backdrop-blur-sm">
          Demo map — add VITE_MAPBOX_TOKEN to .env for satellite view
        </div>
      )}
    </div>
  );
}
