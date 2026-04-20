import { useCallback, useEffect, useState } from 'react';
import { notifyDataChanged, subscribeToDataChanges } from '../api/client';
import { dbGetContext, dbRemoveContext, dbSetContext } from '../db';

const KEY_ENABLED = 'triage_llm_enabled';
const KEY_MODEL = 'triage_llm_model';
const KEY_API_KEY = 'triage_anthropic_api_key';

export const DEFAULT_TRIAGE_MODEL = 'claude-sonnet-4-20250514';

export interface TriageSettings {
  llmEnabled: boolean;
  model: string;
  apiKey: string;
}

function readSettings(): TriageSettings {
  return {
    llmEnabled: dbGetContext(KEY_ENABLED) === '1',
    model: dbGetContext(KEY_MODEL) || DEFAULT_TRIAGE_MODEL,
    apiKey: dbGetContext(KEY_API_KEY) || '',
  };
}

export function useTriageSettings() {
  const [settings, setSettings] = useState<TriageSettings>(() => readSettings());

  const refresh = useCallback(() => {
    setSettings(readSettings());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(refresh), [refresh]);

  const setLlmEnabled = useCallback(
    (enabled: boolean) => {
      dbSetContext(KEY_ENABLED, enabled ? '1' : '0');
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  const setModel = useCallback(
    (model: string) => {
      const value = model.trim() || DEFAULT_TRIAGE_MODEL;
      dbSetContext(KEY_MODEL, value);
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  const setApiKey = useCallback(
    (apiKey: string) => {
      const value = apiKey.trim();
      if (value) {
        dbSetContext(KEY_API_KEY, value);
      } else {
        dbRemoveContext(KEY_API_KEY);
      }
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  return {
    ...settings,
    refresh,
    setLlmEnabled,
    setModel,
    setApiKey,
  };
}
