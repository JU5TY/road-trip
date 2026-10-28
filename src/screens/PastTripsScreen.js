import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '../context/SettingsContext';
import { ensureDrivePlaces } from '../services/placeService';
import { deleteTrip, listTrips } from '../storage/tripStorage';
import { colors, radius, spacing } from '../theme';
import {
  formatDate,
  formatDateRange,
  formatDistance,
  formatDurationShort,
  formatTime,
} from '../utils/format';
import { groupIntoDays, summarizeDrives, tripTitle } from '../utils/tripSummary';

function TripRow({ trip, units, onDelete }) {
  const first = trip.drives[0];
  const last = trip.drives.at(-1);
  const dayCount = groupIntoDays(trip.drives).length;
  const summary = summarizeDrives(trip.drives);
  const title = tripTitle(trip);
  const when =
    dayCount > 1
      ? formatDateRange(first.startedAt, last.endedAt)
      : `${formatDate(first.startedAt)} · ${formatTime(first.startedAt)}`;

  return (
    <Link href={`/trips/${trip.id}`} asChild>
      <Pressable
        onLongPress={() => onDelete(trip)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.rowHeader}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? formatDate(first.startedAt)}
          </Text>
          {dayCount > 1 ? <Text style={styles.badge}>{dayCount} days</Text> : null}
        </View>
        {/* The date line is redundant when the date is already the title. */}
        {title ? <Text style={styles.when}>{when}</Text> : null}
        <Text style={styles.distance}>{formatDistance(summary.distanceM, units)}</Text>
        <View style={styles.rowFooter}>
          <Text style={styles.meta}>Elapsed {formatDurationShort(summary.elapsedMs)}</Text>
          <Text style={styles.meta}>Driving {formatDurationShort(summary.movingTimeMs)}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function PastTripsScreen() {
  const { units } = useSettings();
  const [trips, setTrips] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    (async () => {
      const list = await listTrips();
      if (cancelled) return;
      setTrips(list);
      // Titles come from the first drive's start and the last drive's end; fill
      // those in if they couldn't be looked up when the drive ended (offline).
      for (const trip of list) {
        for (const drive of new Set([trip.drives[0], trip.drives.at(-1)])) {
          if (cancelled) return;
          if (drive.places.start !== undefined && drive.places.end !== undefined) continue;
          const places = await ensureDrivePlaces(drive);
          if (cancelled) return;
          setTrips((prev) =>
            prev.map((t) =>
              t.id === trip.id
                ? { ...t, drives: t.drives.map((d) => (d.id === drive.id ? { ...d, places } : d)) }
                : t
            )
          );
        }
      }
    })().catch((err) => console.warn('[trips] load failed', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  const confirmDelete = (trip) => {
    const what =
      trip.drives.length === 1 ? 'This trip' : `This trip and its ${trip.drives.length} drives`;
    Alert.alert(
      'Delete trip?',
      `${tripTitle(trip) ?? formatDate(trip.drives[0].startedAt)}\n${what} will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteTrip(trip.id).then(() =>
              setTrips((prev) => prev.filter((t) => t.id !== trip.id))
            ),
        },
      ]
    );
  };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={trips ?? []}
      keyExtractor={(t) => String(t.id)}
      renderItem={({ item }) => <TripRow trip={item} units={units} onDelete={confirmDelete} />}
      ListEmptyComponent={
        trips ? (
          <Text style={styles.empty}>No trips yet. Start one from the dashboard.</Text>
        ) : null
      }
      ListFooterComponent={
        trips?.length ? <Text style={styles.hint}>Long-press a trip to delete it.</Text> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.75 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  badge: {
    color: colors.background,
    backgroundColor: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  when: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  distance: { color: colors.accent, fontSize: 28, fontWeight: '700', marginVertical: spacing.xs },
  rowFooter: { flexDirection: 'row', gap: spacing.md },
  meta: { color: colors.textMuted, fontSize: 14 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 15 },
  hint: { color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: spacing.sm },
});
