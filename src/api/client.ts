import { Platform } from 'react-native';
import type {
  BrainDumpItem,
  DailyReview,
  DailyTask,
  FocusExitReason,
  FocusSession,
  Goal,
  GoalWriteInput,
  OnboardingDraft,
  Project,
  ResumeContext,
  TaskWriteResult,
  WeeklyFocus,
  WeeklyReview,
} from '../types';
import * as webDb from '../db/web';

const IS_WEB = Platform.OS === 'web';

type RpcResponse<T> = { ok: true; data: T } | { ok: false; error: string };
const CHANNEL_NAME = 'adhd-focus-data';
let channel: BroadcastChannel | null = null;

function isRpcError<T>(payload: RpcResponse<T>): payload is { ok: false; error: string } {
  return payload.ok === false;
}

function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001`;
  }

  return 'http://localhost:3001';
}

export async function rpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}/api/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed with ${response.status}`);
  }

  const payload = (await response.json()) as RpcResponse<T>;
  if (isRpcError(payload)) {
    throw new Error(payload.error);
  }

  return payload.data;
}

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }

  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }

  return channel;
}

export function notifyDataChanged(): void {
  getChannel()?.postMessage({ type: 'changed', at: Date.now() });
}

export function subscribeToDataChanges(onChange: () => void): () => void {
  const activeChannel = getChannel();
  if (!activeChannel) {
    return () => {};
  }

  const handler = () => onChange();
  activeChannel.addEventListener('message', handler);
  return () => activeChannel.removeEventListener('message', handler);
}

export function getRpcEndpoint(): string {
  return `${getApiBaseUrl()}/api/rpc`;
}

export function sendRpcBeacon(method: string, params: Record<string, unknown> = {}): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }

  const blob = new Blob([JSON.stringify({ method, params })], {
    type: 'application/json',
  });
  return navigator.sendBeacon(getRpcEndpoint(), blob);
}

export async function getAppBootstrap(): Promise<{
  onboardingComplete: boolean;
  resumeContext: ResumeContext | null;
  reviewDue: boolean;
}> {
  if (IS_WEB) {
    return {
      onboardingComplete: webDb.dbIsOnboardingComplete(),
      resumeContext: webDb.dbGetResumeContext(),
      reviewDue: webDb.dbIsReviewDue(),
    };
  }
  return rpc('getAppBootstrap');
}

export async function getActiveGoal(): Promise<Goal | null> {
  if (IS_WEB) return webDb.dbGetActiveGoal();
  return rpc('getActiveGoal');
}

export async function createGoal(input: GoalWriteInput): Promise<Goal | null> {
  if (IS_WEB) { const r = webDb.dbCreateGoal(input); notifyDataChanged(); return r; }
  const result = await rpc<Goal | null>('createGoal', { input });
  notifyDataChanged();
  return result;
}

export async function updateGoal(id: string, input: GoalWriteInput): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbUpdateGoal(id, input); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('updateGoal', { id, input });
  notifyDataChanged();
  return result;
}

export async function completeGoal(id: string): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbCompleteGoal(id); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('completeGoal', { id });
  notifyDataChanged();
  return result;
}

export async function getCurrentWeeklyFocus(goalId: string): Promise<WeeklyFocus | null> {
  if (IS_WEB) return webDb.dbGetCurrentWeeklyFocus(goalId);
  return rpc('getCurrentWeeklyFocus', { goalId });
}

export async function upsertWeeklyFocus(goalId: string, focus: string): Promise<WeeklyFocus | null> {
  if (IS_WEB) { const r = webDb.dbUpsertWeeklyFocus(goalId, focus); notifyDataChanged(); return r; }
  const result = await rpc<WeeklyFocus | null>('upsertWeeklyFocus', { goalId, focus });
  notifyDataChanged();
  return result;
}

export async function getTodayTasks(): Promise<DailyTask[]> {
  if (IS_WEB) return webDb.dbGetTodayTasks();
  return rpc('getTodayTasks');
}

export async function getTasksForDate(date: string): Promise<DailyTask[]> {
  if (IS_WEB) return webDb.dbGetTasksForDate(date);
  return rpc('getTasksForDate', { date });
}

export async function getTaskById(id: string): Promise<DailyTask | null> {
  if (IS_WEB) return webDb.dbGetTaskById(id);
  return rpc('getTaskById', { id });
}

