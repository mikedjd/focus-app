export type GoalStatus = 'active' | 'completed' | 'archived';
export type TaskStatus = 'pending' | 'done' | 'dropped';

export interface GoalWriteInput {
  title: string;
  targetOutcome?: string;
  targetDate?: string | null;
  metric?: string;
  why?: string;
  practicalReason?: string;
  emotionalReason?: string;
  costOfDrift?: string;
  anchorWhy?: string;
  anchorDrift?: string;
}

export interface Goal {
  id: string;
  title: string;
  targetOutcome: string;
  targetDate: string | null;
  metric: string;
  why: string;
  practicalReason: string;
  emotionalReason: string;
  costOfDrift: string;
  anchorWhy: string;
  anchorDrift: string;
  createdAt: number;
  status: GoalStatus;
}

export interface WeeklyFocus {
  id: string;
  goalId: string;
  focus: string;
  weekOf: string; // YYYY-MM-DD Monday
  notes: string;
}

export interface DailyTask {
  id: string;
  goalId: string;
  weeklyFocusId: string | null;
  sourceTaskId: string | null;
  title: string;
  date: string; // YYYY-MM-DD
  status: TaskStatus;
  completedAt: number | null;
  sortOrder: number;
  createdAt: number;
}

export interface WeeklyReview {
  id: string;
  weekOf: string; // YYYY-MM-DD Monday
  completedAt: number;
  wins: string;
  whatDrifted: string;       // free-text "other" override (legacy + fallback)
  driftReasons: string[];    // selectable chip ids, persisted as comma-separated string
  nextWeekAdjustment: string;
}

export interface ResumeContext {
  taskId: string;
  taskTitle: string;
  fromDate: string; // YYYY-MM-DD
  goalId: string;
  weeklyFocusId: string | null;
}

export interface OnboardingDraft {
  goalTitle: string;
  targetOutcome: string;
  hasTargetDate: boolean;
  targetDate: string;
  metric: string;
  practicalReason: string;
  emotionalReason: string;
  costOfDrift: string;
  anchorWhy: string;
  anchorDrift: string;
  weeklyFocus: string;
}

export type TaskWriteFailureReason =
  | 'missing_goal'
  | 'task_limit_reached'
  | 'task_not_found'
  | 'db_error';

export type TaskWriteResult =
  | { ok: true; task: DailyTask }
  | { ok: false; reason: TaskWriteFailureReason };
