import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Report } from '@/types';
import { CATEGORY_META, SEVERITY_META } from '@/lib/constants';

interface HazardMapProps {
  reports: Report[];
  onMarkerClick?: (report: Report) => void;
  /** Called with the clicked coordinates. Enables "pick a location" mode. */
  onMapClick?: (lat: number, lon: number) => void;
  /** A user-chosen point to highlight (e.g. the location being reported). */
  pickedLocation?: [number, number] | null;
  /** The user's own position; the map flies there when it changes. */
  userLocation?: [number, number] | null;
  center?: [number, number];
  zoom?: number;
  height?: string;
  selectedId?: string | null;
  className?: string;
}

function createIcon(color: string, selected: boolean): L.DivIcon {
  const size = selected ? 22 : 16;
  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: ${color};
      border: 2.5px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function createDotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 3px ${color}55"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function HazardMap({
  reports,
  onMarkerClick,
  onMapClick,
  pickedLocation,
  userLocation,
  center = [22.5937, 79.9629],
  zoom = 5,
  height = '400px',
  selectedId,
  className,
}: HazardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const pickedRef = useRef<L.Marker | null>(null);
  const userRef = useRef<L.Marker | null>(null);

  // Keep the latest callbacks in refs so changing them never rebuilds the map or its markers.
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onMapClickRef.current = onMapClick;
  });

  const [centerLat, centerLon] = center;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLon],
      zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      pickedRef.current = null;
      userRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial view only; later changes are handled below
  }, []);

  // Re-centre when the requested centre/zoom changes after mount.
  useEffect(() => {
    mapRef.current?.setView([centerLat, centerLon], zoom);
  }, [centerLat, centerLon, zoom]);

  // Rebuild report markers when the data or selection changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    reports.forEach((report) => {
      if (report.latitude == null || report.longitude == null) return;
      const sevMeta = SEVERITY_META[report.severity];
      const catMeta = CATEGORY_META[report.category];
      const marker = L.marker([report.latitude, report.longitude], {
        icon: createIcon(sevMeta.color, report.id === selectedId),
      }).addTo(map);

      marker.bindPopup(`
        <div style="min-width:180px;max-width:240px;font-family:inherit">
          <div style="font-weight:600;font-size:13px;margin-bottom:4px">${escapeHtml(report.title)}</div>
          <div style="font-size:11px;color:rgb(var(--text-muted));margin-bottom:6px">${escapeHtml(catMeta.label)}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:999px;background:${sevMeta.color}20;color:${sevMeta.color}">${escapeHtml(report.severity)}</span>
            <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:999px;background:rgb(var(--surface-2));color:rgb(var(--text-muted))">${escapeHtml(report.status)}</span>
          </div>
          <div style="font-size:11px;color:rgb(var(--text-faint))">${escapeHtml(report.location_name)}</div>
        </div>
      `);

      marker.on('click', () => onMarkerClickRef.current?.(report));
      markersRef.current[report.id] = marker;
    });
  }, [reports, selectedId]);

  // Fly to the selected report.
  useEffect(() => {
    if (!selectedId) return;
    const map = mapRef.current;
    const marker = markersRef.current[selectedId];
    const report = reports.find((r) => r.id === selectedId);
    if (map && marker && report?.latitude != null && report?.longitude != null) {
      map.flyTo([report.latitude, report.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
      marker.openPopup();
    }
  }, [selectedId, reports]);

  // Marker for a location the user is picking.
  const [pickLat, pickLon] = pickedLocation ?? [null, null];
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickedRef.current?.remove();
    pickedRef.current = null;
    if (pickLat != null && pickLon != null) {
      pickedRef.current = L.marker([pickLat, pickLon], { icon: createDotIcon('#2563eb') })
        .addTo(map)
        .bindTooltip('Selected location');
    }
  }, [pickLat, pickLon]);

  // The user's own position.
  const [userLat, userLon] = userLocation ?? [null, null];
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userRef.current?.remove();
    userRef.current = null;
    if (userLat != null && userLon != null) {
      userRef.current = L.marker([userLat, userLon], { icon: createDotIcon('#0d9488') })
        .addTo(map)
        .bindTooltip('You are here');
      map.flyTo([userLat, userLon], Math.max(map.getZoom(), 13), { duration: 0.8 });
    }
  }, [userLat, userLon]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: '100%', cursor: onMapClick ? 'crosshair' : undefined }}
    />
  );
}
