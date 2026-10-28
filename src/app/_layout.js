// Importing locationService defines the background location task at module
// load. Must stay the first import so the task exists when the OS launches the
// app headless.
import { resumeActiveDrive } from '../services/locationService';

import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SettingsProvider } from '../context/SettingsContext';
import { colors } from '../theme';

export default function RootLayout() {
  // On launch: if a drive was left recording (app killed, phone rebooted), make
  // sure tracking is running again and open the Record tab instead of Home.
  useEffect(() => {
    resumeActiveDrive()
      .then((res) => {
        if (res) router.navigate('/record');
      })
      .catch((err) => console.warn('[app] resume failed', err));
  }, []);

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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trips/[id]" options={{ title: 'Trip' }} />
        <Stack.Screen name="drives/[id]" options={{ title: 'Drive' }} />
      </Stack>
    </SettingsProvider>
  );
}
