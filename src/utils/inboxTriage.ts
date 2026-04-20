import type { EffortLevel, InboxClassification } from '../types';

export interface TriageResult {
  classification: InboxClassification;
  effortLevel: EffortLevel;
  scheduledFor: string | null; // YYYY-MM-DD
  reason: string;
}

const ADMIN_KEYWORDS = [
  'book', 'call', 'email', 'pay', 'bill', 'renew', 'schedule',
  'appointment', 'dentist', 'doctor', 'mot', 'insurance', 'tax',
  'bank', 'file', 'submit', 'return', 'admin', 'paperwork', 'invoice',
];
const CHALLENGING_HINTS = ['write', 'plan', 'design', 'draft', 'research', 'build', 'learn', 'study'];
const LIGHT_HINTS = ['tidy', 'pay', 'call', 'email', 'reply', 'text', 'confirm'];
const SHINY_HINTS = [
  'learn ', 'start ', 'new project', 'side project', 'idea:', 'what if',
  'explore ', 'business idea', 'app idea',
];
const SOMEDAY_HINTS = ['someday', 'one day', 'eventually', 'maybe '];

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(text: string, now: Date = new Date()): string | null {
  const lower = text.toLowerCase();
  if (/\btoday\b/.test(lower)) return ymd(now);
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return ymd(d);
  }
  if (/\bnext week\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return ymd(d);
  }
  const nextMatch = lower.match(/\bnext (sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/);
  const plainMatch = lower.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/);
  const match = nextMatch ?? plainMatch;
  if (match) {
    const prefix = match[1];
    const target = WEEKDAYS.findIndex((w) => w.startsWith(prefix));
    if (target >= 0) {
      const d = new Date(now);
      let diff = (target - d.getDay() + 7) % 7;
      if (diff === 0 || nextMatch) diff = diff === 0 ? 7 : diff + 7;
      d.setDate(d.getDate() + diff);
      return ymd(d);
    }
  }
  const iso = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  return null;
}

export function classifyItemRuleBased(
  rawText: string,
  ctx: { hasActiveGoal: boolean; now?: Date } = { hasActiveGoal: false }
): TriageResult {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const scheduledFor = parseDate(lower, ctx.now ?? new Date());

  if (SHINY_HINTS.some((k) => lower.includes(k)) && ctx.hasActiveGoal) {
    return {
      classification: 'parking_lot',
      effortLevel: '',
      scheduledFor: null,
      reason: 'Looks like a new shiny idea — parked.',
    };
  }

  if (SOMEDAY_HINTS.some((k) => lower.includes(k))) {
    return {
      classification: 'someday',
      effortLevel: '',
      scheduledFor,
      reason: 'Someday bucket.',
    };
  }

  if (ADMIN_KEYWORDS.some((k) => lower.includes(k))) {
    const effort: EffortLevel = LIGHT_HINTS.some((k) => lower.includes(k))
      ? 'light'
      : 'medium';
    return {
      classification: 'admin',
      effortLevel: effort,
      scheduledFor,
      reason: 'Admin — will auto-slot into an energy window.',
    };
  }

  if (scheduledFor) {
    return {
      classification: 'today_task',
      effortLevel: 'medium',
      scheduledFor,
      reason: 'Scheduled task.',
    };
  }

  if (CHALLENGING_HINTS.some((k) => lower.includes(k))) {
    return {
      classification: 'today_task',
      effortLevel: 'challenging',
      scheduledFor: null,
      reason: 'Deep-work task.',
    };
  }

  return {
    classification: 'unknown',
    effortLevel: '',
    scheduledFor: null,
    reason: 'Needs manual triage.',
  };
}
