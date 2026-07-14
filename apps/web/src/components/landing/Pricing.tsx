/**
 * Pricing — 3-tier pricing cards.
 * Prices must match CLAUDE.md pricing table exactly.
 * Server component.
 */

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: null,
    badge: null,
    description: 'See who ghosted you — no card required.',
    cta: 'Get started free',
    ctaHref: '/register',
    ctaPrimary: false,
    features: [
      '1 Instagram account',
      'Full ghost analysis',
      'Tier scoring (all 5 tiers)',
      'Track 10 cleanups / day',
    ],
    missing: ['Unlimited cleanup tracking', 'Follower-trend history', 'Ghost whitelist'],
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    badge: null,
    description: 'The full ghost list, guided cleanup, and trends.',
    cta: 'Start Pro',
    ctaHref: '/register?plan=pro',
    ctaPrimary: false,
    features: [
      '1 Instagram account',
      'Full ghost analysis',
      'Tier scoring (all 5 tiers)',
      'Unlimited cleanup tracking',
      'Guided one-tap cleanup',
      'Follower-trend history',
      'Engagement-based scoring',
    ],
    missing: ['Ghost whitelist', '3 Instagram accounts'],
  },
  {
    name: 'Pro+',
    price: '$24.99',
    period: '/month',
    badge: 'Most popular',
    description: 'Multiple accounts and full control.',
    cta: 'Start Pro+',
    ctaHref: '/register?plan=proplus',
    ctaPrimary: true,
    features: [
      '3 Instagram accounts',
      'Full ghost analysis',
      'Tier scoring (all 5 tiers)',
      'Unlimited cleanup tracking',
      'Guided one-tap cleanup',
      'Follower-trend history',
      'Engagement-based scoring',
      'Ghost whitelist (500 per account)',
      'Priority support',
    ],
    missing: [],
  },
];

export default function Pricing() {
  return (
    <section
      id="pricing"
      style={{ padding: '100px 48px', background: 'var(--slate)' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--violet-lo)',
              border: '1px solid var(--violet-mid)',
              borderRadius: 20,
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--violet)',
              marginBottom: 20,
            }}
          >
            Pricing
          </div>
          <h2
            style={{
              fontWeight: 900,
              letterSpacing: '-1.5px',
              lineHeight: 1.05,
              fontSize: 'clamp(36px, 5vw, 56px)',
              color: 'var(--ghost-text)',
            }}
          >
            Simple, honest pricing.
          </h2>
          <p
            style={{
              color: 'var(--muted)',
              marginTop: 16,
              fontSize: 17,
              maxWidth: 440,
              margin: '16px auto 0',
            }}
          >
            No contracts. Cancel anytime.
          </p>
        </div>

        {/* Plan cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
            marginBottom: 48,
          }}
          className="pricing-grid"
        >
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: plan.ctaPrimary ? 'linear-gradient(160deg, rgba(123,79,255,.18) 0%, rgba(0,229,255,.08) 100%)' : 'var(--slate2)',
                border: plan.ctaPrimary ? '1px solid rgba(123,79,255,.5)' : '1px solid rgba(123,79,255,.15)',
                borderRadius: 20,
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Most popular badge */}
              {plan.badge && (
                <div
                  style={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    background: 'var(--grad)',
                    borderRadius: 10,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '.06em',
                  }}
                >
                  {plan.badge}
                </div>
              )}

              {/* Plan name */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--violet)',
                  marginBottom: 12,
                }}
              >
                {plan.name}
              </div>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                    fontSize: 48,
                    fontWeight: 500,
                    color: 'var(--ghost-text)',
                    lineHeight: 1,
                  }}
                >
                  {plan.price}
                </span>
                {plan.period && (
                  <span style={{ fontSize: 15, color: 'var(--muted)' }}>{plan.period}</span>
                )}
              </div>

              {/* Description */}
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28, lineHeight: 1.6 }}>
                {plan.description}
              </p>

              {/* CTA */}
              <a
                href={plan.ctaHref}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '13px 20px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: 'none',
                  marginBottom: 28,
                  background: plan.ctaPrimary ? 'var(--grad)' : 'transparent',
                  color: plan.ctaPrimary ? '#fff' : 'var(--ghost-text)',
                  border: plan.ctaPrimary ? 'none' : '1px solid rgba(123,79,255,.35)',
                }}
              >
                {plan.cta}
              </a>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(123,79,255,.12)', marginBottom: 20 }} />

              {/* Feature list */}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.features.map((f) => (
                  <li
                    key={f}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--ghost-text)' }}
                  >
                    <span style={{ color: '#00E676', flexShrink: 0, marginTop: 1 }}>✓</span>
                    {f}
                  </li>
                ))}
                {plan.missing.map((f) => (
                  <li
                    key={f}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--muted)', opacity: 0.55 }}
                  >
                    <span style={{ flexShrink: 0, marginTop: 1 }}>—</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>

      <style>{`
        @media (max-width: 860px) {
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
