import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTripPreview } from '../hooks/useTripPreview';
import { colors, radius, spacing } from '../theme';
import {
  formatDate,
  formatDateRange,
  formatDistance,
  formatDurationShort,
  formatElevation,
  formatTime,
} from '../utils/format';
import { groupIntoDays, summarizeDrives, tripTitle } from '../utils/tripSummary';
import RoutePreview from './RoutePreview';

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Strava-style trip card: title, date, key stats and a route map preview.
 * Tapping anywhere opens the trip. `footer` renders below the map (e.g. a
 * Continue button).
 */
export default function TripCard({ trip, units, mapHeight = 160, footer, showMap = true }) {
  const segments = useTripPreview(trip);
  const first = trip.drives[0];
  const last = trip.drives.at(-1);
  const dayCount = groupIntoDays(trip.drives).length;
  const summary = summarizeDrives(trip.drives);
  const title = tripTitle(trip) ?? formatDate(first.startedAt);
  const when =
    dayCount > 1
      ? `${formatDateRange(first.startedAt, last.endedAt)} · ${dayCount} days`
      : `${formatDate(first.startedAt)} · ${formatTime(first.startedAt)}`;

  return (
    <View style={styles.card}>
      <Link href={`/trips/${trip.id}`} asChild>
        <Pressable style={({ pressed }) => pressed && styles.pressed}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.when}>{when}</Text>
          </View>
          <View style={styles.stats}>
            <Stat label="Distance" value={formatDistance(summary.distanceM, units)} />
            <Stat label="Driving" value={formatDurationShort(summary.movingTimeMs)} />
            <Stat label="Climb" value={formatElevation(summary.elevationGainM, units)} />
          </View>
          <RoutePreview segments={segments ?? []} height={mapHeight} active={showMap} />
        </Pressable>
      </Link>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 2 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  when: { color: colors.textMuted, fontSize: 13 },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.lg,
  },
  stat: { gap: 1 },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
