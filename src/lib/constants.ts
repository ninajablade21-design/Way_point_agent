import {
  Cone,
  Droplets,
  TreePine,
  Lightbulb,
  Ban,
  Car,
  TriangleAlert,
  Spline,
  type LucideIcon,
} from 'lucide-react';
import type { AuthorityEntry, HazardCategory, ReportStatus, Severity } from '@/types';

export const CATEGORIES: HazardCategory[] = [
  'Pothole',
  'Flooding',
  'Fallen Tree',
  'Broken Streetlight',
  'Blocked Road',
  'Traffic Obstruction',
  'Damaged Sign',
  'Accident',
  'Other',
];

export const CATEGORY_META: Record<
  HazardCategory,
  { icon: LucideIcon; label: string; color: string }
> = {
  Pothole: { icon: Cone, label: 'Pothole or damaged road', color: '#d97706' },
  Flooding: { icon: Droplets, label: 'Flooding or waterlogging', color: '#0284c7' },
  'Fallen Tree': { icon: TreePine, label: 'Fallen tree', color: '#16a34a' },
  'Broken Streetlight': { icon: Lightbulb, label: 'Broken streetlight', color: '#7c3aed' },
  'Blocked Road': { icon: Ban, label: 'Blocked road', color: '#dc2626' },
  'Traffic Obstruction': { icon: Car, label: 'Traffic obstruction', color: '#ea580c' },
  'Damaged Sign': { icon: TriangleAlert, label: 'Damaged sign', color: '#0891b2' },
  Accident: { icon: TriangleAlert, label: 'Accident or immediate danger', color: '#b91c1c' },
  Other: { icon: Spline, label: 'Other', color: '#64748b' },
};

export const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

export const SEVERITY_META: Record<
  Severity,
  { color: string; bg: string; text: string; label: string; rank: number }
> = {
  Low: { color: '#16a34a', bg: 'rgb(var(--success-soft))', text: 'rgb(var(--success))', label: 'Low', rank: 1 },
  Medium: { color: '#d97706', bg: 'rgb(var(--warning-soft))', text: 'rgb(var(--warning))', label: 'Medium', rank: 2 },
  High: { color: '#ea580c', bg: 'rgb(var(--warning-soft))', text: 'rgb(var(--warning))', label: 'High', rank: 3 },
  Critical: { color: '#dc2626', bg: 'rgb(var(--danger-soft))', text: 'rgb(var(--danger))', label: 'Critical', rank: 4 },
};

export const STATUSES: ReportStatus[] = [
  'Submitted',
  'Under Review',
  'Prepared for Escalation',
  'Resolved',
  'Rejected',
];

export const STATUS_META: Record<
  ReportStatus,
  { color: string; label: string }
> = {
  Submitted: { color: '#64748b', label: 'Submitted' },
  'Under Review': { color: '#0891b2', label: 'Under Review' },
  'Prepared for Escalation': { color: '#d97706', label: 'Prepared for Escalation' },
  Resolved: { color: '#16a34a', label: 'Resolved' },
  Rejected: { color: '#dc2626', label: 'Rejected' },
};

export const STATUS_FLOW: ReportStatus[] = [
  'Submitted',
  'Under Review',
  'Prepared for Escalation',
  'Resolved',
];

export const AUTHORITY_DIRECTORY: AuthorityEntry[] = [
  {
    name: 'Municipal Corporation — Roads Wing',
    type: 'Civic',
    jurisdiction: 'City municipal limits',
    contact: 'Submit via municipal citizen grievance portal',
    verified: false,
  },
  {
    name: 'Public Works Department (PWD)',
    type: 'Government',
    jurisdiction: 'State highways & major roads',
    contact: 'Contact state PWD office',
    verified: false,
  },
  {
    name: 'National Highways Authority of India (NHAI)',
    type: 'Government',
    jurisdiction: 'National highways',
    contact: 'nhai.gov.in grievance portal',
    verified: false,
  },
  {
    name: 'Traffic Police Control Room',
    type: 'Emergency',
    jurisdiction: 'Traffic & road safety',
    contact: 'Dial 112 / 100 for emergencies',
    verified: false,
  },
  {
    name: 'Electricity Board — Street Lighting',
    type: 'Utility',
    jurisdiction: 'Public street lighting',
    contact: 'Local electricity board helpline',
    verified: false,
  },
];

export const WMO_WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export function weatherLabel(code: number): string {
  return WMO_WEATHER_CODES[code] ?? 'Unknown';
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}
