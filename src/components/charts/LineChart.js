import { useId, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, spacing } from '../../theme';

const LABEL_W = 48; // left column for y-axis labels

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

/**
 * Line (optionally filled) chart with drag-to-inspect.
 * series:   [{ key, color, data: [{ x, y, ... }] }]  (x ascending; several series share axes)
 * formatX / formatY: value → label
 * yFromZero: start the y axis at 0 (speed); otherwise fit to the data
 * minYRange: smallest y span, so flat data doesn't look jagged
 * onScrub(datum | null): called while a finger drags across the chart
 */
export default function LineChart({
  series,
  height = 140,
  formatX,
  formatY,
  area = false,
  yFromZero = false,
  minYRange = 1,
  onScrub,
}) {
  const gradientId = useId().replace(/:/g, '');
  const [plotW, setPlotW] = useState(0); // drawing width, measured on layout
  const [active, setActive] = useState(null); // { datum, color }

  const all = series.flatMap((s) => s.data);
  const domain = useMemo(() => {
    if (all.length === 0) return null;
    const xs = all.map((d) => d.x);
    const ys = all.map((d) => d.y);
    let yMin = yFromZero ? 0 : Math.min(...ys);
    let yMax = Math.max(...ys);
    if (yMax - yMin < minYRange) {
      const mid = (yMax + yMin) / 2;
      yMin = yFromZero ? 0 : mid - minYRange / 2;
      yMax = yFromZero ? Math.max(yMax, minYRange) : mid + minYRange / 2;
    }
    const pad = (yMax - yMin) * 0.08;
    return {
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: yFromZero ? 0 : yMin - pad,
      yMax: yMax + pad,
    };
    // `all` is derived from `series`; recompute when the series change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, yFromZero, minYRange]);

  const sx = (x) =>
    domain && domain.xMax > domain.xMin
      ? ((x - domain.xMin) / (domain.xMax - domain.xMin)) * plotW
      : 0;
  const sy = (y) => (domain ? height - ((y - domain.yMin) / (domain.yMax - domain.yMin)) * height : 0);

  // Drag-to-inspect via the plain responder props (they see current values).
  const inspect = (evt) => {
    if (!domain || plotW <= 0) return;
    const px = Math.min(Math.max(evt.nativeEvent.locationX, 0), plotW);
    const x = domain.xMin + (px / plotW) * (domain.xMax - domain.xMin);
    let best = null;
    for (const one of series) {
      if (one.data.length === 0) continue;
      const d = one.data[nearestIndex(one.data, x)];
      if (!best || Math.abs(d.x - x) < Math.abs(best.datum.x - x)) best = { datum: d, color: one.color };
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

  const paths = series
    .filter((s) => s.data.length > 1)
    .map((s) => {
      const line = s.data
        .map((d, i) => `${i === 0 ? 'M' : 'L'}${sx(d.x).toFixed(1)},${sy(d.y).toFixed(1)}`)
        .join(' ');
      const fill = area
        ? `${line} L${sx(s.data.at(-1).x).toFixed(1)},${height} L${sx(s.data[0].x).toFixed(1)},${height} Z`
        : null;
      return { key: s.key, color: s.color, line, fill };
    });

  const yTicks = [domain.yMax, (domain.yMax + domain.yMin) / 2, domain.yMin];
  const xTicks = [domain.xMin, (domain.xMin + domain.xMax) / 2, domain.xMax];

  return (
    <View>
      <Text style={[styles.readout, !active && styles.readoutIdle]} numberOfLines={1}>
        {active ? `${formatY(active.datum.y)} · ${formatX(active.datum.x)}` : 'Drag across the chart to inspect'}
      </Text>
      <View style={styles.row}>
        <View style={[styles.yLabels, { height }]}>
          {yTicks.map((y, i) => (
            <Text key={i} style={styles.axisLabel} numberOfLines={1}>
              {formatY(y)}
            </Text>
          ))}
        </View>
        <View
          style={{ flex: 1, height }}
          onLayout={(e) => setPlotW(e.nativeEvent.layout.width)}
          {...responder}
        >
          {plotW > 0 ? (
            <Svg width={plotW} height={height} pointerEvents="none">
              <Defs>
                {paths.map((p) => (
                  <LinearGradient key={p.key} id={`${gradientId}-${p.key}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={p.color} stopOpacity="0.45" />
                    <Stop offset="1" stopColor={p.color} stopOpacity="0.02" />
                  </LinearGradient>
                ))}
              </Defs>
              {yTicks.map((y, i) => (
                <Line
                  key={i}
                  x1={0}
                  x2={plotW}
                  y1={sy(y)}
                  y2={sy(y)}
                  stroke={colors.border}
                  strokeWidth={StyleSheet.hairlineWidth * 2}
                />
              ))}
              {paths.map((p) =>
                p.fill ? <Path key={`${p.key}-fill`} d={p.fill} fill={`url(#${gradientId}-${p.key})`} /> : null
              )}
              {paths.map((p) => (
                <Path key={p.key} d={p.line} stroke={p.color} strokeWidth={2} fill="none" strokeLinejoin="round" />
              ))}
              {active ? (
                <>
                  <Line
                    x1={sx(active.datum.x)}
                    x2={sx(active.datum.x)}
                    y1={0}
                    y2={height}
                    stroke={colors.text}
                    strokeWidth={1}
                    strokeOpacity={0.6}
                  />
                  <Circle
                    cx={sx(active.datum.x)}
                    cy={sy(active.datum.y)}
                    r={5}
                    fill={active.color}
                    stroke={colors.background}
                    strokeWidth={2}
                  />
                </>
              ) : null}
            </Svg>
          ) : null}
        </View>
      </View>
      <View style={[styles.xLabels, { marginLeft: LABEL_W }]}>
        {xTicks.map((x, i) => (
          <Text
            key={i}
            style={[styles.axisLabel, i === 1 && styles.center, i === 2 && styles.right]}
            numberOfLines={1}
          >
            {formatX(x)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: spacing.xs },
  readoutIdle: { color: colors.textMuted, fontWeight: '400', fontSize: 12 },
  row: { flexDirection: 'row' },
  yLabels: { width: LABEL_W, justifyContent: 'space-between', paddingRight: spacing.xs },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisLabel: { color: colors.textMuted, fontSize: 11, flex: 1 },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },
});
