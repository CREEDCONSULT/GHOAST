'use client';

/**
 * S-18 Settings hub — appearance, motion, pacing, plan, data.
 */

import Link from 'next/link';
import { useState } from 'react';
import { recheckEntitlement } from '@/lib/billing';
import { copy } from '@/lib/copy';
import { useSettings } from '@/lib/hooks';

export default function SettingsPage() {
  const [settings, patch] = useSettings();
  const [recheckMsg, setRecheckMsg] = useState<string | null>(null);

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <h1>{copy.settings.title}</h1>

      <div className="stack-lg mt-4">
        <div className="card">
          <h2 style={{ fontSize: '1.125rem' }}>{copy.settings.appearance}</h2>
          <div role="group" aria-label={copy.settings.appearance} style={{ display: 'flex', gap: 8 }}>
            <button
              className={`chip ${settings.theme === 'dark' ? 'active' : ''}`}
              aria-pressed={settings.theme === 'dark'}
              onClick={() => void patch({ theme: 'dark' })}
            >
              {copy.settings.themeDark}
            </button>
            <button
              className={`chip ${settings.theme === 'light' ? 'active' : ''}`}
              aria-pressed={settings.theme === 'light'}
              onClick={() => void patch({ theme: 'light' })}
            >
              {copy.settings.themeLight}
            </button>
          </div>
          <p className="mt-4">
            <button
              className={`chip ${settings.reducedMotion ? 'active' : ''}`}
              aria-pressed={settings.reducedMotion}
              onClick={() => void patch({ reducedMotion: !settings.reducedMotion })}
            >
              {copy.settings.motion}
            </button>
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.125rem' }}>{copy.settings.pacing}</h2>
          <p className="micro muted">{copy.settings.pacingHint(settings.pacingThreshold)}</p>
          <input
            type="range"
            min={10}
            max={50}
            step={5}
            value={settings.pacingThreshold}
            onChange={(e) => void patch({ pacingThreshold: Number(e.target.value) })}
            aria-label={copy.settings.pacing}
            style={{ width: '100%' }}
          />
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.125rem' }}>{copy.settings.plan}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {settings.plan === 'plus' ? copy.settings.planPlus : copy.settings.planFree}
          </p>
          <div className="mt-2" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/pricing" className="btn-tertiary btn-sm">{copy.footer.pricing} →</Link>
            {settings.plan === 'plus' && (
              <button
                className="btn-tertiary btn-sm"
                onClick={() => {
                  setRecheckMsg(null);
                  void recheckEntitlement().then((s) =>
                    setRecheckMsg(s.entitled ? 'Membership confirmed ✓' : 'Couldn’t confirm an active membership.'),
                  );
                }}
              >
                Recheck membership
              </button>
            )}
          </div>
          {recheckMsg && <p className="micro muted mt-2" style={{ margin: 0 }}>{recheckMsg}</p>}
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.125rem' }}>Analytics</h2>
          <p className="micro muted">
            Anonymous product-funnel events only (e.g. “an upload succeeded”). Never usernames, never
            relationship data, never archive contents. Off by default.
          </p>
          <button
            className={`chip ${settings.analyticsOptIn ? 'active' : ''}`}
            aria-pressed={settings.analyticsOptIn}
            onClick={() => void patch({ analyticsOptIn: !settings.analyticsOptIn })}
          >
            {settings.analyticsOptIn ? 'On — thank you' : 'Off'}
          </button>
        </div>

        <Link href="/settings/data" className="card card-pressable" style={{ color: 'var(--text-1)' }}>
          <div className="spread">
            <div>
              <h2 style={{ fontSize: '1.125rem', margin: 0 }}>{copy.settings.data}</h2>
              <p className="micro muted" style={{ margin: '4px 0 0' }}>{copy.settings.dataHint}</p>
            </div>
            <span aria-hidden="true">→</span>
          </div>
        </Link>

        <div className="card">
          <h2 style={{ fontSize: '1.125rem' }}>{copy.settings.about}</h2>
          <p className="micro muted" style={{ margin: 0 }}>
            GHOAST knows what it knows from exactly two lists in your own Instagram export —
            followers and following. Usernames, profile links, and follow-start dates. Everything
            else it shows is arithmetic on those lists. Nothing is uploaded; everything can be
            deleted from Settings → Data.
          </p>
          <p className="mt-2" style={{ margin: 0 }}>
            <Link href="/privacy" className="btn-tertiary btn-sm">{copy.footer.privacy} →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
