import { useMemo, useSyncExternalStore } from 'react';
import * as db from '../src/db/web';

type Listener = () => void;
type BackupFile = {
  app: 'adhd-app';
  formatVersion: 1;
  exportedAt: string;
  storage: Record<string, string>;
};

const listeners = new Set<Listener>();
let version = 0;
const BACKUP_KEY_PREFIX = 'adhd_';
const channel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('focus-web-data')
    : null;

function notifyChange() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function emit() {
  notifyChange();
  channel?.postMessage({ type: 'changed' });
}

function subscribe(listener: Listener) {
  listeners.add(listener);

  const handleStorage = () => {
    notifyChange();
  };
  const handleMessage = () => {
    notifyChange();
  };

  window.addEventListener('storage', handleStorage);
  channel?.addEventListener('message', handleMessage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
    channel?.removeEventListener('message', handleMessage);
  };
}

export function useDataSnapshot<T>(getSnapshot: () => T): T {
  const currentVersion = useSyncExternalStore(
    subscribe,
    () => version,
    () => version
  );

  return useMemo(() => getSnapshot(), [currentVersion, getSnapshot]);
}

export function mutate<T>(run: () => T): T {
  const result = run();
  emit();
  return result;
}

function getAppStorageKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => !!key && key.startsWith(BACKUP_KEY_PREFIX))
    .sort();
}

export function exportBackupFile(): { fileName: string; itemCount: number } {
  const storage = getAppStorageKeys().reduce<Record<string, string>>((backup, key) => {
    const value = localStorage.getItem(key);
    if (value !== null) {
      backup[key] = value;
    }
    return backup;
  }, {});
  const backup: BackupFile = {
    app: 'adhd-app',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    storage,
  };
  const fileName = `adhd-app-backup-${backup.exportedAt.slice(0, 10)}.json`;
  const href = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
  return { fileName, itemCount: Object.keys(storage).length };
}

export async function restoreBackupFile(file: File): Promise<{ itemCount: number; exportedAt: string }> {
  const parsed = JSON.parse(await file.text()) as Partial<BackupFile>;

  if (
    parsed.app !== 'adhd-app' ||
    parsed.formatVersion !== 1 ||
    typeof parsed.exportedAt !== 'string' ||
    !parsed.storage ||
    typeof parsed.storage !== 'object' ||
    Array.isArray(parsed.storage)
  ) {
    throw new Error('This does not look like an ADHD app backup file.');
  }

  const entries = Object.entries(parsed.storage);
  if (
    entries.some(
      ([key, value]) => !key.startsWith(BACKUP_KEY_PREFIX) || typeof value !== 'string'
    )
  ) {
    throw new Error('Backup contains data outside this app.');
  }

  getAppStorageKeys().forEach((key) => localStorage.removeItem(key));
  entries.forEach(([key, value]) => localStorage.setItem(key, value));
  emit();
  return { itemCount: entries.length, exportedAt: parsed.exportedAt };
}

export { db };
