// Pure trip-metrics engine. No React, no I/O: the background task feeds raw GPS
// fixes into `applyFix`, persists the returned stats object as JSON, and feeds
// it back in on the next batch. Everything here is deterministic and testable.

const EARTH_RADIUS_M = 6371008.8;

// Rest-stop detection: staying within STOP_RADIUS_M of one spot for at least
// STOP_MIN_DURATION_MS. Unlike a speed threshold, this ignores slow-moving
// traffic jams, which keep creeping forward out of the radius.
export const STOP_RADIUS_M = 100;
export const STOP_MIN_DURATION_MS = 5 * 60 * 1000;
const STOP_SPEED_MPS = 5 / 3.6; // used only to classify long GPS gaps

// Top speed must be held at least this long to count.
const TOP_SPEED_SUSTAIN_MS = 3000;

// Noise filters.
const MAX_HORIZONTAL_ACCURACY_M = 50; // discard fixes worse than this
const MAX_ALTITUDE_ACCURACY_M = 25; // ignore altitude worse than this
const MAX_PLAUSIBLE_SPEED_MPS = 90; // ~324 km/h, anything above is a GPS glitch
const ELEVATION_HYSTERESIS_M = 5; // altitude must move this much to count as climb
const LONG_GAP_MS = 30 * 1000; // a gap this long breaks the top-speed window
const STALE_FIX_MS = 20 * 1000; // live "current speed" drops to 0 after this

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in meters between two {latitude, longitude} points. */
export function haversineDistance(a, b) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Normalise an expo-location LocationObject into the flat fix shape we store. */
export function toFix(location) {
  const { coords, timestamp } = location;
  const valid = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const speed = valid(coords.speed);
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    altitude: valid(coords.altitude),
    altitudeAccuracy: valid(coords.altitudeAccuracy),
    accuracy: valid(coords.accuracy),
    // iOS reports -1 when speed is unknown.
    speed: speed !== null && speed >= 0 ? speed : null,
    timestamp,
  };
}

export function createTripStats() {
  return {
    distanceM: 0,
    movingTimeMs: 0,
    topSpeedMps: 0,
    maxAltitudeM: null,
    elevationGainM: 0,
    stopCount: 0,
    totalStopMs: 0,
    stops: [], // [{ startedAt, endedAt, latitude, longitude }]
    currentStintMs: 0, // driving time since the last rest stop
    longestStintMs: 0,
    lastFix: null,
    currentAltitudeM: null,
    // Time spent near one spot. Becomes a rest stop if it lasts long enough;
    // otherwise its time and distance count as driving.
    dwell: null, // { latitude, longitude, startedAt, durationMs, lastInside }
    speedWindow: [], // recent { t, v } samples for sustained top speed
    altitudeRef: null, // reference altitude for hysteresis-based gain
  };
}

export function isUsableFix(fix) {
  return (
    Number.isFinite(fix.latitude) &&
    Number.isFinite(fix.longitude) &&
    (fix.accuracy === null || fix.accuracy <= MAX_HORIZONTAL_ACCURACY_M)
  );
}

function addDriving(stats, ms, meters) {
  const currentStintMs = stats.currentStintMs + ms;
  return {
    ...stats,
    movingTimeMs: stats.movingTimeMs + ms,
    distanceM: stats.distanceM + meters,
    currentStintMs,
    longestStintMs: Math.max(stats.longestStintMs, currentStintMs),
  };
}

/** Distance covered inside a dwell that turned out not to be a stop. */
const dwellDistance = (dwell) => haversineDistance(dwell, dwell.lastInside);

/**
 * Close a dwell. Long ones become rest stops (excluded from moving time, no
 * distance: movement inside the radius is GPS jitter); short ones (traffic
 * lights, queues) count as driving.
 */
