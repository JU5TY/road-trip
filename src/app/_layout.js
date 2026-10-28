// Defines the background location task at module load. Must stay the first
// import so the task exists when the OS launches the app headless.
import '../services/locationService';

import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import { SettingsProvider } from '../context/SettingsContext';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Road Trip',
            headerRight: () => (
              <Link href="/settings" hitSlop={12}>
                <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>Settings</Text>
              </Link>
            ),
          }}
        />
        <Stack.Screen name="trips/index" options={{ title: 'Past Trips' }} />
        <Stack.Screen name="trips/[id]" options={{ title: 'Trip' }} />
        <Stack.Screen name="drives/[id]" options={{ title: 'Drive' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </SettingsProvider>
  );
}
