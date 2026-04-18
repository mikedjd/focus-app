import type { Goal, OnboardingDraft } from '../types';
import { dbCreateGoal, dbGetCurrentWeeklyFocus, dbUpsertWeeklyFocus } from './goals';
import { runDb } from './schema';
import { dbGetContext, dbRemoveContext, dbSetContext } from './context';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
const ONBOARDING_DRAFT_KEY = 'onboarding_draft';

export function dbIsOnboardingComplete(): boolean {
  return runDb('get onboarding state', false, (db) => {
    const raw = db.getFirstSync<{ value: string }>(
      'SELECT value FROM app_context WHERE key = ?',
      [ONBOARDING_COMPLETE_KEY]
    )?.value;

    if (raw === '1') {
      return true;
    }

    const hasExistingGoal = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM goals'
    )?.count;

    if ((hasExistingGoal ?? 0) > 0) {
      db.runSync('INSERT OR REPLACE INTO app_context (key, value) VALUES (?, ?)', [
        ONBOARDING_COMPLETE_KEY,
        '1',
      ]);
      return true;
    }

    return false;
  });
}

export function dbGetOnboardingDraft(): OnboardingDraft | null {
  const raw = dbGetContext(ONBOARDING_DRAFT_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    dbRemoveContext(ONBOARDING_DRAFT_KEY);
    return null;
  }
}

export function dbSaveOnboardingDraft(draft: OnboardingDraft): boolean {
  return dbSetContext(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
}

export function dbClearOnboardingDraft(): boolean {
  return dbRemoveContext(ONBOARDING_DRAFT_KEY);
}

export function dbCompleteOnboarding(
  draft: OnboardingDraft
): { goal: Goal | null; weeklyFocusId: string | null } {
  return runDb('complete onboarding', { goal: null, weeklyFocusId: null }, () => {
    const goal = dbCreateGoal({
      title: draft.goalTitle,
      targetOutcome: draft.targetOutcome,
      targetDate: draft.hasTargetDate ? draft.targetDate : null,
      metric: draft.metric,
      practicalReason: draft.practicalReason,
      emotionalReason: draft.emotionalReason,
      costOfDrift: draft.costOfDrift,
      anchorWhy: draft.anchorWhy,
      anchorDrift: draft.anchorDrift,
    });

    if (!goal) {
      return { goal: null, weeklyFocusId: null };
    }

    if (draft.weeklyFocus.trim()) {
      dbUpsertWeeklyFocus(goal.id, draft.weeklyFocus.trim());
    }

    dbSetContext(ONBOARDING_COMPLETE_KEY, '1');
    dbClearOnboardingDraft();

    return {
      goal,
      weeklyFocusId: dbGetCurrentWeeklyFocus(goal.id)?.id ?? null,
    };
  });
}
