import type * as SQLite from 'expo-sqlite';
import type { FocusExitReason, FocusSession } from '../types';
import { generateId } from '../utils/ids';
import { dbRefreshResumeContext } from './context';
import { runDb } from './schema';

type FocusSessionRow = {
  id: string;
  task_id: string;
  started_at: number;
  ended_at: number | null;
  duration_seconds: number;
  status: string;
  exit_reason: string | null;
  last_heartbeat_at: number;
};

function mapFocusSession(row: FocusSessionRow): FocusSession {
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    status: row.status as FocusSession['status'],
    exitReason: (row.exit_reason || null) as FocusExitReason | null,
    lastHeartbeatAt: row.last_heartbeat_at || row.started_at,
  };
}

function getSessionDurationSeconds(startedAt: number, endedAt: number): number {
  return Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}

function finalizeSession(
  db: Pick<SQLite.SQLiteDatabase, 'runSync' | 'getFirstSync'>,
  id: string,
  status: 'completed' | 'abandoned',
  exitReason: FocusExitReason | null,
  endedAt: number
): FocusSession | null {
  const existing = db.getFirstSync<FocusSessionRow>('SELECT * FROM focus_sessions WHERE id = ?', [id]);
  if (!existing) {
    return null;
  }

  const durationSeconds = getSessionDurationSeconds(existing.started_at, endedAt);
  db.runSync(
    `UPDATE focus_sessions
     SET ended_at = ?, duration_seconds = ?, status = ?, exit_reason = ?, last_heartbeat_at = ?
     WHERE id = ?`,
    [endedAt, durationSeconds, status, exitReason, endedAt, id]
  );

  return {
    ...mapFocusSession(existing),
    endedAt,
    durationSeconds,
    status,
    exitReason,
    lastHeartbeatAt: endedAt,
  };
}

export function dbGetFocusSessionById(id: string): FocusSession | null {
  return runDb('get focus session by id', null, (db) => {
    const row = db.getFirstSync<FocusSessionRow>('SELECT * FROM focus_sessions WHERE id = ?', [id]);
    return row ? mapFocusSession(row) : null;
  });
}

export function dbGetActiveFocusSession(): FocusSession | null {
  return runDb('get active focus session', null, (db) => {
    const row = db.getFirstSync<FocusSessionRow>(
      "SELECT * FROM focus_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1"
    );
    return row ? mapFocusSession(row) : null;
  });
}

export function dbGetActiveFocusSessionForTask(taskId: string): FocusSession | null {
  return runDb('get active focus session for task', null, (db) => {
    const row = db.getFirstSync<FocusSessionRow>(
      "SELECT * FROM focus_sessions WHERE task_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1",
      [taskId]
    );
    return row ? mapFocusSession(row) : null;
  });
}

export function dbGetMostRecentAbandonedFocusSession(taskId?: string): FocusSession | null {
  return runDb('get abandoned focus session', null, (db) => {
    const sql = taskId
      ? "SELECT * FROM focus_sessions WHERE task_id = ? AND status = 'abandoned' ORDER BY ended_at DESC, started_at DESC LIMIT 1"
      : "SELECT * FROM focus_sessions WHERE status = 'abandoned' ORDER BY ended_at DESC, started_at DESC LIMIT 1";
    const row = taskId
      ? db.getFirstSync<FocusSessionRow>(sql, [taskId])
      : db.getFirstSync<FocusSessionRow>(sql);
    return row ? mapFocusSession(row) : null;
  });
}

export function dbStartFocusSession(taskId: string): FocusSession | null {
  return runDb('start focus session', null, (db) => {
    const active = db.getFirstSync<FocusSessionRow>(
      "SELECT * FROM focus_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1"
    );

    if (active?.task_id === taskId) {
      return mapFocusSession(active);
    }

    if (active) {
      finalizeSession(db, active.id, 'abandoned', 'switched_task', Date.now());
    }

    const now = Date.now();
    const session: FocusSession = {
      id: generateId(),
      taskId,
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      status: 'active',
      exitReason: null,
      lastHeartbeatAt: now,
    };

    db.runSync(
      `INSERT INTO focus_sessions (
        id,
        task_id,
        started_at,
        ended_at,
        duration_seconds,
        status,
        exit_reason,
        last_heartbeat_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.taskId,
        session.startedAt,
        session.endedAt,
        session.durationSeconds,
        session.status,
        session.exitReason,
        session.lastHeartbeatAt,
      ]
    );

    dbRefreshResumeContext();
    return session;
  });
}

export function dbTouchFocusSession(id: string): boolean {
  return runDb('touch focus session', false, (db) => {
    db.runSync(
      "UPDATE focus_sessions SET last_heartbeat_at = ? WHERE id = ? AND status = 'active'",
      [Date.now(), id]
    );
    return true;
  });
}

export function dbCompleteFocusSession(id: string): FocusSession | null {
  return runDb('complete focus session', null, (db) => {
    const session = finalizeSession(db, id, 'completed', null, Date.now());
    dbRefreshResumeContext();
    return session;
  });
}

export function dbAbandonFocusSession(
  id: string,
  reason: Exclude<FocusExitReason, 'switched_task'>
): FocusSession | null {
  return runDb('abandon focus session', null, (db) => {
    const session = finalizeSession(db, id, 'abandoned', reason, Date.now());
    dbRefreshResumeContext();
    return session;
  });
}

export function dbGetFocusSessionsForTask(taskId: string): FocusSession[] {
  return runDb('get focus sessions for task', [], (db) => {
    const rows = db.getAllSync<FocusSessionRow>(
      'SELECT * FROM focus_sessions WHERE task_id = ? ORDER BY started_at DESC',
      [taskId]
    );
    return rows.map(mapFocusSession);
  });
}

export function dbGetFocusSessionsForWeek(weekOf: string): FocusSession[] {
  return runDb('get focus sessions for week', [], (db) => {
    const [year, month, day] = weekOf.split('-').map(Number);
    const start = new Date(year, month - 1, day).getTime();
    const end = new Date(year, month - 1, day + 7).getTime();
    const rows = db.getAllSync<FocusSessionRow>(
      'SELECT * FROM focus_sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at DESC',
      [start, end]
    );
    return rows.map(mapFocusSession);
  });
}
