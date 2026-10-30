import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Polyline, Rect } from 'react-native-svg';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { getDriveRoutePreview } from '../../storage/driveStorage';
import { dayColorFor } from '../../theme';
import { driveGaps, splitAtCrossings } from '../../utils/crossings';
import { fitInBox } from '../../utils/routeOutline';
import { groupIntoDays } from '../../utils/tripSummary';
import Icon from '../ui/Icon';

const HEIGHT = 180;
const MARGIN = 14; // keep routes clear of the rounded corners
const POINTS_PER_DRIVE = 80;

/**
 * Every drive's route, thinned and split at its crossings and pauses:
 * [{ coordinates, crossing, day }], where `day` is the latest trip's day number
 * for its drives and null for everything else. Reloads when the drives (or
 * their gaps) change.
 */
function useAllRoutes(trips) {
  const drives = useMemo(() => trips.flatMap((t) => t.drives), [trips]);
  const key = drives.map((d) => `${d.id}:${driveGaps(d).length}`).join(',');
  const [parts, setParts] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const latestDay = new Map(
      groupIntoDays(trips[0]?.drives ?? []).flatMap((day) =>
        day.drives.map((d) => [d.id, day.number])
      )
    );
    Promise.all(drives.map((d) => getDriveRoutePreview(d.id, POINTS_PER_DRIVE)))
      .then((all) => {
        if (cancelled) return;
        setParts(
          all.flatMap((r, i) =>
            splitAtCrossings(r, driveGaps(drives[i])).map((p) => ({
              ...p,
              day: latestDay.get(drives[i].id) ?? null,
            }))
          )
        );
      })
      .catch((err) => console.warn('[your map] load failed', err));
    return () => {
      cancelled = true;
    };
    // Only re-run when the drives change, not on every new array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return parts;
}

/**
 * Home's "Your map": every road you've driven, drawn flat (no map to load) and
 * fitted to the box. The latest trip is bold in its day colours, everything
 * else faint blue; ferries, tunnels and pauses are dotted. Opens the full map.
 * `trips` newest first.
 */
export default function YourMap({ trips }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const parts = useAllRoutes(trips);
  const [width, setWidth] = useState(0);
  const multiDay = groupIntoDays(trips[0]?.drives ?? []).length > 1;

  const lines = useMemo(() => {
    const fit = width
      ? fitInBox(
          parts.map((p) => p.coordinates),
          width,
          HEIGHT,
          MARGIN
        )
      : null;
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
  }, [parts, width, multiDay, c]);

  return (
    <Pressable
      onPress={() => router.push('/your-map')}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="button"
      accessibilityLabel="Open your map: every road you've driven"
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      {width ? (
        <Svg width={width} height={HEIGHT}>
          <Rect width={width} height={HEIGHT} fill={c.mapLand} />
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
      ) : null}
      <View style={styles.expand}>
        <Icon name="open_in_full" size={20} color={c.text} />
      </View>
    </Pressable>
  );
}

const makeStyles = (c) => ({
  wrap: {
    alignSelf: 'stretch',
    height: HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: c.mapLand,
  },
  pressed: { opacity: 0.9 },
  expand: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
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
