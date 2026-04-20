import type { EffortLevel, EnergyIntensity, EnergyWindow } from '../types';
import { generateId } from '../utils/ids';
import { runDb } from './schema';

type Row = {
  id: string;
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  intensity: string;
  created_at: number;
};

function mapWindow(row: Row): EnergyWindow {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    startHour: row.start_hour,
    endHour: row.end_hour,
    intensity: row.intensity as EnergyIntensity,
    createdAt: row.created_at,
  };
}

export function dbGetEnergyWindows(): EnergyWindow[] {
  return runDb('get energy windows', [], (db) => {
    const rows = db.getAllSync<Row>(
      'SELECT * FROM energy_windows ORDER BY day_of_week, start_hour'
    );
    return rows.map(mapWindow);
  });
}

export function dbGetEnergyWindowsForDay(day: number): EnergyWindow[] {
  return runDb('get energy windows for day', [], (db) => {
    const rows = db.getAllSync<Row>(
      'SELECT * FROM energy_windows WHERE day_of_week = ? ORDER BY start_hour',
      [day]
    );
    return rows.map(mapWindow);
  });
}

export function dbCreateEnergyWindow(
  dayOfWeek: number,
  startHour: number,
  endHour: number,
  intensity: EnergyIntensity
): EnergyWindow | null {
  return runDb('create energy window', null, (db) => {
    const w: EnergyWindow = {
      id: generateId(),
      dayOfWeek,
      startHour,
      endHour,
      intensity,
      createdAt: Date.now(),
    };
    db.runSync(
      `INSERT INTO energy_windows
        (id, day_of_week, start_hour, end_hour, intensity, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [w.id, w.dayOfWeek, w.startHour, w.endHour, w.intensity, w.createdAt]
    );
    return w;
  });
}

export function dbDeleteEnergyWindow(id: string): boolean {
  return runDb('delete energy window', false, (db) => {
    db.runSync('DELETE FROM energy_windows WHERE id = ?', [id]);
    return true;
  });
}

export function dbCopyWindowsToAllWeekdays(sourceDay: number): number {
  return runDb('copy energy windows', 0, (db) => {
    const source = db.getAllSync<Row>(
      'SELECT * FROM energy_windows WHERE day_of_week = ?',
      [sourceDay]
    );
    let count = 0;
    for (let day = 1; day <= 5; day++) {
      if (day === sourceDay) continue;
      db.runSync('DELETE FROM energy_windows WHERE day_of_week = ?', [day]);
      for (const row of source) {
        const id = generateId();
        db.runSync(
          `INSERT INTO energy_windows
            (id, day_of_week, start_hour, end_hour, intensity, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, day, row.start_hour, row.end_hour, row.intensity, Date.now()]
        );
        count++;
      }
    }
    return count;
  });
}

const EFFORT_TO_INTENSITY: Record<Exclude<EffortLevel, ''>, EnergyIntensity> = {
  light: 'low',
  medium: 'medium',
  challenging: 'high',
};

/**
 * Find the next available energy window that matches the effort level.
 * Returns "HH:mm" string of the window start, or empty string if none found.
 */
export function findWindowForEffort(
  effort: EffortLevel,
  date: Date = new Date()
): string {
  if (!effort) return '';
  const desired = EFFORT_TO_INTENSITY[effort];
  const day = date.getDay();
  const hour = date.getHours();
  const windows = dbGetEnergyWindowsForDay(day);
  const candidate =
    windows.find((w) => w.intensity === desired && w.startHour >= hour) ??
    windows.find((w) => w.intensity === desired);
  if (!candidate) return '';
  return `${String(candidate.startHour).padStart(2, '0')}:00`;
}
