import type { GoalProgress, Milestone } from '../types';
import { generateId } from '../utils/ids';
import { runDb } from './schema';

type MilestoneRow = {
  id: string;
  goal_id: string;
  title: string;
  target_metric: string;
  sort_order: number;
  completed_at: number | null;
  created_at: number;
};

function mapMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    targetMetric: row.target_metric,
    sortOrder: row.sort_order,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export function dbGetMilestonesForGoal(goalId: string): Milestone[] {
  return runDb('get milestones', [], (db) => {
    const rows = db.getAllSync<MilestoneRow>(
      'SELECT * FROM milestones WHERE goal_id = ? ORDER BY sort_order, created_at',
      [goalId]
    );
    return rows.map(mapMilestone);
  });
}

export function dbCreateMilestone(
  goalId: string,
  title: string,
  targetMetric = ''
): Milestone | null {
  return runDb('create milestone', null, (db) => {
    const row = db.getFirstSync<{ c: number }>(
      'SELECT COUNT(*) as c FROM milestones WHERE goal_id = ?',
      [goalId]
    );
    const milestone: Milestone = {
      id: generateId(),
      goalId,
      title,
      targetMetric,
      sortOrder: row?.c ?? 0,
      completedAt: null,
      createdAt: Date.now(),
    };
    db.runSync(
      `INSERT INTO milestones
        (id, goal_id, title, target_metric, sort_order, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        milestone.id,
        milestone.goalId,
        milestone.title,
        milestone.targetMetric,
        milestone.sortOrder,
        milestone.completedAt,
        milestone.createdAt,
      ]
    );
    return milestone;
  });
}

export function dbToggleMilestone(id: string, completed: boolean): boolean {
  return runDb('toggle milestone', false, (db) => {
    db.runSync('UPDATE milestones SET completed_at = ? WHERE id = ?', [
      completed ? Date.now() : null,
      id,
    ]);
    return true;
  });
}

export function dbDeleteMilestone(id: string): boolean {
  return runDb('delete milestone', false, (db) => {
    db.runSync('DELETE FROM milestones WHERE id = ?', [id]);
    return true;
  });
}

export function dbGetGoalProgress(goalId: string): GoalProgress {
  return runDb(
    'get goal progress',
    { goalId, totalMilestones: 0, completedMilestones: 0, percent: 0, nextMilestone: null },
    (db) => {
      const rows = db.getAllSync<MilestoneRow>(
        'SELECT * FROM milestones WHERE goal_id = ? ORDER BY sort_order, created_at',
        [goalId]
      );
      const total = rows.length;
      const done = rows.filter((r) => r.completed_at !== null).length;
      const next = rows.find((r) => r.completed_at === null);
      return {
        goalId,
        totalMilestones: total,
        completedMilestones: done,
        percent: total === 0 ? 0 : done / total,
        nextMilestone: next ? mapMilestone(next) : null,
      };
    }
  );
}
