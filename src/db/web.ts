/**
 * Web storage layer — mirrors the SQLite DB layer exactly, using localStorage.
 * All data lives in the browser under keys prefixed with `adhd_`.
 * Used automatically on Platform.OS === 'web' via src/db/index.ts.
 */

import type {
  BrainDumpItem,
  DailyReview,
  DailyTask,
  FocusExitReason,
  FocusSession,
  Goal,
  GoalStatus,
  GoalWriteInput,
  Project,
  ResumeContext,
  TaskWriteResult,
  WeeklyFocus,
  WeeklyReview,
} from '../types';
import { formatDate, getPrevWeekStart, getWeekStart, todayString } from '../utils/dates';
import { generateAnchorLines } from '../utils/goalAnchors';
import { generateId } from '../utils/ids';

// ─── Storage keys ────────────────────────────────────────────────────────────

const KEY_GOALS = 'adhd_goals';
const KEY_TASKS = 'adhd_tasks';
const KEY_FOCUSES = 'adhd_focuses';
const KEY_REVIEWS = 'adhd_reviews';
const KEY_DAILY_REVIEWS = 'adhd_daily_reviews';
const KEY_PROJECTS = 'adhd_projects';
const KEY_BRAIN_DUMP = 'adhd_brain_dump';
const KEY_FOCUS_SESSIONS = 'adhd_focus_sessions';
const KEY_CTX_PREFIX = 'adhd_ctx_';

const DAILY_TASK_CAP = 3;
const RESUME_CONTEXT_KEY = 'resume_context';
const DISMISSED_RESUME_TASK_ID_KEY = 'dismissed_resume_task_id';
const FOCUS_RESUME_WINDOW_MS = 36 * 60 * 60 * 1000;
const GOAL_STATUS_ORDER: GoalStatus[] = ['active', 'queued', 'parked', 'completed'];

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
  };
}

function normalizeStoredGoal(goal: Goal | (Partial<Goal> & { id: string; title: string; createdAt: number })): Goal {
  const status = goal.status === 'archived' ? 'parked' : goal.status;
  return {
    id: goal.id,
    title: cleanText(goal.title),
    targetOutcome: cleanText(goal.targetOutcome) || cleanText(goal.title),
    targetDate: cleanText(goal.targetDate) || null,
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
    createdAt: goal.createdAt,
    status:
      status === 'active' || status === 'queued' || status === 'parked' || status === 'completed'
        ? status
        : 'parked',
    currentFrictionMinutes: (goal as Goal).currentFrictionMinutes ?? 2,
    weeklySeatedSeconds: (goal as Goal).weeklySeatedSeconds ?? 0,
    weeklySeatedWeekOf: (goal as Goal).weeklySeatedWeekOf ?? '',
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

// ─── Goal functions ───────────────────────────────────────────────────────────

export function dbGetActiveGoal(): Goal | null {
  return getGoalsStore().find((goal) => goal.status === 'active') ?? null;
}

export function dbGetGoals(): Goal[] {
  return sortGoals(getGoalsStore());
}

export function dbCreateGoal(
  input: GoalWriteInput,
  options?: { status?: Exclude<GoalStatus, 'completed'> }
): Goal | null {
  const goals = getGoalsStore();
  const n = normalizeGoalInput(input);
  const nextStatus = options?.status ?? (goals.some((goal) => goal.status === 'active') ? 'parked' : 'active');
  const goal: Goal = {
    id: generateId(),
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
    createdAt: Date.now(),
    status: nextStatus,
    currentFrictionMinutes: 2,
    weeklySeatedSeconds: 0,
    weeklySeatedWeekOf: '',
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

export function dbGetTodayTasks(): DailyTask[] {
  return dbGetTasksForDate(todayString());
}

export function dbGetTasksForDate(date: string): DailyTask[] {
  return getActiveTasks(load<DailyTask>(KEY_TASKS), date);
}

export function dbGetTaskById(id: string): DailyTask | null {
  return load<DailyTask>(KEY_TASKS).find((t) => t.id === id) ?? null;
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
  }
): TaskWriteResult {
  if (!goalId) return { ok: false, reason: 'missing_goal' };
  const tasks = load<DailyTask>(KEY_TASKS);
  const targetDate = options?.date ?? todayString();
  const isToday = targetDate === todayString();
  if (isToday && getActiveTasks(tasks, targetDate).length >= DAILY_TASK_CAP) {
    return { ok: false, reason: 'task_limit_reached' };
  }
  const task: DailyTask = {
    id: generateId(),
    goalId,
    projectId: options?.projectId ?? null,
    weeklyFocusId: weeklyFocusId ?? null,
    sourceTaskId: options?.sourceTaskId ?? null,
    title,
    nextStep: cleanText(options?.nextStep),
    date: targetDate,
    status: 'pending',
    completedAt: null,
    sortOrder: getActiveTasks(tasks, targetDate).length,
    createdAt: Date.now(),
    taskType: options?.taskType ?? 'goal',
    effortLevel: options?.effortLevel ?? '',
    milestoneId: options?.milestoneId ?? null,
    scheduledWindowStart: options?.scheduledWindowStart ?? '',
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
    createdAt: Date.now(),
    taskType: source.taskType ?? 'goal',
    effortLevel: source.effortLevel ?? '',
    milestoneId: source.milestoneId ?? null,
    scheduledWindowStart: source.scheduledWindowStart ?? '',
  };
  save(KEY_TASKS, [...tasks, task]);
  webRefreshResumeContext();
  return { ok: true, task };
}

export function dbCompleteTask(id: string): boolean {
  const tasks = load<DailyTask>(KEY_TASKS);
  save(KEY_TASKS, tasks.map((t) => (t.id === id ? { ...t, status: 'done' as const, completedAt: Date.now() } : t)));
  webRefreshResumeContext();
  return true;
}

export function dbUncompleteTask(id: string): boolean {
  const tasks = load<DailyTask>(KEY_TASKS);
  save(KEY_TASKS, tasks.map((t) => (t.id === id ? { ...t, status: 'pending' as const, completedAt: null } : t)));
  webRefreshResumeContext();
  return true;
}

export function dbDropTask(id: string): boolean {
  const tasks = load<DailyTask>(KEY_TASKS);
  save(KEY_TASKS, tasks.map((t) => (t.id === id ? { ...t, status: 'dropped' as const } : t)));
  webRefreshResumeContext();
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
  return load<Goal>(KEY_GOALS).length > 0;
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
  ctxSet(ONBOARDING_COMPLETE_KEY, '1');
  ctxRemove(ONBOARDING_DRAFT_KEY);
  return { goal, weeklyFocusId: dbGetCurrentWeeklyFocus(goal.id)?.id ?? null };
}

// ─── Project functions ────────────────────────────────────────────────────────

export function dbGetProjects(goalId: string): Project[] {
  return load<Project>(KEY_PROJECTS)
    .filter((p) => p.goalId === goalId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function dbCreateProject(goalId: string, name: string, color: string): Project {
  const projects = load<Project>(KEY_PROJECTS);
  const goalProjects = projects.filter((p) => p.goalId === goalId);
  const project: Project = {
    id: generateId(),
    goalId,
    name: name.trim(),
    color,
    sortOrder: goalProjects.length,
    createdAt: Date.now(),
  };
  save(KEY_PROJECTS, [...projects, project]);
  return project;
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
  const tasks = load<DailyTask>(KEY_TASKS);
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
  const tasks = load<DailyTask>(KEY_TASKS);
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
