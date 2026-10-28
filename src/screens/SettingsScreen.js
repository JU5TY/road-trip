import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '../context/SettingsContext';
import { colors, radius, spacing } from '../theme';

const UNIT_OPTIONS = [
  { value: 'metric', label: 'Kilometres', detail: 'km · km/h · m' },
  { value: 'imperial', label: 'Miles', detail: 'mi · mph · ft' },
];

export default function SettingsScreen() {
  const { units, setUnits } = useSettings();

  return (
    <View style={styles.screen}>
      <Text style={styles.sectionLabel}>UNITS</Text>
      <View style={styles.segmented}>
        {UNIT_OPTIONS.map((opt) => {
          const selected = units === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setUnits(opt.value)}
              style={[styles.segment, selected && styles.segmentSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                {opt.label}
              </Text>
              <Text style={[styles.segmentDetail, selected && styles.segmentLabelSelected]}>
                {opt.detail}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Applies everywhere, including past trips. Trips are stored in metric, so switching never
        changes your data.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.sm },
  sectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md - 4,
  },
  segmentSelected: { backgroundColor: colors.accent },
  segmentLabel: { color: colors.text, fontSize: 17, fontWeight: '700' },
  segmentDetail: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  segmentLabelSelected: { color: colors.background },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
