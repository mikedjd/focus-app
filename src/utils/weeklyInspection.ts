import type { DailyTask, DailyXpRow, DifficultyPhase, WeeklyInspectionResult } from '../types';
import { formatDate } from './dates';

export interface WeeklyInspectionCalculation {
  weekStart: string;
  weekEnd: string;
  xpEarned: number;
  tasksCompleted: number;
  hardTasksCompleted: number;
  tier2PlusCompleted: number;
  validDays: number;
  buildHealthChange: number;
  result: WeeklyInspectionResult;
}

export function getWeekEnd(weekStart: string): string {
  const [year, month, day] = weekStart.split('-').map(Number);
  return formatDate(new Date(year, month - 1, day + 6));
}

export function getWeeklyInspectionResult(input: {
  difficultyPhase: DifficultyPhase;
  validDays: number;
  tier2PlusCompleted: number;
  hardTasksCompleted: number;
}): WeeklyInspectionResult {
  if (input.validDays >= 5) {
    if (input.difficultyPhase === 4) {
      return input.hardTasksCompleted >= 1 ? 'pass' : 'fail';
    }
    if (input.difficultyPhase === 3) {
      return input.tier2PlusCompleted >= 1 ? 'pass' : 'fail';
    }
    return 'pass';
  }
  return 'fail';
}

export function getInspectionHealthChange(result: WeeklyInspectionResult): number {
  if (result === 'pass') return 5;
  return -10;
}

export function calculateWeeklyInspection(input: {
  weekStart: string;
  difficultyPhase: DifficultyPhase;
  dailyRows: Array<Pick<DailyXpRow, 'date' | 'xpEarned' | 'met'>>;
  tasks: Array<Pick<DailyTask, 'date' | 'status' | 'tier'>>;
}): WeeklyInspectionCalculation {
  const weekEnd = getWeekEnd(input.weekStart);
  const dailyRows = input.dailyRows.filter(
    (row) => row.date >= input.weekStart && row.date <= weekEnd
  );
  const completedTasks = input.tasks.filter(
    (task) => task.date >= input.weekStart && task.date <= weekEnd && task.status === 'done'
  );
  const hardTasksCompleted = completedTasks.filter((task) => (task.tier ?? 1) >= 3).length;
  const tier2PlusCompleted = completedTasks.filter((task) => (task.tier ?? 1) >= 2).length;
  const validDays = dailyRows.filter((row) => row.met).length;
  const result = getWeeklyInspectionResult({
    difficultyPhase: input.difficultyPhase,
    validDays,
    tier2PlusCompleted,
    hardTasksCompleted,
  });

  return {
    weekStart: input.weekStart,
    weekEnd,
    xpEarned: dailyRows.reduce((sum, row) => sum + row.xpEarned, 0),
    tasksCompleted: completedTasks.length,
    hardTasksCompleted,
    tier2PlusCompleted,
    validDays,
    result,
    buildHealthChange: getInspectionHealthChange(result),
  };
}
