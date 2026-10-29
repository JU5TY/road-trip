import { Pressable, Text, View } from 'react-native';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { type } from '../../theme';
import {
  distanceParts,
  elevationParts,
  formatDurationShort,
  formatSpeed,
} from '../../utils/format';
import { averageMovingSpeed } from '../../utils/geoMath';
import Icon from '../ui/Icon';
import ListRow from '../ui/ListRow';
import SectionHeader from '../ui/SectionHeader';
import StatCard from '../ui/StatCard';

/** Green caps line, title, grey subtitle and optional notes. Tapping it calls onPress (edit). */
export function TitleBlock({ kicker, title, subtitle, notes, onPress }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Text style={[type.smallStrong, styles.kicker]}>{kicker}</Text>
      <Text style={[type.headline, styles.title]}>{title}</Text>
      {subtitle ? <Text style={[type.body, styles.subtitle]}>{subtitle}</Text> : null}
      {notes ? <Text style={[type.body, styles.notes]}>{notes}</Text> : null}
    </Pressable>
  );
}

/**
 * Hero distance, Iconic Roads and rest-stops chips, and the bento grid (Driving
 * time, Highest point, Elevation gain). `stats` is a drive's stats or a
 * summarizeDrives() result. `timesHidden` swaps Driving time for a note (a
 * drive that starts and ends at an Iconic Road); `roadCount` adds the chip.
 */
export function HeroStats({ stats, units, timesHidden = false, roadCount = 0 }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const distance = distanceParts(stats.distanceM, units);
  const highest = elevationParts(stats.maxAltitudeM, units);
  const gain = elevationParts(stats.elevationGainM, units);

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
      {stats.stopCount > 0 || roadCount > 0 ? (
        <View style={styles.chips}>
          {roadCount > 0 ? (
            <View style={[styles.chip, styles.chipRoads]}>
              <Icon name="verified" size={18} color={c.onAccentContainer} />
              <Text style={[type.label, styles.chipRoadsText]}>
                {roadCount} {roadCount === 1 ? 'Iconic Road' : 'Iconic Roads'}
              </Text>
            </View>
          ) : null}
          {stats.stopCount > 0 ? (
            <View style={styles.chip}>
              <Icon name="local_cafe" size={18} color={c.textMuted} />
              <Text style={[type.label, styles.chipText]}>
                {stats.stopCount} {stats.stopCount === 1 ? 'stop' : 'stops'}
              </Text>
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
            label="Elevation gain"
            value={gain.value}
            unit={gain.unit}
          />
        </View>
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
        <Text style={[type.body, styles.subtitleText]}>
          {"This drive starts and ends at an Iconic Road, so its times and speeds aren't shown."}
        </Text>
      </View>
    </View>
  );
}

/**
 * "Details" rows: time first, speed last (Max speed stays low-key). With
 * `timesHidden` only the rest-stop count is left. `hiddenNote` explains that
 * some drives' times were left out of a trip's totals.
 */
export function DetailsRows({ stats, elapsedMs, units, timesHidden = false, hiddenNote }) {
  const styles = useStyles(makeStyles);
  if (timesHidden) {
    return (
      <>
        <SectionHeader title="Details" style={styles.detailsHeader} />
        <ListRow
          icon="local_cafe"
          title="Rest stops"
          value={stats.stopCount > 0 ? String(stats.stopCount) : 'None'}
          strongValue
        />
      </>
    );
  }
  // Drives recorded before this stat existed don't have it.
  const longest = stats.longestStintMs == null ? '—' : formatDurationShort(stats.longestStintMs);
  const rows = [
    ['schedule', 'Elapsed time', formatDurationShort(elapsedMs)],
    ['hourglass_top', 'Longest stretch', longest],
    [
      'local_cafe',
      'Rest stops',
      stats.stopCount > 0
        ? `${stats.stopCount} · ${formatDurationShort(stats.totalStopMs)}`
        : 'None',
    ],
    ['speed', 'Avg speed', formatSpeed(averageMovingSpeed(stats), units)],
    ['bolt', 'Max speed', formatSpeed(stats.topSpeedMps, units)],
  ];
  return (
    <>
      <SectionHeader title="Details" style={styles.detailsHeader} />
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
      {hiddenNote ? (
        <Text style={[type.small, styles.subtitleText, styles.hiddenNote]}>{hiddenNote}</Text>
      ) : null}
    </>
  );
}

const makeStyles = (c) => ({
  kicker: { color: c.accent, letterSpacing: 0.4, marginHorizontal: 4 },
  title: { color: c.text, marginTop: 4, marginHorizontal: 4 },
  subtitle: { color: c.textMuted, marginTop: 2, marginHorizontal: 4 },
  notes: { color: c.text, marginTop: 10, marginHorizontal: 4 },
  hero: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 18,
    marginHorizontal: 4,
  },
  heroValue: { ...type.display, fontSize: 64, lineHeight: 68, color: c.text },
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
  detailsHeader: { marginBottom: 4 },
  chipRoads: { borderWidth: 0, backgroundColor: c.accentContainer },
  chipRoadsText: { color: c.onAccentContainer },
  hidden: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: c.surface,
  },
  hiddenWell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentContainer,
  },
  hiddenTitle: { color: c.text, fontFamily: type.button.fontFamily, fontSize: 17 },
  subtitleText: { color: c.textMuted, marginTop: 2 },
  hiddenNote: { marginTop: 8, marginHorizontal: 4 },
  flex: { flex: 1 },
});
