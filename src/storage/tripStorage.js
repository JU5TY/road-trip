// Local persistence for trips and their GPS tracks (expo-sqlite).
// Used from both React screens and the background location task, so it must
// not depend on React context.
import * as SQLite from 'expo-sqlite';

import { createTripStats } from '../utils/geoMath';

let dbPromise = null;

// Schema changes after the first release, applied in order via PRAGMA user_version.
const MIGRATIONS = [
  // 1: place names for start, end and rest stops (JSON).
  'ALTER TABLE trips ADD COLUMN places TEXT',
];

async function migrate(db) {
  const { user_version: version } = await db.getFirstAsync('PRAGMA user_version');
  for (let v = version; v < MIGRATIONS.length; v++) {
    await db.execAsync(`${MIGRATIONS[v]}; PRAGMA user_version = ${v + 1};`);
  }
}

function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('roadtrip.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS trips (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          status TEXT NOT NULL DEFAULT 'active',
          stats TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          altitude REAL,
          speed REAL,
          accuracy REAL,
          timestamp INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_points_trip_time ON points (trip_id, timestamp);
      `);
      await migrate(db);
      return db;
    })();
    // Let a failed open be retried on the next call.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function rowToTrip(row) {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
    stats: JSON.parse(row.stats),
    places: row.places ? JSON.parse(row.places) : {},
  };
}

export async function createTrip(startedAt = Date.now()) {
  const db = await getDb();
  const { lastInsertRowId } = await db.runAsync(
    'INSERT INTO trips (started_at, status, stats) VALUES (?, ?, ?)',
    startedAt,
    'active',
    JSON.stringify(createTripStats())
  );
  return {
    id: lastInsertRowId,
    startedAt,
    endedAt: null,
    status: 'active',
    stats: createTripStats(),
    places: {},
  };
}

export async function getActiveTrip() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    "SELECT * FROM trips WHERE status = 'active' ORDER BY started_at DESC LIMIT 1"
  );
  return row ? rowToTrip(row) : null;
}

/** Append raw fixes to a trip and save its updated stats in one transaction. */
export async function appendFixes(tripId, fixes, stats) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const f of fixes) {
      await db.runAsync(
        'INSERT INTO points (trip_id, latitude, longitude, altitude, speed, accuracy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
        tripId,
        f.latitude,
        f.longitude,
        f.altitude,
        f.speed,
        f.accuracy,
        f.timestamp
      );
    }
    await db.runAsync('UPDATE trips SET stats = ? WHERE id = ?', JSON.stringify(stats), tripId);
  });
}

export async function completeTrip(tripId, endedAt, stats) {
  const db = await getDb();
  await db.runAsync(
    "UPDATE trips SET status = 'completed', ended_at = ?, stats = ? WHERE id = ?",
    endedAt,
    JSON.stringify(stats),
    tripId
  );
}

export async function listTrips() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT * FROM trips WHERE status = 'completed' ORDER BY started_at DESC"
  );
  return rows.map(rowToTrip);
}

export async function getTrip(tripId) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM trips WHERE id = ?', tripId);
  return row ? rowToTrip(row) : null;
}

export async function getTripPoints(tripId) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT latitude, longitude, altitude, speed, timestamp FROM points WHERE trip_id = ? ORDER BY timestamp',
    tripId
  );
}

/** First and last recorded point of a trip, or null if it has none. */
export async function getTripEndpoints(tripId) {
  const db = await getDb();
  const query = (order) =>
    db.getFirstAsync(
      `SELECT latitude, longitude FROM points WHERE trip_id = ? ORDER BY timestamp ${order} LIMIT 1`,
      tripId
    );
  const [first, last] = await Promise.all([query('ASC'), query('DESC')]);
  return first ? { first, last } : null;
}

export async function saveTripPlaces(tripId, places) {
  const db = await getDb();
  await db.runAsync('UPDATE trips SET places = ? WHERE id = ?', JSON.stringify(places), tripId);
}

export async function deleteTrip(tripId) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM points WHERE trip_id = ?', tripId);
    await db.runAsync('DELETE FROM trips WHERE id = ?', tripId);
  });
}
