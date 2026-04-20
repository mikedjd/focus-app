import type { ParkingLotItem, ParkingStatus } from '../types';
import { generateId } from '../utils/ids';
import { runDb } from './schema';

const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

type Row = {
  id: string;
  title: string;
  why: string;
  diverted_at: number;
  promotable_at: number;
  status: string;
};

function mapItem(row: Row): ParkingLotItem {
  return {
    id: row.id,
    title: row.title,
    why: row.why,
    divertedAt: row.diverted_at,
    promotableAt: row.promotable_at,
    status: row.status as ParkingStatus,
  };
}

export function dbGetParkingLot(): ParkingLotItem[] {
  return runDb('get parking lot', [], (db) => {
    const rows = db.getAllSync<Row>(
      "SELECT * FROM parking_lot WHERE status = 'parked' ORDER BY diverted_at DESC"
    );
    return rows.map(mapItem);
  });
}

export function dbDivertToParkingLot(title: string, why = ''): ParkingLotItem | null {
  return runDb('divert to parking lot', null, (db) => {
    const now = Date.now();
    const item: ParkingLotItem = {
      id: generateId(),
      title,
      why,
      divertedAt: now,
      promotableAt: now + COOLDOWN_MS,
      status: 'parked',
    };
    db.runSync(
      `INSERT INTO parking_lot
        (id, title, why, diverted_at, promotable_at, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item.id, item.title, item.why, item.divertedAt, item.promotableAt, item.status]
    );
    return item;
  });
}

export function dbPromoteParkingLotItem(id: string): ParkingLotItem | null {
  return runDb('promote parking lot item', null, (db) => {
    const row = db.getFirstSync<Row>('SELECT * FROM parking_lot WHERE id = ?', [id]);
    if (!row) return null;
    if (Date.now() < row.promotable_at) return null;
    db.runSync("UPDATE parking_lot SET status = 'promoted' WHERE id = ?", [id]);
    return mapItem({ ...row, status: 'promoted' });
  });
}

export function dbDismissParkingLotItem(id: string): boolean {
  return runDb('dismiss parking lot item', false, (db) => {
    db.runSync("UPDATE parking_lot SET status = 'dismissed' WHERE id = ?", [id]);
    return true;
  });
}

export function dbGetParkingLotCount(): number {
  return runDb('parking lot count', 0, (db) => {
    const row = db.getFirstSync<{ c: number }>(
      "SELECT COUNT(*) as c FROM parking_lot WHERE status = 'parked'"
    );
    return row?.c ?? 0;
  });
}
