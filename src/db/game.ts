import type * as SQLite from 'expo-sqlite';
import type {
  DailyRequirement,
  DailyTask,
  DailyXpRow,
  DifficultyPhase,
  GameStats,
  Goal,
  GoalPerformanceStatus,
  TaskTier,
  WeeklyInspection,
} from '../types';
import { TIER_XP } from '../types';
import { formatDate, getWeekStart, todayString } from '../utils/dates';
import { generateId } from '../utils/ids';
import { calculateWeeklyInspection } from '../utils/weeklyInspection';
import { runDb } from './schema';

const MS_PER_DAY = 86_400_000;
const WORKING_DAYS_PER_WEEK = 5;
const MAX_DIFFICULTY_PHASE: DifficultyPhase = 4;
const RECOVERY_HEALTH_RESTORE = 10;

const RECOVERY_TASKS: Array<{ title: string; tier: TaskTier; nextStep: string; effortLevel: DailyTask['effortLevel'] }> = [
  {
    title: 'Do the next concrete step on your goal',
    tier: 2,
    nextStep: 'Open the goal, identify the single next action, and do it now.',
    effortLevel: 'medium',
  },
  {
    title: 'Clear 3 open loops related to your goal',
    tier: 2,
    nextStep: 'Identify 3 things that are partially done and close or discard them.',
    effortLevel: 'medium',
  },
  {
    title: 'Review your goal and why it matters',
    tier: 1,
    nextStep: 'Re-read the goal, the why, and write down one thing you can do today.',
    effortLevel: 'light',
  },
  {
    title: 'Spend 25 minutes on the hardest part',
    tier: 3,
    nextStep: 'Set a timer for 25 minutes and work on the thing you have been avoiding.',
    effortLevel: 'challenging',
  },
];

function normalizeDifficultyPhase(value: number | null | undefined): DifficultyPhase {
  if (value === 2 || value === 3 || value === 4) return value;
  return 1;
}

export function getDailyRequirement(
  goal: Pick<Goal, 'difficultyPhase'> | { difficultyPhase?: number | null }
): DailyRequirement {
  const phase = normalizeDifficultyPhase(goal.difficultyPhase);
  if (phase === 4) {
    return {
      phase,
      phaseName: 'Operator Mode',
      tasksRequired: 3,
      minimumTier: null,
      weeklyHardTaskRequired: true,
      missPenalty: 15,
      minimumCopy: 'Minimum required: 3 tasks.',
    };
  }
  if (phase === 3) {
    return {
      phase,
      phaseName: 'Real Work',
      tasksRequired: 3,
      minimumTier: 2,
      weeklyHardTaskRequired: false,
      missPenalty: 10,
      minimumCopy: 'Minimum required: 3 tasks, with at least 1 T2+.',
    };
  }
  if (phase === 2) {
    return {
      phase,
      phaseName: 'Build Rhythm',
      tasksRequired: 2,
      minimumTier: null,
      weeklyHardTaskRequired: false,
      missPenalty: 5,
      minimumCopy: 'Minimum required: 2 tasks.',
    };
  }
  return {
    phase,
    phaseName: 'Show Up',
    tasksRequired: 1,
    minimumTier: null,
    weeklyHardTaskRequired: false,
    missPenalty: 2,
    minimumCopy: 'Minimum required: 1 task.',
  };
}

export function isValidDay(
  goal: Pick<Goal, 'difficultyPhase'> | { difficultyPhase?: number | null },
  tasks: Array<Pick<DailyTask, 'status' | 'tier'>>
): boolean {
  const requirement = getDailyRequirement(goal);
  const completed = tasks.filter((task) => task.status === 'done');
  if (completed.length < requirement.tasksRequired) return false;
  if (requirement.minimumTier) {
    return completed.some((task) => (task.tier ?? 1) >= requirement.minimumTier!);
  }
  return true;
}

export function applyMissedDayPenalty<
  T extends Pick<Goal, 'buildHealth' | 'healthScore' | 'performanceStatus' | 'difficultyPhase'>,
