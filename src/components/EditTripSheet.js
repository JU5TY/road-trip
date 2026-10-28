import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';

// Mounted only while the sheet is open, so it starts from the saved values each time.
function EditTripForm({ trip, placeholder, onSave, onClose }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(trip?.name ?? '');
  const [notes, setNotes] = useState(trip?.notes ?? '');

  return (
    <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
      <Text style={styles.title}>Edit trip</Text>

      <Text style={styles.label}>NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        returnKeyType="done"
        maxLength={80}
      />
      <Text style={styles.hint}>Leave empty to name it after the route.</Text>

      <Text style={styles.label}>NOTES</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Who came, highlights, things to remember…"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, styles.notes]}
        multiline
        textAlignVertical="top"
        maxLength={2000}
      />

      <Pressable
        onPress={() => onSave({ name, notes })}
        style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.saveText}>Save</Text>
      </Pressable>
      <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

/** Edit a trip's name and notes. `placeholder` is the automatic title shown when unnamed. */
export default function EditTripSheet({ visible, trip, placeholder, onSave, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {visible ? (
          <EditTripForm trip={trip} placeholder={placeholder} onSave={onSave} onClose={onClose} />
        ) : null}
      </KeyboardAvoidingView>
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
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.xs },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
  },
  notes: { minHeight: 100, maxHeight: 200 },
  hint: { color: colors.textMuted, fontSize: 12 },
  save: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginTop: spacing.md,
  },
  saveText: { color: colors.background, fontSize: 17, fontWeight: '700' },
  cancel: { height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
