import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import WeekDistance from '../components/home/WeekDistance';
import YourMap from '../components/home/YourMap';
import MapIllustration from '../components/MapIllustration';
import RoadsProgress from '../components/roads/RoadsProgress';
import TripCard from '../components/TripCard';
import Icon from '../components/ui/Icon';
import SectionHeader from '../components/ui/SectionHeader';
import CountriesCard from '../components/home/CountriesCard';
import { useSettings } from '../context/SettingsContext';
import { useRoadCounts } from '../hooks/useRoadCounts';
import { useRoadTotals } from '../hooks/useRoadTotals';
import { useStyles, useTheme } from '../hooks/useTheme';
import { listTrips } from '../storage/tripStorage';
import { radius, spacing, type } from '../theme';
import { distanceParts } from '../utils/format';
import { ICONIC_ROADS, getRoad } from '../utils/iconicRoads';
import { computeTotals } from '../utils/tripSummary';

/** The white band at the top: title, Your map and all-time totals. */
function MapBand({ trips, units, insetTop }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const drives = useMemo(() => trips.flatMap((t) => t.drives), [trips]);
  const totals = computeTotals(trips);
  const distance = distanceParts(totals.distanceM, units);
  const stats = [
    [distance.value, distance.unit],
    [String(totals.tripCount), totals.tripCount === 1 ? 'trip' : 'trips'],
    [String(totals.drivingDays), totals.drivingDays === 1 ? 'day' : 'days'],
  ];
  return (
    <View style={[styles.band, { paddingTop: insetTop + spacing.md }]}>
      <Text style={[type.headline, styles.h1]} role="heading">
        Road Trip
      </Text>
      <YourMap drives={drives} />
      <View style={styles.mapCaption}>
        <Icon name="map" size={22} color={c.accent} />
        <Text style={[type.section, styles.text, styles.regular]}>Your map</Text>
        <Text style={[type.section, styles.muted]}>·</Text>
        <Text style={[type.body, styles.muted]}>every road you&apos;ve driven</Text>
      </View>
      <View style={styles.stats}>
        {stats.map(([value, unit]) => (
          <View key={unit} style={styles.stat}>
            <Text style={[type.stat, styles.statValue]}>{value}</Text>
            <Text style={[type.bodyLarge, styles.text]}>{unit}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Iconic Roads progress, linking to the full list. */
function RoadsCard() {
  const styles = useStyles(makeStyles);
  const totals = useRoadTotals();
  const done = totals ? ICONIC_ROADS.filter((r) => totals.has(r.id)).length : 0;
  const examples = ['snake-pass', 'bealach-na-ba']
    .map((id) => getRoad(id)?.name)
    .filter(Boolean)
    .join(' or ');
  return (
    <>
      <SectionHeader
        variant="overline"
        title="Iconic Roads"
        actionLabel="All roads"
        onAction={() => router.push('/roads')}
      />
      <Pressable onPress={() => router.push('/roads')} accessibilityRole="link">
        <RoadsProgress completed={done} total={ICONIC_ROADS.length}>
          {done === 0 ? (
            <Text style={[type.body, styles.roadsHint]}>
              Drive any of {ICONIC_ROADS.length} famous roads, like {examples}, to complete them.
            </Text>
          ) : null}
        </RoadsProgress>
      </Pressable>
    </>
  );
}

export default function HomeScreen() {
  const { units, showIconicRoads } = useSettings();
  const roadCounts = useRoadCounts();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // Only keep the map preview alive while Home is showing, to save memory.
  const focused = useIsFocused();
  // Trips plus the time they were loaded, so "today" is stable while open.
  const [data, setData] = useState(null); // { trips, now }

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listTrips()
        .then((trips) => !cancelled && setData({ trips, now: Date.now() }))
        .catch((err) => console.warn('[home] load failed', err));
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (!data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const { trips, now } = data;
  const latest = trips[0];

  if (!latest) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      >
        <Text style={[type.headline, styles.h1]} role="heading">
          Road Trip
        </Text>
        <SectionHeader variant="overline" title="Latest trip" style={styles.emptyHeader} />
        <View style={styles.emptyCard}>
          <MapIllustration height={140} />
          <View style={styles.emptyText}>
            <Text style={[type.bodyStrong, styles.text]}>Your first trip will show here</Text>
            <Text style={[type.body, styles.mutedSmall]}>
              Tap Record a drive when you set off. It keeps recording with the screen off.
            </Text>
          </View>
        </View>
        {showIconicRoads ? <RoadsCard /> : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <MapBand trips={trips} units={units} insetTop={insets.top} />
      <WeekDistance trips={trips} units={units} now={now} />
      <SectionHeader
        variant="overline"
        title="Latest trip"
        actionLabel="All trips"
        onAction={() => router.navigate('/trips')}
      />
      <TripCard
        trip={latest}
        units={units}
        variant="large"
        showMap={focused}
        roadCount={showIconicRoads ? (roadCounts.get(latest.id) ?? 0) : 0}
      />
      {showIconicRoads ? <RoadsCard /> : null}
      <CountriesCard trips={trips} />
    </ScrollView>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  // Bottom padding clears the floating Record pill above the nav bar.
  content: { paddingHorizontal: spacing.md, paddingBottom: 112 },
  band: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: 28,
    alignItems: 'center',
    backgroundColor: c.card,
  },
  h1: {
    alignSelf: 'stretch',
    color: c.text,
    marginHorizontal: 4,
    marginVertical: 8,
    height: 56,
    textAlignVertical: 'center',
  },
  mapCaption: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  stats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 24 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: c.accent, fontSize: 30, lineHeight: 36 },
  text: { color: c.text },
  regular: { fontFamily: type.bodyLarge.fontFamily },
  muted: { color: c.textMuted },
  mutedSmall: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
  roadsHint: { color: c.textMuted, fontSize: 14, lineHeight: 20, marginTop: 14 },
  emptyHeader: { marginTop: 8 }, // 16 under the title, with its 8
  emptyCard: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: c.card,
    ...c.cardShadow,
  },
  emptyText: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 18, gap: 4 },
});
