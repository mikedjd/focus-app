/**
 * Web storage layer — mirrors the SQLite DB layer exactly, using localStorage.
 * All data lives in the browser under keys prefixed with `adhd_`.
 * Used automatically on Platform.OS === 'web' via src/db/index.ts.
 */

import type {
  BrainDumpItem,
  DailyRequirement,
  DailyReview,
  DailyXpRow,
  DifficultyPhase,
  DailyPhaseId,
  DailyRhythmSettings,
  DailyTask,
  FocusExitReason,
  FocusSession,
  GameStats,
  Goal,
  GoalPerformanceStatus,
  GoalStatus,
  GoalWriteInput,
  Habit,
  HabitCompletion,
  HabitCompletionStatus,
  HabitTodayView,
  HabitWriteInput,
  Milestone,
  Project,
  ResumeContext,
  TaskTier,
  TaskWriteResult,
  Vision,
  VisionWriteInput,
  WeeklyFocus,
  WeeklyInspection,
  WeeklyReview,
} from '../types';
import { TIER_XP } from '../types';
import {
  STANDALONE_TASKS_GOAL_ID,
  STANDALONE_TASKS_GOAL_TITLE,
} from '../constants/standaloneTaskGoal';
import {
  clampBreakMinutes,
  clampDurationMinutes,
  createDefaultDailyRhythmSettings,
  DEFAULT_BREAK_MINUTES,
  DEFAULT_FOCUS_MINUTES,
  getDefaultPhaseId,
  normalizeWakeTime,
} from '../utils/dailyPhases';
import { formatDate, getPrevWeekStart, getWeekStart, todayString } from '../utils/dates';
import { generateAnchorLines } from '../utils/goalAnchors';
import { generateId } from '../utils/ids';
import { findWindowForEffort } from './webControlCenter';

// ─── Storage keys ────────────────────────────────────────────────────────────

const KEY_GOALS = 'adhd_goals';
const KEY_TASKS = 'adhd_tasks';
const KEY_FOCUSES = 'adhd_focuses';
const KEY_REVIEWS = 'adhd_reviews';
const KEY_DAILY_REVIEWS = 'adhd_daily_reviews';
const KEY_PROJECTS = 'adhd_projects';
const KEY_VISIONS = 'adhd_visions';
const KEY_HABITS = 'adhd_habits';
const KEY_HABIT_COMPLETIONS = 'adhd_habit_completions';
const KEY_MILESTONES = 'adhd_milestones';
const KEY_BRAIN_DUMP = 'adhd_brain_dump';
const KEY_FOCUS_SESSIONS = 'adhd_focus_sessions';
const KEY_DAILY_XP = 'adhd_daily_xp';
const KEY_WEEKLY_INSPECTIONS = 'adhd_weekly_inspections';
const KEY_CTX_PREFIX = 'adhd_ctx_';

const DAILY_TASK_CAP = 3;
const RESUME_CONTEXT_KEY = 'resume_context';
const DISMISSED_RESUME_TASK_ID_KEY = 'dismissed_resume_task_id';
const FOCUS_RESUME_WINDOW_MS = 36 * 60 * 60 * 1000;
const GOAL_STATUS_ORDER: GoalStatus[] = ['active', 'queued', 'parked', 'completed'];
const MS_PER_DAY = 86_400_000;

// ─── Raw localStorage helpers ────────────────────────────────────────────────

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage not available (SSR, private mode quota, etc.) — silently skip
  }
}

function ctxGet(key: string): string | null {
  try {
    return localStorage.getItem(KEY_CTX_PREFIX + key);
  } catch {
    return null;
  }
}

function ctxSet(key: string, value: string): void {
  try {
    localStorage.setItem(KEY_CTX_PREFIX + key, value);
  } catch {}
}

function ctxRemove(key: string): void {
  try {
    localStorage.removeItem(KEY_CTX_PREFIX + key);
  } catch {}
}

function getDailyRhythmSettings(): DailyRhythmSettings {
  const defaults = createDefaultDailyRhythmSettings();
  return {
    wakeTime: normalizeWakeTime(ctxGet('daily_rhythm_wake_time') || defaults.wakeTime),
    defaultFocusMinutes: clampDurationMinutes(
      Number(ctxGet('daily_rhythm_focus_minutes') || ''),
      defaults.defaultFocusMinutes
    ),
    defaultBreakMinutes: clampBreakMinutes(
      Number(ctxGet('daily_rhythm_break_minutes') || ''),
      defaults.defaultBreakMinutes
    ),
    focusModeAssistEnabled: ctxGet('daily_rhythm_focus_assist') !== '0',
  };
}

// ─── Goal helpers ─────────────────────────────────────────────────────────────

function cleanText(value?: string | null): string {
  return value?.trim() ?? '';
}

function clampGoalRating(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(3, Math.round(value)));
}

function normalizeGoalInput(input: GoalWriteInput) {
  const practicalReason = cleanText(input.practicalReason);
  const emotionalReason = cleanText(input.emotionalReason);
  const costOfDrift = cleanText(input.costOfDrift);
  const fallback = generateAnchorLines({ practicalReason, emotionalReason, costOfDrift });
  const anchorWhy = cleanText(input.anchorWhy || input.why) || fallback.anchorWhy;
  const anchorDrift = cleanText(input.anchorDrift) || fallback.anchorDrift;
  return {
    title: cleanText(input.title),
    targetOutcome: cleanText(input.targetOutcome) || cleanText(input.title),
    targetDate: cleanText(input.targetDate) || null,
    metric: cleanText(input.metric),
    why: anchorWhy,
    practicalReason,
    emotionalReason,
    costOfDrift,
    anchorWhy,
    anchorDrift,
    importance: clampGoalRating(input.importance, 2),
    urgency: clampGoalRating(input.urgency, 1),
    payoff: clampGoalRating(input.payoff, 2),
    whyNow: cleanText(input.whyNow),
    visionId: input.visionId ?? null,
    description: cleanText(input.description),
    startDate: cleanText(input.startDate) || null,
    whyItMatters: cleanText(input.whyItMatters) || anchorWhy,
    xpTarget: input.xpTarget ?? 0,
  };
}

function normalizeStoredGoal(goal: Goal | (Partial<Goal> & { id: string; title: string; createdAt: number })): Goal {
  const rawStatus = (goal as { status?: GoalStatus | 'archived' }).status;
  const status = rawStatus === 'archived' ? 'parked' : rawStatus;
  const title = cleanText(goal.title);
  const createdAt = goal.createdAt;
  const updatedAt = (goal as Goal).updatedAt ?? createdAt;
  const totalXp = (goal as Goal).totalXp ?? (goal as Goal).xpTotal ?? 0;
  const currentStreak = (goal as Goal).currentStreak ?? (goal as Goal).streakCount ?? 0;
  const healthScore = (goal as Goal).healthScore ?? (goal as Goal).buildHealth ?? 100;
  const targetDate = cleanText(goal.targetDate) || (goal as Goal).endDate || null;
  const xpTarget = (goal as Goal).xpTarget ?? 0;
  const buildHealth = (goal as Goal).buildHealth ?? healthScore;
  const lastCompletedDate = (goal as Goal).lastCompletedDate ?? '';
  return {
    id: goal.id,
    name: (goal as Goal).name ?? title,
    title,
    targetOutcome: cleanText(goal.targetOutcome) || title,
    targetDate,
    metric: cleanText(goal.metric),
    why: cleanText(goal.why) || cleanText(goal.anchorWhy),
    practicalReason: cleanText(goal.practicalReason),
    emotionalReason: cleanText(goal.emotionalReason),
    costOfDrift: cleanText(goal.costOfDrift),
    anchorWhy: cleanText(goal.anchorWhy),
    anchorDrift: cleanText(goal.anchorDrift),
    importance: clampGoalRating(goal.importance, 2),
    urgency: clampGoalRating(goal.urgency, 1),
    payoff: clampGoalRating(goal.payoff, 2),
    whyNow: cleanText(goal.whyNow),
    createdAt,
    updatedAt,
    status:
      status === 'active' || status === 'queued' || status === 'parked' || status === 'completed'
        ? status
        : 'parked',
    currentFrictionMinutes: (goal as Goal).currentFrictionMinutes ?? 2,
    weeklySeatedSeconds: (goal as Goal).weeklySeatedSeconds ?? 0,
    weeklySeatedWeekOf: (goal as Goal).weeklySeatedWeekOf ?? '',
    visionId: (goal as Goal).visionId ?? null,
    totalXp,
    currentStreak,
    streakDate: (goal as Goal).streakDate ?? '',
    healthScore,
    description: (goal as Goal).description ?? '',
    startDate: (goal as Goal).startDate ?? null,
    endDate: targetDate,
    whyItMatters: (goal as Goal).whyItMatters ?? cleanText(goal.anchorWhy) ?? cleanText(goal.why),
    xpTotal: totalXp,
    xpTarget,
    buildHealth,
    currentPhase: (goal as Goal).currentPhase ?? calculateBuildPhase(totalXp, xpTarget),
    difficultyPhase: (goal as Goal).difficultyPhase ?? 1,
    streakCount: currentStreak,
    lastCompletedDate,
    performanceStatus:
      (goal as Goal).performanceStatus ??
      calculateGoalStatus({
        xpTotal: totalXp,
        xpTarget,
        buildHealth,
        lastCompletedDate,
        createdAt,
      }),
  };
}

