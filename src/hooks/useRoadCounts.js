import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getRoadCountsByTrip } from '../storage/roadStorage';

/** Map tripId → number of Iconic Roads completed on it (empty while loading). Reloads on focus. */
export function useRoadCounts() {
  const [counts, setCounts] = useState(() => new Map());
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getRoadCountsByTrip()
        .then((m) => !cancelled && setCounts(m))
        .catch((err) => console.warn('[roads] counts failed', err));
      return () => {
        cancelled = true;
      };
    }, [])
  );
  return counts;
}
