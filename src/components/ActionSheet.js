import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';

/**
 * Bottom sheet with a list of actions (Android's Alert only allows three buttons).
 * actions: [{ label, key?, detail?, onPress, style?: 'primary' | 'destructive' }]
 * Pass `visible={false}` to hide. Tapping the backdrop or Cancel calls onClose.
 */
export default function ActionSheet({ visible, title, message, actions, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallow taps on the sheet itself so only the backdrop closes it. */}
        <Pressable style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {actions.map((a) => (
              <Pressable
                key={a.key ?? a.label}
                onPress={a.onPress}
                style={({ pressed }) => [
                  styles.action,
                  a.style === 'primary' && styles.actionPrimary,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.actionLabel,
                    a.style === 'primary' && styles.actionLabelPrimary,
                    a.style === 'destructive' && styles.actionLabelDestructive,
                  ]}
                  numberOfLines={1}
                >
                  {a.label}
                </Text>
                {a.detail ? (
                  <Text
                    style={[styles.actionDetail, a.style === 'primary' && styles.actionLabelPrimary]}
                    numberOfLines={1}
                  >
                    {a.detail}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
    maxHeight: '80%',
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  message: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  list: { flexGrow: 0 },
  listContent: { gap: spacing.sm, paddingTop: spacing.xs },
  action: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  actionPrimary: { backgroundColor: colors.accent },
  actionLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  actionLabelPrimary: { color: colors.background },
  actionLabelDestructive: { color: colors.stop },
  actionDetail: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  cancel: { height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