function getGoalsStore(): Goal[] {
  const rawGoals = load<Goal>(KEY_GOALS);
  const normalizedGoals = rawGoals.map((goal) =>
    normalizeStoredGoal(goal as Goal & { status?: GoalStatus | 'archived' })
  );

  const activeGoals = normalizedGoals.filter((goal) => goal.status === 'active').sort((a, b) => b.createdAt - a.createdAt);
  let hydratedGoals = normalizedGoals;

  if (activeGoals.length > 1) {
    const activeGoalId = activeGoals[0].id;
    hydratedGoals = normalizedGoals.map((goal) =>
      goal.status === 'active' && goal.id !== activeGoalId ? { ...goal, status: 'queued' } : goal
    );
  }

  if (JSON.stringify(rawGoals) !== JSON.stringify(hydratedGoals)) {
    save(KEY_GOALS, hydratedGoals);
  }

  return hydratedGoals;
}

function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const statusDelta = GOAL_STATUS_ORDER.indexOf(a.status) - GOAL_STATUS_ORDER.indexOf(b.status);
    if (statusDelta !== 0) {
      return statusDelta;
    }

    const scoreA = a.importance * 3 + a.payoff * 2 + a.urgency;
    const scoreB = b.importance * 3 + b.payoff * 2 + b.urgency;
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    return b.createdAt - a.createdAt;
  });
}

function ensureStandaloneTaskGoal(goals: Goal[]): Goal[] {
  if (goals.some((goal) => goal.id === STANDALONE_TASKS_GOAL_ID)) {
    return goals;
  }

  return [
    ...goals,
    {
      id: STANDALONE_TASKS_GOAL_ID,
      name: STANDALONE_TASKS_GOAL_TITLE,
      title: STANDALONE_TASKS_GOAL_TITLE,
      targetOutcome: STANDALONE_TASKS_GOAL_TITLE,
      targetDate: null,
      metric: '',
      why: '',
      practicalReason: '',
      emotionalReason: '',
      costOfDrift: '',
      anchorWhy: '',
      anchorDrift: '',
      importance: 1,
      urgency: 1,
      payoff: 1,
      whyNow: '',
      createdAt: 0,
      updatedAt: 0,
      status: 'parked',
      currentFrictionMinutes: 2,
      weeklySeatedSeconds: 0,
      weeklySeatedWeekOf: '',
      visionId: null,
      totalXp: 0,
      currentStreak: 0,
      streakDate: '',
      healthScore: 100,
      description: '',
      startDate: null,
      endDate: null,
      whyItMatters: '',
      xpTotal: 0,
      xpTarget: 0,
      buildHealth: 100,
      currentPhase: 1,
      difficultyPhase: 1,
      streakCount: 0,
      lastCompletedDate: '',
      performanceStatus: 'on_track',
    },
  ];
}

// ─── Goal functions ───────────────────────────────────────────────────────────

export function dbGetActiveGoal(): Goal | null {
  return getGoalsStore().find((goal) => goal.status === 'active') ?? null;
}

export function dbGetGoals(): Goal[] {
  return sortGoals(getGoalsStore()).filter((goal) => goal.id !== STANDALONE_TASKS_GOAL_ID);
}

export function dbCreateDefaultGoal(): Goal | null {
  return dbCreateGoal({
    title: 'Build momentum',
    targetOutcome: 'Create a steady weekly goal rhythm',
    metric: 'XP earned',
    why: 'A simple default goal keeps tasks anchored until a specific goal is chosen.',
    practicalReason: 'Keep daily tasks grouped.',
    emotionalReason: 'Make progress visible.',
    costOfDrift: 'Tasks drift without an anchor.',
    description: 'Default goal project',
    startDate: todayString(),
    whyItMatters: 'A small visible build is easier to return to.',
  });
}

export function dbCreateGoal(
  input: GoalWriteInput,
  options?: { status?: Exclude<GoalStatus, 'completed'> }
): Goal | null {
  const goals = getGoalsStore();
  const n = normalizeGoalInput(input);
  const nextStatus = options?.status ?? (goals.some((goal) => goal.status === 'active') ? 'parked' : 'active');
  const now = Date.now();
  const goal: Goal = {
    id: generateId(),
    name: n.title,
    title: n.title,
    targetOutcome: n.targetOutcome || n.title,
    targetDate: n.targetDate ?? null,
    metric: n.metric || '',
    why: n.anchorWhy || '',
    practicalReason: n.practicalReason || '',
    emotionalReason: n.emotionalReason || '',
    costOfDrift: n.costOfDrift || '',
    anchorWhy: n.anchorWhy || '',
    anchorDrift: n.anchorDrift || '',
    importance: n.importance,
    urgency: n.urgency,
    payoff: n.payoff,
    whyNow: n.whyNow,
    createdAt: now,
    updatedAt: now,
    status: nextStatus,
    currentFrictionMinutes: 2,
    weeklySeatedSeconds: 0,
    weeklySeatedWeekOf: '',
    visionId: n.visionId ?? null,
    totalXp: 0,
    currentStreak: 0,
    streakDate: '',
    healthScore: 100,
    description: n.description,
    startDate: n.startDate ?? todayString(),
    endDate: n.targetDate ?? null,
    whyItMatters: n.whyItMatters,
    xpTotal: 0,
    xpTarget: n.xpTarget,
    buildHealth: 100,
    currentPhase: 1,
    difficultyPhase: 1,
    streakCount: 0,
    lastCompletedDate: '',
    performanceStatus: 'on_track',
  };
  const updatedGoals =
    nextStatus === 'active'
      ? goals.map((existingGoal) =>
          existingGoal.status === 'active' ? { ...existingGoal, status: 'queued' as const } : existingGoal
        )
      : goals;
  save(KEY_GOALS, [...updatedGoals, goal]);
  return goal;
}

export function dbUpdateGoal(id: string, input: GoalWriteInput): boolean {
  const goals = getGoalsStore();
  const n = normalizeGoalInput(input);
  const updated = goals.map((g) =>
    g.id === id
      ? {
          ...g,
          title: n.title,
          targetOutcome: n.targetOutcome,
          targetDate: n.targetDate ?? null,
          metric: n.metric,
          why: n.anchorWhy,
          practicalReason: n.practicalReason,
          emotionalReason: n.emotionalReason,
          costOfDrift: n.costOfDrift,
          anchorWhy: n.anchorWhy,
          anchorDrift: n.anchorDrift,
          importance: n.importance,
          urgency: n.urgency,
          payoff: n.payoff,
          whyNow: n.whyNow,
          visionId: n.visionId ?? g.visionId ?? null,
          name: n.title,
          description: n.description,
          startDate: n.startDate,
          endDate: n.targetDate ?? null,
          whyItMatters: n.whyItMatters,
          xpTarget: n.xpTarget,
          updatedAt: Date.now(),
        }
      : g
  );
  save(KEY_GOALS, updated);
  return true;
}

export function dbSetGoalStatus(id: string, status: Exclude<GoalStatus, 'completed'>): boolean {
  const goals = getGoalsStore();
  const updated = goals.map((goal) => {
    if (status === 'active' && goal.status === 'active' && goal.id !== id) {
      return { ...goal, status: 'queued' as const };
    }

    if (goal.id === id) {
      return { ...goal, status };
    }

    return goal;
  });
  save(KEY_GOALS, updated);
  return true;
}

export function dbCompleteGoal(id: string): boolean {
  const goals = getGoalsStore();
  save(KEY_GOALS, goals.map((g) => (g.id === id ? { ...g, status: 'completed' as const } : g)));
  return true;
}

// ─── Weekly focus functions ───────────────────────────────────────────────────

export function dbGetCurrentWeeklyFocus(goalId: string): WeeklyFocus | null {
  const focuses = load<WeeklyFocus>(KEY_FOCUSES);
  const weekOf = getWeekStart();
  return focuses.find((f) => f.goalId === goalId && f.weekOf === weekOf) ?? null;
}

export function dbUpsertWeeklyFocus(goalId: string, focus: string): WeeklyFocus | null {
  const focuses = load<WeeklyFocus>(KEY_FOCUSES);
  const weekOf = getWeekStart();
  const existing = focuses.find((f) => f.goalId === goalId && f.weekOf === weekOf);
  if (existing) {
    const updated = focuses.map((f) => (f.id === existing.id ? { ...f, focus } : f));
    save(KEY_FOCUSES, updated);
    return { ...existing, focus };
  }
  const wf: WeeklyFocus = { id: generateId(), goalId, focus, weekOf, notes: '' };
  save(KEY_FOCUSES, [...focuses, wf]);
  return wf;
}

