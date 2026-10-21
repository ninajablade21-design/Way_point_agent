import type { HazardCategory, Severity } from '@/types';

interface ClassifyResult {
  category: HazardCategory;
  severity: Severity;
  confidence: number;
  explanation: string;
  needsClarification: boolean;
}

const KEYWORDS: Record<HazardCategory, string[]> = {
  Pothole: ['pothole', 'potholes', 'crater', 'damaged road', 'broken road', 'road damage', 'rut', 'dip', 'crack in road'],
  Flooding: ['flood', 'flooding', 'waterlog', 'water logging', 'water on road', 'submerged', 'overflow', 'drainage', 'waterlogged'],
  'Fallen Tree': ['fallen tree', 'tree fall', 'tree fell', 'uprooted', 'branch fall', 'tree blocking', 'fallen branch'],
  'Broken Streetlight': ['streetlight', 'street light', 'lamp', 'light not working', 'no light', 'dark road', 'broken light', 'lamp post'],
  'Blocked Road': ['blocked', 'blockage', 'barricade', 'road closed', 'obstruction', 'debris', 'road blocked'],
  'Traffic Obstruction': ['traffic', 'jam', 'congestion', 'stopped traffic', 'long queue', 'bottleneck', 'gridlock'],
  'Damaged Sign': ['sign', 'signboard', 'sign board', 'board damaged', 'signal board', 'road sign', 'direction board'],
  Accident: ['accident', 'crash', 'collision', 'injury', 'hazard to life', 'immediate danger', 'urgent', 'emergency', 'vehicle overturned'],
  Other: [],
};

const SEVERITY_HINTS: { keywords: string[]; severity: Severity }[] = [
  { keywords: ['critical', 'life threatening', 'death', 'severe injury', 'immediate danger', 'urgent', 'emergency'], severity: 'Critical' },
  { keywords: ['high', 'serious', 'dangerous', 'large', 'deep', 'major', 'broken', 'collapsed'], severity: 'High' },
  { keywords: ['minor', 'small', 'slight', 'little', 'low', 'not urgent'], severity: 'Low' },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word match (allowing simple suffixes) so "sign" does not match "design" and "rut" does not match "route". */
function containsTerm(text: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegExp(term)}(?:s|es|ed|ing)?\\b`, 'i').test(text);
}

export function classifyHazard(text: string): ClassifyResult {
  const lower = text.toLowerCase().trim();

  if (!lower || lower.length < 5) {
    return {
      category: 'Other',
      severity: 'Medium',
      confidence: 0,
      explanation: 'Not enough information to classify. Please describe the hazard in more detail.',
      needsClarification: true,
    };
  }

  let bestCategory: HazardCategory = 'Other';
  let bestScore = 0;
  let matchedKeywords: string[] = [];

  for (const cat of Object.keys(KEYWORDS) as HazardCategory[]) {
    const matches = KEYWORDS[cat].filter((kw) => containsTerm(lower, kw));
    if (matches.length > bestScore) {
      bestScore = matches.length;
      bestCategory = cat;
      matchedKeywords = matches;
    }
  }

  let severity: Severity = 'Medium';
  for (const hint of SEVERITY_HINTS) {
    if (hint.keywords.some((kw) => containsTerm(lower, kw))) {
      severity = hint.severity;
      break;
    }
  }

  if (bestCategory === 'Accident' && severity !== 'Critical') severity = 'High';
  if (bestCategory === 'Flooding' && severity === 'Low') severity = 'Medium';

  const confidence = bestScore === 0 ? 0.25 : Math.min(0.55 + bestScore * 0.2, 0.95);
  const needsClarification = bestScore === 0;

  const explanation = needsClarification
    ? 'Could not confidently match to a category from your description. Defaulting to "Other" — please add more details like the type of hazard (pothole, flooding, fallen tree, etc.).'
    : `Matched keywords: ${matchedKeywords.join(', ')}. Severity set to ${severity} based on described urgency.`;

  return {
    category: bestCategory,
    severity,
    confidence,
    explanation,
    needsClarification,
  };
}

export function normalizeKeywords(text: string): string[] {
  const stop = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'this', 'that', 'there', 'here',
    'on', 'in', 'at', 'near', 'road', 'issue', 'problem', 'very', 'and', 'or', 'to',
    'of', 'for', 'with', 'it', 'has', 'have', 'been', 'please', 'help', 'need',
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
}

export function keywordSimilarity(a: string, b: string): number {
  const wa = new Set(normalizeKeywords(a));
  const wb = new Set(normalizeKeywords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  wa.forEach((w) => {
    if (wb.has(w)) common++;
  });
  return (2 * common) / (wa.size + wb.size);
}
