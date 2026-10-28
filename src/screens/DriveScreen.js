import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import ActionSheet from '../components/ActionSheet';
import DriveBody from '../components/DriveBody';
import MoveDriveSheet from '../components/MoveDriveSheet';
import { useSettings } from '../context/SettingsContext';
import { ensureDrivePlaces } from '../services/placeService';
import { deleteDrive, getDrive, getDrivePoints } from '../storage/driveStorage';
import { getTrip } from '../storage/tripStorage';
import { colors, spacing } from '../theme';
import { formatDate, formatDayDate } from '../utils/format';
import { dayNumberFor, routeLabel, tripTitle } from '../utils/tripSummary';

/** One drive (a single START→STOP recording) inside a multi-drive trip. */
export default function DriveScreen() {
  const { id } = useLocalSearchParams();
  const { units } = useSettings();
  const [drive, setDrive] = useState(null);
  const [points, setPoints] = useState(null);
  const [trip, setTrip] = useState(null);
  const [menu, setMenu] = useState(null); // null | 'options' | 'move'
  const scrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await getDrive(Number(id));
      if (cancelled || !d) return;
      const [p, t] = await Promise.all([getDrivePoints(d.id), getTrip(d.tripId)]);
      if (cancelled) return;
      setDrive(d);
      setPoints(p);
      setTrip(t);
      const places = await ensureDrivePlaces(d, { includeStops: true });
      if (!cancelled) setDrive((prev) => ({ ...prev, places }));
    })().catch((err) => console.warn('[drive] load failed', err));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!drive || !points || !trip) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const multi = trip.drives.length > 1;
  const earlier = trip.drives.filter((d) => d.startedAt < drive.startedAt);
  const dayNumber = dayNumberFor(earlier, drive.startedAt);
  const title = multi ? `Day ${dayNumber} · ${formatDayDate(drive.startedAt)}` : formatDate(drive.startedAt);

  const confirmDelete = () => {
    setMenu(null);
    Alert.alert('Delete this drive?', 'Its route and stats will be removed from the trip.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteDrive(drive.id).then(() => router.back()),
      },
    ]);
  };

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable onPress={() => setMenu('options')} hitSlop={12}>
              <Text style={styles.headerAction}>Options</Text>
            </Pressable>
          ),
        }}
      />
      <ActionSheet
        visible={menu === 'options'}
        title="Drive options"
        actions={[
          { label: 'Move to another trip', onPress: () => setMenu('move') },
          { label: 'Delete drive', style: 'destructive', onPress: confirmDelete },
        ]}
        onClose={() => setMenu(null)}
      />
      <MoveDriveSheet
        visible={menu === 'move'}
        drive={drive}
        allowNewTrip={multi}
        onMoved={(tripId) => router.replace(`/trips/${tripId}`)}
        onClose={() => setMenu(null)}
      />

      <View>
        {multi && tripTitle(trip) ? <Text style={styles.tripName}>{tripTitle(trip)}</Text> : null}
        {routeLabel(drive.places) ? (
          <Text style={styles.route}>{routeLabel(drive.places)}</Text>
        ) : null}
      </View>

      <DriveBody
        drive={drive}
        points={points}
        units={units}
        onShowMap={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  headerAction: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  tripName: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  route: { color: colors.text, fontSize: 20, fontWeight: '700' },
});
