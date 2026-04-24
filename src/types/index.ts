export type GoalStatus = 'active' | 'queued' | 'parked' | 'completed';
export type TaskStatus = 'pending' | 'done' | 'dropped';
export type TaskType = 'goal' | 'admin';
export type EffortLevel = '' | 'light' | 'medium' | 'challenging';
export type EnergyIntensity = 'low' | 'medium' | 'high';
export type DailyPhaseId = 'phase1' | 'phase2' | 'phase3';
export type InboxClassification =
  | 'today_task'
  | 'admin'
  | 'milestone'
  | 'parking_lot'
  | 'someday'
  | 'habit'
  | 'unknown';
export type ParkingStatus = 'parked' | 'promoted' | 'dismissed';
export type FocusSessionStatus = 'active' | 'completed' | 'abandoned';
export type VisionStatus = 'active' | 'archived';
export type HabitStatus = 'learning' | 'maintaining' | 'graduated' | 'paused';
export type HabitCueType = 'time' | 'stack' | 'location' | 'free';
export type HabitCadenceType = 'daily' | 'weekdays' | 'n_per_week' | 'custom_days';
export type HabitCompletionStatus = 'done' | 'skipped' | 'missed';

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
  visionId?: string | null;
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
  visionId: string | null;
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
  goalId: string | null;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: number;
}

export interface Vision {
  id: string;
  title: string;
  description: string;
  identityStatement: string;
  color: string;
  sortOrder: number;
  status: VisionStatus;
  createdAt: number;
}

export interface VisionWriteInput {
  title: string;
  description?: string;
  identityStatement?: string;
  color?: string;
}

export interface Habit {
  id: string;
  title: string;
  cue: string;
  cueType: HabitCueType;
  stackAnchorHabitId: string | null;
  identityStatement: string;
  cadenceType: HabitCadenceType;
  cadenceTarget: number;
  cadenceDays: number[]; // 0=Sun..6=Sat, only when cadenceType='custom_days'
  goalId: string | null;
  visionId: string | null;
  status: HabitStatus;
  startedAt: number;
  graduatedAt: number | null;
  sortOrder: number;
}

export interface HabitWriteInput {
  title: string;
  cue?: string;
  cueType?: HabitCueType;
  stackAnchorHabitId?: string | null;
  identityStatement?: string;
  cadenceType?: HabitCadenceType;
  cadenceTarget?: number;
  cadenceDays?: number[];
  goalId?: string | null;
  visionId?: string | null;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  status: HabitCompletionStatus;
  completedAt: number;
}

export interface HabitTodayView {
  habit: Habit;
  todayStatus: HabitCompletionStatus | null; // null = not logged today
  streak: number;
  recentDots: Array<'done' | 'miss' | 'skip' | 'off'>; // last 7 scheduled-or-not days, oldest→newest
  scheduledToday: boolean;
  adherencePct: number; // 0..1 over last 30 scheduled days
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
  phaseId: DailyPhaseId;
  focusDurationMinutes: number;
  breakDurationMinutes: number;
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
  draftSteps: string[];
}

export interface BrainDumpItem {
  id: string;
  text: string;
  createdAt: number;
}

export interface DailyRhythmSettings {
  wakeTime: string;
  defaultFocusMinutes: number;
  defaultBreakMinutes: number;
  focusModeAssistEnabled: boolean;
}

export interface TaskPlanInput {
  title: string;
  nextStep?: string;
  projectId?: string | null;
  phaseId: DailyPhaseId;
  focusDurationMinutes: number;
  breakDurationMinutes: number;
}

export type TaskWriteFailureReason =
  | 'missing_goal'
  | 'task_limit_reached'
  | 'task_not_found'
  | 'db_error';

export type TaskWriteResult =
  | { ok: true; task: DailyTask }
  | { ok: false; reason: TaskWriteFailureReason };
