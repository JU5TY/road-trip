import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routeMarkers } from '../components/detail/mapMarkers';
import RouteMap from '../components/RouteMap';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import { useSettings } from '../context/SettingsContext';
import { useStyles, useTheme } from '../hooks/useTheme';
import { ensureDrivePlaces } from '../services/placeService';
import { getDrive, getDrivePoints } from '../storage/driveStorage';
import { getDriveCompletions, getRoadTotals } from '../storage/roadStorage';
import { getTrip } from '../storage/tripStorage';
import { dayColorFor, spacing, type } from '../theme';
import { driveGaps, routeSegments } from '../utils/crossings';
import { distanceParts, formatDate, formatDurationShort } from '../utils/format';
import { comingSoon } from '../utils/comingSoon';
import { downsample } from '../utils/geoMath';
import { ICONIC_ROADS, groupByRoad } from '../utils/iconicRoads';
import { dayNumberFor, groupIntoDays, routeLabel, tripTitle } from '../utils/tripSummary';

/** Fades and slides its children up into place, `delay` ms after mounting. */
function FadeUp({ delay, style, children }) {
  const progress = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 400,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress, delay]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

/** The completed road's tick: the badge pops in, then its halo grows around it. */
function RoadBadge() {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const pop = useState(() => new Animated.Value(0))[0];
  const halo = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.parallel([
      Animated.timing(pop, {
        toValue: 1,
        duration: 600,
        delay: 600,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(halo, {
        toValue: 1,
        duration: 600,
        delay: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pop, halo]);
  const popScale = pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.4, 1.12, 1] });
  const popOpacity = pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <View style={styles.badgeWrap}>
      <Animated.View style={[styles.halo, { opacity: halo, transform: [{ scale: haloScale }] }]} />
      <Animated.View
        style={[styles.roadBadge, { opacity: popOpacity, transform: [{ scale: popScale }] }]}
      >
        <Icon name="verified" filled size={40} color={c.onRoadBadge} />
      </Animated.View>
    </View>
  );
}

/** Shown after Stop: the drive just saved, with Share and Done. */
export default function SavedScreen() {
  const { id } = useLocalSearchParams();
  const { units, showIconicRoads } = useSettings();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [drive, setDrive] = useState(null);
  const [points, setPoints] = useState(null);
  const [trip, setTrip] = useState(null);
  const [roads, setRoads] = useState({ completions: [], completedCount: 0, totals: new Map() });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await getDrive(Number(id));
      if (cancelled || !d) return;
      const [p, t, completions, totals] = await Promise.all([
        getDrivePoints(d.id),
        getTrip(d.tripId),
        getDriveCompletions(d.id),
        getRoadTotals(),
      ]);
      if (cancelled) return;
      setDrive(d);
      setPoints(p);
      setTrip(t);
      setRoads({ completions, completedCount: totals.size, totals });
      const places = await ensureDrivePlaces(d, { includeStops: true });
      if (!cancelled) setDrive((prev) => ({ ...prev, places }));
    })().catch((err) => console.warn('[saved] load failed', err));
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
          segments={routeSegments(
            'route',
            route,
            driveGaps(drive),
            multiDay ? dayColorFor(c, dayNumber) : c.accent
          )}
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
      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={[type.kicker, styles.kicker]} numberOfLines={1}>
          {kicker}
        </Text>
        <Text style={[type.title, styles.title]} numberOfLines={1}>
          {routeLabel(drive.places) ?? formatDate(drive.startedAt)}
        </Text>
        <FadeUp delay={300} style={styles.stats}>
          {[
            [`${distance.value} ${distance.unit}`, 'distance'],
            ...(drive.stats.timesHidden
              ? []
              : [[formatDurationShort(drive.stats.movingTimeMs), 'driving']]),
            [String(drive.stats.stopCount), drive.stats.stopCount === 1 ? 'stop' : 'stops'],
          ].map(([value, label]) => (
            <View key={label} style={styles.stat}>
              <Text style={[type.stat, styles.statValue]} numberOfLines={1}>
                {value}
              </Text>
              <Text style={[type.label, styles.muted, styles.regular]}>{label}</Text>
            </View>
          ))}
        </FadeUp>
        {showIconicRoads
          ? groupByRoad(roads.completions).map(({ road, count }) => {
              const total = roads.totals.get(road.id)?.count ?? count;
              const today =
                count === 1
                  ? 'Completed today'
                  : count === 2
                    ? 'Twice today'
                    : `${count} times today`;
              return (
                <View key={road.id} style={styles.roadCard} accessible>
                  <RoadBadge />
                  <Text style={[type.kicker, styles.roadMuted, styles.roadKicker]}>
                    ICONIC ROAD COMPLETED
                  </Text>
                  <Text style={[type.section, styles.roadName]} numberOfLines={1}>
                    {road.name}
                  </Text>
                  <Text style={[type.label, styles.roadMuted, styles.regular, styles.roadLine]}>
                    {[
                      today,
                      total > count ? `${total} times in all` : null,
                      `${roads.completedCount} of ${ICONIC_ROADS.length} roads`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              );
            })
          : null}
        <View style={styles.flex} />
        <View style={styles.buttons}>
          <Button
            variant="tonal"
            icon="ios_share"
            label="Share"
            style={styles.flex}
            onPress={() => comingSoon('Sharing')}
          />
          <Button label="Done" style={styles.flex} onPress={done} />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.screen },
  center: { alignItems: 'center', justifyContent: 'center' },
  map: { borderBottomWidth: 1, borderBottomColor: c.outline, backgroundColor: c.surface },
  close: { position: 'absolute', left: 12 },
  body: { flex: 1, paddingHorizontal: spacing.md, paddingTop: 20 },
  kicker: { color: c.accent, marginHorizontal: 4 },
  title: { color: c.text, marginTop: 4, marginHorizontal: 4 },
  stats: { flexDirection: 'row', marginTop: 18 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: c.accent },
  regular: { fontFamily: type.body.fontFamily, textAlign: 'center' },
  muted: { color: c.textMuted },
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', gap: 10 },
  roadCard: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderRadius: 12,
    backgroundColor: c.roadContainer,
  },
  badgeWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  // Faint ring (45%) that grows in around the badge.
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    borderWidth: 6,
    borderColor: c.roadHalo,
    opacity: 0.45,
  },
  roadBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.roadBadge,
  },
  roadKicker: { marginTop: 10 },
  roadName: { color: c.onRoadContainer, fontSize: 22, lineHeight: 28, marginTop: 2 },
  roadLine: { marginTop: 2 },
  roadMuted: { color: c.roadContainerMuted },
});
