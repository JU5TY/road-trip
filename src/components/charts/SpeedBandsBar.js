import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../../theme';
import { formatDurationShort } from '../../utils/format';

// Slow → fast: back roads, A-roads, motorway.
const BAND_COLORS = ['#2FBF71', '#F2A93B', '#3D7DF2'];

/** One stacked bar of time spent in each speed band, with a legend. */
export default function SpeedBandsBar({ bands }) {
  const total = bands.reduce((sum, b) => sum + b.ms, 0);
  if (total === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {bands.map((b, i) =>
          b.fraction > 0 ? (
            <View key={b.label} style={{ flex: b.fraction, backgroundColor: BAND_COLORS[i] }} />
          ) : null
        )}
      </View>
      {bands.map((b, i) => (
        <View key={b.label} style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: BAND_COLORS[i] }]} />
          <Text style={styles.legendLabel}>{b.label}</Text>
          <Text style={styles.legendValue}>
            {Math.round(b.fraction * 100)}% · {formatDurationShort(b.ms)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  bar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.xs,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendLabel: { flex: 1, color: colors.text, fontSize: 13 },
  legendValue: { color: colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
});
