// The Garage: the user's vehicles. Each drive keeps the vehicle it was driven
// in (drives.vehicle_id); new drives get the default one.
import { getDb } from './db';

/** All vehicles, default first, with their totals: [{ id, name, isDefault, distanceM, tripCount }]. */
export async function listVehicles() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT v.id, v.name, v.is_default,
            COALESCE(SUM(json_extract(d.stats, '$.distanceM')), 0) AS distance_m,
            COUNT(DISTINCT d.trip_id) AS trip_count
     FROM vehicles v
     LEFT JOIN drives d ON d.vehicle_id = v.id AND d.status = 'completed'
     GROUP BY v.id
     ORDER BY v.is_default DESC, v.created_at`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    isDefault: r.is_default === 1,
    distanceM: r.distance_m,
    tripCount: r.trip_count,
  }));
}

/** Map of vehicle id → name. */
export async function getVehicleNames() {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT id, name FROM vehicles');
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * Add a vehicle. The first one becomes the default, and every drive recorded
 * before the Garage existed is put down to it.
 */
export async function addVehicle(name) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const any = await db.getFirstAsync('SELECT 1 FROM vehicles LIMIT 1');
    const res = await db.runAsync(
      'INSERT INTO vehicles (name, is_default, created_at) VALUES (?, ?, ?)',
      name.trim(),
      any ? 0 : 1,
      Date.now()
    );
    if (!any) {
      await db.runAsync(
        'UPDATE drives SET vehicle_id = ? WHERE vehicle_id IS NULL',
        res.lastInsertRowId
      );
    }
  });
}

export async function renameVehicle(id, name) {
  const db = await getDb();
  await db.runAsync('UPDATE vehicles SET name = ? WHERE id = ?', name.trim(), id);
}

/** Remove a vehicle; its drives keep their trips but no longer name a vehicle. */
export async function deleteVehicle(id) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE drives SET vehicle_id = NULL WHERE vehicle_id = ?', id);
    await db.runAsync('DELETE FROM vehicles WHERE id = ?', id);
    // Keep a default while any vehicle is left.
    await db.runAsync(
      `UPDATE vehicles SET is_default = 1 WHERE id = (SELECT id FROM vehicles ORDER BY created_at LIMIT 1)
       AND NOT EXISTS (SELECT 1 FROM vehicles WHERE is_default = 1)`
    );
  });
}
