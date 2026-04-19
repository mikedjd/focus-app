import { useState, useCallback, useEffect } from 'react';
import type { DailyReview } from '../types';
import { getDailyReview, saveDailyReview, subscribeToDataChanges } from '../api/client';
import { todayString } from '../utils/dates';

export function useDailyReview() {
  const [review, setReview] = useState<DailyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const date = todayString();

  const refresh = useCallback(async () => {
    setReview(await getDailyReview(date));
    setLoading(false);
  }, [date]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => subscribeToDataChanges(() => void refresh()), [refresh]);

  const save = useCallback(
    async (wins: string, drift: string, tomorrowStep: string) => {
      const result = await saveDailyReview(date, wins, drift, tomorrowStep);
      setReview(result);
      return result;
    },
    [date]
  );

  const isDue = !loading && review === null;

  return { review, isDue, loading, save, refresh };
}
