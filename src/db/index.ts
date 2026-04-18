import { Platform } from 'react-native';

export { getDb, dbSchemaVersion } from './schema';

// ─── Platform-switched exports ────────────────────────────────────────────────
// On web, SQLite is unavailable — every DB function routes to the localStorage
// layer in ./web.ts. On native the original SQLite implementations are used.

import * as webDb from './web';

import {
  dbGetContext as nativeGetContext,
  dbSetContext as nativeSetContext,
  dbRemoveContext as nativeRemoveContext,
  dbGetResumeContext as nativeGetResumeContext,
  dbDismissResumeContext as nativeDismissResumeContext,
  dbRefreshResumeContext as nativeRefreshResumeContext,
} from './context';

import {
  dbGetActiveGoal as nativeGetActiveGoal,
  dbCreateGoal as nativeCreateGoal,
  dbUpdateGoal as nativeUpdateGoal,
  dbCompleteGoal as nativeCompleteGoal,
  dbGetCurrentWeeklyFocus as nativeGetCurrentWeeklyFocus,
  dbUpsertWeeklyFocus as nativeUpsertWeeklyFocus,
} from './goals';

import {
  dbGetTodayTasks as nativeGetTodayTasks,
  dbGetTasksForDate as nativeGetTasksForDate,
  dbGetTaskById as nativeGetTaskById,
  dbCreateTask as nativeCreateTask,
  dbCarryForwardTask as nativeCarryForwardTask,
  dbCompleteTask as nativeCompleteTask,
  dbUncompleteTask as nativeUncompleteTask,
  dbDropTask as nativeDropTask,
} from './tasks';

import {
  dbGetReviewForWeek as nativeGetReviewForWeek,
  dbSaveReview as nativeSaveReview,
  dbIsReviewDue as nativeIsReviewDue,
  dbGetTasksForWeek as nativeGetTasksForWeek,
} from './reviews';

import {
  dbIsOnboardingComplete as nativeIsOnboardingComplete,
  dbGetOnboardingDraft as nativeGetOnboardingDraft,
  dbSaveOnboardingDraft as nativeSaveOnboardingDraft,
  dbClearOnboardingDraft as nativeClearOnboardingDraft,
  dbCompleteOnboarding as nativeCompleteOnboarding,
} from './onboarding';

const isWeb = Platform.OS === 'web';

// Context
export const dbGetContext           = isWeb ? webDb.dbGetContext           : nativeGetContext;
export const dbSetContext           = isWeb ? webDb.dbSetContext           : nativeSetContext;
export const dbRemoveContext        = isWeb ? webDb.dbRemoveContext        : nativeRemoveContext;
export const dbGetResumeContext     = isWeb ? webDb.dbGetResumeContext     : nativeGetResumeContext;
export const dbDismissResumeContext = isWeb ? webDb.dbDismissResumeContext : nativeDismissResumeContext;
export const dbRefreshResumeContext = isWeb ? webDb.dbRefreshResumeContext : nativeRefreshResumeContext;

// Goals
export const dbGetActiveGoal         = isWeb ? webDb.dbGetActiveGoal         : nativeGetActiveGoal;
export const dbCreateGoal            = isWeb ? webDb.dbCreateGoal            : nativeCreateGoal;
export const dbUpdateGoal            = isWeb ? webDb.dbUpdateGoal            : nativeUpdateGoal;
export const dbCompleteGoal          = isWeb ? webDb.dbCompleteGoal          : nativeCompleteGoal;
export const dbGetCurrentWeeklyFocus = isWeb ? webDb.dbGetCurrentWeeklyFocus : nativeGetCurrentWeeklyFocus;
export const dbUpsertWeeklyFocus     = isWeb ? webDb.dbUpsertWeeklyFocus     : nativeUpsertWeeklyFocus;

// Tasks
export const dbGetTodayTasks    = isWeb ? webDb.dbGetTodayTasks    : nativeGetTodayTasks;
export const dbGetTasksForDate  = isWeb ? webDb.dbGetTasksForDate  : nativeGetTasksForDate;
export const dbGetTaskById      = isWeb ? webDb.dbGetTaskById      : nativeGetTaskById;
export const dbCreateTask       = isWeb ? webDb.dbCreateTask       : nativeCreateTask;
export const dbCarryForwardTask = isWeb ? webDb.dbCarryForwardTask : nativeCarryForwardTask;
export const dbCompleteTask     = isWeb ? webDb.dbCompleteTask     : nativeCompleteTask;
export const dbUncompleteTask   = isWeb ? webDb.dbUncompleteTask   : nativeUncompleteTask;
export const dbDropTask         = isWeb ? webDb.dbDropTask         : nativeDropTask;

// Reviews
export const dbGetReviewForWeek = isWeb ? webDb.dbGetReviewForWeek : nativeGetReviewForWeek;
export const dbSaveReview       = isWeb ? webDb.dbSaveReview       : nativeSaveReview;
export const dbIsReviewDue      = isWeb ? webDb.dbIsReviewDue      : nativeIsReviewDue;
export const dbGetTasksForWeek  = isWeb ? webDb.dbGetTasksForWeek  : nativeGetTasksForWeek;

// Onboarding
export const dbIsOnboardingComplete  = isWeb ? webDb.dbIsOnboardingComplete  : nativeIsOnboardingComplete;
export const dbGetOnboardingDraft    = isWeb ? webDb.dbGetOnboardingDraft    : nativeGetOnboardingDraft;
export const dbSaveOnboardingDraft   = isWeb ? webDb.dbSaveOnboardingDraft   : nativeSaveOnboardingDraft;
export const dbClearOnboardingDraft  = isWeb ? webDb.dbClearOnboardingDraft  : nativeClearOnboardingDraft;
export const dbCompleteOnboarding    = isWeb ? webDb.dbCompleteOnboarding    : nativeCompleteOnboarding;
