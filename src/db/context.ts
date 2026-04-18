import type * as SQLite from 'expo-sqlite';
import type { ResumeContext } from '../types';
import { formatDate, todayString } from '../utils/dates';
import { hasColumn, runDb } from './schema';

const RESUME_CONTEXT_KEY = 'resume_context';
const DISMISSED_RESUME_TASK_ID_KEY = 'dismissed_resume_task_id';

type ResumeRow = {
  id: string;
  title: string;
  date: string;
  goal_id: string;
  weekly_focus_id: string | null;
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

export function dbDismissResumeContext(taskId: string): boolean {
  return runDb('dismiss resume context', false, (db) => {
    db.runSync('INSERT OR REPLACE INTO app_context (key, value) VALUES (?, ?)', [
      DISMISSED_RESUME_TASK_ID_KEY,
      taskId,
    ]);
    removeContextValue(db, RESUME_CONTEXT_KEY);
    return true;
  });
}

export function dbRefreshResumeContext(): ResumeContext | null {
  return runDb('refresh resume context', null, (db) => {
    const dismissedTaskId = getContextValue(db, DISMISSED_RESUME_TASK_ID_KEY);
    const today = todayString();
    const yesterday = offsetDateString(-1);
    const cutoff = offsetDateString(-7);
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
      [today, cutoff, dismissedTaskId, dismissedTaskId, yesterday]
    );

    const nextContext = row
      ? {
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
