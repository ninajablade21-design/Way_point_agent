import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Report } from '@/types';
import { CATEGORY_META, SEVERITY_META } from '@/lib/constants';

interface HazardMapProps {
  reports: Report[];
  onMarkerClick?: (report: Report) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  selectedId?: string | null;
  className?: string;
}

function createIcon(color: string, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${selected ? 22 : 16}px;
      height: ${selected ? 22 : 16}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: ${color};
      border: 2.5px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [selected ? 22 : 16, selected ? 22 : 16],
    iconAnchor: [selected ? 11 : 8, selected ? 22 : 16],
  });
}

export function HazardMap({
  reports,
  onMarkerClick,
  center = [22.5937, 79.9629],
  zoom = 5,
  height = '400px',
  selectedId,
  className,
}: HazardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    reports.forEach((report) => {
      if (report.latitude == null || report.longitude == null) return;
      const sevMeta = SEVERITY_META[report.severity];
      const isSelected = report.id === selectedId;
      const marker = L.marker([report.latitude, report.longitude], {
        icon: createIcon(sevMeta.color, isSelected),
      }).addTo(map);

      const catMeta = CATEGORY_META[report.category];
      marker.bindPopup(`
        <div style="min-width:180px;max-width:240px;font-family:inherit">
          <div style="font-weight:600;font-size:13px;margin-bottom:4px">${escapeHtml(report.title)}</div>
          <div style="font-size:11px;color:rgb(var(--text-muted));margin-bottom:6px">${catMeta.label}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:999px;background:${sevMeta.color}20;color:${sevMeta.color}">${report.severity}</span>
            <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:999px;background:rgb(var(--surface-2));color:rgb(var(--text-muted))">${report.status}</span>
          </div>
          <div style="font-size:11px;color:rgb(var(--text-faint))">${escapeHtml(report.location_name)}</div>
        </div>
      `);

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(report));
      }

      markersRef.current[report.id] = marker;
    });
  }, [reports, onMarkerClick, selectedId]);

  useEffect(() => {
    if (selectedId && markersRef.current[selectedId]) {
      const map = mapRef.current;
      const marker = markersRef.current[selectedId];
      const report = reports.find((r) => r.id === selectedId);
      if (map && marker && report?.latitude != null && report?.longitude != null) {
        map.flyTo([report.latitude, report.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
        marker.openPopup();
      }
    }
  }, [selectedId, reports]);

  return <div ref={containerRef} className={className} style={{ height, width: '100%' }} />;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
