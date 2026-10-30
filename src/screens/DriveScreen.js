import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { showDialog } from '../components/ui/DialogHost';
import ActionSheet from '../components/ActionSheet';
import ChartsCard from '../components/charts/ChartsCard';
import CountriesSection from '../components/countries/CountriesSection';
import DetailLayout from '../components/detail/DetailLayout';
import { routeMarkers, stopMarkerKey } from '../components/detail/mapMarkers';
import Timeline from '../components/detail/Timeline';
import IconicRoadsSection from '../components/roads/IconicRoadsSection';
import { DetailsRows, HeroStats, TitleBlock, vehicleRows } from '../components/detail/TripStats';
import MoveDriveSheet from '../components/MoveDriveSheet';
import RouteMap from '../components/RouteMap';
import { useSettings } from '../context/SettingsContext';
import { usePhotos } from '../hooks/usePhotos';
import { useRoadTotals } from '../hooks/useRoadTotals';
import { openPremium, usePremium } from '../hooks/usePremium';
import { useStyles, useTheme } from '../hooks/useTheme';
import { ensureDrivePlaces } from '../services/placeService';
import { deleteDrive, getDrive, getDrivePoints } from '../storage/driveStorage';
import { getDriveCompletions } from '../storage/roadStorage';
import { getTrip } from '../storage/tripStorage';
import { getVehicleNames } from '../storage/vehicleStorage';
import { dayColorFor } from '../theme';
import { countryRows } from '../utils/countries';
import { driveGaps, routeSegments, withoutCrossings } from '../utils/crossings';
import { formatDate, formatDayDate, formatTime } from '../utils/format';
import { averageMovingSpeed, downsample } from '../utils/geoMath';
import { getRoad } from '../utils/iconicRoads';
import { comingSoon } from '../utils/comingSoon';
import { buildDriveTimeline } from '../utils/timeline';
import {
  dayNumberFor,
  driveElapsedMs,
  groupIntoDays,
  routeLabel,
  tripTitle,
} from '../utils/tripSummary';

