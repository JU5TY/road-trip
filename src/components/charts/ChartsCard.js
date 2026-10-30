import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useStyles } from '../../hooks/useTheme';
import { radius, type } from '../../theme';
import { elevationSeries, speedByDistanceSeries, stepDistance } from '../../utils/chartData';
import { distanceUnit, formatElevation, speedUnit, toDistance, toSpeed } from '../../utils/format';
import SectionHeader from '../ui/SectionHeader';
import LineChart from './LineChart';

const MIN_ELEVATION_RANGE_M = 40; // keep near-flat drives from looking mountainous
const MIN_SPEED_RANGE_MPS = 50 / 3.6;
const TOTAL_POINTS = 400; // across all tracks, so long trips stay quick to draw

const OPTIONS = [
  ['elevation', 'Elevation'],
  ['speed', 'Speed'],
];

/**
 * "Charts" section: one chart with an Elevation | Speed switch, both against
 * distance from the start. `tracks` are the drives in order, each in its day's
 * colour: [{ key, color, points }], crossings left out (utils/crossings.js
 * withoutCrossings). `avgSpeedMps` draws the dashed Avg line.
 * `speedHidden` leaves only the elevation chart (times hidden for safety).
 * `markers` ([{ time, label }]) mark moments on the elevation chart, e.g. borders.
 */
export default function ChartsCard({
  tracks,
  units,
  avgSpeedMps,
  onScrub,
  speedHidden = false,
  markers = [],
}) {
  const styles = useStyles(makeStyles);
  const [choice, setChoice] = useState('elevation');

  const { elevation, speed, marks } = useMemo(() => {
    const perTrack = Math.max(60, Math.floor(TOTAL_POINTS / Math.max(1, tracks.length)));
    let offsetM = 0;
    const elev = [];
    const spd = [];
    const mk = [];
    for (const t of tracks) {
      elev.push({
        key: t.key,
        color: t.color,
        data: elevationSeries(t.points, { offsetM, maxPoints: perTrack }),
      });
      spd.push({
        key: t.key,
        color: t.color,
        data: speedByDistanceSeries(t.points, { offsetM, maxPoints: perTrack }),
      });
      // Markers at a moment during this track sit at the distance driven by then.
      const pending = markers.filter(
        (m) =>
          t.points.length > 0 &&
          m.time >= t.points[0].timestamp &&
          m.time <= t.points.at(-1).timestamp
      );
      const xs = new Map(pending.map((m) => [m, offsetM]));
      for (let i = 1; i < t.points.length; i++) {
        offsetM += stepDistance(t.points[i - 1], t.points[i]);
        for (const m of pending) if (t.points[i].timestamp <= m.time) xs.set(m, offsetM);
      }
      for (const m of pending) mk.push({ x: xs.get(m), label: m.label });
    }
    return { elevation: elev, speed: spd, marks: mk };
  }, [tracks, markers]);

  const hasElevation = elevation.some((s) => s.data.length > 1);
  const hasSpeed = speed.some((s) => s.data.length > 1);
  // With times hidden (a drive that is just an Iconic Road), only elevation is shown.
  const elevationOnly = speedHidden;
  if (elevationOnly ? !hasElevation : !hasSpeed) return null;
  const showing = speedHidden ? 'elevation' : hasElevation ? choice : 'speed';

  const select = (next) => {
    onScrub?.(null);
    setChoice(next);
  };
  const formatX = (m) => `${Math.round(toDistance(m, units))} ${distanceUnit(units)}`;
  const formatSpeed = (mps) => `${Math.round(toSpeed(mps, units))} ${speedUnit(units)}`;

  return (
    <View>
      <View style={styles.header}>
        <SectionHeader title="Charts" style={styles.title} />
        {hasElevation && !speedHidden ? (
          <View style={styles.switch} role="radiogroup">
            {OPTIONS.map(([value, label]) => {
              const on = showing === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => select(value)}
                  style={[styles.option, on && styles.optionOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[type.label, on ? styles.optionTextOn : styles.optionText]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={styles.card}>
        {showing === 'elevation' ? (
          <LineChart
            key="elevation"
            series={elevation}
            minYRange={MIN_ELEVATION_RANGE_M}
            formatX={formatX}
            formatY={(m) => formatElevation(m, units)}
            markers={marks}
            onScrub={onScrub}
          />
        ) : (
          <LineChart
            key="speed"
            series={speed}
            strokeWidth={2.5}
            yFromZero
            minYRange={MIN_SPEED_RANGE_MPS}
            refLine={
              avgSpeedMps > 0 ? { y: avgSpeedMps, label: `Avg ${formatSpeed(avgSpeedMps)}` } : null
            }
            formatX={formatX}
            formatY={formatSpeed}
            onScrub={onScrub}
          />
        )}
      </View>
    </View>
  );
}

const makeStyles = (c) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
  },
  title: { marginTop: 0, marginBottom: 0 },
  switch: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: c.track,
    borderRadius: 20,
    padding: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  optionOn: { backgroundColor: c.accent },
  optionText: { color: c.textMuted },
  optionTextOn: { color: c.onAccent },
  card: {
    backgroundColor: c.card,
    ...c.cardShadow,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
});
