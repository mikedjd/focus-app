import { useState, useCallback, useEffect } from 'react';
import type { DailyTask, FocusSession, WeeklyReview } from '../types';
import {
  getFocusSessionsForWeek,
  getReviewForWeek,
  getTasksForWeek,
  saveReview as apiSaveReview,
  subscribeToDataChanges,
} from '../api/client';
import { getPrevWeekStart } from '../utils/dates';

interface WeekStats {
  total: number;
  done: number;
  tasks: DailyTask[];
  focusSeconds: number;
  focusSessions: FocusSession[];
}

export function useWeeklyReview(weekOf: string) {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [weekStats, setWeekStats] = useState<WeekStats>({
    total: 0,
    done: 0,
    tasks: [],
    focusSeconds: 0,
    focusSessions: [],
  });

  const refresh = useCallback(async () => {
    const [nextReview, allTasks, focusSessions] = await Promise.all([
      getReviewForWeek(weekOf),
      getTasksForWeek(weekOf),
      getFocusSessionsForWeek(weekOf),
    ]);

    setReview(nextReview);
    setWeekStats({
      total: allTasks.length,
      done: allTasks.filter((task) => task.status === 'done').length,
      tasks: allTasks,
      focusSeconds: focusSessions.reduce((sum, session) => sum + session.durationSeconds, 0),
      focusSessions,
    });
  }, [weekOf]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(() => void refresh()), [refresh]);

  const saveReview = useCallback(
    async (
      wins: string,
      whatDrifted: string,
      driftReasons: string[],
      nextWeekAdjustment: string
    ) => {
      const saved = await apiSaveReview({
        weekOf,
        wins,
        whatDrifted,
        driftReasons,
        nextWeekAdjustment,
      });

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
