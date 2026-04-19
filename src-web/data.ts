import { useMemo, useSyncExternalStore } from 'react';
import * as db from '../src/db/web';

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;
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

export { db };