export async function createTask(input: {
  title: string;
  goalId: string;
  weeklyFocusId?: string | null;
  nextStep?: string;
  projectId?: string | null;
  options?: { date?: string; sourceTaskId?: string | null };
}): Promise<TaskWriteResult> {
  if (IS_WEB) {
    const r = webDb.dbCreateTask(input.title, input.goalId, input.weeklyFocusId, {
      date: input.options?.date,
      sourceTaskId: input.options?.sourceTaskId,
      nextStep: input.nextStep,
      projectId: input.projectId,
    });
    notifyDataChanged();
    return r;
  }
  const result = await rpc<TaskWriteResult>('createTask', input);
  notifyDataChanged();
  return result;
}

export async function carryForwardTask(taskId: string): Promise<TaskWriteResult> {
  if (IS_WEB) { const r = webDb.dbCarryForwardTask(taskId); notifyDataChanged(); return r; }
  const result = await rpc<TaskWriteResult>('carryForwardTask', { taskId });
  notifyDataChanged();
  return result;
}

export async function completeTask(id: string): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbCompleteTask(id); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('completeTask', { id });
  notifyDataChanged();
  return result;
}

export async function uncompleteTask(id: string): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbUncompleteTask(id); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('uncompleteTask', { id });
  notifyDataChanged();
  return result;
}

export async function dropTask(id: string): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbDropTask(id); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('dropTask', { id });
  notifyDataChanged();
  return result;
}

export async function getReviewForWeek(weekOf: string): Promise<WeeklyReview | null> {
  if (IS_WEB) return webDb.dbGetReviewForWeek(weekOf);
  return rpc('getReviewForWeek', { weekOf });
}

export async function saveReview(input: {
  weekOf: string;
  wins: string;
  whatDrifted: string;
  driftReasons: string[];
  nextWeekAdjustment: string;
}): Promise<WeeklyReview | null> {
  if (IS_WEB) {
    const r = webDb.dbSaveReview(input.weekOf, input.wins, input.whatDrifted, input.driftReasons, input.nextWeekAdjustment);
    notifyDataChanged();
    return r;
  }
  const result = await rpc<WeeklyReview | null>('saveReview', input);
  notifyDataChanged();
  return result;
}

export async function isReviewDue(): Promise<boolean> {
  if (IS_WEB) return webDb.dbIsReviewDue();
  return rpc('isReviewDue');
}

export async function getTasksForWeek(weekOf: string): Promise<DailyTask[]> {
  if (IS_WEB) return webDb.dbGetTasksForWeek(weekOf);
  return rpc('getTasksForWeek', { weekOf });
}

export async function isOnboardingComplete(): Promise<boolean> {
  if (IS_WEB) return webDb.dbIsOnboardingComplete();
  return rpc('isOnboardingComplete');
}

export async function getOnboardingDraft(): Promise<OnboardingDraft | null> {
  if (IS_WEB) return webDb.dbGetOnboardingDraft();
  return rpc('getOnboardingDraft');
}

export async function saveOnboardingDraft(draft: OnboardingDraft): Promise<boolean> {
  if (IS_WEB) return webDb.dbSaveOnboardingDraft(draft);
  return rpc('saveOnboardingDraft', { draft });
}

export async function clearOnboardingDraft(): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbClearOnboardingDraft(); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('clearOnboardingDraft');
  notifyDataChanged();
  return result;
}

export async function completeOnboarding(draft: OnboardingDraft): Promise<{
  goal: Goal | null;
  weeklyFocusId: string | null;
}> {
  if (IS_WEB) { const r = webDb.dbCompleteOnboarding(draft); notifyDataChanged(); return r; }
  const result = await rpc<{ goal: Goal | null; weeklyFocusId: string | null }>('completeOnboarding', { draft });
  notifyDataChanged();
  return result;
}

export async function getFocusSessionById(id: string): Promise<FocusSession | null> {
  if (IS_WEB) return webDb.dbGetFocusSessionById(id);
  return rpc('getFocusSessionById', { id });
}

export async function startFocusSession(taskId: string): Promise<FocusSession | null> {
  if (IS_WEB) { const r = webDb.dbStartFocusSession(taskId); notifyDataChanged(); return r; }
  const result = await rpc<FocusSession | null>('startFocusSession', { taskId });
  notifyDataChanged();
  return result;
}

export async function touchFocusSession(id: string): Promise<boolean> {
  if (IS_WEB) return webDb.dbTouchFocusSession(id);
  return rpc('touchFocusSession', { id });
}

export async function completeFocusSession(id: string): Promise<FocusSession | null> {
  if (IS_WEB) { const r = webDb.dbCompleteFocusSession(id); notifyDataChanged(); return r; }
  const result = await rpc<FocusSession | null>('completeFocusSession', { id });
  notifyDataChanged();
  return result;
}

