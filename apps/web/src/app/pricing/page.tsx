import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicFooter } from '@/components/PublicFooter';
import { copy } from '@/lib/copy';

export const metadata: Metadata = { title: 'Pricing' };

export default function PricingPage() {
  return (
    <main id="main">
      <div className="public-page">
        <h1>Honest pricing</h1>
        <p className="lead muted">
          Your first scan is free forever — the complete list, triage, cleanup, everything.
          GHOAST+ adds the one thing that genuinely costs more over time: memory.
        </p>

        <div className="grid-2 mt-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <div className="card">
            <h2>Free</h2>
            <p className="stat-value tnum">$0</p>
            <ul className="muted">
              <li>Complete scan — every ghost, no teasers</li>
              <li>Ghosts, fans and mutuals lists</li>
              <li>Review triage + cleanup queue</li>
              <li>Protected &amp; saved lists</li>
              <li>Delete-anything controls</li>
            </ul>
          </div>
          <div className="card" style={{ borderColor: 'var(--accent)' }}>
            <h2>GHOAST+</h2>
            <p className="stat-value tnum">$4.99<span className="micro muted"> / month</span></p>
            <ul className="muted">
              <li>Everything in Free</li>
              <li>Scan history — your graph over time</li>
              <li>Comparisons: what changed between scans</li>
              <li>Verified-unfollow reconciliation</li>
            </ul>
            <p className="micro faint">{copy.paywall.purchaseUnavailable}</p>
          </div>
        </div>

        <p className="mt-6">
          <Link href="/start" className="btn btn-primary">{copy.landing.cta}</Link>
        </p>
      </div>
      <PublicFooter />
    </main>
  );
}
