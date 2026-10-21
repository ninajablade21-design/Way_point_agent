/*
# WAYPOINT AI — Reports, status history, complaint drafts, agent runs

This migration creates the core data model for the WAYPOINT AI road-safety platform.
The app is single-tenant for the demo (no required sign-in), so policies are scoped
to `anon, authenticated` and the data is intentionally shared/public across the demo.
A nullable `user_id` is kept on reports so future per-user ownership can be layered in
without a schema rewrite.

1. New Tables
- `reports`: a road hazard report (title, description, category, severity, status,
  location, optional image, classification source/confidence).
- `report_status_history`: append-only timeline of status transitions per report.
- `complaint_drafts`: AI-drafted civic complaints tied to a report, with approval status.
- `agent_runs`: log of agent task executions (tools used, summary, status).

2. Indexes
- reports: category, severity, status, created_at, (lat/lng) for nearby queries.
- report_status_history: report_id.
- complaint_drafts: report_id.
- agent_runs: created_at.

3. Security
- RLS enabled on all tables.
- Policies use `TO anon, authenticated` because the demo runs without sign-in and the
  data is intentionally shared/public. This is documented as the reason for `USING (true)`.
- Least privilege within that demo model: status history and agent run logs are
  append-only (no UPDATE/DELETE), agent logs are write-only (no SELECT), and complaint
  drafts cannot be deleted directly (they are removed with their report).
- CHECK constraints keep category/severity/status and coordinates valid even if a client
  sends bad data.

NOTE: anyone with your public anon key can still edit or delete *reports* under these
policies. Before using real data, add Supabase Auth and ownership-based policies
(e.g. `USING (auth.uid() = user_id)`).
*/

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'Submitted',
  location_name text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  image_url text,
  classification_source text NOT NULL DEFAULT 'user',
  classification_confidence real DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_category_check CHECK (category IN (
    'Pothole','Flooding','Fallen Tree','Broken Streetlight','Blocked Road',
    'Traffic Obstruction','Damaged Sign','Accident','Other')),
  CONSTRAINT reports_severity_check CHECK (severity IN ('Low','Medium','High','Critical')),
  CONSTRAINT reports_status_check CHECK (status IN (
    'Submitted','Under Review','Prepared for Escalation','Resolved','Rejected')),
  CONSTRAINT reports_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT reports_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT reports_title_length_check CHECK (char_length(title) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_coords ON reports(latitude, longitude);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports" ON reports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports" ON reports FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reports" ON reports;
CREATE POLICY "anon_delete_reports" ON reports FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS report_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  note text NOT NULL DEFAULT '',
  actor_id text NOT NULL DEFAULT 'demo-user',
  is_demo_action boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_history_report_id ON report_status_history(report_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON report_status_history(created_at DESC);

ALTER TABLE report_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_history" ON report_status_history;
CREATE POLICY "anon_select_history" ON report_status_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_history" ON report_status_history;
CREATE POLICY "anon_insert_history" ON report_status_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_history" ON report_status_history;

DROP POLICY IF EXISTS "anon_delete_history" ON report_status_history;

CREATE TABLE IF NOT EXISTS complaint_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body text NOT NULL,
  authority_name text NOT NULL DEFAULT '',
  approval_status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaints_report_id ON complaint_drafts(report_id);

ALTER TABLE complaint_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_complaints" ON complaint_drafts;
CREATE POLICY "anon_select_complaints" ON complaint_drafts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_complaints" ON complaint_drafts;
CREATE POLICY "anon_insert_complaints" ON complaint_drafts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_complaints" ON complaint_drafts;
CREATE POLICY "anon_update_complaints" ON complaint_drafts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_complaints" ON complaint_drafts;

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  task text NOT NULL,
  tools_used text[] NOT NULL DEFAULT '{}',
  result_summary text NOT NULL DEFAULT '',
  execution_status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON agent_runs(created_at DESC);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_agent_runs" ON agent_runs;

DROP POLICY IF EXISTS "anon_insert_agent_runs" ON agent_runs;
CREATE POLICY "anon_insert_agent_runs" ON agent_runs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_agent_runs" ON agent_runs;

DROP POLICY IF EXISTS "anon_delete_agent_runs" ON agent_runs;
