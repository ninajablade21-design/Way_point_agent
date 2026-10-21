import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import type {
  Report,
  StatusHistoryEntry,
  ComplaintDraft,
  AgentRun,
  ReportStatus,
} from '@/types';

const LS_REPORTS = 'waypoint.reports';
const LS_HISTORY = 'waypoint.history';
const LS_COMPLAINTS = 'waypoint.complaints';
const LS_AGENT = 'waypoint.agent_runs';

function lsRead<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function lsWrite<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    // Surface quota/private-mode failures instead of silently losing a write.
    throw new Error(
      error instanceof Error && error.name === 'QuotaExceededError'
        ? 'Browser storage is full. Export or remove some demo data and try again.'
        : 'Browser storage is unavailable. Enable site storage and try again.'
    );
  }
}

function now(): string {
  return new Date().toISOString();
}

export const storageMode = isSupabaseConfigured ? 'supabase' : 'local';

export const repo = {
  async listReports(): Promise<Report[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Report[];
    }
    return lsRead<Report>(LS_REPORTS).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getReport(id: string): Promise<Report | null> {
    if (supabase) {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Report | null;
    }
    return lsRead<Report>(LS_REPORTS).find((r) => r.id === id) ?? null;
  },

  async createReport(
    input: Omit<Report, 'id' | 'created_at' | 'updated_at' | 'status' | 'classification_source' | 'classification_confidence'> &
      Partial<Pick<Report, 'status' | 'classification_source' | 'classification_confidence' | 'created_at'>>
  ): Promise<Report> {
    const status = input.status ?? 'Submitted';
    const report: Report = {
      id: uuid(),
      user_id: input.user_id ?? null,
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity,
      status,
      location_name: input.location_name,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      image_url: input.image_url ?? null,
      classification_source: input.classification_source ?? 'user',
      classification_confidence: input.classification_confidence ?? 1.0,
      created_at: input.created_at ?? now(),
      updated_at: input.created_at ?? now(),
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('reports')
        .insert({
          user_id: report.user_id,
          title: report.title,
          description: report.description,
          category: report.category,
          severity: report.severity,
          status: report.status,
          location_name: report.location_name,
          latitude: report.latitude,
          longitude: report.longitude,
          image_url: report.image_url,
          classification_source: report.classification_source,
          classification_confidence: report.classification_confidence,
          created_at: report.created_at,
          updated_at: report.updated_at,
        })
        .select()
        .single();
      if (error) throw error;
      const created = data as Report;
      await this.addStatusHistory(created.id, null, status, 'Report created', true);
      return created;
    }

    const reports = lsRead<Report>(LS_REPORTS);
    reports.push(report);
    lsWrite(LS_REPORTS, reports);
    await this.addStatusHistory(report.id, null, status, 'Report created', true);
    return report;
  },

  async updateReportStatus(
    id: string,
    newStatus: ReportStatus,
    note: string,
    isDemo: boolean
  ): Promise<Report> {
    if (supabase) {
      const existing = await this.getReport(id);
      if (!existing) throw new Error('Report not found');
      const { data, error } = await supabase
        .from('reports')
        .update({ status: newStatus, updated_at: now() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const updated = data as Report;
      await this.addStatusHistory(id, existing.status, newStatus, note, isDemo);
      return updated;
    }
    const reports = lsRead<Report>(LS_REPORTS);
    const idx = reports.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Report not found');
    const prev = reports[idx].status;
    reports[idx].status = newStatus;
    reports[idx].updated_at = now();
    lsWrite(LS_REPORTS, reports);
    await this.addStatusHistory(id, prev, newStatus, note, isDemo);
    return reports[idx];
  },

  async deleteReport(id: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    const reports = lsRead<Report>(LS_REPORTS).filter((r) => r.id !== id);
    lsWrite(LS_REPORTS, reports);
    const history = lsRead<StatusHistoryEntry>(LS_HISTORY).filter((h) => h.report_id !== id);
    lsWrite(LS_HISTORY, history);
    const complaints = lsRead<ComplaintDraft>(LS_COMPLAINTS).filter((c) => c.report_id !== id);
    lsWrite(LS_COMPLAINTS, complaints);
  },

  async getStatusHistory(reportId: string): Promise<StatusHistoryEntry[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('report_status_history')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as StatusHistoryEntry[];
    }
    return lsRead<StatusHistoryEntry>(LS_HISTORY)
      .filter((h) => h.report_id === reportId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  async addStatusHistory(
    reportId: string,
    prev: ReportStatus | null,
    next: ReportStatus,
    note: string,
    isDemo: boolean
  ): Promise<void> {
    const entry: StatusHistoryEntry = {
      id: uuid(),
      report_id: reportId,
      previous_status: prev,
      new_status: next,
      note,
      actor_id: 'demo-user',
      is_demo_action: isDemo,
      created_at: now(),
    };
    if (supabase) {
      const { error } = await supabase.from('report_status_history').insert({
        report_id: reportId,
        previous_status: prev,
        new_status: next,
        note,
        actor_id: 'demo-user',
        is_demo_action: isDemo,
      });
      if (error) throw error;
      return;
    }
    const history = lsRead<StatusHistoryEntry>(LS_HISTORY);
    history.push(entry);
    lsWrite(LS_HISTORY, history);
  },

  async listComplaints(reportId?: string): Promise<ComplaintDraft[]> {
    if (supabase) {
      let q = supabase.from('complaint_drafts').select('*');
      if (reportId) q = q.eq('report_id', reportId);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return data as ComplaintDraft[];
    }
    return lsRead<ComplaintDraft>(LS_COMPLAINTS)
      .filter((c) => !reportId || c.report_id === reportId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createComplaint(
    input: Pick<ComplaintDraft, 'report_id' | 'subject' | 'body' | 'authority_name'>
  ): Promise<ComplaintDraft> {
    const draft: ComplaintDraft = {
      id: uuid(),
      report_id: input.report_id,
      user_id: null,
      subject: input.subject,
      body: input.body,
      authority_name: input.authority_name,
      approval_status: 'draft',
      created_at: now(),
      updated_at: now(),
    };
    if (supabase) {
      const { data, error } = await supabase
        .from('complaint_drafts')
        .insert({
          report_id: input.report_id,
          subject: input.subject,
          body: input.body,
          authority_name: input.authority_name,
          approval_status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;
      return data as ComplaintDraft;
    }
    const drafts = lsRead<ComplaintDraft>(LS_COMPLAINTS);
    drafts.push(draft);
    lsWrite(LS_COMPLAINTS, drafts);
    return draft;
  },

  async updateComplaint(
    id: string,
    patch: Partial<Pick<ComplaintDraft, 'subject' | 'body' | 'authority_name' | 'approval_status'>>
  ): Promise<ComplaintDraft> {
    if (supabase) {
      const { data, error } = await supabase
        .from('complaint_drafts')
        .update({ ...patch, updated_at: now() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ComplaintDraft;
    }
    const drafts = lsRead<ComplaintDraft>(LS_COMPLAINTS);
    const idx = drafts.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Draft not found');
    drafts[idx] = { ...drafts[idx], ...patch, updated_at: now() };
    lsWrite(LS_COMPLAINTS, drafts);
    return drafts[idx];
  },

  async logAgentRun(run: Omit<AgentRun, 'id' | 'created_at' | 'user_id'>): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('agent_runs').insert({
        task: run.task,
        tools_used: run.tools_used,
        result_summary: run.result_summary,
        execution_status: run.execution_status,
      });
      if (error) console.error('Failed to log agent run:', error);
      return;
    }
    const runs = lsRead<AgentRun>(LS_AGENT);
    runs.push({ ...run, user_id: null, id: uuid(), created_at: now() });
    lsWrite(LS_AGENT, runs);
  },
};
