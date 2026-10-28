// Small persisted user preferences (expo-sqlite key-value store). Sync reads so
// the first render already uses the saved values.
import Storage from 'expo-sqlite/kv-store';

const UNITS_KEY = 'settings.units';

/** 'metric' | 'imperial' */
export function getUnits() {
  return Storage.getItemSync(UNITS_KEY) === 'imperial' ? 'imperial' : 'metric';
}

export function setUnits(units) {
  return Storage.setItemAsync(UNITS_KEY, units);
}