// ─── Task functions ───────────────────────────────────────────────────────────

function getActiveTasks(tasks: DailyTask[], date: string): DailyTask[] {
  return tasks
    .filter((t) => t.date === date && t.status !== 'dropped')
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getActiveGoalTasks(tasks: DailyTask[], date: string): DailyTask[] {
  return getActiveTasks(tasks, date).filter((task) => (task.taskType ?? 'goal') === 'goal');
}

function normalizeTask(task: DailyTask): DailyTask {
  const defaults = getDailyRhythmSettings();
  const taskType = task.taskType ?? 'goal';
  const effortLevel = task.effortLevel ?? '';
  const phaseId =
    task.phaseId === 'phase1' || task.phaseId === 'phase2' || task.phaseId === 'phase3'
      ? task.phaseId
      : getDefaultPhaseId(taskType, effortLevel);

  return {
    ...task,
    phaseId: phaseId as DailyPhaseId,
    focusDurationMinutes: clampDurationMinutes(
      task.focusDurationMinutes ?? DEFAULT_FOCUS_MINUTES,
      defaults.defaultFocusMinutes
    ),
    breakDurationMinutes: clampBreakMinutes(
      task.breakDurationMinutes ?? DEFAULT_BREAK_MINUTES,
      defaults.defaultBreakMinutes
    ),
    tier: task.tier ?? 2,
    updatedAt: task.updatedAt ?? task.completedAt ?? task.createdAt,
    linkedSite: task.linkedSite ?? null,
    isRecoveryTask: task.isRecoveryTask ?? false,
  };
}

export function dbGetTodayTasks(): DailyTask[] {
  return dbGetTasksForDate(todayString());
}

export function dbGetTasksForDate(date: string): DailyTask[] {
  return getActiveTasks(load<DailyTask>(KEY_TASKS).map(normalizeTask), date);
}

export function dbGetAllTasks(): DailyTask[] {
  return load<DailyTask>(KEY_TASKS)
    .map(normalizeTask)
    .filter((task) => task.status !== 'dropped')
    .sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder);
}

export function dbGetTaskById(id: string): DailyTask | null {
  const task = load<DailyTask>(KEY_TASKS).map(normalizeTask).find((candidate) => candidate.id === id);
  return task ?? null;
}

export function dbCreateTask(
  title: string,
  goalId: string,
  weeklyFocusId?: string | null,
  options?: {
    date?: string;
    sourceTaskId?: string | null;
    nextStep?: string;
    projectId?: string | null;
    taskType?: DailyTask['taskType'];
    effortLevel?: DailyTask['effortLevel'];
    milestoneId?: string | null;
    scheduledWindowStart?: string;
    phaseId?: DailyTask['phaseId'];
    focusDurationMinutes?: number;
    breakDurationMinutes?: number;
    tier?: TaskTier;
    linkedSite?: string | null;
    isRecoveryTask?: boolean;
  }
): TaskWriteResult {
  if (!goalId) {
    save(KEY_GOALS, ensureStandaloneTaskGoal(getGoalsStore()));
  }
  const tasks = load<DailyTask>(KEY_TASKS);
  const resolvedGoalId = goalId || STANDALONE_TASKS_GOAL_ID;
  const targetDate = options?.date ?? todayString();
  const isToday = targetDate === todayString();
  const defaults = getDailyRhythmSettings();
  const taskType = options?.taskType ?? 'goal';
  if (isToday && taskType === 'goal' && getActiveGoalTasks(tasks, targetDate).length >= DAILY_TASK_CAP) {
    return { ok: false, reason: 'task_limit_reached' };
  }
  const effortLevel = options?.effortLevel ?? '';
  // Auto-slot admin tasks into the matching energy window when none is specified
  const scheduledWindowStart =
    options?.scheduledWindowStart ??
    (taskType === 'admin' && effortLevel ? findWindowForEffort(effortLevel) : '');
  const now = Date.now();
  const task: DailyTask = {
    id: generateId(),
    goalId: resolvedGoalId,
    projectId: options?.projectId ?? null,
    weeklyFocusId: weeklyFocusId ?? null,
    sourceTaskId: options?.sourceTaskId ?? null,
    title,
    nextStep: cleanText(options?.nextStep),
    date: targetDate,
    status: 'pending',
    completedAt: null,
    sortOrder: getActiveTasks(tasks, targetDate).length,
    createdAt: now,
    updatedAt: now,
    taskType,
    effortLevel,
    milestoneId: options?.milestoneId ?? null,
    scheduledWindowStart,
    phaseId: options?.phaseId ?? getDefaultPhaseId(taskType, effortLevel),
    focusDurationMinutes: clampDurationMinutes(
      options?.focusDurationMinutes ?? defaults.defaultFocusMinutes,
      defaults.defaultFocusMinutes
    ),
    breakDurationMinutes: clampBreakMinutes(
      options?.breakDurationMinutes ?? defaults.defaultBreakMinutes,
      defaults.defaultBreakMinutes
    ),
    tier: options?.tier ?? 2,
    linkedSite: options?.linkedSite ?? null,
    isRecoveryTask: options?.isRecoveryTask ?? false,
  };
  save(KEY_TASKS, [...tasks, task]);
  webRefreshResumeContext();
  return { ok: true, task };
}

export function dbCarryForwardTask(taskId: string): TaskWriteResult {
  const tasks = load<DailyTask>(KEY_TASKS);
  const source = tasks.find((t) => t.id === taskId && t.status === 'pending');
  if (!source) return { ok: false, reason: 'task_not_found' };
  const targetDate = todayString();
  if (getActiveTasks(tasks, targetDate).length >= DAILY_TASK_CAP) {
    return { ok: false, reason: 'task_limit_reached' };
  }
  const now = Date.now();
  const task: DailyTask = {
    id: generateId(),
    goalId: source.goalId,
    projectId: source.projectId ?? null,
    weeklyFocusId: source.weeklyFocusId,
    sourceTaskId: source.id,
    title: source.title,
    nextStep: source.nextStep,
    date: targetDate,
    status: 'pending',
    completedAt: null,
    sortOrder: getActiveTasks(tasks, targetDate).length,
    createdAt: now,
    updatedAt: now,
    taskType: source.taskType ?? 'goal',
    effortLevel: source.effortLevel ?? '',
    milestoneId: source.milestoneId ?? null,
    scheduledWindowStart: source.scheduledWindowStart ?? '',
    phaseId:
      source.phaseId === 'phase1' || source.phaseId === 'phase2' || source.phaseId === 'phase3'
        ? source.phaseId
        : getDefaultPhaseId(source.taskType ?? 'goal', source.effortLevel ?? ''),
    focusDurationMinutes: clampDurationMinutes(
      source.focusDurationMinutes ?? DEFAULT_FOCUS_MINUTES,
      getDailyRhythmSettings().defaultFocusMinutes
    ),
    breakDurationMinutes: clampBreakMinutes(
      source.breakDurationMinutes ?? DEFAULT_BREAK_MINUTES,
      getDailyRhythmSettings().defaultBreakMinutes
    ),
    tier: source.tier ?? 2,
    linkedSite: source.linkedSite ?? null,
    isRecoveryTask: source.isRecoveryTask ?? false,
  };
  save(KEY_TASKS, [...tasks, task]);
  webRefreshResumeContext();
  return { ok: true, task };
}

export function dbCompleteTask(id: string): boolean {
  const tasks = load<DailyTask>(KEY_TASKS).map(normalizeTask);
  const now = Date.now();
  save(KEY_TASKS, tasks.map((t) => (t.id === id ? { ...t, status: 'done' as const, completedAt: now, updatedAt: now } : t)));
  const task = tasks.find((candidate) => candidate.id === id);
  if (task) {
    dbUpsertDailyXp(task.goalId, task.date);
    dbRecalcStreakAndHealth(task.goalId);
  }
  webRefreshResumeContext();
  return true;
}

export function dbUncompleteTask(id: string): boolean {
  const tasks = load<DailyTask>(KEY_TASKS).map(normalizeTask);
  save(KEY_TASKS, tasks.map((t) => (t.id === id ? { ...t, status: 'pending' as const, completedAt: null, updatedAt: Date.now() } : t)));
  webRefreshResumeContext();
  return true;
}

export function dbDropTask(id: string): boolean {
  const tasks = load<DailyTask>(KEY_TASKS).map(normalizeTask);
  save(KEY_TASKS, tasks.map((t) => (t.id === id ? { ...t, status: 'dropped' as const, updatedAt: Date.now() } : t)));
  webRefreshResumeContext();
  return true;
}

// ─── Gamification functions ──────────────────────────────────────────────────

