import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'focus-web.sqlite');
const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);
const FOCUS_RESUME_WINDOW_MS = 36 * 60 * 60 * 1000;
const DAILY_TASK_CAP = 3;
const DEFAULT_FOCUS_MINUTES = 50;
const DEFAULT_BREAK_MINUTES = 10;

fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(dbPath);

bootstrapDatabase();

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.url !== '/api/rpc' || req.method !== 'POST') {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const method = body?.method;
    const params = body?.params ?? {};

    if (typeof method !== 'string' || !(method in commands)) {
      sendJson(res, 400, { error: 'unknown_method' });
      return;
    }

    const result = commands[method](params);
    sendJson(res, 200, { ok: true, data: result });
  } catch (error) {
    console.error('[server]', error);
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : 'server_error',
    });
  }
});

server.listen(PORT, () => {
  console.log(`Focus API listening on http://localhost:${PORT}`);
});

function bootstrapDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS app_context (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_outcome TEXT NOT NULL DEFAULT '',
      target_date TEXT,
      metric TEXT NOT NULL DEFAULT '',
      why TEXT NOT NULL,
      practical_reason TEXT NOT NULL DEFAULT '',
      emotional_reason TEXT NOT NULL DEFAULT '',
      cost_of_drift TEXT NOT NULL DEFAULT '',
      anchor_why TEXT NOT NULL DEFAULT '',
      anchor_drift TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS weekly_focuses (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      focus TEXT NOT NULL,
      week_of TEXT NOT NULL,
      notes TEXT DEFAULT '',
      FOREIGN KEY (goal_id) REFERENCES goals(id)
    );

    CREATE TABLE IF NOT EXISTS daily_tasks (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      weekly_focus_id TEXT,
      source_task_id TEXT,
      title TEXT NOT NULL,
      next_step TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (goal_id) REFERENCES goals(id)
    );

    CREATE TABLE IF NOT EXISTS weekly_reviews (
      id TEXT PRIMARY KEY,
      week_of TEXT NOT NULL,
      completed_at INTEGER NOT NULL,
      wins TEXT DEFAULT '',
      what_drifted TEXT DEFAULT '',
      drift_reasons TEXT NOT NULL DEFAULT '',
      next_week_adjustment TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      exit_reason TEXT DEFAULT '',
      last_heartbeat_at INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES daily_tasks(id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_tasks_date_status
      ON daily_tasks(date, status);
    CREATE INDEX IF NOT EXISTS idx_daily_tasks_source_task_id
      ON daily_tasks(source_task_id);
    CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_started
      ON focus_sessions(task_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_focus_sessions_status_started
      ON focus_sessions(status, started_at DESC);
  `);

  ensureColumn('daily_tasks', 'phase_id', "ALTER TABLE daily_tasks ADD COLUMN phase_id TEXT NOT NULL DEFAULT 'phase1'");
  ensureColumn('daily_tasks', 'project_id', 'ALTER TABLE daily_tasks ADD COLUMN project_id TEXT');
  ensureColumn('daily_tasks', 'task_type', "ALTER TABLE daily_tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'goal'");
  ensureColumn('daily_tasks', 'effort_level', "ALTER TABLE daily_tasks ADD COLUMN effort_level TEXT NOT NULL DEFAULT ''");
  ensureColumn('daily_tasks', 'milestone_id', 'ALTER TABLE daily_tasks ADD COLUMN milestone_id TEXT');
  ensureColumn(
    'daily_tasks',
    'scheduled_window_start',
    "ALTER TABLE daily_tasks ADD COLUMN scheduled_window_start TEXT NOT NULL DEFAULT ''"
  );
  ensureColumn(
    'daily_tasks',
    'focus_duration_minutes',
    `ALTER TABLE daily_tasks ADD COLUMN focus_duration_minutes INTEGER NOT NULL DEFAULT ${DEFAULT_FOCUS_MINUTES}`
  );
  ensureColumn(
    'daily_tasks',
    'break_duration_minutes',
    `ALTER TABLE daily_tasks ADD COLUMN break_duration_minutes INTEGER NOT NULL DEFAULT ${DEFAULT_BREAK_MINUTES}`
  );
  ensureColumn(
    'goals',
    'current_friction_minutes',
    'ALTER TABLE goals ADD COLUMN current_friction_minutes INTEGER NOT NULL DEFAULT 2'
  );
  ensureColumn(
    'goals',
    'weekly_seated_seconds',
    'ALTER TABLE goals ADD COLUMN weekly_seated_seconds INTEGER NOT NULL DEFAULT 0'
  );
  ensureColumn(
    'goals',
    'weekly_seated_week_of',
    "ALTER TABLE goals ADD COLUMN weekly_seated_week_of TEXT NOT NULL DEFAULT ''"
  );

  // Gamification — v11
  ensureColumn('daily_tasks', 'tier', 'ALTER TABLE daily_tasks ADD COLUMN tier INTEGER NOT NULL DEFAULT 2');
  ensureColumn('daily_tasks', 'linked_site', 'ALTER TABLE daily_tasks ADD COLUMN linked_site TEXT');
  ensureColumn('daily_tasks', 'is_recovery_task', 'ALTER TABLE daily_tasks ADD COLUMN is_recovery_task INTEGER NOT NULL DEFAULT 0');
  ensureColumn('daily_tasks', 'updated_at', 'ALTER TABLE daily_tasks ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');
  ensureColumn('goals', 'total_xp', 'ALTER TABLE goals ADD COLUMN total_xp INTEGER NOT NULL DEFAULT 0');
  ensureColumn('goals', 'current_streak', 'ALTER TABLE goals ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0');
  ensureColumn('goals', 'streak_date', "ALTER TABLE goals ADD COLUMN streak_date TEXT NOT NULL DEFAULT ''");
  ensureColumn('goals', 'health_score', 'ALTER TABLE goals ADD COLUMN health_score INTEGER NOT NULL DEFAULT 100');
  ensureColumn('goals', 'description', "ALTER TABLE goals ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  ensureColumn('goals', 'start_date', 'ALTER TABLE goals ADD COLUMN start_date TEXT');
  ensureColumn('goals', 'end_date', 'ALTER TABLE goals ADD COLUMN end_date TEXT');
  ensureColumn('goals', 'why_it_matters', "ALTER TABLE goals ADD COLUMN why_it_matters TEXT NOT NULL DEFAULT ''");
  ensureColumn('goals', 'xp_target', 'ALTER TABLE goals ADD COLUMN xp_target INTEGER NOT NULL DEFAULT 0');
  ensureColumn('goals', 'build_health', 'ALTER TABLE goals ADD COLUMN build_health INTEGER NOT NULL DEFAULT 100');
  ensureColumn('goals', 'current_phase', 'ALTER TABLE goals ADD COLUMN current_phase INTEGER NOT NULL DEFAULT 1');
  ensureColumn('goals', 'difficulty_phase', 'ALTER TABLE goals ADD COLUMN difficulty_phase INTEGER NOT NULL DEFAULT 1');
  ensureColumn('goals', 'last_completed_date', "ALTER TABLE goals ADD COLUMN last_completed_date TEXT NOT NULL DEFAULT ''");
  ensureColumn('goals', 'performance_status', "ALTER TABLE goals ADD COLUMN performance_status TEXT NOT NULL DEFAULT 'on_track'");
  ensureColumn('goals', 'updated_at', 'ALTER TABLE goals ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_xp (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      date TEXT NOT NULL,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      expectation INTEGER NOT NULL DEFAULT 0,
      met INTEGER NOT NULL DEFAULT 0,
      UNIQUE(goal_id, date),
      FOREIGN KEY (goal_id) REFERENCES goals(id)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_xp_goal_date ON daily_xp(goal_id, date DESC);

    CREATE TABLE IF NOT EXISTS weekly_inspections (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      tasks_completed INTEGER NOT NULL DEFAULT 0,
      hard_tasks_completed INTEGER NOT NULL DEFAULT 0,
      result TEXT NOT NULL DEFAULT 'partial',
      recovery_task_created INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(goal_id, week_start),
      FOREIGN KEY (goal_id) REFERENCES goals(id)
    );
    CREATE INDEX IF NOT EXISTS idx_weekly_inspections_goal_week
      ON weekly_inspections(goal_id, week_start DESC);

    UPDATE goals SET end_date = target_date WHERE end_date IS NULL AND target_date IS NOT NULL;
    UPDATE goals SET why_it_matters = COALESCE(NULLIF(anchor_why, ''), why) WHERE TRIM(COALESCE(why_it_matters, '')) = '';
    UPDATE goals SET build_health = health_score WHERE build_health = 100 AND health_score != 100;
    UPDATE goals SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = 0;
    UPDATE daily_tasks SET updated_at = COALESCE(completed_at, created_at) WHERE updated_at IS NULL OR updated_at = 0;
  `);
}

function hasColumn(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

function ensureColumn(tableName, columnName, sql) {
  if (!hasColumn(tableName, columnName)) {
    db.exec(sql);
  }
}

const commands = {
  getAppBootstrap() {
    return {
      onboardingComplete: isOnboardingComplete(),
      resumeContext: refreshResumeContext(),
      reviewDue: isReviewDue(),
    };
  },
  getActiveGoal() {
    return getActiveGoal();
  },
  createDefaultGoal() {
    return createDefaultGoal();
  },
  createGoal({ input }) {
    return createGoal(input);
  },
  updateGoal({ id, input }) {
    return updateGoal(id, input);
  },
  completeGoal({ id }) {
    return completeGoal(id);
  },
  getCurrentWeeklyFocus({ goalId }) {
    return getCurrentWeeklyFocus(goalId);
  },
  upsertWeeklyFocus({ goalId, focus }) {
    return upsertWeeklyFocus(goalId, focus);
  },
  getTodayTasks() {
    return getTasksForDate(todayString());
  },
  getTasksForDate({ date }) {
    return getTasksForDate(date);
  },
  getTaskById({ id }) {
    return getTaskById(id);
  },
  createTask({ title, goalId, weeklyFocusId = null, nextStep = '', projectId = null, tier, options = {} }) {
    return createTask(title, goalId, weeklyFocusId, nextStep, { ...options, projectId, tier });
  },
  carryForwardTask({ taskId }) {
    return carryForwardTask(taskId);
  },
  completeTask({ id }) {
    return completeTask(id);
  },
  uncompleteTask({ id }) {
    return uncompleteTask(id);
  },
  dropTask({ id }) {
    return dropTask(id);
  },
  getReviewForWeek({ weekOf }) {
    return getReviewForWeek(weekOf);
  },
  saveReview({ weekOf, wins, whatDrifted, driftReasons, nextWeekAdjustment }) {
    return saveReview(weekOf, wins, whatDrifted, driftReasons, nextWeekAdjustment);
  },
  isReviewDue() {
    return isReviewDue();
  },
  getTasksForWeek({ weekOf }) {
    return getTasksForWeek(weekOf);
  },
  isOnboardingComplete() {
    return isOnboardingComplete();
  },
  getOnboardingDraft() {
    return getOnboardingDraft();
  },
  saveOnboardingDraft({ draft }) {
    return saveOnboardingDraft(draft);
  },
  clearOnboardingDraft() {
    return clearOnboardingDraft();
  },
  completeOnboarding({ draft }) {
    return completeOnboarding(draft);
  },
  getFocusSessionById({ id }) {
    return getFocusSessionById(id);
  },
  startFocusSession({ taskId }) {
    return startFocusSession(taskId);
  },
  touchFocusSession({ id }) {
    return touchFocusSession(id);
  },
  completeFocusSession({ id }) {
    return completeFocusSession(id);
  },
  abandonFocusSession({ id, reason }) {
    return abandonFocusSession(id, reason);
  },
  getFocusSessionsForTask({ taskId }) {
    return getFocusSessionsForTask(taskId);
  },
  getFocusSessionsForWeek({ weekOf }) {
    return getFocusSessionsForWeek(weekOf);
  },
  getResumeContext() {
    return getResumeContext();
  },
  dismissResumeContext({ resumeContext }) {
    return dismissResumeContext(resumeContext);
  },
  refreshResumeContext() {
    return refreshResumeContext();
  },
  removeContext({ key }) {
    return removeContext(key);
  },

  // ── Gamification ──────────────────────────────────────────────────────────
  getGameStats({ goalId }) {
    return getGameStats(goalId);
  },
  upsertDailyXp({ goalId, date }) {
    return upsertDailyXp(goalId, date);
  },
  recalcStreakAndHealth({ goalId }) {
    return recalcStreakAndHealth(goalId);
  },
  calculateGoalStatus({ goalId }) {
    return calculateAndStoreGoalStatus(goalId);
  },
  calculateBuildPhase({ goalId }) {
    return calculateAndStoreBuildPhase(goalId);
  },
  calculateDifficultyPhase({ goalId }) {
    return calculateAndStoreDifficultyPhase(goalId);
  },
  maybeUpgradeDifficultyPhase({ goalId }) {
    return maybeUpgradeDifficultyPhaseForGoal(goalId);
  },
};

// ── Gamification helpers ────────────────────────────────────────────────────

const TIER_XP = { 1: 5, 2: 15, 3: 40, 4: 100, 5: 300 };
const MS_PER_DAY = 86_400_000;

function normalizeDifficultyPhase(value) {
  return value === 2 || value === 3 || value === 4 ? value : 1;
}

function getDailyRequirement(goal = {}) {
  const phase = normalizeDifficultyPhase(goal.difficultyPhase ?? goal.difficulty_phase);
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

function isValidDay(goal, tasks) {
  const requirement = getDailyRequirement(goal);
  const completed = tasks.filter((task) => task.status === 'done');
  if (completed.length < requirement.tasksRequired) return false;
  if (requirement.minimumTier) {
    return completed.some((task) => (task.tier ?? 1) >= requirement.minimumTier);
  }
  return true;
}

function applyMissedDayPenalty(goal) {
  const requirement = getDailyRequirement(goal);
  const currentHealth = goal.buildHealth ?? goal.build_health ?? goal.healthScore ?? goal.health_score ?? 100;
  const nextHealth = Math.max(0, currentHealth - requirement.missPenalty);
  const currentStatus = goal.performanceStatus ?? goal.performance_status ?? 'on_track';
  const shouldDecay =
    requirement.phase === 4 ||
    (requirement.phase === 3 && (currentStatus === 'decaying' || currentHealth <= 90));
  return {
    ...goal,
    buildHealth: nextHealth,
    healthScore: nextHealth,
    performanceStatus: shouldDecay ? 'decaying' : currentStatus,
  };
}

function maybeUpgradeDifficultyPhase(goal, inspections = []) {
  const currentPhase = normalizeDifficultyPhase(goal.difficultyPhase ?? goal.difficulty_phase);
  const latestTwo = inspections.slice(0, 2);
  const passedTwoInARow = latestTwo.length === 2 && latestTwo.every((row) => row.result === 'pass');
  if (!passedTwoInARow || currentPhase >= 4) return goal;
  return {
    ...goal,
    difficultyPhase: currentPhase + 1,
  };
}

function computeTargetXp(goalCreatedAtMs, targetDateStr) {
  const now = Date.now();
  const end = targetDateStr ? new Date(targetDateStr).getTime() : now + 90 * MS_PER_DAY;
  const totalDays = Math.max(1, Math.round((end - goalCreatedAtMs) / MS_PER_DAY));
  const workingDays = Math.round((totalDays / 7) * 5);
  return Math.max(1, workingDays * TIER_XP[2]);
}

function computeBuildStage(totalXp, targetXp) {
  if (targetXp <= 0) return 1;
  const ratio = totalXp / targetXp;
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.6) return 4;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

function computeDifficultyPhase(goalCreatedAtMs, asOfMs = Date.now()) {
  const weeksElapsed = Math.floor((asOfMs - goalCreatedAtMs) / (7 * MS_PER_DAY));
  if (weeksElapsed >= 6) return 4;
  if (weeksElapsed >= 4) return 3;
  if (weeksElapsed >= 2) return 2;
  return 1;
}

function computeGoalStatus({ xpTotal, xpTarget, buildHealth, lastCompletedDate, createdAt, asOfMs = Date.now() }) {
  const daysSinceCompletion = lastCompletedDate
    ? Math.floor((asOfMs - new Date(lastCompletedDate).getTime()) / MS_PER_DAY)
    : null;
  if (buildHealth < 40 || (daysSinceCompletion !== null && daysSinceCompletion >= 7)) return 'decaying';
  const ratio = xpTarget > 0 ? xpTotal / xpTarget : 1;
  const daysSinceCreated = createdAt ? Math.floor((asOfMs - createdAt) / MS_PER_DAY) : 0;
  if (ratio >= 1.1) return 'ahead';
  if (daysSinceCreated >= 7 && ratio < 0.75) return 'behind';
  return 'on_track';
}

function calculateAndStoreBuildPhase(goalId) {
  const goal = db.prepare('SELECT created_at, target_date, total_xp, xp_target FROM goals WHERE id = ?').get(goalId);
  if (!goal) return 1;
  const targetXp = goal.xp_target > 0 ? goal.xp_target : computeTargetXp(goal.created_at, goal.target_date);
  const phase = computeBuildStage(goal.total_xp ?? 0, targetXp);
  db.prepare('UPDATE goals SET current_phase = ?, updated_at = ? WHERE id = ?').run(phase, Date.now(), goalId);
  return phase;
}

function calculateAndStoreDifficultyPhase(goalId) {
  const goal = db.prepare('SELECT difficulty_phase FROM goals WHERE id = ?').get(goalId);
  if (!goal) return 1;
  return normalizeDifficultyPhase(goal.difficulty_phase);
}

function calculateAndStoreGoalStatus(goalId) {
  const goal = db.prepare(
    'SELECT created_at, target_date, total_xp, xp_target, health_score, build_health, last_completed_date FROM goals WHERE id = ?'
  ).get(goalId);
  if (!goal) return 'on_track';
  const targetXp = goal.xp_target > 0 ? goal.xp_target : computeTargetXp(goal.created_at, goal.target_date);
  const status = computeGoalStatus({
    xpTotal: goal.total_xp ?? 0,
    xpTarget: targetXp,
    buildHealth: goal.build_health ?? goal.health_score ?? 100,
    lastCompletedDate: goal.last_completed_date,
    createdAt: goal.created_at,
  });
  db.prepare('UPDATE goals SET performance_status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), goalId);
  return status;
}

function getGameStats(goalId) {
  const goal = db.prepare(
    'SELECT created_at, target_date, total_xp, current_streak, health_score, xp_target, difficulty_phase, performance_status FROM goals WHERE id = ?'
  ).get(goalId);
  if (!goal) return null;

  const targetXp = goal.xp_target > 0 ? goal.xp_target : computeTargetXp(goal.created_at, goal.target_date);
  const buildStage = computeBuildStage(goal.total_xp ?? 0, targetXp);
  const dailyRequirement = getDailyRequirement(goal);

  const rows = db.prepare(
    'SELECT id, goal_id, date, xp_earned, expectation, met FROM daily_xp WHERE goal_id = ? ORDER BY date DESC LIMIT 7'
  ).all(goalId);

  return {
    totalXp: goal.total_xp ?? 0,
    currentStreak: goal.current_streak ?? 0,
    healthScore: goal.health_score ?? 100,
    targetXp,
    buildStage,
    dailyExpectation: dailyRequirement.tasksRequired,
    difficultyPhase: dailyRequirement.phase,
    dailyRequirement,
    statusCopy: getStatusCopy(dailyRequirement, goal.performance_status ?? 'on_track'),
    last7Days: rows.map((r) => ({
      id: r.id,
      goalId: r.goal_id,
      date: r.date,
      xpEarned: r.xp_earned,
      expectation: r.expectation,
      met: r.met === 1,
    })),
  };
}

function getStatusCopy(requirement, status) {
  if (status === 'decaying' && requirement.phase === 4) {
    return 'Missed target. Recovery task assigned.';
  }
  if (requirement.phase === 4) {
    return 'Operator Mode unlocked. Expectations increased.';
  }
  return requirement.minimumCopy;
}

function upsertDailyXp(goalId, date) {
  const goal = db.prepare('SELECT created_at, total_xp, difficulty_phase FROM goals WHERE id = ?').get(goalId);
  if (!goal) return null;

  const completedTasks = db.prepare(
    "SELECT status, tier FROM daily_tasks WHERE goal_id = ? AND date = ? AND status = 'done'"
  ).all(goalId, date);

  const tierCase = Object.entries(TIER_XP)
    .map(([t, xp]) => `WHEN tier = ${t} THEN ${xp}`)
    .join(' ');
  const xpResult = db.prepare(
    `SELECT COALESCE(SUM(CASE ${tierCase} ELSE 15 END), 0) AS xp
     FROM daily_tasks WHERE goal_id = ? AND date = ? AND status = 'done'`
  ).get(goalId, date);
  const xpEarned = xpResult?.xp ?? 0;

  const requirement = getDailyRequirement(goal);
  const expectation = requirement.tasksRequired;
  const met = isValidDay(goal, completedTasks) ? 1 : 0;

  const existing = db.prepare('SELECT id, xp_earned FROM daily_xp WHERE goal_id = ? AND date = ?').get(goalId, date);

  if (existing) {
    db.prepare('UPDATE daily_xp SET xp_earned = ?, expectation = ?, met = ? WHERE id = ?').run(xpEarned, expectation, met, existing.id);
    const delta = xpEarned - existing.xp_earned;
    if (delta !== 0) {
      db.prepare('UPDATE goals SET total_xp = MAX(0, COALESCE(total_xp,0) + ?), updated_at = ? WHERE id = ?').run(delta, Date.now(), goalId);
    }
    if (met !== 1) applyMissedDayPenaltyForGoal(goalId, date);
    return { id: existing.id, goalId, date, xpEarned, expectation, met: met === 1 };
  }

  const id = generateId();
  db.prepare('INSERT INTO daily_xp (id, goal_id, date, xp_earned, expectation, met) VALUES (?, ?, ?, ?, ?, ?)').run(id, goalId, date, xpEarned, expectation, met);
  db.prepare('UPDATE goals SET total_xp = MAX(0, COALESCE(total_xp,0) + ?), updated_at = ? WHERE id = ?').run(xpEarned, Date.now(), goalId);
  if (met !== 1) applyMissedDayPenaltyForGoal(goalId, date);
  return { id, goalId, date, xpEarned, expectation, met: met === 1 };
}

function applyMissedDayPenaltyForGoal(goalId, missedDate) {
  const goal = db.prepare(
    'SELECT build_health, health_score, performance_status, difficulty_phase FROM goals WHERE id = ?'
  ).get(goalId);
  if (!goal) return;
  const nextGoal = applyMissedDayPenalty(goal);
  db.prepare(
    'UPDATE goals SET build_health = ?, health_score = ?, performance_status = ?, updated_at = ? WHERE id = ?'
  ).run(nextGoal.buildHealth, nextGoal.healthScore, nextGoal.performanceStatus, Date.now(), goalId);

  if (normalizeDifficultyPhase(goal.difficulty_phase) !== 4) return;

  const recoveryDate = missedDate < todayString() ? todayString() : missedDate;
  const existing = db.prepare(
    "SELECT id FROM daily_tasks WHERE goal_id = ? AND date = ? AND is_recovery_task = 1 AND status != 'dropped' LIMIT 1"
  ).get(goalId, recoveryDate);
  const taskCount = db.prepare(
    "SELECT COUNT(*) AS count FROM daily_tasks WHERE date = ? AND status != 'dropped'"
  ).get(recoveryDate)?.count ?? 0;

  if (existing || taskCount >= DAILY_TASK_CAP) return;

  const now = Date.now();
  db.prepare(
    `INSERT INTO daily_tasks (
      id, goal_id, title, next_step, date, status, completed_at, sort_order, created_at,
      task_type, effort_level, phase_id, focus_duration_minutes, break_duration_minutes,
      tier, is_recovery_task, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    generateId(),
    goalId,
    'Recovery task: reset the build',
    'Do one small task to restart momentum.',
    recoveryDate,
    'pending',
    null,
    taskCount,
    now,
    'goal',
    'light',
    'phase2',
    25,
    5,
    1,
    1,
    now
  );
}

function maybeUpgradeDifficultyPhaseForGoal(goalId) {
  const goal = db.prepare('SELECT difficulty_phase FROM goals WHERE id = ?').get(goalId);
  if (!goal) return 1;
  const inspections = db.prepare(
    'SELECT result FROM weekly_inspections WHERE goal_id = ? ORDER BY week_start DESC LIMIT 2'
  ).all(goalId);
  const nextGoal = maybeUpgradeDifficultyPhase(
    { difficultyPhase: normalizeDifficultyPhase(goal.difficulty_phase) },
    inspections
  );
  if (nextGoal.difficultyPhase !== normalizeDifficultyPhase(goal.difficulty_phase)) {
    db.prepare('UPDATE goals SET difficulty_phase = ?, updated_at = ? WHERE id = ?').run(
      nextGoal.difficultyPhase,
      Date.now(),
      goalId
    );
  }
  return nextGoal.difficultyPhase;
}

function recalcStreakAndHealth(goalId) {
  const goal = db.prepare('SELECT difficulty_phase FROM goals WHERE id = ?').get(goalId);
  const requirement = getDailyRequirement(goal ?? {});
  const rows = db.prepare(
    'SELECT date, met FROM daily_xp WHERE goal_id = ? ORDER BY date DESC LIMIT 60'
  ).all(goalId);

  if (rows.length === 0) {
    db.prepare('UPDATE goals SET current_streak = 0, streak_date = ?, health_score = 100, build_health = 100, updated_at = ? WHERE id = ?').run(
      new Date().toISOString().slice(0, 10), Date.now(), goalId
    );
    return true;
  }

  let streak = 0;
  let prevDate = null;
  for (const row of rows) {
    if (row.met !== 1) break;
    if (prevDate !== null) {
      const diff = (new Date(prevDate).getTime() - new Date(row.date).getTime()) / MS_PER_DAY;
      if (diff > 1) break;
    }
    streak++;
    prevDate = row.date;
  }

  let health = 100;
  for (let i = rows.length - 1; i >= 0; i--) {
    health = rows[i].met === 1 ? Math.min(100, health + 2) : Math.max(0, health - requirement.missPenalty);
  }

  const repeatedPhase3Miss = requirement.phase === 3 && rows[0]?.met === 0 && rows[1]?.met === 0;
  const performanceStatus =
    (requirement.phase === 4 && rows[0]?.met === 0) || repeatedPhase3Miss
      ? 'decaying'
      : computeGoalStatus({
          xpTotal: 0,
          xpTarget: 1,
          buildHealth: health,
          lastCompletedDate: streak > 0 ? rows[0].date : '',
        });

  db.prepare('UPDATE goals SET current_streak = ?, streak_date = ?, health_score = ?, build_health = ?, last_completed_date = ?, performance_status = ?, updated_at = ? WHERE id = ?').run(
    streak, rows[0].date, health, health, streak > 0 ? rows[0].date : '', performanceStatus, Date.now(), goalId
  );
  calculateAndStoreBuildPhase(goalId);
  maybeUpgradeDifficultyPhaseForGoal(goalId);
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function generateId() {
  return randomUUID();
}

function todayString() {
  return formatDate(new Date());
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekStart(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return formatDate(copy);
}

function getPrevWeekStart(date = new Date()) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 7);
  return getWeekStart(copy);
}

function offsetDateString(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return formatDate(date);
}

function getContext(key) {
  return db.prepare('SELECT value FROM app_context WHERE key = ?').get(key)?.value ?? null;
}

function setContext(key, value) {
  db.prepare('INSERT OR REPLACE INTO app_context (key, value) VALUES (?, ?)').run(key, value);
  return true;
}

function removeContext(key) {
  db.prepare('DELETE FROM app_context WHERE key = ?').run(key);
  return true;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function generateAnchorLines({ practicalReason, emotionalReason, costOfDrift }) {
  const parts = [sanitizeSentence(practicalReason), sanitizeSentence(emotionalReason)].filter(Boolean);
  return {
    anchorWhy: parts.join(' '),
    anchorDrift: sanitizeSentence(costOfDrift),
  };
}

function sanitizeSentence(value) {
  const trimmed = cleanText(value).replace(/[.!?]+$/g, '');
  if (!trimmed) return '';
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.`;
}

function clampDurationMinutes(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(1, Math.min(180, Math.round(numeric)));
}

function clampBreakMinutes(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(60, Math.round(numeric)));
}

function getDefaultPhaseId(taskType = 'goal', effortLevel = '') {
  if (taskType === 'admin' || effortLevel === 'light') {
    return 'phase2';
  }

  return 'phase1';
}

function normalizePhaseId(phaseId, taskType = 'goal', effortLevel = '') {
  if (phaseId === 'phase1' || phaseId === 'phase2' || phaseId === 'phase3') {
    return phaseId;
  }

  return getDefaultPhaseId(taskType, effortLevel);
}

function getPlannerDefault(key, fallback, clamp) {
  return clamp(getContext(key), fallback);
}

function normalizeGoalInput(input = {}) {
  const practicalReason = cleanText(input.practicalReason);
  const emotionalReason = cleanText(input.emotionalReason);
  const costOfDrift = cleanText(input.costOfDrift);
  const fallback = generateAnchorLines({ practicalReason, emotionalReason, costOfDrift });
  const anchorWhy = cleanText(input.anchorWhy || input.why) || fallback.anchorWhy;
  const anchorDrift = cleanText(input.anchorDrift) || fallback.anchorDrift;
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
    description: cleanText(input.description),
    startDate: cleanText(input.startDate) || null,
    whyItMatters: cleanText(input.whyItMatters) || anchorWhy,
    xpTarget: Number.isFinite(Number(input.xpTarget)) ? Number(input.xpTarget) : 0,
  };
}

function mapGoal(row) {
  if (!row) return null;
  const totalXp = row.total_xp ?? 0;
  const currentStreak = row.current_streak ?? 0;
  const healthScore = row.health_score ?? 100;
  const targetDate = row.target_date ?? row.end_date ?? null;
  return {
    id: row.id,
    name: row.title,
    title: row.title,
    targetOutcome: row.target_outcome || row.title,
    targetDate,
    metric: row.metric || '',
    why: row.anchor_why || row.why,
    practicalReason: row.practical_reason || '',
    emotionalReason: row.emotional_reason || '',
    costOfDrift: row.cost_of_drift || '',
    anchorWhy: row.anchor_why || row.why,
    anchorDrift: row.anchor_drift || '',
    importance: 0,
    urgency: 0,
    payoff: 0,
    whyNow: '',
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    status: row.status,
    currentFrictionMinutes: row.current_friction_minutes ?? 2,
    weeklySeatedSeconds: row.weekly_seated_seconds ?? 0,
    weeklySeatedWeekOf: row.weekly_seated_week_of ?? '',
    totalXp,
    currentStreak,
    streakDate: row.streak_date ?? '',
    healthScore,
    visionId: row.vision_id ?? null,
    description: row.description ?? '',
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? targetDate,
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

function getActiveGoal() {
  const row = db
    .prepare("SELECT * FROM goals WHERE status = 'active' ORDER BY created_at DESC LIMIT 1")
    .get();
  return mapGoal(row);
}

function createGoal(input) {
  const normalized = normalizeGoalInput(input);
  db.prepare("UPDATE goals SET status = 'archived' WHERE status = 'active'").run();
  const now = Date.now();
  const goal = {
    id: generateId(),
    ...normalized,
    createdAt: now,
    updatedAt: now,
    status: 'active',
  };
  db.prepare(
    `INSERT INTO goals (
      id, title, target_outcome, target_date, metric, why,
      practical_reason, emotional_reason, cost_of_drift,
      anchor_why, anchor_drift, created_at, status, description,
      start_date, end_date, why_it_matters, xp_target, build_health,
      current_phase, difficulty_phase, last_completed_date, performance_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
    goal.startDate || todayString(),
    goal.targetDate,
    goal.whyItMatters,
    goal.xpTarget,
    100,
    1,
    1,
    '',
    'on_track',
    goal.updatedAt
  );
  return getActiveGoal();
}

function createDefaultGoal() {
  return createGoal({
    title: 'Build momentum',
    targetOutcome: 'Create a steady weekly goal rhythm',
    metric: 'XP earned',
    why: 'A simple default goal keeps tasks anchored until a specific goal is chosen.',
    practicalReason: 'Keep daily tasks grouped.',
    emotionalReason: 'Make progress visible.',
    costOfDrift: 'Tasks drift without an anchor.',
    description: 'Default goal project',
    startDate: todayString(),
    whyItMatters: 'A small visible build is easier to return to.',
  });
}

function updateGoal(id, input) {
  const normalized = normalizeGoalInput(input);
  db.prepare(
    `UPDATE goals
     SET title = ?, target_outcome = ?, target_date = ?, metric = ?, why = ?,
         practical_reason = ?, emotional_reason = ?, cost_of_drift = ?,
        anchor_why = ?, anchor_drift = ?, description = ?, start_date = ?,
        end_date = ?, why_it_matters = ?, xp_target = ?, updated_at = ?
     WHERE id = ?`
  ).run(
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
    normalized.description,
    normalized.startDate,
    normalized.targetDate,
    normalized.whyItMatters,
    normalized.xpTarget,
    Date.now(),
    id
  );
  return true;
}

function completeGoal(id) {
  db.prepare("UPDATE goals SET status = 'completed' WHERE id = ?").run(id);
  return true;
}

function mapWeeklyFocus(row) {
  if (!row) return null;
  return {
    id: row.id,
    goalId: row.goal_id,
    focus: row.focus,
    weekOf: row.week_of,
    notes: row.notes,
  };
}

function getCurrentWeeklyFocus(goalId) {
  const row = db
    .prepare('SELECT * FROM weekly_focuses WHERE goal_id = ? AND week_of = ?')
    .get(goalId, getWeekStart());
  return mapWeeklyFocus(row);
}

function upsertWeeklyFocus(goalId, focus) {
  const weekOf = getWeekStart();
  const existing = db
    .prepare('SELECT * FROM weekly_focuses WHERE goal_id = ? AND week_of = ?')
    .get(goalId, weekOf);
  if (existing) {
    db.prepare('UPDATE weekly_focuses SET focus = ? WHERE id = ?').run(cleanText(focus), existing.id);
    return mapWeeklyFocus({ ...existing, focus: cleanText(focus) });
  }
  const next = {
    id: generateId(),
    goal_id: goalId,
    focus: cleanText(focus),
    week_of: weekOf,
    notes: '',
  };
  db.prepare(
    'INSERT INTO weekly_focuses (id, goal_id, focus, week_of, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(next.id, next.goal_id, next.focus, next.week_of, next.notes);
  return mapWeeklyFocus(next);
}

function normalizeTier(value) {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
  return 2;
}

function mapTask(row) {
  if (!row) return null;
  const taskType = row.task_type || 'goal';
  const effortLevel = row.effort_level || '';
  return {
    id: row.id,
    goalId: row.goal_id,
    projectId: row.project_id ?? null,
    weeklyFocusId: row.weekly_focus_id,
    sourceTaskId: row.source_task_id,
    title: row.title,
    nextStep: row.next_step || '',
    date: row.date,
    status: row.status,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.completed_at ?? row.created_at,
    taskType,
    effortLevel,
    milestoneId: row.milestone_id ?? null,
    scheduledWindowStart: row.scheduled_window_start || '',
    phaseId: normalizePhaseId(row.phase_id, taskType, effortLevel),
    focusDurationMinutes: clampDurationMinutes(
      row.focus_duration_minutes,
      getPlannerDefault('daily_rhythm_focus_minutes', DEFAULT_FOCUS_MINUTES, clampDurationMinutes)
    ),
    breakDurationMinutes: clampBreakMinutes(
      row.break_duration_minutes,
      getPlannerDefault('daily_rhythm_break_minutes', DEFAULT_BREAK_MINUTES, clampBreakMinutes)
    ),
    tier: normalizeTier(row.tier),
    linkedSite: row.linked_site ?? null,
    isRecoveryTask: row.is_recovery_task === 1,
  };
}

const TASK_COLUMNS = `id, goal_id, weekly_focus_id, source_task_id, title, next_step, date, status,
  completed_at, sort_order, created_at, project_id, task_type, effort_level,
  milestone_id, scheduled_window_start, phase_id, focus_duration_minutes,
  break_duration_minutes, tier, linked_site, is_recovery_task, updated_at`;

function getTasksForDate(date) {
  return db
    .prepare(`SELECT ${TASK_COLUMNS} FROM daily_tasks WHERE date = ? AND status != 'dropped' ORDER BY sort_order`)
    .all(date)
    .map(mapTask);
}

function getTaskById(id) {
  return mapTask(
    db.prepare(`SELECT ${TASK_COLUMNS} FROM daily_tasks WHERE id = ?`).get(id)
  );
}

function getTaskCountForDate(date) {
  return (
    db
      .prepare("SELECT COUNT(*) as count FROM daily_tasks WHERE date = ? AND status != 'dropped'")
      .get(date)?.count ?? 0
  );
}

function createTask(title, goalId, weeklyFocusId = null, nextStep = '', options = {}) {
  if (!goalId) {
    return { ok: false, reason: 'missing_goal' };
  }
  const targetDate = options.date ?? todayString();
  if (targetDate === todayString() && getTaskCountForDate(targetDate) >= DAILY_TASK_CAP) {
    return { ok: false, reason: 'task_limit_reached' };
  }

  const taskType = options.taskType ?? 'goal';
  const effortLevel = options.effortLevel ?? '';
  const defaultFocusMinutes = getPlannerDefault(
    'daily_rhythm_focus_minutes',
    DEFAULT_FOCUS_MINUTES,
    clampDurationMinutes
  );
  const defaultBreakMinutes = getPlannerDefault(
    'daily_rhythm_break_minutes',
    DEFAULT_BREAK_MINUTES,
    clampBreakMinutes
  );
  const now = Date.now();
  const task = {
    id: generateId(),
    goalId,
    projectId: options.projectId ?? null,
    weeklyFocusId,
    sourceTaskId: options.sourceTaskId ?? null,
    title: cleanText(title),
    nextStep: cleanText(nextStep),
    date: targetDate,
    status: 'pending',
    completedAt: null,
    sortOrder: getTaskCountForDate(targetDate),
    createdAt: now,
    updatedAt: now,
    taskType,
    effortLevel,
    milestoneId: options.milestoneId ?? null,
    scheduledWindowStart: cleanText(options.scheduledWindowStart),
    phaseId: normalizePhaseId(options.phaseId, taskType, effortLevel),
    focusDurationMinutes: clampDurationMinutes(options.focusDurationMinutes, defaultFocusMinutes),
    breakDurationMinutes: clampBreakMinutes(options.breakDurationMinutes, defaultBreakMinutes),
    tier: normalizeTier(options.tier),
    linkedSite: options.linkedSite ?? null,
    isRecoveryTask: options.isRecoveryTask === true,
  };

  db.prepare(
    `INSERT INTO daily_tasks (
      id, goal_id, project_id, weekly_focus_id, source_task_id, title, next_step,
      date, status, completed_at, sort_order, created_at, task_type, effort_level,
      milestone_id, scheduled_window_start, phase_id, focus_duration_minutes, break_duration_minutes, tier,
      linked_site, is_recovery_task, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    task.id,
    task.goalId,
    task.projectId,
    task.weeklyFocusId,
    task.sourceTaskId,
    task.title,
    task.nextStep,
    task.date,
    task.status,
    task.completedAt,
    task.sortOrder,
    task.createdAt,
    task.taskType,
    task.effortLevel,
    task.milestoneId,
    task.scheduledWindowStart,
    task.phaseId,
    task.focusDurationMinutes,
    task.breakDurationMinutes,
    task.tier,
    task.linkedSite,
    task.isRecoveryTask ? 1 : 0,
    task.updatedAt
  );

  refreshResumeContext();
  return { ok: true, task };
}

function carryForwardTask(taskId) {
  const source = db
    .prepare(
      `SELECT id, goal_id, weekly_focus_id, title, next_step
              , project_id, task_type, effort_level, milestone_id, scheduled_window_start
      , phase_id, focus_duration_minutes, break_duration_minutes, tier, linked_site, is_recovery_task
       FROM daily_tasks WHERE id = ? AND status = 'pending'`
    )
    .get(taskId);
  if (!source) {
    return { ok: false, reason: 'task_not_found' };
  }
  const targetDate = todayString();
  if (getTaskCountForDate(targetDate) >= DAILY_TASK_CAP) {
    return { ok: false, reason: 'task_limit_reached' };
  }
  const next = createTask(
    source.title,
    source.goal_id,
    source.weekly_focus_id,
    source.next_step || '',
    {
      date: targetDate,
      sourceTaskId: source.id,
      projectId: source.project_id,
      taskType: source.task_type || 'goal',
      effortLevel: source.effort_level || '',
      milestoneId: source.milestone_id ?? null,
      scheduledWindowStart: source.scheduled_window_start || '',
      phaseId: source.phase_id,
      focusDurationMinutes: source.focus_duration_minutes,
      breakDurationMinutes: source.break_duration_minutes,
      tier: source.tier,
      linkedSite: source.linked_site,
      isRecoveryTask: source.is_recovery_task === 1,
    }
  );
  refreshResumeContext();
  return next;
}

function completeTask(id) {
  const now = Date.now();
  db.prepare("UPDATE daily_tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
  refreshResumeContext();

  // Fire-and-forget XP update
  const task = db.prepare('SELECT goal_id, date FROM daily_tasks WHERE id = ?').get(id);
  if (task) {
    try {
      upsertDailyXp(task.goal_id, task.date);
      recalcStreakAndHealth(task.goal_id);
    } catch (_) {
      // non-critical
    }
  }

  return true;
}

function uncompleteTask(id) {
  db.prepare("UPDATE daily_tasks SET status = 'pending', completed_at = NULL, updated_at = ? WHERE id = ?").run(Date.now(), id);
  refreshResumeContext();
  return true;
}

function dropTask(id) {
  db.prepare("UPDATE daily_tasks SET status = 'dropped', updated_at = ? WHERE id = ?").run(Date.now(), id);
  refreshResumeContext();
  return true;
}

function mapFocusSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    status: row.status,
    exitReason: row.exit_reason || null,
    lastHeartbeatAt: row.last_heartbeat_at || row.started_at,
  };
}

function getFocusSessionById(id) {
  return mapFocusSession(db.prepare('SELECT * FROM focus_sessions WHERE id = ?').get(id));
}

function getSessionDurationSeconds(startedAt, endedAt) {
  return Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}

function finalizeSession(id, status, exitReason, endedAt) {
  const existing = db.prepare('SELECT * FROM focus_sessions WHERE id = ?').get(id);
  if (!existing) return null;
  const durationSeconds = getSessionDurationSeconds(existing.started_at, endedAt);
  db.prepare(
    `UPDATE focus_sessions
     SET ended_at = ?, duration_seconds = ?, status = ?, exit_reason = ?, last_heartbeat_at = ?
     WHERE id = ?`
  ).run(endedAt, durationSeconds, status, exitReason, endedAt, id);
  return mapFocusSession({
    ...existing,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    status,
    exit_reason: exitReason,
    last_heartbeat_at: endedAt,
  });
}

function startFocusSession(taskId) {
  const active = db
    .prepare("SELECT * FROM focus_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1")
    .get();
  if (active?.task_id === taskId) {
    return mapFocusSession(active);
  }
  if (active) {
    finalizeSession(active.id, 'abandoned', 'switched_task', Date.now());
  }
  const now = Date.now();
  const session = {
    id: generateId(),
    task_id: taskId,
    started_at: now,
    ended_at: null,
    duration_seconds: 0,
    status: 'active',
    exit_reason: '',
    last_heartbeat_at: now,
  };
  db.prepare(
    `INSERT INTO focus_sessions
      (id, task_id, started_at, ended_at, duration_seconds, status, exit_reason, last_heartbeat_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    session.id,
    session.task_id,
    session.started_at,
    session.ended_at,
    session.duration_seconds,
    session.status,
    session.exit_reason,
    session.last_heartbeat_at
  );
  refreshResumeContext();
  return mapFocusSession(session);
}

function touchFocusSession(id) {
  db.prepare("UPDATE focus_sessions SET last_heartbeat_at = ? WHERE id = ? AND status = 'active'").run(Date.now(), id);
  return true;
}

function completeFocusSession(id) {
  const session = finalizeSession(id, 'completed', null, Date.now());
  refreshResumeContext();
  return session;
}

function abandonFocusSession(id, reason) {
  const session = finalizeSession(id, 'abandoned', reason, Date.now());
  refreshResumeContext();
  return session;
}

function getFocusSessionsForTask(taskId) {
  return db
    .prepare('SELECT * FROM focus_sessions WHERE task_id = ? ORDER BY started_at DESC')
    .all(taskId)
    .map(mapFocusSession);
}

function getFocusSessionsForWeek(weekOf) {
  const [y, m, d] = weekOf.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const end = new Date(y, m - 1, d + 7).getTime();
  return db
    .prepare('SELECT * FROM focus_sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at DESC')
    .all(start, end)
    .map(mapFocusSession);
}

function mapReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    weekOf: row.week_of,
    completedAt: row.completed_at,
    wins: row.wins,
    whatDrifted: row.what_drifted,
    driftReasons: row.drift_reasons ? row.drift_reasons.split(',').filter(Boolean) : [],
    nextWeekAdjustment: row.next_week_adjustment,
  };
}

function getReviewForWeek(weekOf) {
  return mapReview(db.prepare('SELECT * FROM weekly_reviews WHERE week_of = ?').get(weekOf));
}

function saveReview(weekOf, wins, whatDrifted, driftReasons, nextWeekAdjustment) {
  const existing = db.prepare('SELECT * FROM weekly_reviews WHERE week_of = ?').get(weekOf);
  const now = Date.now();
  const driftReasonsStr = driftReasons.join(',');
  if (existing) {
    db.prepare(
      `UPDATE weekly_reviews
       SET wins = ?, what_drifted = ?, drift_reasons = ?, next_week_adjustment = ?, completed_at = ?
       WHERE id = ?`
    ).run(wins, whatDrifted, driftReasonsStr, nextWeekAdjustment, now, existing.id);
    return mapReview({
      ...existing,
      wins,
      what_drifted: whatDrifted,
      drift_reasons: driftReasonsStr,
      next_week_adjustment: nextWeekAdjustment,
      completed_at: now,
    });
  }
  const review = {
    id: generateId(),
    week_of: weekOf,
    completed_at: now,
    wins,
    what_drifted: whatDrifted,
    drift_reasons: driftReasonsStr,
    next_week_adjustment: nextWeekAdjustment,
  };
  db.prepare(
    `INSERT INTO weekly_reviews
      (id, week_of, completed_at, wins, what_drifted, drift_reasons, next_week_adjustment)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    review.id,
    review.week_of,
    review.completed_at,
    review.wins,
    review.what_drifted,
    review.drift_reasons,
    review.next_week_adjustment
  );
  return mapReview(review);
}

function isReviewDue() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 0 || dayOfWeek > 4) return false;
  return getReviewForWeek(getPrevWeekStart(today)) === null;
}

function getTasksForWeek(weekOf) {
  const [y, m, d] = weekOf.split('-').map(Number);
  const tasks = [];
  for (let i = 0; i < 7; i += 1) {
    tasks.push(...getTasksForDate(formatDate(new Date(y, m - 1, d + i))));
  }
  return tasks;
}

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
const ONBOARDING_DRAFT_KEY = 'onboarding_draft';
const RESUME_CONTEXT_KEY = 'resume_context';
const DISMISSED_RESUME_TASK_ID_KEY = 'dismissed_resume_task_id';

function isOnboardingComplete() {
  if (getContext(ONBOARDING_COMPLETE_KEY) === '1') return true;
  return (db.prepare('SELECT COUNT(*) as count FROM goals').get()?.count ?? 0) > 0;
}

function getOnboardingDraft() {
  const raw = getContext(ONBOARDING_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    removeContext(ONBOARDING_DRAFT_KEY);
    return null;
  }
}

function saveOnboardingDraft(draft) {
  return setContext(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
}

function clearOnboardingDraft() {
  return removeContext(ONBOARDING_DRAFT_KEY);
}

function completeOnboarding(draft) {
  const goal = createGoal({
    title: draft.goalTitle,
    targetOutcome: draft.targetOutcome,
    targetDate: draft.hasTargetDate ? draft.targetDate : null,
    metric: draft.metric,
    practicalReason: draft.practicalReason,
    emotionalReason: draft.emotionalReason,
    costOfDrift: draft.costOfDrift,
    anchorWhy: draft.anchorWhy,
    anchorDrift: draft.anchorDrift,
  });
  if (!goal) return { goal: null, weeklyFocusId: null };
  if (cleanText(draft.weeklyFocus)) {
    upsertWeeklyFocus(goal.id, draft.weeklyFocus);
  }
  setContext(ONBOARDING_COMPLETE_KEY, '1');
  clearOnboardingDraft();
  return { goal, weeklyFocusId: getCurrentWeeklyFocus(goal.id)?.id ?? null };
}

function getResumeContext() {
  const raw = getContext(RESUME_CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    removeContext(RESUME_CONTEXT_KEY);
    return null;
  }
}

function dismissResumeContext(resumeContext) {
  setContext(DISMISSED_RESUME_TASK_ID_KEY, getDismissedResumeKey(resumeContext));
  removeContext(RESUME_CONTEXT_KEY);
  return true;
}

function refreshResumeContext() {
  const dismissedResumeKey = getContext(DISMISSED_RESUME_TASK_ID_KEY);
  const activeFocus = db.prepare(
    `SELECT
        focus_sessions.id AS focus_session_id,
        focus_sessions.task_id AS task_id,
        daily_tasks.title AS title,
        daily_tasks.goal_id AS goal_id,
        daily_tasks.weekly_focus_id AS weekly_focus_id,
        focus_sessions.started_at AS started_at,
        focus_sessions.last_heartbeat_at AS last_heartbeat_at,
        focus_sessions.exit_reason AS exit_reason
      FROM focus_sessions
      JOIN daily_tasks ON daily_tasks.id = focus_sessions.task_id
      WHERE focus_sessions.status = 'active'
        AND daily_tasks.status = 'pending'
        AND (? IS NULL OR focus_sessions.id != ?)
      ORDER BY focus_sessions.last_heartbeat_at DESC, focus_sessions.started_at DESC
      LIMIT 1`
  ).get(getDismissedFocusSessionId(dismissedResumeKey), getDismissedFocusSessionId(dismissedResumeKey));

  if (activeFocus) {
    const ctx = {
      kind: 'focus-session',
      taskId: activeFocus.task_id,
      taskTitle: activeFocus.title,
      goalId: activeFocus.goal_id,
      weeklyFocusId: activeFocus.weekly_focus_id,
      focusSessionId: activeFocus.focus_session_id,
      startedAt: activeFocus.started_at,
      lastHeartbeatAt: activeFocus.last_heartbeat_at,
      sessionStatus: 'active',
      exitReason: activeFocus.exit_reason || null,
    };
    setContext(RESUME_CONTEXT_KEY, JSON.stringify(ctx));
    return ctx;
  }

  const abandonedFocus = db.prepare(
    `SELECT
        focus_sessions.id AS focus_session_id,
        focus_sessions.task_id AS task_id,
        daily_tasks.title AS title,
        daily_tasks.goal_id AS goal_id,
        daily_tasks.weekly_focus_id AS weekly_focus_id,
        focus_sessions.started_at AS started_at,
        focus_sessions.last_heartbeat_at AS last_heartbeat_at,
        focus_sessions.exit_reason AS exit_reason
      FROM focus_sessions
      JOIN daily_tasks ON daily_tasks.id = focus_sessions.task_id
      WHERE focus_sessions.status = 'abandoned'
        AND focus_sessions.ended_at >= ?
        AND daily_tasks.status = 'pending'
        AND (? IS NULL OR focus_sessions.id != ?)
      ORDER BY focus_sessions.ended_at DESC, focus_sessions.started_at DESC
      LIMIT 1`
  ).get(
    Date.now() - FOCUS_RESUME_WINDOW_MS,
    getDismissedFocusSessionId(dismissedResumeKey),
    getDismissedFocusSessionId(dismissedResumeKey)
  );

  if (abandonedFocus) {
    const ctx = {
      kind: 'focus-session',
      taskId: abandonedFocus.task_id,
      taskTitle: abandonedFocus.title,
      goalId: abandonedFocus.goal_id,
      weeklyFocusId: abandonedFocus.weekly_focus_id,
      focusSessionId: abandonedFocus.focus_session_id,
      startedAt: abandonedFocus.started_at,
      lastHeartbeatAt: abandonedFocus.last_heartbeat_at,
      sessionStatus: 'abandoned',
      exitReason: abandonedFocus.exit_reason || null,
    };
    setContext(RESUME_CONTEXT_KEY, JSON.stringify(ctx));
    return ctx;
  }

  const carryForward = db.prepare(
    `SELECT id, title, date, goal_id, weekly_focus_id
     FROM daily_tasks
     WHERE status = 'pending'
       AND date < ?
       AND date >= ?
       AND (? IS NULL OR id != ?)
       AND NOT EXISTS (
         SELECT 1 FROM daily_tasks carried WHERE carried.source_task_id = daily_tasks.id
       )
     ORDER BY
       CASE WHEN date = ? THEN 0 ELSE 1 END,
       date DESC,
       sort_order DESC,
       created_at DESC
     LIMIT 1`
  ).get(
    todayString(),
    offsetDateString(-7),
    getDismissedTaskId(dismissedResumeKey),
    getDismissedTaskId(dismissedResumeKey),
    offsetDateString(-1)
  );

  if (carryForward) {
    const ctx = {
      kind: 'carry-forward',
      taskId: carryForward.id,
      taskTitle: carryForward.title,
      fromDate: carryForward.date,
      goalId: carryForward.goal_id,
      weeklyFocusId: carryForward.weekly_focus_id,
    };
    setContext(RESUME_CONTEXT_KEY, JSON.stringify(ctx));
    return ctx;
  }

  removeContext(RESUME_CONTEXT_KEY);
  return null;
}

function getDismissedResumeKey(resumeContext) {
  return resumeContext.kind === 'focus-session'
    ? `focus-session:${resumeContext.focusSessionId}`
    : `carry-forward:${resumeContext.taskId}`;
}

function getDismissedFocusSessionId(value) {
  return value?.startsWith('focus-session:') ? value.slice('focus-session:'.length) : null;
}

function getDismissedTaskId(value) {
  return value?.startsWith('carry-forward:') ? value.slice('carry-forward:'.length) : null;
}
