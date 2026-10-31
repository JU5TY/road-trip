import { Pressable, Text, View } from 'react-native';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { type } from '../../theme';
import {
  distanceParts,
  elevationParts,
  formatDurationShort,
  formatElevation,
  formatSpeed,
  speedUnit,
  toSpeed,
} from '../../utils/format';
import { averageMovingSpeed } from '../../utils/geoMath';
import Icon from '../ui/Icon';
import ListRow from '../ui/ListRow';
import SectionHeader from '../ui/SectionHeader';
import StatCard from '../ui/StatCard';

/**
 * Green caps line, title, grey subtitle and optional notes. Tapping it calls
 * onPress (edit). `parent` ({ name, onPress }) adds a "Part of <name> ›" link
 * under the title, from a drive to its trip.
 */
export function TitleBlock({ kicker, title, subtitle, notes, parent, onPress }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Text style={[type.kicker, styles.kicker]}>{kicker}</Text>
      <Text style={[type.title, styles.title]}>{title}</Text>
      {subtitle ? <Text style={[type.body, styles.subtitle]}>{subtitle}</Text> : null}
      {parent ? (
        <Pressable
          onPress={parent.onPress}
          accessibilityRole="link"
          accessibilityLabel={`Part of ${parent.name}`}
          style={({ pressed }) => [styles.parent, pressed && styles.pressed]}
        >
          <Text style={[type.body, styles.parentPrefix]}>Part of </Text>
          <Text style={[type.button, styles.parentName]} numberOfLines={1}>
            {parent.name}
          </Text>
          <Icon name="chevron_right" size={20} color={c.accent} />
        </Pressable>
      ) : null}
      {notes ? <Text style={[type.body, styles.notes]}>{notes}</Text> : null}
    </Pressable>
  );
}

/**
 * Hero distance, Iconic Roads and rest-stops chips, and the bento grid (Driving
 * time, Highest point, Avg speed). `stats` is a drive's stats or a
 * summarizeDrives() result; `avgSpeedMps` comes separately because a trip's
 * leaves out drives whose times are hidden. `timesHidden` swaps Driving time for
 * a note and Avg speed for Elevation gain (a drive that starts and ends at an
 * Iconic Road); `roadCount` and `countryCount` (shown from 2) add chips.
 * A `trip` keeps only Driving time and no stops chip: over several drives the
 * highest point, average speed and stops are details, not headlines
 * (DetailsRows lists them).
 */
export function HeroStats({
  stats,
  units,
  avgSpeedMps,
  timesHidden = false,
  trip = false,
  roadCount = 0,
  countryCount = 0,
}) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const distance = distanceParts(stats.distanceM, units);
  const highest = elevationParts(stats.maxAltitudeM, units);
  const gain = elevationParts(stats.elevationGainM, units);
  // A drive's stops are a headline; a trip's are in its Details.
  const stopChip = !trip && stats.stopCount > 0;

  return (
    <>
      <View
        style={styles.hero}
        accessible
        accessibilityLabel={`Distance ${distance.value} ${distance.unit}`}
      >
        <Text style={styles.heroValue}>{distance.value}</Text>
        <Text style={styles.heroUnit}>{distance.unit}</Text>
      </View>
      {stopChip || roadCount > 0 || countryCount > 1 ? (
        <View style={styles.chips}>
          {roadCount > 0 ? (
            <View style={[styles.chip, styles.chipRoads]}>
              <Icon name="verified" size={18} color={c.onRoadContainer} />
              <Text style={[type.label, styles.chipRoadsText]}>
                {roadCount} {roadCount === 1 ? 'Iconic Road' : 'Iconic Roads'}
              </Text>
            </View>
          ) : null}
          {stopChip ? (
            <View style={styles.chip}>
              <Icon name="local_cafe" size={18} color={c.textMuted} />
              <Text style={[type.label, styles.chipText]}>
                {stats.stopCount} {stats.stopCount === 1 ? 'stop' : 'stops'}
              </Text>
            </View>
          ) : null}
          {countryCount > 1 ? (
            <View style={styles.chip}>
              <Icon name="public" size={18} color={c.textMuted} />
              <Text style={[type.label, styles.chipText]}>{countryCount} countries</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.grid}>
        {timesHidden ? (
          <TimesHiddenCard />
        ) : (
          <StatCard
            layout="wide"
            tone="accent"
            icon="directions_car"
            label="Driving time"
            value={formatDurationShort(stats.movingTimeMs)}
          />
        )}
        {trip ? null : (
          <View style={styles.row}>
            <StatCard
              style={styles.half}
              icon="landscape"
              label="Highest point"
              value={highest.value}
              unit={highest.unit}
            />
            {timesHidden ? (
              <StatCard
                style={styles.half}
                icon="trending_up"
                label="Elevation gain"
                value={gain.value}
                unit={gain.unit}
              />
            ) : (
              <StatCard
                style={styles.half}
                icon="speed"
                label="Avg speed"
                value={String(Math.round(toSpeed(avgSpeedMps, units)))}
                unit={speedUnit(units)}
              />
            )}
          </View>
        )}
      </View>
    </>
  );
}

/** Stands in for Driving time on a drive that starts and ends at an Iconic Road. */
function TimesHiddenCard() {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.hidden}>
      <View style={styles.hiddenWell}>
        <Icon name="visibility_off" size={26} color={c.onAccentContainer} />
      </View>
      <View style={styles.flex}>
        <Text style={[type.bodyStrong, styles.hiddenTitle]}>Times hidden for safety</Text>
        <Text style={[type.body, styles.subtitleText, styles.hiddenText]}>
          {"This drive starts and ends at an Iconic Road, so its times and speeds aren't shown."}
        </Text>
      </View>
    </View>
  );
}

