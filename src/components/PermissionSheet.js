import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';

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
  const content = kind ? CONTENT[kind] : null;

  return (
    <Modal visible={Boolean(content)} transparent animationType="slide" onRequestClose={onSecondary}>
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
            <Pressable
              onPress={onPrimary}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{content.primary}</Text>
            </Pressable>
            <Pressable onPress={onSecondary} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>{content.secondary}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.xs },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  hint: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  hintText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  primary: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  primaryText: { color: colors.background, fontSize: 17, fontWeight: '700' },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
