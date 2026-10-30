import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showMessage } from '../components/ui/DialogHost';
import PermissionSheet from '../components/PermissionSheet';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import { useSettings } from '../context/SettingsContext';
import { useStyles, useTheme } from '../hooks/useTheme';
import {
  canTrackInBackground,
  discardDrive,
  getLocationAccess,
  pauseDrive,
  requestLocationAccess,
  resumeDrive,
  startDrive,
  stopDrive,
} from '../services/locationService';
import { getActiveDrive, getDriveRoutePreview } from '../storage/driveStorage';
import { getRecordMapHidden, setRecordMapHidden } from '../storage/settingsStorage';
import { getContinuableTrip, getTrip } from '../storage/tripStorage';
import { spacing, type } from '../theme';
import { driveGaps, routeSegments } from '../utils/crossings';
import { formatDistance, formatDurationShort, speedUnit, toSpeed } from '../utils/format';
import { liveMetrics } from '../utils/geoMath';
import { CONTINUE_WINDOW_MS, dayNumberFor, summarizeDrives, tripTitle } from '../utils/tripSummary';

const GOOGLE_MAPS_NAV_URL = 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
const REFRESH_MS = 1000;
const ROUTE_REFRESH_MS = 10 * 1000;
const ROUTE_POINTS = 400;
const POSITION_DELTA = 0.02; // ~2 km across when centring on the car
const BREAK_SOON_MS = 30 * 60 * 1000; // the break bar shows this long before a break is due

/**
 * Map for Record: the live route so far (`segments`, pauses dotted) and the
 * phone's position. Centres on the latest fix (or the route) when asked through
 * `centreKey`. With `follow`, it also tracks each new fix until the map is moved by hand.
 */
