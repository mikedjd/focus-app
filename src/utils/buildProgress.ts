import type { GoalPerformanceStatus } from '../types';

export type BuildDecayLevel = 'healthy' | 'decay' | 'severe';

const MS_PER_DAY = 86_400_000;

function parseDateMs(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  const ms = new Date(year, month - 1, day).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function calculateXpProgress(xpTotal: number, xpTarget: number): number {
  if (xpTarget <= 0) return 0;
  return clamp01(xpTotal / xpTarget);
}

export function getBuildDecayLevel(buildHealth: number): BuildDecayLevel {
  if (buildHealth < 40) return 'severe';
  if (buildHealth < 60) return 'decay';
  return 'healthy';
}

export function calculateForecastStatus(input: {
  xpProgress: number;
  calendarProgress: number;
  buildHealth: number;
  performanceStatus?: GoalPerformanceStatus;
}): GoalPerformanceStatus {
  if (input.buildHealth < 60 || input.performanceStatus === 'decaying') return 'decaying';
  const delta = input.xpProgress - input.calendarProgress;
  if (delta >= 0.08) return 'ahead';
  if (delta <= -0.12) return 'behind';
  return 'on_track';
}

export function getDaysUntil(dateStr: string | null | undefined, asOfMs = Date.now()): number | null {
  const endMs = parseDateMs(dateStr);
  if (!endMs) return null;
  return Math.ceil((endMs - asOfMs) / MS_PER_DAY);
}

export function calculateCalendarProgress(input: {
  startDate?: string | null;
  endDate?: string | null;
  asOfMs?: number;
}): number {
  const now = input.asOfMs ?? Date.now();
  const startMs = parseDateMs(input.startDate) ?? now;
  const endMs = parseDateMs(input.endDate);
  if (!endMs || endMs <= startMs) return 0;
  return clamp01((now - startMs) / (endMs - startMs));
}

export const BUILD_PHASES = [
  'Starting out',
  'Finding rhythm',
  'Building momentum',
  'Operating',
  'Maintaining',
] as const;

export type BuildPhaseName = (typeof BUILD_PHASES)[number];

export function calculateBuildPhaseIndex(calendarProgress: number, xpProgress: number): number {
  const blended = clamp01(calendarProgress * 0.45 + xpProgress * 0.55);
  return Math.min(BUILD_PHASES.length - 1, Math.floor(blended * BUILD_PHASES.length));
}

export function getBuildPhaseName(phaseIndex: number): BuildPhaseName {
  return BUILD_PHASES[Math.max(0, Math.min(BUILD_PHASES.length - 1, phaseIndex))];
}

export function getNextUnlockRequirement(input: {
  phaseIndex: number;
  xpTotal: number;
  xpTarget: number;
}): string {
  if (input.phaseIndex >= BUILD_PHASES.length - 1) return 'Maintain build health above 60.';
  const nextProgress = (input.phaseIndex + 1) / BUILD_PHASES.length;
  const requiredXp = input.xpTarget > 0 ? Math.ceil(input.xpTarget * nextProgress) : 0;
  const xpRemaining = Math.max(0, requiredXp - input.xpTotal);
  return `${getBuildPhaseName(input.phaseIndex + 1)} unlocks in ${xpRemaining} XP.`;
}