const MAX_DIFFICULTY_PHASE: DifficultyPhase = 4;

function normalizeDifficultyPhase(value: number | null | undefined): DifficultyPhase {
  if (value === 2 || value === 3 || value === 4) return value;
  return 1;
}

export function getDailyRequirement(
  goal: Pick<Goal, 'difficultyPhase'> | { difficultyPhase?: number | null }
): DailyRequirement {
  const phase = normalizeDifficultyPhase(goal.difficultyPhase);
  if (phase === 4) {
    return {
      phase,
      phaseName: 'Operator Mode',
      tasksRequired: 3,
      minimumTier: null,
      weeklyHardTaskRequired: true,
      missPenalty: 15,
      minimumCopy: 'Minimum required: 3 tasks.',
    };
  }
  if (phase === 3) {
    return {
      phase,
      phaseName: 'Real Work',
      tasksRequired: 3,
      minimumTier: 2,
      weeklyHardTaskRequired: false,
      missPenalty: 10,
      minimumCopy: 'Minimum required: 3 tasks, with at least 1 T2+.',
    };
  }
  if (phase === 2) {
    return {
      phase,
      phaseName: 'Build Rhythm',
      tasksRequired: 2,
      minimumTier: null,
      weeklyHardTaskRequired: false,
      missPenalty: 5,
      minimumCopy: 'Minimum required: 2 tasks.',
    };
  }
  return {
    phase,
    phaseName: 'Show Up',
    tasksRequired: 1,
    minimumTier: null,
    weeklyHardTaskRequired: false,
    missPenalty: 2,
    minimumCopy: 'Minimum required: 1 task.',
  };
}

export function isValidDay(
  goal: Pick<Goal, 'difficultyPhase'> | { difficultyPhase?: number | null },
  tasks: Array<Pick<DailyTask, 'status' | 'tier'>>
): boolean {
  const requirement = getDailyRequirement(goal);
  const completed = tasks.filter((task) => task.status === 'done');
  if (completed.length < requirement.tasksRequired) return false;
  if (requirement.minimumTier) {
    return completed.some((task) => (task.tier ?? 1) >= requirement.minimumTier!);
  }
  return true;
}

export function applyMissedDayPenalty<
  T extends Pick<Goal, 'buildHealth' | 'healthScore' | 'performanceStatus' | 'difficultyPhase'>,
>(goal: T): T {
  const requirement = getDailyRequirement(goal);
  const currentHealth = goal.buildHealth ?? goal.healthScore ?? 100;
  const nextHealth = Math.max(0, currentHealth - requirement.missPenalty);
  const shouldDecay =
    requirement.phase === 4 ||
    (requirement.phase === 3 && (goal.performanceStatus === 'decaying' || currentHealth <= 90));

  return {
    ...goal,
    buildHealth: nextHealth,
    healthScore: nextHealth,
    performanceStatus: shouldDecay ? 'decaying' : goal.performanceStatus,
  };
}

export function maybeUpgradeDifficultyPhase<T extends Pick<Goal, 'difficultyPhase'>>(
  goal: T,
  inspections: Array<Pick<WeeklyInspection, 'result'>> = []
): T {
  const currentPhase = normalizeDifficultyPhase(goal.difficultyPhase);
  const latestTwo = inspections.slice(0, 2);
  const passedTwoInARow = latestTwo.length === 2 && latestTwo.every((row) => row.result === 'pass');
  if (!passedTwoInARow || currentPhase >= MAX_DIFFICULTY_PHASE) return goal;
  return {
    ...goal,
    difficultyPhase: (currentPhase + 1) as DifficultyPhase,
  };
}

function computeTargetXp(goal: Goal): number {
  if (goal.xpTarget > 0) return goal.xpTarget;
  const end = goal.endDate ? new Date(goal.endDate).getTime() : Date.now() + 90 * MS_PER_DAY;
  const totalDays = Math.max(1, Math.round((end - goal.createdAt) / MS_PER_DAY));
  const workingDays = Math.round((totalDays / 7) * 5);
  return Math.max(1, workingDays * TIER_XP[2]);
}

function assignRecoveryTask(goalId: string, missedDate: string): void {
  const recoveryDate = missedDate < todayString() ? todayString() : missedDate;
  const tasks = load<DailyTask>(KEY_TASKS).map(normalizeTask);
  const exists = tasks.some(
    (task) =>
      task.goalId === goalId &&
      task.date === recoveryDate &&
      task.isRecoveryTask &&
      task.status !== 'dropped'
  );
  if (exists || getActiveTasks(tasks, recoveryDate).length >= DAILY_TASK_CAP) return;

  const now = Date.now();
  const task: DailyTask = {
    id: generateId(),
    goalId,
    projectId: null,
    weeklyFocusId: null,
    sourceTaskId: null,
    title: 'Recovery task: reset the build',
    nextStep: 'Do one small task to restart momentum.',
    date: recoveryDate,
    status: 'pending',
    completedAt: null,
    sortOrder: getActiveTasks(tasks, recoveryDate).length,
    createdAt: now,
    updatedAt: now,
    taskType: 'goal',
    effortLevel: 'light',
    milestoneId: null,
    scheduledWindowStart: '',
    phaseId: 'phase2',
    focusDurationMinutes: 25,
    breakDurationMinutes: 5,
    tier: 1,
    linkedSite: null,
    isRecoveryTask: true,
  };
  save(KEY_TASKS, [...tasks, task]);
}

export function calculateBuildPhase(totalXp: number, targetXp: number): 1 | 2 | 3 | 4 | 5 {
  if (targetXp <= 0) return 1;
  const ratio = totalXp / targetXp;
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.6) return 4;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

export function calculateDifficultyPhase(goalCreatedAtMs: number, asOfMs = Date.now()): DifficultyPhase {
  const weeksElapsed = Math.floor((asOfMs - goalCreatedAtMs) / (7 * MS_PER_DAY));
  if (weeksElapsed >= 6) return 4;
  if (weeksElapsed >= 4) return 3;
  if (weeksElapsed >= 2) return 2;
  return 1;
}

export function calculateGoalStatus(input: {
  xpTotal: number;
  xpTarget: number;
  buildHealth: number;
  lastCompletedDate?: string | null;
  createdAt?: number;
  asOfMs?: number;
}): GoalPerformanceStatus {
  const asOfMs = input.asOfMs ?? Date.now();
  const daysSinceCompletion = input.lastCompletedDate
    ? Math.floor((asOfMs - new Date(input.lastCompletedDate).getTime()) / MS_PER_DAY)
    : null;
  if (input.buildHealth < 40 || (daysSinceCompletion !== null && daysSinceCompletion >= 7)) {
    return 'decaying';
  }

  const ratio = input.xpTarget > 0 ? input.xpTotal / input.xpTarget : 1;
  const daysSinceCreated = input.createdAt ? Math.floor((asOfMs - input.createdAt) / MS_PER_DAY) : 0;
  if (ratio >= 1.1) return 'ahead';
  if (daysSinceCreated >= 7 && ratio < 0.75) return 'behind';
  return 'on_track';
}

function getStatusCopy(requirement: DailyRequirement, status: GoalPerformanceStatus): string {
  if (status === 'decaying' && requirement.phase === 4) {
    return 'Missed target. Recovery task assigned.';
  }
  if (requirement.phase === 4) {
    return 'Operator Mode unlocked. Expectations increased.';
  }
  return requirement.minimumCopy;
}

