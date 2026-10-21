import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CloudSun, Navigation, Loader2, Droplets, Wind, Thermometer, AlertTriangle } from 'lucide-react';
import { getWeather, computeTravelRisk, haversineKm } from '@/services/weather';
import { useReports } from '@/hooks/useReports';
import { useToast } from '@/components/ui/Toast';
import { weatherLabel } from '@/lib/constants';
import type { WeatherData } from '@/types';

export function Weather() {
  const { reports } = useReports();
  const { toast } = useToast();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const autoPicked = useRef(false);

  const fetchWeather = useCallback(
    async (lat: number, lon: number) => {
      setLoading(true);
      setWeather(null);
      try {
        setWeather(await getWeather(lat, lon));
      } catch (e) {
        toast('Weather service unavailable: ' + (e as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Risk is derived from the weather + current reports, so it stays correct when reports change.
  const risk = useMemo(() => {
    if (!weather || !coords) return null;
    const openNearby = reports.filter(
      (r) =>
        r.latitude != null &&
        r.longitude != null &&
        r.status !== 'Resolved' &&
        r.status !== 'Rejected' &&
        haversineKm(coords.lat, coords.lon, r.latitude, r.longitude) <= 20
    ).length;
    return computeTravelRisk(weather, openNearby);
  }, [weather, coords, reports]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast('Geolocation not supported', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your location' };
        setCoords(c);
        fetchWeather(c.lat, c.lon);
      },
      () => toast('Could not get your location. Check your browser permissions.', 'error')
    );
  };

  // On first load, show weather for the newest report that has coordinates (once only).
  useEffect(() => {
    if (autoPicked.current) return;
    const firstWithCoords = reports.find((r) => r.latitude != null && r.longitude != null);
    if (!firstWithCoords) return;
    autoPicked.current = true;
    setCoords({ lat: firstWithCoords.latitude!, lon: firstWithCoords.longitude!, label: firstWithCoords.location_name });
    fetchWeather(firstWithCoords.latitude!, firstWithCoords.longitude!);
  }, [reports, fetchWeather]);

  const riskColor =
    risk?.level === 'Severe' ? 'rgb(var(--danger))'
    : risk?.level === 'High' ? 'rgb(var(--warning))'
    : risk?.level === 'Moderate' ? 'rgb(var(--warning))'
    : 'rgb(var(--success))';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Weather & Travel Risk</h1>
          <p className="text-sm text-muted mt-1">Live conditions from Open-Meteo + estimated risk from reported hazards.</p>
        </div>
        <button onClick={handleUseMyLocation} className="btn btn-ghost text-xs">
          <Navigation size={14} /> Use my location
        </button>
      </div>

      {coords && (
        <p className="text-xs text-faint">Showing weather for: <strong>{coords.label}</strong></p>
      )}

      {loading ? (
        <div className="card p-8 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin accent-text" />
        </div>
      ) : weather ? (
        <>
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--accent-soft))' }}>
                <CloudSun size={24} className="accent-text" />
              </div>
              <div>
                <div className="text-2xl font-bold">{Math.round(weather.temperature)}°C</div>
                <div className="text-sm text-muted">{weatherLabel(weather.weatherCode)}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Metric icon={Droplets} label="Precipitation" value={`${weather.precipitation.toFixed(1)}mm`} sub={`${weather.precipitation_probability}% prob`} />
              <Metric icon={Wind} label="Wind" value={`${weather.windspeed} km/h`} />
              <Metric icon={Thermometer} label="Conditions" value={weather.isDay ? 'Daytime' : 'Night'} />
            </div>

            <p className="text-[10px] text-faint mt-4 border-t border-app pt-2">
              Source: Open-Meteo · Retrieved {new Date(weather.timestamp).toLocaleTimeString('en-IN')}
            </p>
          </div>

          {/* Risk */}
          {risk && (
            <div className="card p-5">
              <h2 className="font-semibold text-sm mb-4">Estimated Travel Risk</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-3xl font-bold" style={{ color: riskColor }}>{risk.level}</div>
                <div className="flex-1">
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgb(var(--surface-2))' }}>
                    <div className="h-full rounded-full" style={{ width: `${risk.score}%`, backgroundColor: riskColor }} />
                  </div>
                  <div className="text-xs text-faint mt-1">Score: {risk.score}/100</div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted mb-2">Contributing factors:</p>
                {risk.factors.map((f) => (
                  <div key={f} className="text-sm text-muted flex items-start gap-2">
                    <span className="text-faint mt-0.5">•</span> {f}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-faint border-t border-app pt-2 mt-4">
                Estimated risk — not a certified safety prediction. Based on weather conditions and nearby open hazard reports.
              </p>
            </div>
          )}

          {/* Forecast */}
          {weather.forecast && weather.forecast.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-sm mb-4">5-Day Forecast</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {weather.forecast.map((day) => (
                  <div key={day.date} className="text-center p-3 rounded-xl bg-[rgb(var(--surface-2))]">
                    <div className="text-xs text-faint">{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                    <div className="text-lg font-bold mt-1">{Math.round(day.tempMax)}°</div>
                    <div className="text-xs text-faint">{Math.round(day.tempMin)}°</div>
                    <div className="text-[10px] text-muted mt-1">{weatherLabel(day.weatherCode)}</div>
                    {day.precipitationMax > 0 && (
                      <div className="text-[10px] text-[rgb(var(--info))] mt-0.5 flex items-center justify-center gap-0.5">
                        <Droplets size={9} /> {day.precipitationMax.toFixed(1)}mm
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card p-8 text-center">
          <AlertTriangle size={32} className="mx-auto text-faint mb-3" />
          <p className="text-sm text-muted">Weather data unavailable.</p>
          <button onClick={handleUseMyLocation} className="btn btn-ghost mt-3 text-xs">
            <Navigation size={14} /> Try with my location
          </button>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: typeof Droplets; label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 rounded-xl bg-[rgb(var(--surface-2))]">
      <Icon size={16} className="text-faint mb-1.5" />
      <div className="text-xs text-faint">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-faint mt-0.5">{sub}</div>}
    </div>
  );
}
