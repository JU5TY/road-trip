// Chart series derived from a drive's GPS points ({ latitude, longitude,
// altitude, speed, timestamp }, oldest first). Pure functions: raw fixes are
// noisy, so values are smoothed and thinned to a few hundred chart points.
// Every datum keeps its coordinates so a chart can highlight it on the map.
import { haversineDistance } from './geoMath';

const GAP_MS = 30 * 1000; // no fixes for this long = stationary (phones go quiet when parked)
const STATIONARY_MPS = 5 / 3.6;
const MAX_PLAUSIBLE_SPEED_MPS = 90;

/** Centered moving average of `y` over `window` points (odd), leaving other fields alone. */
function smooth(data, window) {
  const half = Math.floor(window / 2);
  return data.map((d, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(data.length - 1, i + half); j++) {
      sum += data[j].y;
      n++;
    }
    return { ...d, y: sum / n };
  });
}

/** Keep about `max` evenly spaced points plus any flagged `keep` (and the last). */
function thin(data, max) {
  if (data.length <= max) return data;
  const step = Math.ceil(data.length / max);
  return data.filter((d, i) => d.keep || i % step === 0 || i === data.length - 1);
}

const toDatum = (p, x, y, extra = {}) => ({
  x,
  y,
  latitude: p.latitude,
  longitude: p.longitude,
  ...extra,
});

/**
 * Elevation against distance: [{ x: metres from start (+ offsetM), y: altitude m }].
 * Points without altitude still count towards distance.
 */
export function elevationSeries(points, { offsetM = 0, maxPoints = 200 } = {}) {
  const data = [];
  let distance = offsetM;
  points.forEach((p, i) => {
    if (i > 0) distance += haversineDistance(points[i - 1], p);
    if (p.altitude !== null && p.altitude !== undefined) data.push(toDatum(p, distance, p.altitude));
  });
  // GPS altitude jumps by several metres between fixes; average it out.
  return thin(smooth(data, 9), maxPoints);
}

/** Speed of a point: the GPS-reported value, or derived from the previous fix. */
function speedAt(points, i) {
  const p = points[i];
  if (p.speed !== null && p.speed !== undefined) return p.speed;
  if (i === 0) return 0;
  const prev = points[i - 1];
  const dt = (p.timestamp - prev.timestamp) / 1000;
  return dt > 0 ? haversineDistance(prev, p) / dt : 0;
}

/**
 * Speed against time: [{ x: timestamp, y: m/s }]. Gaps longer than GAP_MS (rest
 * stops, parked) are drawn as zero speed rather than a line straight across.
 */
export function speedSeries(points, { maxPoints = 240 } = {}) {
  const data = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev && p.timestamp - prev.timestamp > GAP_MS) {
      data.push(toDatum(prev, prev.timestamp + 1, 0, { keep: true }));
      data.push(toDatum(p, p.timestamp - 1, 0, { keep: true }));
    }
    data.push(toDatum(p, p.timestamp, Math.min(speedAt(points, i), MAX_PLAUSIBLE_SPEED_MPS)));
  });
  // ~10 s average; then pin the gap markers back to 0 so stops stay flat.
  const smoothed = smooth(data, 5).map((d) => (d.keep ? { ...d, y: 0 } : d));
  return thin(smoothed, maxPoints);
}

/** Speed band thresholds (m/s) and labels per unit system. */
function bandDefinitions(units) {
  if (units === 'imperial') {
    const mph = 0.44704;
    return [
      { label: 'Under 30 mph', max: 30 * mph },
      { label: '30–55 mph', max: 55 * mph },
      { label: 'Over 55 mph', max: Infinity },
    ];
  }
  return [
    { label: 'Under 50 km/h', max: 50 / 3.6 },
    { label: '50–90 km/h', max: 90 / 3.6 },
    { label: 'Over 90 km/h', max: Infinity },
  ];
}

/**
 * Time spent moving in each speed band, across one or more drives' points.
 * Stationary time and gaps are left out. Returns [{ label, ms, fraction }].
 */
export function speedBands(pointLists, units) {
  const bands = bandDefinitions(units).map((b) => ({ ...b, ms: 0 }));
  for (const points of pointLists) {
    for (let i = 1; i < points.length; i++) {
      const dt = points[i].timestamp - points[i - 1].timestamp;
      if (dt <= 0 || dt > GAP_MS) continue;
      const v = (speedAt(points, i - 1) + speedAt(points, i)) / 2;
      if (v < STATIONARY_MPS || v > MAX_PLAUSIBLE_SPEED_MPS) continue;
      bands.find((b) => v < b.max).ms += dt;
    }
  }
  const total = bands.reduce((sum, b) => sum + b.ms, 0);
  return bands.map(({ label, ms }) => ({ label, ms, fraction: total > 0 ? ms / total : 0 }));
}
