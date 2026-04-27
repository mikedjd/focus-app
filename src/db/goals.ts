import type { Goal, GoalWriteInput, WeeklyFocus } from '../types';
import { getWeekStart } from '../utils/dates';

function generateAnchorLines(input: { practicalReason: string; emotionalReason: string; costOfDrift: string }): {
  anchorWhy: string;
  anchorDrift: string;
} {
  return {
    anchorWhy: input.practicalReason || input.emotionalReason || '',
    anchorDrift: input.costOfDrift || '',
  };
}

function createDefaultGoalInput(): GoalWriteInput {
  return { title: 'My first goal', why: 'To build momentum and prove the system works.' };
}
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
  total_xp?: number | null;
  current_streak?: number | null;
  streak_date?: string | null;
  health_score?: number | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  why_it_matters?: string | null;
  xp_target?: number | null;
  build_health?: number | null;
  current_phase?: number | null;
  difficulty_phase?: number | null;
  last_completed_date?: string | null;
  performance_status?: Goal['performanceStatus'] | null;
  updated_at?: number | null;
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
  const createdAt = row.created_at;
  const updatedAt = row.updated_at ?? createdAt;
  const title = row.title;
  const totalXp = row.total_xp ?? 0;
  const healthScore = row.health_score ?? 100;
  const currentStreak = row.current_streak ?? 0;
  return {
    id: row.id,
    name: title,
    title,
    targetOutcome: row.target_outcome || title,
    targetDate: row.target_date,
    metric: row.metric || '',
    why: row.anchor_why || row.why,
    practicalReason: row.practical_reason || '',
    emotionalReason: row.emotional_reason || '',
    costOfDrift: row.cost_of_drift || '',
    anchorWhy: row.anchor_why || row.why,
    anchorDrift: row.anchor_drift || '',
    createdAt,
    updatedAt,
    status: row.status as Goal['status'],
    importance: 0,
    urgency: 0,
    payoff: 0,
    whyNow: '',
    currentFrictionMinutes: row.current_friction_minutes ?? 2,
    weeklySeatedSeconds: row.weekly_seated_seconds ?? 0,
    weeklySeatedWeekOf: row.weekly_seated_week_of ?? '',
    totalXp,
    currentStreak,
    streakDate: row.streak_date ?? '',
    healthScore,
    description: row.description ?? '',
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? row.target_date,
    whyItMatters: row.why_it_matters || row.anchor_why || row.why,
    xpTotal: totalXp,
    xpTarget: row.xp_target ?? 0,
    buildHealth: row.build_health ?? healthScore,
    currentPhase: row.current_phase ?? 1,
    difficultyPhase: row.difficulty_phase ?? 1,
    streakCount: currentStreak,
    lastCompletedDate: row.last_completed_date ?? '',
    performanceStatus: row.performance_status ?? 'on_track',
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

export function dbCreateDefaultGoal(): Goal | null {
  return dbCreateGoal(createDefaultGoalInput());
}

export function dbCreateGoal(input: GoalWriteInput): Goal | null {
  return runDb('create goal', null, (db) => {
    const normalized = normalizeGoalInput(input);
    const now = Date.now();
    db.runSync("UPDATE goals SET status = 'completed', updated_at = ? WHERE status = 'active'", [now]);
    const goal: Goal = {
      id: generateId(),
      name: normalized.title,
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
      createdAt: now,
      updatedAt: now,
      status: 'active',
      currentFrictionMinutes: 2,
      weeklySeatedSeconds: 0,
      weeklySeatedWeekOf: '',
      totalXp: 0,
      currentStreak: 0,
      streakDate: '',
      healthScore: 100,
      description: cleanText(input.description),
      startDate: cleanText(input.startDate) || new Date(now).toISOString().slice(0, 10),
      endDate: normalized.targetDate ?? null,
      whyItMatters: cleanText(input.whyItMatters) || normalized.anchorWhy || '',
      xpTotal: 0,
      xpTarget: input.xpTarget ?? 0,
      buildHealth: 100,
      currentPhase: 1,
      difficultyPhase: 1,
      streakCount: 0,
      lastCompletedDate: '',
      performanceStatus: 'on_track',
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
        status,
        description,
        start_date,
        end_date,
        why_it_matters,
        xp_target,
        build_health,
        current_phase,
        difficulty_phase,
        last_completed_date,
        performance_status,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        goal.description,
        goal.startDate,
        goal.endDate,
        goal.whyItMatters,
        goal.xpTarget,
        goal.buildHealth,
        goal.currentPhase,
        goal.difficultyPhase,
        goal.lastCompletedDate,
        goal.performanceStatus,
        goal.updatedAt,
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
           anchor_drift = ?,
           description = ?,
           start_date = ?,
           end_date = ?,
           why_it_matters = ?,
           xp_target = ?,
           updated_at = ?
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
        cleanText(input.description),
        cleanText(input.startDate) || null,
        normalized.targetDate,
        cleanText(input.whyItMatters) || normalized.anchorWhy,
        input.xpTarget ?? 0,
        Date.now(),
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
