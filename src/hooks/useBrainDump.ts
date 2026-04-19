import { useState, useCallback, useEffect } from 'react';
import type { BrainDumpItem } from '../types';
import {
  addBrainDumpItem,
  deleteBrainDumpItem,
  getBrainDumpItems,
  subscribeToDataChanges,
  updateBrainDumpItem,
} from '../api/client';

export function useBrainDump() {
  const [items, setItems] = useState<BrainDumpItem[]>([]);

  const refresh = useCallback(async () => {
    setItems(await getBrainDumpItems());
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => subscribeToDataChanges(() => void refresh()), [refresh]);

  const capture = useCallback(async (text: string) => {
    if (!text.trim()) return null;
    const item = await addBrainDumpItem(text.trim());
    await refresh();
    return item;
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteBrainDumpItem(id);
    await refresh();
  }, [refresh]);

  const edit = useCallback(async (id: string, text: string) => {
    if (!text.trim()) return;
    await updateBrainDumpItem(id, text.trim());
    await refresh();
  }, [refresh]);

  return { items, capture, remove, edit, refresh };
}