export function dbGetGameStats(goalId: string): GameStats | null {
  const goal = getGoalsStore().find((candidate) => candidate.id === goalId);
  if (!goal) return null;
  const targetXp = computeTargetXp(goal);
  const dailyRequirement = getDailyRequirement(goal);
  const rows = load<DailyXpRow>(KEY_DAILY_XP)
    .filter((row) => row.goalId === goalId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  return {
    totalXp: goal.totalXp,
    currentStreak: goal.currentStreak,
    healthScore: goal.healthScore,
    targetXp,
    buildStage: calculateBuildPhase(goal.totalXp, targetXp),
    dailyExpectation: dailyRequirement.tasksRequired,
    difficultyPhase: dailyRequirement.phase,
    dailyRequirement,
    statusCopy: getStatusCopy(dailyRequirement, goal.performanceStatus),
    last7Days: rows,
  };
}

export function dbUpsertDailyXp(goalId: string, date: string): DailyXpRow | null {
  const goals = getGoalsStore();
  const goal = goals.find((candidate) => candidate.id === goalId);
  if (!goal) return null;
  const tasks = load<DailyTask>(KEY_TASKS).map(normalizeTask);
  const completedTasks = tasks.filter((task) => task.goalId === goalId && task.date === date && task.status === 'done');
  const xpEarned = completedTasks
    .reduce((sum, task) => sum + TIER_XP[task.tier ?? 2], 0);
  const expectation = getDailyRequirement(goal).tasksRequired;
  const met = isValidDay(goal, completedTasks);
  const rows = load<DailyXpRow>(KEY_DAILY_XP);
  const existing = rows.find((row) => row.goalId === goalId && row.date === date);
  const row: DailyXpRow = {
    id: existing?.id ?? generateId(),
    goalId,
    date,
    xpEarned,
    expectation,
    met,
  };
  const nextRows = existing
    ? rows.map((candidate) => (candidate.id === existing.id ? row : candidate))
    : [...rows, row];
  save(KEY_DAILY_XP, nextRows);

  const totalXp = nextRows
    .filter((candidate) => candidate.goalId === goalId)
    .reduce((sum, candidate) => sum + candidate.xpEarned, 0);
  const targetXp = computeTargetXp({ ...goal, totalXp, xpTotal: totalXp });
  const updatedGoal: Goal = {
    ...goal,
    totalXp,
    xpTotal: totalXp,
    currentPhase: calculateBuildPhase(totalXp, targetXp),
    difficultyPhase: goal.difficultyPhase,
    updatedAt: Date.now(),
  };
  const finalGoal = met ? updatedGoal : applyMissedDayPenalty(updatedGoal);
  if (!met && getDailyRequirement(goal).phase === 4) {
    assignRecoveryTask(goalId, date);
  }
  save(KEY_GOALS, goals.map((candidate) => (candidate.id === goalId ? finalGoal : candidate)));
  return row;
}

export function dbCalculateBuildPhase(goalId: string): 1 | 2 | 3 | 4 | 5 {
  const goal = getGoalsStore().find((candidate) => candidate.id === goalId);
  if (!goal) return 1;
  const phase = calculateBuildPhase(goal.totalXp, computeTargetXp(goal));
  save(KEY_GOALS, getGoalsStore().map((candidate) => (candidate.id === goalId ? { ...candidate, currentPhase: phase, updatedAt: Date.now() } : candidate)));
  return phase;
}

export function dbCalculateDifficultyPhase(goalId: string): DifficultyPhase {
  const goal = getGoalsStore().find((candidate) => candidate.id === goalId);
  if (!goal) return 1;
  return normalizeDifficultyPhase(goal.difficultyPhase);
}

export function dbCalculateGoalStatus(goalId: string): GoalPerformanceStatus {
  const goal = getGoalsStore().find((candidate) => candidate.id === goalId);
  if (!goal) return 'on_track';
  const status = calculateGoalStatus({
    xpTotal: goal.totalXp,
    xpTarget: computeTargetXp(goal),
    buildHealth: goal.buildHealth,
    lastCompletedDate: goal.lastCompletedDate,
    createdAt: goal.createdAt,
  });
  save(KEY_GOALS, getGoalsStore().map((candidate) => (candidate.id === goalId ? { ...candidate, performanceStatus: status, updatedAt: Date.now() } : candidate)));
  return status;
}

export function dbMaybeUpgradeDifficultyPhase(goalId: string): DifficultyPhase {
  const goals = getGoalsStore();
  const goal = goals.find((candidate) => candidate.id === goalId);
  if (!goal) return 1;
  const inspections = load<WeeklyInspection>(KEY_WEEKLY_INSPECTIONS)
    .filter((row) => row.goalId === goalId)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, 2);
  const nextGoal = maybeUpgradeDifficultyPhase(goal, inspections);
  if (nextGoal.difficultyPhase !== goal.difficultyPhase) {
    save(KEY_GOALS, goals.map((candidate) => (candidate.id === goalId ? { ...candidate, difficultyPhase: nextGoal.difficultyPhase, updatedAt: Date.now() } : candidate)));
  }
  return normalizeDifficultyPhase(nextGoal.difficultyPhase);
}

export function dbRecalcStreakAndHealth(goalId: string): boolean {
  const goals = getGoalsStore();
  const goal = goals.find((candidate) => candidate.id === goalId);
  if (!goal) return false;
  const rows = load<DailyXpRow>(KEY_DAILY_XP)
    .filter((row) => row.goalId === goalId)
    .sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  let prevDate: string | null = null;
  for (const row of rows) {
    if (!row.met) break;
    if (prevDate !== null) {
      const diff = (new Date(prevDate).getTime() - new Date(row.date).getTime()) / MS_PER_DAY;
      if (diff > 1) break;
    }
    streak++;
    prevDate = row.date;
  }
  let health = 100;
  const requirement = getDailyRequirement(goal);
  for (let i = rows.length - 1; i >= 0; i--) {
    health = rows[i].met ? Math.min(100, health + 2) : Math.max(0, health - requirement.missPenalty);
  }
  const lastCompletedDate = streak > 0 ? rows[0]?.date ?? '' : '';
  const targetXp = computeTargetXp(goal);
  const upgradedGoal = maybeUpgradeDifficultyPhase(goal);
  const repeatedPhase3Miss = requirement.phase === 3 && rows[0]?.met === false && rows[1]?.met === false;
  const performanceStatus =
    (requirement.phase === 4 && rows[0]?.met === false) || repeatedPhase3Miss
      ? 'decaying'
      : calculateGoalStatus({
          xpTotal: goal.totalXp,
          xpTarget: targetXp,
          buildHealth: health,
          lastCompletedDate,
          createdAt: goal.createdAt,
        });
  save(
    KEY_GOALS,
    goals.map((candidate) =>
      candidate.id === goalId
        ? {
            ...candidate,
            currentStreak: streak,
            streakCount: streak,
            streakDate: rows[0]?.date ?? '',
            healthScore: health,
            buildHealth: health,
            difficultyPhase: upgradedGoal.difficultyPhase,
            lastCompletedDate,
            performanceStatus,
            updatedAt: Date.now(),
          }
        : candidate
    )
  );
  return true;
}

// ─── Focus session functions ─────────────────────────────────────────────────

function getSessionDurationSeconds(startedAt: number, endedAt: number): number {
  return Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}

function saveFocusSessions(sessions: FocusSession[]): void {
  save(KEY_FOCUS_SESSIONS, sessions);
}

export function dbGetFocusSessionById(id: string): FocusSession | null {
  return load<FocusSession>(KEY_FOCUS_SESSIONS).find((session) => session.id === id) ?? null;
}

export function dbGetActiveFocusSession(): FocusSession | null {
  return (
    load<FocusSession>(KEY_FOCUS_SESSIONS)
      .filter((session) => session.status === 'active')
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  );
}

export function dbGetActiveFocusSessionForTask(taskId: string): FocusSession | null {
  return (
    load<FocusSession>(KEY_FOCUS_SESSIONS)
      .filter((session) => session.taskId === taskId && session.status === 'active')
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  );
}

export function dbGetMostRecentAbandonedFocusSession(taskId?: string): FocusSession | null {
  return (
    load<FocusSession>(KEY_FOCUS_SESSIONS)
      .filter((session) => session.status === 'abandoned' && (!taskId || session.taskId === taskId))
      .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))[0] ?? null
  );
}

export function dbStartFocusSession(taskId: string): FocusSession | null {
  const sessions = load<FocusSession>(KEY_FOCUS_SESSIONS);
  const active = [...sessions]
    .filter((session) => session.status === 'active')
    .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;

  if (active?.taskId === taskId) {
    return active;
  }

  const now = Date.now();
  const nextSessions = sessions.map((session) => {
    if (session.id !== active?.id) {
      return session;
    }

    return {
      ...session,
      endedAt: now,
      durationSeconds: getSessionDurationSeconds(session.startedAt, now),
      status: 'abandoned' as const,
      exitReason: 'switched_task' as const,
      lastHeartbeatAt: now,
    };
  });

  const created: FocusSession = {
    id: generateId(),
    taskId,
    startedAt: now,
    endedAt: null,
    durationSeconds: 0,
    status: 'active',
    exitReason: null,
    lastHeartbeatAt: now,
  };

  saveFocusSessions([...nextSessions, created]);
  webRefreshResumeContext();
  return created;
}

export function dbTouchFocusSession(id: string): boolean {
  const sessions = load<FocusSession>(KEY_FOCUS_SESSIONS);
  saveFocusSessions(
    sessions.map((session) =>
      session.id === id && session.status === 'active'
        ? { ...session, lastHeartbeatAt: Date.now() }
        : session
    )
  );
  return true;
}

export function dbCompleteFocusSession(id: string): FocusSession | null {
  const sessions = load<FocusSession>(KEY_FOCUS_SESSIONS);
  const existing = sessions.find((session) => session.id === id);
  if (!existing) {
    return null;
  }

  const endedAt = Date.now();
  const next = {
    ...existing,
    endedAt,
    durationSeconds: getSessionDurationSeconds(existing.startedAt, endedAt),
    status: 'completed' as const,
    exitReason: null,
    lastHeartbeatAt: endedAt,
  };

  saveFocusSessions(sessions.map((session) => (session.id === id ? next : session)));
  webRefreshResumeContext();
  return next;
}

