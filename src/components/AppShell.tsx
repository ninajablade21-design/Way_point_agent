import { NavLink, useLocation } from 'react-router-dom';
import {
  MapPinned,
  LayoutDashboard,
  PlusCircle,
  Bot,
  FileText,
  CloudSun,
  Moon,
  Sun,
  Route,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { storageMode } from '@/services/storage';
import { useState, type ReactNode } from 'react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/map', label: 'Live Map', icon: MapPinned },
  { to: '/report', label: 'Report a Hazard', icon: PlusCircle },
  { to: '/agent', label: 'AI Agent', icon: Bot },
  { to: '/complaints', label: 'Complaints', icon: FileText },
  { to: '/weather', label: 'Weather', icon: CloudSun },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'rgb(var(--bg))' }}>
      {/* Sidebar — desktop */}
      <aside
        className="hidden lg:flex flex-col w-64 shrink-0 border-r border-app"
        style={{ backgroundColor: 'rgb(var(--surface))' }}
      >
        <Brand />
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <StorageBadge />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b border-app px-4 h-14 flex items-center justify-between"
        style={{ backgroundColor: 'rgb(var(--surface))' }}>
        <Brand compact />
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} toggle={toggle} />
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="btn btn-ghost !p-2"
            aria-label="Toggle menu"
          >
            <Route size={18} />
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute right-0 top-14 bottom-0 w-64 border-l border-app p-3 space-y-1"
            style={{ backgroundColor: 'rgb(var(--surface))' }}
            onClick={(e) => e.stopPropagation()}
          >
            {NAV.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                onClick={() => setMobileOpen(false)}
              />
            ))}
            <StorageBadge />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <div className="hidden lg:flex items-center justify-end px-6 h-14 border-b border-app"
          style={{ backgroundColor: 'rgb(var(--surface))' }}>
          <ThemeToggle theme={theme} toggle={toggle} />
        </div>
        <div key={location.pathname} className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? '' : 'px-5 h-16 border-b border-app'}`}>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-strong)))',
          boxShadow: '0 4px 12px rgb(var(--accent) / 0.3)',
        }}
      >
        <MapPinned size={20} className="text-white" />
      </div>
      <div className="leading-tight">
        <div className="font-bold text-[15px] tracking-tight">WAYPOINT AI</div>
        <div className="text-[10px] text-faint uppercase tracking-wider">Road Safety Agent</div>
      </div>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  onClick,
}: {
  to: string;
  label: string;
  icon: typeof MapPinned;
  end?: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'text-white'
            : 'text-muted hover:bg-[rgb(var(--surface-2))]'
        }`
      }
      style={({ isActive }) =>
        isActive
          ? { backgroundColor: 'rgb(var(--accent))' }
          : undefined
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

function ThemeToggle({ theme, toggle }: { theme: string; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      className="btn btn-ghost !p-2"
      aria-label="Toggle theme"
      title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}

function StorageBadge() {
  return (
    <div className="px-5 py-4 border-t border-app">
      <div className="flex items-center gap-2 text-[11px] text-faint">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: storageMode === 'supabase' ? 'rgb(var(--success))' : 'rgb(var(--warning))' }} />
        {storageMode === 'supabase' ? 'Supabase connected' : 'Local demo mode'}
      </div>
    </div>
  );
}
