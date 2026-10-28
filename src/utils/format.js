// Display formatting for trip metrics. Stored data is always SI (meters, m/s,
// ms); `units` ('metric' | 'imperial') only changes how values are shown.

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

export const distanceUnit = (units) => (units === 'imperial' ? 'mi' : 'km');
export const speedUnit = (units) => (units === 'imperial' ? 'mph' : 'km/h');

/** Meters -> km or miles. */
export const toDistance = (meters, units) =>
  meters / (units === 'imperial' ? METERS_PER_MILE : 1000);

/** m/s -> km/h or mph. */
export const toSpeed = (mps, units) =>
  (mps ?? 0) * (units === 'imperial' ? 3600 / METERS_PER_MILE : 3.6);

export const formatDistance = (meters, units, digits = 1) =>
  `${toDistance(meters, units).toFixed(digits)} ${distanceUnit(units)}`;

export const formatSpeed = (mps, units) =>
  `${Math.round(toSpeed(mps, units))} ${speedUnit(units)}`;

/** Elevation in meters, or feet when imperial. */
export function formatElevation(m, units) {
  if (m === null || m === undefined) return '—';
  return units === 'imperial' ? `${Math.round(m * FEET_PER_METER)} ft` : `${Math.round(m)} m`;
}

/** 3725000 -> "1:02:05" */
export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 3725000 -> "1h 2m" (coarser, for summaries) */
export function formatDurationShort(ms) {
  const totalMin = Math.round(Math.max(0, ms) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const formatDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
