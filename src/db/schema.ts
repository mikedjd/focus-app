import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const DATABASE_NAME = 'focus.db';
const SCHEMA_VERSION_KEY = 'schema_version';
const CURRENT_SCHEMA_VERSION = 8;

let dbInstance: SQLite.SQLiteDatabase | null = null;

type Migration = {
  version: number;
  run: (db: SQLite.SQLiteDatabase) => void;
};

const migrations: Migration[] = [
  {
    version: 1,
    run: (db) => {
      ensureBaseSchema(db);
    },
  },
  {
    version: 2,
    run: (db) => {
      ensureTaskTableShape(db);
    },
  },
  {
    version: 3,
    run: (db) => {
      ensureReviewTableShape(db);
    },
  },
  {
    version: 4,
    run: (db) => {
      ensureGoalTableShape(db);
    },
  },
  {
    version: 5,
    run: (db) => {
      ensureFocusSessionTableShape(db);
    },
  },
  {
    version: 6,
    run: (db) => {
      ensureTaskInstructionShape(db);
    },
  },
  {
    version: 7,
    run: (db) => {
      ensureProjectsShape(db);
    },
  },
  {
    version: 8,
    run: (db) => {
      ensureControlCenterShape(db);
    },
  },
];

export function getDb(): SQLite.SQLiteDatabase | null {
  // expo-sqlite is not supported on web — all callers receive null and fall back gracefully
  if (Platform.OS === 'web') return null;

  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DATABASE_NAME);
    try {
      runMigrations(dbInstance);
    } catch (error) {
      logDbError('run migrations', error);
    }
  }

  return dbInstance;
}

export function runDb<T>(
  action: string,
  fallback: T,
  operation: (db: SQLite.SQLiteDatabase) => T
): T {
  const db = getDb();
  if (!db) return fallback; // web: return empty fallback silently
  try {
    return operation(db);
  } catch (error) {
    logDbError(action, error);
    return fallback;
  }
}

export function hasColumn(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string
): boolean {
  const columns = db.getAllSync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return columns.some((column) => column.name === columnName);
}

export function logDbError(action: string, error: unknown): void {
  if (__DEV__) {
    console.error(`[db] ${action}`, error);
  }
}

function runMigrations(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  ensureBaseSchema(db);

  const currentVersion = getSchemaVersion(db);
  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    migration.run(db);
    setSchemaVersion(db, migration.version);
  }

  // Older installs can report a newer schema version while still missing
  // additive columns. Reconcile the actual table shape on every launch.
  ensureTaskTableShape(db);
  ensureReviewTableShape(db);
  ensureGoalTableShape(db);
  ensureFocusSessionTableShape(db);
  ensureTaskInstructionShape(db);
  ensureProjectsShape(db);
  ensureControlCenterShape(db);

  if (getSchemaVersion(db) < CURRENT_SCHEMA_VERSION) {
    setSchemaVersion(db, CURRENT_SCHEMA_VERSION);
  }
}

function ensureBaseSchema(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
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

    CREATE TABLE IF NOT EXISTS app_context (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_daily_tasks_date_status
      ON daily_tasks(date, status);
  `);
}

function ensureTaskTableShape(db: SQLite.SQLiteDatabase): void {
  ensureColumn(
    db,
    'daily_tasks',
    'source_task_id',
    'ALTER TABLE daily_tasks ADD COLUMN source_task_id TEXT'
  );
  ensureColumn(
    db,
    'daily_tasks',
    'next_step',
    "ALTER TABLE daily_tasks ADD COLUMN next_step TEXT NOT NULL DEFAULT ''"
  );
  ensureColumn(
    db,
    'daily_tasks',
    'created_at',
    "ALTER TABLE daily_tasks ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0"
  );

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_daily_tasks_date_status
      ON daily_tasks(date, status);

    CREATE INDEX IF NOT EXISTS idx_daily_tasks_source_task_id
      ON daily_tasks(source_task_id);
  `);

  db.runSync(`
    UPDATE daily_tasks
    SET created_at = CAST(strftime('%s', date || ' 12:00:00') AS INTEGER) * 1000
    WHERE created_at IS NULL OR created_at = 0
  `);
}

