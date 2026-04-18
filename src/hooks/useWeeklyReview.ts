import { useState, useCallback, useEffect } from 'react';
import type { DailyTask, WeeklyReview } from '../types';
import { dbGetReviewForWeek, dbGetTasksForWeek, dbSaveReview } from '../db';
import { getPrevWeekStart } from '../utils/dates';

interface WeekStats {
  total: number;
  done: number;
  tasks: DailyTask[];
}

export function useWeeklyReview(weekOf: string) {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [weekStats, setWeekStats] = useState<WeekStats>({ total: 0, done: 0, tasks: [] });

  const refresh = useCallback(() => {
    setReview(dbGetReviewForWeek(weekOf));
    const allTasks: DailyTask[] = dbGetTasksForWeek(weekOf);
    setWeekStats({
      total: allTasks.length,
      done: allTasks.filter((t) => t.status === 'done').length,
      tasks: allTasks,
    });
  }, [weekOf]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveReview = useCallback(
    (
      wins: string,
      whatDrifted: string,
      driftReasons: string[],
      nextWeekAdjustment: string
    ) => {
      const saved = dbSaveReview(weekOf, wins, whatDrifted, driftReasons, nextWeekAdjustment);
      if (saved) {
        setReview(saved);
        return true;
      }
      return false;
    },
    [weekOf]
  );

  return { review, weekStats, saveReview, refresh };
}

export function usePrevWeekStart(): string {
  return getPrevWeekStart();
}