>(goal: T): T {
  const requirement = getDailyRequirement(goal);
  const currentHealth = goal.buildHealth ?? goal.healthScore ?? 100;
  const nextHealth = Math.max(0, currentHealth - requirement.missPenalty);
  const shouldDecay = nextHealth < 60;

  return {
    ...goal,
    buildHealth: nextHealth,
    healthScore: nextHealth,
    performanceStatus: shouldDecay ? 'decaying' : goal.performanceStatus,
  };
}

export function maybeUpgradeDifficultyPhase<T extends Pick<Goal, 'difficultyPhase'>>(
  goal: T,
  inspections: Array<Pick<WeeklyInspection, 'result'>> = []
): T {
  const currentPhase = normalizeDifficultyPhase(goal.difficultyPhase);
  const latestTwo = inspections.slice(0, 2);
  const passedTwoInARow = latestTwo.length === 2 && latestTwo.every((row) => row.result === 'pass');
  if (!passedTwoInARow || currentPhase >= MAX_DIFFICULTY_PHASE) return goal;
  return {
    ...goal,
    difficultyPhase: (currentPhase + 1) as DifficultyPhase,
  };
}

export function dbComputeDailyExpectation(goalCreatedAtMs: number, asOfMs: number): number {
  return getDailyRequirement({ difficultyPhase: calculateDifficultyPhase(goalCreatedAtMs, asOfMs) }).tasksRequired;
}

export function calculateDifficultyPhase(goalCreatedAtMs: number, asOfMs = Date.now()): DifficultyPhase {
  const weeksElapsed = Math.floor((asOfMs - goalCreatedAtMs) / (7 * MS_PER_DAY));
  if (weeksElapsed >= 6) return 4;
  if (weeksElapsed >= 4) return 3;
  if (weeksElapsed >= 2) return 2;
  return 1;
}

function computeTargetXp(goalCreatedAtMs: number, targetDateStr: string | null): number {
  const now = Date.now();
  const end = targetDateStr ? new Date(targetDateStr).getTime() : now + 90 * MS_PER_DAY;
  const totalDays = Math.max(1, Math.round((end - goalCreatedAtMs) / MS_PER_DAY));
  const totalWeeks = totalDays / 7;
  const workingDays = Math.round(totalWeeks * WORKING_DAYS_PER_WEEK);
  return Math.max(1, workingDays * TIER_XP[2]);
}

export function calculateBuildPhase(totalXp: number, targetXp: number): 1 | 2 | 3 | 4 | 5 {
  if (targetXp <= 0) return 1;
  const ratio = totalXp / targetXp;
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.6) return 4;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

export function calculateGoalStatus(input: {
  xpTotal: number;
  xpTarget: number;
  buildHealth: number;
  lastCompletedDate?: string | null;
  createdAt?: number;
  asOfMs?: number;
}): GoalPerformanceStatus {
  const asOfMs = input.asOfMs ?? Date.now();
  const daysSinceCompletion = input.lastCompletedDate
    ? Math.floor((asOfMs - new Date(input.lastCompletedDate).getTime()) / MS_PER_DAY)
    : null;

  if (input.buildHealth < 60 || (daysSinceCompletion !== null && daysSinceCompletion >= 7)) {
    return 'decaying';
  }

  const ratio = input.xpTarget > 0 ? input.xpTotal / input.xpTarget : 1;
  const daysSinceCreated = input.createdAt
    ? Math.floor((asOfMs - input.createdAt) / MS_PER_DAY)
    : 0;

  if (ratio >= 1.1) return 'ahead';
  if (daysSinceCreated >= 7 && ratio < 0.75) return 'behind';
  return 'on_track';
}

function getStatusCopy(requirement: DailyRequirement, status: GoalPerformanceStatus): string {
  if (status === 'decaying') {
    return 'Build health damaged. Recovery task assigned.';
  }
  if (requirement.phase === 4) {
    return 'Operator Mode unlocked. Expectations increased.';
  }
  return requirement.minimumCopy;
}

function getRecoveryTaskForDate(date: string): (typeof RECOVERY_TASKS)[number] {
  const charTotal = date.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return RECOVERY_TASKS[charTotal % RECOVERY_TASKS.length];
}