function ensureTaskInstructionShape(db: SQLite.SQLiteDatabase): void {
  ensureColumn(
    db,
    'daily_tasks',
    'next_step',
    "ALTER TABLE daily_tasks ADD COLUMN next_step TEXT NOT NULL DEFAULT ''"
  );
}

function ensureReviewTableShape(db: SQLite.SQLiteDatabase): void {
  ensureColumn(
    db,
    'weekly_reviews',
    'drift_reasons',
    "ALTER TABLE weekly_reviews ADD COLUMN drift_reasons TEXT NOT NULL DEFAULT ''"
  );
}

function ensureGoalTableShape(db: SQLite.SQLiteDatabase): void {
  ensureColumn(
    db,
    'goals',
    'target_outcome',
    "ALTER TABLE goals ADD COLUMN target_outcome TEXT NOT NULL DEFAULT ''"
  );
  ensureColumn(
    db,
    'goals',
    'target_date',
    'ALTER TABLE goals ADD COLUMN target_date TEXT'
  );
  ensureColumn(
    db,
    'goals',
    'metric',
    "ALTER TABLE goals ADD COLUMN metric TEXT NOT NULL DEFAULT ''"
  );
  ensureColumn(
    db,
    'goals',
    'practical_reason',
    "ALTER TABLE goals ADD COLUMN practical_reason TEXT NOT NULL DEFAULT ''"
  );
  ensureColumn(
    db,
    'goals',
    'emotional_reason',
    "ALTER TABLE goals ADD COLUMN emotional_reason TEXT NOT NULL DEFAULT ''"
  );
  ensureColumn(
    db,
    'goals',
    'cost_of_drift',
    "ALTER TABLE goals ADD COLUMN cost_of_drift TEXT NOT NULL DEFAULT ''"
  );
  ensureColumn(
    db,
    'goals',
    'anchor_why',
    "ALTER TABLE goals ADD COLUMN anchor_why TEXT NOT NULL DEFAULT ''"
  );
  ensureColumn(
    db,
    'goals',
    'anchor_drift',
    "ALTER TABLE goals ADD COLUMN anchor_drift TEXT NOT NULL DEFAULT ''"
  );

  db.execSync(`
    UPDATE goals
    SET anchor_why = why
    WHERE TRIM(COALESCE(anchor_why, '')) = '' AND TRIM(COALESCE(why, '')) != '';

    UPDATE goals
    SET target_outcome = title
    WHERE TRIM(COALESCE(target_outcome, '')) = '';
  `);
}

function ensureFocusSessionTableShape(db: SQLite.SQLiteDatabase): void {
  ensureColumn(
    db,
    'focus_sessions',
    'duration_seconds',
    "ALTER TABLE focus_sessions ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0"
  );
  ensureColumn(
    db,
    'focus_sessions',
    'exit_reason',
    "ALTER TABLE focus_sessions ADD COLUMN exit_reason TEXT DEFAULT ''"
  );
  ensureColumn(
    db,
    'focus_sessions',
    'last_heartbeat_at',
    "ALTER TABLE focus_sessions ADD COLUMN last_heartbeat_at INTEGER NOT NULL DEFAULT 0"
  );

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_started
      ON focus_sessions(task_id, started_at DESC);

    CREATE INDEX IF NOT EXISTS idx_focus_sessions_status_started
      ON focus_sessions(status, started_at DESC);
  `);

  db.runSync(`
    UPDATE focus_sessions
    SET last_heartbeat_at = started_at
    WHERE last_heartbeat_at IS NULL OR last_heartbeat_at = 0
  `);
}

function ensureProjectsShape(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3B5BDB',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (goal_id) REFERENCES goals(id)
    );

    CREATE TABLE IF NOT EXISTS daily_reviews (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      completed_at INTEGER NOT NULL,
      wins TEXT NOT NULL DEFAULT '',
      drift TEXT NOT NULL DEFAULT '',
      tomorrow_step TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_projects_goal_id ON projects(goal_id);
    CREATE INDEX IF NOT EXISTS idx_daily_reviews_date ON daily_reviews(date);
  `);

  ensureColumn(
    db,
    'daily_tasks',
    'project_id',
    'ALTER TABLE daily_tasks ADD COLUMN project_id TEXT REFERENCES projects(id)'
  );
}

