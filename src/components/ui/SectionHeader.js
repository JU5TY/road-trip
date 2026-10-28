import { Pressable, Text, View } from 'react-native';

import { useStyles } from '../../hooks/useTheme';
import { type } from '../../theme';

/**
 * Section heading. variant 'title' (20px, Trip's "Details" / "Charts", with an
 * optional green link like "All trips") or 'label' (14px grey, settings groups
 * and month headers).
 */
export default function SectionHeader({ title, variant = 'title', actionLabel, onAction, style }) {
  const styles = useStyles(makeStyles);
  const isTitle = variant === 'title';
  return (
    <View style={[isTitle ? styles.titleRow : styles.labelRow, style]}>
      <Text
        style={isTitle ? [type.section, styles.title] : [type.label, styles.label]}
        role="heading"
      >
        {title}
      </Text>
      {actionLabel ? (
        <Pressable onPress={onAction} accessibilityRole="link" hitSlop={12}>
          <Text style={[type.label, styles.action]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (c) => ({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 14,
    marginHorizontal: 4,
  },
  labelRow: { marginTop: 28, marginBottom: 4, marginHorizontal: 4 },
  title: { color: c.text },
  label: { color: c.textMuted },
  action: { color: c.accent },
});
