'use client';

/**
 * Checkout success landing. Grants GHOAST+ ONLY after Stripe confirms.
 * Failure/cancel states stay honest: nothing is granted on client claim alone.
 */

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { verifyAndGrant } from '@/lib/billing';

function PlusReturn() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const [state, setState] = useState<'verifying' | 'ok' | 'failed'>(() =>
    sessionId ? 'verifying' : 'failed',
  );

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void verifyAndGrant(sessionId).then((s) => {
      if (!cancelled) {
        setState(s.entitled ? 'ok' : 'failed');
        if (s.entitled) void track('checkout_complete', { plan: 'plus' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="page" style={{ maxWidth: 480 }}>
      {state === 'verifying' && (
        <>
          <h1>Confirming your membership…</h1>
          <div className="skeleton" style={{ height: 80 }} />
        </>
      )}
      {state === 'ok' && (
        <>
          <p className="ghost-hero" aria-hidden="true">👻✨</p>
          <h1>Welcome to GHOAST+</h1>
          <p className="muted">Your scans now have memory — history and comparisons are unlocked on this device.</p>
          <p className="mt-4">
            <Link href="/history" className="btn btn-primary">See your history →</Link>
          </p>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1>Payment not confirmed</h1>
          <p className="muted">
            We couldn’t confirm a completed payment for this session, so nothing was unlocked.
            If you were charged, contact support with your receipt; if not, you can try again any time.
          </p>
          <p className="mt-4">
            <Link href="/pricing" className="btn btn-primary">Back to pricing</Link>
          </p>
        </>
      )}
    </div>
  );
}

export default function PlusPage() {
  return (
    <Suspense>
      <PlusReturn />
    </Suspense>
  );
}
