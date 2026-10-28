import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapIllustration from '../components/MapIllustration';
import Button from '../components/ui/Button';
import { useStyles } from '../hooks/useTheme';
import { type } from '../theme';

/** First launch: what the app does, then on to the location explainer. */
export default function WelcomeScreen() {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      {/* The map gives up height first, so the text never crowds the button. */}
      <View style={[styles.map, { flexBasis: 440 + insets.top }]}>
        <MapIllustration height="100%" route />
      </View>
      <View style={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.title} role="heading">
          Every road trip, mapped
        </Text>
        <Text style={[type.bodyLarge, styles.text]}>
          Record your drives and look back on every trip, day by day. Your trips stay on this phone.
        </Text>
        <View style={styles.gap} />
        <Button label="Get started" onPress={() => router.push('/permission')} />
      </View>
    </View>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  // 440 tall like the design, shrinking (not below 200) when the screen is short.
  map: { flexGrow: 0, flexShrink: 1, minHeight: 200 },
  body: { flexGrow: 1, flexShrink: 0, paddingHorizontal: 24, paddingTop: 32 },
  title: { ...type.headline, fontSize: 34, lineHeight: 40, color: c.text },
  text: { color: c.textMuted, marginTop: 14, lineHeight: 24 },
  gap: { flex: 1, minHeight: 48 },
});
