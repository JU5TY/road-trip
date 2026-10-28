import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionSheet from '../components/ActionSheet';
import PermissionSheet from '../components/PermissionSheet';
import { useSettings } from '../context/SettingsContext';
import {
  getLocationAccess,
  requestLocationAccess,
  resumeActiveDrive,
  startDrive,
  stopDrive,
} from '../services/locationService';
import { getActiveDrive } from '../storage/driveStorage';
import { getContinuableTrip, getTrip } from '../storage/tripStorage';
import { colors, radius, spacing } from '../theme';
import {
  distanceUnit,
  formatDuration,
  formatElevation,
  speedUnit,
  toDistance,
  toSpeed,
} from '../utils/format';
import { liveMetrics } from '../utils/geoMath';
import { dayNumberFor, tripTitle } from '../utils/tripSummary';

const GOOGLE_MAPS_NAV_URL = 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
const REFRESH_MS = 1000;
// Offer "Continue" when the last drive ended within this long.
const CONTINUE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function Metric({ label, value, unit, large }) {
  return (
    <View style={[styles.metric, large && styles.metricLarge]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, large && styles.metricValueLarge]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { units } = useSettings();
  const [drive, setDrive] = useState(null); // the active drive, if recording
  // { driveId, text }, e.g. "Scotland 2026 · Day 2" for the active drive.
  const [tripLabelFor, setTripLabelFor] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [foregroundOnly, setForegroundOnly] = useState(false);
  const [sheet, setSheet] = useState(null); // PermissionSheet kind, or null
  const [continueOffer, setContinueOffer] = useState(null); // { trip, dayNumber }

  // Restart tracking if the app was killed mid-drive.
  useEffect(() => {
    resumeActiveDrive()
      .then((res) => res && setForegroundOnly(!res.background))
      .catch((err) => console.warn('[dashboard] resume failed', err));
  }, []);

  // The background task writes to SQLite; poll it once a second while visible.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const tick = async () => {
        const active = await getActiveDrive();
        if (!cancelled) {
          setDrive(active);
          setNow(Date.now());
        }
      };
      tick();
      const id = setInterval(tick, REFRESH_MS);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }, [])
  );

  // Which trip and day the active drive belongs to.
  const activeId = drive?.id;
  const activeTripId = drive?.tripId;
  const activeStartedAt = drive?.startedAt;
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    getTrip(activeTripId)
      .then((trip) => {
        if (cancelled || !trip) return;
        const day = dayNumberFor(trip.drives, activeStartedAt);
        setTripLabelFor({ driveId: activeId, text: `${tripTitle(trip) ?? 'New trip'} · Day ${day}` });
      })
      .catch((err) => console.warn('[dashboard] trip label failed', err));
    return () => {
      cancelled = true;
    };
  }, [activeId, activeTripId, activeStartedAt]);

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      Alert.alert('Road Trip', err.message);
    } finally {
      setBusy(false);
    }
  };

  const beginDrive = (tripId = null) =>
    run(async () => {
      const res = await startDrive({ tripId });
      setDrive(res.drive);
      setForegroundOnly(!res.background);
    });

  /** Offer to continue a recent trip, otherwise start a new one. */
  const chooseTripAndStart = async () => {
    const recent = await getContinuableTrip(CONTINUE_WINDOW_MS).catch(() => null);
    if (!recent) return beginDrive(null);
    setContinueOffer({ trip: recent, dayNumber: dayNumberFor(recent.drives, Date.now()) });
  };

  const onToggle = async () => {
    if (drive) {
      return run(async () => {
        await stopDrive();
        setDrive(null);
        setForegroundOnly(false);
      });
    }
    // Explain before (or instead of) the system prompt; start straight away once allowed.
    const access = await getLocationAccess();
    if (!access.granted) return setSheet(access.canAskAgain ? 'ask' : 'blocked');
    if (!access.precise) return setSheet('approximate');
    return chooseTripAndStart();
  };

  const onSheetPrimary = async () => {
    const kind = sheet;
    setSheet(null);
    if (kind !== 'ask') {
      Linking.openSettings();
      return;
    }
    const access = await requestLocationAccess();
    if (!access.granted) {
      // A first "Don't allow" just closes; after that only Settings can help.
      if (!access.canAskAgain) setSheet('blocked');
      return;
    }
    if (!access.precise) return setSheet('approximate');
    return chooseTripAndStart();
  };

  const onSheetSecondary = () => {
    const kind = sheet;
    setSheet(null);
    if (kind === 'approximate') chooseTripAndStart();
  };

  const startFromOffer = (tripId) => {
    setContinueOffer(null);
    beginDrive(tripId);
  };

  const openGoogleMaps = () =>
    Linking.openURL(GOOGLE_MAPS_NAV_URL).catch(() =>
      Alert.alert('Google Maps', 'Could not open Google Maps.')
    );

  const tripLabel = tripLabelFor && tripLabelFor.driveId === activeId ? tripLabelFor.text : null;
  const live = drive ? liveMetrics(drive, now) : null;
  const active = Boolean(drive);
  const offerTitle = continueOffer
    ? (tripTitle(continueOffer.trip) ?? 'your last trip')
    : null;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <PermissionSheet kind={sheet} onPrimary={onSheetPrimary} onSecondary={onSheetSecondary} />
      <ActionSheet
        visible={Boolean(continueOffer)}
        title="Start recording"
        actions={
          continueOffer
            ? [
                {
                  label: `Continue “${offerTitle}”`,
                  detail: `Day ${continueOffer.dayNumber}`,
                  style: 'primary',
                  onPress: () => startFromOffer(continueOffer.trip.id),
                },
                { label: 'Start a new trip', onPress: () => startFromOffer(null) },
              ]
            : []
        }
        onClose={() => setContinueOffer(null)}
      />
      <View style={styles.status}>
        <View style={[styles.dot, { backgroundColor: active ? colors.start : colors.textMuted }]} />
        <Text style={styles.statusText}>
          {!active
            ? 'Ready'
            : !live.hasFix
              ? 'Waiting for GPS…'
              : live.waitingToSetOff
                ? 'Recording · waiting to set off'
                : live.isAutoPaused
                  ? 'Auto-paused · rest stop'
                  : 'Recording'}
        </Text>
      </View>
      {tripLabel ? (
        <Text style={styles.tripLabel} numberOfLines={1}>
          {tripLabel}
        </Text>
      ) : null}

      {foregroundOnly && active ? (
        <Text style={styles.warning}>
          Expo Go: tracking only while the app is open. Use a development build for background
          tracking.
        </Text>
      ) : null}

      <Metric
        large
        label="CURRENT SPEED"
        value={live ? Math.round(toSpeed(live.currentSpeedMps, units)) : 0}
        unit={speedUnit(units)}
      />
      <View style={styles.grid}>
        <Metric
          label="DISTANCE"
          value={toDistance(live?.distanceM ?? 0, units).toFixed(2)}
          unit={distanceUnit(units)}
        />
        <Metric label="ELAPSED" value={live ? formatDuration(live.elapsedMs) : '0:00'} />
      </View>
      <View style={styles.grid}>
        <Metric label="ELEVATION" value={live ? formatElevation(live.currentAltitudeM, units) : '—'} />
        <Metric label="SINCE BREAK" value={live ? formatDuration(live.stintMs) : '—'} />
      </View>

      <View style={styles.spacer} />

      <Pressable
        onPress={onToggle}
        disabled={busy}
        style={({ pressed }) => [
          styles.toggle,
          { backgroundColor: active ? colors.stop : colors.start },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.toggleText}>{active ? 'STOP TRIP' : 'START TRIP'}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={openGoogleMaps}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        accessibilityRole="link"
      >
        <Text style={styles.secondaryText}>Open Google Maps Navigation</Text>
      </Pressable>
      <Link href="/trips" asChild>
        <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>Past Trips</Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.sm },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  tripLabel: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.xs },
  warning: {
    color: colors.accent,
    fontSize: 13,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  grid: { flexDirection: 'row', gap: spacing.sm },
  metric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  metricLarge: { flex: 0, alignItems: 'center', paddingVertical: spacing.lg },
  metricLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  metricValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  metricValueLarge: { fontSize: 72 },
  metricUnit: { fontSize: 16, color: colors.textMuted, fontWeight: '600' },
  spacer: { flex: 1 },
  toggle: {
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  secondary: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
