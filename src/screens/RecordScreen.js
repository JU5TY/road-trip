import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PermissionSheet from '../components/PermissionSheet';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
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
import { dayColorFor, spacing, type } from '../theme';
import { distanceParts, formatDistance, formatDurationShort } from '../utils/format';
import { liveMetrics } from '../utils/geoMath';
import { CONTINUE_WINDOW_MS, dayNumberFor, summarizeDrives, tripTitle } from '../utils/tripSummary';

const GOOGLE_MAPS_NAV_URL = 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
const REFRESH_MS = 1000;
const ROUTE_REFRESH_MS = 10 * 1000;
const ROUTE_POINTS = 400;
const POSITION_DELTA = 0.02; // ~2 km across when centring on the car

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

/** Keeps the screen on while mounted (only while a drive is live and Record is showing). */
function KeepScreenOn() {
  useKeepAwake('record');
  return null;
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
  // Tabs stay mounted in the background; only keep the screen on while Record is showing.
  const focused = useIsFocused();
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
    const lastDay = recent ? dayNumberFor(recent.drives, recent.drives.at(-1).startedAt) : null;
    const lastPlace = recent?.drives.at(-1).places.end;
    return (
      <View style={[styles.screen, styles.readyScreen]}>
        {permissionSheet}
        <View style={[styles.map, styles.mapShrink, { flexBasis: 380 + insets.top }]}>
          <LiveMap route={[]} position={here} centreKey={centreKey} />
          <IconButton
            icon="close"
            variant="floating"
            accessibilityLabel="Close"
            onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
            style={[styles.mapButtonLeft, { top: insets.top + 12 }]}
          />
          {recent && lastPlace ? (
            <View style={[styles.finishedChip, { top: insets.top + 150 }]}>
              <Icon name="flag" filled size={18} color={dayColorFor(c, lastDay)} />
              <Text style={[type.smallStrong, styles.text]} numberOfLines={1}>
                Day {lastDay} finished in {lastPlace}
              </Text>
            </View>
          ) : null}
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
          <View>
            <Text style={[type.title, styles.text, styles.readyTitle]}>Ready to go</Text>
            <Text style={[type.body, styles.muted, styles.readyTitle]}>
              {canContinue ? 'Pick up your trip or start a new one' : 'Starts a new trip'}
            </Text>
          </View>
          {canContinue ? (
            <View style={styles.options} role="radiogroup">
              <TripOption
                icon="play_arrow"
                title={`Continue ${tripTitle(recent) ?? 'last trip'}`}
                subtitle={[
                  `Day ${dayNumberFor(recent.drives, now)}`,
                  ...(lastPlace ? [`from ${lastPlace}`] : []),
                  `${formatDistance(recentSummary.distanceM, units, 0)} so far`,
                ].join(' · ')}
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
              Drive again within 3 days and you can add it as the next day.
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
                labelStyle={styles.startLabel}
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
  const breakDue = breakReminderMinutes > 0 && live.stintMs >= breakDueMs;
  const minimise = () => router.navigate('/');
  const unitWord = units === 'imperial' ? 'miles' : 'km';

  return (
    <View style={styles.screen}>
      {permissionSheet}
      {/* Mid-drive the phone is usually in a mount: don't let the screen sleep. */}
      {focused ? <KeepScreenOn /> : null}
      {!mapHidden ? (
        <View style={[styles.map, styles.mapShrink, { flexBasis: 320 + insets.top }]}>
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
            paddingTop: mapHidden ? insets.top + 20 : 20,
            paddingBottom: insets.bottom + 28,
          },
        ]}
      >
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, status !== 'Recording' && styles.statusPillIdle]}>
            <View style={[styles.statusDot, status !== 'Recording' && styles.statusDotIdle]} />
            <Text style={[type.button, styles.statusText, status !== 'Recording' && styles.text]}>
              {status}
            </Text>
          </View>
          <Text style={[type.body, styles.muted, styles.statusTrip]} numberOfLines={1}>
            {tripLabel ?? ''}
          </Text>
          {mapHidden ? (
            <IconButton
              icon="expand_more"
              variant="record"
              iconSize={26}
              accessibilityLabel="Minimise, keep recording"
              onPress={minimise}
              style={styles.minimiseHidden}
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
          style={[styles.hero, mapHidden && styles.heroHidden]}
          accessible
          accessibilityLabel={`Distance ${distance.value} ${unitWord}`}
        >
          <Text
            style={mapHidden ? styles.heroBig : styles.heroValue}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {distance.value}
          </Text>
          <Text style={mapHidden ? styles.heroBigUnit : styles.heroUnit}>{unitWord}</Text>
        </View>

        <View style={styles.liveStats}>
          <View
            style={styles.liveStat}
            accessible
            accessibilityLabel={`Driving ${formatDurationShort(live.drivingMs)}`}
          >
            <Text style={[type.stat, styles.liveValue]}>{formatDurationShort(live.drivingMs)}</Text>
            <Text style={[type.bodyLarge, styles.muted]}>driving</Text>
          </View>
          <View style={styles.liveDivider} />
          <View
            style={styles.liveStat}
            accessible
            accessibilityLabel={`Since break ${formatDurationShort(live.stintMs)}`}
          >
            <Text style={[type.stat, styles.liveValue]}>{formatDurationShort(live.stintMs)}</Text>
            <Text style={[type.bodyLarge, styles.muted]}>since break</Text>
          </View>
        </View>

        {breakReminderMinutes > 0 ? (
          <View style={[styles.breakBox, breakDue && styles.breakBoxDue]}>
            <View style={styles.breakTitle}>
              <Icon name="local_cafe" size={20} color={breakDue ? c.onWarningContainer : c.text} />
              <Text style={[type.bodyStrong, breakDue ? styles.onWarning : styles.text]}>
                {breakDue
                  ? 'Time for a break'
                  : `Break in ${formatDurationShort(breakDueMs - live.stintMs)}`}
              </Text>
            </View>
            <View style={[styles.breakTrack, breakDue && styles.breakTrackDue]}>
              <View
                style={[
                  styles.breakFill,
                  breakDue && styles.breakFillDue,
                  { width: `${Math.min(100, Math.max(2, (live.stintMs / breakDueMs) * 100))}%` },
                ]}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.flex} />
        <View style={styles.controls}>
          <IconButton
            icon="near_me"
            variant="record"
            size={64}
            iconSize={28}
            label="Maps"
            labelStyle={styles.controlLabel}
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
              size={96}
              iconSize={48}
              label="Stop"
              labelStyle={styles.controlLabel}
              style={styles.flex}
              accessibilityLabel="Stop recording"
              onPress={stop}
            />
          )}
          <IconButton
            icon={mapHidden ? 'map' : 'visibility_off'}
            variant="record"
            size={64}
            iconSize={28}
            labelStyle={styles.controlLabel}
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
  screen: { flex: 1, backgroundColor: c.screen },
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

  readyScreen: { backgroundColor: c.background },
  finishedChip: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '60%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: c.floating,
    ...c.cardShadow,
  },
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
    borderRadius: 12,
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
    paddingHorizontal: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 24,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 32,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 16,
    backgroundColor: c.recordingPill,
  },
  statusPillIdle: { backgroundColor: c.track },
  statusText: { color: c.onRecordingPill },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.stop },
  statusDotIdle: { backgroundColor: c.textMuted },
  statusTrip: { flex: 1 },
  expoGo: { marginHorizontal: 4 },
  hero: { alignItems: 'center', marginTop: 14 },
  heroHidden: { marginTop: 56 },
  heroValue: {
    ...type.hero,
    fontSize: 104,
    lineHeight: 99,
    letterSpacing: -3,
    color: c.textStrong,
  },
  heroUnit: { ...type.statUnit, fontSize: 20, color: c.textMuted },
  heroBig: { ...type.hero, fontSize: 152, lineHeight: 144, letterSpacing: -5, color: c.textStrong },
  heroBigUnit: { ...type.statUnit, fontSize: 26, color: c.textMuted, marginTop: 4 },
  liveStats: { flexDirection: 'row', alignItems: 'center', marginTop: 28 },
  liveStat: { flex: 1, alignItems: 'center' },
  liveValue: { color: c.textStrong, fontSize: 40, lineHeight: 48 },
  liveDivider: { width: 1, height: 56, backgroundColor: c.outline },
  breakBox: { gap: 10, marginTop: 20, paddingVertical: 12, paddingHorizontal: 14 },
  breakBoxDue: { borderRadius: 12, backgroundColor: c.warningContainer },
  breakTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onWarning: { color: c.onWarningContainer },
  breakTrack: { height: 8, borderRadius: 4, backgroundColor: c.recordControl, overflow: 'hidden' },
  breakTrackDue: { backgroundColor: 'rgba(0,0,0,0.12)' },
  breakFill: { height: 8, borderRadius: 4, backgroundColor: c.accent },
  breakFillDue: { backgroundColor: c.dayColors[0] },
  controls: { flexDirection: 'row', alignItems: 'flex-start' },
  sideControl: { flex: 1, paddingTop: 16 },
  controlLabel: { fontSize: 15, lineHeight: 20 },
  startLabel: { fontSize: 14, lineHeight: 20 },
  minimiseHidden: { margin: -8, marginLeft: 0 },
  stopBusy: { flex: 1, height: 124 },
});