function mapXpRow(row: {
  id: string;
  goal_id: string;
  date: string;
  xp_earned: number;
  expectation: number;
  met: number;
}): DailyXpRow {
  return {
    id: row.id,
    goalId: row.goal_id,
    date: row.date,
    xpEarned: row.xp_earned,
    expectation: row.expectation,
    met: row.met === 1,
  };
}

export function dbGetGameStats(goalId: string): GameStats | null {
  return runDb('get game stats', null, (db) => {
    const goal = db.getFirstSync<{
      created_at: number;
      target_date: string | null;
      total_xp: number;
      current_streak: number;
      build_health: number;
      xp_target: number | null;
      difficulty_phase: number | null;
      performance_status: GoalPerformanceStatus | null;
    }>(
      'SELECT created_at, target_date, total_xp, current_streak, build_health, xp_target, difficulty_phase, performance_status FROM goals WHERE id = ?',
      [goalId]
    );
    if (!goal) return null;

    const targetXp = goal.xp_target && goal.xp_target > 0
      ? goal.xp_target
      : computeTargetXp(goal.created_at, goal.target_date);
    const buildStage = calculateBuildPhase(goal.total_xp, targetXp);
    const dailyRequirement = getDailyRequirement({ difficultyPhase: goal.difficulty_phase });

    const rows = db.getAllSync<{
      id: string;
      goal_id: string;
      date: string;
      xp_earned: number;
      expectation: number;
      met: number;
    }>(
      'SELECT id, goal_id, date, xp_earned, expectation, met FROM daily_xp WHERE goal_id = ? ORDER BY date DESC LIMIT 7',
      [goalId]
    );

    return {
      totalXp: goal.total_xp,
      currentStreak: goal.current_streak,
      buildHealth: goal.build_health ?? 100,
      targetXp,
      buildStage,
      dailyExpectation: dailyRequirement.tasksRequired,
      difficultyPhase: dailyRequirement.phase,
      dailyRequirement,
      statusCopy: getStatusCopy(dailyRequirement, goal.performance_status ?? 'on_track'),
      last7Days: rows.map(mapXpRow),
    };
  });
}

export function dbCalculateBuildPhase(goalId: string): 1 | 2 | 3 | 4 | 5 {
  return runDb('calculate build phase', 1, (db) => {
    const goal = db.getFirstSync<{ total_xp: number; xp_target: number | null; created_at: number; target_date: string | null }>(
      'SELECT total_xp, xp_target, created_at, target_date FROM goals WHERE id = ?',
      [goalId]
    );
    if (!goal) return 1;
    const targetXp = goal.xp_target && goal.xp_target > 0
      ? goal.xp_target
      : computeTargetXp(goal.created_at, goal.target_date);
    const phase = calculateBuildPhase(goal.total_xp, targetXp);
    db.runSync('UPDATE goals SET current_phase = ?, updated_at = ? WHERE id = ?', [
      phase,
      Date.now(),
      goalId,
    ]);
    return phase;
  });
}

export function dbCalculateDifficultyPhase(goalId: string): DifficultyPhase {
  return runDb('calculate difficulty phase', 1, (db) => {
    const goal = db.getFirstSync<{ difficulty_phase: number | null }>(
      'SELECT difficulty_phase FROM goals WHERE id = ?',
      [goalId]
    );
    if (!goal) return 1;
    return normalizeDifficultyPhase(goal.difficulty_phase);
  });
}

export function dbCalculateGoalStatus(goalId: string): GoalPerformanceStatus {
  return runDb('calculate goal status', 'on_track' as GoalPerformanceStatus, (db) => {
    const goal = db.getFirstSync<{
      created_at: number;
      target_date: string | null;
      total_xp: number;
      xp_target: number | null;
      health_score: number;
      build_health: number | null;
      last_completed_date: string | null;
    }>(
      'SELECT created_at, target_date, total_xp, xp_target, health_score, build_health, last_completed_date FROM goals WHERE id = ?',
      [goalId]
    );
    if (!goal) return 'on_track';
    const targetXp = goal.xp_target && goal.xp_target > 0
      ? goal.xp_target
      : computeTargetXp(goal.created_at, goal.target_date);
    const status = calculateGoalStatus({
      xpTotal: goal.total_xp,
      xpTarget: targetXp,
      buildHealth: goal.build_health ?? goal.health_score,
      lastCompletedDate: goal.last_completed_date,
      createdAt: goal.created_at,
    });
    db.runSync('UPDATE goals SET performance_status = ?, updated_at = ? WHERE id = ?', [
      status,
      Date.now(),
      goalId,
    ]);
    return status;
  });
}

