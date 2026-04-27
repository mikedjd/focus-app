export const DEFAULT_XP_TARGET = 300;
export const DEFAULT_TASK_XP = 15;

export const DURATION_OPTIONS: { label: string; minutes: number; xp: number }[] = [
  { label: '≤15 min', minutes: 15, xp: 5 },
  { label: '≤45 min', minutes: 45, xp: 15 },
  { label: '≤90 min', minutes: 90, xp: 30 },
  { label: '≤3 hrs', minutes: 180, xp: 60 },
  { label: '3 hrs+', minutes: 240, xp: 100 },
];

export function xpFromDuration(minutes: number, isAdmin: boolean): number {
  if (isAdmin) return 0;
  if (minutes <= 15) return 5;
  if (minutes <= 45) return 15;
  if (minutes <= 90) return 30;
  if (minutes <= 180) return 60;
  return 100;
}

export function calculateBuildStage(xpTotal: number, xpTarget: number): 1 | 2 | 3 | 4 | 5 {
  if (xpTarget <= 0) return 1;
  const progress = Math.max(0, Math.min(1, xpTotal / xpTarget));
  return Math.min(5, Math.max(1, Math.floor(progress * 5) + 1)) as 1 | 2 | 3 | 4 | 5;
}

export function calculateXpProgress(xpTotal: number, xpTarget: number): number {
  if (xpTarget <= 0) return 0;
  return Math.max(0, Math.min(1, xpTotal / xpTarget));
}
