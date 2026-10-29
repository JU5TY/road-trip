import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PermissionSheet from '../components/PermissionSheet';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import StatCard from '../components/ui/StatCard';
import { useSettings } from '../context/SettingsContext';
import { useStyles, useTheme } from '../hooks/useTheme';
import {
  canTrackInBackground,
  getLocationAccess,
  requestLocationAccess,
  startDrive,
  stopDrive,
} from '../services/locationService';
import { getActiveDrive, getDriveRoutePreview } from '../storage/driveStorage';
import { getContinuableTrip, getTrip } from '../storage/tripStorage';
import { spacing, type } from '../theme';
import { distanceParts, formatDistance, formatDuration } from '../utils/format';
import { liveMetrics } from '../utils/geoMath';
import { CONTINUE_WINDOW_MS, dayNumberFor, summarizeDrives, tripTitle } from '../utils/tripSummary';

const GOOGLE_MAPS_NAV_URL = 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
const REFRESH_MS = 1000;
const ROUTE_REFRESH_MS = 10 * 1000;
const ROUTE_POINTS = 400;
const POSITION_DELTA = 0.02; // ~2 km across when centring on the car
const BREAK_CARD_LEAD_MS = 15 * 60 * 1000; // show the break card this long before a break is due

/**
 * Map for Record: the live route so far and the phone's position. Centres on
 * the latest fix (or the route) when asked through `centreKey`. With `follow`,
 * it also tracks each new fix until the map is moved by hand.
 */
function LiveMap({ route, position, centreKey, follow = false }) {
  const { scheme, c } = useTheme();
  const mapRef = useRef(null);
  const followingRef = useRef(true);

  useEffect(() => {
    if (!position) return;
    followingRef.current = true;
    mapRef.current?.animateToRegion(
      { ...position, latitudeDelta: POSITION_DELTA, longitudeDelta: POSITION_DELTA },
      500
    );
    // Zoom back in only when asked (or on the first fix), not on every new fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centreKey, Boolean(position)]);

  // Keep the car in view as fixes arrive, at whatever zoom is set.
  const latitude = position?.latitude;
  const longitude = position?.longitude;
  useEffect(() => {
    if (!follow || latitude == null || !followingRef.current) return;
    mapRef.current?.animateCamera({ center: { latitude, longitude } }, { duration: 500 });
  }, [follow, latitude, longitude]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      userInterfaceStyle={scheme}
      // Panning or zooming by hand pauses following until the centre button is tapped.
      // isGesture is only reported by Google Maps (Android); Apple Maps keeps following.
      onRegionChangeStart={(_, details) => {
        if (details?.isGesture) followingRef.current = false;
      }}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}
      initialRegion={
        position
          ? { ...position, latitudeDelta: POSITION_DELTA, longitudeDelta: POSITION_DELTA }
          : undefined
      }
    >
      {route.length > 1 ? (
        <Polyline coordinates={route} strokeColor={c.accent} strokeWidth={5} />
      ) : null}
    </MapView>
  );
}

/** Radio card for picking the trip on the Ready screen. */
function TripOption({ icon, title, subtitle, selected, onPress }) {
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.option, selected && styles.optionOn]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <Icon name={icon} filled size={24} color={selected ? c.onAccentContainer : c.textMuted} />
      <View style={styles.flex}>
        <Text
          style={[type.bodyStrong, selected ? styles.onContainer : styles.text]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[type.small, selected ? styles.onContainerMuted : styles.muted]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      <Icon
        name={selected ? 'radio_button_checked' : 'radio_button_unchecked'}
        filled={selected}
        size={24}
        color={selected ? c.accent : c.textMuted}
      />
    </Pressable>
  );
}

