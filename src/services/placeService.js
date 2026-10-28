// Human-readable place names ("Manchester → Edinburgh", "Tebay Services") via the
// phone's reverse geocoder. Looked up after a trip ends and cached on the trip;
// lookups that fail (offline) are retried the next time the trip is viewed.
import * as Location from 'expo-location';

import { getTripEndpoints, saveTripPlaces } from '../storage/tripStorage';

const inFlight = new Map(); // tripId -> Promise<places>

/** Town-level name for a trip's start or end. */
function townName(addr) {
  return addr.city || addr.district || addr.subregion || addr.region || addr.name || null;
}

/** For rest stops, prefer a named place (e.g. a service area) over the town. */
function stopName(addr) {
  const town = townName(addr);
  const named =
    addr.name &&
    addr.name !== addr.street &&
    addr.name !== addr.streetNumber &&
    addr.name !== town &&
    !/^\d/.test(addr.name); // skip bare street addresses like "12 High St"
  return named ? (town ? `${addr.name}, ${town}` : addr.name) : town;
}

/** Resolves to a name, '' when the place has no name, or undefined on failure (retry later). */
async function lookup(coord, toName) {
  try {
    const [addr] = await Location.reverseGeocodeAsync({
      latitude: coord.latitude,
      longitude: coord.longitude,
    });
    return (addr && toName(addr)) || '';
  } catch (err) {
    console.warn('[places] reverse geocode failed', err.message);
    return undefined;
  }
}

async function resolvePlaces(trip, { includeStops }) {
  const places = { ...trip.places, stops: [...(trip.places.stops ?? [])] };
  let changed = false;

  if (places.start === undefined || places.end === undefined) {
    const ends = await getTripEndpoints(trip.id);
    if (!ends) return places;
    if (places.start === undefined) places.start = await lookup(ends.first, townName);
    if (places.end === undefined) places.end = await lookup(ends.last, townName);
    changed = true;
  }

  if (includeStops) {
    // Sequential on purpose: the OS geocoders rate-limit bursts.
    for (const [i, stop] of trip.stats.stops.entries()) {
      // JSON turns undefined array slots into null, so null also means "retry".
      if (places.stops[i] == null) {
        const name = await lookup(stop, stopName);
        if (name !== undefined) {
          places.stops[i] = name;
          changed = true;
        }
      }
    }
  }

  // JSON drops undefined values, so failed lookups are retried next time.
  if (changed) await saveTripPlaces(trip.id, places);
  return places;
}

/**
 * Make sure a completed trip has place names, looking up any that are missing.
 * Resolves to the trip's places: { start, end, stops: [] }.
 */
export function ensureTripPlaces(trip, { includeStops = false } = {}) {
  const key = `${trip.id}:${includeStops}`;
  if (!inFlight.has(key)) {
    const job = resolvePlaces(trip, { includeStops }).finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  return inFlight.get(key);
}

/** "Manchester → Edinburgh", "Manchester" for a round trip, or null if unknown. */
export function routeLabel(places) {
  const { start, end } = places ?? {};
  if (!start && !end) return null;
  if (start && end && start !== end) return `${start} → ${end}`;
  return start || end;
}
