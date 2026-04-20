export type GoalStatus = 'active' | 'queued' | 'parked' | 'completed';
export type TaskStatus = 'pending' | 'done' | 'dropped';
export type TaskType = 'goal' | 'admin';
export type EffortLevel = '' | 'light' | 'medium' | 'challenging';
export type EnergyIntensity = 'low' | 'medium' | 'high';
export type InboxClassification =
  | 'today_task'
  | 'admin'
  | 'milestone'
  | 'parking_lot'
  | 'someday'
  | 'unknown';
export type ParkingStatus = 'parked' | 'promoted' | 'dismissed';
export type FocusSessionStatus = 'active' | 'completed' | 'abandoned';
export type FocusExitReason =
  | 'distraction'
  | 'task_unclear'
  | 'too_tired'
  | 'interrupted'
  | 'avoided_it'
  | 'switched_task';

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
  importance?: number;
  urgency?: number;
  payoff?: number;
  whyNow?: string;
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
  importance: number;
  urgency: number;
  payoff: number;
  whyNow: string;
  createdAt: number;
  status: GoalStatus;
  currentFrictionMinutes: number;
  weeklySeatedSeconds: number;
  weeklySeatedWeekOf: string;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  targetMetric: string;
  sortOrder: number;
  completedAt: number | null;
  createdAt: number;
}

export interface GoalProgress {
  goalId: string;
  totalMilestones: number;
  completedMilestones: number;
  percent: number; // 0..1
  nextMilestone: Milestone | null;
}

export interface EnergyWindow {
  id: string;
  dayOfWeek: number; // 0=Sun..6=Sat
  startHour: number; // 0..23
  endHour: number; // 1..24
  intensity: EnergyIntensity;
  createdAt: number;
}

export interface ParkingLotItem {
  id: string;
  title: string;
  why: string;
  divertedAt: number;
  promotableAt: number;
  status: ParkingStatus;
}

export interface InboxItem {
  id: string;
  rawText: string;
  classifiedAs: InboxClassification | null;
  targetId: string | null;
  scheduledFor: string | null;
  effortLevel: EffortLevel;
  createdAt: number;
  resolvedAt: number | null;
}

export interface WeeklyFocus {
  id: string;
  goalId: string;
  focus: string;
  weekOf: string; // YYYY-MM-DD Monday
  notes: string;
}

export interface Project {
  id: string;
  goalId: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: number;
}

export interface DailyReview {
  id: string;
  date: string; // YYYY-MM-DD
  completedAt: number;
  wins: string;
  drift: string;
  tomorrowStep: string;
}

export interface DailyTask {
  id: string;
  goalId: string;
  projectId: string | null;
  weeklyFocusId: string | null;
  sourceTaskId: string | null;
  title: string;
  nextStep: string;
  date: string; // YYYY-MM-DD
  status: TaskStatus;
  completedAt: number | null;
  sortOrder: number;
  createdAt: number;
  taskType: TaskType;
  effortLevel: EffortLevel;
  milestoneId: string | null;
  scheduledWindowStart: string;
}

export interface FocusSession {
  id: string;
  taskId: string;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number;
  status: FocusSessionStatus;
  exitReason: FocusExitReason | null;
  lastHeartbeatAt: number;
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

export interface CarryForwardResumeContext {
  kind: 'carry-forward';
  taskId: string;
  taskTitle: string;
  fromDate: string; // YYYY-MM-DD
  goalId: string;
  weeklyFocusId: string | null;
}

export interface FocusSessionResumeContext {
  kind: 'focus-session';
  taskId: string;
  taskTitle: string;
  goalId: string;
  weeklyFocusId: string | null;
  focusSessionId: string;
  startedAt: number;
  lastHeartbeatAt: number;
  sessionStatus: Extract<FocusSessionStatus, 'active' | 'abandoned'>;
  exitReason: FocusExitReason | null;
}

export type ResumeContext = CarryForwardResumeContext | FocusSessionResumeContext;

export interface OnboardingDraft {
  goalTitle: string;
  targetOutcome: string;
  hasTargetDate: boolean;
  targetDate: string;
  metric: string;
  importance: number;
  urgency: number;
  payoff: number;
  whyNow: string;
  practicalReason: string;
  emotionalReason: string;
  costOfDrift: string;
  anchorWhy: string;
  anchorDrift: string;
  weeklyFocus: string;
}

export interface BrainDumpItem {
  id: string;
  text: string;
  createdAt: number;
}

export type TaskWriteFailureReason =
  | 'missing_goal'
  | 'task_limit_reached'
  | 'task_not_found'
  | 'db_error';

export type TaskWriteResult =
  | { ok: true; task: DailyTask }
  | { ok: false; reason: TaskWriteFailureReason };
