import type { HazardCategory, ReportStatus, Severity } from '@/types';
import { CATEGORY_META, SEVERITY_META, STATUS_META } from '@/lib/constants';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  return (
    <span
      className="badge"
      style={{ backgroundColor: meta.bg, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="badge"
      style={{
        backgroundColor: `${meta.color}20`,
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: HazardCategory }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <span
      className="badge"
      style={{
        backgroundColor: `${meta.color}18`,
        color: meta.color,
      }}
    >
      <Icon size={11} />
      {category}
    </span>
  );
}
