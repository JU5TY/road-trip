import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useStyles } from '../../hooks/useTheme';
import { radius, type } from '../../theme';
import { elevationSeries, speedByDistanceSeries } from '../../utils/chartData';
import { distanceUnit, formatElevation, speedUnit, toDistance, toSpeed } from '../../utils/format';
import { haversineDistance } from '../../utils/geoMath';
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
 * colour: [{ key, color, points }]. `avgSpeedMps` draws the dashed Avg line.
 */
export default function ChartsCard({ tracks, units, avgSpeedMps, onScrub }) {
  const styles = useStyles(makeStyles);
  const [choice, setChoice] = useState('elevation');

  const { elevation, speed } = useMemo(() => {
    const perTrack = Math.max(60, Math.floor(TOTAL_POINTS / Math.max(1, tracks.length)));
    let offsetM = 0;
    const elev = [];
    const spd = [];
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
      for (let i = 1; i < t.points.length; i++)
        offsetM += haversineDistance(t.points[i - 1], t.points[i]);
    }
    return { elevation: elev, speed: spd };
  }, [tracks]);

  const hasElevation = elevation.some((s) => s.data.length > 1);
  const hasSpeed = speed.some((s) => s.data.length > 1);
  if (!hasSpeed) return null;
  const showing = hasElevation ? choice : 'speed';

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
        {hasElevation ? (
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
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 4,
  },
  option: { height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center' },
  optionOn: { backgroundColor: c.accent },
  optionText: { color: c.textMuted },
  optionTextOn: { color: c.onAccent },
  card: {
    backgroundColor: c.surfaceLow,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
});
