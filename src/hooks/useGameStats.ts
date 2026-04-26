import { useState, useCallback, useEffect } from 'react';
import type { GameStats } from '../types';
import { getGameStats, subscribeToDataChanges } from '../api/client';

export function useGameStats(goalId: string | null): {
  stats: GameStats | null;
  loading: boolean;
  refresh: () => void;
} {
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!goalId) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void getGameStats(goalId).then((result) => {
      setStats(result);
      setLoading(false);
    });
  }, [goalId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(refresh), [refresh]);

  return { stats, loading, refresh };
}
