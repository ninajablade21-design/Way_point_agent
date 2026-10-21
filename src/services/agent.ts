import type { Report, HazardCategory, AgentToolCall } from '@/types';
import { classifyHazard, keywordSimilarity } from './classifier';
import { getWeather, haversineKm } from './weather';
import { AUTHORITY_DIRECTORY, STATUSES, weatherLabel, formatDateTime } from '@/lib/constants';
import { repo } from './storage';

export const MAX_TOOL_CALLS = 8;

type ToolName =
  | 'classifyHazard'
  | 'findNearbyReports'
  | 'findSimilarReports'
  | 'getWeather'
  | 'draftComplaint'
  | 'suggestNextAction'
  | 'lookupAuthority'
  | 'updateDemoStatus';

interface ToolDef {
  name: ToolName;
  description: string;
}

export const TOOL_REGISTRY: ToolDef[] = [
  { name: 'classifyHazard', description: 'Classify a hazard description into category and severity' },
  { name: 'findNearbyReports', description: 'Find reports within a radius of given coordinates' },
  { name: 'findSimilarReports', description: 'Find potentially duplicate or related reports' },
  { name: 'getWeather', description: 'Fetch current weather for given coordinates' },
  { name: 'draftComplaint', description: 'Generate a structured civic complaint draft' },
  { name: 'suggestNextAction', description: 'Recommend next steps for a report' },
  { name: 'lookupAuthority', description: 'Look up relevant authority for a hazard category' },
  { name: 'updateDemoStatus', description: 'Update a report demo status (requires approval)' },
];

