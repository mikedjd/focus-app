import { useCallback, useEffect, useState } from 'react';
import {
  dbCopyWindowsToAllWeekdays,
  dbCreateEnergyWindow,
  dbDeleteEnergyWindow,
  dbGetEnergyWindows,
} from '../db';
import { notifyDataChanged, subscribeToDataChanges } from '../api/client';
import type { EnergyIntensity, EnergyWindow } from '../types';

export function useEnergyWindows() {
  const [windows, setWindows] = useState<EnergyWindow[]>([]);

  const refresh = useCallback(() => {
    setWindows(dbGetEnergyWindows());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(refresh), [refresh]);

  const add = useCallback(
    (day: number, startHour: number, endHour: number, intensity: EnergyIntensity) => {
      dbCreateEnergyWindow(day, startHour, endHour, intensity);
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    (id: string) => {
      dbDeleteEnergyWindow(id);
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  const copyToWeekdays = useCallback(
    (sourceDay: number) => {
      dbCopyWindowsToAllWeekdays(sourceDay);
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  return { windows, add, remove, copyToWeekdays, refresh };
}
