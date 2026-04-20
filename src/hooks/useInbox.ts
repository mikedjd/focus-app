import { useCallback, useEffect, useState } from 'react';
import {
  dbCreateTask,
  dbCreateInboxItem,
  dbDeleteInboxItem,
  dbDivertToParkingLot,
  dbGetPendingInboxCount,
  dbGetPendingInboxItems,
  dbResolveInboxItem,
  dbUpdateInboxClassification,
  findWindowForEffort,
} from '../db';
import { notifyDataChanged, subscribeToDataChanges } from '../api/client';
import type { EffortLevel, InboxClassification, InboxItem } from '../types';
import { classifyItemRuleBased } from '../utils/inboxTriage';
import { classifyItemWithClaude } from '../utils/llmTriage';
import { useTriageSettings } from './useTriageSettings';

function parseScheduledDate(scheduledFor: string | null): Date | undefined {
  if (!scheduledFor) {
    return undefined;
  }
  const [year, month, day] = scheduledFor.split('-').map(Number);
  if (!year || !month || !day) {
    return undefined;
  }
  return new Date(year, month - 1, day);
}

export function useInbox(activeGoalId: string | null) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const { llmEnabled, apiKey, model } = useTriageSettings();

  const refresh = useCallback(() => {
    setItems(dbGetPendingInboxItems());
    setPendingCount(dbGetPendingInboxCount());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(refresh), [refresh]);

  const capture = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return null;
      const triage =
        llmEnabled && apiKey.trim()
          ? await classifyItemWithClaude({
              rawText: text,
              apiKey,
              model,
              hasActiveGoal: Boolean(activeGoalId),
            }).catch(() =>
              classifyItemRuleBased(text, { hasActiveGoal: Boolean(activeGoalId) })
            )
          : classifyItemRuleBased(text, { hasActiveGoal: Boolean(activeGoalId) });
      const item = dbCreateInboxItem(text, triage.classification, {
        scheduledFor: triage.scheduledFor,
        effortLevel: triage.effortLevel,
      });
      notifyDataChanged();
      refresh();
      return { item, triage };
    },
    [activeGoalId, apiKey, llmEnabled, model, refresh]
  );

  const reclassify = useCallback(
    (
      id: string,
      classification: InboxClassification,
      extras?: { scheduledFor?: string | null; effortLevel?: EffortLevel }
    ) => {
      dbUpdateInboxClassification(id, classification, extras);
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  const applyClassification = useCallback(
    async (item: InboxItem): Promise<boolean> => {
      if (!item.classifiedAs) return false;

      if (item.classifiedAs === 'parking_lot') {
        dbDivertToParkingLot(item.rawText, '');
        dbResolveInboxItem(item.id, null);
        notifyDataChanged();
        refresh();
        return true;
      }

      if (item.classifiedAs === 'today_task' || item.classifiedAs === 'admin' || item.classifiedAs === 'milestone') {
        if (!activeGoalId) return false;
        const scheduledWindowStart =
          item.classifiedAs === 'admin'
            ? findWindowForEffort(
                item.effortLevel,
                parseScheduledDate(item.scheduledFor) ?? new Date()
              ) || ''
            : '';
        const result = dbCreateTask(item.rawText, activeGoalId, null, {
          date: item.scheduledFor ?? undefined,
          taskType: item.classifiedAs === 'admin' ? 'admin' : 'goal',
          effortLevel: item.effortLevel,
          scheduledWindowStart,
        });
        if (!result.ok) {
          return false;
        }
        dbResolveInboxItem(item.id, result.task.id);
        notifyDataChanged();
        refresh();
        return true;
      }

      // someday / unknown → just mark resolved
      dbResolveInboxItem(item.id, null);
      notifyDataChanged();
      refresh();
      return true;
    },
    [activeGoalId, refresh]
  );

  const dismiss = useCallback(
    (id: string) => {
      dbDeleteInboxItem(id);
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  return { items, pendingCount, capture, reclassify, applyClassification, dismiss, refresh };
}
