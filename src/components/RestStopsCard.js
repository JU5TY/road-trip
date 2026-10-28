import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';
import { formatDurationShort, formatTime } from '../utils/format';
import { cardStyle } from './TelemetryCard';

/** Name of a drive's i-th rest stop, falling back to a generic label. */
export const stopName = (drive, i) => drive.places.stops?.[i] || 'Rest stop';

/** List of a drive's rest stops with place names, times and durations. */
export default function RestStopsCard({ drive }) {
  if (drive.stats.stops.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Rest Stops</Text>
      {drive.stats.stops.map((s, i) => (
        <View key={s.startedAt} style={styles.row}>
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>
              {stopName(drive, i)}
            </Text>
            <Text style={styles.time}>
              {formatTime(s.startedAt)} – {formatTime(s.endedAt)}
            </Text>
          </View>
          <Text style={styles.duration}>{formatDurationShort(s.endedAt - s.startedAt)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: cardStyle,
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  duration: { color: colors.accent, fontSize: 15, fontWeight: '700' },
});
