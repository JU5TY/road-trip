import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';
import { formatDayDate, formatDistance, formatDurationShort, formatTime } from '../utils/format';
import { cardStyle } from './TelemetryCard';

const RAIL = 24; // width of the marker column
const GAP_TYPES = ['leg', 'break', 'overnight']; // rows between events, without a marker
const MARKER_TOP = 4; // aligns markers with the first line of text

/** Marker shapes: dot (start), diamond (stop), square (finish). */
function Marker({ type }) {
  if (type === 'start') return <View style={[styles.marker, styles.dot]} />;
  if (type === 'finish') return <View style={[styles.marker, styles.square]} />;
  return <View style={[styles.marker, styles.diamond]} />;
}

/** A row with a marker on the rail; the rail line is hidden above the first and below the last. */
function EventRow({ item, isFirst, isLast, onPress }) {
  const isStop = item.type === 'stop';
  const title = item.place || (item.type === 'start' ? 'Start' : item.type === 'finish' ? 'Finish' : 'Rest stop');
  const subtitle = isStop
    ? `Rest stop · ${formatTime(item.time)}–${formatTime(item.endTime)}`
    : item.type === 'start'
      ? 'Start'
      : 'Finish';

  const body = (
    <View style={styles.row}>
      <Text style={styles.time}>{formatTime(item.time)}</Text>
      <View style={styles.rail}>
        <View style={[styles.lineTop, isFirst && styles.hidden]} />
        <Marker type={item.type} />
        <View style={[styles.lineBottom, isLast && styles.hidden]} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {isStop ? (
        <Text style={styles.duration}>{formatDurationShort(item.endTime - item.time)}</Text>
      ) : null}
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

/** A row between events: a driving leg, a break, or an overnight gap. */
function GapRow({ item, units }) {
  let text;
  let icon = null;
  if (item.type === 'leg') {
    text = `${formatDistance(item.distanceM, units)} · ${formatDurationShort(item.durationMs)} driving`;
  } else if (item.type === 'break') {
    text = `Break (not recording) · ${formatDurationShort(item.durationMs)}`;
  } else {
    icon = 'moon';
    text = `Overnight${item.place ? ` in ${item.place}` : ''} · ${formatDurationShort(item.durationMs)}`;
  }
  const isGap = item.type !== 'leg';

  return (
    <View style={styles.row}>
      <View style={styles.timeSpacer} />
      <View style={styles.rail}>
        <View style={[styles.lineFull, isGap && styles.lineGap]} />
      </View>
      <View style={[styles.gapContent, isGap && styles.gapContentPadded]}>
        {icon ? <Ionicons name={icon} size={14} color={colors.textMuted} /> : null}
        <Text style={[styles.gapText, isGap && styles.gapTextStrong]}>{text}</Text>
      </View>
    </View>
  );
}

/**
 * Vertical stop-by-stop timeline (see utils/timeline.js for the items).
 * `onStopPress(item)` is called when a rest stop is tapped.
 */
export default function TimelineCard({ items, units, onStopPress, title = 'Timeline' }) {
  const isEvent = (item) => !GAP_TYPES.includes(item.type);
  const eventIndexes = items.flatMap((item, i) => (isEvent(item) ? [i] : []));
  const firstEvent = eventIndexes[0];
  const lastEvent = eventIndexes.at(-1);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View>
        {items.map((item, i) => {
          const key = `${item.type}-${i}`;
          return (
            <View key={key}>
              {item.type === 'start' && item.dayNumber ? (
                <Text style={[styles.dayHeader, i > 0 && styles.dayHeaderSpaced]}>
                  DAY {item.dayNumber} · {formatDayDate(item.time).toUpperCase()}
                </Text>
              ) : null}
              {isEvent(item) ? (
                <EventRow
                  item={item}
                  isFirst={i === firstEvent}
                  isLast={i === lastEvent}
                  onPress={onStopPress}
                />
              ) : (
                <GapRow item={item} units={units} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: cardStyle,
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  dayHeader: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  dayHeaderSpaced: { marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  time: {
    width: 52,
    color: colors.textMuted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    paddingTop: 1,
  },
  timeSpacer: { width: 52 },
  rail: { width: RAIL, alignItems: 'center' },
  lineTop: { width: 2, height: MARKER_TOP, backgroundColor: colors.border },
  lineBottom: { width: 2, flex: 1, backgroundColor: colors.border },
  lineFull: { width: 2, flex: 1, backgroundColor: colors.border },
  lineGap: { backgroundColor: colors.surfaceRaised },
  hidden: { backgroundColor: 'transparent' },
  marker: { width: 12, height: 12 },
  dot: { borderRadius: 6, backgroundColor: colors.start },
  square: { borderRadius: 2, backgroundColor: colors.stop },
  diamond: { backgroundColor: colors.accent, transform: [{ rotate: '45deg' }], width: 10, height: 10, margin: 1 },
  content: { flex: 1, paddingBottom: spacing.sm, paddingLeft: spacing.xs },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  duration: { color: colors.accent, fontSize: 14, fontWeight: '700', paddingTop: 1 },
  gapContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    paddingBottom: spacing.sm,
  },
  gapContentPadded: { paddingVertical: spacing.xs },
  gapText: { color: colors.textMuted, fontSize: 13 },
  gapTextStrong: { fontStyle: 'italic' },
  pressed: { opacity: 0.6 },
});
