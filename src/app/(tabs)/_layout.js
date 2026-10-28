import { Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import Icon from '../../components/ui/Icon';
import { useActiveDrive } from '../../hooks/useActiveDrive';
import { useStyles, useTheme } from '../../hooks/useTheme';
import { type } from '../../theme';

const ICONS = {
  index: 'home',
  record: 'radio_button_checked',
  trips: 'route',
  settings: 'person',
};

/**
 * Material 3 navigation bar. Hidden while Record is showing a live drive, so
 * recording is full screen. Expo Router passes { state, descriptors, emitter,
 * navigateToTab, insets } (not a `navigation` object); this mirrors its built-in tab bar.
 */
function TabBar({ state, descriptors, emitter, navigateToTab, insets }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const { drive } = useActiveDrive();
  if (drive && state.routes[state.index].name === 'record') return null;

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <View style={styles.row} role="tablist">
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const { title } = descriptors[route.key].options;
          const color = focused ? c.onNavPill : c.textMuted;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
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
              <View style={[styles.pill, focused && styles.pillActive]}>
                <Icon name={ICONS[route.name] ?? 'home'} size={24} color={color} filled={focused} />
              </View>
              <Text style={[focused ? type.navActive : type.nav, { color }]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      // Each tab draws its own large title.
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="record" options={{ title: 'Record' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
      <Tabs.Screen name="settings" options={{ title: 'You' }} />
    </Tabs>
  );
}

const makeStyles = (c) => ({
  wrap: { backgroundColor: c.navBar },
  row: { flexDirection: 'row', height: 80, alignItems: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  pill: {
    width: 64,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden', // Android drew the pill square without it
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: c.navPill },
});
