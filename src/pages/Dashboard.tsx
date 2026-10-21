import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  FileWarning,
  AlertOctagon,
  CheckCircle2,
  Clock,
  MapPin,
  Bot,
  ArrowRight,
  CloudSun,
  Loader2,
  Navigation,
} from 'lucide-react';
import { useReports } from '@/hooks/useReports';
import { CategoryBadge, SeverityBadge, StatusBadge } from '@/components/ui/Badges';
import { HazardMap } from '@/components/HazardMap';
import { getWeather, computeTravelRisk, haversineKm } from '@/services/weather';
import type { WeatherData, TravelRisk } from '@/types';
import { timeAgo } from '@/lib/constants';
import { storageMode } from '@/services/storage';

export function Dashboard() {
  const { reports, loading } = useReports();
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risk, setRisk] = useState<TravelRisk | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const stats = useMemo(() => {
    const open = reports.filter((r) => r.status !== 'Resolved' && r.status !== 'Rejected');
    const highPriority = reports.filter(
      (r) => (r.severity === 'High' || r.severity === 'Critical') && r.status !== 'Resolved'
    );
    const resolved = reports.filter((r) => r.status === 'Resolved');
    return {
      total: reports.length,
      open: open.length,
      highPriority: highPriority.length,
      resolved: resolved.length,
    };
  }, [reports]);

  const nearby = useMemo(() => {
    if (!userCoords) return [];
    return reports
      .filter((r) => r.latitude != null && r.longitude != null && r.status !== 'Resolved')
      .map((r) => ({
        ...r,
        distance: haversineKm(userCoords.lat, userCoords.lon, r.latitude!, r.longitude!),
      }))
      .filter((r) => r.distance <= 20)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [reports, userCoords]);

  useEffect(() => {
    if (userCoords) {
      setWeatherLoading(true);
      getWeather(userCoords.lat, userCoords.lon)
        .then((w) => {
          setWeather(w);
          const openNearby = reports.filter(
            (r) =>
              r.latitude &&
              r.longitude &&
              r.status !== 'Resolved' &&
              haversineKm(userCoords.lat, userCoords.lon, r.latitude!, r.longitude!) <= 20
          ).length;
          setRisk(computeTravelRisk(w, openNearby));
        })
        .catch(() => setWeather(null))
        .finally(() => setWeatherLoading(false));
    }
  }, [userCoords, reports]);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Your journey. Safer, smarter, together.
          </p>
        </div>
        <button onClick={() => navigate('/report')} className="btn btn-primary">
          <PlusCircle size={18} />
          Report a Hazard
        </button>
      </div>

      {storageMode === 'local' && (
        <div className="card p-3.5 flex items-start gap-3 border-l-4" style={{ borderLeftColor: 'rgb(var(--warning))' }}>
          <Clock size={18} className="text-[rgb(var(--warning))] mt-0.5 shrink-0" />
          <p className="text-sm text-muted">
            Running in <strong>local demo mode</strong> — reports are saved in your browser and include
            sample demo data. Data persists across refreshes on this device.
          </p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileWarning} label="Total Reports" value={stats.total} color="rgb(var(--info))" loading={loading} />
        <StatCard icon={Clock} label="Open Reports" value={stats.open} color="rgb(var(--warning))" loading={loading} />
        <StatCard icon={AlertOctagon} label="High-Priority Hazards" value={stats.highPriority} color="rgb(var(--danger))" loading={loading} />
        <StatCard icon={CheckCircle2} label="Resolved" value={stats.resolved} color="rgb(var(--success))" loading={loading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <MapPin size={16} className="accent-text" />
              Report Map Preview
            </h2>
            <Link to="/map" className="text-xs accent-text font-medium hover:underline flex items-center gap-1">
              View full map <ArrowRight size={12} />
            </Link>
          </div>
          <HazardMap reports={reports} height="340px" onMarkerClick={(r) => navigate(`/report/${r.id}`)} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Weather + risk */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <CloudSun size={16} className="accent-text" />
                Weather & Travel Risk
              </h2>
              {!userCoords && (
                <button onClick={requestLocation} className="text-xs accent-text font-medium hover:underline flex items-center gap-1">
                  <Navigation size={12} /> My location
                </button>
              )}
            </div>
            {weatherLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-8 w-full" />
                <div className="skeleton h-4 w-2/3" />
              </div>
            ) : weather && risk ? (
              <WeatherRiskCard weather={weather} risk={risk} />
            ) : (
              <p className="text-xs text-faint py-4 text-center">
                {userCoords ? 'Weather unavailable' : 'Share your location for local weather and risk assessment.'}
              </p>
            )}
          </div>

          {/* AI assistant teaser */}
          <div className="card p-4">
            <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Bot size={16} className="accent-text" />
              AI Assistant
            </h2>
            <p className="text-xs text-muted mb-3 leading-relaxed">
              Ask the rule-based agent to find nearby hazards, classify a report, draft a complaint, or suggest next steps.
            </p>
            <Link to="/agent" className="btn btn-ghost w-full text-xs">
              Open AI Agent <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Nearby hazards */}
      {nearby.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Navigation size={16} className="accent-text" />
            Nearby Hazards
          </h2>
          <div className="space-y-2">
            {nearby.map((r) => (
              <Link
                key={r.id}
                to={`/report/${r.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[rgb(var(--surface-2))] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-faint">{r.location_name} · {r.distance.toFixed(1)} km away</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <SeverityBadge severity={r.severity} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent reports */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Recent Reports</h2>
          <span className="text-xs text-faint">{reports.length} total</span>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8">
            <FileWarning size={32} className="mx-auto text-faint mb-2" />
            <p className="text-sm text-muted">No reports yet</p>
            <button onClick={() => navigate('/report')} className="btn btn-primary mt-3 text-xs">
              <PlusCircle size={14} /> Create the first report
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.slice(0, 6).map((r) => (
              <Link
                key={r.id}
                to={`/report/${r.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[rgb(var(--surface-2))] transition-colors border border-transparent hover:border-app"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-faint mt-0.5">{r.location_name} · {timeAgo(r.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CategoryBadge category={r.category} />
                  <SeverityBadge severity={r.severity} />
                  <StatusBadge status={r.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: typeof FileWarning;
  label: string;
  value: number;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold">
        {loading ? <Loader2 size={20} className="animate-spin text-faint" /> : value}
      </div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}

function WeatherRiskCard({ weather, risk }: { weather: WeatherData; risk: TravelRisk }) {
  const riskColor =
    risk.level === 'Severe' ? 'rgb(var(--danger))'
    : risk.level === 'High' ? 'rgb(var(--warning))'
    : risk.level === 'Moderate' ? 'rgb(var(--warning))'
    : 'rgb(var(--success))';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-bold">{Math.round(weather.temperature)}°C</div>
          <div className="text-xs text-muted">Precipitation: {weather.precipitation_probability}%</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-faint">Estimated Risk</div>
          <div className="text-lg font-bold" style={{ color: riskColor }}>{risk.level}</div>
        </div>
      </div>
      <div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgb(var(--surface-2))' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${risk.score}%`, backgroundColor: riskColor }} />
        </div>
        <div className="text-[10px] text-faint mt-1">Risk score: {risk.score}/100</div>
      </div>
      <div className="space-y-1">
        {risk.factors.slice(0, 3).map((f, i) => (
          <div key={i} className="text-[11px] text-muted flex items-start gap-1.5">
            <span className="text-faint">•</span> {f}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-faint border-t border-app pt-2">
        Estimated risk — not a certified safety prediction. Source: Open-Meteo.
      </p>
    </div>
  );
}
