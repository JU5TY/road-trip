import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useTripPreview } from '../hooks/useTripPreview';
import { useStyles } from '../hooks/useTheme';
import { radius, type } from '../theme';
import { formatDate, formatDistance, formatDurationShort, tripKicker } from '../utils/format';
import { groupIntoDays, summarizeDrives, tripTitle } from '../utils/tripSummary';
import RoutePreview from './RoutePreview';

/**
 * Trip card: route map, green date line, name, "780 km · 11h 55m". Tapping it
 * opens the trip. variant 'large' (map on top, Home's Latest trip) or 'row'
 * (88px thumbnail on the left, Trips list). `showMap={false}` swaps the map for
 * a placeholder while the screen is in the background.
 */
export default function TripCard({ trip, units, variant = 'row', showMap = true, onLongPress }) {
  const styles = useStyles(makeStyles);
  const segments = useTripPreview(trip);
  const first = trip.drives[0];
  const last = trip.drives.at(-1);
  const dayCount = groupIntoDays(trip.drives).length;
  const summary = summarizeDrives(trip.drives);
  const large = variant === 'large';

  return (
    // A plain Pressable, not <Link asChild>: Link drops function styles on
    // Android, which collapsed the card's row layout.
    <Pressable
      onPress={() => router.push(`/trips/${trip.id}`)}
      onLongPress={onLongPress}
      accessibilityRole="link"
      style={({ pressed }) => [large ? styles.large : styles.row, pressed && styles.pressed]}
    >
      {large ? (
        <RoutePreview segments={segments ?? []} height={180} active={showMap} />
      ) : (
        <RoutePreview
          segments={segments ?? []}
          height={88}
          width={88}
          rounded={16}
          active={showMap}
        />
      )}
      <View style={large ? styles.largeText : styles.rowText}>
        <Text style={[type.caps, styles.kicker]} numberOfLines={1}>
          {tripKicker(first.startedAt, last.endedAt, dayCount)}
        </Text>
        <Text style={[large ? type.section : styles.rowTitle, styles.title]} numberOfLines={1}>
          {tripTitle(trip) ?? formatDate(first.startedAt)}
        </Text>
        <Text style={[large ? type.body : styles.rowMeta, styles.muted]} numberOfLines={1}>
          {formatDistance(summary.distanceM, units, summary.distanceM < 100000 ? 1 : 0)} ·{' '}
          {formatDurationShort(summary.movingTimeMs)}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (c) => ({
  large: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: c.surfaceLow },
  largeText: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 18, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceLow,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { ...type.bodyStrong, fontSize: 17 },
  rowMeta: { ...type.body, fontSize: 14 },
  kicker: { color: c.accent },
  title: { color: c.text },
  muted: { color: c.textMuted },
  pressed: { opacity: 0.8 },
});
