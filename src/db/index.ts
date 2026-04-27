import { Platform } from 'react-native';

export { getDb, dbSchemaVersion } from './schema';

// ─── Platform-switched exports ────────────────────────────────────────────────
// On web, SQLite is unavailable — every DB function routes to the localStorage
// layer in ./web.ts. On native the original SQLite implementations are used.

import * as webDb from './web';
import * as webCc from './webControlCenter';

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
  dbCreateDefaultGoal as nativeCreateDefaultGoal,
  dbCreateGoal as nativeCreateGoal,
  dbUpdateGoal as nativeUpdateGoal,
  dbCompleteGoal as nativeCompleteGoal,
  dbGetCurrentWeeklyFocus as nativeGetCurrentWeeklyFocus,
  dbUpsertWeeklyFocus as nativeUpsertWeeklyFocus,
} from './goals';

import {
  dbGetGameStats as nativeGetGameStats,
  dbUpsertDailyXp as nativeUpsertDailyXp,
  dbRecalcStreakAndHealth as nativeRecalcStreakAndHealth,
  dbCalculateBuildPhase as nativeCalculateBuildPhase,
  dbCalculateDifficultyPhase as nativeCalculateDifficultyPhase,
  dbCalculateGoalStatus as nativeCalculateGoalStatus,
  dbMaybeUpgradeDifficultyPhase as nativeMaybeUpgradeDifficultyPhase,
  dbRunWeeklyInspection as nativeRunWeeklyInspection,
} from './game';

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

import {
  dbGetMilestonesForGoal as nativeGetMilestonesForGoal,
  dbCreateMilestone as nativeCreateMilestone,
  dbToggleMilestone as nativeToggleMilestone,
  dbDeleteMilestone as nativeDeleteMilestone,
  dbGetGoalProgress as nativeGetGoalProgress,
} from './milestones';

import {
  dbGetEnergyWindows as nativeGetEnergyWindows,
  dbGetEnergyWindowsForDay as nativeGetEnergyWindowsForDay,
  dbCreateEnergyWindow as nativeCreateEnergyWindow,
  dbDeleteEnergyWindow as nativeDeleteEnergyWindow,
  dbCopyWindowsToAllWeekdays as nativeCopyWindowsToAllWeekdays,
  findWindowForEffort as nativeFindWindowForEffort,
} from './energyWindows';

import {
  dbGetParkingLot as nativeGetParkingLot,
  dbGetParkingLotCount as nativeGetParkingLotCount,
  dbDivertToParkingLot as nativeDivertToParkingLot,
  dbPromoteParkingLotItem as nativePromoteParkingLotItem,
  dbDismissParkingLotItem as nativeDismissParkingLotItem,
} from './parkingLot';

import {
  dbGetPendingInboxItems as nativeGetPendingInboxItems,
  dbGetPendingInboxCount as nativeGetPendingInboxCount,
  dbCreateInboxItem as nativeCreateInboxItem,
  dbUpdateInboxClassification as nativeUpdateInboxClassification,
  dbResolveInboxItem as nativeResolveInboxItem,
  dbDeleteInboxItem as nativeDeleteInboxItem,
} from './inbox';

import { dbRecomputeGoalFriction as nativeRecomputeGoalFriction } from './goalFriction';

import {
  dbGetFocusSessionById as nativeGetFocusSessionById,
  dbGetActiveFocusSession as nativeGetActiveFocusSession,
  dbGetActiveFocusSessionForTask as nativeGetActiveFocusSessionForTask,
  dbGetMostRecentAbandonedFocusSession as nativeGetMostRecentAbandonedFocusSession,
  dbStartFocusSession as nativeStartFocusSession,
  dbTouchFocusSession as nativeTouchFocusSession,
  dbCompleteFocusSession as nativeCompleteFocusSession,
  dbAbandonFocusSession as nativeAbandonFocusSession,
  dbGetFocusSessionsForTask as nativeGetFocusSessionsForTask,
  dbGetFocusSessionsForWeek as nativeGetFocusSessionsForWeek,
} from './focusSessions';

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
export const dbCreateDefaultGoal     = isWeb ? webDb.dbCreateDefaultGoal     : nativeCreateDefaultGoal;
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

// Gamification
export const dbGetGameStats             = isWeb ? webDb.dbGetGameStats             : nativeGetGameStats;
export const dbUpsertDailyXp            = isWeb ? webDb.dbUpsertDailyXp            : nativeUpsertDailyXp;
export const dbRecalcStreakAndHealth    = isWeb ? webDb.dbRecalcStreakAndHealth    : nativeRecalcStreakAndHealth;
export const dbCalculateBuildPhase      = isWeb ? webDb.dbCalculateBuildPhase      : nativeCalculateBuildPhase;
export const dbCalculateDifficultyPhase = isWeb ? webDb.dbCalculateDifficultyPhase : nativeCalculateDifficultyPhase;
export const dbCalculateGoalStatus      = isWeb ? webDb.dbCalculateGoalStatus      : nativeCalculateGoalStatus;
export const dbMaybeUpgradeDifficultyPhase = isWeb ? webDb.dbMaybeUpgradeDifficultyPhase : nativeMaybeUpgradeDifficultyPhase;
export const dbRunWeeklyInspection = isWeb ? webDb.dbRunWeeklyInspection : nativeRunWeeklyInspection;

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

