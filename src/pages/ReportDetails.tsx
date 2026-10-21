import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Image as ImageIcon,
  Bot,
  FileText,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { repo } from '@/services/storage';
import { useReports } from '@/hooks/useReports';
import { useToast } from '@/components/ui/Toast';
import { CategoryBadge, SeverityBadge, StatusBadge } from '@/components/ui/Badges';
import { HazardMap } from '@/components/HazardMap';
import { formatDateTime, timeAgo, STATUSES, STATUS_META, keywordSimilarity, haversineKm } from '@/lib/constants';
import { classifyHazard } from '@/services/classifier';
import type { Report, StatusHistoryEntry } from '@/types';

export function ReportDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reports, refresh } = useReports();
  const { toast } = useToast();

  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [r, h] = await Promise.all([
          repo.getReport(id),
          repo.getStatusHistory(id),
        ]);
        setReport(r);
        setHistory(h);
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, toast]);

  const similar = report
    ? reports
        .filter((r) => r.id !== report.id)
        .map((r) => {
          const catMatch = r.category === report.category ? 1 : 0;
          const kw = keywordSimilarity(`${report.title} ${report.description}`, `${r.title} ${r.description}`);
          const dist =
            report.latitude != null && report.longitude != null && r.latitude != null && r.longitude != null
              ? haversineKm(report.latitude, report.longitude, r.latitude, r.longitude)
              : null;
          return { report: r, catMatch, kw, dist };
        })
        .filter((r) => r.catMatch > 0 || r.kw > 0.2)
        .sort((a, b) => b.catMatch - a.catMatch || b.kw - a.kw)
        .slice(0, 3)
    : [];

  const aiSummary = report ? classifyHazard(`${report.title} ${report.description}`) : null;

  const handleStatusUpdate = async () => {
    if (!report || !newStatus) return;
    setUpdating(true);
    try {
      await repo.updateReportStatus(report.id, newStatus as Report['status'], statusNote || 'Status updated', true);
      const [r, h] = await Promise.all([repo.getReport(report.id), repo.getStatusHistory(report.id)]);
      setReport(r);
      setHistory(h);
      await refresh();
      toast('Demo status updated', 'success');
      setShowStatusModal(false);
      setStatusNote('');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!report) return;
    if (!confirm('Delete this report? This cannot be undone.')) return;
    try {
      await repo.deleteReport(report.id);
      await refresh();
      toast('Report deleted', 'success');
      navigate('/');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="skeleton h-8 w-64 mb-4" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <AlertTriangle size={32} className="mx-auto text-faint mb-3" />
        <p className="text-muted">Report not found.</p>
        <Link to="/" className="btn btn-ghost mt-4">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[rgb(var(--text))]">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{report.title}</h1>
            <p className="text-xs text-faint mt-1 font-mono">
              ID: {report.id.slice(0, 8).toUpperCase()} · Created {timeAgo(report.created_at)}
            </p>
          </div>
          <button onClick={handleDelete} className="btn btn-ghost !p-2 text-[rgb(var(--danger))]" title="Delete report">
            <Trash2 size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <CategoryBadge category={report.category} />
          <SeverityBadge severity={report.severity} />
          <StatusBadge status={report.status} />
        </div>

        {report.description && (
          <p className="text-sm text-muted leading-relaxed mb-4">{report.description}</p>
        )}

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted">
            <MapPin size={15} className="text-faint" /> {report.location_name}
          </div>
          <div className="flex items-center gap-2 text-muted">
            <Calendar size={15} className="text-faint" /> {formatDateTime(report.created_at)}
          </div>
          {report.latitude != null && report.longitude != null && (
            <div className="flex items-center gap-2 text-muted text-xs">
              <MapPin size={15} className="text-faint" /> {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
            </div>
          )}
          <div className="flex items-center gap-2 text-muted text-xs">
            <Bot size={15} className="text-faint" />
            Classification: {report.classification_source === 'rule-based-agent' ? 'AI-assisted' : 'User-entered'}
            ({Math.round(report.classification_confidence * 100)}%)
          </div>
        </div>

        {report.image_url && (
          <div className="mt-4">
            <div className="text-xs text-faint mb-1.5 flex items-center gap-1.5"><ImageIcon size={13} /> Attached photo</div>
            <img src={report.image_url} alt="Report" className="rounded-xl max-h-72 object-cover border border-app" />
          </div>
        )}
      </div>

      {/* Map */}
      {report.latitude != null && report.longitude != null && (
        <div className="card p-2 overflow-hidden">
          <HazardMap reports={[report]} height="250px" center={[report.latitude, report.longitude]} zoom={14} />
        </div>
      )}

      {/* AI summary */}
      {aiSummary && (
        <div className="card p-4">
          <h2 className="font-semibold text-sm flex items-center gap-2 mb-2">
            <Bot size={16} className="accent-text" /> AI Summary
          </h2>
          <div className="text-sm text-muted space-y-1.5">
            <p>{aiSummary.explanation}</p>
            <p className="text-xs">Suggested category: <strong>{aiSummary.category}</strong> · Severity: <strong>{aiSummary.severity}</strong></p>
          </div>
        </div>
      )}

      {/* Status timeline */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Status Timeline</h2>
          <button onClick={() => { setNewStatus(report.status); setShowStatusModal(true); }} className="btn btn-ghost text-xs">
            Update status
          </button>
        </div>
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-xs text-faint">No status history yet.</p>
          ) : (
            history.map((h, i) => {
              const Icon = h.new_status === 'Resolved' ? CheckCircle : h.new_status === 'Rejected' ? AlertTriangle : Clock;
              const color = STATUS_META[h.new_status]?.color ?? 'rgb(var(--text-faint))';
              return (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    {i < history.length - 1 && <div className="w-px flex-1 bg-[rgb(var(--border))] my-1" />}
                  </div>
                  <div className="pb-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{h.new_status}</span>
                      {h.is_demo_action && (
                        <span className="badge" style={{ backgroundColor: 'rgb(var(--warning-soft))', color: 'rgb(var(--warning))' }}>
                          Demo
                        </span>
                      )}
                    </div>
                    {h.note && <p className="text-xs text-muted mt-0.5">{h.note}</p>}
                    <p className="text-[11px] text-faint mt-0.5">{formatDateTime(h.created_at)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Similar reports */}
      {similar.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold text-sm mb-3">Similar Reports</h2>
          <div className="space-y-2">
            {similar.map(({ report: r, kw, dist }) => (
              <Link
                key={r.id}
                to={`/report/${r.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[rgb(var(--surface-2))] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-faint">{r.location_name}{dist != null && ` · ${dist.toFixed(1)} km`} · {Math.round(kw * 100)}% text match</p>
                </div>
                <ChevronRight size={16} className="text-faint shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate(`/agent?task=draft complaint for report ${report.id}`)}
          className="btn btn-ghost"
        >
          <FileText size={16} /> Draft a complaint
        </button>
        <button
          onClick={() => navigate(`/agent?task=what should I do next with report ${report.id}`)}
          className="btn btn-ghost"
        >
          <Bot size={16} /> Ask AI for next steps
        </button>
      </div>

      {/* Status update modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowStatusModal(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="card p-5 w-full max-w-md relative animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">Update Status</h3>
            <p className="text-xs text-faint mb-4">This is a demo action — it does not notify any authority.</p>
            <div className="space-y-3">
              <div>
                <label className="label">New status</label>
                <select className="input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <textarea className="input min-h-[60px]" placeholder="Add a note about this status change..." value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleStatusUpdate} disabled={updating || !newStatus} className="btn btn-primary flex-1">
                {updating ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirm update
              </button>
              <button onClick={() => setShowStatusModal(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