export function dbUpsertDailyXp(goalId: string, date: string): DailyXpRow | null {
  return runDb('upsert daily xp', null, (db) => {
    const goal = db.getFirstSync<{ created_at: number; total_xp: number; difficulty_phase: number | null }>(
      'SELECT created_at, total_xp, difficulty_phase FROM goals WHERE id = ?',
      [goalId]
    );
    if (!goal) return null;

    const completedTasks = db.getAllSync<{ status: DailyTask['status']; tier: TaskTier }>(
      `SELECT status, tier
       FROM daily_tasks
       WHERE goal_id = ? AND date = ? AND status = 'done'`,
      [goalId, date]
    );
    const xpResult = db.getFirstSync<{ xp: number }>(
      `SELECT COALESCE(SUM(CASE
        WHEN tier = 1 THEN ${TIER_XP[1]}
        WHEN tier = 2 THEN ${TIER_XP[2]}
        WHEN tier = 3 THEN ${TIER_XP[3]}
        WHEN tier = 4 THEN ${TIER_XP[4]}
        WHEN tier = 5 THEN ${TIER_XP[5]}
        ELSE ${TIER_XP[2]}
       END), 0) AS xp
       FROM daily_tasks
       WHERE goal_id = ? AND date = ? AND status = 'done'`,
      [goalId, date]
    );
    const xpEarned = xpResult?.xp ?? 0;
    const requirement = getDailyRequirement({ difficultyPhase: goal.difficulty_phase });
    const expectation = requirement.tasksRequired;
    const met = isValidDay({ difficultyPhase: goal.difficulty_phase }, completedTasks) ? 1 : 0;

    const existing = db.getFirstSync<{ id: string; xp_earned: number }>(
      'SELECT id, xp_earned FROM daily_xp WHERE goal_id = ? AND date = ?',
      [goalId, date]
    );

    if (existing) {
      db.runSync(
        'UPDATE daily_xp SET xp_earned = ?, expectation = ?, met = ? WHERE id = ?',
        [xpEarned, expectation, met, existing.id]
      );
      const delta = xpEarned - existing.xp_earned;
      if (delta !== 0) {
        db.runSync(
          'UPDATE goals SET total_xp = MAX(0, total_xp + ?), updated_at = ? WHERE id = ?',
          [delta, Date.now(), goalId]
        );
      }
      if (met !== 1) dbApplyMissedDayPenalty(db, goalId, date);
      return mapXpRow({ id: existing.id, goal_id: goalId, date, xp_earned: xpEarned, expectation, met });
    }

    const id = generateId();
    db.runSync(
      'INSERT INTO daily_xp (id, goal_id, date, xp_earned, expectation, met) VALUES (?, ?, ?, ?, ?, ?)',
      [id, goalId, date, xpEarned, expectation, met]
    );
    db.runSync(
      'UPDATE goals SET total_xp = MAX(0, total_xp + ?), updated_at = ? WHERE id = ?',
      [xpEarned, Date.now(), goalId]
    );
    if (met !== 1) dbApplyMissedDayPenalty(db, goalId, date);
    return mapXpRow({ id, goal_id: goalId, date, xp_earned: xpEarned, expectation, met });
  });
}