/**
 * "Details" rows: time first, speed last (Max speed stays low-key; Avg speed
 * is a tile above). With `timesHidden` only the rest-stop count is left. Rest
 * stops is left out when there are none, Longest stretch when it's just the
 * moving time again (or unknown), and the section when no rows are left. A
 * `trip` also lists Highest point and Avg speed, which its tiles leave out. `hiddenNote` explains that
 * some drives' times were left out of a trip's totals.
 */
export function DetailsRows({
  stats,
  elapsedMs,
  units,
  timesHidden = false,
  trip = false,
  hiddenNote,
  subtitle,
}) {
  const styles = useStyles(makeStyles);
  const hasStops = stats.stopCount > 0;
  // Drives recorded before this stat existed don't have it.
  const longest = stats.longestStintMs == null ? null : formatDurationShort(stats.longestStintMs);
  const showLongest = longest != null && longest !== formatDurationShort(stats.movingTimeMs);
  const highest = ['landscape', 'Highest point', formatElevation(stats.maxAltitudeM, units)];
  const gain = ['trending_up', 'Elevation gain', formatElevation(stats.elevationGainM, units)];
  const rows = timesHidden
    ? [
        ...(hasStops ? [['local_cafe', 'Rest stops', String(stats.stopCount)]] : []),
        ...(trip ? [highest, gain] : []),
      ]
    : [
        ['schedule', 'Elapsed time', formatDurationShort(elapsedMs)],
        ...(showLongest ? [['hourglass_top', 'Longest stretch', longest]] : []),
        ...(hasStops
          ? [
              [
                'local_cafe',
                'Rest stops',
                `${stats.stopCount} · ${formatDurationShort(stats.totalStopMs)}`,
              ],
            ]
          : []),
        ...(trip ? [highest] : []),
        gain,
        ...(trip ? [['speed', 'Avg speed', formatSpeed(averageMovingSpeed(stats), units)]] : []),
        ['bolt', 'Max speed', formatSpeed(stats.topSpeedMps, units)],
      ];
  if (rows.length === 0) return null;
  return (
    <>
      <SectionHeader title="Details" subtitle={subtitle} />
      <View style={styles.group}>
        {rows.map(([icon, title, value], i) => (
          <ListRow
            key={title}
            icon={icon}
            title={title}
            value={value}
            strongValue
            dense
            divider={i < rows.length - 1}
          />
        ))}
      </View>
      {hiddenNote ? (
        <Text style={[type.small, styles.subtitleText, styles.hiddenNote]}>{hiddenNote}</Text>
      ) : null}
    </>
  );
}

const makeStyles = (c) => ({
  kicker: { color: c.accent, marginHorizontal: 4 },
  title: { color: c.text, marginTop: 4, marginHorizontal: 4 },
  subtitle: { color: c.textMuted, marginTop: 2, marginHorizontal: 4 },
  // 44px tall for the finger, pulled in so the text sits where a subtitle would.
  parent: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 44,
    marginVertical: -10,
    marginHorizontal: 4,
  },
  parentPrefix: { color: c.textMuted },
  parentName: { color: c.accent, flexShrink: 1 },
  pressed: { opacity: 0.6 },
  notes: { color: c.text, marginTop: 10, marginHorizontal: 4 },
  hero: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 18,
    marginHorizontal: 4,
  },
  heroValue: { ...type.display, color: c.accent },
  heroUnit: {
    ...type.title,
    fontFamily: type.bodyLarge.fontFamily,
    fontSize: 22,
    color: c.textMuted,
  },
  chips: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: c.outline,
  },
  chipText: { color: c.textMuted, fontFamily: type.nav.fontFamily },
  grid: { gap: 10, marginTop: 20 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  group: {
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: c.card,
    ...c.cardShadow,
  },
  chipRoads: { borderWidth: 0, backgroundColor: c.roadContainer },
  chipRoadsText: { color: c.onRoadContainer },
  hidden: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 12,
    ...c.cardShadow,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: c.card,
  },
  hiddenWell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentContainer,
  },
  hiddenTitle: { color: c.text },
  hiddenText: { fontSize: 14, lineHeight: 20 },
  subtitleText: { color: c.textMuted, marginTop: 2 },
  hiddenNote: { marginTop: 8, marginHorizontal: 4 },
  flex: { flex: 1 },
});
