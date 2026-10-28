import { Pressable, Text, View } from 'react-native';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { type } from '../../theme';
import { formatDistance, formatDurationShort, formatTime } from '../../utils/format';
import Icon from '../ui/Icon';
import SectionHeader from '../ui/SectionHeader';

const TIME_W = 44;
const RAIL_W = 20;

/** Start (green dot), rest stop (ring in the route colour) or finish (red dot). */
function Marker({ kind, color }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  if (kind === 'stop') return <View style={[styles.ring, { borderColor: color }]} />;
  return <View style={[styles.dot, { backgroundColor: kind === 'start' ? c.start : c.finish }]} />;
}

function EventRow({ item, color, onPress }) {
  const styles = useStyles(makeStyles);
  const isStop = item.type === 'stop';
  const title =
    item.place ||
    (item.type === 'start' ? 'Start' : item.type === 'finish' ? 'Finish' : 'Rest stop');
  const subtitle = isStop
    ? `Rest stop · ${formatDurationShort(item.endTime - item.time)}`
    : item.type === 'start'
      ? 'Start'
      : 'Finish';

  const body = (
    <View style={styles.event}>
      <Text style={[type.small, styles.time]}>{formatTime(item.time)}</Text>
      <View style={styles.rail}>
        <Marker kind={item.type} color={color} />
      </View>
      <View style={styles.flex}>
        <Text style={[type.bodyStrong, styles.title]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[type.small, styles.muted]}>{subtitle}</Text>
      </View>
    </View>
  );

  if (!isStop || !onPress) return body;
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button"
      accessibilityHint="Shows this stop on the map"
    >
      {body}
    </Pressable>
  );
}

/** Between events: a driving leg (solid bar), a break or an overnight (faint bar). */
function GapRow({ item, color, units }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const isLeg = item.type === 'leg';
  const icon = isLeg ? 'directions_car' : item.type === 'break' ? 'schedule' : 'bedtime';
  const text = isLeg
    ? `${formatDistance(item.distanceM, units)} · ${formatDurationShort(item.durationMs)}`
    : item.type === 'break'
      ? `Break, not recording · ${formatDurationShort(item.durationMs)}`
      : `Overnight${item.place ? ` in ${item.place}` : ''} · ${formatDurationShort(item.durationMs)}`;

  return (
    <View style={styles.gap}>
      <View style={styles.timeSpacer} />
      <View style={styles.rail}>
        <View style={[styles.bar, { backgroundColor: isLeg ? color : c.outline }]} />
      </View>
      <View style={styles.gapText}>
        <Icon name={icon} size={18} color={c.textMuted} />
        <Text style={[type.body, styles.muted]} numberOfLines={1}>
          {text}
        </Text>
      </View>
    </View>
  );
}

/**
 * "Timeline" section: start, driving legs, rest stops and finish (items from
 * utils/timeline.js), drawn in the route colour. onStopPress(item) on a stop.
 */
export default function Timeline({ items, color, units, onStopPress }) {
  const styles = useStyles(makeStyles);
  const isGap = (item) => ['leg', 'break', 'overnight'].includes(item.type);
  return (
    <View>
      <SectionHeader title="Timeline" style={styles.header} />
      {items.map((item, i) =>
        isGap(item) ? (
          <GapRow key={`${item.type}-${i}`} item={item} color={color} units={units} />
        ) : (
          <EventRow key={`${item.type}-${i}`} item={item} color={color} onPress={onStopPress} />
        )
      )}
    </View>
  );
}

const makeStyles = (c) => ({
  header: { marginBottom: 12 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  gap: { flexDirection: 'row', alignItems: 'stretch', gap: 12, minHeight: 44 },
  time: { width: TIME_W, textAlign: 'right', color: c.textMuted },
  timeSpacer: { width: TIME_W },
  rail: { width: RAIL_W, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8 },
  ring: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, backgroundColor: c.background },
  bar: { width: 4, flex: 1, borderRadius: 2 },
  flex: { flex: 1, minWidth: 0 },
  title: { color: c.text },
  muted: { color: c.textMuted, flexShrink: 1 },
  gapText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.6 },
});