function dbApplyMissedDayPenalty(db: SQLite.SQLiteDatabase, goalId: string, missedDate: string): void {
  const goal = db.getFirstSync<{
    build_health: number | null;
    health_score: number;
    performance_status: GoalPerformanceStatus | null;
    difficulty_phase: number | null;
  }>(
    'SELECT build_health, health_score, performance_status, difficulty_phase FROM goals WHERE id = ?',
    [goalId]
  );
  if (!goal) return;
  const nextGoal = applyMissedDayPenalty({
    buildHealth: goal.build_health ?? goal.health_score,
    healthScore: goal.health_score,
    performanceStatus: goal.performance_status ?? 'on_track',
    difficultyPhase: normalizeDifficultyPhase(goal.difficulty_phase),
  });
  db.runSync(
    'UPDATE goals SET build_health = ?, health_score = ?, performance_status = ?, updated_at = ? WHERE id = ?',
    [nextGoal.buildHealth, nextGoal.healthScore, nextGoal.performanceStatus, Date.now(), goalId]
  );
}

function dbAssignRecoveryTaskForWeek(
  db: SQLite.SQLiteDatabase,
  goalId: string,
  weekStart: string,
  recoveryDate = todayString()
): boolean {
  const taskCount = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM daily_tasks WHERE date = ? AND status != 'dropped'",
    [recoveryDate]
  )?.count ?? 0;
  // Bug 2: respect daily task cap — never push the day above 3 tasks
  if (taskCount >= 3) return false;
  const now = Date.now();
  const recoveryTask = getRecoveryTaskForDate(weekStart);
  db.runSync(
    `INSERT INTO daily_tasks (
      id, goal_id, title, next_step, date, status, completed_at, sort_order, created_at,
      task_type, effort_level, phase_id, focus_duration_minutes, break_duration_minutes,
      tier, is_recovery_task, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      goalId,
      recoveryTask.title,
      recoveryTask.nextStep,
      recoveryDate,
      'pending',
      null,
      taskCount,
      now,
      'goal',
      recoveryTask.effortLevel,
      'phase2',
      25,
      5,
      recoveryTask.tier,
      1,
      now,
    ]
  );
  return true;
}

export function dbRecordWeeklyInspectionForActiveGoal(
  db: SQLite.SQLiteDatabase,
  weekStart: string
): WeeklyInspection | null {
  const goal = db.getFirstSync<{ id: string; difficulty_phase: number | null; build_health: number | null; health_score: number }>(
    "SELECT id, difficulty_phase, build_health, health_score FROM goals WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
  );
  if (!goal) return null;

  const calculation = calculateWeeklyInspection({
    weekStart,
    difficultyPhase: normalizeDifficultyPhase(goal.difficulty_phase),
    dailyRows: db.getAllSync<{ date: string; xpEarned: number; met: boolean }>(
      'SELECT date, xp_earned AS xpEarned, CASE WHEN met = 1 THEN 1 ELSE 0 END AS met FROM daily_xp WHERE goal_id = ?',
      [goal.id]
    ),
    tasks: db.getAllSync<{ date: string; status: DailyTask['status']; tier: TaskTier | null }>(
      'SELECT date, status, tier FROM daily_tasks WHERE goal_id = ?',
      [goal.id]
    ),
  });
  const existing = db.getFirstSync<{ id: string; recovery_task_created: number; health_change: number | null }>(
    'SELECT id, recovery_task_created, health_change FROM weekly_inspections WHERE goal_id = ? AND week_start = ?',
    [goal.id, weekStart]
  );
  const priorHealthChange = existing?.health_change ?? 0;
  const recoveryTaskCreated =
    calculation.result === 'fail' && existing?.recovery_task_created !== 1
      ? dbAssignRecoveryTaskForWeek(db, goal.id, weekStart)
      : false;
  const currentHealth = goal.build_health ?? goal.health_score ?? 100;
  const nextHealth = Math.max(0, Math.min(100, currentHealth - priorHealthChange + calculation.buildHealthChange));
  const nextStatus: GoalPerformanceStatus = nextHealth < 60 ? 'decaying' : 'on_track';
  db.runSync(
    'UPDATE goals SET build_health = ?, health_score = ?, performance_status = ?, updated_at = ? WHERE id = ?',
    [nextHealth, nextHealth, nextStatus, Date.now(), goal.id]
  );

  const inspection: WeeklyInspection = {
    id: existing?.id ?? generateId(),
    goalId: goal.id,
    weekStart,
    weekEnd: calculation.weekEnd,
    xpEarned: calculation.xpEarned,
    tasksCompleted: calculation.tasksCompleted,
    hardTasksCompleted: calculation.hardTasksCompleted,
    validDays: calculation.validDays,
    buildHealthChange: calculation.buildHealthChange,
    result: calculation.result,
    recoveryTaskCreated: recoveryTaskCreated || existing?.recovery_task_created === 1,
    createdAt: Date.now(),
  };

  if (existing) {
    db.runSync(
      `UPDATE weekly_inspections
       SET week_end = ?, xp_earned = ?, tasks_completed = ?, hard_tasks_completed = ?,
           valid_days = ?, health_change = ?, result = ?, recovery_task_created = ?, created_at = ?
       WHERE id = ?`,
      [
        inspection.weekEnd,
        inspection.xpEarned,
        inspection.tasksCompleted,
        inspection.hardTasksCompleted,
        inspection.validDays,
        inspection.buildHealthChange,
        inspection.result,
        inspection.recoveryTaskCreated ? 1 : 0,
        inspection.createdAt,
        existing.id,
      ]
    );
  } else {
    db.runSync(
      `INSERT INTO weekly_inspections
        (id, goal_id, week_start, week_end, xp_earned, tasks_completed, hard_tasks_completed, valid_days, health_change, result, recovery_task_created, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inspection.id,
        inspection.goalId,
        inspection.weekStart,
        inspection.weekEnd,
        inspection.xpEarned,
        inspection.tasksCompleted,
        inspection.hardTasksCompleted,
        inspection.validDays,
        inspection.buildHealthChange,
        inspection.result,
        inspection.recoveryTaskCreated ? 1 : 0,
        inspection.createdAt,
      ]
    );
  }

  // Bug 6: apply difficulty phase upgrade immediately if two consecutive passes
  const latestInspections = db.getAllSync<{ result: WeeklyInspection['result'] }>(
    'SELECT result FROM weekly_inspections WHERE goal_id = ? ORDER BY week_start DESC LIMIT 2',
    [goal.id]
  );
  const upgraded = maybeUpgradeDifficultyPhase(
    { difficultyPhase: normalizeDifficultyPhase(goal.difficulty_phase) },
    latestInspections
  );
  if (upgraded.difficultyPhase !== normalizeDifficultyPhase(goal.difficulty_phase)) {
    db.runSync('UPDATE goals SET difficulty_phase = ?, updated_at = ? WHERE id = ?', [
      upgraded.difficultyPhase,
      Date.now(),
      goal.id,
    ]);
  }

  return inspection;
}

