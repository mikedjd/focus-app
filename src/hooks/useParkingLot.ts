import { useCallback, useEffect, useState } from 'react';
import {
  dbDismissParkingLotItem,
  dbDivertToParkingLot,
  dbGetParkingLot,
  dbGetParkingLotCount,
  dbPromoteParkingLotItem,
} from '../db';
import { notifyDataChanged, subscribeToDataChanges } from '../api/client';
import type { ParkingLotItem } from '../types';

export function useParkingLot() {
  const [items, setItems] = useState<ParkingLotItem[]>([]);
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    setItems(dbGetParkingLot());
    setCount(dbGetParkingLotCount());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => subscribeToDataChanges(refresh), [refresh]);

  const divert = useCallback(
    (title: string, why = '') => {
      if (!title.trim()) return null;
      const r = dbDivertToParkingLot(title.trim(), why.trim());
      notifyDataChanged();
      refresh();
      return r;
    },
    [refresh]
  );

  const promote = useCallback(
    (id: string) => {
      const r = dbPromoteParkingLotItem(id);
      notifyDataChanged();
      refresh();
      return r;
    },
    [refresh]
  );

  const dismiss = useCallback(
    (id: string) => {
      dbDismissParkingLotItem(id);
      notifyDataChanged();
      refresh();
    },
    [refresh]
  );

  return { items, count, divert, promote, dismiss, refresh };
}
