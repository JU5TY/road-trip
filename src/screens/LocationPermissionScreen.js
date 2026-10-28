import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { useSettings } from '../context/SettingsContext';
import { useStyles, useTheme } from '../hooks/useTheme';
import { getLocationAccess, requestLocationAccess } from '../services/locationService';
import { radius, type } from '../theme';

const REASONS = [
  ['route', 'Draws your route', 'Distance, time and climb come from your location.'],
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
        { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.tile}>
        <Icon name="location_on" filled size={44} color={c.onAccentContainer} />
      </View>
      <Text style={styles.title} role="heading">
        Allow location while using the app
      </Text>
      <Text style={[type.bodyLarge, styles.muted, styles.lead]}>
        Road Trip needs your location to record where you drive.
      </Text>
      {REASONS.map(([icon, title, body]) => (
        <View key={title} style={styles.reason}>
          <Icon name={icon} size={24} color={c.accent} />
          <View style={styles.flex}>
            <Text style={[type.bodyStrong, styles.text]}>{title}</Text>
            <Text style={[type.body, styles.muted, styles.reasonBody]}>{body}</Text>
          </View>
        </View>
      ))}
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
    width: 88,
    height: 88,
    borderRadius: radius.card,
    backgroundColor: c.accentContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.headline, fontSize: 30, lineHeight: 36, color: c.text, marginTop: 28 },
  lead: { marginTop: 12, marginBottom: 8, lineHeight: 24 },
  reason: { flexDirection: 'row', gap: 16, paddingVertical: 12 },
  reasonBody: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  flex: { flex: 1 },
  text: { color: c.text },
  muted: { color: c.textMuted },
  continue: { marginTop: 48 }, // never crowded against the last reason
  notNow: { height: 48, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  link: { color: c.accent },
});
