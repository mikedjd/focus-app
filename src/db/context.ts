import type * as SQLite from 'expo-sqlite';
import type { ResumeContext } from '../types';
import { formatDate, todayString } from '../utils/dates';
import { hasColumn, runDb } from './schema';

const RESUME_CONTEXT_KEY = 'resume_context';
const DISMISSED_RESUME_TASK_ID_KEY = 'dismissed_resume_task_id';
const FOCUS_RESUME_WINDOW_MS = 36 * 60 * 60 * 1000;

type ResumeRow = {
  id: string;
  title: string;
  date: string;
  goal_id: string;
  weekly_focus_id: string | null;
};

type FocusResumeRow = {
  focus_session_id: string;
  task_id: string;
  title: string;
  goal_id: string;
  weekly_focus_id: string | null;
  started_at: number;
  last_heartbeat_at: number;
  status: 'active' | 'abandoned';
  exit_reason: string | null;
};

export function dbGetContext(key: string): string | null {
  return runDb('get app context', null, (db) => getContextValue(db, key));
}

export function dbSetContext(key: string, value: string): boolean {
  return runDb('set app context', false, (db) => {
    db.runSync('INSERT OR REPLACE INTO app_context (key, value) VALUES (?, ?)', [key, value]);
    return true;
  });
}

export function dbRemoveContext(key: string): boolean {
  return runDb('remove app context', false, (db) => {
    db.runSync('DELETE FROM app_context WHERE key = ?', [key]);
    return true;
  });
}

export function dbGetResumeContext(): ResumeContext | null {
  return runDb('get resume context', null, (db) => {
    const raw = getContextValue(db, RESUME_CONTEXT_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as ResumeContext;
    } catch (error) {
      if (__DEV__) {
        console.error('[db] parse resume context', error);
      }
      removeContextValue(db, RESUME_CONTEXT_KEY);
      return null;
    }
  });
}

export function dbDismissResumeContext(resumeContext: ResumeContext): boolean {
  return runDb('dismiss resume context', false, (db) => {
    db.runSync('INSERT OR REPLACE INTO app_context (key, value) VALUES (?, ?)', [
      DISMISSED_RESUME_TASK_ID_KEY,
      getDismissedResumeKey(resumeContext),
    ]);
    removeContextValue(db, RESUME_CONTEXT_KEY);
    return true;
  });
}

