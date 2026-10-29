import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RoadRow from '../components/roads/RoadRow';
import RoadsProgress from '../components/roads/RoadsProgress';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import SectionHeader from '../components/ui/SectionHeader';
import { useSettings } from '../context/SettingsContext';
import { useRoadTotals } from '../hooks/useRoadTotals';
import { useStyles, useTheme } from '../hooks/useTheme';
import { spacing, type } from '../theme';
import { distanceParts, formatShortDate } from '../utils/format';
import { ICONIC_ROADS } from '../utils/iconicRoads';

const COUNTRIES = ['All', ...new Set(ICONIC_ROADS.map((r) => r.country))];

/** "Last completed 5 Nov 2026" when done more than once, else "Completed 5 Nov 2026". */
export const completedOn = ({ count, last }) =>
  `${count > 1 ? 'Last completed' : 'Completed'} ${formatShortDate(last)}`;

function Chip({ label, selected, onPress }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      {selected ? <Icon name="check" size={18} color={c.onAccentContainer} /> : null}
      <Text style={[type.label, selected ? styles.chipTextOn : styles.chipTextOff]}>{label}</Text>
    </Pressable>
  );
}

/** Every Iconic Road: progress, a country filter, then completed and not yet. */
export default function RoadsScreen() {
  const { units } = useSettings();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const totals = useRoadTotals();
  const [country, setCountry] = useState('All');

  const shown = ICONIC_ROADS.filter((r) => country === 'All' || r.country === country);
  const done = shown
    .filter((r) => totals?.has(r.id))
    .sort((a, b) => totals.get(b.id).last - totals.get(a.id).last);
  // Not yet: A to Z, so the list is easy to scan as roads are added.
  const notYet = shown
    .filter((r) => !totals?.has(r.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const open = (road) => router.push(`/roads/${road.id}`);
  const km = (road) => {
    const d = distanceParts(road.lengthM, units);
    return `${d.value} ${d.unit}`;
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <IconButton
        icon="arrow_back"
        variant="plain"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={styles.back}
      />
      <Text style={[type.headline, styles.h1]} role="heading">
        Iconic Roads
      </Text>
      <RoadsProgress
        completed={ICONIC_ROADS.filter((r) => totals?.has(r.id)).length}
        total={ICONIC_ROADS.length}
        style={styles.progress}
      />
      <View style={styles.chips} role="radiogroup">
        {COUNTRIES.map((name) => (
          <Chip
            key={name}
            label={name}
            selected={country === name}
            onPress={() => setCountry(name)}
          />
        ))}
      </View>

      {done.length > 0 ? (
        <>
          <SectionHeader
            variant="label"
            title={`Completed · ${done.length}`}
            style={styles.group}
          />
          <View style={styles.list}>
            {done.map((road) => (
              <RoadRow
                key={road.id}
                completed
                name={road.name}
                subtitle={`${road.region} · ${completedOn(totals.get(road.id))}`}
                onPress={() => open(road)}
              />
            ))}
          </View>
        </>
      ) : null}
      {notYet.length > 0 ? (
        <>
          <SectionHeader
            variant="label"
            title={`Not yet · ${notYet.length}`}
            style={styles.group}
          />
          <View style={styles.list}>
            {notYet.map((road) => (
              <RoadRow
                key={road.id}
                name={road.name}
                subtitle={`${road.region}${road.country === 'Germany' ? ', Germany' : ''} · ${km(road)}`}
                onPress={() => open(road)}
              />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: spacing.md },
  back: { alignSelf: 'flex-start', marginLeft: -spacing.sm },
  h1: { color: c.text, marginHorizontal: 4, marginTop: 4 },
  progress: { marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
  },
  chipOn: { backgroundColor: c.accentContainer },
  chipOff: { borderWidth: 1, borderColor: c.outline },
  chipTextOn: { color: c.onAccentContainer },
  chipTextOff: { color: c.textMuted, fontFamily: type.nav.fontFamily },
  group: { marginTop: 28, marginBottom: 12 },
  list: { gap: 8 },
});
