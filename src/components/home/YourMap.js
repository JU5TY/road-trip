import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { getDriveRoutePreview } from '../../storage/driveStorage';
import { driveGaps, splitAtCrossings } from '../../utils/crossings';
import { fitInCircle } from '../../utils/routeOutline';

const SIZE = 184; // outer ring
const INNER = 166; // drawn map
const POINTS_PER_DRIVE = 80;

/**
 * Every drive's route, thinned and split at its crossings and pauses ([{ coordinates,
 * crossing }]), and where the latest one started. Reloads when the set of
 * drives (or their gaps) changes.
 */
function useAllRoutes(drives) {
  const key = drives.map((d) => `${d.id}:${driveGaps(d).length}`).join(',');
  const [routes, setRoutes] = useState({ parts: [], latestStart: null });
  useEffect(() => {
    let cancelled = false;
    Promise.all(drives.map((d) => getDriveRoutePreview(d.id, POINTS_PER_DRIVE)))
      .then((all) => {
        if (cancelled) return;
        const parts = all.flatMap((r, i) => splitAtCrossings(r, driveGaps(drives[i])));
        setRoutes({ parts, latestStart: all.findLast((r) => r.length > 1)?.[0] ?? null });
      })
      .catch((err) => console.warn('[your map] load failed', err));
    return () => {
      cancelled = true;
    };
    // Only re-run when the drives change, not on every new array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return routes;
}

/**
 * "Your map": every road you've driven, drawn in blue inside a circle, ferries,
 * tunnels and pauses dotted. A plain drawing rather than a live map, so it stays light
 * with many drives. The dot marks where your latest drive started.
 */
export default function YourMap({ drives }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const { parts, latestStart } = useAllRoutes(drives);

  const lines = useMemo(() => {
    const fit = fitInCircle(
      parts.map((p) => p.coordinates),
      INNER
    );
    if (!fit || !latestStart) return null;
    return {
      polylines: parts.map((p) => ({
        points: fit.points(p.coordinates),
        dotted: p.crossing !== null,
      })),
      home: fit.project(latestStart),
    };
  }, [parts, latestStart]);

  return (
    <View style={styles.ring} accessible accessibilityLabel="Your map: every road you've driven">
      <Svg width={INNER} height={INNER}>
        <Circle cx={INNER / 2} cy={INNER / 2} r={INNER / 2} fill={c.mapLand} />
        {lines?.polylines.map((l, i) => (
          <Polyline
            key={i}
            points={l.points}
            fill="none"
            stroke={c.accent}
            strokeWidth={3.5}
            strokeOpacity={0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={l.dotted ? '0.1 7' : undefined}
          />
        ))}
        {lines ? (
          <Circle
            cx={lines.home[0]}
            cy={lines.home[1]}
            r={7}
            fill={c.accent}
            stroke={c.mapRoad}
            strokeWidth={2.5}
          />
        ) : null}
      </Svg>
    </View>
  );
}

const makeStyles = (c) => ({
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    padding: (SIZE - INNER) / 2,
    backgroundColor: c.mapRing,
    overflow: 'hidden',
  },
});
