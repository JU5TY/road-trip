import { Pressable, Text, View } from 'react-native';

import { useStyles, useTheme } from '../../hooks/useTheme';
import { radius, type } from '../../theme';
import { vehicleLabel } from '../../utils/vehicles';
import RegistrationTag from '../RegistrationTag';
import Icon from '../ui/Icon';
import SectionHeader from '../ui/SectionHeader';

/**
 * A drive's "Vehicle" section: the vehicle's name (nickname, else make and
 * model) with its registration under it, and Change when `onChange` is given.
 * Without a vehicle it offers Choose, or shows nothing when there's nothing to
 * choose from. The vehicle's totals live in the Garage.
 */
export default function VehicleSection({ vehicle, onChange }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  if (!vehicle && !onChange) return null;
  return (
    <>
      <SectionHeader title="Vehicle" />
      <View style={styles.card}>
        <View style={styles.well}>
          <Icon name="directions_car" size={26} color={c.accent} />
        </View>
        <View style={styles.text}>
          <Text style={[type.bodyStrong, styles.name]} numberOfLines={1}>
            {vehicle ? vehicleLabel(vehicle) : 'No vehicle'}
          </Text>
          {vehicle?.registration ? (
            <RegistrationTag registration={vehicle.registration} style={styles.tag} />
          ) : null}
        </View>
        {onChange ? (
          <Pressable
            onPress={onChange}
            accessibilityRole="button"
            accessibilityLabel={vehicle ? 'Change vehicle for this drive' : 'Choose a vehicle'}
            style={({ pressed }) => [styles.change, pressed && styles.pressed]}
          >
            <Text style={[type.button, styles.changeText]}>{vehicle ? 'Change' : 'Choose'}</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const makeStyles = (c) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: radius.card,
    backgroundColor: c.card,
    ...c.cardShadow,
  },
  well: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.accentContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  name: { color: c.text },
  tag: { marginTop: 4 },
  change: { height: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 22 },
  changeText: { color: c.accent },
  pressed: { opacity: 0.6 },
});
