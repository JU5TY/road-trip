import { Text, View } from 'react-native';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { radius, type } from '../../theme';
import Icon from './Icon';

/**
 * Stat tile from the Trip/Record bento grid.
 * tone: 'surface' (grey) | 'accent' (green) | 'warning' (amber, break due).
 * layout: 'tile' (icon over value over label) | 'wide' (icon well left, label
 * over a larger value: the full-width Driving time card).
 * `notch` squares off the bottom-left corner, as on the last tile of a grid.
 */
export default function StatCard({
  icon,
  value,
  unit,
  label,
  tone = 'surface',
  layout = 'tile',
  notch = false,
  style,
}) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const tc = {
    surface: { bg: c.surface, fg: c.text, muted: c.textMuted, icon: c.accent },
    accent: { bg: c.statAccent, fg: c.onStatAccent, muted: c.onStatAccent, icon: c.statAccentIcon },
    warning: {
      bg: c.warningContainer,
      fg: c.onWarningContainer,
      muted: c.onWarningContainer,
      icon: c.onWarningContainer,
    },
  }[tone];
  const card = [styles.card, { backgroundColor: tc.bg }, notch && styles.notch, style];
  const labelStyle = [
    type.small,
    { color: tc.muted },
    tone === 'accent' && styles.soft,
    tone === 'warning' && styles.strongLabel,
  ];

  if (layout === 'wide') {
    return (
      <View
        style={[card, styles.wide]}
        accessible
        accessibilityLabel={`${label}: ${value}${unit ?? ''}`}
      >
        <View style={[styles.well, tone === 'accent' && { backgroundColor: c.statAccentIconWell }]}>
          <Icon name={icon} size={26} color={tc.icon} />
        </View>
        <View style={styles.flex}>
          <Text style={labelStyle}>{label}</Text>
          <Text style={[type.statLarge, { color: tc.fg }]} numberOfLines={1}>
            {value}
            {unit ? <Text style={[type.statUnit, { color: tc.muted }]}> {unit}</Text> : null}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={card} accessible accessibilityLabel={`${label}: ${value}${unit ?? ''}`}>
      <Icon name={icon} size={24} color={tc.icon} filled={tone === 'warning'} />
      <Text
        style={[type.stat, styles.value, { color: tc.fg }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
        {unit ? <Text style={[type.statUnit, { color: tc.muted }]}> {unit}</Text> : null}
      </Text>
      <Text style={labelStyle} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = () => ({
  card: { borderRadius: radius.card, padding: 18 },
  notch: { borderBottomLeftRadius: radius.sm },
  wide: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20 },
  well: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  value: { marginTop: 10 },
  soft: { opacity: 0.85 },
  strongLabel: { fontFamily: type.smallStrong.fontFamily },
});
