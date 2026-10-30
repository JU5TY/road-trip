// Countries: which countries each drive went through, saved on the drive
// (drives.countries). The borders themselves are bundled (src/utils/countries.js).
import Storage from 'expo-sqlite/kv-store';

import { COUNTRIES_VERSION, detectCountries } from '../utils/countries';
import { getDb } from './db';
import { getDrivePoints } from './driveStorage';

const CHECKED_KEY = 'countries.checkedVersion';

/** Work out one completed drive's countries and save them. Returns the visits. */
export async function checkDriveCountries(driveId) {
  const points = await getDrivePoints(driveId);
  const visits = detectCountries(points);
  const db = await getDb();
  await db.runAsync(
    'UPDATE drives SET countries = ? WHERE id = ?',
    JSON.stringify(visits),
    driveId
  );
  return visits;
}

/**
 * Check every completed drive once per version of the borders, so trips
 * recorded before Countries existed get theirs. Safe to call on every launch.
 */
export async function checkAllCountriesIfNeeded() {
  if (Storage.getItemSync(CHECKED_KEY) === COUNTRIES_VERSION) return;
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT id FROM drives WHERE status = 'completed' ORDER BY started_at"
  );
  for (const { id } of rows) await checkDriveCountries(id);
  await Storage.setItemAsync(CHECKED_KEY, COUNTRIES_VERSION);
}