function ensureControlCenterShape(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      title TEXT NOT NULL,
      target_metric TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (goal_id) REFERENCES goals(id)
    );

    CREATE INDEX IF NOT EXISTS idx_milestones_goal_sort
      ON milestones(goal_id, sort_order);

    CREATE TABLE IF NOT EXISTS energy_windows (
      id TEXT PRIMARY KEY,
      day_of_week INTEGER NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      intensity TEXT NOT NULL DEFAULT 'medium',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_energy_windows_day
      ON energy_windows(day_of_week);

    CREATE TABLE IF NOT EXISTS parking_lot (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      why TEXT NOT NULL DEFAULT '',
      diverted_at INTEGER NOT NULL,
      promotable_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'parked'
    );

    CREATE TABLE IF NOT EXISTS inbox_items (
      id TEXT PRIMARY KEY,
      raw_text TEXT NOT NULL,
      classified_as TEXT,
      target_id TEXT,
      scheduled_for TEXT,
      effort_level TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_inbox_items_resolved
      ON inbox_items(resolved_at, created_at DESC);
  `);

  ensureColumn(
    db,
    'goals',
    'current_friction_minutes',
    'ALTER TABLE goals ADD COLUMN current_friction_minutes INTEGER NOT NULL DEFAULT 2'
  );
  ensureColumn(
    db,
    'goals',
    'weekly_seated_seconds',
    'ALTER TABLE goals ADD COLUMN weekly_seated_seconds INTEGER NOT NULL DEFAULT 0'
  );
  ensureColumn(
    db,
    'goals',
    'weekly_seated_week_of',
    "ALTER TABLE goals ADD COLUMN weekly_seated_week_of TEXT NOT NULL DEFAULT ''"
  );

  ensureColumn(
    db,
    'daily_tasks',
    'task_type',
    "ALTER TABLE daily_tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'goal'"
  );
  ensureColumn(
    db,
    'daily_tasks',
    'effort_level',
    "ALTER TABLE daily_tasks ADD COLUMN effort_level TEXT NOT NULL DEFAULT ''"
  );
  ensureColumn(
    db,
    'daily_tasks',
    'milestone_id',
    'ALTER TABLE daily_tasks ADD COLUMN milestone_id TEXT'
  );
  ensureColumn(
    db,
    'daily_tasks',
    'scheduled_window_start',
    "ALTER TABLE daily_tasks ADD COLUMN scheduled_window_start TEXT NOT NULL DEFAULT ''"
  );
}

function ensureColumn(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  alterStatement: string
): void {
  if (!hasColumn(db, tableName, columnName)) {
    db.execSync(alterStatement);
  }
}

function getSchemaVersion(db: SQLite.SQLiteDatabase): number {
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM app_context WHERE key = ?',
    [SCHEMA_VERSION_KEY]
  );
  const parsed = Number.parseInt(row?.value ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setSchemaVersion(db: SQLite.SQLiteDatabase, version: number): void {
  db.runSync('INSERT OR REPLACE INTO app_context (key, value) VALUES (?, ?)', [
    SCHEMA_VERSION_KEY,
    String(version),
  ]);
}

export const dbSchemaVersion = CURRENT_SCHEMA_VERSION;
