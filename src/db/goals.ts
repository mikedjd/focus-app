import type { Goal, GoalWriteInput, WeeklyFocus } from '../types';
import { generateAnchorLines } from '../utils/goalAnchors';
import { getWeekStart } from '../utils/dates';
import { generateId } from '../utils/ids';
import { runDb } from './schema';

type GoalRow = {
  id: string;
  title: string;
  target_outcome: string;
  target_date: string | null;
  metric: string;
  why: string;
  practical_reason: string;
  emotional_reason: string;
  cost_of_drift: string;
  anchor_why: string;
  anchor_drift: string;
  created_at: number;
  status: string;
  current_friction_minutes?: number | null;
  weekly_seated_seconds?: number | null;
  weekly_seated_week_of?: string | null;
};

type WeeklyFocusRow = {
  id: string;
  goal_id: string;
  focus: string;
  week_of: string;
  notes: string;
};

type NormalizedGoalInput = {
  title: string;
  targetOutcome: string;
  targetDate: string | null;
  metric: string;
  why: string;
  practicalReason: string;
  emotionalReason: string;
  costOfDrift: string;
  anchorWhy: string;
  anchorDrift: string;
};

function mapGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    targetOutcome: row.target_outcome || row.title,
    targetDate: row.target_date,
    metric: row.metric || '',
    why: row.anchor_why || row.why,
    practicalReason: row.practical_reason || '',
    emotionalReason: row.emotional_reason || '',
    costOfDrift: row.cost_of_drift || '',
    anchorWhy: row.anchor_why || row.why,
    anchorDrift: row.anchor_drift || '',
    createdAt: row.created_at,
    status: row.status as Goal['status'],
    importance: 0,
    urgency: 0,
    payoff: 0,
    whyNow: '',
    currentFrictionMinutes: row.current_friction_minutes ?? 2,
    weeklySeatedSeconds: row.weekly_seated_seconds ?? 0,
    weeklySeatedWeekOf: row.weekly_seated_week_of ?? '',
  };
}

function mapWeeklyFocus(row: WeeklyFocusRow): WeeklyFocus {
  return {
    id: row.id,
    goalId: row.goal_id,
    focus: row.focus,
    weekOf: row.week_of,
    notes: row.notes,
  };
}

export function dbGetActiveGoal(): Goal | null {
  return runDb('get active goal', null, (db) => {
    const row = db.getFirstSync<GoalRow>(
      "SELECT * FROM goals WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
    );
    return row ? mapGoal(row) : null;
  });
}

function cleanText(value?: string | null): string {
  return value?.trim() ?? '';
}

function normalizeGoalInput(input: GoalWriteInput): NormalizedGoalInput {
  const practicalReason = cleanText(input.practicalReason);
  const emotionalReason = cleanText(input.emotionalReason);
  const costOfDrift = cleanText(input.costOfDrift);
  const fallbackAnchors = generateAnchorLines({
    practicalReason,
    emotionalReason,
    costOfDrift,
  });
  const anchorWhy = cleanText(input.anchorWhy || input.why) || fallbackAnchors.anchorWhy;
  const anchorDrift = cleanText(input.anchorDrift) || fallbackAnchors.anchorDrift;

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

export function dbCreateGoal(input: GoalWriteInput): Goal | null {
  return runDb('create goal', null, (db) => {
    const normalized = normalizeGoalInput(input);
    const goal: Goal = {
      id: generateId(),
      title: normalized.title,
      targetOutcome: normalized.targetOutcome || normalized.title,
      targetDate: normalized.targetDate ?? null,
      metric: normalized.metric || '',
      why: normalized.anchorWhy || '',
      practicalReason: normalized.practicalReason || '',
      emotionalReason: normalized.emotionalReason || '',
      costOfDrift: normalized.costOfDrift || '',
      anchorWhy: normalized.anchorWhy || '',
      anchorDrift: normalized.anchorDrift || '',
      importance: 0,
      urgency: 0,
      payoff: 0,
      whyNow: '',
      createdAt: Date.now(),
      status: 'active',
      currentFrictionMinutes: 2,
      weeklySeatedSeconds: 0,
      weeklySeatedWeekOf: '',
    };

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
        goal.id,
        goal.title,
        goal.targetOutcome,
        goal.targetDate,
        goal.metric,
        goal.why,
        goal.practicalReason,
        goal.emotionalReason,
        goal.costOfDrift,
        goal.anchorWhy,
        goal.anchorDrift,
        goal.createdAt,
        goal.status,
      ]
    );

    return goal;
  });
}

export function dbUpdateGoal(id: string, input: GoalWriteInput): boolean {
  return runDb('update goal', false, (db) => {
    const normalized = normalizeGoalInput(input);
    db.runSync(
      `UPDATE goals
       SET title = ?,
           target_outcome = ?,
           target_date = ?,
           metric = ?,
           why = ?,
           practical_reason = ?,
           emotional_reason = ?,
           cost_of_drift = ?,
           anchor_why = ?,
           anchor_drift = ?
       WHERE id = ?`,
      [
        normalized.title,
        normalized.targetOutcome,
        normalized.targetDate,
        normalized.metric,
        normalized.anchorWhy,
        normalized.practicalReason,
        normalized.emotionalReason,
        normalized.costOfDrift,
        normalized.anchorWhy,
        normalized.anchorDrift,
        id,
      ]
    );
    return true;
  });
}

export function dbCompleteGoal(id: string): boolean {
  return runDb('complete goal', false, (db) => {
    db.runSync("UPDATE goals SET status = 'completed' WHERE id = ?", [id]);
    return true;
  });
}

export function dbGetCurrentWeeklyFocus(goalId: string): WeeklyFocus | null {
  return runDb('get current weekly focus', null, (db) => {
    const row = db.getFirstSync<WeeklyFocusRow>(
      'SELECT * FROM weekly_focuses WHERE goal_id = ? AND week_of = ?',
      [goalId, getWeekStart()]
    );
    return row ? mapWeeklyFocus(row) : null;
  });
}

export function dbUpsertWeeklyFocus(goalId: string, focus: string): WeeklyFocus | null {
  return runDb('upsert weekly focus', null, (db) => {
    const weekOf = getWeekStart();
    const existing = db.getFirstSync<WeeklyFocusRow>(
      'SELECT * FROM weekly_focuses WHERE goal_id = ? AND week_of = ?',
      [goalId, weekOf]
    );

    if (existing) {
      db.runSync('UPDATE weekly_focuses SET focus = ? WHERE id = ?', [focus, existing.id]);
      return {
        ...mapWeeklyFocus(existing),
        focus,
      };
    }

    const weeklyFocus: WeeklyFocus = {
      id: generateId(),
      goalId,
      focus,
      weekOf,
      notes: '',
    };

    db.runSync(
      'INSERT INTO weekly_focuses (id, goal_id, focus, week_of, notes) VALUES (?, ?, ?, ?, ?)',
      [
        weeklyFocus.id,
        weeklyFocus.goalId,
        weeklyFocus.focus,
        weeklyFocus.weekOf,
        weeklyFocus.notes,
      ]
    );

    return weeklyFocus;
  });
}
