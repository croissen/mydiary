import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getAllSettings, setSettings as persistSettings } from '../db';
import { rescheduleAll } from '../notifications';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { AppSettings } from '../types';

interface SettingsContextValue {
  settings: AppSettings;
  ready: boolean;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setLocal] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const s = await getAllSettings();
    setLocal(s);
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const update = useCallback(
    async (patch: Partial<AppSettings>) => {
      await persistSettings(patch);
      const next = await getAllSettings();
      setLocal(next);
      // Any change to notification config (times, random count, quiet hours,
      // permission) should rebuild the schedule.
      const touchesNotif =
        'notification_times' in patch ||
        'slot_enabled' in patch ||
        'slot_questions' in patch ||
        'random_extra_count' in patch ||
        'quiet_hours' in patch ||
        'diary_compile_time' in patch ||
        'notification_permission_granted' in patch;
      if (touchesNotif) {
        await rescheduleAll(next);
      }
    },
    []
  );

  const value = useMemo(
    () => ({ settings, ready, update, reload }),
    [settings, ready, update, reload]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
