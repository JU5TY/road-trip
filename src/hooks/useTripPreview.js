import { useEffect, useState } from 'react';

import { getDriveRoutePreview } from '../storage/driveStorage';
import { dayColorFor } from '../theme';
import { groupIntoDays } from '../utils/tripSummary';
import { useTheme } from './useTheme';

const POINTS_PER_PREVIEW = 300;

/**
 * Thinned route segments for a trip's map preview: one colour per day for
 * multi-day trips, the accent colour otherwise. Null while loading.
 */
export function useTripPreview(trip) {
  const { c } = useTheme();
  const [result, setResult] = useState(null); // { key, segments }
  const driveKey = trip ? trip.drives.map((d) => d.id).join(',') : '';

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    const days = groupIntoDays(trip.drives);
    const multiDay = days.length > 1;
    const perDrive = Math.max(40, Math.floor(POINTS_PER_PREVIEW / trip.drives.length));
    Promise.all(
      days.flatMap((day) =>
        day.drives.map(async (d) => ({
          key: `drive-${d.id}`,
          color: multiDay ? dayColorFor(c, day.number) : c.accent,
          coordinates: await getDriveRoutePreview(d.id, perDrive),
        }))
      )
    )
      .then((segments) => !cancelled && setResult({ key: driveKey, segments }))
      .catch((err) => console.warn('[preview] load failed', err));
    return () => {
      cancelled = true;
    };
    // Re-run only when the set of drives (or the theme) changes, not on every new trip object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveKey, c]);

  // Ignore a result that belongs to a previous trip.
  return result && result.key === driveKey ? result.segments : null;
}
