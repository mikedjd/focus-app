import { useCallback, useEffect, useState } from 'react';
import {
  dbCreateMilestone,
  dbDeleteMilestone,
  dbGetGoalProgress,
  dbGetMilestonesForGoal,
  dbToggleMilestone,
} from '../db';
import { notifyDataChanged, subscribeToDataChanges } from '../api/client';
import type { GoalProgress, Milestone } from '../types';

export function useMilestones(goalId: string | null | undefined) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [progress, setProgress] = useState<GoalProgress | null>(null);

  const refresh = useCallback(() => {
    if (!goalId) {
      setMilestones([]);
      setProgress(null);
      return;
    }
    setMilestones(dbGetMilestonesForGoal(goalId));
    setProgress(dbGetGoalProgress(goalId));
  }, [goalId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(refresh), [refresh]);

  const addMilestone = useCallback(
    (title: string, targetMetric = '') => {
      if (!goalId || !title.trim()) return;
      dbCreateMilestone(goalId, title.trim(), targetMetric.trim());
      notifyDataChanged();
      refresh();
    },
    [goalId, refresh]
  );

  const toggleMilestone = useCallback(
    (id: string, completed: boolean) => {
      dbToggleMilestone(id, completed);
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  const deleteMilestone = useCallback(
    (id: string) => {
      dbDeleteMilestone(id);
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  return { milestones, progress, addMilestone, toggleMilestone, deleteMilestone, refresh };
}
