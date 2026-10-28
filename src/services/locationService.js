// Background GPS tracking. This module MUST be imported at app start-up (see
// src/app/_layout.js) so the TaskManager task is defined before the OS wakes the
// app in the background to deliver locations.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import {
  appendFixes,
  completeTrip,
  createTrip,
  getActiveTrip,
  getTrip,
} from '../storage/tripStorage';
import { applyFixes, finalizeStats, isUsableFix, toFix } from '../utils/geoMath';
import { ensureTripPlaces } from './placeService';

export const LOCATION_TRACKING_TASK = 'LOCATION_TRACKING_TASK';

const TRACKING_OPTIONS = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 10, // meters
  timeInterval: 2000, // ms, Android only
  // While in the background, deliver fixes in batches instead of waking the
  // app for every one. The metrics engine already handles batches.
  deferredUpdatesInterval: 15000,
  // iOS: keep delivering updates while Google Maps (or anything else) is in front.
  activityType: Location.ActivityType.AutomotiveNavigation,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  // Android: a foreground service keeps the process alive while minimised.
  // Because tracking starts while the app is open, this (and iOS's background
  // indicator) works with "While using the app" permission alone; "Allow all
  // the time" is never needed.
  foregroundService: {
    notificationTitle: 'Road trip in progress',
    notificationBody: 'Recording your route in the background.',
    notificationColor: '#F2A93B',
    killServiceOnDestroy: false,
  },
};

// Location batches can arrive faster than SQLite writes finish; process them
// strictly in order so stats are never computed from a stale snapshot.
let queue = Promise.resolve();
function enqueue(job) {
  const run = queue.then(job);
  queue = run.catch((err) => console.warn('[locationService]', err));
  return run;
}

function handleLocations(locations) {
  return enqueue(async () => {
    const trip = await getActiveTrip();
    if (!trip) return;
    const fixes = locations.map(toFix).filter(isUsableFix);
    if (fixes.length === 0) return;
    const stats = applyFixes(trip.stats, fixes);
    await appendFixes(trip.id, fixes, stats);
  });
}

TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[locationService] task error', error.message);
    return;
  }
  if (data?.locations?.length) {
    await handleLocations(data.locations);
  }
});

// Foreground fallback for Expo Go, where TaskManager/background location is
// unavailable. Tracks only while the app is open.
let foregroundSubscription = null;

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

async function canUseBackgroundTask() {
  if (IS_EXPO_GO) return false;
  try {
    return await TaskManager.isAvailableAsync();
  } catch {
    return false;
  }
}

function toAccess(res) {
  const precise =
    Platform.OS === 'android' ? res.android?.accuracy === 'fine' : res.ios?.accuracy !== 'reduced';
  return { granted: res.status === 'granted', canAskAgain: res.canAskAgain, precise };
}

/** Current location permission: { granted, canAskAgain, precise }. Never prompts. */
export async function getLocationAccess() {
  return toAccess(await Location.getForegroundPermissionsAsync());
}

/** Show the system location prompt. Resolves to the same shape as getLocationAccess. */
export async function requestLocationAccess() {
  return toAccess(await Location.requestForegroundPermissionsAsync());
}

async function startUpdates() {
  if (!(await getLocationAccess()).granted) {
    throw new Error('Location access is needed to record a trip.');
  }
  if (await canUseBackgroundTask()) {
    if (!(await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK))) {
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, TRACKING_OPTIONS);
    }
    return { background: true };
  }
  if (!foregroundSubscription) {
    foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: TRACKING_OPTIONS.accuracy,
        distanceInterval: TRACKING_OPTIONS.distanceInterval,
        timeInterval: TRACKING_OPTIONS.timeInterval,
      },
      (location) => handleLocations([location])
    );
  }
  return { background: false };
}

async function stopUpdates() {
  foregroundSubscription?.remove();
  foregroundSubscription = null;
  if (
    (await canUseBackgroundTask()) &&
    (await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK))
  ) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
  }
}

/**
 * Start a new trip and begin recording. Location permission must already be
 * granted (see the dashboard's permission sheet). Returns { trip, background }.
 */
export async function startTrip() {
  const existing = await getActiveTrip();
  // Start updates before creating the trip so a failure leaves no empty trip behind.
  const { background } = await startUpdates();
  const trip = existing ?? (await createTrip());
  return { trip, background };
}

/** Stop recording and close out the active trip. Returns the completed trip id. */
export async function stopTrip() {
  await stopUpdates();
  // Wait for any in-flight batch so the final stats include it.
  return enqueue(async () => {
    const trip = await getActiveTrip();
    if (!trip) return null;
    const endedAt = Date.now();
    await completeTrip(trip.id, endedAt, finalizeStats(trip.stats));
    // Look up place names now while we're likely online; failures retry later.
    getTrip(trip.id)
      .then((completed) => ensureTripPlaces(completed, { includeStops: true }))
      .catch((err) => console.warn('[locationService] place lookup failed', err));
    return trip.id;
  });
}

/**
 * Call on launch: if a trip was left active (app killed, phone rebooted),
 * make sure location updates are running again. Returns { background } or null.
 */
export async function resumeActiveTrip() {
  const trip = await getActiveTrip();
  // Never prompt on launch; if access was revoked the dashboard still shows the trip.
  if (!trip || !(await getLocationAccess()).granted) return null;
  return startUpdates();
}
