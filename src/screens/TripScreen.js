import { Link, Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import ActionSheet from '../components/ActionSheet';
import DriveBody from '../components/DriveBody';
import EditTripSheet from '../components/EditTripSheet';
import MoveDriveSheet from '../components/MoveDriveSheet';
import RouteMap from '../components/RouteMap';
import TelemetryCard, { cardStyle } from '../components/TelemetryCard';
import { useSettings } from '../context/SettingsContext';
import { ensureDrivePlaces } from '../services/placeService';
import { getDrivePoints } from '../storage/driveStorage';
import { deleteTrip, getTrip, updateTrip } from '../storage/tripStorage';
import { colors, dayColor, radius, spacing } from '../theme';
import {
  formatDate,
  formatDateRange,
  formatDayDate,
  formatDistance,
  formatDurationShort,
  formatTime,
} from '../utils/format';
import { downsample } from '../utils/geoMath';
import {
  groupIntoDays,
  routeLabel,
  summarizeDrives,
  tripRouteLabel,
  tripTitle,
} from '../utils/tripSummary';

// Keep the whole-trip map responsive however many drives it has.
const MAX_MAP_POINTS = 3000;

function DayRow({ day, units }) {
  const first = day.drives[0];
  const last = day.drives.at(-1);
  const route = routeLabel({ start: first.places.start, end: last.places.end });
  const { summary } = day;
  const single = day.drives.length === 1;

  const header = (
    <View style={styles.dayHeader}>
      <View style={[styles.dayDot, { backgroundColor: dayColor(day.number) }]} />
      <View style={styles.dayText}>
        <Text style={styles.dayTitle}>
          Day {day.number} · {formatDayDate(day.date)}
        </Text>
        {route ? (
          <Text style={styles.dayRoute} numberOfLines={1}>
            {route}
          </Text>
        ) : null}
        <Text style={styles.dayStats}>
          {formatDistance(summary.distanceM, units)} · {formatDurationShort(summary.movingTimeMs)}{' '}
          driving · {summary.stopCount} {summary.stopCount === 1 ? 'stop' : 'stops'}
        </Text>
      </View>
      {single ? <Text style={styles.chevron}>›</Text> : null}
    </View>
  );

  if (single) {
    return (
      <Link href={`/drives/${first.id}`} asChild>
        <Pressable style={({ pressed }) => [styles.dayRow, pressed && styles.pressed]}>
          {header}
        </Pressable>
      </Link>
    );
  }

  // Several drives that day: list each one under the day heading.
  return (
    <View style={styles.dayRow}>
      {header}
      {day.drives.map((d) => (
        <Link key={d.id} href={`/drives/${d.id}`} asChild>
          <Pressable style={({ pressed }) => [styles.subDrive, pressed && styles.pressed]}>
            <Text style={styles.subDriveText}>
              {formatTime(d.startedAt)}–{formatTime(d.endedAt)} ·{' '}
              {formatDistance(d.stats.distanceM, units)}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

export default function TripScreen() {
  const { id } = useLocalSearchParams();
  const { units } = useSettings();
  const [trip, setTrip] = useState(null);
  const [pointsByDrive, setPointsByDrive] = useState(null); // driveId -> points
  const [missing, setMissing] = useState(false);
  const [menu, setMenu] = useState(null); // null | 'options' | 'edit' | 'move'

  const setDrivePlaces = (driveId, places) =>
    setTrip((prev) => ({
      ...prev,
      drives: prev.drives.map((d) => (d.id === driveId ? { ...d, places } : d)),
    }));

  // Reload on focus so edits made on a drive (move, delete) show up here.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const t = await getTrip(Number(id));
        if (cancelled) return;
        if (!t || t.drives.length === 0) {
          setMissing(true);
          return;
        }
        const all = await Promise.all(t.drives.map((d) => getDrivePoints(d.id)));
        if (cancelled) return;
        setTrip(t);
        setPointsByDrive(new Map(t.drives.map((d, i) => [d.id, all[i]])));
        // Fill in place names that couldn't be looked up when the drive ended.
        const single = t.drives.length === 1;
        for (const d of t.drives) {
          const places = await ensureDrivePlaces(d, { includeStops: single });
          if (cancelled) return;
          setDrivePlaces(d.id, places);
        }
      })().catch((err) => console.warn('[trip] load failed', err));
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  const days = useMemo(() => (trip ? groupIntoDays(trip.drives) : []), [trip]);
  const summary = useMemo(() => (trip ? summarizeDrives(trip.drives) : null), [trip]);

  const segments = useMemo(() => {
    if (!trip || !pointsByDrive) return [];
    const perDrive = Math.max(200, Math.floor(MAX_MAP_POINTS / trip.drives.length));
    return days.flatMap((day) =>
      day.drives.map((d) => ({
        key: `drive-${d.id}`,
        color: dayColor(day.number),
        coordinates: downsample(pointsByDrive.get(d.id) ?? [], perDrive).map(
          ({ latitude, longitude }) => ({ latitude, longitude })
        ),
      }))
    );
  }, [trip, pointsByDrive, days]);

  if (missing) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>This trip no longer exists.</Text>
      </View>
    );
  }
  if (!trip || !pointsByDrive) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const single = trip.drives.length === 1;
  const first = trip.drives[0];
  const last = trip.drives.at(-1);
  const title = tripTitle(trip) ?? formatDate(first.startedAt);
  // Show the route as a subtitle when the user's own name is the title.
  const subtitle = trip.name ? tripRouteLabel(trip) : null;
  const dateLine = single
    ? `${formatDate(first.startedAt)} · ${formatTime(first.startedAt)}`
    : `${formatDateRange(first.startedAt, last.endedAt)} · ${days.length} days`;

  const firstPoint = segments[0]?.coordinates[0];
  const lastPoint = segments.at(-1)?.coordinates.at(-1);

  const save = async (values) => {
    setMenu(null);
    await updateTrip(trip.id, values);
    setTrip((prev) => ({ ...prev, name: values.name.trim() || null, notes: values.notes.trim() || null }));
  };

  const confirmDelete = () => {
    setMenu(null);
    const what = single ? 'This drive' : `All ${trip.drives.length} drives in this trip`;
    Alert.alert('Delete trip?', `${what} will be deleted. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTrip(trip.id).then(() => router.back()),
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: single ? 'Trip' : 'Road Trip',
          headerRight: () => (
            <Pressable onPress={() => setMenu('options')} hitSlop={12}>
              <Text style={styles.headerAction}>Options</Text>
            </Pressable>
          ),
        }}
      />
      <ActionSheet
        visible={menu === 'options'}
        title="Trip options"
        actions={[
          { label: 'Edit name & notes', onPress: () => setMenu('edit') },
          // A lone drive can join an earlier trip (e.g. "Continue" was missed).
          ...(single ? [{ label: 'Add to another trip', onPress: () => setMenu('move') }] : []),
          { label: 'Delete trip', style: 'destructive', onPress: confirmDelete },
        ]}
        onClose={() => setMenu(null)}
      />
      <EditTripSheet
        visible={menu === 'edit'}
        trip={trip}
        placeholder={tripRouteLabel(trip) ?? 'Trip name'}
        onSave={save}
        onClose={() => setMenu(null)}
      />
      {single ? (
        <MoveDriveSheet
          visible={menu === 'move'}
          drive={first}
          allowNewTrip={false}
          onMoved={(tripId) => router.replace(`/trips/${tripId}`)}
          onClose={() => setMenu(null)}
        />
      ) : null}

      <Pressable onPress={() => setMenu('edit')} style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Text style={styles.dateLine}>{dateLine}</Text>
        {trip.notes ? <Text style={styles.notes}>{trip.notes}</Text> : null}
      </Pressable>

      {single ? (
        <DriveBody drive={first} points={pointsByDrive.get(first.id)} units={units} />
      ) : (
        <>
          <RouteMap
            segments={segments}
            markers={[
              ...(firstPoint
                ? [{ key: 'start', coordinate: firstPoint, title: first.places.start || 'Start', color: colors.start }]
                : []),
              ...(lastPoint
                ? [{ key: 'end', coordinate: lastPoint, title: last.places.end || 'Finish', color: colors.stop }]
                : []),
            ]}
          />
          <TelemetryCard
            title="Trip Totals"
            stats={summary}
            elapsedMs={summary.elapsedMs}
            units={units}
          />
          <View style={styles.daysCard}>
            <Text style={styles.cardTitle}>Days</Text>
            {days.map((day) => (
              <DayRow key={day.number} day={day} units={units} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted, fontSize: 15 },
  headerAction: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  titleBlock: { gap: 2 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  dateLine: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  notes: { color: colors.text, fontSize: 15, lineHeight: 21, marginTop: spacing.sm },
  daysCard: { ...cardStyle, gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  dayRow: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayDot: { width: 12, height: 12, borderRadius: 6 },
  dayText: { flex: 1, gap: 2 },
  dayTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  dayRoute: { color: colors.text, fontSize: 14 },
  dayStats: { color: colors.textMuted, fontSize: 13 },
  chevron: { color: colors.textMuted, fontSize: 24, fontWeight: '300' },
  subDrive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 28,
    paddingVertical: spacing.xs,
  },
  subDriveText: { color: colors.text, fontSize: 14 },
  pressed: { opacity: 0.75 },
});
