import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listVehicles } from '../storage/vehicleStorage';

/** The Garage's vehicles with totals; null while loading. Reloads on focus and on reload(). */
export function useVehicles() {
  const [vehicles, setVehicles] = useState(null);
  const reload = useCallback(
    () =>
      listVehicles()
        .then(setVehicles)
        .catch((err) => console.warn('[garage] load failed', err)),
    []
  );
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );
  return [vehicles, reload];
}
