import { useState, useCallback, useEffect } from 'react';
import type { DailyTask, TaskWriteResult } from '../types';
import {
  carryForwardTask as apiCarryForwardTask,
  completeTask as apiCompleteTask,
  createTask,
  dropTask as apiDropTask,
  getTodayTasks,
  subscribeToDataChanges,
  uncompleteTask as apiUncompleteTask,
} from '../api/client';

export function useTodayTasks(goalId: string | null) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);

  const refresh = useCallback(async () => {
    setTasks(await getTodayTasks());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(() => void refresh()), [refresh]);

  const addTask = useCallback(
    async (
      title: string,
      weeklyFocusId?: string | null,
      nextStep?: string,
      projectId?: string | null
    ): Promise<TaskWriteResult> => {
      if (!goalId) {
        return { ok: false, reason: 'missing_goal' };
      }

      const result = await createTask({
        title,
        goalId,
        weeklyFocusId,
        nextStep,
        projectId,
      });
      await refresh();
      return result;
    },
    [goalId, refresh]
  );

  const carryForwardTask = useCallback(
    async (taskId: string): Promise<TaskWriteResult> => {
      const result = await apiCarryForwardTask(taskId);
      await refresh();
      return result;
    },
    [refresh]
  );

  const completeTask = useCallback(
    async (id: string) => {
      await apiCompleteTask(id);
      await refresh();
    },
    [refresh]
  );

  const uncompleteTask = useCallback(
    async (id: string) => {
      await apiUncompleteTask(id);
      await refresh();
    },
    [refresh]
  );

  const dropTask = useCallback(
    async (id: string) => {
      await apiDropTask(id);
      await refresh();
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
