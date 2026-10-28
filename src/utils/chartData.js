// Chart series derived from a drive's GPS points ({ latitude, longitude,
// altitude, speed, timestamp }, oldest first). Pure functions: raw fixes are
// noisy, so values are smoothed and thinned to a few hundred chart points.
// Every datum keeps its coordinates so a chart can highlight it on the map.
import { haversineDistance } from './geoMath';

const GAP_MS = 30 * 1000; // no fixes for this long = stationary (phones go quiet when parked)
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
    if (p.altitude !== null && p.altitude !== undefined)
      data.push(toDatum(p, distance, p.altitude));
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
 * Speed against distance: [{ x: metres from start (+ offsetM), y: m/s }]. A gap
 * longer than GAP_MS (rest stop, parked) breaks the line: the first datum after
 * it has `breakBefore: true`, so stops show as gaps rather than dips to zero.
 */
export function speedByDistanceSeries(points, { offsetM = 0, maxPoints = 240 } = {}) {
  const runs = [];
  let run = [];
  let distance = offsetM;
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev) {
      distance += haversineDistance(prev, p);
      if (p.timestamp - prev.timestamp > GAP_MS && run.length > 0) {
        runs.push(run);
        run = [];
      }
    }
    run.push(toDatum(p, distance, Math.min(speedAt(points, i), MAX_PLAUSIBLE_SPEED_MPS)));
  });
  if (run.length > 0) runs.push(run);
  // ~10 s average within each run, so a stop doesn't blur the speeds around it.
  const data = runs.flatMap((r, i) =>
    smooth(r, 5).map((d, j) => ({
      ...d,
      ...(j === 0 && i > 0 ? { breakBefore: true } : {}),
      ...(j === 0 || j === r.length - 1 ? { keep: true } : {}),
    }))
  );
  return thin(data, maxPoints);
}
