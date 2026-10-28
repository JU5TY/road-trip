// Drives: one START→STOP recording, with its stats, place names and GPS points.
import { createTripStats } from '../utils/geoMath';
import { getDb } from './db';

export function rowToDrive(row) {
  return {
    id: row.id,
    tripId: row.trip_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
    stats: JSON.parse(row.stats),
    places: row.places ? JSON.parse(row.places) : {},
  };
}

/** Remove a trip once it has no drives left. Call inside a transaction. */
export async function deleteTripIfEmpty(db, tripId) {
  const left = await db.getFirstAsync('SELECT 1 FROM drives WHERE trip_id = ? LIMIT 1', tripId);
  if (!left) await db.runAsync('DELETE FROM trips WHERE id = ?', tripId);
}

/**
 * Create an active drive in `tripId`, or in a brand-new trip when `tripId` is null.
 */
export async function createDrive({ tripId = null, startedAt = Date.now() } = {}) {
  const db = await getDb();
  const stats = createTripStats();
  let driveId;
  let targetTripId = tripId;
  await db.withTransactionAsync(async () => {
    if (targetTripId === null) {
      const res = await db.runAsync('INSERT INTO trips (created_at) VALUES (?)', startedAt);
      targetTripId = res.lastInsertRowId;
    }
    const res = await db.runAsync(
      "INSERT INTO drives (trip_id, started_at, status, stats) VALUES (?, ?, 'active', ?)",
      targetTripId,
      startedAt,
      JSON.stringify(stats)
    );
    driveId = res.lastInsertRowId;
  });
  return {
    id: driveId,
    tripId: targetTripId,
    startedAt,
    endedAt: null,
    status: 'active',
    stats,
    places: {},
  };
}

export async function getActiveDrive() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    "SELECT * FROM drives WHERE status = 'active' ORDER BY started_at DESC LIMIT 1"
  );
  return row ? rowToDrive(row) : null;
}

export async function getDrive(driveId) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT * FROM drives WHERE id = ?', driveId);
  return row ? rowToDrive(row) : null;
}

/** Append raw fixes to a drive and save its updated stats in one transaction. */
export async function appendFixes(driveId, fixes, stats) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const f of fixes) {
      await db.runAsync(
        'INSERT INTO points (drive_id, latitude, longitude, altitude, speed, accuracy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
        driveId,
        f.latitude,
        f.longitude,
        f.altitude,
        f.speed,
        f.accuracy,
        f.timestamp
      );
    }
    await db.runAsync('UPDATE drives SET stats = ? WHERE id = ?', JSON.stringify(stats), driveId);
  });
}

export async function completeDrive(driveId, endedAt, stats) {
  const db = await getDb();
  await db.runAsync(
    "UPDATE drives SET status = 'completed', ended_at = ?, stats = ? WHERE id = ?",
    endedAt,
    JSON.stringify(stats),
    driveId
  );
}

export async function getDrivePoints(driveId) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT latitude, longitude, altitude, speed, timestamp FROM points WHERE drive_id = ? ORDER BY timestamp',
    driveId
  );
}

/**
 * Roughly `maxPoints` evenly spaced points of a drive (always including the
 * last), thinned in SQL so long drives stay cheap to preview.
 */
export async function getDriveRoutePreview(driveId, maxPoints = 150) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT latitude, longitude FROM (
       SELECT latitude, longitude,
              ROW_NUMBER() OVER (ORDER BY timestamp) AS rn,
              COUNT(*) OVER () AS total
       FROM points WHERE drive_id = ?
     )
     WHERE (rn - 1) % MAX(1, total / ?) = 0 OR rn = total
     ORDER BY rn`,
    driveId,
    maxPoints
  );
}

/** First and last recorded point of a drive, or null if it has none. */
export async function getDriveEndpoints(driveId) {
  const db = await getDb();
  const query = (order) =>
    db.getFirstAsync(
      `SELECT latitude, longitude FROM points WHERE drive_id = ? ORDER BY timestamp ${order} LIMIT 1`,
      driveId
    );
  const [first, last] = await Promise.all([query('ASC'), query('DESC')]);
  return first ? { first, last } : null;
}

export async function saveDrivePlaces(driveId, places) {
  const db = await getDb();
  await db.runAsync('UPDATE drives SET places = ? WHERE id = ?', JSON.stringify(places), driveId);
}

/** Delete a drive and its points; its trip goes too if this was its last drive. */
export async function deleteDrive(driveId) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const drive = await db.getFirstAsync('SELECT trip_id FROM drives WHERE id = ?', driveId);
    if (!drive) return;
    await db.runAsync('DELETE FROM points WHERE drive_id = ?', driveId);
    await db.runAsync('DELETE FROM drives WHERE id = ?', driveId);
    await deleteTripIfEmpty(db, drive.trip_id);
  });
}

/**
 * Move a drive to another trip, or into a new trip of its own when
 * `targetTripId` is null. Removes the old trip if it ends up empty.
 * Resolves to the id of the trip the drive is now in.
 */
export async function moveDrive(driveId, targetTripId = null) {
  const db = await getDb();
  let newTripId = targetTripId;
  await db.withTransactionAsync(async () => {
    const drive = await db.getFirstAsync(
      'SELECT trip_id, started_at FROM drives WHERE id = ?',
      driveId
    );
    if (!drive) throw new Error('Drive not found');
    if (newTripId === null) {
      const res = await db.runAsync('INSERT INTO trips (created_at) VALUES (?)', drive.started_at);
      newTripId = res.lastInsertRowId;
    }
    await db.runAsync('UPDATE drives SET trip_id = ? WHERE id = ?', newTripId, driveId);
    await deleteTripIfEmpty(db, drive.trip_id);
  });
  return newTripId;
}

/** Whether any drive (recording or completed) has ever been saved. */
export async function hasAnyDrive() {
  const db = await getDb();
  return Boolean(await db.getFirstAsync('SELECT 1 FROM drives LIMIT 1'));
}
