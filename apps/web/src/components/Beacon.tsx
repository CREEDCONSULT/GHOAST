'use client';

import { useEffect, useRef } from 'react';
import { track, type AnalyticsEvent } from '@/lib/analytics';

/** Fires one analytics event on mount (no-op unless the user opted in). */
export function Beacon({ event }: { event: AnalyticsEvent }) {
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      void track(event);
    }
  }, [event]);
  return null;
}