export async function abandonFocusSession(
  id: string,
  reason: Exclude<FocusExitReason, 'switched_task'>
): Promise<FocusSession | null> {
  if (IS_WEB) { const r = webDb.dbAbandonFocusSession(id, reason); notifyDataChanged(); return r; }
  const result = await rpc<FocusSession | null>('abandonFocusSession', { id, reason });
  notifyDataChanged();
  return result;
}

export async function getFocusSessionsForTask(taskId: string): Promise<FocusSession[]> {
  if (IS_WEB) return webDb.dbGetFocusSessionsForTask(taskId);
  return rpc('getFocusSessionsForTask', { taskId });
}

export async function getFocusSessionsForWeek(weekOf: string): Promise<FocusSession[]> {
  if (IS_WEB) return webDb.dbGetFocusSessionsForWeek(weekOf);
  return rpc('getFocusSessionsForWeek', { weekOf });
}

export async function getResumeContext(): Promise<ResumeContext | null> {
  if (IS_WEB) return webDb.dbGetResumeContext();
  return rpc('getResumeContext');
}

export async function dismissResumeContext(resumeContext: ResumeContext): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbDismissResumeContext(resumeContext); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('dismissResumeContext', { resumeContext });
  notifyDataChanged();
  return result;
}

export async function refreshResumeContext(): Promise<ResumeContext | null> {
  if (IS_WEB) return webDb.dbRefreshResumeContext();
  return rpc('refreshResumeContext');
}

export async function removeContext(key: string): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbRemoveContext(key); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('removeContext', { key });
  notifyDataChanged();
  return result;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjects(goalId: string): Promise<Project[]> {
  if (IS_WEB) return webDb.dbGetProjects(goalId);
  return rpc('getProjects', { goalId });
}

export async function createProject(goalId: string, name: string, color: string): Promise<Project> {
  if (IS_WEB) { const r = webDb.dbCreateProject(goalId, name, color); notifyDataChanged(); return r; }
  const result = await rpc<Project>('createProject', { goalId, name, color });
  notifyDataChanged();
  return result;
}

export async function updateProject(id: string, name: string, color: string): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbUpdateProject(id, name, color); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('updateProject', { id, name, color });
  notifyDataChanged();
  return result;
}

export async function deleteProject(id: string): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbDeleteProject(id); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('deleteProject', { id });
  notifyDataChanged();
  return result;
}

// ─── Daily review ─────────────────────────────────────────────────────────────

export async function getDailyReview(date: string): Promise<DailyReview | null> {
  if (IS_WEB) return webDb.dbGetDailyReview(date);
  return rpc('getDailyReview', { date });
}

export async function saveDailyReview(
  date: string,
  wins: string,
  drift: string,
  tomorrowStep: string
): Promise<DailyReview> {
  if (IS_WEB) { const r = webDb.dbSaveDailyReview(date, wins, drift, tomorrowStep); notifyDataChanged(); return r; }
  const result = await rpc<DailyReview>('saveDailyReview', { date, wins, drift, tomorrowStep });
  notifyDataChanged();
  return result;
}

export async function isDailyReviewDue(): Promise<boolean> {
  if (IS_WEB) return webDb.dbIsDailyReviewDue();
  return rpc('isDailyReviewDue');
}

// ─── Brain dump ───────────────────────────────────────────────────────────────

export async function getBrainDumpItems(): Promise<BrainDumpItem[]> {
  if (IS_WEB) return webDb.dbGetBrainDumpItems();
  return rpc('getBrainDumpItems');
}

export async function addBrainDumpItem(text: string): Promise<BrainDumpItem> {
  if (IS_WEB) { const r = webDb.dbAddBrainDumpItem(text); notifyDataChanged(); return r; }
  const result = await rpc<BrainDumpItem>('addBrainDumpItem', { text });
  notifyDataChanged();
  return result;
}

export async function deleteBrainDumpItem(id: string): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbDeleteBrainDumpItem(id); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('deleteBrainDumpItem', { id });
  notifyDataChanged();
  return result;
}

export async function updateBrainDumpItem(id: string, text: string): Promise<boolean> {
  if (IS_WEB) { const r = webDb.dbUpdateBrainDumpItem(id, text); notifyDataChanged(); return r; }
  const result = await rpc<boolean>('updateBrainDumpItem', { id, text });
  notifyDataChanged();
  return result;
}
