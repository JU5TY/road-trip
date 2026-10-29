import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getRoadTotals } from '../storage/roadStorage';

/** Map roadId → { count, first, last } of the user's completions; null while loading. Reloads on focus. */
export function useRoadTotals() {
  const [totals, setTotals] = useState(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getRoadTotals()
        .then((t) => !cancelled && setTotals(t))
        .catch((err) => console.warn('[roads] totals failed', err));
      return () => {
        cancelled = true;
      };
    }, [])
  );
  return totals;
}