export function dbRefreshResumeContext(): ResumeContext | null {
  return runDb('refresh resume context', null, (db) => {
    const dismissedResumeKey = getContextValue(db, DISMISSED_RESUME_TASK_ID_KEY);
    const today = todayString();
    const yesterday = offsetDateString(-1);
    const cutoff = offsetDateString(-7);
    const activeFocusRow = db.getFirstSync<FocusResumeRow>(
      `
        SELECT
          focus_sessions.id AS focus_session_id,
          focus_sessions.task_id AS task_id,
          daily_tasks.title AS title,
          daily_tasks.goal_id AS goal_id,
          daily_tasks.weekly_focus_id AS weekly_focus_id,
          focus_sessions.started_at AS started_at,
          focus_sessions.last_heartbeat_at AS last_heartbeat_at,
          focus_sessions.status AS status,
          focus_sessions.exit_reason AS exit_reason
        FROM focus_sessions
        JOIN daily_tasks ON daily_tasks.id = focus_sessions.task_id
        WHERE focus_sessions.status = 'active'
          AND daily_tasks.status = 'pending'
          AND (? IS NULL OR focus_sessions.id != ?)
        ORDER BY focus_sessions.last_heartbeat_at DESC, focus_sessions.started_at DESC
        LIMIT 1
      `,
      [getDismissedFocusSessionId(dismissedResumeKey), getDismissedFocusSessionId(dismissedResumeKey)]
    );

    if (activeFocusRow) {
      const nextContext: ResumeContext = {
        kind: 'focus-session',
        taskId: activeFocusRow.task_id,
        taskTitle: activeFocusRow.title,
        goalId: activeFocusRow.goal_id,
        weeklyFocusId: activeFocusRow.weekly_focus_id,
        focusSessionId: activeFocusRow.focus_session_id,
        startedAt: activeFocusRow.started_at,
        lastHeartbeatAt: activeFocusRow.last_heartbeat_at,
        sessionStatus: 'active',
        exitReason: normalizeExitReason(activeFocusRow.exit_reason),
      };
      db.runSync('INSERT OR REPLACE INTO app_context (key, value) VALUES (?, ?)', [
        RESUME_CONTEXT_KEY,
        JSON.stringify(nextContext),
      ]);
      return nextContext;
    }

    const abandonedCutoff = Date.now() - FOCUS_RESUME_WINDOW_MS;
    const abandonedFocusRow = db.getFirstSync<FocusResumeRow>(
      `
        SELECT
          focus_sessions.id AS focus_session_id,
          focus_sessions.task_id AS task_id,
          daily_tasks.title AS title,
          daily_tasks.goal_id AS goal_id,
          daily_tasks.weekly_focus_id AS weekly_focus_id,
          focus_sessions.started_at AS started_at,
          focus_sessions.last_heartbeat_at AS last_heartbeat_at,
          focus_sessions.status AS status,
          focus_sessions.exit_reason AS exit_reason
        FROM focus_sessions
        JOIN daily_tasks ON daily_tasks.id = focus_sessions.task_id
        WHERE focus_sessions.status = 'abandoned'
          AND focus_sessions.ended_at >= ?
          AND daily_tasks.status = 'pending'
          AND (? IS NULL OR focus_sessions.id != ?)
        ORDER BY focus_sessions.ended_at DESC, focus_sessions.started_at DESC
        LIMIT 1
      `,
      [
        abandonedCutoff,
        getDismissedFocusSessionId(dismissedResumeKey),
        getDismissedFocusSessionId(dismissedResumeKey),
      ]
    );

    if (abandonedFocusRow) {
      const nextContext: ResumeContext = {
        kind: 'focus-session',
        taskId: abandonedFocusRow.task_id,
        taskTitle: abandonedFocusRow.title,
        goalId: abandonedFocusRow.goal_id,
        weeklyFocusId: abandonedFocusRow.weekly_focus_id,
        focusSessionId: abandonedFocusRow.focus_session_id,
        startedAt: abandonedFocusRow.started_at,
        lastHeartbeatAt: abandonedFocusRow.last_heartbeat_at,
        sessionStatus: 'abandoned',
        exitReason: normalizeExitReason(abandonedFocusRow.exit_reason),
      };
      db.runSync('INSERT OR REPLACE INTO app_context (key, value) VALUES (?, ?)', [
        RESUME_CONTEXT_KEY,
        JSON.stringify(nextContext),
      ]);
      return nextContext;
    }

    const supportsSourceTaskId = hasColumn(db, 'daily_tasks', 'source_task_id');
    const createdAtOrder = hasColumn(db, 'daily_tasks', 'created_at')
      ? 'created_at DESC'
      : 'sort_order DESC';
    const carryForwardFilter = supportsSourceTaskId
      ? `
          AND NOT EXISTS (
            SELECT 1
            FROM daily_tasks carried
            WHERE carried.source_task_id = daily_tasks.id
          )
        `
      : '';

    const row = db.getFirstSync<ResumeRow>(
      `
        SELECT id, title, date, goal_id, weekly_focus_id
        FROM daily_tasks
        WHERE status = 'pending'
          AND date < ?
          AND date >= ?
          AND (? IS NULL OR id != ?)
          ${carryForwardFilter}
        ORDER BY
          CASE WHEN date = ? THEN 0 ELSE 1 END,
          date DESC,
          sort_order DESC,
          ${createdAtOrder}
        LIMIT 1
      `,
      [today, cutoff, getDismissedTaskId(dismissedResumeKey), getDismissedTaskId(dismissedResumeKey), yesterday]
    );

    const nextContext = row
      ? {
          kind: 'carry-forward' as const,
          taskId: row.id,
          taskTitle: row.title,
          fromDate: row.date,
          goalId: row.goal_id,
          weeklyFocusId: row.weekly_focus_id,
        }
      : null;

    if (nextContext) {
      db.runSync('INSERT OR REPLACE INTO app_context (key, value) VALUES (?, ?)', [
        RESUME_CONTEXT_KEY,
        JSON.stringify(nextContext),
      ]);
    } else {
      removeContextValue(db, RESUME_CONTEXT_KEY);
    }

    return nextContext;
  });
}

function getDismissedResumeKey(resumeContext: ResumeContext): string {
  return resumeContext.kind === 'focus-session'
    ? `focus-session:${resumeContext.focusSessionId}`
    : `carry-forward:${resumeContext.taskId}`;
}

function getDismissedFocusSessionId(value: string | null): string | null {
  if (!value?.startsWith('focus-session:')) {
    return null;
  }
  return value.slice('focus-session:'.length);
}

function getDismissedTaskId(value: string | null): string | null {
  if (!value?.startsWith('carry-forward:')) {
    return null;
  }
  return value.slice('carry-forward:'.length);
}

function normalizeExitReason(value: string | null): import('../types').FocusExitReason | null {
  if (!value) {
    return null;
  }
  return value as import('../types').FocusExitReason;
}

function getContextValue(db: Pick<SQLite.SQLiteDatabase, 'getFirstSync'>, key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_context WHERE key = ?', [
    key,
  ]);
  return row?.value ?? null;
}

function removeContextValue(db: Pick<SQLite.SQLiteDatabase, 'runSync'>, key: string): void {
  db.runSync('DELETE FROM app_context WHERE key = ?', [key]);
}

function offsetDateString(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return formatDate(date);
}