export function dbAbandonFocusSession(
  id: string,
  reason: Exclude<FocusExitReason, 'switched_task'>
): FocusSession | null {
  const sessions = load<FocusSession>(KEY_FOCUS_SESSIONS);
  const existing = sessions.find((session) => session.id === id);
  if (!existing) {
    return null;
  }

  const endedAt = Date.now();
  const next = {
    ...existing,
    endedAt,
    durationSeconds: getSessionDurationSeconds(existing.startedAt, endedAt),
    status: 'abandoned' as const,
    exitReason: reason,
    lastHeartbeatAt: endedAt,
  };

  saveFocusSessions(sessions.map((session) => (session.id === id ? next : session)));
  webRefreshResumeContext();
  return next;
}

export function dbGetFocusSessionsForTask(taskId: string): FocusSession[] {
  return load<FocusSession>(KEY_FOCUS_SESSIONS)
    .filter((session) => session.taskId === taskId)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function dbGetFocusSessionsForWeek(weekOf: string): FocusSession[] {
  const [year, month, day] = weekOf.split('-').map(Number);
  const start = new Date(year, month - 1, day).getTime();
  const end = new Date(year, month - 1, day + 7).getTime();
  return load<FocusSession>(KEY_FOCUS_SESSIONS)
    .filter((session) => session.startedAt >= start && session.startedAt < end)
    .sort((a, b) => b.startedAt - a.startedAt);
}

// ─── Review functions ─────────────────────────────────────────────────────────

export function dbGetReviewForWeek(weekOf: string): WeeklyReview | null {
  return load<WeeklyReview>(KEY_REVIEWS).find((r) => r.weekOf === weekOf) ?? null;
}

export function dbSaveReview(
  weekOf: string,
  wins: string,
  whatDrifted: string,
  driftReasons: string[],
  nextWeekAdjustment: string
): WeeklyReview | null {
  const reviews = load<WeeklyReview>(KEY_REVIEWS);
  const now = Date.now();
  const existing = reviews.find((r) => r.weekOf === weekOf);
  let result: WeeklyReview;
  if (existing) {
    result = { ...existing, wins, whatDrifted, driftReasons, nextWeekAdjustment, completedAt: now };
    save(KEY_REVIEWS, reviews.map((r) => (r.weekOf === weekOf ? result : r)));
  } else {
    result = { id: generateId(), weekOf, completedAt: now, wins, whatDrifted, driftReasons, nextWeekAdjustment };
    save(KEY_REVIEWS, [...reviews, result]);
  }
  return result;
}

export function dbIsReviewDue(): boolean {
  const today = new Date();
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 0 || dayOfWeek > 4) return false;
  const lastWeekOf = getPrevWeekStart();
  return dbGetReviewForWeek(lastWeekOf) === null;
}

export function dbGetTasksForWeek(weekOf: string): DailyTask[] {
  const [year, month, day] = weekOf.split('-').map(Number);
  const result: DailyTask[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(year, month - 1, day + i);
    result.push(...dbGetTasksForDate(formatDate(d)));
  }
  return result;
}

// ─── Context functions ────────────────────────────────────────────────────────

export function dbGetContext(key: string): string | null {
  return ctxGet(key);
}

export function dbSetContext(key: string, value: string): boolean {
  ctxSet(key, value);
  return true;
}

export function dbRemoveContext(key: string): boolean {
  ctxRemove(key);
  return true;
}

export function dbGetResumeContext(): ResumeContext | null {
  const raw = ctxGet(RESUME_CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ResumeContext;
  } catch {
    ctxRemove(RESUME_CONTEXT_KEY);
    return null;
  }
}

export function dbDismissResumeContext(resumeContext: ResumeContext): boolean {
  const key =
    resumeContext.kind === 'focus-session'
      ? `focus-session:${resumeContext.focusSessionId}`
      : `carry-forward:${resumeContext.taskId}`;
  ctxSet(DISMISSED_RESUME_TASK_ID_KEY, key);
  ctxRemove(RESUME_CONTEXT_KEY);
  return true;
}

export function dbRefreshResumeContext(): ResumeContext | null {
  return webRefreshResumeContext();
}

// ─── Onboarding functions ─────────────────────────────────────────────────────

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
const ONBOARDING_DRAFT_KEY = 'onboarding_draft';

export function dbIsOnboardingComplete(): boolean {
  if (ctxGet(ONBOARDING_COMPLETE_KEY) === '1') return true;
  // Also true if any goal exists (migrated user)
  return load<Goal>(KEY_GOALS).some((goal) => goal.id !== STANDALONE_TASKS_GOAL_ID);
}

export function dbGetOnboardingDraft(): import('../types').OnboardingDraft | null {
  const raw = ctxGet(ONBOARDING_DRAFT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { ctxRemove(ONBOARDING_DRAFT_KEY); return null; }
}

export function dbSaveOnboardingDraft(draft: import('../types').OnboardingDraft): boolean {
  ctxSet(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  return true;
}

export function dbClearOnboardingDraft(): boolean {
  ctxRemove(ONBOARDING_DRAFT_KEY);
  return true;
}

export function dbCompleteOnboarding(
  draft: import('../types').OnboardingDraft
): { goal: Goal | null; weeklyFocusId: string | null } {
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
    importance: draft.importance,
    urgency: draft.urgency,
    payoff: draft.payoff,
    whyNow: draft.whyNow,
  }, { status: 'active' });
  if (!goal) return { goal: null, weeklyFocusId: null };
  if (draft.weeklyFocus.trim()) dbUpsertWeeklyFocus(goal.id, draft.weeklyFocus.trim());
  if (draft.draftSteps?.length) dbSetMilestonesForGoal(goal.id, draft.draftSteps);
  ctxSet(ONBOARDING_COMPLETE_KEY, '1');
  ctxRemove(ONBOARDING_DRAFT_KEY);
  return { goal, weeklyFocusId: dbGetCurrentWeeklyFocus(goal.id)?.id ?? null };
}

// ─── Project functions ────────────────────────────────────────────────────────

