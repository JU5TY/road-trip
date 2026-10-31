import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { showDialog } from '../components/ui/DialogHost';
import ActionSheet from '../components/ActionSheet';
import ChartsCard from '../components/charts/ChartsCard';
import TripPhotos from '../components/photos/TripPhotos';
import CountriesSection from '../components/countries/CountriesSection';
import DetailLayout from '../components/detail/DetailLayout';
import DriveSections from '../components/detail/DriveSections';
import { routeMarkers, stopMarkerKey } from '../components/detail/mapMarkers';
import Timeline from '../components/detail/Timeline';
import IconicRoadsSection from '../components/roads/IconicRoadsSection';
import { DetailsRows, HeroStats, TitleBlock } from '../components/detail/TripStats';
import EditTripSheet from '../components/EditTripSheet';
import MoveDriveSheet from '../components/MoveDriveSheet';
import RouteMap from '../components/RouteMap';
import FilterChip from '../components/ui/FilterChip';
import Icon from '../components/ui/Icon';
import SectionHeader from '../components/ui/SectionHeader';
import { useSettings } from '../context/SettingsContext';
import { usePhotos } from '../hooks/usePhotos';
import { openPremium, usePremium } from '../hooks/usePremium';
import { useStyles, useTheme } from '../hooks/useTheme';
import { ensureDrivePlaces } from '../services/placeService';
import { deleteDrive, getDrivePoints } from '../storage/driveStorage';
import { getTripCompletions } from '../storage/roadStorage';
import { deleteTrip, getTrip, updateTrip } from '../storage/tripStorage';
import { listVehicles, setDriveVehicle } from '../storage/vehicleStorage';
import { dayBadgeFor, dayColorFor, type } from '../theme';
import {
  formatDate,
  formatDayDate,
  formatDistance,
  formatDurationShort,
  formatTime,
  tripKicker,
} from '../utils/format';
import { driveGaps, routeSegments, withoutCrossings } from '../utils/crossings';
import { averageMovingSpeed, downsample } from '../utils/geoMath';
import { getRoad } from '../utils/iconicRoads';
import { comingSoon } from '../utils/comingSoon';
import { countryRows } from '../utils/countries';
import { buildTripTimeline } from '../utils/timeline';
import { vehicleLabel } from '../utils/vehicles';
import {
  deleteTripMessage,
  groupIntoDays,
  routeLabel,
  summarizeDrives,
  tripRouteLabel,
  tripTitle,
} from '../utils/tripSummary';

// Keep the whole-trip map responsive however many drives it has.
const MAX_MAP_POINTS = 3000;

/** "09:10–10:05 · 24 mi", or just the distance when the drive's times are hidden. */
function driveMeta(drive, units) {
  const distance = formatDistance(drive.stats.distanceM, units);
  return drive.stats.timesHidden
    ? distance
    : `${formatTime(drive.startedAt)}–${formatTime(drive.endedAt)} · ${distance}`;
}

/** One drive in a one-day trip's Drives list; its circle is the drive's number. Tapping picks it. */
function DriveRow({ drive, number, units, isLast, onPick }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={() => onPick(drive.id)}
      accessibilityRole="button"
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={[styles.dayRow, !isLast && styles.divider]}>
        <View style={[styles.badge, { backgroundColor: c.accentContainer }]}>
          <Text
            style={[
              type.bodyStrong,
              { color: c.onAccentContainer, fontFamily: type.navActive.fontFamily },
            ]}
          >
            {number}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={[type.bodyLarge, styles.text, styles.medium]} numberOfLines={1}>
            {routeLabel(drive.places) ?? `Drive ${number}`}
          </Text>
          <Text style={[type.small, styles.muted]} numberOfLines={1}>
            {driveMeta(drive, units)}
          </Text>
        </View>
        <Icon name="chevron_right" size={24} color={c.textMuted} />
      </View>
    </Pressable>
  );
}

/**
 * One day in a multi-day trip's Days list; its circle is the day's number. A
 * day with several drives lists them under it, numbered across the whole trip
 * by `driveNumber`. Tapping a drive picks it.
 */
