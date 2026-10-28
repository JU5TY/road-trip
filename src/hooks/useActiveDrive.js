import { useEffect, useState } from 'react';

import { getActiveDrive } from '../storage/driveStorage';

const REFRESH_MS = 1000;

/**
 * The drive currently being recorded (or null), refreshed every second while
 * mounted. The background task writes to SQLite, so polling is the simplest way
 * to see its progress. Also returns `now`, the time of the latest refresh, for
 * live elapsed times. Uses a plain effect (not focus) so it also works outside
 * screens, e.g. in the tab bar.
 */
export function useActiveDrive() {
  const [state, setState] = useState({ drive: null, now: 0 });

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const drive = await getActiveDrive().catch(() => null);
      if (!cancelled) setState({ drive, now: Date.now() });
    };
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}
