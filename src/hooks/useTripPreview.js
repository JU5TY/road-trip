import { useEffect, useState } from 'react';

import { getDriveRoutePreview } from '../storage/driveStorage';
import { dayColorFor } from '../theme';
import { driveGaps, routeSegments } from '../utils/crossings';
import { groupIntoDays } from '../utils/tripSummary';
import { useTheme } from './useTheme';

const POINTS_PER_PREVIEW = 300;

/**
 * Thinned route segments for a trip's map preview: one colour per day for
 * multi-day trips, the accent colour otherwise, crossings and pauses dotted. Null while loading.
 */
export function useTripPreview(trip) {
  const { c } = useTheme();
  const [result, setResult] = useState(null); // { key, segments }
  const driveKey = trip ? trip.drives.map((d) => `${d.id}:${driveGaps(d).length}`).join(',') : '';

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    const days = groupIntoDays(trip.drives);
    const multiDay = days.length > 1;
    const perDrive = Math.max(40, Math.floor(POINTS_PER_PREVIEW / trip.drives.length));
    Promise.all(
      days.flatMap((day) =>
        day.drives.map(async (d) =>
          routeSegments(
            `drive-${d.id}`,
            await getDriveRoutePreview(d.id, perDrive),
            driveGaps(d),
            multiDay ? dayColorFor(c, day.number) : c.accent
          )
        )
      )
    )
      .then((byDrive) => !cancelled && setResult({ key: driveKey, segments: byDrive.flat() }))
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