function LiveMap({ segments = [], position, centreKey, follow = false }) {
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
      {segments.map((s) => (
        <Polyline
          key={s.key}
          coordinates={s.coordinates}
          strokeColor={c.accent}
          strokeWidth={5}
          {...(s.dotted ? { lineDashPattern: [1, 10], lineCap: 'round' } : null)}
        />
      ))}
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
  // Remembered between drives.
  const [mapHidden, setMapHiddenState] = useState(getRecordMapHidden);
  const setMapHidden = (hidden) => {
    setMapHiddenState(hidden);
    setRecordMapHidden(hidden).catch((err) => console.warn('[record] save failed', err));
  };
  const [confirmingStop, setConfirmingStop] = useState(false);
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
        const name = tripTitle(trip) ?? 'New trip';
        // Day 1 (or a one-day trip) is just the trip's name.
        setTripLabelFor({ driveId: activeId, text: day > 1 ? `${name} · Day ${day}` : name });
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
      showMessage('Something went wrong', err.message);
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
      if (driveId) router.push(`/saved/${driveId}`);
    });

  // Nothing recorded: no drive to save, back to Ready.
  const discard = () =>
    run(async () => {
      await discardDrive();
      setDrive(null);
    });

  // Pause stops GPS; the gap is drawn dotted and isn't counted as driving.
  const pause = () =>
    run(async () => {
      const paused = await pauseDrive();
      if (paused) setDrive(paused);
    });
  const resume = () =>
    run(async () => {
      const resumed = await resumeDrive();
      if (resumed) setDrive(resumed);
    });

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
      showMessage('Google Maps', 'Couldn’t open Google Maps.')
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
    const lastPlace = recent?.drives.at(-1).places.end;
    return (
      <View style={[styles.screen, styles.readyScreen]}>
        {permissionSheet}
        <View style={[styles.map, styles.mapShrink, { flexBasis: 380 + insets.top }]}>
          <LiveMap position={here} centreKey={centreKey} />
          <IconButton
            icon="close"
            variant="floating"
            accessibilityLabel="Close"
            onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
            style={[styles.mapButtonLeft, { top: insets.top + 12 }]}
          />
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
  const paused = live.isPaused;
  const status = paused
    ? 'Paused'
    : !live.hasFix
      ? 'Waiting for GPS'
      : live.waitingToSetOff
        ? 'Waiting to set off'
        : live.isAutoPaused
          ? 'Stopped'
          : 'Recording';
  const speed = paused ? 0 : Math.round(toSpeed(live.currentSpeedMps, units));
  const distance = formatDistance(live.distanceM, units);
  const driving = formatDurationShort(live.drivingMs);
  // Break bar: hidden until the last BREAK_SOON_MS before a break is due, then
  // counts down in blue; once due it fills orange and counts up.
  const breakDueMs = breakReminderMinutes * 60000;
  const breakSoon = breakReminderMinutes > 0 && live.stintMs >= breakDueMs - BREAK_SOON_MS;
  const breakDue = breakSoon && live.stintMs >= breakDueMs;
  const overdueMs = live.stintMs - breakDueMs;
  // Trips shows the "Recording · 1h 12m" banner to come back.
  const minimise = () => router.navigate('/trips');

  return (
    <View style={styles.screen}>
      {permissionSheet}
      {live.distanceM > 0 ? (
        <ConfirmDialog
          visible={confirmingStop}
          title="Save this drive?"
          highlight={`${distance} · ${driving}`}
          message="Drive again within 3 days to continue this trip."
          confirmLabel="Save"
          onCancel={() => setConfirmingStop(false)}
          onConfirm={() => {
            setConfirmingStop(false);
            stop();
          }}
        />
      ) : (
        <ConfirmDialog
          visible={confirmingStop}
          title="Nothing recorded yet"
          message="You haven’t moved yet, so there’s no drive to save."
          confirmLabel="Discard"
          destructive
          onCancel={() => setConfirmingStop(false)}
          onConfirm={() => {
            setConfirmingStop(false);
            discard();
          }}
        />
      )}
      {/* Mid-drive the phone is usually in a mount: don't let the screen sleep. */}
      {focused ? <KeepScreenOn /> : null}
      {!mapHidden ? (
        <View style={[styles.map, styles.mapShrink, { flexBasis: 320 + insets.top }]}>
          <LiveMap
            segments={routeSegments('live', route, driveGaps(drive), c.accent)}
            position={position}
            centreKey={centreKey}
            follow
          />
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
          <IconButton
            icon="visibility_off"
            variant="floating"
            accessibilityLabel="Hide map"
            onPress={() => setMapHidden(true)}
            style={[styles.mapButtonRight, styles.mapButtonBottom]}
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
          {paused ? (
            <View style={[styles.statusPill, styles.statusPillPaused]}>
              <Icon name="pause" filled size={18} color={c.onWarningContainer} />
              <Text style={[type.button, styles.onWarning]}>Paused</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, status !== 'Recording' && styles.statusPillIdle]}>
              <View style={[styles.statusDot, status !== 'Recording' && styles.statusDotIdle]} />
              <Text style={[type.button, styles.statusText, status !== 'Recording' && styles.text]}>
                {status}
              </Text>
            </View>
          )}
          <Text style={[type.body, styles.muted, styles.statusTrip]} numberOfLines={1}>
            {tripLabel ?? ''}
          </Text>
          {mapHidden ? (
            <>
              <IconButton
                icon="map"
                variant="record"
                accessibilityLabel="Show map"
                onPress={() => setMapHidden(false)}
                style={styles.rowButton}
              />
              <IconButton
                icon="expand_more"
                variant="record"
                iconSize={26}
                accessibilityLabel="Minimise, keep recording"
                onPress={minimise}
                style={[styles.rowButton, styles.rowButtonLast]}
              />
            </>
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
          accessibilityLabel={`Speed ${speed} ${speedUnit(units)}`}
        >
          <Text style={mapHidden ? styles.heroBig : styles.heroValue} numberOfLines={1}>
            {speed}
          </Text>
          <Text style={mapHidden ? styles.heroBigUnit : styles.heroUnit}>{speedUnit(units)}</Text>
        </View>

        <View style={styles.liveStats}>
          <View style={styles.liveStat} accessible accessibilityLabel={`Distance ${distance}`}>
            <Text style={[type.stat, styles.liveValue]} numberOfLines={1} adjustsFontSizeToFit>
              {distance}
            </Text>
            <Text style={styles.liveLabel}>distance</Text>
          </View>
          <View style={styles.liveDivider} />
          <View style={styles.liveStat} accessible accessibilityLabel={`Driving ${driving}`}>
            <Text style={[type.stat, styles.liveValue]} numberOfLines={1} adjustsFontSizeToFit>
              {driving}
            </Text>
            <Text style={styles.liveLabel}>driving</Text>
          </View>
        </View>

        {breakSoon ? (
          <View style={styles.breakBox}>
            <View style={styles.breakTitle}>
              <Icon
                name="local_cafe"
                filled={breakDue}
                size={20}
                color={breakDue ? c.breakDue : c.text}
              />
              <Text style={[type.bodyStrong, styles.text, styles.flex]}>
                {!breakDue
                  ? `Break in ${formatDurationShort(breakDueMs - live.stintMs)}`
                  : overdueMs < 60000
                    ? 'Break due now'
                    : `Break ${formatDurationShort(overdueMs)} overdue`}
              </Text>
            </View>
            <View style={styles.breakTrack}>
              <View
                style={[
                  styles.breakFill,
                  breakDue && styles.breakFillDue,
                  { width: `${Math.min(100, (live.stintMs / breakDueMs) * 100)}%` },
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
            <ActivityIndicator color={c.accent} style={styles.centreBusy} />
          ) : paused ? (
            <IconButton
              icon="play_arrow"
              filled
              variant="filled"
              size={80}
              iconSize={44}
              label="Resume"
              labelStyle={styles.controlLabel}
              style={styles.flex}
              onPress={resume}
            />
          ) : (
            <IconButton
              icon="pause"
              filled
              variant="pause"
              size={80}
              iconSize={40}
              label="Pause"
              labelStyle={styles.controlLabel}
              style={styles.flex}
              onPress={pause}
            />
          )}
          <IconButton
            icon="stop"
            filled
            variant="stop"
            size={64}
            iconSize={32}
            label="Stop"
            labelStyle={styles.controlLabel}
            accessibilityLabel="Stop recording"
            onPress={() => setConfirmingStop(true)}
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
  mapButtonBottom: { bottom: 12 },
  flex: { flex: 1, minWidth: 0 },
  text: { color: c.text },
  muted: { color: c.textMuted },
  onContainer: { color: c.onAccentContainer },
  onContainerMuted: { color: c.accentContainerMuted },

  readyScreen: { backgroundColor: c.background },
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
  statusPillPaused: { gap: 6, paddingLeft: 10, backgroundColor: c.warningContainer },
  statusText: { color: c.onRecordingPill },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.stop },
  statusDotIdle: { backgroundColor: c.textMuted },
  statusTrip: { flex: 1 },
  expoGo: { marginHorizontal: 4 },
  hero: { alignItems: 'center', marginTop: 28 },
  heroHidden: { marginTop: 64 },
  heroValue: {
    fontFamily: type.stat.fontFamily,
    fontSize: 72,
    lineHeight: 72,
    letterSpacing: -2,
    color: c.textStrong,
  },
  heroUnit: { ...type.bodyStrong, color: c.textMuted },
  heroBig: {
    fontFamily: type.stat.fontFamily,
    fontSize: 120,
    lineHeight: 120,
    letterSpacing: -2,
    color: c.textStrong,
  },
  heroBigUnit: { ...type.statUnit, fontSize: 20, color: c.textMuted },
  liveStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  liveStat: { flex: 1, alignItems: 'center' },
  liveValue: { color: c.textStrong },
  liveLabel: { ...type.body, fontSize: 14, lineHeight: 20, color: c.textMuted },
  liveDivider: { width: 1, height: 40, backgroundColor: c.outline },
  breakBox: { gap: 10, marginTop: 32 },
  breakTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onWarning: { color: c.onWarningContainer },
  breakTrack: { height: 8, borderRadius: 4, backgroundColor: c.recordControl, overflow: 'hidden' },
  breakFill: { height: 8, borderRadius: 4, backgroundColor: c.accent },
  breakFillDue: { backgroundColor: c.breakDue },
  controls: { flexDirection: 'row', alignItems: 'flex-start' },
  // Centres the 64 circles on the 80 one.
  sideControl: { flex: 1, paddingTop: 8 },
  controlLabel: { fontSize: 15, lineHeight: 20 },
  startLabel: { fontSize: 14, lineHeight: 20 },
  rowButton: { marginVertical: -8 },
  rowButtonLast: { marginRight: -8 },
  centreBusy: { flex: 1, height: 108 },
});
