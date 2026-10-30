import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { getDriveRoutePreview } from '../../storage/driveStorage';
import { dayColorFor } from '../../theme';
import { driveGaps, splitAtCrossings } from '../../utils/crossings';
import { fitInCircle } from '../../utils/routeOutline';
import { groupIntoDays } from '../../utils/tripSummary';
import Icon from '../ui/Icon';

const SIZE = 216;
const INNER = SIZE - 2; // inside the 1 px border
const POINTS_PER_DRIVE = 80;

// The last routes drawn, so coming back to Home doesn't reload every drive.
// Replaced when a drive is saved or deleted (the key changes).
let cached = { key: null, parts: [] };

/**
 * Every drive's route, thinned and split at its crossings and pauses:
 * [{ coordinates, crossing, day }], where `day` is the latest trip's day number
 * for its drives and null for everything else. Reloads when the drives (or
 * their gaps) change.
 */
function useAllRoutes(trips) {
  const drives = useMemo(() => trips.flatMap((t) => t.drives), [trips]);
  const key = drives.map((d) => `${d.id}:${driveGaps(d).length}`).join(',');
  const [loaded, setLoaded] = useState(cached);
  useEffect(() => {
    if (cached.key === key) return;
    let cancelled = false;
    const latestDay = new Map(
      groupIntoDays(trips[0]?.drives ?? []).flatMap((day) =>
        day.drives.map((d) => [d.id, day.number])
      )
    );
    Promise.all(drives.map((d) => getDriveRoutePreview(d.id, POINTS_PER_DRIVE)))
      .then((all) => {
        if (cancelled) return;
        const next = all.flatMap((r, i) =>
          splitAtCrossings(r, driveGaps(drives[i])).map((p) => ({
            ...p,
            day: latestDay.get(drives[i].id) ?? null,
          }))
        );
        cached = { key, parts: next };
        setLoaded(cached);
      })
      .catch((err) => console.warn('[your map] load failed', err));
    return () => {
      cancelled = true;
    };
    // Only re-run when the drives change, not on every new array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // The cache when it matches (another visit loaded it), else the last load.
  return (cached.key === key ? cached : loaded).parts;
}

/**
 * Home's round "Your map": every road you've driven, drawn flat (no map to
 * load) and fitted inside the circle. The latest trip is bold in its day
 * colours, everything else faint blue; ferries, tunnels and pauses are dotted.
 * Opens the full map. `trips` newest first.
 */
export default function YourMap({ trips }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const parts = useAllRoutes(trips);
  const multiDay = groupIntoDays(trips[0]?.drives ?? []).length > 1;

  const lines = useMemo(() => {
    const fit = fitInCircle(
      parts.map((p) => p.coordinates),
      INNER
    );
    if (!fit) return [];
    const line = (p) => ({ points: fit.points(p.coordinates), dotted: p.crossing !== null });
    // Older routes first, so the latest trip is drawn on top.
    return [
      ...parts.filter((p) => p.day === null).map((p) => ({ ...line(p), latest: false })),
      ...parts
        .filter((p) => p.day !== null)
        .map((p) => ({
          ...line(p),
          latest: true,
          color: multiDay ? dayColorFor(c, p.day) : c.accent,
        })),
    ];
  }, [parts, multiDay, c]);

  return (
    <Pressable
      onPress={() => router.push('/your-map')}
      accessibilityRole="button"
      accessibilityLabel="Open your map"
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View style={styles.circle}>
        <Svg width={INNER} height={INNER}>
          <Circle cx={INNER / 2} cy={INNER / 2} r={INNER / 2} fill={c.mapLand} />
          {lines.map((l, i) => (
            <Polyline
              key={i}
              points={l.points}
              fill="none"
              stroke={l.latest ? l.color : c.accent}
              strokeOpacity={l.latest ? 1 : 0.4}
              strokeWidth={l.latest ? 4.5 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={l.dotted ? '0.1 7' : undefined}
            />
          ))}
        </Svg>
      </View>
      <View style={styles.expand}>
        <Icon name="open_in_full" size={20} color={c.text} />
      </View>
    </Pressable>
  );
}

const makeStyles = (c) => ({
  // The shadow sits here, as the clipped circle inside would cut it off on iOS.
  wrap: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: c.mapLand,
    ...c.mapRingShadow,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: c.mapBorder,
    overflow: 'hidden',
    backgroundColor: c.mapLand,
  },
  pressed: { opacity: 0.9 },
  // Overlaps the circle's bottom-right edge.
  expand: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.floating,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
