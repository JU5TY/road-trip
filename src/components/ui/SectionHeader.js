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
        <Pressable onPress={onAction} accessibilityRole="link" hitSlop={12} style={styles.actionWrap}>
          <Text style={[type.label, styles.action]} numberOfLines={1}>
            {actionLabel}
          </Text>
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
  title: { color: c.text, flexShrink: 1 },
  label: { color: c.textMuted },
  // Android measures letter-spaced custom fonts a little short, which wrapped
  // "All roads" onto a hidden second line; no spacing and no shrinking here.
  actionWrap: { flexShrink: 0, marginLeft: 12 },
  action: { color: c.accent, letterSpacing: 0 },
});
