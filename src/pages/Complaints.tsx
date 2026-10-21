import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Copy, Check, Loader2, Pencil, X, ShieldCheck, Bot } from 'lucide-react';
import { repo } from '@/services/storage';
import { useToast } from '@/components/ui/Toast';
import { useReports } from '@/hooks/useReports';
import { formatDateTime } from '@/lib/constants';
import type { ComplaintDraft } from '@/types';

export function Complaints() {
  const { reports } = useReports();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<ComplaintDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ComplaintDraft | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editAuthority, setEditAuthority] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await repo.listComplaints();
      setDrafts(data);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (d: ComplaintDraft) => {
    setEditing(d);
    setEditSubject(d.subject);
    setEditBody(d.body);
    setEditAuthority(d.authority_name);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await repo.updateComplaint(editing.id, {
        subject: editSubject,
        body: editBody,
        authority_name: editAuthority,
      });
      await load();
      toast('Draft saved', 'success');
      setEditing(null);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const approve = async (d: ComplaintDraft) => {
    try {
      await repo.updateComplaint(d.id, { approval_status: 'approved' });
      await load();
      toast('Draft approved. You can now copy and share it.', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const copyText = async (d: ComplaintDraft) => {
    const text = `${d.subject}\n\n${d.body}`;
    await navigator.clipboard.writeText(text);
    setCopied(d.id);
    setTimeout(() => setCopied(null), 2000);
    toast('Copied to clipboard', 'success');
  };

  const reportFor = (id: string) => reports.find((r) => r.id === id);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Complaint Drafts</h1>
        <p className="text-sm text-muted mt-1">Review, edit, and approve AI-drafted civic complaints.</p>
      </div>

      <div className="card p-3.5 flex items-start gap-3 border-l-4" style={{ borderLeftColor: 'rgb(var(--info))' }}>
        <ShieldCheck size={18} className="text-[rgb(var(--info))] mt-0.5 shrink-0" />
        <p className="text-xs text-muted leading-relaxed">
          <strong>Important:</strong> Approving a draft means you have reviewed it — it does <strong>not</strong> send
          the complaint to any authority. To submit, copy the approved text and use the relevant authority official channel.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="skeleton h-32 w-full" />)}
        </div>
      ) : drafts.length === 0 ? (
        <div className="card p-8 text-center">
          <FileText size={32} className="mx-auto text-faint mb-3" />
          <p className="text-sm text-muted mb-2">No complaint drafts yet</p>
          <p className="text-xs text-faint mb-4">
            Ask the AI Agent to draft a complaint, or start from a report.
          </p>
          <Link to="/agent" className="btn btn-primary text-xs">
            <Bot size={14} /> Open AI Agent
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((d) => {
            const report = reportFor(d.report_id);
            return (
              <div key={d.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm">{d.subject}</h3>
                    <p className="text-xs text-faint mt-1">
                      {report ? `For: ${report.title}` : 'Report not found'} · {formatDateTime(d.created_at)}
                    </p>
                  </div>
                  <span
                    className="badge"
                    style={
                      d.approval_status === 'approved'
                        ? { backgroundColor: 'rgb(var(--success-soft))', color: 'rgb(var(--success))' }
                        : { backgroundColor: 'rgb(var(--surface-2))', color: 'rgb(var(--text-muted))' }
                    }
                  >
                    {d.approval_status === 'approved' ? <Check size={11} /> : <Pencil size={11} />}
                    {d.approval_status}
                  </span>
                </div>

                {editing?.id === d.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="label">Subject</label>
                      <input className="input" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Authority</label>
                      <input className="input" value={editAuthority} onChange={(e) => setEditAuthority(e.target.value)} placeholder="e.g. Municipal Corporation — Roads Wing" />
                    </div>
                    <div>
                      <label className="label">Body</label>
                      <textarea className="input min-h-[200px] font-mono text-xs resize-y" value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="btn btn-primary text-xs">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save
                      </button>
                      <button onClick={() => setEditing(null)} className="btn btn-ghost text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {d.authority_name && (
                      <p className="text-xs text-muted mb-2">To: <strong>{d.authority_name}</strong></p>
                    )}
                    <pre className="text-xs text-muted whitespace-pre-wrap font-mono bg-[rgb(var(--surface-2))] rounded-lg p-3 max-h-48 overflow-y-auto border border-app">
{d.body}
                    </pre>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => copyText(d)} className="btn btn-ghost text-xs">
                        {copied === d.id ? <Check size={14} className="text-[rgb(var(--success))]" /> : <Copy size={14} />}
                        {copied === d.id ? 'Copied' : 'Copy'}
                      </button>
                      <button onClick={() => startEdit(d)} className="btn btn-ghost text-xs">
                        <Pencil size={14} /> Edit
                      </button>
                      {d.approval_status !== 'approved' && (
                        <button
                          onClick={() => approve(d)}
                          className="btn btn-primary text-xs"
                        >
                          <Check size={14} /> Approve
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
