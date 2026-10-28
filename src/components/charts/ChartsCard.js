import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, dayColor, radius, spacing } from '../../theme';
import { elevationSeries, speedBands, speedSeries } from '../../utils/chartData';
import {
  distanceUnit,
  formatElevation,
  formatTime,
  speedUnit,
  toDistance,
  toSpeed,
} from '../../utils/format';
import { haversineDistance } from '../../utils/geoMath';
import { cardStyle } from '../TelemetryCard';
import DayDistanceBars from './DayDistanceBars';
import LineChart from './LineChart';
import SpeedBandsBar from './SpeedBandsBar';

const MIN_ELEVATION_RANGE_M = 40; // keep near-flat drives from looking mountainous
const MIN_SPEED_RANGE_MPS = 50 / 3.6;
const TRIP_ELEVATION_POINTS = 400;

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Speed bands only mean something once there's time spent moving (walks don't count). */
const hasMovingTime = (bands) => bands.some((b) => b.ms > 0);

const distanceFormatter = (units) => (m) => `${toDistance(m, units).toFixed(0)} ${distanceUnit(units)}`;
const speedFormatter = (units) => (mps) => `${Math.round(toSpeed(mps, units))} ${speedUnit(units)}`;

/**
 * Charts for one drive: a single chart with an Elevation | Speed toggle (so it
 * fits under the map while dragging), then the speed bands.
 */
export function DriveCharts({ points, units, onScrub }) {
  const elevation = useMemo(() => elevationSeries(points), [points]);
  const speed = useMemo(() => speedSeries(points), [points]);
  const bands = useMemo(() => speedBands([points], units), [points, units]);
  const hasElevation = elevation.length > 1;
  const [choice, setChoice] = useState('elevation'); // 'elevation' | 'speed'
  if (speed.length < 2) return null;

  const showing = hasElevation ? choice : 'speed';
  const select = (next) => {
    onScrub?.(null);
    setChoice(next);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>Charts</Text>
        {hasElevation ? (
          <View style={styles.toggle}>
            {[
              ['elevation', 'Elevation'],
              ['speed', 'Speed'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => select(value)}
                style={[styles.toggleItem, showing === value && styles.toggleItemOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: showing === value }}
              >
                <Text style={[styles.toggleText, showing === value && styles.toggleTextOn]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {showing === 'elevation' ? (
        <LineChart
          key="elevation"
          series={[{ key: 'elevation', color: colors.accent, data: elevation }]}
          area
          minYRange={MIN_ELEVATION_RANGE_M}
          formatX={distanceFormatter(units)}
          formatY={(m) => formatElevation(m, units)}
          onScrub={onScrub}
        />
      ) : (
        <LineChart
          key="speed"
          series={[{ key: 'speed', color: colors.link, data: speed }]}
          yFromZero
          minYRange={MIN_SPEED_RANGE_MPS}
          formatX={formatTime}
          formatY={speedFormatter(units)}
          onScrub={onScrub}
        />
      )}
      {hasMovingTime(bands) ? (
        <Section title="Time by speed">
          <SpeedBandsBar bands={bands} />
        </Section>
      ) : null}
    </View>
  );
}

/**
 * Whole-trip charts: elevation across all drives (coloured by day), distance
 * per day, and speed bands. `days` comes from groupIntoDays().
 */
export function TripCharts({ days, pointsByDrive, units, onScrub }) {
  const drives = useMemo(() => days.flatMap((d) => d.drives), [days]);

  const elevation = useMemo(() => {
    const perDrive = Math.max(60, Math.floor(TRIP_ELEVATION_POINTS / drives.length));
    let offsetM = 0;
    const series = [];
    for (const day of days) {
      for (const drive of day.drives) {
        const points = pointsByDrive.get(drive.id) ?? [];
        series.push({
          key: `drive-${drive.id}`,
          color: dayColor(day.number),
          data: elevationSeries(points, { offsetM, maxPoints: perDrive }),
        });
        for (let i = 1; i < points.length; i++) offsetM += haversineDistance(points[i - 1], points[i]);
      }
    }
    return series;
  }, [days, drives, pointsByDrive]);

  const bands = useMemo(
    () => speedBands(drives.map((d) => pointsByDrive.get(d.id) ?? []), units),
    [drives, pointsByDrive, units]
  );
  const hasElevation = elevation.some((s) => s.data.length > 1);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Charts</Text>
      {hasElevation ? (
        <Section title="Elevation">
          <LineChart
            series={elevation}
            area
            minYRange={MIN_ELEVATION_RANGE_M}
            formatX={distanceFormatter(units)}
            formatY={(m) => formatElevation(m, units)}
            onScrub={onScrub}
          />
        </Section>
      ) : null}
      <Section title="Distance per day">
        <DayDistanceBars days={days} units={units} />
      </Section>
      {hasMovingTime(bands) ? (
        <Section title="Time by speed">
          <SpeedBandsBar bands={bands} />
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...cardStyle, gap: spacing.lg },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -spacing.sm },
  toggle: { flexDirection: 'row', backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, padding: 3 },
  toggleItem: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  toggleItemOn: { backgroundColor: colors.accent },
  toggleText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  toggleTextOn: { color: colors.background },
  section: { gap: spacing.xs },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
