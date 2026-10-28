import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routeMarkers } from '../components/detail/mapMarkers';
import RouteMap from '../components/RouteMap';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { useSettings } from '../context/SettingsContext';
import { useStyles, useTheme } from '../hooks/useTheme';
import { ensureDrivePlaces } from '../services/placeService';
import { getDrive, getDrivePoints } from '../storage/driveStorage';
import { getTrip } from '../storage/tripStorage';
import { dayColorFor, spacing, type } from '../theme';
import { distanceParts, formatDate, formatDurationShort } from '../utils/format';
import { downsample } from '../utils/geoMath';
import { dayNumberFor, groupIntoDays, routeLabel, tripTitle } from '../utils/tripSummary';

/** Shown after Stop: the drive just saved, with Done and View trip. */
export default function SavedScreen() {
  const { id } = useLocalSearchParams();
  const { units } = useSettings();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [drive, setDrive] = useState(null);
  const [points, setPoints] = useState(null);
  const [trip, setTrip] = useState(null);

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
    })().catch((err) => console.warn('[saved] load failed', err));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const route = useMemo(
    () =>
      points ? downsample(points).map(({ latitude, longitude }) => ({ latitude, longitude })) : [],
    [points]
  );

  if (!drive || !trip) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const multiDay = groupIntoDays(trip.drives).length > 1;
  const dayNumber = dayNumberFor(
    trip.drives.filter((d) => d.startedAt < drive.startedAt),
    drive.startedAt
  );
  const name = tripTitle(trip);
  const kicker = (
    multiDay ? `Day ${dayNumber} saved${name ? ` · ${name}` : ''}` : 'Drive saved'
  ).toUpperCase();
  const distance = distanceParts(drive.stats.distanceM, units);
  const done = () => (router.canGoBack() ? router.back() : router.replace('/record'));

  return (
    <View style={styles.screen}>
      <View style={[styles.map, { height: 300 + insets.top }]}>
        <RouteMap
          flat
          segments={[
            {
              key: 'route',
              coordinates: route,
              color: multiDay ? dayColorFor(c, dayNumber) : c.accent,
            },
          ]}
          markers={routeMarkers({
            firstPoint: route[0],
            lastPoint: route.at(-1),
            startName: drive.places.start,
            endName: drive.places.end,
            drives: [],
            c,
          })}
        />
        <IconButton
          icon="close"
          variant="floating"
          accessibilityLabel="Close"
          onPress={done}
          style={[styles.close, { top: insets.top + 12 }]}
        />
      </View>
      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={[type.smallStrong, styles.kicker]} numberOfLines={1}>
          {kicker}
        </Text>
        <Text style={[type.headline, styles.title]} numberOfLines={2}>
          {routeLabel(drive.places) ?? formatDate(drive.startedAt)}
        </Text>
        <View style={styles.hero}>
          <Text style={styles.heroValue}>{distance.value}</Text>
          <Text style={styles.heroUnit}>{distance.unit}</Text>
          <Text style={[type.bodyLarge, styles.muted, styles.driving]}>
            {formatDurationShort(drive.stats.movingTimeMs)} driving time
          </Text>
        </View>
        <View style={styles.flex} />
        <View style={styles.buttons}>
          <Button
            variant="tonal"
            label="View trip"
            style={styles.flex}
            onPress={() => router.replace(`/trips/${trip.id}`)}
          />
          <Button label="Done" style={styles.flex} onPress={done} />
        </View>
        <Text style={[type.small, styles.muted, styles.hint]}>
          Driving again tomorrow? Add Day {dayNumber + 1} from Home.
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  map: { borderBottomWidth: 1, borderBottomColor: c.outline, backgroundColor: c.surface },
  close: { position: 'absolute', left: 12 },
  body: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  kicker: { color: c.accent, letterSpacing: 0.4, marginHorizontal: 4 },
  title: { color: c.text, marginTop: 4, marginHorizontal: 4, fontSize: 28, lineHeight: 34 },
  hero: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 14,
    marginHorizontal: 4,
  },
  heroValue: { ...type.display, color: c.text },
  heroUnit: { ...type.section, fontFamily: type.bodyLarge.fontFamily, color: c.textMuted },
  driving: { marginLeft: 8, flexShrink: 1 },
  muted: { color: c.textMuted },
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', gap: 10 },
  hint: { textAlign: 'center', marginTop: 12 },
});
