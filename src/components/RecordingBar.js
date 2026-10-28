import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '../context/SettingsContext';
import { useActiveDrive } from '../hooks/useActiveDrive';
import { colors, spacing } from '../theme';
import { formatDistance, formatDuration } from '../utils/format';
import { liveMetrics } from '../utils/geoMath';

/** Slim "● Recording" strip shown above the tab bar on other tabs while a drive is live. */
export default function RecordingBar({ onPress }) {
  const { units } = useSettings();
  const { drive, now } = useActiveDrive();
  if (!drive) return null;
  const live = liveMetrics(drive, now);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Recording in progress. Open Record."
    >
      <View style={styles.dot} />
      <Text style={styles.text} numberOfLines={1}>
        {live.isAutoPaused ? 'Paused' : 'Recording'} · {formatDuration(live.elapsedMs)} ·{' '}
        {formatDistance(live.distanceM, units)}
      </Text>
      <Text style={styles.open}>Open</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.stop,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  text: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
  open: { color: '#fff', fontSize: 14, fontWeight: '600', opacity: 0.85 },
});
