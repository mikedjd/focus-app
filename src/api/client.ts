import { Platform } from 'react-native';
import type {
  DailyTask,
  FocusExitReason,
  FocusSession,
  Goal,
  GoalWriteInput,
  OnboardingDraft,
  ResumeContext,
  TaskWriteResult,
  WeeklyFocus,
  WeeklyReview,
} from '../types';

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
  return rpc('getAppBootstrap');
}

export async function getActiveGoal(): Promise<Goal | null> {
  return rpc('getActiveGoal');
}

export async function createGoal(input: GoalWriteInput): Promise<Goal | null> {
  const result = await rpc<Goal | null>('createGoal', { input });
  notifyDataChanged();
  return result;
}

export async function updateGoal(id: string, input: GoalWriteInput): Promise<boolean> {
  const result = await rpc<boolean>('updateGoal', { id, input });
  notifyDataChanged();
  return result;
}

export async function completeGoal(id: string): Promise<boolean> {
  const result = await rpc<boolean>('completeGoal', { id });
  notifyDataChanged();
  return result;
}

export async function getCurrentWeeklyFocus(goalId: string): Promise<WeeklyFocus | null> {
  return rpc('getCurrentWeeklyFocus', { goalId });
}

export async function upsertWeeklyFocus(goalId: string, focus: string): Promise<WeeklyFocus | null> {
  const result = await rpc<WeeklyFocus | null>('upsertWeeklyFocus', { goalId, focus });
  notifyDataChanged();
  return result;
}

export async function getTodayTasks(): Promise<DailyTask[]> {
  return rpc('getTodayTasks');
}

export async function getTasksForDate(date: string): Promise<DailyTask[]> {
  return rpc('getTasksForDate', { date });
}

export async function getTaskById(id: string): Promise<DailyTask | null> {
  return rpc('getTaskById', { id });
}

export async function createTask(input: {
  title: string;
  goalId: string;
  weeklyFocusId?: string | null;
  nextStep?: string;
  options?: { date?: string; sourceTaskId?: string | null };
}): Promise<TaskWriteResult> {
  const result = await rpc<TaskWriteResult>('createTask', input);
  notifyDataChanged();
  return result;
}

export async function carryForwardTask(taskId: string): Promise<TaskWriteResult> {
  const result = await rpc<TaskWriteResult>('carryForwardTask', { taskId });
  notifyDataChanged();
  return result;
}

export async function completeTask(id: string): Promise<boolean> {
  const result = await rpc<boolean>('completeTask', { id });
  notifyDataChanged();
  return result;
}

export async function uncompleteTask(id: string): Promise<boolean> {
  const result = await rpc<boolean>('uncompleteTask', { id });
  notifyDataChanged();
  return result;
}

export async function dropTask(id: string): Promise<boolean> {
  const result = await rpc<boolean>('dropTask', { id });
  notifyDataChanged();
  return result;
}

export async function getReviewForWeek(weekOf: string): Promise<WeeklyReview | null> {
  return rpc('getReviewForWeek', { weekOf });
}

export async function saveReview(input: {
  weekOf: string;
  wins: string;
  whatDrifted: string;
  driftReasons: string[];
  nextWeekAdjustment: string;
}): Promise<WeeklyReview | null> {
  const result = await rpc<WeeklyReview | null>('saveReview', input);
  notifyDataChanged();
  return result;
}

export async function isReviewDue(): Promise<boolean> {
  return rpc('isReviewDue');
}

export async function getTasksForWeek(weekOf: string): Promise<DailyTask[]> {
  return rpc('getTasksForWeek', { weekOf });
}

export async function isOnboardingComplete(): Promise<boolean> {
  return rpc('isOnboardingComplete');
}

export async function getOnboardingDraft(): Promise<OnboardingDraft | null> {
  return rpc('getOnboardingDraft');
}

export async function saveOnboardingDraft(draft: OnboardingDraft): Promise<boolean> {
  return rpc('saveOnboardingDraft', { draft });
}

export async function clearOnboardingDraft(): Promise<boolean> {
  const result = await rpc<boolean>('clearOnboardingDraft');
  notifyDataChanged();
  return result;
}

export async function completeOnboarding(draft: OnboardingDraft): Promise<{
  goal: Goal | null;
  weeklyFocusId: string | null;
}> {
  const result = await rpc<{ goal: Goal | null; weeklyFocusId: string | null }>('completeOnboarding', { draft });
  notifyDataChanged();
  return result;
}

export async function getFocusSessionById(id: string): Promise<FocusSession | null> {
  return rpc('getFocusSessionById', { id });
}

export async function startFocusSession(taskId: string): Promise<FocusSession | null> {
  const result = await rpc<FocusSession | null>('startFocusSession', { taskId });
  notifyDataChanged();
  return result;
}

export async function touchFocusSession(id: string): Promise<boolean> {
  return rpc('touchFocusSession', { id });
}

export async function completeFocusSession(id: string): Promise<FocusSession | null> {
  const result = await rpc<FocusSession | null>('completeFocusSession', { id });
  notifyDataChanged();
  return result;
}

export async function abandonFocusSession(
  id: string,
  reason: Exclude<FocusExitReason, 'switched_task'>
): Promise<FocusSession | null> {
  const result = await rpc<FocusSession | null>('abandonFocusSession', { id, reason });
  notifyDataChanged();
  return result;
}

export async function getFocusSessionsForTask(taskId: string): Promise<FocusSession[]> {
  return rpc('getFocusSessionsForTask', { taskId });
}

export async function getFocusSessionsForWeek(weekOf: string): Promise<FocusSession[]> {
  return rpc('getFocusSessionsForWeek', { weekOf });
}

export async function getResumeContext(): Promise<ResumeContext | null> {
  return rpc('getResumeContext');
}

export async function dismissResumeContext(resumeContext: ResumeContext): Promise<boolean> {
  const result = await rpc<boolean>('dismissResumeContext', { resumeContext });
  notifyDataChanged();
  return result;
}

export async function refreshResumeContext(): Promise<ResumeContext | null> {
  return rpc('refreshResumeContext');
}

export async function removeContext(key: string): Promise<boolean> {
  const result = await rpc<boolean>('removeContext', { key });
  notifyDataChanged();
  return result;
}
