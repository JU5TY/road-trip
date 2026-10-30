import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStyles, useTheme } from '../hooks/useTheme';
import { radius, spacing, type } from '../theme';
import Button from './ui/Button';

// Mounted only while the sheet is open, so it starts from the saved name each time.
function VehicleForm({ vehicle, onSave, onDelete, onClose }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const [name, setName] = useState(vehicle?.name ?? '');
  const valid = name.trim().length > 0;

  const confirmDelete = () =>
    Alert.alert(`Remove ${vehicle.name}?`, 'Your trips stay; they just won’t name a vehicle.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
      <Text style={styles.title}>{vehicle ? 'Edit vehicle' : 'Add your vehicle'}</Text>
      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Mazda MX-5"
        placeholderTextColor={c.textMuted}
        style={styles.input}
        returnKeyType="done"
        autoFocus={!vehicle}
        maxLength={60}
        onSubmitEditing={() => valid && onSave(name)}
      />
      {vehicle ? null : (
        <Text style={styles.hint}>Your trips so far, and every new one, are put down to it.</Text>
      )}
      <Button label="Save" onPress={() => onSave(name)} disabled={!valid} style={styles.save} />
      {vehicle ? (
        <Pressable onPress={confirmDelete} style={styles.link} accessibilityRole="button">
          <Text style={[styles.linkText, { color: c.stop }]}>Remove vehicle</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onClose} style={styles.link} accessibilityRole="button">
        <Text style={styles.linkText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

/** Add a vehicle (no `vehicle`) or rename / remove one. */
export default function VehicleSheet({ visible, vehicle, onSave, onDelete, onClose }) {
  const styles = useStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Padding on Android too: edge-to-edge windows don't resize for the keyboard. */}
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        {visible ? (
          <VehicleForm vehicle={vehicle} onSave={onSave} onDelete={onDelete} onClose={onClose} />
        ) : null}
      </KeyboardAvoidingView>
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
  label: { ...type.label, color: c.textMuted, marginTop: spacing.sm },
  input: {
    ...type.bodyLarge,
    backgroundColor: c.surface,
    color: c.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  hint: { ...type.small, color: c.textMuted },
  save: { marginTop: spacing.md },
  link: { height: 48, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...type.button, color: c.accent },
});
