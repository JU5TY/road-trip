import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import {
  formatDistance,
  formatDuration,
  formatDurationShort,
  formatElevation,
  formatSpeed,
} from '../utils/format';
import { averageMovingSpeed } from '../utils/geoMath';

function StatPair({ label, left, right }) {
  return (
    <View style={styles.pair}>
      <Text style={styles.pairLabel}>{label}</Text>
      <View style={styles.pairValues}>
        {[left, right].map((cell) => (
          <View key={cell.caption} style={styles.cell}>
            <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit>
              {cell.value}
            </Text>
            <Text style={styles.cellCaption}>{cell.caption}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Telemetry summary for a drive or a whole trip.
 * `stats` is a drive's stats or a summarizeDrives() result; `elapsedMs` is time
 * on the road (start to STOP, summed across drives for a trip).
 */
export default function TelemetryCard({ title = 'Telemetry Summary', stats, elapsedMs, units }) {
  const overallSpeed = elapsedMs > 0 ? stats.distanceM / (elapsedMs / 1000) : 0;
  // Trips recorded before this stat existed don't have it.
  const longestStint =
    stats.longestStintMs === undefined || stats.longestStintMs === null
      ? '—'
      : formatDuration(stats.longestStintMs);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <StatPair
        label="Distance & Time"
        left={{ value: formatDistance(stats.distanceM, units, 2), caption: 'Distance' }}
        right={{ value: formatDuration(elapsedMs), caption: 'Total elapsed' }}
      />
      <StatPair
        label="Drive Time"
        left={{ value: formatDuration(stats.movingTimeMs), caption: 'Moving time' }}
        right={{ value: longestStint, caption: 'Longest without a break' }}
      />
      <StatPair
        label="Average Speed"
        left={{ value: formatSpeed(averageMovingSpeed(stats), units), caption: 'While moving' }}
        right={{ value: formatSpeed(overallSpeed, units), caption: 'Overall (incl. stops)' }}
      />
      <StatPair
        label="Top Speed & Elevation"
        left={{ value: formatSpeed(stats.topSpeedMps, units), caption: 'Top speed (held 3 s)' }}
        right={{ value: formatElevation(stats.maxAltitudeM, units), caption: 'Max altitude' }}
      />
      <StatPair
        label="Climbing & Stops"
        left={{ value: formatElevation(stats.elevationGainM, units), caption: 'Elevation gain' }}
        right={{
          value: `${stats.stopCount} · ${formatDurationShort(stats.totalStopMs)}`,
          caption: 'Rest stops · total time',
        }}
      />
    </View>
  );
}

export const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  padding: spacing.md,
  gap: spacing.md,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.border,
};

const styles = StyleSheet.create({
  card: cardStyle,
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  pair: { gap: spacing.xs },
  pairLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pairValues: { flexDirection: 'row', gap: spacing.sm },
  cell: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  cellValue: { color: colors.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cellCaption: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