function DayRow({ day, units, driveNumber, isLast, onPick }) {
  // A day with a drive whose times are hidden (it's just an Iconic Road) shows no times.
  const hideTimes = day.drives.some((d) => d.stats.timesHidden);
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const first = day.drives[0];
  const last = day.drives.at(-1);
  const route = routeLabel({ start: first.places.start, end: last.places.end });
  const [badgeBg, badgeFg] = dayBadgeFor(c, day.number);
  const single = day.drives.length === 1;
  const meta = [
    `Day ${day.number}`,
    formatDayDate(day.date),
    formatDistance(day.summary.distanceM, units, 0),
    ...(hideTimes ? [] : [formatDurationShort(day.summary.movingTimeMs)]),
  ].join(' · ');

  const row = (
    <View style={[styles.dayRow, !isLast && day.drives.length === 1 && styles.divider]}>
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
        onPress={() => onPick(first.id)}
        accessibilityRole="button"
        style={({ pressed }) => pressed && styles.pressed}
      >
        {row}
      </Pressable>
    );
  }
  return (
    <View>
      {row}
      {day.drives.map((d) => (
        <Pressable
          key={d.id}
          onPress={() => onPick(d.id)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.subDrive, pressed && styles.pressed]}
        >
          <Text style={[type.body, styles.text, styles.flex]} numberOfLines={1}>
            {`Drive ${driveNumber(d)} · ${driveMeta(d, units)}`}
          </Text>
          <Icon name="chevron_right" size={22} color={c.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

export default function TripScreen() {
  // `drive` picks one of the trip's drives on arrival (e.g. from an Iconic Road).
  const { id, drive: driveParam } = useLocalSearchParams();
  const { units, showIconicRoads } = useSettings();
  const premium = usePremium();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const [trip, setTrip] = useState(null);
  const [completions, setCompletions] = useState([]); // Iconic Roads on this trip
  const [pointsByDrive, setPointsByDrive] = useState(null); // driveId -> points
  const [missing, setMissing] = useState(false);
  const [menu, setMenu] = useState(null); // null | 'options' | 'edit' | 'move' | 'vehicle'
  const [picked, setPicked] = useState(driveParam ? Number(driveParam) : null); // drive id, null = All
  const [vehicles, setVehicles] = useState([]); // the Garage
  const [loads, setLoads] = useState(0); // bumped to load the trip again (after deleting a drive)
  const {
    photos,
    access: photoAccess,
    allow: allowPhotos,
  } = usePhotos(trip?.drives.map((d) => [d.startedAt, d.endedAt])); // not the time between drives
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
        const [all, roads, garage] = await Promise.all([
          Promise.all(t.drives.map((d) => getDrivePoints(d.id))),
          getTripCompletions(t.id),
          listVehicles(),
        ]);
        if (cancelled) return;
        setVehicles(garage);
        setTrip(t);
        setCompletions(roads);
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
      // `loads` is in the list only to load again after a drive is deleted.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, loads])
  );

  const days = useMemo(() => (trip ? groupIntoDays(trip.drives) : []), [trip]);
  const summary = useMemo(() => (trip ? summarizeDrives(trip.drives) : null), [trip]);
  // Drives that are just an Iconic Road keep their times hidden, so trip totals leave them out.
  const hiddenCount = trip ? trip.drives.filter((d) => d.stats.timesHidden).length : 0;
  const timeSummary = useMemo(
    () => (trip ? summarizeDrives(trip.drives.filter((d) => !d.stats.timesHidden)) : null),
    [trip]
  );
  const timeline = useMemo(
    () =>
      trip && pointsByDrive && days.length === 1 ? buildTripTimeline(trip, pointsByDrive) : [],
    [trip, pointsByDrive, days]
  );
  const dayColorOf = useCallback(
    (n) => (days.length > 1 ? dayColorFor(c, n) : c.accent),
    [days, c]
  );

  // A trip of one drive is that drive; otherwise the picked pill, or null for All.
  const selectedId =
    trip?.drives.length === 1
      ? trip.drives[0].id
      : (trip?.drives.find((d) => d.id === picked)?.id ?? null);

  // A picked drive shows its rest stops (and border towns) by name; the first
  // time it's picked, fill in any names the trip view didn't need.
  const selectedDrive = trip?.drives.find((d) => d.id === selectedId);
  const named = useRef(new Set());
  useEffect(() => {
    if (!selectedDrive || named.current.has(selectedDrive.id)) return;
    named.current.add(selectedDrive.id);
    ensureDrivePlaces(selectedDrive, { includeStops: true })
      .then((places) => setDrivePlaces(selectedDrive.id, places))
      .catch((err) => console.warn('[trip] stop names failed', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const segments = useMemo(() => {
    if (!trip || !pointsByDrive) return [];
    const perDrive = Math.max(200, Math.floor(MAX_MAP_POINTS / trip.drives.length));
    return days.flatMap((day) =>
      day.drives.flatMap((d) =>
        routeSegments(
          `drive-${d.id}`,
          downsample(pointsByDrive.get(d.id) ?? [], perDrive).map(
            ({ latitude, longitude, timestamp }) => ({ latitude, longitude, timestamp })
          ),
          driveGaps(d),
          // With one drive picked, the others fade back.
          selectedId && d.id !== selectedId ? `${dayColorOf(day.number)}40` : dayColorOf(day.number)
        )
      )
    );
  }, [trip, pointsByDrive, days, dayColorOf, selectedId]);
  // Frame the picked drive (the whole trip for All). From its points, not the
  // segments, so place names arriving don't move the map again.
  const fitTo = useMemo(
    () =>
      selectedId && pointsByDrive
        ? downsample(pointsByDrive.get(selectedId) ?? [], 200).map(({ latitude, longitude }) => ({
            latitude,
            longitude,
          }))
        : undefined,
    [pointsByDrive, selectedId]
  );

  const driveColors = useMemo(
    () => new Map(days.flatMap((day) => day.drives.map((d) => [d.id, dayColorOf(day.number)]))),
    [days, dayColorOf]
  );

  const tracks = useMemo(
    () =>
      days.flatMap((day) =>
        day.drives.map((d) => ({
          key: `drive-${d.id}`,
          color: dayColorOf(day.number),
          points: withoutCrossings(pointsByDrive?.get(d.id) ?? [], driveGaps(d)),
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

  const allHidden = hiddenCount === trip.drives.length;
  const roadsShown = showIconicRoads ? completions : [];
  const dayOf = (driveId) => {
    const drive = trip.drives.find((d) => d.id === driveId);
    return drive ? (days.find((day) => day.drives.includes(drive))?.number ?? 1) : 1;
  };

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

  const selected = selectedDrive ?? null;
  const pick = (driveId) => {
    setPicked(driveId);
    showMap();
  };
  const dayNumberOf = (d) => days.find((day) => day.drives.includes(d))?.number ?? 1;
  const vehicle = selected ? (vehicles.find((v) => v.id === selected.vehicleId) ?? null) : null;
  const chooseVehicle = (vehicleId) => {
    setMenu(null);
    setDriveVehicle(selected.id, vehicleId)
      .then(() =>
        setTrip((prev) => ({
          ...prev,
          drives: prev.drives.map((d) => (d.id === selected.id ? { ...d, vehicleId } : d)),
        }))
      )
      .catch((err) => console.warn('[trip] vehicle change failed', err));
  };
  const showDriveStop = (item) => {
    showMap();
    mapRef.current?.focusMarker(stopMarkerKey(selected.id, item.time));
  };
  const confirmDeleteDrive = () => {
    setMenu(null);
    showDialog({
      title: 'Delete this drive?',
      message: "Its route and stats will be removed from the trip. This can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () =>
        deleteDrive(selected.id).then(() => {
          setPicked(null);
          setLoads((n) => n + 1);
        }),
    });
  };

  const confirmDelete = () => {
    setMenu(null);
    showDialog({
      title: 'Delete this trip?',
      message: deleteTripMessage(trip, formatDate(first.startedAt)),
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteTrip(trip.id).then(() => router.back()),
    });
  };

  const map = (
    <RouteMap
      ref={mapRef}
      flat
      highlight={highlight}
      segments={segments}
      fitTo={fitTo}
      markers={routeMarkers(
        selected
          ? {
              firstPoint: fitTo[0],
              lastPoint: fitTo.at(-1),
              startName: selected.places.start,
              endName: selected.places.end,
              drives: [selected],
              c,
              colorOf: (d) => driveColors.get(d.id),
            }
          : {
              firstPoint: segments[0]?.coordinates[0],
              lastPoint: segments.at(-1)?.coordinates.at(-1),
              startName: first.places.start,
              endName: last.places.end,
              drives: trip.drives,
              c,
              colorOf: (d) => driveColors.get(d.id),
            }
      )}
    />
  );

  return (
    <DetailLayout
      scrollRef={scrollRef}
      map={map}
      actions={[
        { icon: 'edit', label: 'Edit trip', onPress: () => setMenu('edit') },
        {
          icon: 'download',
          label: 'Export',
          onPress: premium ? () => comingSoon('Exporting trips') : openPremium,
        },
        { icon: 'more_horiz', label: 'More options', onPress: () => setMenu('options') },
        { icon: 'ios_share', label: 'Share', primary: true, onPress: () => comingSoon('Sharing') },
      ]}
    >
      <ActionSheet
        visible={menu === 'options'}
        title={selected && !single ? 'Options' : 'Trip options'}
        actions={[
          // The picked drive (or a lone one) can move to another trip, e.g. "Continue" was missed.
          ...(selected
            ? [
                {
                  icon: 'drive_file_move',
                  label: single ? 'Add to another trip' : 'Move this drive to another trip',
                  onPress: () => setMenu('move'),
                },
              ]
            : []),
          ...(selected && !single
            ? [
                {
                  icon: 'delete',
                  label: 'Delete this drive',
                  style: 'destructive',
                  onPress: confirmDeleteDrive,
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
      {selected ? (
        <MoveDriveSheet
          visible={menu === 'move'}
          drive={selected}
          allowNewTrip={!single}
          // Follow the drive to its new trip.
          onMoved={(tripId) => router.replace(`/trips/${tripId}?drive=${selected.id}`)}
          onClose={() => setMenu(null)}
        />
      ) : null}
      <ActionSheet
        visible={menu === 'vehicle'}
        title="Vehicle for this drive"
        actions={vehicles.map((v) => ({
          key: String(v.id),
          label: vehicleLabel(v),
          detail: v.registration,
          selected: v.id === selected?.vehicleId,
          onPress: () => chooseVehicle(v.id),
        }))}
        onClose={() => setMenu(null)}
      />

      <TitleBlock
        // "TRIP ·" first: this page is the trip, whichever drive is picked.
        kicker={`TRIP · ${
          allHidden && days.length === 1
            ? formatDayDate(first.startedAt).toUpperCase()
            : tripKicker(first.startedAt, last.endedAt, days.length, { withYear: true })
        }`}
        title={title}
        subtitle={subtitle}
        notes={trip.notes}
        onPress={() => setMenu('edit')}
      />
      {single ? null : (
        // One page per trip: All, or one drive at a time.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillScroll}
          contentContainerStyle={styles.pills}
          role="radiogroup"
        >
          <FilterChip label="All" selected={!selected} onPress={() => pick(null)} />
          {trip.drives.map((d, i) => (
            <FilterChip
              key={d.id}
              label={`Drive ${i + 1}`}
              dot={driveColors.get(d.id)}
              selected={d.id === selectedId}
              onPress={() => pick(d.id)}
            />
          ))}
        </ScrollView>
      )}
      {selected && !single ? (
        <View style={styles.picked}>
          <Text style={[type.section, styles.text]} numberOfLines={1}>
            {routeLabel(selected.places) ?? `Drive ${trip.drives.indexOf(selected) + 1}`}
          </Text>
          <Text style={[type.body, styles.muted]} numberOfLines={1}>
            {[
              ...(days.length > 1 ? [`Day ${dayNumberOf(selected)}`] : []),
              formatDayDate(selected.startedAt),
              ...(selected.stats.timesHidden
                ? []
                : [`${formatTime(selected.startedAt)}–${formatTime(selected.endedAt)}`]),
            ].join(' · ')}
          </Text>
        </View>
      ) : null}
      {selected ? (
        <>
          <DriveSections
            drive={selected}
            points={pointsByDrive.get(selected.id) ?? []}
            color={driveColors.get(selected.id)}
            completions={completions.filter((r) => r.driveId === selected.id)}
            photos={photos.filter(
              (p) => p.time >= selected.startedAt && p.time <= selected.endedAt
            )}
            vehicle={vehicle}
            // Something to change to: another vehicle, or any when none is set.
            onChangeVehicle={vehicles.some((v) => v !== vehicle) ? () => setMenu('vehicle') : null}
            onStopPress={showDriveStop}
            onScrub={setHighlight}
          />
          {/* A trip of one drive keeps the trip's own photos section too. */}
          {single ? (
            <TripPhotos
              photos={photos}
              access={photoAccess}
              allow={allowPhotos}
              hideTimes={hiddenCount > 0}
            />
          ) : null}
        </>
      ) : (
        <>
          <HeroStats
            stats={{ ...summary, movingTimeMs: timeSummary.movingTimeMs }}
            units={units}
            timesHidden={allHidden}
            trip
            roadCount={roadsShown.length ? new Set(roadsShown.map((r) => r.roadId)).size : 0}
          />
          {days.length === 1 ? (
            <Timeline
              items={timeline}
              color={c.accent}
              units={units}
              onStopPress={showTripStop}
              roads={roadsShown.map((r) => ({
                name: getRoad(r.roadId)?.name,
                completedAt: r.completedAt,
              }))}
              hideTimes={hiddenCount > 0}
              photos={photos}
            />
          ) : null}
          {/* A trip of one drive would only repeat itself here. */}
          {trip.drives.length > 1 ? (
            <>
              {/* Each circle counts what the section is named after: days, or a one-day trip's drives. */}
              <SectionHeader title={days.length > 1 ? 'Days' : 'Drives'} />
              <View style={styles.group}>
                {days.length > 1
                  ? days.map((day, i) => (
                      <DayRow
                        key={day.number}
                        day={day}
                        units={units}
                        driveNumber={(d) => trip.drives.indexOf(d) + 1}
                        isLast={i === days.length - 1}
                        onPick={pick}
                      />
                    ))
                  : trip.drives.map((d, i) => (
                      <DriveRow
                        key={d.id}
                        drive={d}
                        number={i + 1}
                        units={units}
                        isLast={i === trip.drives.length - 1}
                        onPick={pick}
                      />
                    ))}
              </View>
            </>
          ) : null}
          <TripPhotos
            photos={photos}
            access={photoAccess}
            allow={allowPhotos}
            hideTimes={hiddenCount > 0}
          />
          <IconicRoadsSection completions={roadsShown} dayOf={dayOf} />
          <CountriesSection
            rows={countryRows(
              trip.drives,
              days.length > 1
                ? { dayOf: (d) => days.find((day) => day.drives.includes(d))?.number ?? 1 }
                : {}
            )}
            units={units}
            scope="trip"
          />
          <ChartsCard
            tracks={tracks}
            units={units}
            avgSpeedMps={averageMovingSpeed(timeSummary)}
            onScrub={setHighlight}
            speedHidden={hiddenCount > 0}
          />
          <DetailsRows
            // Elevations aren't times, so they count every drive.
            stats={
              allHidden
                ? summary
                : {
                    ...timeSummary,
                    maxAltitudeM: summary.maxAltitudeM,
                    elevationGainM: summary.elevationGainM,
                  }
            }
            elapsedMs={timeSummary.elapsedMs}
            units={units}
            timesHidden={allHidden}
            trip
            subtitle="Whole trip"
            hiddenNote={
              hiddenCount > 0 && !allHidden
                ? `Times leave out ${hiddenCount === 1 ? 'a drive' : `${hiddenCount} drives`} that ${hiddenCount === 1 ? 'is' : 'are'} just an Iconic Road, for safety.`
                : null
            }
          />
        </>
      )}
    </DetailLayout>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  group: { paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.card, ...c.cardShadow },
  pillScroll: { marginHorizontal: -16, marginTop: 16, flexGrow: 0 },
  pills: { gap: 8, paddingHorizontal: 16 },
  picked: { marginTop: 16, marginHorizontal: 4 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 68,
    paddingHorizontal: 4,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: c.divider },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