export function dbGetProjects(goalId: string | null): Project[] {
  return load<Project>(KEY_PROJECTS)
    .filter((p) => (p.goalId ?? null) === goalId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function dbGetOrphanProjects(): Project[] {
  return load<Project>(KEY_PROJECTS)
    .filter((p) => !p.goalId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function dbCreateProject(goalId: string | null, name: string, color: string): Project {
  const projects = load<Project>(KEY_PROJECTS);
  const sameScope = projects.filter((p) => (p.goalId ?? null) === (goalId ?? null));
  const project: Project = {
    id: generateId(),
    goalId: goalId ?? null,
    name: name.trim(),
    color,
    sortOrder: sameScope.length,
    createdAt: Date.now(),
  };
  save(KEY_PROJECTS, [...projects, project]);
  return project;
}

export function dbSetProjectGoal(id: string, goalId: string | null): boolean {
  const projects = load<Project>(KEY_PROJECTS);
  save(KEY_PROJECTS, projects.map((p) => (p.id === id ? { ...p, goalId: goalId ?? null } : p)));
  return true;
}

export function dbUpdateProject(id: string, name: string, color: string): boolean {
  const projects = load<Project>(KEY_PROJECTS);
  save(KEY_PROJECTS, projects.map((p) => (p.id === id ? { ...p, name: name.trim(), color } : p)));
  return true;
}

export function dbDeleteProject(id: string): boolean {
  const projects = load<Project>(KEY_PROJECTS);
  save(KEY_PROJECTS, projects.filter((p) => p.id !== id));
  // Unlink tasks from deleted project
  const tasks = load<DailyTask>(KEY_TASKS).map(normalizeTask);
  save(KEY_TASKS, tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)));
  return true;
}

// ─── Daily review functions ───────────────────────────────────────────────────

export function dbGetDailyReview(date: string): DailyReview | null {
  return load<DailyReview>(KEY_DAILY_REVIEWS).find((r) => r.date === date) ?? null;
}

export function dbSaveDailyReview(
  date: string,
  wins: string,
  drift: string,
  tomorrowStep: string
): DailyReview {
  const reviews = load<DailyReview>(KEY_DAILY_REVIEWS);
  const now = Date.now();
  const existing = reviews.find((r) => r.date === date);
  let result: DailyReview;
  if (existing) {
    result = { ...existing, wins, drift, tomorrowStep, completedAt: now };
    save(KEY_DAILY_REVIEWS, reviews.map((r) => (r.date === date ? result : r)));
  } else {
    result = { id: generateId(), date, wins, drift, tomorrowStep, completedAt: now };
    save(KEY_DAILY_REVIEWS, [...reviews, result]);
  }
  return result;
}

export function dbIsDailyReviewDue(): boolean {
  const today = todayString();
  return dbGetDailyReview(today) === null;
}

// ─── Brain dump functions ─────────────────────────────────────────────────────

export function dbGetBrainDumpItems(): BrainDumpItem[] {
  return load<BrainDumpItem>(KEY_BRAIN_DUMP).sort((a, b) => b.createdAt - a.createdAt);
}

export function dbAddBrainDumpItem(text: string): BrainDumpItem {
  const items = load<BrainDumpItem>(KEY_BRAIN_DUMP);
  const item: BrainDumpItem = { id: generateId(), text: text.trim(), createdAt: Date.now() };
  save(KEY_BRAIN_DUMP, [...items, item]);
  return item;
}

export function dbDeleteBrainDumpItem(id: string): boolean {
  save(KEY_BRAIN_DUMP, load<BrainDumpItem>(KEY_BRAIN_DUMP).filter((i) => i.id !== id));
  return true;
}

export function dbUpdateBrainDumpItem(id: string, text: string): boolean {
  save(KEY_BRAIN_DUMP, load<BrainDumpItem>(KEY_BRAIN_DUMP).map((i) => i.id === id ? { ...i, text: text.trim() } : i));
  return true;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function webRefreshResumeContext(): ResumeContext | null {
  const tasks = load<DailyTask>(KEY_TASKS).map(normalizeTask);
  const sessions = load<FocusSession>(KEY_FOCUS_SESSIONS);
  const dismissedKey = ctxGet(DISMISSED_RESUME_TASK_ID_KEY);
  const today = todayString();
  const dismissedFocusSessionId = dismissedKey?.startsWith('focus-session:')
    ? dismissedKey.slice('focus-session:'.length)
    : null;
  const dismissedTaskId = dismissedKey?.startsWith('carry-forward:')
    ? dismissedKey.slice('carry-forward:'.length)
    : null;

  const activeFocusSession = sessions
    .filter((session) => session.status === 'active' && session.id !== dismissedFocusSessionId)
    .sort((a, b) => b.lastHeartbeatAt - a.lastHeartbeatAt || b.startedAt - a.startedAt)
    .find((session) => tasks.some((task) => task.id === session.taskId && task.status === 'pending'))
    ?? null;

  if (activeFocusSession) {
    const task = tasks.find((candidate) => candidate.id === activeFocusSession.taskId)!;
    const ctx: ResumeContext = {
      kind: 'focus-session',
      taskId: task.id,
      taskTitle: task.title,
      goalId: task.goalId,
      weeklyFocusId: task.weeklyFocusId,
      focusSessionId: activeFocusSession.id,
      startedAt: activeFocusSession.startedAt,
      lastHeartbeatAt: activeFocusSession.lastHeartbeatAt,
      sessionStatus: 'active',
      exitReason: activeFocusSession.exitReason,
    };
    ctxSet(RESUME_CONTEXT_KEY, JSON.stringify(ctx));
    return ctx;
  }

  const recentAbandonedFocusSession = sessions
    .filter(
      (session) =>
        session.status === 'abandoned' &&
        session.id !== dismissedFocusSessionId &&
        (session.endedAt ?? session.startedAt) >= Date.now() - FOCUS_RESUME_WINDOW_MS
    )
    .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
    .find((session) => tasks.some((task) => task.id === session.taskId && task.status === 'pending'))
    ?? null;

  if (recentAbandonedFocusSession) {
    const task = tasks.find((candidate) => candidate.id === recentAbandonedFocusSession.taskId)!;
    const ctx: ResumeContext = {
      kind: 'focus-session',
      taskId: task.id,
      taskTitle: task.title,
      goalId: task.goalId,
      weeklyFocusId: task.weeklyFocusId,
      focusSessionId: recentAbandonedFocusSession.id,
      startedAt: recentAbandonedFocusSession.startedAt,
      lastHeartbeatAt: recentAbandonedFocusSession.lastHeartbeatAt,
      sessionStatus: 'abandoned',
      exitReason: recentAbandonedFocusSession.exitReason,
    };
    ctxSet(RESUME_CONTEXT_KEY, JSON.stringify(ctx));
    return ctx;
  }

  // Find oldest uncarried pending task from the past 7 days (not today)
  const cutoffDate = formatDate((() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })());

  const candidate = tasks
    .filter((t) => {
      if (t.status !== 'pending') return false;
      if (t.date >= today) return false;
      if (t.date < cutoffDate) return false;
      if (t.id === dismissedTaskId) return false;
      // Skip if already carried forward
      const isCarried = tasks.some((c) => c.sourceTaskId === t.id);
      if (isCarried) return false;
      return true;
    })
    .sort((a, b) => {
      // Prefer yesterday, then older
      const yesterday = formatDate((() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })());
      if (a.date === yesterday && b.date !== yesterday) return -1;
      if (b.date === yesterday && a.date !== yesterday) return 1;
      return b.date.localeCompare(a.date);
    })[0] ?? null;

  if (candidate) {
    const ctx: ResumeContext = {
      kind: 'carry-forward',
      taskId: candidate.id,
      taskTitle: candidate.title,
      fromDate: candidate.date,
      goalId: candidate.goalId,
      weeklyFocusId: candidate.weeklyFocusId,
    };
    ctxSet(RESUME_CONTEXT_KEY, JSON.stringify(ctx));
    return ctx;
  }

  ctxRemove(RESUME_CONTEXT_KEY);
  return null;
}

// ─── Visions ──────────────────────────────────────────────────────────────────

export function dbGetVisions(): Vision[] {
  return load<Vision>(KEY_VISIONS)
    .filter((v) => v.status !== 'archived')
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export function dbGetVisionById(id: string): Vision | null {
  return load<Vision>(KEY_VISIONS).find((v) => v.id === id) ?? null;
}

export function dbCreateVision(input: VisionWriteInput): Vision {
  const visions = load<Vision>(KEY_VISIONS);
  const vision: Vision = {
    id: generateId(),
    title: cleanText(input.title),
    description: cleanText(input.description),
    identityStatement: cleanText(input.identityStatement),
    color: input.color || '#3B5BDB',
    sortOrder: visions.length,
    status: 'active',
    createdAt: Date.now(),
  };
  save(KEY_VISIONS, [...visions, vision]);
  return vision;
}

export function dbUpdateVision(id: string, input: VisionWriteInput): boolean {
  const visions = load<Vision>(KEY_VISIONS);
  save(
    KEY_VISIONS,
    visions.map((v) =>
      v.id === id
        ? {
            ...v,
            title: cleanText(input.title) || v.title,
            description: cleanText(input.description),
            identityStatement: cleanText(input.identityStatement),
            color: input.color || v.color,
          }
        : v
    )
  );
  return true;
}

export function dbArchiveVision(id: string): boolean {
  const visions = load<Vision>(KEY_VISIONS);
  save(KEY_VISIONS, visions.map((v) => (v.id === id ? { ...v, status: 'archived' as const } : v)));
  // Unlink goals/habits
  const goals = getGoalsStore();
  save(KEY_GOALS, goals.map((g) => (g.visionId === id ? { ...g, visionId: null } : g)));
  const habits = load<Habit>(KEY_HABITS);
  save(KEY_HABITS, habits.map((h) => (h.visionId === id ? { ...h, visionId: null } : h)));
  return true;
}

// ─── Habits ───────────────────────────────────────────────────────────────────

function normalizeHabit(h: Habit | (Partial<Habit> & { id: string; title: string; startedAt: number })): Habit {
  return {
    id: h.id,
    title: cleanText(h.title),
    cue: cleanText((h as Habit).cue),
    cueType: ((h as Habit).cueType as Habit['cueType']) || 'time',
    stackAnchorHabitId: (h as Habit).stackAnchorHabitId ?? null,
    identityStatement: cleanText((h as Habit).identityStatement),
    cadenceType: ((h as Habit).cadenceType as Habit['cadenceType']) || 'daily',
    cadenceTarget: (h as Habit).cadenceTarget ?? 7,
    cadenceDays: Array.isArray((h as Habit).cadenceDays) ? (h as Habit).cadenceDays! : [],
    goalId: (h as Habit).goalId ?? null,
    visionId: (h as Habit).visionId ?? null,
    status: ((h as Habit).status as Habit['status']) || 'learning',
    startedAt: h.startedAt ?? Date.now(),
    graduatedAt: (h as Habit).graduatedAt ?? null,
    sortOrder: (h as Habit).sortOrder ?? 0,
  };
}

export function dbGetHabits(options?: { includeGraduated?: boolean; goalId?: string | null }): Habit[] {
  const includeGrad = options?.includeGraduated ?? false;
  return load<Habit>(KEY_HABITS)
    .map(normalizeHabit)
    .filter((h) => (includeGrad ? true : h.status !== 'graduated'))
    .filter((h) => (options?.goalId === undefined ? true : (h.goalId ?? null) === (options.goalId ?? null)))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.startedAt - b.startedAt);
}

export function dbGetHabitById(id: string): Habit | null {
  const h = load<Habit>(KEY_HABITS).find((x) => x.id === id);
  return h ? normalizeHabit(h) : null;
}

export function dbCreateHabit(input: HabitWriteInput): Habit {
  const habits = load<Habit>(KEY_HABITS);
  const habit: Habit = normalizeHabit({
    id: generateId(),
    title: cleanText(input.title),
    cue: cleanText(input.cue),
    cueType: input.cueType ?? 'time',
    stackAnchorHabitId: input.stackAnchorHabitId ?? null,
    identityStatement: cleanText(input.identityStatement),
    cadenceType: input.cadenceType ?? 'daily',
    cadenceTarget: input.cadenceTarget ?? 7,
    cadenceDays: input.cadenceDays ?? [],
    goalId: input.goalId ?? null,
    visionId: input.visionId ?? null,
    status: 'learning',
    startedAt: Date.now(),
    graduatedAt: null,
    sortOrder: habits.length,
  });
  save(KEY_HABITS, [...habits, habit]);
  return habit;
}

export function dbUpdateHabit(id: string, input: HabitWriteInput): boolean {
  const habits = load<Habit>(KEY_HABITS);
  save(
    KEY_HABITS,
    habits.map((h) =>
      h.id === id
        ? normalizeHabit({
            ...h,
            title: cleanText(input.title) || h.title,
            cue: cleanText(input.cue),
            cueType: input.cueType ?? h.cueType,
            stackAnchorHabitId: input.stackAnchorHabitId === undefined ? h.stackAnchorHabitId : input.stackAnchorHabitId,
            identityStatement: cleanText(input.identityStatement),
            cadenceType: input.cadenceType ?? h.cadenceType,
            cadenceTarget: input.cadenceTarget ?? h.cadenceTarget,
            cadenceDays: input.cadenceDays ?? h.cadenceDays,
            goalId: input.goalId === undefined ? h.goalId : input.goalId,
            visionId: input.visionId === undefined ? h.visionId : input.visionId,
          })
        : h
    )
  );
  return true;
}

export function dbSetHabitStatus(id: string, status: Habit['status']): boolean {
  const habits = load<Habit>(KEY_HABITS);
  save(
    KEY_HABITS,
    habits.map((h) =>
      h.id === id
        ? {
            ...h,
            status,
            graduatedAt: status === 'graduated' ? Date.now() : h.graduatedAt ?? null,
          }
        : h
    )
  );
  return true;
}

export function dbDeleteHabit(id: string): boolean {
  save(
    KEY_HABITS,
    load<Habit>(KEY_HABITS).filter((h) => h.id !== id)
  );
  save(
    KEY_HABIT_COMPLETIONS,
    load<HabitCompletion>(KEY_HABIT_COMPLETIONS).filter((c) => c.habitId !== id)
  );
  return true;
}

export function dbLogHabitCompletion(
  habitId: string,
  date: string,
  status: HabitCompletionStatus
): HabitCompletion {
  const completions = load<HabitCompletion>(KEY_HABIT_COMPLETIONS);
  const existing = completions.find((c) => c.habitId === habitId && c.date === date);
  if (existing) {
    const updated: HabitCompletion = { ...existing, status, completedAt: Date.now() };
    save(KEY_HABIT_COMPLETIONS, completions.map((c) => (c.id === existing.id ? updated : c)));
    return updated;
  }
  const completion: HabitCompletion = {
    id: generateId(),
    habitId,
    date,
    status,
    completedAt: Date.now(),
  };
  save(KEY_HABIT_COMPLETIONS, [...completions, completion]);
  return completion;
}

export function dbClearHabitCompletion(habitId: string, date: string): boolean {
  const completions = load<HabitCompletion>(KEY_HABIT_COMPLETIONS);
  save(
    KEY_HABIT_COMPLETIONS,
    completions.filter((c) => !(c.habitId === habitId && c.date === date))
  );
  return true;
}

export function dbGetHabitCompletions(habitId: string): HabitCompletion[] {
  return load<HabitCompletion>(KEY_HABIT_COMPLETIONS)
    .filter((c) => c.habitId === habitId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Habit cadence + streak logic ─────────────────────────────────────────────

function shiftDate(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return formatDate(dt);
}

function dayOfWeek(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
}

export function isHabitScheduledOn(habit: Habit, ymd: string): boolean {
  const dow = dayOfWeek(ymd);
  switch (habit.cadenceType) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'custom_days':
      return habit.cadenceDays.includes(dow);
    case 'n_per_week':
      // n_per_week is adherence-target based, not day-scheduled; treat all days as schedulable
      return true;
    default:
      return true;
  }
}

// ADHD-aware streak: count consecutive scheduled days done, up to today.
// One-miss forgiveness: a single missed day bracketed by done days doesn't reset.
export function computeHabitStreak(habit: Habit, completions: HabitCompletion[], today: string): number {
  const byDate = new Map(completions.map((c) => [c.date, c.status] as const));
  let streak = 0;
  let forgiveness = 1; // one miss allowed
  let cursor = today;
  // walk backwards up to a safety bound
  for (let i = 0; i < 365; i++) {
    if (!isHabitScheduledOn(habit, cursor)) {
      cursor = shiftDate(cursor, -1);
      continue;
    }
    const status = byDate.get(cursor);
    if (status === 'done') {
      streak += 1;
    } else if (status === 'skipped') {
      // intentional skip — neutral, neither extends nor breaks
    } else {
      // missed or unlogged
      if (cursor === today) {
        // today unlogged — don't break the streak yet
      } else if (forgiveness > 0) {
        forgiveness -= 1;
      } else {
        break;
      }
    }
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

export function dbGetTodayHabits(today: string = todayString()): HabitTodayView[] {
  const habits = dbGetHabits();
  const allCompletions = load<HabitCompletion>(KEY_HABIT_COMPLETIONS);
  return habits.map((habit) => {
    const completions = allCompletions.filter((c) => c.habitId === habit.id);
    const todayStatus = completions.find((c) => c.date === today)?.status ?? null;
    const streak = computeHabitStreak(habit, completions, today);
    const scheduledToday = isHabitScheduledOn(habit, today);

    const recentDots: Array<'done' | 'miss' | 'skip' | 'off'> = [];
    for (let i = 6; i >= 0; i--) {
      const d = shiftDate(today, -i);
      if (!isHabitScheduledOn(habit, d)) {
        recentDots.push('off');
        continue;
      }
      const s = completions.find((c) => c.date === d)?.status;
      if (s === 'done') recentDots.push('done');
      else if (s === 'skipped') recentDots.push('skip');
      else recentDots.push('miss');
    }

    // 30-day adherence over scheduled days only
    let scheduled = 0;
    let done = 0;
    for (let i = 0; i < 30; i++) {
      const d = shiftDate(today, -i);
      if (!isHabitScheduledOn(habit, d)) continue;
      scheduled += 1;
      if (completions.find((c) => c.date === d)?.status === 'done') done += 1;
    }
    const adherencePct = scheduled > 0 ? done / scheduled : 0;

    return { habit, todayStatus, streak, recentDots, scheduledToday, adherencePct };
  });
}

// ─── Milestones ──────────────────────────────────────────────────────────────

export function dbGetMilestones(goalId: string): Milestone[] {
  return load<Milestone>(KEY_MILESTONES)
    .filter((m) => m.goalId === goalId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function dbCreateMilestone(goalId: string, title: string): Milestone | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const all = load<Milestone>(KEY_MILESTONES);
  const existing = all.filter((m) => m.goalId === goalId);
  const sortOrder = existing.length > 0 ? Math.max(...existing.map((m) => m.sortOrder)) + 1 : 0;
  const milestone: Milestone = {
    id: generateId(),
    goalId,
    title: trimmed,
    targetMetric: '',
    sortOrder,
    completedAt: null,
    createdAt: Date.now(),
  };
  save(KEY_MILESTONES, [...all, milestone]);
  return milestone;
}

export function dbToggleMilestone(id: string): void {
  const all = load<Milestone>(KEY_MILESTONES);
  save(
    KEY_MILESTONES,
    all.map((m) => (m.id === id ? { ...m, completedAt: m.completedAt ? null : Date.now() } : m))
  );
}

export function dbDeleteMilestone(id: string): void {
  save(KEY_MILESTONES, load<Milestone>(KEY_MILESTONES).filter((m) => m.id !== id));
}

export function dbSetMilestonesForGoal(goalId: string, titles: string[]): void {
  const others = load<Milestone>(KEY_MILESTONES).filter((m) => m.goalId !== goalId);
  const now = Date.now();
  const fresh: Milestone[] = titles
    .map((t) => t.trim())
    .filter(Boolean)
    .map((title, i) => ({
      id: generateId(),
      goalId,
      title,
      targetMetric: '',
      sortOrder: i,
      completedAt: null,
      createdAt: now,
    }));
  save(KEY_MILESTONES, [...others, ...fresh]);
}
