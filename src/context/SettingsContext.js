import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { hasAnyDrive } from '../storage/driveStorage';
import * as settingsStorage from '../storage/settingsStorage';

const SettingsContext = createContext(null);

const save = (promise) => promise.catch((err) => console.warn('[settings] save failed', err));

export function SettingsProvider({ children }) {
  const [units, setUnits] = useState(settingsStorage.getUnits);
  const [breakReminderMinutes, setBreakReminderMinutes] = useState(
    settingsStorage.getBreakReminderMinutes
  );
  // Whether Welcome has been passed. null until known: people who used the app
  // before Welcome existed already have drives, so they skip it.
  const [onboarded, setOnboarded] = useState(settingsStorage.getOnboarded);

  useEffect(() => {
    if (onboarded !== null) return;
    hasAnyDrive()
      .catch(() => false)
      .then((has) => {
        setOnboarded(has);
        if (has) save(settingsStorage.setOnboarded(true));
      });
  }, [onboarded]);

  const value = useMemo(
    () => ({
      units,
      setUnits: (next) => {
        setUnits(next);
        save(settingsStorage.setUnits(next));
      },
      breakReminderMinutes,
      setBreakReminderMinutes: (next) => {
        setBreakReminderMinutes(next);
        save(settingsStorage.setBreakReminderMinutes(next));
      },
      onboarded,
      finishOnboarding: () => {
        setOnboarded(true);
        save(settingsStorage.setOnboarded(true));
      },
      // Development only: show Welcome again without clearing any trips.
      replayOnboarding: () => {
        setOnboarded(false);
        save(settingsStorage.setOnboarded(false));
      },
    }),
    [units, breakReminderMinutes, onboarded]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
