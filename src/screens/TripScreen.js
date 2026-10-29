import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import ActionSheet from '../components/ActionSheet';
import ChartsCard from '../components/charts/ChartsCard';
import DetailLayout from '../components/detail/DetailLayout';
import { routeMarkers, stopMarkerKey } from '../components/detail/mapMarkers';
import Timeline from '../components/detail/Timeline';
import { DetailsRows, HeroStats, TitleBlock } from '../components/detail/TripStats';
import EditTripSheet from '../components/EditTripSheet';
import MoveDriveSheet from '../components/MoveDriveSheet';
import RouteMap from '../components/RouteMap';
import Icon from '../components/ui/Icon';
import SectionHeader from '../components/ui/SectionHeader';
import { useSettings } from '../context/SettingsContext';
import { useStyles, useTheme } from '../hooks/useTheme';
import { ensureDrivePlaces } from '../services/placeService';
import { getDrivePoints } from '../storage/driveStorage';
import { deleteTrip, getTrip, updateTrip } from '../storage/tripStorage';
import { dayBadgeFor, dayColorFor, type } from '../theme';
import {
  formatDate,
  formatDayDate,
  formatDistance,
  formatDurationShort,
  formatTime,
  tripKicker,
} from '../utils/format';
import { averageMovingSpeed, downsample } from '../utils/geoMath';
import { buildTripTimeline } from '../utils/timeline';
import {
  groupIntoDays,
  routeLabel,
  summarizeDrives,
  tripRouteLabel,
  tripTitle,
} from '../utils/tripSummary';

// Keep the whole-trip map responsive however many drives it has.
const MAX_MAP_POINTS = 3000;

