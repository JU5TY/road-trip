import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActionSheet from '../components/ActionSheet';
import ListRow from '../components/ui/ListRow';
import Switch from '../components/ui/Switch';
import SectionHeader from '../components/ui/SectionHeader';
import { useSettings } from '../context/SettingsContext';
import { useRoadTotals } from '../hooks/useRoadTotals';
import { useStyles } from '../hooks/useTheme';
import { BREAK_REMINDER_OPTIONS } from '../storage/settingsStorage';
import { spacing, type } from '../theme';
import { formatBreakReminder } from '../utils/format';
import { ICONIC_ROADS, ROADS_ATTRIBUTION } from '../utils/iconicRoads';

const UNIT_LABELS = { metric: 'Kilometres', imperial: 'Miles' };

/** The "You" tab: preferences and about. Every setting is the same row style. */
export default function SettingsScreen() {
  const {
    units,
    setUnits,
    breakReminderMinutes,
    setBreakReminderMinutes,
    showIconicRoads,
    setShowIconicRoads,
    replayOnboarding,
  } = useSettings();
  const totals = useRoadTotals();
  const completed = totals ? ICONIC_ROADS.filter((r) => totals.has(r.id)).length : 0;
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState(false);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      <ActionSheet
        visible={picking}
        title="Break reminder"
        message="On Record, a Since break card appears 15 minutes before this much driving without a stop, then turns amber."
        actions={BREAK_REMINDER_OPTIONS.map((minutes) => ({
          key: String(minutes),
          label: formatBreakReminder(minutes),
          selected: minutes === breakReminderMinutes,
          onPress: () => {
            setBreakReminderMinutes(minutes);
            setPicking(false);
          },
        }))}
        onClose={() => setPicking(false)}
      />

      <Text style={[type.headline, styles.h1]} role="heading">
        You
      </Text>

      <SectionHeader variant="label" title="Iconic Roads" />
      <ListRow
        icon="verified"
        title="Show Iconic Roads"
        onPress={() => setShowIconicRoads(!showIconicRoads)}
        accessibilityRole="switch"
        accessibilityState={{ checked: showIconicRoads }}
        divider={showIconicRoads}
        right={
          <Switch
            value={showIconicRoads}
            onValueChange={setShowIconicRoads}
            accessibilityLabel="Show Iconic Roads"
          />
        }
      />
      {showIconicRoads ? (
        <ListRow
          icon="emoji_events"
          title="Completed"
          value={`${completed} of ${ICONIC_ROADS.length}`}
          onPress={() => router.push('/roads')}
        />
      ) : (
        <Text style={[type.small, styles.note]}>
          Hidden across the app. Roads you drive are still counted, so nothing is lost.
        </Text>
      )}

      <SectionHeader variant="label" title="Preferences" />
      <ListRow
        icon="straighten"
        title="Units"
        value={UNIT_LABELS[units]}
        onPress={() => setUnits(units === 'imperial' ? 'metric' : 'imperial')}
        divider
      />
      <ListRow
        icon="local_cafe"
        title="Break reminder"
        value={formatBreakReminder(breakReminderMinutes)}
        onPress={() => setPicking(true)}
      />

      <SectionHeader variant="label" title="About" />
      <ListRow icon="lock" title="Privacy" subtitle="Your trips stay on this phone" divider />
      <ListRow icon="map" title="Map data" subtitle={ROADS_ATTRIBUTION} divider />
      <ListRow
        icon="info"
        title="Version"
        value={Constants.expoConfig?.version ?? '—'}
        divider={__DEV__}
      />
      {__DEV__ ? (
        <ListRow
          icon="repeat"
          title="Show Welcome again"
          subtitle="Development builds only"
          onPress={replayOnboarding}
        />
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  h1: { color: c.text, marginHorizontal: 4, marginTop: 8, height: 56, textAlignVertical: 'center' },
  note: { color: c.textMuted, marginHorizontal: 4, marginTop: 4 },
});