export function dbRunWeeklyInspection(weekStart = getWeekStart()): WeeklyInspection | null {
  return runDb('run weekly inspection', null, (db) => dbRecordWeeklyInspectionForActiveGoal(db, weekStart));
}

export function dbMaybeUpgradeDifficultyPhase(goalId: string): DifficultyPhase {
  return runDb('maybe upgrade difficulty phase', 1, (db) => {
    const goal = db.getFirstSync<{ difficulty_phase: number | null }>(
      'SELECT difficulty_phase FROM goals WHERE id = ?',
      [goalId]
    );
    if (!goal) return 1;
    const inspections = db.getAllSync<{ result: WeeklyInspection['result'] }>(
      'SELECT result FROM weekly_inspections WHERE goal_id = ? ORDER BY week_start DESC LIMIT 2',
      [goalId]
    );
    const nextGoal = maybeUpgradeDifficultyPhase(
      { difficultyPhase: normalizeDifficultyPhase(goal.difficulty_phase) },
      inspections
    );
    if (nextGoal.difficultyPhase !== normalizeDifficultyPhase(goal.difficulty_phase)) {
      db.runSync('UPDATE goals SET difficulty_phase = ?, updated_at = ? WHERE id = ?', [
        nextGoal.difficultyPhase,
        Date.now(),
        goalId,
      ]);
    }
    return nextGoal.difficultyPhase;
  });
}

