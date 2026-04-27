import type { Habit } from '../types';

const MS_PER_DAY = 86_400_000;

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function formatHabitDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function getRecentDateKeys(days: number): string[] {
  const today = new Date();

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - 1 - index) * MS_PER_DAY);
    return todayKey(date);
  });
}

export function getHabitStreak(habit: Habit): number {
  const completions = new Set(habit.completions);
  let streak = 0;
  let cursor = new Date();

  while (completions.has(todayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
  }

  return streak;
}

export function getHabitAutomaticity(habit: Habit): number {
  const recentDays = getRecentDateKeys(21);
  const completions = new Set(habit.completions);
  const recentCompletions = recentDays.filter((day) => completions.has(day)).length;
  const repetitionScore = Math.min(70, recentCompletions * 4);
  const contextScore = habit.anchor.trim() && habit.location.trim() ? 20 : 0;
  const easeScore = habit.frictionCut.trim() ? 10 : 0;

  return Math.min(100, repetitionScore + contextScore + easeScore);
}

export function wasHabitDoneToday(habit: Habit): boolean {
  return habit.completions.includes(todayKey());
}
