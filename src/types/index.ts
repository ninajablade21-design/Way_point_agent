export type HazardCategory =
  | 'Pothole'
  | 'Flooding'
  | 'Fallen Tree'
  | 'Broken Streetlight'
  | 'Blocked Road'
  | 'Traffic Obstruction'
  | 'Damaged Sign'
  | 'Accident'
  | 'Other';

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ReportStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Prepared for Escalation'
  | 'Resolved'
  | 'Rejected';

export interface Report {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  category: HazardCategory;
  severity: Severity;
  status: ReportStatus;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  classification_source: string;
  classification_confidence: number;
  created_at: string;
  updated_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  report_id: string;
  previous_status: ReportStatus | null;
  new_status: ReportStatus;
  note: string;
  actor_id: string;
  is_demo_action: boolean;
  created_at: string;
}

export interface ComplaintDraft {
  id: string;
  report_id: string;
  user_id: string | null;
  subject: string;
  body: string;
  authority_name: string;
  approval_status: 'draft' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  user_id: string | null;
  task: string;
  tools_used: string[];
  result_summary: string;
  execution_status: string;
  created_at: string;
}

export interface WeatherData {
  temperature: number;
  windspeed: number;
  precipitation: number;
  precipitation_probability: number;
  weatherCode: number;
  isDay: boolean;
  timestamp: string;
  source: 'Open-Meteo';
  forecast?: ForecastDay[];
}

export interface ForecastDay {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationMax: number;
  weatherCode: number;
}

export interface AgentToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string;
  durationMs: number;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  toolCalls?: AgentToolCall[];
  timestamp: string;
  pending?: boolean;
}

export interface AuthorityEntry {
  name: string;
  type: string;
  jurisdiction: string;
  contact: string;
  verified: boolean;
}
