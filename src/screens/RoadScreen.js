import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import DetailLayout from '../components/detail/DetailLayout';
import RouteMap from '../components/RouteMap';
import Icon from '../components/ui/Icon';
import ListRow from '../components/ui/ListRow';
import SectionHeader from '../components/ui/SectionHeader';
import StatCard from '../components/ui/StatCard';
import { useSettings } from '../context/SettingsContext';
import { useStyles, useTheme } from '../hooks/useTheme';
import { getRoadCompletions } from '../storage/roadStorage';
import { getTrip } from '../storage/tripStorage';
import { dayBadgeFor, type } from '../theme';
import { distanceParts, elevationParts, formatLongDate, formatShortDate } from '../utils/format';
import { completedLabel, getRoad } from '../utils/iconicRoads';
import { dayNumberFor, groupIntoDays, tripTitle } from '../utils/tripSummary';

const NOTE = 'Iconic Roads are never timed. Drive them at your own pace.';

/** One drive that completed the road, with its trip and day. */
function DriveRow({ item }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const [bg, fg] = item.multiDay
    ? dayBadgeFor(c, item.dayNumber)
    : [c.accentContainer, c.onAccentContainer];
  return (
    <Pressable
      onPress={() =>
        router.push(item.multiDay ? `/drives/${item.driveId}` : `/trips/${item.tripId}`)
      }
      accessibilityRole="link"
      style={({ pressed }) => [styles.driveRow, pressed && styles.pressed]}
    >
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[type.bodyStrong, { color: fg, fontFamily: type.navActive.fontFamily }]}>
          {item.dayNumber}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={[type.bodyLarge, styles.text, styles.medium]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[type.small, styles.muted]} numberOfLines={1}>
          {formatLongDate(item.driveStartedAt)} · {completedLabel(item.count)}
        </Text>
      </View>
      <Icon name="chevron_right" size={24} color={c.textMuted} />
    </Pressable>
  );
}

