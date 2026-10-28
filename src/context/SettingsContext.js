import { createContext, useContext, useMemo, useState } from 'react';

import * as settingsStorage from '../storage/settingsStorage';

const SettingsContext = createContext(null);

const save = (promise) => promise.catch((err) => console.warn('[settings] save failed', err));

export function SettingsProvider({ children }) {
  const [units, setUnits] = useState(settingsStorage.getUnits);

  const value = useMemo(
    () => ({
      units,
      setUnits: (next) => {
        setUnits(next);
        save(settingsStorage.setUnits(next));
      },
    }),
    [units]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
