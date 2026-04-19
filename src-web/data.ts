import { useSyncExternalStore } from 'react';
import * as db from '../src/db/web';

type Listener = () => void;

const listeners = new Set<Listener>();
const channel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('focus-web-data')
    : null;

function emit() {
  listeners.forEach((listener) => listener());
  channel?.postMessage({ type: 'changed' });
}

function subscribe(listener: Listener) {
  listeners.add(listener);

  const handleStorage = () => listener();
  const handleMessage = () => listener();

  window.addEventListener('storage', handleStorage);
  channel?.addEventListener('message', handleMessage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
    channel?.removeEventListener('message', handleMessage);
  };
}

export function useDataSnapshot<T>(getSnapshot: () => T): T {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function mutate<T>(run: () => T): T {
  const result = run();
  emit();
  return result;
}

export { db };
