import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapIllustration from '../components/MapIllustration';
import RecordingBar from '../components/RecordingBar';
import RoadsProgress from '../components/roads/RoadsProgress';
import TripCard from '../components/TripCard';
import Button from '../components/ui/Button';
import ListRow from '../components/ui/ListRow';
import SectionHeader from '../components/ui/SectionHeader';
import { useSettings } from '../context/SettingsContext';
import { useActiveDrive } from '../hooks/useActiveDrive';
import { useRoadCounts } from '../hooks/useRoadCounts';
import { useRoadTotals } from '../hooks/useRoadTotals';
import { useStyles, useTheme } from '../hooks/useTheme';
import { listTrips } from '../storage/tripStorage';
import { radius, spacing, type } from '../theme';
import { distanceParts } from '../utils/format';
import { ICONIC_ROADS } from '../utils/iconicRoads';
import { computeTotals, dayNumberFor, isContinuable, tripTitle } from '../utils/tripSummary';

/** Start a new trip, or carry on with a recent one ("Continue Scotland 2026 · Day 4"). */
function StartButtons({ continueTrip, now }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.buttons}>
      <Button
        size="large"
        icon="radio_button_checked"
        iconFilled
        label="Start a trip"
        onPress={() => router.navigate({ pathname: '/record', params: { start: 'new' } })}
      />
      {continueTrip ? (
        <Button
          variant="tonal"
          icon="play_arrow"
          iconFilled
          label={`Continue ${tripTitle(continueTrip) ?? 'last trip'}`}
          trailing={`· Day ${dayNumberFor(continueTrip.drives, now)}`}
          onPress={() =>
            router.navigate({
              pathname: '/record',
              params: { continueTripId: String(continueTrip.id) },
            })
          }
        />
      ) : null}
    </View>
  );
}

/** Lifetime totals as Details-style rows (built for people who only drive a few trips a year). */
function AllTime({ trips, units }) {
  const styles = useStyles(makeStyles);
  const totals = computeTotals(trips);
  const distance = distanceParts(totals.distanceM, units);
  const rows = [
    ['route', 'Trips', String(totals.tripCount)],
    ['distance', 'Distance', `${distance.value} ${distance.unit}`],
    ['calendar_month', 'Days on the road', String(totals.drivingDays)],
  ];
  return (
    <>
      <SectionHeader title="All time" style={styles.allTimeHeader} />
      {rows.map(([icon, title, value], i) => (
        <ListRow
          key={title}
          icon={icon}
          title={title}
          value={value}
          strongValue
          divider={i < rows.length - 1}
        />
      ))}
    </>
  );
}

/** Iconic Roads progress, linking to the full list. */
function RoadsCard() {
  const styles = useStyles(makeStyles);
  const totals = useRoadTotals();
  const done = totals ? ICONIC_ROADS.filter((r) => totals.has(r.id)).length : 0;
  const examples = ICONIC_ROADS.slice(0, 2)
    .map((r) => r.name)
    .join(' or ');
  return (
    <>
      <SectionHeader
        title="Iconic Roads"
        actionLabel="All roads"
        onAction={() => router.push('/roads')}
        style={styles.latestHeader}
      />
      <Pressable onPress={() => router.push('/roads')} accessibilityRole="link">
        <RoadsProgress completed={done} total={ICONIC_ROADS.length} tone="low">
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
  const { drive: activeDrive } = useActiveDrive();
  // Only keep the map preview alive while Home is showing, to save memory.
  const focused = useIsFocused();
  // Trips plus the time they were loaded, so Continue and "Day N" are stable.
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      <Text style={[type.headline, styles.h1]} role="heading">
        Road Trip
      </Text>

      {activeDrive ? (
        <RecordingBar style={styles.recording} />
      ) : (
        <StartButtons
          continueTrip={latest && isContinuable(latest, now) ? latest : null}
          now={now}
        />
      )}

      {latest ? (
        <>
          <SectionHeader
            title="Latest trip"
            actionLabel="All trips"
            onAction={() => router.navigate('/trips')}
            style={styles.latestHeader}
          />
          <TripCard
            trip={latest}
            units={units}
            variant="large"
            showMap={focused}
            roadCount={showIconicRoads ? (roadCounts.get(latest.id) ?? 0) : 0}
          />
          {showIconicRoads ? <RoadsCard /> : null}
          <AllTime trips={trips} units={units} />
        </>
      ) : (
        <>
          <SectionHeader title="Latest trip" style={styles.latestHeader} />
          <View style={styles.emptyCard}>
            <MapIllustration height={140} />
            <View style={styles.emptyText}>
              <Text style={[type.bodyStrong, styles.emptyTitle]}>
                Your first trip will show here
              </Text>
              <Text style={[type.body, styles.muted]}>
                Tap Start a trip when you set off. It keeps recording with the screen off.
              </Text>
            </View>
          </View>
          {showIconicRoads ? <RoadsCard /> : null}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  h1: { color: c.text, marginHorizontal: 4, marginTop: 8, height: 56, textAlignVertical: 'center' },
  buttons: { gap: spacing.sm, marginTop: 12 },
  recording: { marginTop: 12 },
  latestHeader: { marginTop: 32, marginBottom: 12 },
  allTimeHeader: { marginTop: 32, marginBottom: 4 },
  roadsHint: { color: c.textMuted, fontSize: 14, lineHeight: 20, marginTop: 14 },
  emptyCard: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: c.surface },
  emptyText: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 18, gap: 4 },
  emptyTitle: { color: c.text, fontFamily: type.button.fontFamily, fontSize: 17 },
  muted: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
});
