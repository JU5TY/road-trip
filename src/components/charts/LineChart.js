import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { type } from '../../theme';

const MARKER_LABEL_W = 64;

/** Index of the datum in `data` (sorted by x) nearest to `x`. */
function nearestIndex(data, x) {
  let lo = 0;
  let hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].x < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(data[lo - 1].x - x) < Math.abs(data[lo].x - x)) return lo - 1;
  return lo;
}

/** Split a series into continuous runs at data flagged `breakBefore` (rest stops). */
function runsOf(data) {
  const runs = [];
  for (const d of data) {
    if (runs.length === 0 || d.breakBefore) runs.push([]);
    runs.at(-1).push(d);
  }
  return runs.filter((r) => r.length > 1);
}

/**
 * Filled line chart with drag-to-inspect. The top line shows the y scale (or
 * the value under the finger); start and end of the x axis sit underneath.
 * series:   [{ key, color, data: [{ x, y, breakBefore?, ... }] }]  (x ascending)
 * refLine:  optional { y, label }, drawn dashed (e.g. average speed)
 * markers:  [{ x, label }] dashed upright lines, labelled under the x axis (borders)
 * formatX / formatY: value → label
 * yFromZero: start the y axis at 0 (speed); otherwise fit to the data
 * minYRange: smallest y span, so flat data doesn't look jagged
 * onScrub(datum | null): called while a finger drags across the chart
 */