/** One day in the Days list. A day with several drives lists each drive under it. */
function DayRow({ day, units, multiDay }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const first = day.drives[0];
  const last = day.drives.at(-1);
  const route = routeLabel({ start: first.places.start, end: last.places.end });
  // A one-day trip's route is drawn in the accent colour, so its badge matches that.
  const [badgeBg, badgeFg] = multiDay
    ? dayBadgeFor(c, day.number)
    : [c.accentContainer, c.onAccentContainer];
  const single = day.drives.length === 1;
  const meta = `${formatDayDate(day.date)} · ${formatDistance(day.summary.distanceM, units, 0)} · ${formatDurationShort(day.summary.movingTimeMs)}`;

  const row = (
    <View style={styles.dayRow}>
      <View style={[styles.badge, { backgroundColor: badgeBg }]}>
        <Text style={[type.bodyStrong, { color: badgeFg, fontFamily: type.navActive.fontFamily }]}>
          {day.number}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={[type.bodyLarge, styles.text, styles.medium]} numberOfLines={1}>
          {route ?? `Day ${day.number}`}
        </Text>
        <Text style={[type.small, styles.muted]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {single ? <Icon name="chevron_right" size={24} color={c.textMuted} /> : null}
    </View>
  );

  if (single) {
    return (
      <Pressable
        onPress={() => router.push(`/drives/${first.id}`)}
        accessibilityRole="link"
        style={({ pressed }) => pressed && styles.pressed}
      >
        {row}
      </Pressable>
    );
  }
  return (
    <View>
      {row}
      {day.drives.map((d, i) => (
        <Pressable
          key={d.id}
          onPress={() => router.push(`/drives/${d.id}`)}
          accessibilityRole="link"
          style={({ pressed }) => [styles.subDrive, pressed && styles.pressed]}
        >
          <Text style={[type.body, styles.text, styles.flex]} numberOfLines={1}>
            Drive {i + 1} · {formatTime(d.startedAt)}–{formatTime(d.endedAt)} ·{' '}
            {formatDistance(d.stats.distanceM, units)}
          </Text>
          <Icon name="chevron_right" size={22} color={c.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

export default function TripScreen() {
  const { id } = useLocalSearchParams();
  const { units } = useSettings();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const [trip, setTrip] = useState(null);
  const [pointsByDrive, setPointsByDrive] = useState(null); // driveId -> points
  const [missing, setMissing] = useState(false);
  const [menu, setMenu] = useState(null); // null | 'options' | 'edit' | 'move'
  const scrollRef = useRef(null);
  const mapRef = useRef(null);
  const [highlight, setHighlight] = useState(null); // point under the finger on a chart

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
        const oneDay = groupIntoDays(t.drives).length === 1;
        for (const d of t.drives) {
          const places = await ensureDrivePlaces(d, { includeStops: oneDay });
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
  const timeline = useMemo(
    () =>
      trip && pointsByDrive && days.length === 1 ? buildTripTimeline(trip, pointsByDrive) : [],
    [trip, pointsByDrive, days]
  );
  const dayColorOf = useCallback(
    (n) => (days.length > 1 ? dayColorFor(c, n) : c.accent),
    [days, c]
  );

  const segments = useMemo(() => {
    if (!trip || !pointsByDrive) return [];
    const perDrive = Math.max(200, Math.floor(MAX_MAP_POINTS / trip.drives.length));
    return days.flatMap((day) =>
      day.drives.map((d) => ({
        key: `drive-${d.id}`,
        color: dayColorOf(day.number),
        coordinates: downsample(pointsByDrive.get(d.id) ?? [], perDrive).map(
          ({ latitude, longitude }) => ({ latitude, longitude })
        ),
      }))
    );
  }, [trip, pointsByDrive, days, dayColorOf]);

  const tracks = useMemo(
    () =>
      days.flatMap((day) =>
        day.drives.map((d) => ({
          key: `drive-${d.id}`,
          color: dayColorOf(day.number),
          points: pointsByDrive?.get(d.id) ?? [],
        }))
      ),
    [days, pointsByDrive, dayColorOf]
  );

  if (missing || !trip || !pointsByDrive) {
    return (
      <View style={[styles.screen, styles.center]}>
        {missing ? (
          <Text style={[type.body, styles.muted]}>This trip no longer exists.</Text>
        ) : (
          <ActivityIndicator color={c.accent} />
        )}
      </View>
    );
  }

  const single = trip.drives.length === 1;
  const first = trip.drives[0];
  const last = trip.drives.at(-1);
  const title = tripTitle(trip) ?? formatDate(first.startedAt);
  // Show the route under the title when the user's own name is the title.
  const subtitle = trip.name ? tripRouteLabel(trip) : null;

  const showMap = () => scrollRef.current?.scrollTo({ y: 0, animated: true });
  // Timeline stop items carry their start time; find which drive they belong to.
  const showTripStop = (item) => {
    const drive = trip.drives.find((d) => d.stats.stops.some((s) => s.startedAt === item.time));
    showMap();
    if (drive) mapRef.current?.focusMarker(stopMarkerKey(drive.id, item.time));
  };

  const save = async (values) => {
    setMenu(null);
    await updateTrip(trip.id, values);
    setTrip((prev) => ({
      ...prev,
      name: values.name.trim() || null,
      notes: values.notes.trim() || null,
    }));
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

  const map = (
    <RouteMap
      ref={mapRef}
      flat
      highlight={highlight}
      segments={segments}
      markers={routeMarkers({
        firstPoint: segments[0]?.coordinates[0],
        lastPoint: segments.at(-1)?.coordinates.at(-1),
        startName: first.places.start,
        endName: last.places.end,
        drives: trip.drives,
        c,
      })}
    />
  );

  return (
    <DetailLayout
      scrollRef={scrollRef}
      map={map}
      actions={[
        { icon: 'edit', label: 'Edit trip', onPress: () => setMenu('edit') },
        { icon: 'more_horiz', label: 'More options', onPress: () => setMenu('options') },
      ]}
    >
      <ActionSheet
        visible={menu === 'options'}
        title="Trip options"
        actions={[
          { icon: 'edit', label: 'Edit name and notes', onPress: () => setMenu('edit') },
          // A lone drive can join an earlier trip (e.g. "Continue" was missed).
          ...(single
            ? [
                {
                  icon: 'drive_file_move',
                  label: 'Add to another trip',
                  onPress: () => setMenu('move'),
                },
              ]
            : []),
          { icon: 'delete', label: 'Delete trip', style: 'destructive', onPress: confirmDelete },
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

      <TitleBlock
        kicker={tripKicker(first.startedAt, last.endedAt, days.length)}
        title={title}
        subtitle={subtitle}
        notes={trip.notes}
        onPress={() => setMenu('edit')}
      />
      <HeroStats stats={summary} units={units} />
      {days.length === 1 ? (
        <Timeline items={timeline} color={c.accent} units={units} onStopPress={showTripStop} />
      ) : null}
      <DetailsRows stats={summary} elapsedMs={summary.elapsedMs} units={units} />
      <ChartsCard
        tracks={tracks}
        units={units}
        avgSpeedMps={averageMovingSpeed(summary)}
        onScrub={setHighlight}
      />
      {/* A trip of one drive would only repeat itself here. */}
      {trip.drives.length > 1 ? (
        <>
          <SectionHeader title="Days" style={styles.daysHeader} />
          {days.map((day) => (
            <DayRow key={day.number} day={day} units={units} multiDay={days.length > 1} />
          ))}
        </>
      ) : null}
    </DetailLayout>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  daysHeader: { marginBottom: 4 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  text: { color: c.text },
  medium: { fontFamily: type.statUnit.fontFamily },
  muted: { color: c.textMuted },
  subDrive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    marginLeft: 64,
    paddingRight: 4,
  },
  pressed: { opacity: 0.6 },
});
