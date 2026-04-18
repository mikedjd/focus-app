import { useState, useCallback, useEffect } from 'react';
import type { Goal, GoalWriteInput, WeeklyFocus } from '../types';
import {
  dbGetActiveGoal,
  dbCreateGoal,
  dbUpdateGoal,
  dbCompleteGoal,
  dbGetCurrentWeeklyFocus,
  dbUpsertWeeklyFocus,
} from '../db';

export function useGoals() {
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [weeklyFocus, setWeeklyFocus] = useState<WeeklyFocus | null>(null);

  const refresh = useCallback(() => {
    const goal = dbGetActiveGoal();
    setActiveGoal(goal);
    if (goal) {
      setWeeklyFocus(dbGetCurrentWeeklyFocus(goal.id));
    } else {
      setWeeklyFocus(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createGoal = useCallback(
    (input: GoalWriteInput) => {
      dbCreateGoal(input);
      refresh();
    },
    [refresh]
  );

  const updateGoal = useCallback(
    (id: string, input: GoalWriteInput) => {
      dbUpdateGoal(id, input);
      refresh();
    },
    [refresh]
  );

  const completeGoal = useCallback(
    (id: string) => {
      dbCompleteGoal(id);
      refresh();
    },
    [refresh]
  );

  const setWeeklyFocusText = useCallback(
    (goalId: string, focus: string) => {
      dbUpsertWeeklyFocus(goalId, focus);
      refresh();
    },
    [refresh]
  );

  return {
    activeGoal,
    weeklyFocus,
    createGoal,
    updateGoal,
    completeGoal,
    setWeeklyFocusText,
    refresh,
  };
}
