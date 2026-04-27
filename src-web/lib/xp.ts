export const DEFAULT_XP_TARGET = 300;
export const DEFAULT_TASK_XP = 15;

export function calculateBuildStage(xpTotal: number, xpTarget: number): 1 | 2 | 3 | 4 | 5 {
  if (xpTarget <= 0) return 1;
  const progress = Math.max(0, Math.min(1, xpTotal / xpTarget));
  return Math.min(5, Math.max(1, Math.floor(progress * 5) + 1)) as 1 | 2 | 3 | 4 | 5;
}

export function calculateXpProgress(xpTotal: number, xpTarget: number): number {
  if (xpTarget <= 0) return 0;
  return Math.max(0, Math.min(1, xpTotal / xpTarget));
}
