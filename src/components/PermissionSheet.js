import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStyles } from '../hooks/useTheme';
import { radius, spacing, type } from '../theme';
import Button from './ui/Button';

// What to pick in the system prompt, in each platform's own wording.
const CHOICE_HINT =
  Platform.OS === 'ios'
    ? 'On the next screen, tap "Allow While Using App" and leave Precise on.'
    : 'On the next screen, choose "Precise" and "While using the app".';

const CONTENT = {
  // First time: explain before the system prompt appears.
  ask: {
    title: 'Allow location to record your trip',
    body: [
      'Road Trip uses GPS to draw your route and work out distance, speed and rest stops.',
      'It keeps recording while you use Google Maps. Your trips stay on this phone.',
    ],
    hint: CHOICE_HINT,
    primary: 'Continue',
    secondary: 'Not now',
  },
  // Denied and the system won't ask again: only Settings can fix it.
  blocked: {
    title: 'Location is off for Road Trip',
    body: ['Road Trip needs your location to record a trip.'],
    hint: 'In Settings, open Location (or Permissions → Location) and choose "While using the app".',
    primary: 'Open Settings',
    secondary: 'Cancel',
  },
  // Granted but approximate: accurate only to a few hundred metres.
  approximate: {
    title: 'Turn on precise location',
    body: [
      'Road Trip only has your approximate location, which is too rough to measure distance or speed.',
    ],
    hint: 'In Settings, open Location and turn on "Use precise location".',
    primary: 'Open Settings',
    secondary: 'Start anyway',
  },
};

/**
 * Bottom sheet shown before or instead of the system location prompt.
 * `kind` is 'ask' | 'blocked' | 'approximate', or null to hide.
 */
export default function PermissionSheet({ kind, onPrimary, onSecondary }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const content = kind ? CONTENT[kind] : null;

  return (
    <Modal
      visible={Boolean(content)}
      transparent
      animationType="slide"
      onRequestClose={onSecondary}
    >
      <View style={styles.backdrop}>
        {content ? (
          <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
            <Text style={styles.title}>{content.title}</Text>
            {content.body.map((line) => (
              <Text key={line} style={styles.body}>
                {line}
              </Text>
            ))}
            <View style={styles.hint}>
              <Text style={styles.hintText}>{content.hint}</Text>
            </View>
            <Button label={content.primary} onPress={onPrimary} />
            <Pressable onPress={onSecondary} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>{content.secondary}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (c) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...type.title, color: c.text, marginBottom: spacing.xs },
  body: { ...type.body, color: c.text },
  hint: {
    backgroundColor: c.accentContainer,
    borderRadius: 20,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  hintText: { ...type.body, color: c.onAccentContainer },
  secondary: { height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { ...type.button, color: c.accent },
});