function closeDwell(stats, endedAt) {
  const dwell = stats.dwell;
  const next = { ...stats, dwell: null };
  if (!dwell) return next;
  if (dwell.durationMs < STOP_MIN_DURATION_MS) {
    return addDriving(next, dwell.durationMs, dwellDistance(dwell));
  }
  // Idle time before the car has moved at all is not a rest stop.
  if (stats.distanceM === 0) return next;
  return {
    ...next,
    stopCount: stats.stopCount + 1,
    totalStopMs: stats.totalStopMs + dwell.durationMs,
    stops: [
      ...stats.stops,
      {
        startedAt: dwell.startedAt,
        endedAt,
        latitude: dwell.latitude,
        longitude: dwell.longitude,
      },
    ],
    currentStintMs: 0,
  };
}

const openDwell = (fix) => ({
  latitude: fix.latitude,
  longitude: fix.longitude,
  startedAt: fix.timestamp,
  durationMs: 0,
  lastInside: { latitude: fix.latitude, longitude: fix.longitude, timestamp: fix.timestamp },
});

function updateElevation(stats, fix) {
  if (fix.altitude === null) return stats;
  if (fix.altitudeAccuracy !== null && fix.altitudeAccuracy > MAX_ALTITUDE_ACCURACY_M) {
    return stats;
  }
  const next = {
    ...stats,
    currentAltitudeM: fix.altitude,
    maxAltitudeM: stats.maxAltitudeM === null ? fix.altitude : Math.max(stats.maxAltitudeM, fix.altitude),
  };
  if (stats.altitudeRef === null) {
    next.altitudeRef = fix.altitude;
  } else {
    const delta = fix.altitude - stats.altitudeRef;
    if (delta >= ELEVATION_HYSTERESIS_M) {
      next.elevationGainM += delta;
      next.altitudeRef = fix.altitude;
    } else if (delta <= -ELEVATION_HYSTERESIS_M) {
      next.altitudeRef = fix.altitude;
    }
  }
  return next;
}

/**
 * Top speed is the highest speed held for TOP_SPEED_SUSTAIN_MS: the minimum of
 * the samples covering the last few seconds, so a single spike never counts.
 */
function updateTopSpeed(stats, t, v, dtMs) {
  let window = dtMs > LONG_GAP_MS ? [] : [...stats.speedWindow];
  window.push({ t, v });
  while (window.length > 1 && window[1].t <= t - TOP_SPEED_SUSTAIN_MS) window.shift();
  let topSpeedMps = stats.topSpeedMps;
  if (window[window.length - 1].t - window[0].t >= TOP_SPEED_SUSTAIN_MS) {
    topSpeedMps = Math.max(topSpeedMps, Math.min(...window.map((s) => s.v)));
  }
  return { ...stats, speedWindow: window, topSpeedMps };
}

/** Fold one GPS fix into the running stats. Returns a new stats object. */
export function applyFix(stats, fix) {
  if (!isUsableFix(fix)) return stats;
  const prev = stats.lastFix;
  if (prev && fix.timestamp <= prev.timestamp) return stats; // duplicate / out of order

  if (!prev) {
    return { ...updateElevation(stats, fix), lastFix: fix, dwell: openDwell(fix) };
  }

  const dtMs = fix.timestamp - prev.timestamp;
  const segmentM = haversineDistance(prev, fix);
  const derivedSpeed = segmentM / (dtMs / 1000);
  if (derivedSpeed > MAX_PLAUSIBLE_SPEED_MPS) {
    return stats; // position jump: drop the fix
  }

  let next = updateElevation(stats, fix);
  const dwell = next.dwell ?? openDwell(prev);

  if (haversineDistance(dwell, fix) <= STOP_RADIUS_M) {
    // Still near the same spot (or crawling). Decide what it was once we leave.
    next = {
      ...next,
      dwell: {
        ...dwell,
        durationMs: dwell.durationMs + dtMs,
        lastInside: { latitude: fix.latitude, longitude: fix.longitude, timestamp: fix.timestamp },
      },
    };
  } else {
    // A long, slow gap (signal lost while parked, regained down the road) is
    // part of the stop rather than driving.
    const gapIsStop = dtMs >= STOP_MIN_DURATION_MS && derivedSpeed < STOP_SPEED_MPS;
    if (gapIsStop) {
      next = closeDwell(
        { ...next, dwell: { ...dwell, durationMs: dwell.durationMs + dtMs } },
        fix.timestamp
      );
      next.distanceM += segmentM;
    } else {
      next = addDriving(closeDwell({ ...next, dwell }, prev.timestamp), dtMs, segmentM);
    }
    next.dwell = openDwell(fix);
  }

  const speed = fix.speed ?? derivedSpeed;
  if (speed <= MAX_PLAUSIBLE_SPEED_MPS) {
    next = updateTopSpeed(next, fix.timestamp, speed, dtMs);
  }

  return { ...next, lastFix: fix };
}

