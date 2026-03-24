import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Sun, BookOpen, Settings, BarChart3, Sliders, Bell, FlaskConical } from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { path: '/command-center', label: 'Command Center', icon: LayoutDashboard },
  { path: '/briefing',       label: 'Morning Briefing', icon: Sun },
  { path: '/simulator',      label: 'What-If',         icon: FlaskConical },
  { path: '/campaigns',      label: 'Campaigns',       icon: BookOpen },
  { path: '/rules',          label: 'Rules Engine',    icon: Sliders },
  { path: '/reports',        label: 'Reports',         icon: BarChart3 },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-[var(--hf-bg)] flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="h-11 flex-shrink-0 border-b border-green-900/40 px-3 flex items-center justify-between z-10">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-green-600/20 border border-green-600/40 flex items-center justify-center">
            <span className="text-green-400 text-[10px] font-black">HF</span>
          </div>
          <span className="text-sm font-black text-green-400 tracking-tight">HarvestForge</span>
          <span className="text-[9px] text-slate-600 font-mono bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
            v3.0
          </span>
        </div>

        {/* Nav — horizontal on desktop */}
        <nav className="flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                      : 'text-slate-500 hover:text-slate-200 border border-transparent hover:bg-white/5'
                  )
                }
              >
                <Icon size={13} />
                <span className="hidden lg:inline">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Right: notifications + user */}
        <div className="flex items-center gap-1">
          <NavLink to="/settings"
            className={({ isActive }) =>
              clsx('w-7 h-7 flex items-center justify-center rounded-md transition-colors',
                isActive ? 'bg-green-500/15 text-green-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5')
            }>
            <Settings size={14} />
          </NavLink>
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 relative">
            <Bell size={14} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded-full bg-green-700/30 border border-green-600/40 text-green-400 text-[10px] font-bold ml-1">
            A
          </button>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
