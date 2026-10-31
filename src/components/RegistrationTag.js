import { Text, View } from 'react-native';

import { useStyles } from '../hooks/useTheme';
import { type } from '../theme';

/** A vehicle's registration as a small grey tag ("AB12 CDE"). Only shown in the app, never shared. */
export default function RegistrationTag({ registration, style }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.tag, style]} accessibilityLabel={`Registration ${registration}`}>
      <Text style={[type.caps, styles.text]}>{registration}</Text>
    </View>
  );
}

const makeStyles = (c) => ({
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.outline,
    backgroundColor: c.track,
  },
  text: { color: c.text, letterSpacing: 1 },
});
