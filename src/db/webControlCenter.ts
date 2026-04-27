/**
 * Web fallbacks for control-center features (milestones, parking lot, inbox,
 * energy windows, friction recompute). localStorage-backed, kept in a separate
 * file so the large `web.ts` does not grow unboundedly.
 */
import type {
  EffortLevel,
  EnergyIntensity,
  EnergyWindow,
  GoalProgress,
  InboxClassification,
  InboxItem,
  Milestone,
  ParkingLotItem,
} from '../types';
import { generateId } from '../utils/ids';

const KEY_MILESTONES = 'adhd_milestones';
const KEY_ENERGY = 'adhd_energy_windows';
const KEY_PARKING = 'adhd_parking_lot';
const KEY_INBOX = 'adhd_inbox';

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function load<T>(key: string): T[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
function save<T>(key: string, v: T[]) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(v));
  } catch {
    /* noop */
  }
}

// ─── Milestones ──────────────────────────────────────────────────────────────

export function dbGetMilestonesForGoal(goalId: string): Milestone[] {
  return load<Milestone>(KEY_MILESTONES)
    .filter((m) => m.goalId === goalId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export function dbCreateMilestone(
  goalId: string,
  title: string,
  targetMetric = ''
): Milestone | null {
  const all = load<Milestone>(KEY_MILESTONES);
  const siblings = all.filter((m) => m.goalId === goalId);
  const m: Milestone = {
    id: generateId(),
    goalId,
    title,
    targetMetric,
    sortOrder: siblings.length,
    completedAt: null,
    createdAt: Date.now(),
  };
  save(KEY_MILESTONES, [...all, m]);
  return m;
}

export function dbToggleMilestone(id: string, completed: boolean): boolean {
  const all = load<Milestone>(KEY_MILESTONES);
  save(
    KEY_MILESTONES,
    all.map((m) => (m.id === id ? { ...m, completedAt: completed ? Date.now() : null } : m))
  );
  return true;
}

export function dbDeleteMilestone(id: string): boolean {
  save(
    KEY_MILESTONES,
    load<Milestone>(KEY_MILESTONES).filter((m) => m.id !== id)
  );
  return true;
}

export function dbGetGoalProgress(goalId: string): GoalProgress {
  const ms = dbGetMilestonesForGoal(goalId);
  const done = ms.filter((m) => m.completedAt !== null).length;
  const next = ms.find((m) => m.completedAt === null) ?? null;
  return {
    goalId,
    totalMilestones: ms.length,
    completedMilestones: done,
    percent: ms.length === 0 ? 0 : done / ms.length,
    nextMilestone: next,
  };
}

// ─── Energy windows ──────────────────────────────────────────────────────────

export function dbGetEnergyWindows(): EnergyWindow[] {
  return load<EnergyWindow>(KEY_ENERGY).sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startHour - b.startHour
  );
}

export function dbGetEnergyWindowsForDay(day: number): EnergyWindow[] {
  return dbGetEnergyWindows().filter((w) => w.dayOfWeek === day);
}

export function dbCreateEnergyWindow(
  dayOfWeek: number,
  startHour: number,
  endHour: number,
  intensity: EnergyIntensity
): EnergyWindow | null {
  const w: EnergyWindow = {
    id: generateId(),
    dayOfWeek,
    startHour,
    endHour,
    intensity,
    createdAt: Date.now(),
  };
  save(KEY_ENERGY, [...load<EnergyWindow>(KEY_ENERGY), w]);
  return w;
}

export function dbDeleteEnergyWindow(id: string): boolean {
  save(
    KEY_ENERGY,
    load<EnergyWindow>(KEY_ENERGY).filter((w) => w.id !== id)
  );
  return true;
}

export function dbCopyWindowsToAllWeekdays(sourceDay: number): number {
  const all = load<EnergyWindow>(KEY_ENERGY);
  const src = all.filter((w) => w.dayOfWeek === sourceDay);
  const kept = all.filter((w) => w.dayOfWeek === sourceDay || w.dayOfWeek === 0 || w.dayOfWeek === 6);
  const copies: EnergyWindow[] = [];
  for (let day = 1; day <= 5; day++) {
    if (day === sourceDay) continue;
    for (const w of src) {
      copies.push({ ...w, id: generateId(), dayOfWeek: day, createdAt: Date.now() });
    }
  }
  save(KEY_ENERGY, [...kept, ...copies]);
  return copies.length;
}

const EFFORT_TO_INTENSITY: Record<Exclude<EffortLevel, ''>, EnergyIntensity> = {
  light: 'low',
  medium: 'medium',
  challenging: 'high',
};

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

// ─── Parking lot ─────────────────────────────────────────────────────────────

export function dbGetParkingLot(): ParkingLotItem[] {
  return load<ParkingLotItem>(KEY_PARKING)
    .filter((p) => p.status === 'parked')
    .sort((a, b) => b.divertedAt - a.divertedAt);
}

export function dbGetParkingLotCount(): number {
  return dbGetParkingLot().length;
}

export function dbDivertToParkingLot(title: string, why = ''): ParkingLotItem | null {
  const now = Date.now();
  const item: ParkingLotItem = {
    id: generateId(),
    title,
    why,
    divertedAt: now,
    promotableAt: now + COOLDOWN_MS,
    status: 'parked',
  };
  save(KEY_PARKING, [...load<ParkingLotItem>(KEY_PARKING), item]);
  return item;
}

export function dbPromoteParkingLotItem(id: string): ParkingLotItem | null {
  const all = load<ParkingLotItem>(KEY_PARKING);
  const item = all.find((p) => p.id === id);
  if (!item || Date.now() < item.promotableAt) return null;
  save(
    KEY_PARKING,
    all.map((p) => (p.id === id ? { ...p, status: 'promoted' as const } : p))
  );
  return { ...item, status: 'promoted' };
}

export function dbDismissParkingLotItem(id: string): boolean {
  save(
    KEY_PARKING,
    load<ParkingLotItem>(KEY_PARKING).map((p) =>
      p.id === id ? { ...p, status: 'dismissed' as const } : p
    )
  );
  return true;
}

// ─── Inbox ───────────────────────────────────────────────────────────────────

export function dbGetPendingInboxItems(): InboxItem[] {
  return load<InboxItem>(KEY_INBOX)
    .filter((i) => i.resolvedAt === null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function dbGetPendingInboxCount(): number {
  return dbGetPendingInboxItems().length;
}

export function dbCreateInboxItem(
  rawText: string,
  classification?: InboxClassification | null,
  extras?: { scheduledFor?: string | null; effortLevel?: EffortLevel }
): InboxItem | null {
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
  save(KEY_INBOX, [...load<InboxItem>(KEY_INBOX), item]);
  return item;
}

export function dbUpdateInboxClassification(
  id: string,
  classification: InboxClassification,
  extras?: { scheduledFor?: string | null; effortLevel?: EffortLevel }
): boolean {
  save(
    KEY_INBOX,
    load<InboxItem>(KEY_INBOX).map((i) =>
      i.id === id
        ? {
            ...i,
            classifiedAs: classification,
            scheduledFor: extras?.scheduledFor ?? null,
            effortLevel: extras?.effortLevel ?? '',
          }
        : i
    )
  );
  return true;
}

export function dbResolveInboxItem(id: string, targetId: string | null): boolean {
  save(
    KEY_INBOX,
    load<InboxItem>(KEY_INBOX).map((i) =>
      i.id === id ? { ...i, resolvedAt: Date.now(), targetId } : i
    )
  );
  return true;
}

export function dbDeleteInboxItem(id: string): boolean {
  save(
    KEY_INBOX,
    load<InboxItem>(KEY_INBOX).filter((i) => i.id !== id)
  );
  return true;
}

// ─── Friction (approximation for web — no focus-session aggregation) ─────────

export function dbRecomputeGoalFriction(goalId: string): {
  weeklySeatedSeconds: number;
  currentFrictionMinutes: number;
} {
  // Web fallback: we do not aggregate focus sessions; just echo defaults.
  return {
    weeklySeatedSeconds: 0,
    currentFrictionMinutes: 2,
  };
}
