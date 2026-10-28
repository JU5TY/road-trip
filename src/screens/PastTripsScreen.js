import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '../context/SettingsContext';
import { ensureTripPlaces, routeLabel } from '../services/placeService';
import { deleteTrip, listTrips } from '../storage/tripStorage';
import { colors, radius, spacing } from '../theme';
import { formatDate, formatDistance, formatDurationShort, formatTime } from '../utils/format';

function TripRow({ trip, units, onDelete }) {
  const { stats, startedAt, endedAt } = trip;
  const route = routeLabel(trip.places);
  return (
    <Link href={`/trips/${trip.id}`} asChild>
      <Pressable
        onLongPress={() => onDelete(trip)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.rowHeader}>
          <Text style={styles.date}>{formatDate(startedAt)}</Text>
          <Text style={styles.time}>{formatTime(startedAt)}</Text>
        </View>
        {route ? (
          <Text style={styles.route} numberOfLines={1}>
            {route}
          </Text>
        ) : null}
        <Text style={styles.distance}>{formatDistance(stats.distanceM, units)}</Text>
        <View style={styles.rowFooter}>
          <Text style={styles.meta}>Elapsed {formatDurationShort(endedAt - startedAt)}</Text>
          <Text style={styles.meta}>Driving {formatDurationShort(stats.movingTimeMs)}</Text>
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
      // Fill in start/end names for trips that don't have them yet (offline at the end).
      for (const trip of list) {
        if (cancelled) return;
        if (trip.places.start !== undefined && trip.places.end !== undefined) continue;
        const places = await ensureTripPlaces(trip);
        if (!cancelled) {
          setTrips((prev) => prev.map((t) => (t.id === trip.id ? { ...t, places } : t)));
        }
      }
    })().catch((err) => console.warn('[trips] load failed', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  const confirmDelete = (trip) =>
    Alert.alert('Delete trip?', `${formatDate(trip.startedAt)} · ${formatDistance(trip.stats.distanceM, units)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteTrip(trip.id).then(() => setTrips((prev) => prev.filter((t) => t.id !== trip.id))),
      },
    ]);

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
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { color: colors.text, fontSize: 16, fontWeight: '600' },
  route: { color: colors.text, fontSize: 15, marginTop: spacing.xs },
  time: { color: colors.textMuted, fontSize: 14 },
  distance: { color: colors.accent, fontSize: 28, fontWeight: '700', marginVertical: spacing.xs },
  rowFooter: { flexDirection: 'row', gap: spacing.md },
  meta: { color: colors.textMuted, fontSize: 14 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 15 },
  hint: { color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: spacing.sm },
});