export default function LineChart({
  series,
  height = 110,
  formatX,
  formatY,
  refLine,
  markers = [],
  strokeWidth = 3,
  yFromZero = false,
  minYRange = 1,
  onScrub,
}) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const [plotW, setPlotW] = useState(0); // drawing width, measured on layout
  const [active, setActive] = useState(null); // { datum, color }

  const domain = useMemo(() => {
    const all = series.flatMap((s) => s.data);
    if (all.length === 0) return null;
    const ys = all.map((d) => d.y);
    let yMin = yFromZero ? 0 : Math.min(...ys);
    let yMax = Math.max(...ys);
    if (yMax - yMin < minYRange) {
      const mid = (yMax + yMin) / 2;
      yMin = yFromZero ? 0 : mid - minYRange / 2;
      yMax = yFromZero ? Math.max(yMax, minYRange) : mid + minYRange / 2;
    }
    const xs = all.map((d) => d.x);
    return {
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin,
      yMax,
      // Headroom so the line's top doesn't touch the edge.
      yTop: yMax + (yMax - yMin) * 0.06,
    };
  }, [series, yFromZero, minYRange]);

  const sx = (x) =>
    domain && domain.xMax > domain.xMin
      ? ((x - domain.xMin) / (domain.xMax - domain.xMin)) * plotW
      : 0;
  const sy = (y) =>
    domain ? height - ((y - domain.yMin) / (domain.yTop - domain.yMin)) * (height - 2) : 0;

  // Drag-to-inspect via the plain responder props (they see current values).
  const inspect = (evt) => {
    if (!domain || plotW <= 0) return;
    const px = Math.min(Math.max(evt.nativeEvent.locationX, 0), plotW);
    const x = domain.xMin + (px / plotW) * (domain.xMax - domain.xMin);
    let best = null;
    for (const one of series) {
      if (one.data.length === 0) continue;
      const d = one.data[nearestIndex(one.data, x)];
      if (!best || Math.abs(d.x - x) < Math.abs(best.datum.x - x))
        best = { datum: d, color: one.color };
    }
    setActive(best);
    onScrub?.(best?.datum ?? null);
  };
  const endInspect = () => {
    setActive(null);
    onScrub?.(null);
  };
  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    // Keep the gesture once started, so the page doesn't scroll mid-drag.
    onResponderTerminationRequest: () => false,
    onResponderGrant: inspect,
    onResponderMove: inspect,
    onResponderRelease: endInspect,
    onResponderTerminate: endInspect,
  };

  if (!domain) return null;

  const pt = (d) => `${sx(d.x).toFixed(1)},${sy(d.y).toFixed(1)}`;
  const paths = series.flatMap((s) =>
    runsOf(s.data).map((run, i) => {
      const line = run.map((d, j) => `${j === 0 ? 'M' : 'L'}${pt(d)}`).join(' ');
      const x0 = sx(run[0].x).toFixed(1);
      const x1 = sx(run.at(-1).x).toFixed(1);
      return {
        key: `${s.key}-${i}`,
        color: s.color,
        line,
        fill: `${line} L${x1},${height} L${x0},${height} Z`,
      };
    })
  );

  return (
    <View>
      <View style={styles.top}>
        <Text style={[type.caps, styles.muted, active && styles.readout]} numberOfLines={1}>
          {active
            ? `${formatY(active.datum.y)} · ${formatX(active.datum.x)}`
            : formatY(domain.yMax)}
        </Text>
        {refLine && !active ? (
          <View style={styles.legend}>
            <Svg width={16} height={4}>
              <Line
                x1={0}
                x2={16}
                y1={2}
                y2={2}
                stroke={c.textMuted}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            </Svg>
            <Text style={[type.caps, styles.muted]}>{refLine.label}</Text>
          </View>
        ) : null}
      </View>
      <View
        style={{ height }}
        onLayout={(e) => setPlotW(e.nativeEvent.layout.width)}
        {...responder}
      >
        {plotW > 0 ? (
          <Svg width={plotW} height={height} pointerEvents="none">
            {paths.map((p) => (
              <Path key={`${p.key}-fill`} d={p.fill} fill={p.color} fillOpacity={0.14} />
            ))}
            {paths.map((p) => (
              <Path
                key={p.key}
                d={p.line}
                stroke={p.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {refLine ? (
              <Line
                x1={0}
                x2={plotW}
                y1={sy(refLine.y)}
                y2={sy(refLine.y)}
                stroke={c.textMuted}
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            ) : null}
            {markers.map((m) => (
              <Line
                key={`marker-${m.x}`}
                x1={sx(m.x)}
                x2={sx(m.x)}
                y1={0}
                y2={height}
                stroke={c.textMuted}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            ))}
            {active ? (
              <>
                <Line
                  x1={sx(active.datum.x)}
                  x2={sx(active.datum.x)}
                  y1={0}
                  y2={height}
                  stroke={c.text}
                  strokeWidth={1}
                  strokeOpacity={0.5}
                />
                <Circle
                  cx={sx(active.datum.x)}
                  cy={sy(active.datum.y)}
                  r={6}
                  fill={active.color}
                  stroke={c.card}
                  strokeWidth={2.5}
                />
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>
      <View style={styles.xLabels}>
        <Text style={[type.caps, styles.muted]}>{formatX(domain.xMin)}</Text>
        <Text style={[type.caps, styles.muted]}>{formatX(domain.xMax)}</Text>
        {plotW > 0
          ? markers
              // Leave room for the start and end labels.
              .filter((m) => sx(m.x) > MARKER_LABEL_W && sx(m.x) < plotW - MARKER_LABEL_W)
              .map((m) => (
                <Text
                  key={`label-${m.x}`}
                  style={[
                    type.caps,
                    styles.muted,
                    styles.markerLabel,
                    { left: sx(m.x) - MARKER_LABEL_W / 2 },
                  ]}
                  numberOfLines={1}
                >
                  {m.label}
                </Text>
              ))
          : null}
      </View>
    </View>
  );
}

const makeStyles = (c) => ({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 18,
    marginBottom: 4,
  },
  muted: { color: c.textMuted, fontFamily: type.small.fontFamily, letterSpacing: 0 },
  readout: { color: c.text, fontFamily: type.smallStrong.fontFamily },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  markerLabel: { position: 'absolute', top: 0, width: MARKER_LABEL_W, textAlign: 'center' },
});
