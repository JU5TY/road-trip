import { Text, View } from 'react-native';

import { useStyles, useTheme } from '../hooks/useTheme';
import { radius, type } from '../theme';
import { comingSoon } from '../utils/comingSoon';
import Button from './ui/Button';
import Icon from './ui/Icon';

// Three columns: make it yours, keep it safe, go deeper.
const COLUMNS = [
  [
    ['share', 'No branding'],
    ['garage', 'Vehicles'],
  ],
  [
    ['cloud_upload', 'Backup'],
    ['download', 'GPX export'],
  ],
  [
    ['insights', 'Analytics'],
    ['monitoring', 'Charts'],
  ],
];

/** Road Trip Premium on You. Payments aren't built yet, so Sign up says it's coming soon. */
export default function PremiumCard() {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.card} accessibilityLabel="Road Trip Premium, £19.99 a year">
      <View style={styles.header}>
        <Icon name="workspace_premium" filled size={24} color={c.onAccentContainer} />
        <Text style={[type.section, styles.fg, styles.flex]}>Premium</Text>
        <Text style={[type.section, styles.fg]}>
          £19.99<Text style={[type.label, styles.muted]}> / year</Text>
        </Text>
      </View>
      <Text style={[type.label, styles.muted, styles.tagline]}>
        Make it yours, keep it safe, go deeper.
      </Text>
      <View style={styles.groups}>
        {COLUMNS.map((items) => (
          <View key={items[0][1]} style={styles.group}>
            {items.map(([icon, label]) => (
              <View key={label} style={styles.item}>
                <View style={styles.well}>
                  <Icon name={icon} size={22} color={c.onAccentContainer} />
                </View>
                <Text style={[type.small, styles.fg, styles.label]}>{label}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      <Button
        label="Sign up"
        size="small"
        style={styles.signUp}
        onPress={() => comingSoon('Premium')}
      />
    </View>
  );
}

const makeStyles = (c) => ({
  card: {
    marginTop: 12,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderRadius: radius.card,
    backgroundColor: c.accentContainer,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  flex: { flex: 1 },
  fg: { color: c.onAccentContainer },
  muted: { color: c.accentContainerMuted, fontFamily: type.body.fontFamily },
  groups: { flexDirection: 'row', gap: 8, marginTop: 18 },
  group: { flex: 1, alignItems: 'center', gap: 14 },
  tagline: { marginTop: 4, paddingHorizontal: 4 },
  item: { alignItems: 'center', gap: 6 },
  label: { lineHeight: 17, textAlign: 'center' },
  well: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentWell,
  },
  signUp: { marginTop: 18 },
});
