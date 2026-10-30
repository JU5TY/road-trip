import { Modal, Pressable, Text, View } from 'react-native';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { type } from '../../theme';

/**
 * Centred dialog with a text Cancel and one coloured action, e.g. Record's
 * "Stop and save this drive?". `destructive` makes the action red.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
}) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.dialog} role="alertdialog" accessibilityLabel={title}>
          <Text style={[type.title, styles.title]}>{title}</Text>
          {message ? <Text style={[type.body, styles.message]}>{message}</Text> : null}
          <View style={styles.buttons}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={[type.button, { color: c.accent }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.confirm,
                { backgroundColor: destructive ? c.stop : c.accent },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={[type.button, { color: destructive ? c.onStop : c.onAccent }]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c) => ({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: c.scrim,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderRadius: 28,
    backgroundColor: c.card,
  },
  title: { color: c.text, fontSize: 24, lineHeight: 30 },
  message: { color: c.textMuted, marginTop: 8, lineHeight: 22 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  button: { height: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center' },
  confirm: { paddingHorizontal: 20 },
  pressed: { opacity: 0.8 },
});
