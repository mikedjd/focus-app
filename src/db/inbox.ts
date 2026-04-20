import type { EffortLevel, InboxClassification, InboxItem } from '../types';
import { generateId } from '../utils/ids';
import { runDb } from './schema';

type Row = {
  id: string;
  raw_text: string;
  classified_as: string | null;
  target_id: string | null;
  scheduled_for: string | null;
  effort_level: string | null;
  created_at: number;
  resolved_at: number | null;
};

function mapItem(row: Row): InboxItem {
  return {
    id: row.id,
    rawText: row.raw_text,
    classifiedAs: (row.classified_as as InboxClassification) ?? null,
    targetId: row.target_id,
    scheduledFor: row.scheduled_for,
    effortLevel: (row.effort_level as EffortLevel) ?? '',
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export function dbGetPendingInboxItems(): InboxItem[] {
  return runDb('get pending inbox', [], (db) => {
    const rows = db.getAllSync<Row>(
      'SELECT * FROM inbox_items WHERE resolved_at IS NULL ORDER BY created_at DESC'
    );
    return rows.map(mapItem);
  });
}

export function dbGetPendingInboxCount(): number {
  return runDb('pending inbox count', 0, (db) => {
    const row = db.getFirstSync<{ c: number }>(
      'SELECT COUNT(*) as c FROM inbox_items WHERE resolved_at IS NULL'
    );
    return row?.c ?? 0;
  });
}

export function dbCreateInboxItem(
  rawText: string,
  classification?: InboxClassification | null,
  extras?: { scheduledFor?: string | null; effortLevel?: EffortLevel }
): InboxItem | null {
  return runDb('create inbox item', null, (db) => {
    const item: InboxItem = {
      id: generateId(),
      rawText,
      classifiedAs: classification ?? null,
      targetId: null,
      scheduledFor: extras?.scheduledFor ?? null,
      effortLevel: extras?.effortLevel ?? '',
      createdAt: Date.now(),
      resolvedAt: null,
    };
    db.runSync(
      `INSERT INTO inbox_items
        (id, raw_text, classified_as, target_id, scheduled_for, effort_level, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.rawText,
        item.classifiedAs,
        item.targetId,
        item.scheduledFor,
        item.effortLevel,
        item.createdAt,
        item.resolvedAt,
      ]
    );
    return item;
  });
}

export function dbUpdateInboxClassification(
  id: string,
  classification: InboxClassification,
  extras?: { scheduledFor?: string | null; effortLevel?: EffortLevel }
): boolean {
  return runDb('update inbox classification', false, (db) => {
    db.runSync(
      `UPDATE inbox_items
         SET classified_as = ?, scheduled_for = ?, effort_level = ?
       WHERE id = ?`,
      [
        classification,
        extras?.scheduledFor ?? null,
        extras?.effortLevel ?? '',
        id,
      ]
    );
    return true;
  });
}

export function dbResolveInboxItem(id: string, targetId: string | null): boolean {
  return runDb('resolve inbox item', false, (db) => {
    db.runSync(
      'UPDATE inbox_items SET resolved_at = ?, target_id = ? WHERE id = ?',
      [Date.now(), targetId, id]
    );
    return true;
  });
}

export function dbDeleteInboxItem(id: string): boolean {
  return runDb('delete inbox item', false, (db) => {
    db.runSync('DELETE FROM inbox_items WHERE id = ?', [id]);
    return true;
  });
}
