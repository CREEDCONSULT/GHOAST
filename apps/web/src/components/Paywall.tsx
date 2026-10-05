'use client';

/**
 * C-17 PaywallSheet (SH-9). The gate is real; checkout goes through Stripe
 * when configured (docs/production/BILLING_ENTITLEMENT.md). When the Stripe
 * env is absent the sheet says so honestly — nothing is faked (no free
 * "plus" grants outside the explicit dev-only simulator).
 */

import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { billingConfigured, startCheckout } from '@/lib/billing';
import { Sheet } from './Sheet';
import { copy } from '@/lib/copy';
import { updateSettings } from '@/lib/store';

export function PaywallSheet({
  open,
  onDismiss,
  detail,
}: {
  open: boolean;
  onDismiss: () => void;
  detail?: string;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void track('paywall_view');
    let cancelled = false;
    void billingConfigured().then((c) => {
      if (!cancelled) setConfigured(c);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const checkout = (interval: 'monthly' | 'annual') => {
    setBusy(true);
    void track('checkout_start', { interval });
    void startCheckout(interval).catch(() => setBusy(false));
  };

  return (
    <Sheet open={open} title={copy.paywall.title} onClose={onDismiss}>
      {detail && <p className="lead">{detail}</p>}
      <p className="muted">{copy.paywall.body}</p>
      <div className="grid-2 mt-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <h3>{copy.paywall.monthly('$4.99')}</h3>
          {configured && (
            <button className="btn btn-primary btn-sm mt-2" disabled={busy} onClick={() => checkout('monthly')}>
              {copy.paywall.checkout}
            </button>
          )}
        </div>
        <div className="card">
          <h3>{copy.paywall.annual('$29.99')}</h3>
          {configured && (
            <button className="btn btn-primary btn-sm mt-2" disabled={busy} onClick={() => checkout('annual')}>
              {copy.paywall.checkout}
            </button>
          )}
        </div>
      </div>
      {configured === false && <p className="micro faint mt-4">{copy.paywall.purchaseUnavailable}</p>}
      {configured === true && (
        <p className="micro faint mt-4">{copy.paywall.secureNote}</p>
      )}
      {process.env.NODE_ENV === 'development' && (
        <button
          className="btn btn-secondary btn-sm mt-2"
          onClick={() => {
            void updateSettings({ plan: 'plus' }).then(onDismiss);
          }}
        >
          Simulate GHOAST+ (dev only)
        </button>
      )}
      <button className="btn btn-tertiary mt-4" onClick={onDismiss}>
        {copy.paywall.notNow}
      </button>
    </Sheet>
  );
}
