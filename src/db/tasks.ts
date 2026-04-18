import type * as SQLite from 'expo-sqlite';
import type { DailyTask, TaskWriteResult } from '../types';
import { todayString } from '../utils/dates';
import { generateId } from '../utils/ids';
import { dbRefreshResumeContext } from './context';
import { hasColumn, runDb } from './schema';

const DAILY_TASK_CAP = 3;

type DailyTaskRow = {
  id: string;
  goal_id: string;
  weekly_focus_id: string | null;
  source_task_id: string | null;
  title: string;
  date: string;
  status: string;
  completed_at: number | null;
  sort_order: number;
  created_at: number;
};

function mapTask(row: DailyTaskRow): DailyTask {
  return {
    id: row.id,
    goalId: row.goal_id,
    weeklyFocusId: row.weekly_focus_id,
    sourceTaskId: row.source_task_id,
    title: row.title,
    date: row.date,
    status: row.status as DailyTask['status'],
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export function dbGetTodayTasks(): DailyTask[] {
  return dbGetTasksForDate(todayString());
}

export function dbGetTasksForDate(date: string): DailyTask[] {
  return runDb('get tasks for date', [], (db) => {
    const selectClause = getTaskSelectClause(db);
    const rows = db.getAllSync<DailyTaskRow>(
      `${selectClause} WHERE date = ? AND status != 'dropped' ORDER BY sort_order`,
      [date]
    );
    return rows.map(mapTask);
  });
}

export function dbGetTaskById(id: string): DailyTask | null {
  return runDb('get task by id', null, (db) => {
    const row = db.getFirstSync<DailyTaskRow>(`${getTaskSelectClause(db)} WHERE id = ?`, [id]);
    return row ? mapTask(row) : null;
  });
}

export function dbCreateTask(
  title: string,
  goalId: string,
  weeklyFocusId?: string | null,
  options?: { date?: string; sourceTaskId?: string | null }
): TaskWriteResult {
  return runDb('create task', { ok: false, reason: 'db_error' } as TaskWriteResult, (db) => {
    if (!goalId) {
      return { ok: false, reason: 'missing_goal' };
    }

    const targetDate = options?.date ?? todayString();
    if (targetDate === todayString() && getTaskCountForDate(db, targetDate) >= DAILY_TASK_CAP) {
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
      sortOrder: getTaskCountForDate(db, targetDate),
      createdAt: Date.now(),
    };

    insertTaskRow(db, task);

    dbRefreshResumeContext();
    return { ok: true, task };
  });
}

export function dbCarryForwardTask(taskId: string): TaskWriteResult {
  return runDb(
    'carry forward task',
    { ok: false, reason: 'db_error' } as TaskWriteResult,
    (db) => {
      const sourceRow = db.getFirstSync<DailyTaskRow>(
        `${getTaskSelectClause(db)} WHERE id = ? AND status = 'pending'`,
        [taskId]
      );

      if (!sourceRow) {
        return { ok: false, reason: 'task_not_found' };
      }

      const targetDate = todayString();
      if (getTaskCountForDate(db, targetDate) >= DAILY_TASK_CAP) {
        return { ok: false, reason: 'task_limit_reached' };
      }

      const task: DailyTask = {
        id: generateId(),
        goalId: sourceRow.goal_id,
        weeklyFocusId: sourceRow.weekly_focus_id,
        sourceTaskId: hasColumn(db, 'daily_tasks', 'source_task_id') ? sourceRow.id : null,
        title: sourceRow.title,
        date: targetDate,
        status: 'pending',
        completedAt: null,
        sortOrder: getTaskCountForDate(db, targetDate),
        createdAt: Date.now(),
      };

      insertTaskRow(db, task);

      dbRefreshResumeContext();
      return { ok: true, task };
    }
  );
}

export function dbCompleteTask(id: string): boolean {
  return runDb('complete task', false, (db) => {
    db.runSync("UPDATE daily_tasks SET status = 'done', completed_at = ? WHERE id = ?", [
      Date.now(),
      id,
    ]);
    dbRefreshResumeContext();
    return true;
  });
}

export function dbUncompleteTask(id: string): boolean {
  return runDb('uncomplete task', false, (db) => {
    db.runSync("UPDATE daily_tasks SET status = 'pending', completed_at = NULL WHERE id = ?", [
      id,
    ]);
    dbRefreshResumeContext();
    return true;
  });
}

export function dbDropTask(id: string): boolean {
  return runDb('drop task', false, (db) => {
    db.runSync("UPDATE daily_tasks SET status = 'dropped' WHERE id = ?", [id]);
    dbRefreshResumeContext();
    return true;
  });
}

function getTaskCountForDate(
  db: Pick<SQLite.SQLiteDatabase, 'getFirstSync'>,
  date: string
): number {
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM daily_tasks WHERE date = ? AND status != 'dropped'",
    [date]
  );
  return row?.count ?? 0;
}

function getTaskSelectClause(db: SQLite.SQLiteDatabase): string {
  const sourceTaskSelect = hasColumn(db, 'daily_tasks', 'source_task_id')
    ? 'source_task_id'
    : 'NULL AS source_task_id';
  const createdAtSelect = hasColumn(db, 'daily_tasks', 'created_at')
    ? 'created_at'
    : '0 AS created_at';

  return `
    SELECT
      id,
      goal_id,
      weekly_focus_id,
      ${sourceTaskSelect},
      title,
      date,
      status,
      completed_at,
      sort_order,
      ${createdAtSelect}
    FROM daily_tasks
  `;
}

function insertTaskRow(db: SQLite.SQLiteDatabase, task: DailyTask): void {
  const supportsSourceTaskId = hasColumn(db, 'daily_tasks', 'source_task_id');
  const supportsCreatedAt = hasColumn(db, 'daily_tasks', 'created_at');

  const columns = ['id', 'goal_id', 'weekly_focus_id', 'title', 'date', 'status', 'completed_at', 'sort_order'];
  const values: Array<string | number | null> = [
    task.id,
    task.goalId,
    task.weeklyFocusId,
    task.title,
    task.date,
    task.status,
    task.completedAt,
    task.sortOrder,
  ];

  if (supportsSourceTaskId) {
    columns.push('source_task_id');
    values.push(task.sourceTaskId);
  }

  if (supportsCreatedAt) {
    columns.push('created_at');
    values.push(task.createdAt);
  }

  const placeholders = columns.map(() => '?').join(', ');
  db.runSync(
    `INSERT INTO daily_tasks (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );
}
