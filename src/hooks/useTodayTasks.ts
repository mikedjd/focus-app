import { useState, useCallback, useEffect } from 'react';
import type { DailyTask, TaskWriteResult } from '../types';
import {
  dbGetTodayTasks,
  dbCreateTask,
  dbCarryForwardTask,
  dbCompleteTask,
  dbUncompleteTask,
  dbDropTask,
} from '../db';

export function useTodayTasks(goalId: string | null) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);

  const refresh = useCallback(() => {
    setTasks(dbGetTodayTasks());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addTask = useCallback(
    (title: string, weeklyFocusId?: string | null): TaskWriteResult => {
      if (!goalId) {
        return { ok: false, reason: 'missing_goal' };
      }

      const result = dbCreateTask(title, goalId, weeklyFocusId);
      refresh();
      return result;
    },
    [goalId, refresh]
  );

  const carryForwardTask = useCallback(
    (taskId: string): TaskWriteResult => {
      const result = dbCarryForwardTask(taskId);
      refresh();
      return result;
    },
    [refresh]
  );

  const completeTask = useCallback(
    (id: string) => {
      dbCompleteTask(id);
      refresh();
    },
    [refresh]
  );

  const uncompleteTask = useCallback(
    (id: string) => {
      dbUncompleteTask(id);
      refresh();
    },
    [refresh]
  );

  const dropTask = useCallback(
    (id: string) => {
      dbDropTask(id);
      refresh();
    },
    [refresh]
  );

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const canAddMore = tasks.length < 3;

  return {
    tasks,
    addTask,
    carryForwardTask,
    completeTask,
    uncompleteTask,
    dropTask,
    refresh,
    pendingCount,
    doneCount,
    canAddMore,
  };
}
