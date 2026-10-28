import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RecordingBar from '../../components/RecordingBar';
import { colors, spacing } from '../../theme';

// Icon per tab: [unfocused, focused].
const ICONS = {
  index: ['home-outline', 'home'],
  record: ['radio-button-on-outline', 'radio-button-on'],
  trips: ['list-outline', 'list'],
  settings: ['settings-outline', 'settings'],
};

/** Tab bar with the "● Recording" strip above it on every tab except Record. */
function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index].name;

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      {current !== 'record' ? (
        <RecordingBar onPress={() => navigation.navigate('record')} />
      ) : null}
      <View style={styles.row}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const { title } = descriptors[route.key].options;
          const [outline, filled] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const color = focused ? colors.accent : colors.textMuted;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
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
              <Ionicons name={focused ? filled : outline} size={24} color={color} />
              <Text style={[styles.label, { color }]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'Road Trip' }} />
      <Tabs.Screen name="record" options={{ title: 'Record' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: { flexDirection: 'row', paddingTop: spacing.sm, paddingBottom: spacing.xs },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  label: { fontSize: 11, fontWeight: '600' },
});
