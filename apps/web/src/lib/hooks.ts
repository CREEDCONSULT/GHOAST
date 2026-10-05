'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { db } from './db';
import { getSettings, updateSettings } from './store';
import type { SettingsRecord } from './types';
import { DEFAULT_SETTINGS } from './types';

/** Live settings, mirrored to <html data-theme> and localStorage for the boot script. */
export function useSettings(): [SettingsRecord, (patch: Partial<SettingsRecord>) => Promise<void>] {
  const settings = useLiveQuery(async () => getSettings(), [], DEFAULT_SETTINGS);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.theme = settings.theme;
    if (settings.reducedMotion) {
      document.documentElement.dataset.reducedMotion = 'true';
    } else {
      delete document.documentElement.dataset.reducedMotion;
    }
    try {
      localStorage.setItem(
        'ghoast-ui',
        JSON.stringify({ theme: settings.theme, reducedMotion: settings.reducedMotion }),
      );
    } catch {
      /* private mode — non-fatal */
    }
  }, [settings]);

  const patch = useCallback(async (p: Partial<SettingsRecord>) => {
    await updateSettings(p);
  }, []);

  return [settings ?? DEFAULT_SETTINGS, patch];
}

/** Latest snapshot (or undefined while loading / null when none exist). */
export function useLatestSnapshot() {
  return useLiveQuery(async () => {
    const snaps = await db.snapshots.orderBy('createdAt').reverse().limit(1).toArray();
    return snaps[0] ?? null;
  }, []);
}

/** True only after hydration — avoids SSR/client markup mismatch. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