export default function RecordScreen() {
  const { continueTripId, start } = useLocalSearchParams();
  const { units, breakReminderMinutes } = useSettings();
  const { c } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [drive, setDrive] = useState(null); // the active drive, if recording
  // { driveId, text }, e.g. "Scotland 2026 · Day 2" for the active drive.
  const [tripLabelFor, setTripLabelFor] = useState(null);
  // { driveId, points }: the live route so far, thinned.
  const [routeFor, setRouteFor] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [foregroundOnly, setForegroundOnly] = useState(false);
  const [sheet, setSheet] = useState(null); // PermissionSheet kind, or null
  const [recent, setRecent] = useState(null); // trip that can be continued, if any
  const [choice, setChoice] = useState('continue'); // 'continue' | 'new'
  const [mapHidden, setMapHidden] = useState(false);
  const [centreKey, setCentreKey] = useState(0);
  const [here, setHere] = useState(null); // last known position, for the Ready map

  // Trip chosen before the permission check (null = new trip).
  const chosenTripRef = useRef(null);

  // Expo Go can only record while the app is open; warn while recording there.
  useEffect(() => {
    canTrackInBackground().then((ok) => setForegroundOnly(!ok));
  }, []);

  // The background task writes to SQLite; poll it once a second while visible.
  // Also refresh the trip that Ready offers to continue.
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
      getContinuableTrip(CONTINUE_WINDOW_MS)
        .then((trip) => !cancelled && setRecent(trip))
        .catch(() => {});
      // Centre the Ready map on the phone, without asking for access just for that.
      getLocationAccess()
        .then((access) => (access.granted ? Location.getLastKnownPositionAsync() : null))
        .then(
          (pos) =>
            !cancelled &&
            pos &&
            setHere({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        )
        .catch(() => {});
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
        setTripLabelFor({
          driveId: activeId,
          text: `${tripTitle(trip) ?? 'New trip'} · Day ${day}`,
        });
      })
      .catch((err) => console.warn('[record] trip label failed', err));
    return () => {
      cancelled = true;
    };
  }, [activeId, activeTripId, activeStartedAt]);

  // The route drawn so far; refreshed less often than the numbers.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    const load = () =>
      getDriveRoutePreview(activeId, ROUTE_POINTS)
        .then((points) => !cancelled && setRouteFor({ driveId: activeId, points }))
        .catch((err) => console.warn('[record] route failed', err));
    load();
    const id = setInterval(load, ROUTE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeId]);

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

  const beginDrive = (tripId) =>
    run(async () => {
      const res = await startDrive({ tripId });
      setDrive(res.drive);
    });

  /** Start recording into `tripId` (null = new trip), once location access is sorted. */
  const startRecording = async (tripId) => {
    chosenTripRef.current = tripId;
    // Explain before (or instead of) the system prompt; start straight away once allowed.
    const access = await getLocationAccess();
    if (!access.granted) return setSheet(access.canAskAgain ? 'ask' : 'blocked');
    if (!access.precise) return setSheet('approximate');
    return beginDrive(tripId);
  };

  const stop = () =>
    run(async () => {
      const driveId = await stopDrive();
      setDrive(null);
      setMapHidden(false);
      if (driveId) router.push(`/saved/${driveId}`);
    });

  // Home's "Start a trip" / "Continue …" land here with what to record.
  useEffect(() => {
    if (!continueTripId && !start) return;
    router.setParams({ continueTripId: undefined, start: undefined });
    getActiveDrive()
      .then((active) => {
        if (!active) startRecording(continueTripId ? Number(continueTripId) : null);
      })
      .catch((err) => console.warn('[record] start failed', err));
    // startRecording is recreated each render; only the params matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueTripId, start]);

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
    return beginDrive(chosenTripRef.current);
  };

  const onSheetSecondary = () => {
    const kind = sheet;
    setSheet(null);
    if (kind === 'approximate') beginDrive(chosenTripRef.current);
  };

  const openGoogleMaps = () =>
    Linking.openURL(GOOGLE_MAPS_NAV_URL).catch(() =>
      Alert.alert('Google Maps', 'Could not open Google Maps.')
    );

  const live = drive ? liveMetrics(drive, now) : null;
  const lastFix = drive?.stats.lastFix;
  const position = lastFix ? { latitude: lastFix.latitude, longitude: lastFix.longitude } : null;
  const permissionSheet = (
    <PermissionSheet kind={sheet} onPrimary={onSheetPrimary} onSecondary={onSheetSecondary} />
  );

  // ---- Ready: pick the trip and start.
  if (!drive) {
    const canContinue = Boolean(recent);
    const continuing = canContinue && choice === 'continue';
    const recentSummary = recent ? summarizeDrives(recent.drives) : null;
    return (
      <View style={styles.screen}>
        {permissionSheet}
        <View style={[styles.map, styles.mapShrink, { flexBasis: 380 + insets.top }]}>
          <LiveMap route={[]} position={here} centreKey={centreKey} />
          {here ? (
            <IconButton
              icon="my_location"
              variant="floating"
              accessibilityLabel="Centre on my position"
              onPress={() => setCentreKey((k) => k + 1)}
              style={[styles.mapButtonRight, { top: insets.top + 12 }]}
            />
          ) : null}
        </View>
        <View style={styles.readyBody}>
          <Text style={[type.title, styles.text, styles.readyTitle]}>Ready to go</Text>
          {canContinue ? (
            <View style={styles.options} role="radiogroup">
              <TripOption
                icon="play_arrow"
                title={`Continue ${tripTitle(recent) ?? 'last trip'}`}
                subtitle={`Day ${dayNumberFor(recent.drives, now)} · ${formatDistance(recentSummary.distanceM, units, 0)} so far`}
                selected={continuing}
                onPress={() => setChoice('continue')}
              />
              <TripOption
                icon="add_location_alt"
                title="New trip"
                subtitle="Start a fresh trip"
                selected={!continuing}
                onPress={() => setChoice('new')}
              />
            </View>
          ) : (
            <Text style={[type.body, styles.muted, styles.readyHint]}>
              Starts a new trip. Drive again within 3 days and you can add it as the next day.
            </Text>
          )}
          <View style={styles.startWrap}>
            {busy ? (
              <ActivityIndicator color={c.accent} style={styles.startBusy} />
            ) : (
              <IconButton
                icon="play_arrow"
                filled
                variant="filled"
                size={80}
                iconSize={40}
                label="Start"
                accessibilityLabel={
                  continuing ? `Start day ${dayNumberFor(recent.drives, now)}` : 'Start a new trip'
                }
                onPress={() => startRecording(continuing ? recent.id : null)}
              />
            )}
          </View>
        </View>
      </View>
    );
  }

  // ---- Recording: full screen, no nav bar.
  const tripLabel = tripLabelFor && tripLabelFor.driveId === activeId ? tripLabelFor.text : null;
  const route = routeFor && routeFor.driveId === activeId ? routeFor.points : [];
  const status = !live.hasFix
    ? 'Waiting for GPS'
    : live.waitingToSetOff
      ? 'Waiting to set off'
      : live.isAutoPaused
        ? 'Paused'
        : 'Recording';
  const distance = distanceParts(live.distanceM, units);
  // The break card only appears as a break comes due; until then it would match Driving time.
  const breakDueMs = breakReminderMinutes * 60000;
  const breakNear = breakReminderMinutes > 0 && live.stintMs >= breakDueMs - BREAK_CARD_LEAD_MS;
  const breakDue = breakReminderMinutes > 0 && live.stintMs >= breakDueMs;
  const minimise = () => router.navigate('/');

  return (
    <View style={styles.screen}>
      {permissionSheet}
      {!mapHidden ? (
        <View style={[styles.map, styles.mapShrink, { flexBasis: 370 + insets.top }]}>
          <LiveMap route={route} position={position} centreKey={centreKey} follow />
          <IconButton
            icon="expand_more"
            iconSize={26}
            variant="floating"
            accessibilityLabel="Minimise, keep recording"
            onPress={minimise}
            style={[styles.mapButtonLeft, { top: insets.top + 12 }]}
          />
          <IconButton
            icon="my_location"
            variant="floating"
            accessibilityLabel="Centre on my position"
            onPress={() => setCentreKey((k) => k + 1)}
            style={[styles.mapButtonRight, { top: insets.top + 12 }]}
          />
        </View>
      ) : null}

      <View
        style={[
          styles.recordBody,
          {
            paddingTop: mapHidden ? insets.top + spacing.md : spacing.lg,
            paddingBottom: insets.bottom + 36,
          },
        ]}
      >
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, status !== 'Recording' && styles.statusDotIdle]} />
          <Text style={[type.label, styles.text]}>{status}</Text>
          <Text style={[type.label, styles.muted, styles.statusTrip]} numberOfLines={1}>
            {tripLabel ? `· ${tripLabel}` : ''}
          </Text>
          {mapHidden ? (
            <IconButton
              icon="expand_more"
              iconSize={26}
              accessibilityLabel="Minimise, keep recording"
              onPress={minimise}
            />
          ) : null}
        </View>

        {foregroundOnly ? (
          <Text style={[type.small, styles.muted, styles.expoGo]}>
            Expo Go records only while the app is open. Use a development build for background
            tracking.
          </Text>
        ) : null}

        <View
          style={mapHidden ? styles.heroCentred : styles.hero}
          accessible
          accessibilityLabel={`Distance ${distance.value} ${distance.unit}`}
        >
          <Text
            style={mapHidden ? styles.heroBig : styles.heroValue}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {distance.value}
          </Text>
          <Text style={mapHidden ? styles.heroBigUnit : styles.heroUnit}>{distance.unit}</Text>
        </View>

        <View style={styles.cards}>
          <StatCard
            style={styles.half}
            tone="accent"
            icon="schedule"
            label="Driving time"
            value={formatDuration(live.drivingMs)}
          />
          {breakNear ? (
            <StatCard
              style={styles.half}
              notch
              tone={breakDue ? 'warning' : 'surface'}
              icon="local_cafe"
              label={breakDue ? 'Time for a break' : 'Since break'}
              value={formatDuration(live.stintMs)}
            />
          ) : null}
        </View>

        <View style={styles.controls}>
          <IconButton
            icon="near_me"
            size={56}
            iconSize={26}
            label="Maps"
            onPress={openGoogleMaps}
            style={styles.sideControl}
          />
          {busy ? (
            <ActivityIndicator color={c.stop} style={styles.stopBusy} />
          ) : (
            <IconButton
              icon="stop"
              filled
              variant="stop"
              size={80}
              iconSize={38}
              label="Stop"
              accessibilityLabel="Stop recording"
              onPress={stop}
            />
          )}
          <IconButton
            icon={mapHidden ? 'map' : 'visibility_off'}
            size={56}
            iconSize={26}
            label={mapHidden ? 'Show map' : 'Hide map'}
            onPress={() => setMapHidden((h) => !h)}
            style={styles.sideControl}
          />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  map: { borderBottomWidth: 1, borderBottomColor: c.outline, backgroundColor: c.surface },
  // Design height, but the map gives way on shorter screens so the controls keep their spacing.
  mapShrink: { flexGrow: 0, flexShrink: 1, minHeight: 180 },
  mapButtonLeft: { position: 'absolute', left: 12 },
  mapButtonRight: { position: 'absolute', right: 12 },
  flex: { flex: 1, minWidth: 0 },
  text: { color: c.text },
  muted: { color: c.textMuted },
  onContainer: { color: c.onAccentContainer },
  onContainerMuted: { color: c.accentContainerMuted },

  readyBody: {
    flexGrow: 1,
    flexShrink: 0,
    gap: 24, // minimum spacing when space-between has nothing to share
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 20,
  },
  readyTitle: { marginHorizontal: 4 },
  readyHint: { marginHorizontal: 4 },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.outline,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionOn: {
    backgroundColor: c.accentContainer,
    borderWidth: 2,
    borderColor: c.accent,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  startWrap: { alignItems: 'center' },
  startBusy: { height: 108 },

  recordBody: {
    flexGrow: 1,
    flexShrink: 0,
    gap: 20, // minimum spacing when space-between has nothing to share
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 4,
    minHeight: 24,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.finish },
  statusDotIdle: { backgroundColor: c.textMuted },
  statusTrip: { flex: 1, fontFamily: type.nav.fontFamily },
  expoGo: { marginHorizontal: 4 },
  hero: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginHorizontal: 4 },
  heroValue: { ...type.hero, color: c.text, flexShrink: 1 },
  heroUnit: { ...type.title, fontFamily: type.bodyLarge.fontFamily, color: c.textMuted },
  heroCentred: { alignItems: 'center', marginTop: 24 },
  heroBig: { ...type.hero, fontSize: 136, lineHeight: 136, letterSpacing: -4, color: c.text },
  heroBigUnit: {
    ...type.title,
    fontFamily: type.bodyLarge.fontFamily,
    fontSize: 28,
    color: c.textMuted,
    marginTop: 8,
  },
  cards: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, paddingVertical: 16 },
  controls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around' },
  sideControl: { paddingTop: 12 },
  stopBusy: { width: 80, height: 108 },
});
