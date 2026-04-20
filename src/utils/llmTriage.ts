import type { EffortLevel, InboxClassification } from '../types';
import type { TriageResult } from './inboxTriage';
import { classifyItemRuleBased } from './inboxTriage';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const VALID_CLASSIFICATIONS: InboxClassification[] = [
  'today_task',
  'admin',
  'milestone',
  'parking_lot',
  'someday',
  'unknown',
];
const VALID_EFFORTS: EffortLevel[] = ['', 'light', 'medium', 'challenging'];

function extractJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('No JSON object in Claude response');
  }
  return raw.slice(start, end + 1);
}

function sanitizeDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function sanitizeResult(value: unknown, fallback: TriageResult): TriageResult {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const result = value as Partial<TriageResult>;
  const classification = VALID_CLASSIFICATIONS.includes(result.classification as InboxClassification)
    ? (result.classification as InboxClassification)
    : fallback.classification;
  const effortLevel = VALID_EFFORTS.includes(result.effortLevel as EffortLevel)
    ? (result.effortLevel as EffortLevel)
    : fallback.effortLevel;

  return {
    classification,
    effortLevel,
    scheduledFor: sanitizeDate(result.scheduledFor) ?? fallback.scheduledFor,
    reason:
      typeof result.reason === 'string' && result.reason.trim()
        ? result.reason.trim()
        : fallback.reason,
  };
}

export async function classifyItemWithClaude(args: {
  rawText: string;
  apiKey: string;
  model: string;
  hasActiveGoal: boolean;
  now?: Date;
}): Promise<TriageResult> {
  const fallback = classifyItemRuleBased(args.rawText, {
    hasActiveGoal: args.hasActiveGoal,
    now: args.now,
  });

  if (!args.apiKey.trim()) {
    return fallback;
  }

  const todayIso = (args.now ?? new Date()).toISOString().slice(0, 10);
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': args.apiKey.trim(),
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: args.model.trim(),
      max_tokens: 220,
      system:
        'You are a strict inbox triage classifier for an ADHD control-center app. Respond with JSON only. Choose one classification from today_task, admin, milestone, parking_lot, someday, unknown. Choose one effortLevel from "", light, medium, challenging. scheduledFor must be YYYY-MM-DD or null. Keep reason under 18 words.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                `Today is ${todayIso}.`,
                args.hasActiveGoal
                  ? 'The user currently has an active goal, so shiny new ideas should usually be parked.'
                  : 'The user does not currently have an active goal.',
                'Classify this inbox capture and infer any explicit schedule date if present:',
                args.rawText,
                'Return JSON with keys classification, effortLevel, scheduledFor, reason.',
              ].join('\n'),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude triage failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content?.find((part) => part.type === 'text')?.text;
  if (!text) {
    return fallback;
  }

  const parsed = JSON.parse(extractJsonObject(text));
  return sanitizeResult(parsed, fallback);
}
