import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import ActionSheet from '../components/ActionSheet';
import ChartsCard from '../components/charts/ChartsCard';
import DetailLayout from '../components/detail/DetailLayout';
import { routeMarkers, stopMarkerKey } from '../components/detail/mapMarkers';
import Timeline from '../components/detail/Timeline';
import { DetailsRows, HeroStats, TitleBlock } from '../components/detail/TripStats';
import MoveDriveSheet from '../components/MoveDriveSheet';
import RouteMap from '../components/RouteMap';
import { useSettings } from '../context/SettingsContext';
import { useStyles, useTheme } from '../hooks/useTheme';
import { ensureDrivePlaces } from '../services/placeService';
import { deleteDrive, getDrive, getDrivePoints } from '../storage/driveStorage';
import { getTrip } from '../storage/tripStorage';
import { dayColorFor } from '../theme';
import { formatDate, formatDayDate, formatTime } from '../utils/format';
import { averageMovingSpeed, downsample } from '../utils/geoMath';
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
  const { units } = useSettings();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const [drive, setDrive] = useState(null);
  const [points, setPoints] = useState(null);
  const [trip, setTrip] = useState(null);
  const [menu, setMenu] = useState(null); // null | 'options' | 'move'
  const [highlight, setHighlight] = useState(null); // point under the finger on a chart
  const scrollRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await getDrive(Number(id));
      if (cancelled || !d) return;
      const [p, t] = await Promise.all([getDrivePoints(d.id), getTrip(d.tripId)]);
      if (cancelled) return;
      setDrive(d);
      setPoints(p);
      setTrip(t);
      const places = await ensureDrivePlaces(d, { includeStops: true });
      if (!cancelled) setDrive((prev) => ({ ...prev, places }));
    })().catch((err) => console.warn('[drive] load failed', err));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const route = useMemo(
    () =>
      points ? downsample(points).map(({ latitude, longitude }) => ({ latitude, longitude })) : [],
    [points]
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
      : `${formatDayDate(drive.startedAt)} · ${formatTime(drive.startedAt)}`
  ).toUpperCase();

  const showStop = (item) => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    mapRef.current?.focusMarker(stopMarkerKey(drive.id, item.time));
  };

  const confirmDelete = () => {
    setMenu(null);
    Alert.alert('Delete this drive?', 'Its route and stats will be removed from the trip.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteDrive(drive.id).then(() => router.back()),
      },
    ]);
  };

  const map = (
    <RouteMap
      ref={mapRef}
      flat
      highlight={highlight}
      segments={[{ key: 'route', coordinates: route, color }]}
      markers={routeMarkers({
        firstPoint: route[0],
        lastPoint: route.at(-1),
        startName: drive.places.start,
        endName: drive.places.end,
        drives: [drive],
        c,
      })}
    />
  );

  return (
    <DetailLayout
      scrollRef={scrollRef}
      map={map}
      actions={[{ icon: 'more_horiz', label: 'More options', onPress: () => setMenu('options') }]}
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
      <HeroStats stats={drive.stats} units={units} />
      <Timeline items={timeline} color={color} units={units} onStopPress={showStop} />
      <DetailsRows stats={drive.stats} elapsedMs={driveElapsedMs(drive)} units={units} />
      <ChartsCard
        tracks={[{ key: 'route', color, points }]}
        units={units}
        avgSpeedMps={averageMovingSpeed(drive.stats)}
        onScrub={setHighlight}
      />
    </DetailLayout>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
});
