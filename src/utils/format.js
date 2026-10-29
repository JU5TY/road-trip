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

export const formatSpeed = (mps, units) => `${Math.round(toSpeed(mps, units))} ${speedUnit(units)}`;

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

/** "Mon 3 Nov 2026", "3–6 Nov 2026", or "28 Oct – 2 Nov 2026" for a span of days. */
export function formatDateRange(startTs, endTs) {
  const a = new Date(startTs);
  const b = new Date(endTs);
  if (a.toDateString() === b.toDateString()) return formatDate(startTs);
  const day = (d) => d.getDate();
  const month = (d) => d.toLocaleDateString(undefined, { month: 'short' });
  const year = b.getFullYear();
  if (a.getFullYear() !== year) {
    return `${day(a)} ${month(a)} ${a.getFullYear()} – ${day(b)} ${month(b)} ${year}`;
  }
  if (a.getMonth() === b.getMonth()) return `${day(a)}–${day(b)} ${month(b)} ${year}`;
  return `${day(a)} ${month(a)} – ${day(b)} ${month(b)} ${year}`;
}

/** "Mon 3 Nov", without the year, for day headings inside a trip. */
export const formatDayDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const grouped = (n, digits = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Hero distance split for big type: 780 km -> { value: '780', unit: 'km' }; one decimal under 100. */
export function distanceParts(meters, units) {
  const v = toDistance(meters, units);
  return { value: grouped(v, v < 100 ? 1 : 0), unit: distanceUnit(units) };
}

/** Elevation split for stat cards: { value: '4,850', unit: 'm' }, or '—' when unknown. */
export function elevationParts(m, units) {
  if (m === null || m === undefined) return { value: '—', unit: null };
  return units === 'imperial'
    ? { value: grouped(m * FEET_PER_METER), unit: 'ft' }
    : { value: grouped(m), unit: 'm' };
}

/** "3–5 NOV · 3 DAYS" or "SAT 25 OCT · 10:12": the green caps line above a trip's name. */
export function tripKicker(firstStartTs, lastEndTs, dayCount) {
  if (dayCount > 1) {
    const a = new Date(firstStartTs);
    const b = new Date(lastEndTs);
    const month = (d) => d.toLocaleDateString(undefined, { month: 'short' });
    const range =
      a.getMonth() === b.getMonth()
        ? `${a.getDate()}–${b.getDate()} ${month(b)}`
        : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
    return `${range} · ${dayCount} days`.toUpperCase();
  }
  return `${formatDayDate(firstStartTs)} · ${formatTime(firstStartTs)}`.toUpperCase();
}

/** Break reminder setting: 0 -> "Off", 90 -> "Every 1½ hours", 120 -> "Every 2 hours". */
export function formatBreakReminder(minutes) {
  if (!minutes) return 'Off';
  const hours = minutes / 60;
  const whole = Math.floor(hours);
  const text = hours === whole ? String(whole) : `${whole}½`;
  return `Every ${text} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** "5 Nov 2026" */
export const formatShortDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** "Wed 5 Nov 2026" */
export const formatLongDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
