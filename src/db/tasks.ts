import type * as SQLite from 'expo-sqlite';
import type { DailyTask, TaskWriteResult } from '../types';
import {
  STANDALONE_TASKS_GOAL_ID,
  STANDALONE_TASKS_GOAL_TITLE,
} from '../constants/standaloneTaskGoal';
import { todayString } from '../utils/dates';
import { generateId } from '../utils/ids';
import { dbRefreshResumeContext } from './context';
import { hasColumn, runDb } from './schema';

const DAILY_TASK_CAP = 3;

type DailyTaskRow = {
  id: string;
  goal_id: string;
  project_id: string | null;
  weekly_focus_id: string | null;
  source_task_id: string | null;
  title: string;
  next_step: string;
  date: string;
  status: string;
  completed_at: number | null;
  sort_order: number;
  created_at: number;
  task_type?: string | null;
  effort_level?: string | null;
  milestone_id?: string | null;
  scheduled_window_start?: string | null;
};

function mapTask(row: DailyTaskRow): DailyTask {
  return {
    id: row.id,
    goalId: row.goal_id,
    projectId: row.project_id ?? null,
    weeklyFocusId: row.weekly_focus_id,
    sourceTaskId: row.source_task_id,
    title: row.title,
    nextStep: row.next_step || '',
    date: row.date,
    status: row.status as DailyTask['status'],
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    taskType: ((row.task_type as DailyTask['taskType']) ?? 'goal') || 'goal',
    effortLevel: (row.effort_level as DailyTask['effortLevel']) ?? '',
    milestoneId: row.milestone_id ?? null,
    scheduledWindowStart: row.scheduled_window_start ?? '',
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
  return runDb('create task', { ok: false, reason: 'db_error' } as TaskWriteResult, (db) => {
    const resolvedGoalId = goalId || ensureStandaloneTaskGoal(db);

    const targetDate = options?.date ?? todayString();
    const isToday = targetDate === todayString();
    if (isToday && getTaskCountForDate(db, targetDate) >= DAILY_TASK_CAP) {
      return { ok: false, reason: 'task_limit_reached' };
    }

    const task: DailyTask = {
      id: generateId(),
      goalId: resolvedGoalId,
      projectId: options?.projectId ?? null,
      weeklyFocusId: weeklyFocusId ?? null,
      sourceTaskId: options?.sourceTaskId ?? null,
      title,
      nextStep: options?.nextStep?.trim() ?? '',
      date: targetDate,
      status: 'pending',
      completedAt: null,
      sortOrder: getTaskCountForDate(db, targetDate),
      createdAt: Date.now(),
      taskType: options?.taskType ?? 'goal',
      effortLevel: options?.effortLevel ?? '',
      milestoneId: options?.milestoneId ?? null,
      scheduledWindowStart: options?.scheduledWindowStart ?? '',
    };

    insertTaskRow(db, task);

    dbRefreshResumeContext();
    return { ok: true, task };
  });
}

function ensureStandaloneTaskGoal(
  db: Pick<SQLite.SQLiteDatabase, 'getFirstSync' | 'runSync'>
): string {
  const existing = db.getFirstSync<{ id: string }>('SELECT id FROM goals WHERE id = ?', [
    STANDALONE_TASKS_GOAL_ID,
  ]);

  if (!existing) {
    db.runSync(
      `INSERT INTO goals (
        id,
        title,
        target_outcome,
        target_date,
        metric,
        why,
        practical_reason,
        emotional_reason,
        cost_of_drift,
        anchor_why,
        anchor_drift,
        created_at,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        STANDALONE_TASKS_GOAL_ID,
        STANDALONE_TASKS_GOAL_TITLE,
        STANDALONE_TASKS_GOAL_TITLE,
        null,
        '',
        'Hidden bucket for secondary tasks.',
        '',
        '',
        '',
        '',
        '',
        0,
        'parked',
      ]
    );
  }

  return STANDALONE_TASKS_GOAL_ID;
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
        projectId: sourceRow.project_id ?? null,
        weeklyFocusId: sourceRow.weekly_focus_id,
        sourceTaskId: hasColumn(db, 'daily_tasks', 'source_task_id') ? sourceRow.id : null,
        title: sourceRow.title,
        nextStep: sourceRow.next_step || '',
        date: targetDate,
        status: 'pending',
        completedAt: null,
        sortOrder: getTaskCountForDate(db, targetDate),
        createdAt: Date.now(),
        taskType: ((sourceRow.task_type as DailyTask['taskType']) ?? 'goal') || 'goal',
        effortLevel: (sourceRow.effort_level as DailyTask['effortLevel']) ?? '',
        milestoneId: sourceRow.milestone_id ?? null,
        scheduledWindowStart: sourceRow.scheduled_window_start ?? '',
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
  const nextStepSelect = hasColumn(db, 'daily_tasks', 'next_step')
    ? 'next_step'
    : "'' AS next_step";
  const createdAtSelect = hasColumn(db, 'daily_tasks', 'created_at')
    ? 'created_at'
    : '0 AS created_at';
  const projectIdSelect = hasColumn(db, 'daily_tasks', 'project_id')
    ? 'project_id'
    : 'NULL AS project_id';
  const taskTypeSelect = hasColumn(db, 'daily_tasks', 'task_type')
    ? 'task_type'
    : "'goal' AS task_type";
  const effortLevelSelect = hasColumn(db, 'daily_tasks', 'effort_level')
    ? 'effort_level'
    : "'' AS effort_level";
  const milestoneSelect = hasColumn(db, 'daily_tasks', 'milestone_id')
    ? 'milestone_id'
    : 'NULL AS milestone_id';
  const windowSelect = hasColumn(db, 'daily_tasks', 'scheduled_window_start')
    ? 'scheduled_window_start'
    : "'' AS scheduled_window_start";

  return `
    SELECT
      id,
      goal_id,
      ${projectIdSelect},
      weekly_focus_id,
      ${sourceTaskSelect},
      title,
      ${nextStepSelect},
      date,
      status,
      completed_at,
      sort_order,
      ${createdAtSelect},
      ${taskTypeSelect},
      ${effortLevelSelect},
      ${milestoneSelect},
      ${windowSelect}
    FROM daily_tasks
  `;
}

function insertTaskRow(db: SQLite.SQLiteDatabase, task: DailyTask): void {
  const supportsSourceTaskId = hasColumn(db, 'daily_tasks', 'source_task_id');
  const supportsCreatedAt = hasColumn(db, 'daily_tasks', 'created_at');
  const supportsProjectId = hasColumn(db, 'daily_tasks', 'project_id');

  const columns = ['id', 'goal_id', 'weekly_focus_id', 'title', 'next_step', 'date', 'status', 'completed_at', 'sort_order'];
  const values: Array<string | number | null> = [
    task.id,
    task.goalId,
    task.weeklyFocusId,
    task.title,
    task.nextStep,
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

  if (supportsProjectId) {
    columns.push('project_id');
    values.push(task.projectId);
  }

  if (hasColumn(db, 'daily_tasks', 'task_type')) {
    columns.push('task_type');
    values.push(task.taskType);
  }
  if (hasColumn(db, 'daily_tasks', 'effort_level')) {
    columns.push('effort_level');
    values.push(task.effortLevel);
  }
  if (hasColumn(db, 'daily_tasks', 'milestone_id')) {
    columns.push('milestone_id');
    values.push(task.milestoneId);
  }
  if (hasColumn(db, 'daily_tasks', 'scheduled_window_start')) {
    columns.push('scheduled_window_start');
    values.push(task.scheduledWindowStart);
  }

  const placeholders = columns.map(() => '?').join(', ');
  db.runSync(
    `INSERT INTO daily_tasks (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );
}
