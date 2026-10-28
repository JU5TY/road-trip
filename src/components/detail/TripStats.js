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
 * Hero distance, a rest-stops chip and the bento grid (Driving time, Highest
 * point, Elevation gain). `stats` is a drive's stats or a summarizeDrives() result.
 */
export function HeroStats({ stats, units }) {
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
      {stats.stopCount > 0 ? (
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Icon name="local_cafe" size={18} color={c.textMuted} />
            <Text style={[type.label, styles.chipText]}>
              {stats.stopCount} {stats.stopCount === 1 ? 'stop' : 'stops'}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={styles.grid}>
        <StatCard
          layout="wide"
          tone="accent"
          icon="directions_car"
          label="Driving time"
          value={formatDurationShort(stats.movingTimeMs)}
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
            label="Elevation gain"
            value={gain.value}
            unit={gain.unit}
          />
        </View>
      </View>
    </>
  );
}

/** "Details" rows: time first, speed last (Max speed stays low-key). */
export function DetailsRows({ stats, elapsedMs, units }) {
  const styles = useStyles(makeStyles);
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
});
