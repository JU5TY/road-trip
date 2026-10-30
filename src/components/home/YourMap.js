import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { getDriveRoutePreview } from '../../storage/driveStorage';
import { fitInCircle } from '../../utils/routeOutline';

const SIZE = 184; // outer ring
const INNER = 166; // drawn map
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
    const fit = fitInCircle(routes, INNER);
    if (!fit) return null;
    return { polylines: routes.map(fit.points), home: fit.project(routes.at(-1)[0]) };
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
