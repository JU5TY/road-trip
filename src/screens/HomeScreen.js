import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import TripCard from '../components/TripCard';
import { useSettings } from '../context/SettingsContext';
import { listTrips } from '../storage/tripStorage';
import { colors, radius, spacing } from '../theme';
import { formatDistance, formatDurationShort, formatElevation } from '../utils/format';
import { computeTotals, dayNumberFor, isContinuable } from '../utils/tripSummary';

const RECENT_COUNT = 3;

const startOfYear = (now) => new Date(new Date(now).getFullYear(), 0, 1).getTime();

function Totals({ trips, units, now }) {
  const [range, setRange] = useState('year'); // 'year' | 'all'
  const totals = computeTotals(trips, range === 'year' ? startOfYear(now) : 0);
  const tiles = [
    { label: 'Distance', value: formatDistance(totals.distanceM, units, 0) },
    { label: 'Driving time', value: formatDurationShort(totals.movingTimeMs) },
    {
      label: 'Trips',
      value: String(totals.tripCount),
      detail: `${totals.drivingDays} ${totals.drivingDays === 1 ? 'day' : 'days'} on the road`,
    },
    { label: 'Highest point', value: formatElevation(totals.maxAltitudeM, units) },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your totals</Text>
        <View style={styles.toggle}>
          {[
            ['year', String(new Date(now).getFullYear())],
            ['all', 'All time'],
          ].map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setRange(value)}
              style={[styles.toggleItem, range === value && styles.toggleItemOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: range === value }}
            >
              <Text style={[styles.toggleText, range === value && styles.toggleTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={styles.tile}>
            <Text style={styles.tileLabel}>{t.label}</Text>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
              {t.value}
            </Text>
            {t.detail ? <Text style={styles.tileDetail}>{t.detail}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function ContinueButton({ trip, now }) {
  const day = dayNumberFor(trip.drives, now);
  return (
    <Pressable
      onPress={() =>
        router.navigate({ pathname: '/record', params: { continueTripId: String(trip.id) } })
      }
      style={({ pressed }) => [styles.continue, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={styles.continueText}>Continue trip · Day {day}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { units } = useSettings();
  // Trips plus the time they were loaded, so "this year" and Continue are stable.
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
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const { trips, now } = data;
  if (trips.length === 0) {
    return (
      <View style={[styles.screen, styles.center, styles.emptyWrap]}>
        <Text style={styles.emptyTitle}>Record your first drive</Text>
        <Text style={styles.emptyBody}>
          Your route, distance, speeds and rest stops will appear here.
        </Text>
        <Link href="/record" asChild>
          <Pressable style={({ pressed }) => [styles.continue, styles.emptyButton, pressed && styles.pressed]}>
            <Text style={styles.continueText}>Go to Record</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const [latest, ...rest] = trips;
  const recent = rest.slice(0, RECENT_COUNT);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest trip</Text>
        <TripCard
          trip={latest}
          units={units}
          mapHeight={200}
          footer={isContinuable(latest, now) ? <ContinueButton trip={latest} now={now} /> : null}
        />
      </View>

      <Totals trips={trips} units={units} now={now} />

      {recent.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent trips</Text>
            <Link href="/trips" asChild>
              <Pressable hitSlop={12}>
                <Text style={styles.link}>See all</Text>
              </Pressable>
            </Link>
          </View>
          {recent.map((trip) => (
            <TripCard key={trip.id} trip={trip} units={units} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
  center: { alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 3,
  },
  toggleItem: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  toggleItemOn: { backgroundColor: colors.accent },
  toggleText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  toggleTextOn: { color: colors.background },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tileLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  tileValue: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  tileDetail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  continue: {
    margin: spacing.md,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.start,
  },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  emptyWrap: { padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  emptyBody: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  emptyButton: { alignSelf: 'stretch' },
});
