import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';
import { fitInCircle } from '../utils/routeOutline';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const DRAW_MS = 1600;

/** Length in px of an SVG polyline `points` string, for drawing it in. */
function polylineLength(points) {
  const xy = points.split(' ').map((p) => p.split(',').map(Number));
  let total = 0;
  for (let i = 1; i < xy.length; i++) {
    total += Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]);
  }
  return total;
}

/**
 * Round flat map of routes, fitted inside a `size` circle (Home's Your map and
 * Welcome). lines: [{ coordinates, color, opacity?, width?, dotted? }], drawn in
 * order. `background(fit)` returns shapes drawn under them (e.g. sea and roads),
 * placed with the same fit. `drawIn` draws the lines in once, unless the phone
 * asks for reduced motion.
 */
export default function RouteCircle({ size, lines, background, drawIn = false }) {
  const { c } = useTheme();
  const [progress] = useState(() => new Animated.Value(drawIn ? 0 : 1));

  useEffect(() => {
    if (!drawIn) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) progress.setValue(1);
        else
          Animated.timing(progress, {
            toValue: 1,
            duration: DRAW_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
      });
    return () => {
      cancelled = true;
    };
  }, [drawIn, progress]);

  const drawn = useMemo(() => {
    const fit = fitInCircle(
      lines.map((l) => l.coordinates),
      size
    );
    if (!fit) return { fit: null, lines: [] };
    return {
      fit,
      lines: lines
        .filter((l) => l.coordinates.length > 1)
        .map((l) => {
          const points = fit.points(l.coordinates);
          return { ...l, points, length: drawIn ? polylineLength(points) : 0 };
        }),
    };
  }, [lines, size, drawIn]);

  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={c.mapLand} />
      {drawn.fit && background ? background(drawn.fit) : null}
      {drawn.lines.map((l, i) => {
        const stroke = {
          points: l.points,
          fill: 'none',
          stroke: l.color,
          strokeOpacity: l.opacity ?? 1,
          strokeWidth: l.width ?? 3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        };
        return drawIn ? (
          <AnimatedPolyline
            key={i}
            {...stroke}
            strokeDasharray={[l.length, l.length]}
            strokeDashoffset={progress.interpolate({
              inputRange: [0, 1],
              outputRange: [l.length, 0],
            })}
          />
        ) : (
          <Polyline key={i} {...stroke} strokeDasharray={l.dotted ? '0.1 7' : undefined} />
        );
      })}
    </Svg>
  );
}
