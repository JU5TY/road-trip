import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapIllustration from '../components/MapIllustration';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { useStyles, useTheme } from '../hooks/useTheme';
import { type } from '../theme';

const FEATURES = [
  ['route', 'Record every drive', 'Route, miles and time, even with the screen off'],
  ['auto_stories', 'Relive your trips', 'Day by day, with stops, countries and charts'],
  ['verified', 'Complete Iconic Roads', 'From Snake Pass to the Nürburgring'],
];

/** First launch: what the app does, then on to the location explainer. */
export default function WelcomeScreen() {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
    >
      <View style={[styles.band, { paddingTop: insets.top + 48 }]}>
        <View style={styles.ring}>
          <View style={styles.map}>
            <MapIllustration height="100%" route />
          </View>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={[type.headline, styles.text]} role="heading">
          Every road trip, mapped
        </Text>
        <View style={styles.features}>
          {FEATURES.map(([icon, title, body]) => (
            <View key={title} style={styles.feature}>
              <View style={styles.well}>
                <Icon name={icon} size={22} color={c.onAccentContainer} />
              </View>
              <View style={styles.flex}>
                <Text style={[type.bodyStrong, styles.text]}>{title}</Text>
                <Text style={[type.label, styles.muted]}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.gap} />
        <Button label="Get started" onPress={() => router.push('/permission')} />
        <View style={styles.private}>
          <Icon name="lock" size={16} color={c.textMuted} />
          <Text style={[type.small, styles.muted]}>Your trips stay on this phone</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { flexGrow: 1 },
  band: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24, backgroundColor: c.card },
  ring: { width: 236, height: 236, borderRadius: 118, padding: 10, backgroundColor: c.mapRing },
  map: { flex: 1, borderRadius: 108, overflow: 'hidden' },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 },
  features: { gap: 16, marginTop: 20 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  well: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentContainer,
  },
  flex: { flex: 1 },
  text: { color: c.text },
  muted: { color: c.textMuted, fontFamily: type.body.fontFamily },
  gap: { flex: 1, minHeight: 32 },
  private: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
});
