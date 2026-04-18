import type { DailyTask, WeeklyReview } from '../types';
import { getWeekStart } from '../utils/dates';
import { generateId } from '../utils/ids';
import { dbGetTasksForDate } from './tasks';
import { runDb } from './schema';

type WeeklyReviewRow = {
  id: string;
  week_of: string;
  completed_at: number;
  wins: string;
  what_drifted: string;
  drift_reasons: string;
  next_week_adjustment: string;
};

function mapReview(row: WeeklyReviewRow): WeeklyReview {
  return {
    id: row.id,
    weekOf: row.week_of,
    completedAt: row.completed_at,
    wins: row.wins,
    whatDrifted: row.what_drifted,
    driftReasons: row.drift_reasons
      ? row.drift_reasons.split(',').filter(Boolean)
      : [],
    nextWeekAdjustment: row.next_week_adjustment,
  };
}

export function dbGetReviewForWeek(weekOf: string): WeeklyReview | null {
  return runDb('get review for week', null, (db) => {
    const row = db.getFirstSync<WeeklyReviewRow>(
      'SELECT * FROM weekly_reviews WHERE week_of = ?',
      [weekOf]
    );
    return row ? mapReview(row) : null;
  });
}

export function dbSaveReview(
  weekOf: string,
  wins: string,
  whatDrifted: string,
  driftReasons: string[],
  nextWeekAdjustment: string
): WeeklyReview | null {
  return runDb('save weekly review', null, (db) => {
    const now = Date.now();
    const driftReasonsStr = driftReasons.join(',');
    const existing = db.getFirstSync<WeeklyReviewRow>(
      'SELECT * FROM weekly_reviews WHERE week_of = ?',
      [weekOf]
    );

    if (existing) {
      db.runSync(
        `UPDATE weekly_reviews
         SET wins = ?, what_drifted = ?, drift_reasons = ?, next_week_adjustment = ?, completed_at = ?
         WHERE id = ?`,
        [wins, whatDrifted, driftReasonsStr, nextWeekAdjustment, now, existing.id]
      );
      return {
        ...mapReview(existing),
        wins,
        whatDrifted,
        driftReasons,
        nextWeekAdjustment,
        completedAt: now,
      };
    }

    const review: WeeklyReview = {
      id: generateId(),
      weekOf,
      completedAt: now,
      wins,
      whatDrifted,
      driftReasons,
      nextWeekAdjustment,
    };

    db.runSync(
      `INSERT INTO weekly_reviews
         (id, week_of, completed_at, wins, what_drifted, drift_reasons, next_week_adjustment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        review.id,
        review.weekOf,
        review.completedAt,
        review.wins,
        review.whatDrifted,
        driftReasonsStr,
        review.nextWeekAdjustment,
      ]
    );

    return review;
  });
}

export function dbIsReviewDue(): boolean {
  return runDb('check if review is due', false, () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0 || dayOfWeek > 4) {
      return false;
    }

    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    const lastWeekStart = getWeekStart(lastWeek);

    return dbGetReviewForWeek(lastWeekStart) === null;
  });
}

export function dbGetTasksForWeek(weekOf: string): DailyTask[] {
  const [year, month, day] = weekOf.split('-').map(Number);
  const tasks: DailyTask[] = [];

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(year, month - 1, day + index);
    const formatted = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    tasks.push(...dbGetTasksForDate(formatted));
  }

  return tasks;
}