/** One drive (a single START→STOP recording) inside a trip: the "Day" page. */
export default function DriveScreen() {
  const { id } = useLocalSearchParams();
  const { units, showIconicRoads } = useSettings();
  const premium = usePremium();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const [drive, setDrive] = useState(null);
  const [points, setPoints] = useState(null);
  const [trip, setTrip] = useState(null);
  const [completions, setCompletions] = useState([]); // Iconic Roads on this drive
  const [vehicleNames, setVehicleNames] = useState(new Map());
  const [menu, setMenu] = useState(null); // null | 'options' | 'move'
  const [highlight, setHighlight] = useState(null); // point under the finger on a chart
  const { photos } = usePhotos(drive?.startedAt, drive?.endedAt);
  const roadTotals = useRoadTotals();
  const scrollRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await getDrive(Number(id));
      if (cancelled || !d) return;
      const [p, t, roads, names] = await Promise.all([
        getDrivePoints(d.id),
        getTrip(d.tripId),
        getDriveCompletions(d.id),
        getVehicleNames(),
      ]);
      if (cancelled) return;
      setVehicleNames(names);
      setDrive(d);
      setPoints(p);
      setTrip(t);
      setCompletions(roads);
      const places = await ensureDrivePlaces(d, { includeStops: true });
      if (!cancelled) setDrive((prev) => ({ ...prev, places }));
    })().catch((err) => console.warn('[drive] load failed', err));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const route = useMemo(
    () =>
      points
        ? downsample(points).map(({ latitude, longitude, timestamp }) => ({
            latitude,
            longitude,
            timestamp,
          }))
        : [],
    [points]
  );
  const chartMarkers = useMemo(
    () => (drive?.countries ?? []).slice(1).map((v) => ({ time: v.enteredAt, label: 'Border' })),
    [drive]
  );
  const timeline = useMemo(
    () => (drive && points ? buildDriveTimeline(drive, points) : []),
    [drive, points]
  );

  if (!drive || !points || !trip) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const multiDay = groupIntoDays(trip.drives).length > 1;
  const earlier = trip.drives.filter((d) => d.startedAt < drive.startedAt);
  const dayNumber = dayNumberFor(earlier, drive.startedAt);
  const color = multiDay ? dayColorFor(c, dayNumber) : c.accent;
  const kicker = (
    multiDay
      ? `Day ${dayNumber} · ${formatDayDate(drive.startedAt)}`
      : drive.stats.timesHidden
        ? formatDayDate(drive.startedAt)
        : `${formatDayDate(drive.startedAt)} · ${formatTime(drive.startedAt)}`
  ).toUpperCase();

  // A drive that is just an Iconic Road (starts and ends at its gates) shows no times.
  const hideTimes = Boolean(drive.stats.timesHidden);
  const roadsShown = showIconicRoads ? completions : [];
  const countries = countryRows([drive]);

  const showStop = (item) => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    mapRef.current?.focusMarker(stopMarkerKey(drive.id, item.time));
  };

  const confirmDelete = () => {
    setMenu(null);
    showDialog({
      title: 'Delete this drive?',
      message: "Its route and stats will be removed from the trip. This can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteDrive(drive.id).then(() => router.back()),
    });
  };

  const map = (
    <RouteMap
      ref={mapRef}
      flat
      highlight={highlight}
      segments={routeSegments('route', route, driveGaps(drive), color)}
      markers={routeMarkers({
        firstPoint: route[0],
        lastPoint: route.at(-1),
        startName: drive.places.start,
        endName: drive.places.end,
        drives: [drive],
        c,
        colorOf: () => color,
      })}
    />
  );

  return (
    <DetailLayout
      scrollRef={scrollRef}
      map={map}
      mapHeight={hideTimes ? 400 : 380}
      actions={
        // A drive that is just an Iconic Road can't be exported or shared (it would give its time away).
        hideTimes
          ? [{ icon: 'more_horiz', label: 'More options', onPress: () => setMenu('options') }]
          : [
              {
                icon: 'download',
                label: 'Export',
                onPress: premium ? () => comingSoon('Exporting drives') : openPremium,
              },
              { icon: 'more_horiz', label: 'More options', onPress: () => setMenu('options') },
              {
                icon: 'ios_share',
                label: 'Share',
                primary: true,
                onPress: () => comingSoon('Sharing'),
              },
            ]
      }
    >
      <ActionSheet
        visible={menu === 'options'}
        title="Drive options"
        actions={[
          {
            icon: 'drive_file_move',
            label: 'Move to another trip',
            onPress: () => setMenu('move'),
          },
          { icon: 'delete', label: 'Delete drive', style: 'destructive', onPress: confirmDelete },
        ]}
        onClose={() => setMenu(null)}
      />
      <MoveDriveSheet
        visible={menu === 'move'}
        drive={drive}
        allowNewTrip={trip.drives.length > 1}
        onMoved={(tripId) => router.replace(`/trips/${tripId}`)}
        onClose={() => setMenu(null)}
      />

      <TitleBlock
        kicker={kicker}
        title={routeLabel(drive.places) ?? formatDate(drive.startedAt)}
        subtitle={tripTitle(trip)}
      />
      <HeroStats
        stats={drive.stats}
        units={units}
        timesHidden={hideTimes}
        roadCount={new Set(roadsShown.map((r) => r.roadId)).size}
        countryCount={countries.length}
      />
      <Timeline
        items={timeline}
        color={color}
        units={units}
        onStopPress={showStop}
        roads={roadsShown.map((r) => ({
          name: getRoad(r.roadId)?.name,
          completedAt: r.completedAt,
        }))}
        hideTimes={hideTimes}
        photos={photos}
      />
      <IconicRoadsSection
        completions={roadsShown}
        totals={roadTotals ?? new Map()}
        today={new Date(drive.startedAt).toDateString() === new Date().toDateString()}
      />
      <CountriesSection rows={countries} units={units} scope="drive" />
      <ChartsCard
        tracks={[{ key: 'route', color, points: withoutCrossings(points, driveGaps(drive)) }]}
        units={units}
        avgSpeedMps={averageMovingSpeed(drive.stats)}
        onScrub={setHighlight}
        speedHidden={hideTimes}
        markers={chartMarkers}
      />
      <DetailsRows
        stats={drive.stats}
        elapsedMs={driveElapsedMs(drive)}
        units={units}
        timesHidden={hideTimes}
        subtitle="This drive"
        extraRows={vehicleRows([drive], vehicleNames)}
      />
    </DetailLayout>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
});
