'use client';

/**
 * S-03 Onboarding — 3 steps, skippable, progress dots.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { copy } from '@/lib/copy';

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const total = 3;

  return (
    <main id="main">
      <div className="public-page" style={{ paddingTop: 48 }}>
        <div className="spread mb-4">
          <span style={{ fontWeight: 700 }}>
            <span className="ghost-mark" aria-hidden="true">👻</span> {copy.brand.name}
          </span>
          <button className="btn-tertiary btn-sm" onClick={() => router.push('/upload')}>
            {copy.onboarding.skip}
          </button>
        </div>

        <div aria-hidden="true" className="mb-4" style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 24,
                height: 4,
                borderRadius: 999,
                background: i === step ? 'var(--accent)' : 'var(--surface-2)',
              }}
            />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1>{copy.onboarding.step1Title}</h1>
            <p className="lead muted">{copy.onboarding.step1Body}</p>
            <p className="ghost-hero" aria-hidden="true" style={{ textAlign: 'center', display: 'block' }}>👻</p>
          </>
        )}

        {step === 1 && (
          <>
            <h1>{copy.onboarding.step2Title}</h1>
            <div className="stack-lg mt-4">
              {copy.onboarding.step2Rows.map((r) => (
                <div key={r.title} className="card">
                  <h3>{r.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>{r.body}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1>{copy.onboarding.step3Title}</h1>
            <p className="lead muted">{copy.onboarding.step3Body}</p>
            <div className="stack-lg mt-6">
              <button className="card card-pressable" onClick={() => router.push('/get-my-file')} style={{ textAlign: 'left', color: 'var(--text-1)' }}>
                <h3>📥 {copy.onboarding.pathNeedFile}</h3>
              </button>
              <button className="card card-pressable" onClick={() => router.push('/upload')} style={{ textAlign: 'left', color: 'var(--text-1)' }}>
                <h3>📦 {copy.onboarding.pathHaveFile}</h3>
              </button>
            </div>
          </>
        )}

        {step < 2 && (
          <p className="mt-6">
            <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)} autoFocus>
              {copy.onboarding.continue}
            </button>
          </p>
        )}
      </div>
    </main>
  );
}