// Focus sessions
export const dbGetFocusSessionById             = isWeb ? webDb.dbGetFocusSessionById             : nativeGetFocusSessionById;
export const dbGetActiveFocusSession           = isWeb ? webDb.dbGetActiveFocusSession           : nativeGetActiveFocusSession;
export const dbGetActiveFocusSessionForTask    = isWeb ? webDb.dbGetActiveFocusSessionForTask    : nativeGetActiveFocusSessionForTask;
export const dbGetMostRecentAbandonedFocusSession = isWeb ? webDb.dbGetMostRecentAbandonedFocusSession : nativeGetMostRecentAbandonedFocusSession;
export const dbStartFocusSession               = isWeb ? webDb.dbStartFocusSession               : nativeStartFocusSession;
export const dbTouchFocusSession               = isWeb ? webDb.dbTouchFocusSession               : nativeTouchFocusSession;
export const dbCompleteFocusSession            = isWeb ? webDb.dbCompleteFocusSession            : nativeCompleteFocusSession;
export const dbAbandonFocusSession             = isWeb ? webDb.dbAbandonFocusSession             : nativeAbandonFocusSession;
export const dbGetFocusSessionsForTask         = isWeb ? webDb.dbGetFocusSessionsForTask         : nativeGetFocusSessionsForTask;
export const dbGetFocusSessionsForWeek         = isWeb ? webDb.dbGetFocusSessionsForWeek         : nativeGetFocusSessionsForWeek;

// Milestones
export const dbGetMilestonesForGoal = isWeb ? webCc.dbGetMilestonesForGoal : nativeGetMilestonesForGoal;
export const dbCreateMilestone      = isWeb ? webCc.dbCreateMilestone      : nativeCreateMilestone;
export const dbToggleMilestone      = isWeb ? webCc.dbToggleMilestone      : nativeToggleMilestone;
export const dbDeleteMilestone      = isWeb ? webCc.dbDeleteMilestone      : nativeDeleteMilestone;
export const dbGetGoalProgress      = isWeb ? webCc.dbGetGoalProgress      : nativeGetGoalProgress;

// Energy windows
export const dbGetEnergyWindows         = isWeb ? webCc.dbGetEnergyWindows         : nativeGetEnergyWindows;
export const dbGetEnergyWindowsForDay   = isWeb ? webCc.dbGetEnergyWindowsForDay   : nativeGetEnergyWindowsForDay;
export const dbCreateEnergyWindow       = isWeb ? webCc.dbCreateEnergyWindow       : nativeCreateEnergyWindow;
export const dbDeleteEnergyWindow       = isWeb ? webCc.dbDeleteEnergyWindow       : nativeDeleteEnergyWindow;
export const dbCopyWindowsToAllWeekdays = isWeb ? webCc.dbCopyWindowsToAllWeekdays : nativeCopyWindowsToAllWeekdays;
export const findWindowForEffort        = isWeb ? webCc.findWindowForEffort        : nativeFindWindowForEffort;

// Parking lot
export const dbGetParkingLot          = isWeb ? webCc.dbGetParkingLot          : nativeGetParkingLot;
export const dbGetParkingLotCount     = isWeb ? webCc.dbGetParkingLotCount     : nativeGetParkingLotCount;
export const dbDivertToParkingLot     = isWeb ? webCc.dbDivertToParkingLot     : nativeDivertToParkingLot;
export const dbPromoteParkingLotItem  = isWeb ? webCc.dbPromoteParkingLotItem  : nativePromoteParkingLotItem;
export const dbDismissParkingLotItem  = isWeb ? webCc.dbDismissParkingLotItem  : nativeDismissParkingLotItem;

// Inbox
export const dbGetPendingInboxItems     = isWeb ? webCc.dbGetPendingInboxItems     : nativeGetPendingInboxItems;
export const dbGetPendingInboxCount     = isWeb ? webCc.dbGetPendingInboxCount     : nativeGetPendingInboxCount;
export const dbCreateInboxItem          = isWeb ? webCc.dbCreateInboxItem          : nativeCreateInboxItem;
export const dbUpdateInboxClassification= isWeb ? webCc.dbUpdateInboxClassification: nativeUpdateInboxClassification;
export const dbResolveInboxItem         = isWeb ? webCc.dbResolveInboxItem         : nativeResolveInboxItem;
export const dbDeleteInboxItem          = isWeb ? webCc.dbDeleteInboxItem          : nativeDeleteInboxItem;

// Friction
export const dbRecomputeGoalFriction = isWeb ? webCc.dbRecomputeGoalFriction : nativeRecomputeGoalFriction;
