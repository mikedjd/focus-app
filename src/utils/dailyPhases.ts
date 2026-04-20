import type { DailyPhaseId, DailyRhythmSettings, EffortLevel, TaskType } from '../types';

export const DEFAULT_WAKE_TIME = '07:00';
export const DEFAULT_FOCUS_MINUTES = 50;
export const DEFAULT_BREAK_MINUTES = 10;

export const DAILY_PHASES: Array<{
  id: DailyPhaseId;
  title: string;
  shortLabel: string;
  startOffsetHours: number;
  endOffsetHours: number | null;
  summary: string;
}> = [
  {
    id: 'phase1',
    title: 'Phase 1',
    shortLabel: 'Deep work',
    startOffsetHours: 0,
    endOffsetHours: 4,
    summary: '0-4 hours after waking for deep, high-value work only.',
  },
  {
    id: 'phase2',
    title: 'Phase 2',
    shortLabel: 'Admin + gym',
    startOffsetHours: 4,
    endOffsetHours: 8,
    summary: '4-8 hours after waking for lighter admin, low-value work, and gym time.',
  },
  {
    id: 'phase3',
    title: 'Phase 3',
    shortLabel: 'Creative + review',
    startOffsetHours: 8,
    endOffsetHours: null,
    summary: '8+ hours after waking for creative work, daily review, and next-day planning.',
  },
];

export function clampDurationMinutes(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(180, Math.round(value)));
}

export function clampBreakMinutes(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(60, Math.round(value)));
}

export function normalizeWakeTime(value: string | null | undefined): string {
  const raw = value?.trim() ?? '';
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return DEFAULT_WAKE_TIME;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return DEFAULT_WAKE_TIME;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseWakeTimeMinutes(wakeTime: string): number {
  const normalized = normalizeWakeTime(wakeTime);
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

export function formatClockTime(totalMinutes: number): string {
  const wrapped = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 || 12;
  return `${twelveHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function getPhaseTimeLabel(phaseId: DailyPhaseId, wakeTime: string): string {
  const phase = DAILY_PHASES.find((candidate) => candidate.id === phaseId) ?? DAILY_PHASES[0];
  const wakeMinutes = parseWakeTimeMinutes(wakeTime);
  const startLabel = formatClockTime(wakeMinutes + phase.startOffsetHours * 60);

  if (phase.endOffsetHours == null) {
    return `${startLabel} onward`;
  }

  const endLabel = formatClockTime(wakeMinutes + phase.endOffsetHours * 60);
  return `${startLabel} - ${endLabel}`;
}

export function getCurrentPhaseId(now: Date, wakeTime: string): DailyPhaseId {
  const wakeMinutes = parseWakeTimeMinutes(wakeTime);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const minutesSinceWake = currentMinutes - wakeMinutes;

  if (minutesSinceWake < 4 * 60) {
    return 'phase1';
  }

  if (minutesSinceWake < 8 * 60) {
    return 'phase2';
  }

  return 'phase3';
}

export function getDefaultPhaseId(
  taskType: TaskType = 'goal',
  effortLevel: EffortLevel = ''
): DailyPhaseId {
  if (taskType === 'admin') {
    return 'phase2';
  }

  if (effortLevel === 'light') {
    return 'phase2';
  }

  return 'phase1';
}

export function createDefaultDailyRhythmSettings(): DailyRhythmSettings {
  return {
    wakeTime: DEFAULT_WAKE_TIME,
    defaultFocusMinutes: DEFAULT_FOCUS_MINUTES,
    defaultBreakMinutes: DEFAULT_BREAK_MINUTES,
    focusModeAssistEnabled: true,
  };
}
