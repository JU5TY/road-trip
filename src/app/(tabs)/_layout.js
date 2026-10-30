import { Tabs, router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '../../components/ui/Icon';
import { useActiveDrive } from '../../hooks/useActiveDrive';
import { useStyles, useTheme } from '../../hooks/useTheme';
import { getContinuableTrip } from '../../storage/tripStorage';
import { type } from '../../theme';
import { CONTINUE_WINDOW_MS, dayNumberFor } from '../../utils/tripSummary';

const ICONS = { index: 'home', trips: 'route', settings: 'person' };
const NAV_HEIGHT = 80;

/**
 * Bottom navigation: Home, Trips, You. Record isn't a tab; it opens from the
 * floating pill (RecordPill) and runs full screen. Expo Router passes { state,
 * descriptors, emitter, navigateToTab, insets } (not a `navigation` object).
 */
function TabBar({ state, descriptors, emitter, navigateToTab, insets }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  if (state.routes[state.index].name === 'record') return null;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.row} role="tablist">
        {state.routes.map((route, i) => {
          if (!ICONS[route.name]) return null;
          const focused = state.index === i;
          const { title } = descriptors[route.key].options;
          const color = focused ? c.onNavPill : c.textMuted;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={title}
            >
              <View style={styles.iconBox}>
                <Icon name={ICONS[route.name]} size={24} color={color} filled={focused} />
              </View>
              <Text style={[type.nav, { color }]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Floating pill above the nav on Home and Trips: "Continue Day 4" (a recent
 * trip), "Start a trip", or just the red dot while a drive is recording.
 * All open Record.
 */
function RecordPill() {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { drive } = useActiveDrive();
  const [continueDay, setContinueDay] = useState(null);

  // Re-check on each tab change, so a trip that just ended shows "Continue".
  useEffect(() => {
    let cancelled = false;
    getContinuableTrip(CONTINUE_WINDOW_MS)
      .then((trip) => !cancelled && setContinueDay(trip ? dayNumberFor(trip.drives, Date.now()) : null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (pathname !== '/' && pathname !== '/trips') return null;
  const label = drive ? null : continueDay ? `Continue Day ${continueDay}` : 'Start a trip';

  return (
    <Pressable
      onPress={() => router.navigate('/record')}
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Open recording'}
      style={({ pressed }) => [
        styles.pill,
        !label && styles.pillRound,
        { bottom: NAV_HEIGHT + insets.bottom + 16 },
        pressed && styles.pressed,
      ]}
    >
      <Icon name="radio_button_checked" filled size={26} color={c.stop} />
      {label ? <Text style={[type.button, styles.pillText]}>{label}</Text> : null}
    </Pressable>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        // Each tab draws its own large title.
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
        <Tabs.Screen name="settings" options={{ title: 'You' }} />
        <Tabs.Screen name="record" options={{ title: 'Record' }} />
      </Tabs>
      <RecordPill />
    </View>
  );
}

const makeStyles = (c) => ({
  bar: { backgroundColor: c.navBar, borderTopWidth: 1, borderTopColor: c.navBorder },
  row: { flexDirection: 'row', height: NAV_HEIGHT, alignItems: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  iconBox: { width: 64, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    right: 16,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 22,
    backgroundColor: c.floating,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  pillRound: { width: 56, paddingLeft: 0, paddingRight: 0, justifyContent: 'center' },
  pillText: { color: c.text },
  pressed: { opacity: 0.85 },
});