async function runTool(
  name: ToolName,
  args: Record<string, unknown>,
  context: { reports: Report[] }
): Promise<unknown> {
  switch (name) {
    case 'classifyHazard': {
      const text = String(args.text ?? '');
      return classifyHazard(text);
    }
    case 'findNearbyReports': {
      const lat = Number(args.lat);
      const lon = Number(args.lon);
      const radiusKm = Number(args.radiusKm ?? 5);
      if (isNaN(lat) || isNaN(lon)) {
        return { error: 'Valid lat and lon coordinates required' };
      }
      const matches = context.reports
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          severity: r.severity,
          status: r.status,
          distanceKm: haversineKm(lat, lon, r.latitude!, r.longitude!),
        }))
        .filter((r) => r.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
      return { count: matches.length, reports: matches };
    }
    case 'findSimilarReports': {
      const text = String(args.text ?? '');
      const reportId = args.reportId ? String(args.reportId) : undefined;
      let pool = context.reports;
      if (reportId) {
        const base = pool.find((r) => r.id === reportId);
        if (base) {
          pool = pool.filter((r) => r.id !== reportId);
          const matches = pool
            .map((r) => ({
              id: r.id,
              title: r.title,
              category: r.category,
              severity: r.severity,
              status: r.status,
              categoryMatch: r.category === base.category ? 1 : 0,
              keywordScore: keywordSimilarity(
                `${base.title} ${base.description}`,
                `${r.title} ${r.description}`
              ),
              distanceKm:
                base.latitude != null && base.longitude != null && r.latitude != null && r.longitude != null
                  ? haversineKm(base.latitude, base.longitude, r.latitude, r.longitude)
                  : null,
            }))
            .filter((r) => r.categoryMatch > 0 || r.keywordScore > 0.2)
            .sort((a, b) => b.categoryMatch - a.categoryMatch || b.keywordScore - a.keywordScore);
          return { count: matches.length, reports: matches };
        }
      }
      const matches = context.reports
        .map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          keywordScore: keywordSimilarity(text, `${r.title} ${r.description}`),
        }))
        .filter((r) => r.keywordScore > 0.25)
        .sort((a, b) => b.keywordScore - a.keywordScore);
      return { count: matches.length, reports: matches };
    }
    case 'getWeather': {
      const lat = Number(args.lat);
      const lon = Number(args.lon);
      if (isNaN(lat) || isNaN(lon)) {
        return { error: 'Valid lat and lon coordinates required' };
      }
      try {
        const weather = await getWeather(lat, lon);
        return {
          temperature: weather.temperature,
          windspeed: weather.windspeed,
          precipitation: weather.precipitation,
          precipitation_probability: weather.precipitation_probability,
          conditions: weatherLabel(weather.weatherCode),
          timestamp: weather.timestamp,
        };
      } catch (e) {
        return { error: 'Weather service unavailable', detail: (e as Error).message };
      }
    }
    case 'draftComplaint': {
      const reportId = String(args.reportId ?? '');
      const report = context.reports.find((r) => r.id === reportId);
      if (!report) return { error: 'Report not found' };
      const authority = args.authorityName ? String(args.authorityName) : '';

      const subject = `Complaint regarding ${report.category.toLowerCase()} at ${report.location_name}`;
      const body = [
        `Subject: ${subject}`,
        '',
        `To: ${authority || '[Relevant Authority]'}`,
        '',
        `Respected Sir/Madam,`,
        '',
        `I wish to bring to your attention a road hazard that requires urgent attention.`,
        '',
        `Report Reference: ${report.id.slice(0, 8).toUpperCase()}`,
        `Type of Hazard: ${report.category}`,
        `Severity: ${report.severity}`,
        `Location: ${report.location_name}`,
        `Date Observed: ${formatDateTime(report.created_at)}`,
        '',
        `Description of the Problem:`,
        `${report.description || '[No description provided]'}`,
        '',
        `Impact:`,
        `This hazard poses a risk to commuters, pedestrians, and vehicles passing through the area. ${
          report.severity === 'Critical' || report.severity === 'High'
            ? 'Given the severity, prompt action is requested to prevent accidents or injury.'
            : 'Addressing this promptly will improve safety for all road users.'
        }`,
        '',
        `Requested Action:`,
        `I request that the concerned department inspect the site and take necessary corrective measures at the earliest.`,
        '',
        `Thank you for your attention to this matter.`,
        '',
        `Sincerely,`,
        `[Your Name]`,
        `[Your Contact]`,
      ].join('\n');

      const saved = await repo.createComplaint({
        report_id: report.id,
        subject,
        body,
        authority_name: authority,
      });

      return { complaintId: saved.id, subject, preview: body.slice(0, 200) + '...' };
    }
    case 'suggestNextAction': {
      const reportId = String(args.reportId ?? '');
      const report = context.reports.find((r) => r.id === reportId);
      if (!report) return { error: 'Report not found' };
      const actions: string[] = [];
      switch (report.status) {
        case 'Submitted':
          actions.push('Your report has been submitted. Review the AI-generated summary for accuracy.');
          actions.push('Check for similar reports — if duplicates exist, the situation may already be tracked.');
          if (report.severity === 'Critical' || report.severity === 'High') {
            actions.push('Given the severity, consider drafting a formal complaint for escalation.');
          }
          break;
        case 'Under Review':
          actions.push('Your report is under review. You may draft a complaint to prepare for escalation.');
          break;
        case 'Prepared for Escalation':
          actions.push('A complaint draft is ready. Review, edit, and approve it before sharing with the relevant authority.');
          actions.push('Copy the approved complaint and submit it through the authority official channel.');
          break;
        case 'Resolved':
          actions.push('This report is marked resolved. No further action needed.');
          break;
        case 'Rejected':
          actions.push('This report was rejected. You may update the description and resubmit, or add more details.');
          break;
      }
      return { status: report.status, actions };
    }
    case 'lookupAuthority': {
      const category = String(args.category ?? '') as HazardCategory;
      let matches: typeof AUTHORITY_DIRECTORY = AUTHORITY_DIRECTORY;
      if (category) {
        const lower = category.toLowerCase();
        matches = AUTHORITY_DIRECTORY.filter((a) => {
          if (lower.includes('streetlight')) return a.type === 'Utility';
          if (lower.includes('accident') || lower.includes('traffic')) return a.type === 'Emergency';
          if (lower.includes('national')) return a.name.includes('NHAI');
          return a.type === 'Civic' || a.type === 'Government';
        });
        if (matches.length === 0) matches = AUTHORITY_DIRECTORY;
      }
      return {
        authorities: matches.map((a) => ({
          name: a.name,
          type: a.type,
          jurisdiction: a.jurisdiction,
          contact: a.contact,
          verified: a.verified,
        })),
      };
    }
    case 'updateDemoStatus': {
      const reportId = String(args.reportId ?? '');
      const newStatus = String(args.newStatus ?? '');
      if (!reportId || !newStatus) return { error: 'reportId and newStatus required' };
      return {
        requiresApproval: true,
        reportId,
        newStatus,
        message: `Status changes are never applied automatically. To set report ${reportId.slice(0, 8).toUpperCase()} to "${newStatus}", open the report and use "Update status" to confirm. This is a demo action only and does not contact any authority.`,
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

interface IntentRoute {
  tools: ToolName[];
  extractArgs: (text: string, reports: Report[]) => Record<string, unknown>[];
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Use the report the user named (by full id) if there is one; otherwise fall back to the newest report. */
function pickReport(text: string, reports: Report[]): Report | undefined {
  const id = text.match(UUID_RE)?.[0]?.toLowerCase();
  if (id) {
    const named = reports.find((r) => r.id.toLowerCase() === id);
    if (named) return named;
  }
  return reports[0];
}

function detectIntent(text: string): IntentRoute {
  const lower = text.toLowerCase();

  if (/\b(mark|set|change|update)\b.*\b(status|resolved|rejected|under review|escalation)/.test(lower)) {
    return {
      tools: ['updateDemoStatus'],
      extractArgs: (t, reports) => {
        const report = pickReport(t, reports);
        if (!report) return [{ error: 'No reports available' }];
        const wanted = STATUSES.find((st) => lower.includes(st.toLowerCase()));
        if (!wanted) return [{ error: `Tell me which status to use: ${STATUSES.join(', ')}` }];
        return [{ reportId: report.id, newStatus: wanted }];
      },
    };
  }

  if (/weather|rain|forecast|climate|temperature/.test(lower)) {
    return {
      tools: ['getWeather'],
      extractArgs: (_t, reports) => {
        const withCoords = reports.find((r) => r.latitude != null && r.longitude != null);
        if (withCoords) return [{ lat: withCoords.latitude!, lon: withCoords.longitude! }];
        return [{ error: 'Weather needs a location. Add a report with coordinates or select a location on the Weather page.' }];
      },
    };
  }

  if (/complaint|draft|letter|grievance|petition|write to|escalat/.test(lower)) {
    return {
      tools: ['lookupAuthority', 'draftComplaint'],
      extractArgs: (t, reports) => {
        const report = pickReport(t, reports);
        if (!report) return [{ error: 'No reports available to draft a complaint for' }];
        return [{ category: report.category }, { reportId: report.id }];
      },
    };
  }

  if (/nearby|near me|around me|close by|in my area/.test(lower)) {
    return {
      tools: ['findNearbyReports'],
      extractArgs: (_t, reports) => {
        const withCoords = reports.find((r) => r.latitude != null && r.longitude != null);
        if (withCoords) return [{ lat: withCoords.latitude!, lon: withCoords.longitude!, radiusKm: 5 }];
        return [{ error: 'No reports with coordinates available' }];
      },
    };
  }

  if (/similar|duplicate|related|same issue|already reported/.test(lower)) {
    return {
      tools: ['findSimilarReports'],
      extractArgs: (t, reports) => {
        const report = pickReport(t, reports);
        if (report) return [{ reportId: report.id }];
        return [{ text: t }];
      },
    };
  }

  if (/\bnext\b|what should i do|advice|recommend|suggest.*action|how do i/.test(lower)) {
    return {
      tools: ['suggestNextAction'],
      extractArgs: (t, reports) => {
        const report = pickReport(t, reports);
        if (report) return [{ reportId: report.id }];
        return [{ error: 'No reports available' }];
      },
    };
  }

  if (/classify|categor|what type|what kind|severity|how bad/.test(lower)) {
    return {
      tools: ['classifyHazard'],
      extractArgs: (text) => [{ text }],
    };
  }

  if (/authorit|contact|department|whom|municipal|official/.test(lower)) {
    return {
      tools: ['lookupAuthority'],
      extractArgs: (t, reports) => {
        // Prefer the hazard described in the question ("broken streetlight"); fall back to the newest report.
        const fromText = classifyHazard(t);
        if (!fromText.needsClarification) return [{ category: fromText.category }];
        return [{ category: pickReport(t, reports)?.category ?? '' }];
      },
    };
  }

  if (/report.*pothole|report.*hazard|report.*this|create.*report|file.*report/.test(lower)) {
    return {
      tools: ['classifyHazard'],
      extractArgs: (text) => [{ text }],
    };
  }

  return {
    tools: ['classifyHazard'],
    extractArgs: (text) => [{ text }],
  };
}

export interface AgentResult {
  toolCalls: AgentToolCall[];
  response: string;
  toolsUsed: string[];
}

export async function runAgent(task: string, reports: Report[]): Promise<AgentResult> {
  const route = detectIntent(task);
  const argsList = route.extractArgs(task, reports);
  const toolCalls: AgentToolCall[] = [];

  for (let i = 0; i < route.tools.length && i < MAX_TOOL_CALLS; i++) {
    const tool = route.tools[i];
    const args = argsList[i] ?? {};
    if (args.error) {
      toolCalls.push({
        tool,
        args,
        result: { error: args.error },
        error: String(args.error),
        durationMs: 0,
      });
      continue;
    }
    // If an authority was looked up just before drafting, address the complaint to the best match.
    if (tool === 'draftComplaint' && !args.authorityName) {
      const lookup = toolCalls.find((c) => c.tool === 'lookupAuthority' && !c.error);
      const first = (lookup?.result as { authorities?: Array<{ name: string }> } | undefined)?.authorities?.[0];
      if (first) args.authorityName = first.name;
    }
    const toolStart = Date.now();
    try {
      const result = await runTool(tool, args, { reports });
      toolCalls.push({
        tool,
        args,
        result,
        durationMs: Date.now() - toolStart,
      });
    } catch (e) {
      toolCalls.push({
        tool,
        args,
        result: null,
        error: (e as Error).message,
        durationMs: Date.now() - toolStart,
      });
    }
  }

  const response = synthesizeResponse(task, toolCalls, reports);
  const toolsUsed = toolCalls.map((t) => t.tool);

  const failed = toolCalls.some((call) => Boolean(call.error));
  await repo.logAgentRun({
    task,
    tools_used: toolsUsed,
    result_summary: response.slice(0, 500),
    execution_status: failed ? (toolCalls.every((call) => Boolean(call.error)) ? 'failed' : 'partial') : 'completed',
  });

  return { toolCalls, response, toolsUsed };
}

function synthesizeResponse(task: string, calls: AgentToolCall[], reports: Report[]): string {
  if (reports.length === 0 && !task.match(/classify|categor|create|report this/i)) {
    return "There are no reports yet. You can create a new hazard report from the 'Report a Hazard' page, and I'll help you classify it, find similar reports, draft a complaint, and more.";
  }

  const parts: string[] = [];

  for (const call of calls) {
    if (call.error) {
      parts.push(`**${call.tool}**: ${call.error}`);
      continue;
    }
    const r = call.result as Record<string, unknown>;

    switch (call.tool) {
      case 'classifyHazard': {
        const cat = r.category as string;
        const sev = r.severity as string;
        const conf = r.confidence as number;
        const expl = r.explanation as string;
        const needsClar = r.needsClarification as boolean;
        parts.push(
          `**Classification:** ${cat} — ${sev} severity (${Math.round(conf * 100)}% confidence)\n${expl}${
            needsClar ? '\nPlease add more details for a better classification.' : ''
          }`
        );
        break;
      }
      case 'findNearbyReports': {
        const count = r.count as number;
        const found = r.reports as Array<Record<string, unknown>>;
        if (count === 0) {
          parts.push('**Nearby reports:** No reports found within the search radius.');
        } else {
          parts.push(
            `**Nearby reports:** Found ${count} report(s):\n` +
              found
                .slice(0, 5)
                .map((rep) => `• ${rep.title} (${rep.category}, ${rep.severity}) — ${Number(rep.distanceKm).toFixed(1)}km`)
                .join('\n')
          );
        }
        break;
      }
      case 'findSimilarReports': {
        const count = r.count as number;
        const found = r.reports as Array<Record<string, unknown>>;
        if (count === 0) {
          parts.push('**Similar reports:** No similar or duplicate reports found. This appears to be a new, unique report.');
        } else {
          parts.push(
            `**Similar reports:** Found ${count} potentially related report(s):\n` +
              found
                .slice(0, 5)
                .map((rep) => `• ${rep.title} (${rep.category})`)
                .join('\n') +
              '\nThese may be duplicates — review them before escalating separately.'
          );
        }
        break;
      }
      case 'getWeather': {
        if (r.error) {
          parts.push(`**Weather:** ${r.error}`);
        } else {
          parts.push(
            `**Weather:** ${r.conditions}, ${r.temperature}°C, wind ${r.windspeed} km/h, precipitation ${r.precipitation}mm (${r.precipitation_probability}% probability). Source: Open-Meteo.`
          );
        }
        break;
      }
      case 'draftComplaint': {
        if (r.error) {
          parts.push(`**Complaint:** ${r.error}`);
        } else {
          parts.push(
            `**Complaint drafted:** "${r.subject}". The full draft has been saved to the Complaints page for your review and editing. You must approve it before it can be shared.`
          );
        }
        break;
      }
      case 'suggestNextAction': {
        if (r.error) {
          parts.push(`**Next steps:** ${r.error}`);
        } else {
          const actions = r.actions as string[];
          parts.push(
            `**Suggested next steps** (status: ${r.status}):\n` +
              actions.map((a) => `• ${a}`).join('\n')
          );
        }
        break;
      }
      case 'lookupAuthority': {
        const auths = r.authorities as Array<Record<string, unknown>>;
        parts.push(
          `**Relevant authorities:**\n` +
            auths
              .map(
                (a) =>
                  `• ${a.name} (${a.type}) — ${a.contact}${a.verified ? '' : ' [Unverified — verify before use]'}`
              )
              .join('\n')
        );
        break;
      }
      case 'updateDemoStatus': {
        if (r.requiresApproval) {
          parts.push(`**Status update (demo):** ${r.message}`);
        } else if (r.error) {
          parts.push(`**Status update:** ${r.error}`);
        }
        break;
      }
    }
  }

  return parts.join('\n\n');
}