/** Fold a batch of fixes, oldest first. */
export function applyFixes(stats, fixes) {
  // Fill in fields added after a trip was started with an older version.
  const base = { ...createTripStats(), ...stats };
  return [...fixes].sort((a, b) => a.timestamp - b.timestamp).reduce(applyFix, base);
}

/**
 * Close out a trip. A short dwell still open at the end counts as driving; a
 * long one (parked before pressing STOP) is excluded but is not a rest stop.
 */
export function finalizeStats(stats) {
  const { dwell } = stats;
  const next = { ...stats, dwell: null, speedWindow: [] };
  if (dwell && dwell.durationMs < STOP_MIN_DURATION_MS) {
    return addDriving(next, dwell.durationMs, dwellDistance(dwell));
  }
  return next;
}

/** Moving average speed in m/s (distance / moving drive time). */
export function averageMovingSpeed(stats) {
  return stats.movingTimeMs > 0 ? stats.distanceM / (stats.movingTimeMs / 1000) : 0;
}

/** Overall average speed in m/s (distance / total elapsed time, stops included). */
export function averageOverallSpeed(trip) {
  const elapsedMs = (trip.endedAt ?? Date.now()) - trip.startedAt;
  return elapsedMs > 0 ? trip.stats.distanceM / (elapsedMs / 1000) : 0;
}

/** Driving time since the last rest stop, including a short dwell still in progress. */
export function drivingSinceBreakMs(stats) {
  const pending = stats.dwell && stats.dwell.durationMs < STOP_MIN_DURATION_MS ? stats.dwell.durationMs : 0;
  return (stats.currentStintMs ?? 0) + pending;
}

/** Live view of an in-progress trip, evaluated at `now`. */
export function liveMetrics(trip, now = Date.now()) {
  const { stats, startedAt } = trip;
  const last = stats.lastFix;
  const fresh = last && now - last.timestamp < STALE_FIX_MS;
  // iOS sends no fixes while parked, so time since the last fix counts as dwelling.
  const dwellMs = (stats.dwell?.durationMs ?? 0) + (last ? now - last.timestamp : 0);
  const isAutoPaused = Boolean(last) && dwellMs >= STOP_MIN_DURATION_MS;
  // Include the not-yet-classified dwell so the numbers don't lag behind.
  const pending = stats.dwell && !isAutoPaused ? stats.dwell : null;
  return {
    currentSpeedMps: fresh ? last.speed ?? 0 : 0,
    distanceM: stats.distanceM + (pending ? dwellDistance(pending) : 0),
    elapsedMs: now - startedAt,
    currentAltitudeM: stats.currentAltitudeM,
    stintMs: isAutoPaused ? 0 : drivingSinceBreakMs(stats),
    isAutoPaused,
    hasFix: Boolean(last),
  };
}

/** Thin a long track to at most `maxPoints` for rendering, always keeping the endpoints. */
export function downsample(points, maxPoints = 2000) {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => points[Math.round(i * step)]);
}