/** An Iconic Road: its line, facts, how often it's been completed, and the drives that did. */
export default function RoadScreen() {
  const { id } = useLocalSearchParams();
  const road = getRoad(id);
  const { units } = useSettings();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const [drives, setDrives] = useState(null); // [{ driveId, tripId, title, dayNumber, multiDay, count, ... }]
  const [summary, setSummary] = useState({ count: 0, first: null, last: null });

  useFocusEffect(
    useCallback(() => {
      if (!road) return undefined;
      let cancelled = false;
      (async () => {
        const completions = await getRoadCompletions(road.id); // newest first
        const trips = new Map();
        for (const tid of new Set(completions.map((x) => x.tripId)))
          trips.set(tid, await getTrip(tid));
        const byDrive = new Map();
        for (const x of completions) {
          const entry = byDrive.get(x.driveId) ?? { ...x, count: 0 };
          entry.count += 1;
          byDrive.set(x.driveId, entry);
        }
        const rows = [...byDrive.values()].map((x) => {
          const trip = trips.get(x.tripId);
          const earlier = trip ? trip.drives.filter((d) => d.startedAt < x.driveStartedAt) : [];
          const dayNumber = dayNumberFor(earlier, x.driveStartedAt);
          const name = trip ? tripTitle(trip) : null;
          return {
            ...x,
            dayNumber,
            multiDay: trip ? groupIntoDays(trip.drives).length > 1 : false,
            title: name ? `${name} · Day ${dayNumber}` : `Day ${dayNumber}`,
          };
        });
        if (cancelled) return;
        setDrives(rows);
        setSummary({
          count: completions.length,
          first: completions.at(-1)?.completedAt ?? null,
          last: completions[0]?.completedAt ?? null,
        });
      })().catch((err) => console.warn('[road] load failed', err));
      return () => {
        cancelled = true;
      };
    }, [road])
  );

  const line = useMemo(
    () => (road ? road.line.map(([latitude, longitude]) => ({ latitude, longitude })) : []),
    [road]
  );

  if (!road) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={[type.body, styles.muted]}>This road is no longer in the list.</Text>
      </View>
    );
  }

  const length = distanceParts(road.lengthM, units);
  const highest = elevationParts(road.highestM, units);
  const climb = elevationParts(road.climbM, units);
  const loop = road.from === road.to;
  const navigate = () => {
    const [lat, lng] = road.line[0];
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
    ).catch(() => Alert.alert('Google Maps', 'Could not open Google Maps.'));
  };

  const map = (
    <RouteMap
      flat
      segments={[{ key: 'road', coordinates: line, color: c.accent }]}
      markers={[
        { key: 'start', coordinate: line[0], title: road.from, color: c.start },
        { key: 'end', coordinate: line.at(-1), title: road.to, color: c.finish },
      ]}
    />
  );

  const details = [
    ['swap_horiz', 'Road type', road.roadType],
    ['repeat', 'Times completed', String(summary.count)],
    ...(summary.count > 1
      ? [['calendar_month', 'First completed', formatShortDate(summary.first)]]
      : []),
  ];

  return (
    <DetailLayout
      map={map}
      actions={[{ icon: 'near_me', label: 'Navigate to start', primary: true, onPress: navigate }]}
    >
      <Text style={[type.smallStrong, styles.kicker]}>
        {`${road.region} · ${road.country}`.toUpperCase()}
      </Text>
      <Text style={[type.headline, styles.title]}>{road.name}</Text>
      <Text style={[type.body, styles.muted, styles.subtitle]}>
        {loop
          ? `Loop from ${road.from}`
          : `${road.from} → ${road.to}`}
      </Text>

      <View style={styles.chips}>
        {summary.count > 0 ? (
          <View style={[styles.chip, styles.chipDone]}>
            <Icon name="verified" size={18} color={c.onAccentContainer} />
            <Text style={[type.label, { color: c.onAccentContainer }]}>
              {summary.count > 1 ? 'Last completed' : 'Completed'} {formatShortDate(summary.last)}
            </Text>
          </View>
        ) : (
          <View style={[styles.chip, styles.chipTodo]}>
            <Icon name="route" size={18} color={c.textMuted} />
            <Text style={[type.label, styles.muted, styles.medium]}>Not completed yet</Text>
          </View>
        )}
      </View>

      <View style={styles.grid}>
        <StatCard
          layout="wide"
          tone="accent"
          icon="route"
          label="Length"
          value={`${length.value} ${length.unit}`}
        />
        <View style={styles.row}>
          <StatCard
            style={styles.half}
            icon="landscape"
            label="Highest point"
            value={highest.value}
            unit={highest.unit}
          />
          <StatCard
            style={styles.half}
            notch
            icon="trending_up"
            label="Climb"
            value={climb.value}
            unit={climb.unit}
          />
        </View>
      </View>

      <Text style={[type.bodyLarge, styles.text, styles.blurb]}>{road.blurb}</Text>

      <SectionHeader title="Details" style={styles.detailsHeader} />
      {details.map(([icon, title, value], i) => (
        <ListRow
          key={title}
          icon={icon}
          title={title}
          value={value}
          strongValue
          divider={i < details.length - 1}
        />
      ))}

      {drives?.length ? (
        <>
          <SectionHeader title="Your drives" style={styles.detailsHeader} />
          {drives.map((item) => (
            <DriveRow key={item.driveId} item={item} />
          ))}
        </>
      ) : null}

      <View style={styles.note}>
        <Icon name="info" size={22} color={c.accent} />
        <Text style={[type.body, styles.muted, styles.noteText]}>{NOTE}</Text>
      </View>
    </DetailLayout>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  kicker: { color: c.accent, letterSpacing: 0.4, marginHorizontal: 4 },
  title: { color: c.text, marginTop: 4, marginHorizontal: 4 },
  subtitle: { marginTop: 2, marginHorizontal: 4 },
  text: { color: c.text },
  muted: { color: c.textMuted },
  medium: { fontFamily: type.statUnit.fontFamily },
  chips: { flexDirection: 'row', marginTop: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
  },
  chipDone: { backgroundColor: c.accentContainer },
  chipTodo: { borderWidth: 1, borderColor: c.outline },
  grid: { gap: 10, marginTop: 20 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  blurb: { marginTop: 24, marginHorizontal: 4, lineHeight: 24 },
  detailsHeader: { marginBottom: 4 },
  driveRow: {
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
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 28,
    padding: 16,
    borderRadius: 20,
    backgroundColor: c.surface,
  },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.6 },
});
