import { Pressable, View } from 'react-native';

import { useStyles, useTheme } from '../../hooks/useTheme';
import Icon from './Icon';

/** Material 3 switch: green track with a ticked thumb when on, outlined when off. */
export default function Switch({ value, onValueChange, accessibilityLabel }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      style={[styles.track, value ? styles.trackOn : styles.trackOff]}
    >
      {value ? (
        <View style={styles.thumbOn}>
          <Icon name="check" size={16} color={c.accent} />
        </View>
      ) : (
        <View style={styles.thumbOff} />
      )}
    </Pressable>
  );
}

const makeStyles = (c) => ({
  track: { width: 52, height: 32, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  trackOn: { backgroundColor: c.accent, justifyContent: 'flex-end', paddingHorizontal: 4 },
  trackOff: { borderWidth: 2, borderColor: c.outlineStrong, paddingHorizontal: 6 },
  thumbOn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.onAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOff: { width: 16, height: 16, borderRadius: 8, backgroundColor: c.outlineStrong },
});
