// Importing locationService defines the background location task at module
// load. Must stay the first import so the task exists when the OS launches the
// app headless.
import { resumeActiveDrive } from '../services/locationService';

import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { SettingsProvider, useSettings } from '../context/SettingsContext';
import { useTheme } from '../hooks/useTheme';
import { checkAllDrivesIfNeeded } from '../storage/roadStorage';
import { fontFiles } from '../theme';

function AppStack() {
  const { scheme, c } = useTheme();
  const { onboarded } = useSettings();
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const ready = (fontsLoaded || !!fontError) && onboarded !== null;

  useEffect(() => {
    if (fontError) console.warn('[app] fonts failed to load', fontError);
  }, [fontError]);

  // On launch: if a drive was left recording (app killed, phone rebooted), make
  // sure tracking is running again and open the Record tab instead of Home.
  // Waits until the navigator is mounted before navigating.
  useEffect(() => {
    if (!ready || !onboarded) return;
    resumeActiveDrive()
      .then((res) => {
        if (res) router.navigate('/record');
      })
      .catch((err) => console.warn('[app] resume failed', err));
    // Check past drives against the Iconic Roads list (once per version of the list).
    checkAllDrivesIfNeeded().catch((err) => console.warn('[app] Iconic Roads check failed', err));
  }, [ready, onboarded]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.background }} />;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* Every screen draws its own title or back button. */}
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}
      >
        {/* First launch only: Welcome, then the location explainer. */}
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="permission" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="trips/[id]" />
          <Stack.Screen name="drives/[id]" />
          <Stack.Screen name="saved/[id]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="roads/index" />
          <Stack.Screen name="roads/[id]" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppStack />
    </SettingsProvider>
  );
}
