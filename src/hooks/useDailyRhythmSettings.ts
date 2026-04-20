import { useCallback, useEffect, useState } from 'react';
import { notifyDataChanged, subscribeToDataChanges } from '../api/client';
import { dbGetContext, dbRemoveContext, dbSetContext } from '../db';
import type { DailyRhythmSettings } from '../types';
import {
  clampBreakMinutes,
  clampDurationMinutes,
  createDefaultDailyRhythmSettings,
  normalizeWakeTime,
} from '../utils/dailyPhases';

const KEY_WAKE_TIME = 'daily_rhythm_wake_time';
const KEY_FOCUS_MINUTES = 'daily_rhythm_focus_minutes';
const KEY_BREAK_MINUTES = 'daily_rhythm_break_minutes';
const KEY_FOCUS_ASSIST = 'daily_rhythm_focus_assist';

function readNumber(key: string, fallback: number, clamp: (value: number, fallback: number) => number): number {
  const value = Number(dbGetContext(key) || '');
  return clamp(value, fallback);
}

function readSettings(): DailyRhythmSettings {
  const defaults = createDefaultDailyRhythmSettings();
  return {
    wakeTime: normalizeWakeTime(dbGetContext(KEY_WAKE_TIME) || defaults.wakeTime),
    defaultFocusMinutes: readNumber(KEY_FOCUS_MINUTES, defaults.defaultFocusMinutes, clampDurationMinutes),
    defaultBreakMinutes: readNumber(KEY_BREAK_MINUTES, defaults.defaultBreakMinutes, clampBreakMinutes),
    focusModeAssistEnabled: dbGetContext(KEY_FOCUS_ASSIST) !== '0',
  };
}

export function useDailyRhythmSettings() {
  const [settings, setSettings] = useState<DailyRhythmSettings>(() => readSettings());

  const refresh = useCallback(() => {
    setSettings(readSettings());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(refresh), [refresh]);

  const setWakeTime = useCallback(
    (wakeTime: string) => {
      dbSetContext(KEY_WAKE_TIME, normalizeWakeTime(wakeTime));
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  const setDefaultFocusMinutes = useCallback(
    (minutes: number) => {
      dbSetContext(
        KEY_FOCUS_MINUTES,
        String(clampDurationMinutes(minutes, createDefaultDailyRhythmSettings().defaultFocusMinutes))
      );
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  const setDefaultBreakMinutes = useCallback(
    (minutes: number) => {
      dbSetContext(
        KEY_BREAK_MINUTES,
        String(clampBreakMinutes(minutes, createDefaultDailyRhythmSettings().defaultBreakMinutes))
      );
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  const setFocusModeAssistEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        dbRemoveContext(KEY_FOCUS_ASSIST);
      } else {
        dbSetContext(KEY_FOCUS_ASSIST, '0');
      }
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  return {
    ...settings,
    refresh,
    setWakeTime,
    setDefaultFocusMinutes,
    setDefaultBreakMinutes,
    setFocusModeAssistEnabled,
  };
}
