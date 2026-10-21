import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, List, Map as MapIcon, Navigation, X } from 'lucide-react';
import { useReports } from '@/hooks/useReports';
import { HazardMap } from '@/components/HazardMap';
import { CategoryBadge, SeverityBadge, StatusBadge } from '@/components/ui/Badges';
import { CATEGORIES, SEVERITIES, STATUSES, CATEGORY_META, SEVERITY_META, timeAgo } from '@/lib/constants';
import type { HazardCategory, ReportStatus, Severity } from '@/types';
import { useToast } from '@/components/ui/Toast';

export function LiveMap() {
  const { reports } = useReports();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [categoryFilter, setCategoryFilter] = useState<HazardCategory | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && r.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [reports, categoryFilter, severityFilter, statusFilter]);

  const activeFilters =
    (categoryFilter !== 'all' ? 1 : 0) + (severityFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast('Geolocation not supported on this device', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => toast('Location found — markers near you are visible on the map', 'success'),
      () => toast('Could not get your location. Check browser permissions.', 'error')
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Hazard Map</h1>
          <p className="text-sm text-muted mt-1">
            {filtered.length} report{filtered.length !== 1 ? 's' : ''} shown
            {activeFilters > 0 && ` · ${activeFilters} filter${activeFilters > 1 ? 's' : ''} active`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={requestLocation} className="btn btn-ghost text-xs">
            <Navigation size={14} /> My location
          </button>
          <div className="flex rounded-lg border border-app overflow-hidden">
            <button
              onClick={() => setView('map')}
              className={`px-3 py-2 text-xs font-medium ${view === 'map' ? 'bg-[rgb(var(--accent))] text-white' : 'surface'}`}
            >
              <MapIcon size={14} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 text-xs font-medium ${view === 'list' ? 'bg-[rgb(var(--accent))] text-white' : 'surface'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setShowFilters((s) => !s)} className="flex items-center gap-2 text-sm font-medium">
            <Filter size={16} /> Filters
            {activeFilters > 0 && (
              <span className="badge" style={{ backgroundColor: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent-strong))' }}>
                {activeFilters}
              </span>
            )}
          </button>
          {activeFilters > 0 && (
            <button
              onClick={() => {
                setCategoryFilter('all');
                setSeverityFilter('all');
                setStatusFilter('all');
              }}
              className="text-xs text-faint hover:text-muted flex items-center gap-1"
            >
              <X size={12} /> Clear all
            </button>
          )}
        </div>
        {showFilters && (
          <div className="space-y-3 animate-fade-in">
            <FilterGroup label="Category">
              <Chip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>All</Chip>
              {CATEGORIES.map((c) => (
                <Chip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
                  {c}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup label="Severity">
              <Chip active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')}>All</Chip>
              {SEVERITIES.map((s) => (
                <Chip key={s} active={severityFilter === s} onClick={() => setSeverityFilter(s)}>
                  <span style={{ color: SEVERITY_META[s].color }}>●</span> {s}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup label="Status">
              <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
              {STATUSES.map((s) => (
                <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                  {s}
                </Chip>
              ))}
            </FilterGroup>
          </div>
        )}
      </div>

      {view === 'map' ? (
        <div className="card p-2 overflow-hidden">
          <HazardMap
            reports={filtered}
            height="600px"
            selectedId={selectedId}
            onMarkerClick={(r) => setSelectedId(r.id)}
          />
          {/* Legend */}
          <div className="flex flex-wrap gap-3 p-3 border-t border-app">
            <span className="text-xs text-faint font-medium">Legend:</span>
            {SEVERITIES.map((s) => (
              <div key={s} className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SEVERITY_META[s].color }} />
                {s}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_META.Other.color }} />
              Category colors in popups
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-muted">No reports match these filters.</p>
            </div>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/report/${r.id}`)}
                className="card p-4 w-full text-left hover:border-[rgb(var(--accent))] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{r.title}</p>
                    <p className="text-xs text-faint mt-1">{r.location_name} · {timeAgo(r.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <CategoryBadge category={r.category} />
                    <SeverityBadge severity={r.severity} />
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`chip ${active ? 'active' : ''}`}>
      {children}
    </button>
  );
}
