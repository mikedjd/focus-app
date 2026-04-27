import { useState, useCallback, useEffect } from 'react';
import type { Goal, GoalWriteInput, WeeklyFocus } from '../types';
import {
  completeGoal as apiCompleteGoal,
  createDefaultGoal as apiCreateDefaultGoal,
  createGoal as apiCreateGoal,
  getActiveGoal,
  getCurrentWeeklyFocus,
  subscribeToDataChanges,
  updateGoal as apiUpdateGoal,
  upsertWeeklyFocus,
} from '../api/client';

export function useGoals() {
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [weeklyFocus, setWeeklyFocus] = useState<WeeklyFocus | null>(null);

  const refresh = useCallback(async () => {
    const goal = await getActiveGoal();
    setActiveGoal(goal);
    if (goal) {
      setWeeklyFocus(await getCurrentWeeklyFocus(goal.id));
    } else {
      setWeeklyFocus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(() => void refresh()), [refresh]);

  const createGoal = useCallback(
    async (input: GoalWriteInput) => {
      await apiCreateGoal(input);
      await refresh();
    },
    [refresh]
  );

  const createDefaultGoal = useCallback(async () => {
    await apiCreateDefaultGoal();
    await refresh();
  }, [refresh]);

  const updateGoal = useCallback(
    async (id: string, input: GoalWriteInput) => {
      await apiUpdateGoal(id, input);
      await refresh();
    },
    [refresh]
  );

  const completeGoal = useCallback(
    async (id: string) => {
      await apiCompleteGoal(id);
      await refresh();
    },
    [refresh]
  );

  const setWeeklyFocusText = useCallback(
    async (goalId: string, focus: string) => {
      await upsertWeeklyFocus(goalId, focus);
      await refresh();
    },
    [refresh]
  );

  return {
    activeGoal,
    weeklyFocus,
    createGoal,
    createDefaultGoal,
    updateGoal,
    completeGoal,
    setWeeklyFocusText,
    refresh,
  };
}
