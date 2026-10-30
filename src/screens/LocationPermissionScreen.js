import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { useSettings } from '../context/SettingsContext';
import { useStyles, useTheme } from '../hooks/useTheme';
import { getLocationAccess, requestLocationAccess } from '../services/locationService';
import { type } from '../theme';

const REASONS = [
  ['route', 'Draws your route', 'Miles, time and climb come from your location.'],
  [
    'notifications',
    'Keeps going with the screen off',
    'A notification shows while a trip is recording.',
  ],
  ['lock', 'Stays on your phone', 'Your location is never uploaded or shared.'],
];

/**
 * First launch, after Welcome: why location is needed, then the system prompt.
 * Either button finishes onboarding; Record asks again later if access is missing.
 */
export default function LocationPermissionScreen() {
  const { finishOnboarding } = useSettings();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const allow = async () => {
    try {
      const before = await getLocationAccess();
      // Once refused for good, only Settings can turn it on.
      if (!before.granted && !before.canAskAgain) Linking.openSettings();
      else if (!before.granted) await requestLocationAccess();
    } catch (err) {
      console.warn('[permission] request failed', err);
    }
    finishOnboarding();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View style={styles.tile}>
        <Icon name="location_on" filled size={40} color={c.accent} />
      </View>
      <Text style={[type.title, styles.text, styles.title]} role="heading">
        Road Trip needs your location
      </Text>
      <Text style={[type.bodyLarge, styles.muted, styles.lead]}>
        {"It's how the app records where you drive."}
      </Text>
      <View style={styles.reasons}>
        {REASONS.map(([icon, title, body]) => (
          <View key={title} style={styles.reason}>
            <Icon name={icon} size={24} color={c.accent} style={styles.reasonIcon} />
            <View style={styles.flex}>
              <Text style={[type.bodyStrong, styles.text]}>{title}</Text>
              <Text style={[type.body, styles.muted, styles.reasonBody]}>{body}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.next}>
        <Text style={[type.label, styles.text]}>Next, your phone will ask</Text>
        <Text style={[type.label, styles.muted, styles.regular, styles.choose]}>
          Choose this option:
        </Text>
        <View style={styles.option}>
          <Icon name="radio_button_checked" filled size={20} color={c.onAccentContainer} />
          <Text style={[type.button, styles.optionText]}>While using the app</Text>
        </View>
      </View>
      <View style={styles.flex} />
      <Button label="Continue" onPress={allow} style={styles.continue} />
      <Pressable onPress={finishOnboarding} style={styles.notNow} accessibilityRole="button">
        <Text style={[type.button, styles.link]}>Not now</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.accentContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: 20 },
  lead: { marginTop: 8, lineHeight: 24 },
  reasons: { gap: 16, marginTop: 24 },
  reasonIcon: { marginTop: 1 },
  choose: { marginTop: 2 },
  next: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: c.card,
    ...c.cardShadow,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: c.accentContainer,
  },
  optionText: { color: c.onAccentContainer },
  regular: { fontFamily: type.body.fontFamily },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  reasonBody: { fontSize: 14, lineHeight: 20 },
  flex: { flex: 1 },
  text: { color: c.text },
  muted: { color: c.textMuted },
  continue: { marginTop: 24 }, // never crowded against the card above
  notNow: { height: 48, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  link: { color: c.accent },
});