export function dbRecalcStreakAndHealth(goalId: string): boolean {
  return runDb('recalc streak and health', false, (db) => {
    const goal = db.getFirstSync<{
      difficulty_phase: number | null;
      total_xp: number;
      xp_target: number | null;
      created_at: number;
      target_date: string | null;
    }>(
      'SELECT difficulty_phase, total_xp, xp_target, created_at, target_date FROM goals WHERE id = ?',
      [goalId]
    );
    const requirement = getDailyRequirement({ difficultyPhase: goal?.difficulty_phase });
    const rows = db.getAllSync<{ date: string; met: number }>(
      'SELECT date, met FROM daily_xp WHERE goal_id = ? ORDER BY date DESC LIMIT 60',
      [goalId]
    );
    if (rows.length === 0) {
      db.runSync(
        'UPDATE goals SET current_streak = 0, streak_date = ?, health_score = 100, build_health = 100, updated_at = ? WHERE id = ?',
        [todayString(), Date.now(), goalId]
      );
      return true;
    }

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = formatDate(yesterdayDate);

    let streak = 0;
    let prevDate: string | null = null;
    for (const row of rows) {
      if (row.met !== 1) break;
      if (prevDate !== null) {
        const diff = (new Date(prevDate).getTime() - new Date(row.date).getTime()) / MS_PER_DAY;
        if (diff > 1) break;
      }
      streak++;
      prevDate = row.date;
    }
    // Bug 3: break streak if most recent activity was before yesterday (gap day)
    if (streak > 0 && rows[0].date < yesterday) {
      streak = 0;
    }

    let health = 100;
    for (let i = rows.length - 1; i >= 0; i--) {
      health = rows[i].met === 1
        ? Math.min(100, health + 2)
        : Math.max(0, health - requirement.missPenalty);
    }
    const recoveryTaskCount = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM daily_tasks WHERE goal_id = ? AND is_recovery_task = 1 AND status = 'done'",
      [goalId]
    )?.count ?? 0;
    const inspectionHealthChange = db.getFirstSync<{ total: number }>(
      'SELECT COALESCE(SUM(health_change), 0) AS total FROM weekly_inspections WHERE goal_id = ?',
      [goalId]
    )?.total ?? 0;
    health = Math.max(0, Math.min(100, health + recoveryTaskCount * RECOVERY_HEALTH_RESTORE + inspectionHealthChange));

    // Bug 4: apply miss penalty for calendar days with no daily_xp entry
    if (rows.length > 0 && rows[0].date <= yesterday) {
      const gapToYesterday = Math.round(
        (new Date(yesterday).getTime() - new Date(rows[0].date).getTime()) / MS_PER_DAY
      );
      if (gapToYesterday > 0) {
        health = Math.max(0, health - gapToYesterday * requirement.missPenalty);
      }
    }
    for (let i = 0; i < rows.length - 1; i++) {
      const gap = Math.round(
        (new Date(rows[i].date).getTime() - new Date(rows[i + 1].date).getTime()) / MS_PER_DAY
      ) - 1;
      if (gap > 0) {
        health = Math.max(0, health - gap * requirement.missPenalty);
      }
    }
    health = Math.max(0, Math.min(100, health));

    const streakDate = rows[0]?.date ?? todayString();
    // Bug 1: use actual goal XP values (not hardcoded 0/1) for performance status
    const xpTarget = (goal?.xp_target && goal.xp_target > 0)
      ? goal.xp_target
      : computeTargetXp(goal?.created_at ?? Date.now(), goal?.target_date ?? null);
    const performanceStatus: GoalPerformanceStatus =
      calculateGoalStatus({
        xpTotal: goal?.total_xp ?? 0,
        xpTarget,
        buildHealth: health,
        lastCompletedDate: streak > 0 ? streakDate : '',
        createdAt: goal?.created_at,
      });
    db.runSync(
      'UPDATE goals SET current_streak = ?, streak_date = ?, health_score = ?, build_health = ?, last_completed_date = ?, performance_status = ?, updated_at = ? WHERE id = ?',
      [streak, streakDate, health, health, streak > 0 ? streakDate : '', performanceStatus, Date.now(), goalId]
    );
    dbCalculateBuildPhase(goalId);
    dbMaybeUpgradeDifficultyPhase(goalId);
    return true;
  });
}
