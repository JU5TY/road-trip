import { StyleSheet, Text, View } from 'react-native';

import { colors, dayColor, radius, spacing } from '../../theme';
import { formatDistance } from '../../utils/format';

/** Horizontal bar per driving day, scaled to the longest day, in that day's map colour. */
export default function DayDistanceBars({ days, units }) {
  const longest = Math.max(...days.map((d) => d.summary.distanceM), 0);
  if (longest === 0) return null;

  return (
    <View style={styles.wrap}>
      {days.map((day) => (
        <View key={day.number} style={styles.row}>
          <Text style={styles.label}>Day {day.number}</Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(2, (day.summary.distanceM / longest) * 100)}%`,
                  backgroundColor: dayColor(day.number),
                },
              ]}
            />
          </View>
          <Text style={styles.value}>{formatDistance(day.summary.distanceM, units, 0)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { width: 48, color: colors.textMuted, fontSize: 13 },
  track: { flex: 1, height: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  fill: { height: 12, borderRadius: radius.pill },
  value: { width: 64, textAlign: 'right', color: colors.text, fontSize: 13, fontWeight: '600' },
});
