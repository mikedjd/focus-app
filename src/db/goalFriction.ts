import { computeFrictionMinutes } from '../utils/frictionCurve';
import { getWeekStart } from '../utils/dates';
import { runDb } from './schema';

/**
 * Re-computes a goal's weekly seated seconds from focus_sessions for the
 * current week (Monday-based) and updates the friction floor accordingly.
 * Call this at focus-session end.
 */
export function dbRecomputeGoalFriction(goalId: string): {
  weeklySeatedSeconds: number;
  currentFrictionMinutes: number;
} {
  return runDb(
    'recompute goal friction',
    { weeklySeatedSeconds: 0, currentFrictionMinutes: 2 },
    (db) => {
      const weekOf = getWeekStart();
      const [year, month, day] = weekOf.split('-').map(Number);
      const start = new Date(year, month - 1, day).getTime();
      const end = new Date(year, month - 1, day + 7).getTime();

      const row = db.getFirstSync<{ total: number | null }>(
        `SELECT COALESCE(SUM(fs.duration_seconds), 0) AS total
           FROM focus_sessions fs
           JOIN daily_tasks dt ON dt.id = fs.task_id
          WHERE dt.goal_id = ?
            AND fs.started_at >= ?
            AND fs.started_at < ?
            AND fs.status = 'completed'`,
        [goalId, start, end]
      );
      const total = row?.total ?? 0;
      const floor = computeFrictionMinutes(total);
      db.runSync(
        `UPDATE goals
            SET weekly_seated_seconds = ?,
                weekly_seated_week_of = ?,
                current_friction_minutes = ?
          WHERE id = ?`,
        [total, weekOf, floor, goalId]
      );
      return { weeklySeatedSeconds: total, currentFrictionMinutes: floor };
    }
  );
}
