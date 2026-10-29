import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useTripPreview } from '../hooks/useTripPreview';
import { useStyles, useTheme } from '../hooks/useTheme';
import { radius, type } from '../theme';
import { formatDate, formatDistance, formatDurationShort, tripKicker } from '../utils/format';
import { groupIntoDays, summarizeDrives, tripTitle } from '../utils/tripSummary';
import RoutePreview from './RoutePreview';
import Icon from './ui/Icon';

/**
 * Trip card: route map, green date line, name, "780 km · 11h 55m". Tapping it
 * opens the trip. variant 'large' (map on top, Home's Latest trip) or 'row'
 * (88px thumbnail on the left, Trips list). `showMap={false}` swaps the map for
 * a placeholder while the screen is in the background. `roadCount` adds an
 * Iconic Roads chip. Drives whose times are hidden are left out of the time.
 */
export default function TripCard({
  trip,
  units,
  variant = 'row',
  showMap = true,
  onLongPress,
  roadCount = 0,
}) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const segments = useTripPreview(trip);
  const first = trip.drives[0];
  const last = trip.drives.at(-1);
  const dayCount = groupIntoDays(trip.drives).length;
  const summary = summarizeDrives(trip.drives);
  const timed = trip.drives.filter((d) => !d.stats.timesHidden);
  const movingTimeMs = timed.reduce((sum, d) => sum + (d.stats.movingTimeMs ?? 0), 0);
  const large = variant === 'large';
  const chip =
    roadCount > 0 ? (
      <View style={styles.chip}>
        <Icon name="verified" size={14} color={c.onAccentContainer} />
        <Text style={[type.caps, styles.chipText]}>
          {roadCount} {roadCount === 1 ? 'Iconic Road' : 'Iconic Roads'}
        </Text>
      </View>
    ) : null;

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
        <View style={large ? styles.metaRow : null}>
          <Text style={[large ? type.body : styles.rowMeta, styles.muted]} numberOfLines={1}>
            {formatDistance(summary.distanceM, units, summary.distanceM < 100000 ? 1 : 0)}
            {timed.length > 0 ? ` · ${formatDurationShort(movingTimeMs)}` : ''}
          </Text>
          {chip ? <View style={large ? null : styles.chipBelow}>{chip}</View> : null}
        </View>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  chipBelow: { flexDirection: 'row', marginTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 10,
    backgroundColor: c.accentContainer,
  },
  chipText: { color: c.onAccentContainer, letterSpacing: 0 },
  kicker: { color: c.accent },
  title: { color: c.text },
  muted: { color: c.textMuted },
  pressed: { opacity: 0.8 },
});
