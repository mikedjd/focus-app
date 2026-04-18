/**
 * Web storage layer — mirrors the SQLite DB layer exactly, using localStorage.
 * All data lives in the browser under keys prefixed with `adhd_`.
 * Used automatically on Platform.OS === 'web' via src/db/index.ts.
 */

import type {
  DailyTask,
  Goal,
  GoalWriteInput,
  ResumeContext,
  WeeklyFocus,
  WeeklyReview,
  TaskWriteResult,
} from '../types';
import { formatDate, getPrevWeekStart, getWeekStart, todayString } from '../utils/dates';
import { generateAnchorLines } from '../utils/goalAnchors';
import { generateId } from '../utils/ids';

// ─── Storage keys ────────────────────────────────────────────────────────────

const KEY_GOALS = 'adhd_goals';
const KEY_TASKS = 'adhd_tasks';
const KEY_FOCUSES = 'adhd_focuses';
const KEY_REVIEWS = 'adhd_reviews';
const KEY_CTX_PREFIX = 'adhd_ctx_';

const DAILY_TASK_CAP = 3;
const RESUME_CONTEXT_KEY = 'resume_context';
const DISMISSED_RESUME_TASK_ID_KEY = 'dismissed_resume_task_id';

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
  };
}

// ─── Goal functions ───────────────────────────────────────────────────────────

export function dbGetActiveGoal(): Goal | null {
  const goals = load<Goal>(KEY_GOALS);
  return goals.filter((g) => g.status === 'active').sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

export function dbCreateGoal(input: GoalWriteInput): Goal | null {
  const goals = load<Goal>(KEY_GOALS);
  // Archive any existing active goal
  const updated = goals.map((g) => (g.status === 'active' ? { ...g, status: 'archived' as const } : g));
  const n = normalizeGoalInput(input);
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
    createdAt: Date.now(),
    status: 'active',
  };
  save(KEY_GOALS, [...updated, goal]);
  return goal;
}

export function dbUpdateGoal(id: string, input: GoalWriteInput): boolean {
  const goals = load<Goal>(KEY_GOALS);
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
        }
      : g
  );
  save(KEY_GOALS, updated);
  return true;
}

export function dbCompleteGoal(id: string): boolean {
  const goals = load<Goal>(KEY_GOALS);
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
  options?: { date?: string; sourceTaskId?: string | null }
): TaskWriteResult {
  if (!goalId) return { ok: false, reason: 'missing_goal' };
  const tasks = load<DailyTask>(KEY_TASKS);
  const targetDate = options?.date ?? todayString();
  if (targetDate === todayString() && getActiveTasks(tasks, targetDate).length >= DAILY_TASK_CAP) {
    return { ok: false, reason: 'task_limit_reached' };
  }
  const task: DailyTask = {
    id: generateId(),
    goalId,
    weeklyFocusId: weeklyFocusId ?? null,
    sourceTaskId: options?.sourceTaskId ?? null,
    title,
    date: targetDate,
    status: 'pending',
    completedAt: null,
    sortOrder: getActiveTasks(tasks, targetDate).length,
    createdAt: Date.now(),
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
    weeklyFocusId: source.weeklyFocusId,
    sourceTaskId: source.id,
    title: source.title,
    date: targetDate,
    status: 'pending',
    completedAt: null,
    sortOrder: getActiveTasks(tasks, targetDate).length,
    createdAt: Date.now(),
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

export function dbDismissResumeContext(taskId: string): boolean {
  ctxSet(DISMISSED_RESUME_TASK_ID_KEY, taskId);
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
  });
  if (!goal) return { goal: null, weeklyFocusId: null };
  if (draft.weeklyFocus.trim()) dbUpsertWeeklyFocus(goal.id, draft.weeklyFocus.trim());
  ctxSet(ONBOARDING_COMPLETE_KEY, '1');
  ctxRemove(ONBOARDING_DRAFT_KEY);
  return { goal, weeklyFocusId: dbGetCurrentWeeklyFocus(goal.id)?.id ?? null };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function webRefreshResumeContext(): ResumeContext | null {
  const tasks = load<DailyTask>(KEY_TASKS);
  const dismissedId = ctxGet(DISMISSED_RESUME_TASK_ID_KEY);
  const today = todayString();

  // Find oldest uncarried pending task from the past 7 days (not today)
  const cutoffDate = formatDate((() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })());

  const candidate = tasks
    .filter((t) => {
      if (t.status !== 'pending') return false;
      if (t.date >= today) return false;
      if (t.date < cutoffDate) return false;
      if (t.id === dismissedId) return false;
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
