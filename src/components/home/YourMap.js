import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { getDriveRoutePreview } from '../../storage/driveStorage';

const SIZE = 260; // outer ring
const INNER = 236; // drawn map
const POINTS_PER_DRIVE = 80;

/** Every drive's route, thinned. Reloads when the set of drives changes. */
function useAllRoutes(drives) {
  const key = drives.map((d) => d.id).join(',');
  const [routes, setRoutes] = useState([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(drives.map((d) => getDriveRoutePreview(d.id, POINTS_PER_DRIVE)))
      .then((all) => !cancelled && setRoutes(all.filter((r) => r.length > 1)))
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
 * "Your map": every road you've driven, drawn in blue inside a circle. A plain
 * drawing rather than a live map, so it stays light with many drives. The dot
 * marks where your latest drive started.
 */
export default function YourMap({ drives }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const routes = useAllRoutes(drives);

  const lines = useMemo(() => {
    const all = routes.flat();
    if (all.length < 2) return null;
    const lats = all.map((p) => p.latitude);
    const lngs = all.map((p) => p.longitude);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const k = Math.cos((midLat * Math.PI) / 180); // keep shapes true east-west
    const minX = Math.min(...lngs) * k;
    const maxX = Math.max(...lngs) * k;
    const minY = Math.min(...lats);
    const maxY = Math.max(...lats);
    // Fit the routes inside the circle (a square inscribed in it, plus a margin).
    const box = (INNER / Math.SQRT2) * 0.92;
    const scale = box / Math.max(maxX - minX, maxY - minY, 1e-6);
    const cx = INNER / 2 - ((minX + maxX) / 2) * scale;
    const cy = INNER / 2 + ((minY + maxY) / 2) * scale;
    const project = (p) => [cx + p.longitude * k * scale, cy - p.latitude * scale];
    return {
      polylines: routes.map((r) =>
        r
          .map((p) =>
            project(p)
              .map((n) => n.toFixed(1))
              .join(',')
          )
          .join(' ')
      ),
      home: project(routes.at(-1)[0]),
    };
  }, [routes]);

  return (
    <View style={styles.ring} accessible accessibilityLabel="Your map: every road you've driven">
      <Svg width={INNER} height={INNER}>
        <Circle cx={INNER / 2} cy={INNER / 2} r={INNER / 2} fill={c.mapLand} />
        {lines?.polylines.map((points, i) => (
          <Polyline
            key={i}
            points={points}
            fill="none"
            stroke={c.accent}
            strokeWidth={3.5}
            strokeOpacity={0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
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
