/**
 * TierSection — Ghost scoring tier explainer.
 * Server component.
 */

const TIERS = [
  {
    number: 1,
    label: 'Safe to Cut',
    score: '0 – 20',
    color: '#FF3E3E',
    bg: 'rgba(255,62,62,.12)',
    border: 'rgba(255,62,62,.3)',
    description:
      'Low follower count, high following ratio, rarely posts. These accounts add zero value. Cut them all.',
  },
  {
    number: 2,
    label: 'Probably Cut',
    score: '21 – 40',
    color: '#FF7A3E',
    bg: 'rgba(255,122,62,.12)',
    border: 'rgba(255,122,62,.3)',
    description:
      'Low engagement, older account, or skewed ratio. Most of these are inactive — safe to remove.',
  },
  {
    number: 3,
    label: 'Your Call',
    score: '41 – 60',
    color: '#FFD166',
    bg: 'rgba(255,209,102,.10)',
    border: 'rgba(255,209,102,.3)',
    description:
      'Mixed signals — could be a real person who just doesn\'t follow back. Review before cutting.',
  },
  {
    number: 4,
    label: 'Might Keep',
    score: '61 – 80',
    color: '#7B4FFF',
    bg: 'rgba(123,79,255,.12)',
    border: 'rgba(123,79,255,.3)',
    description:
      'High-value account: large following, active engagement, or influential. Consider keeping for reach.',
  },
  {
    number: 5,
    label: 'Keep Following',
    score: '81 – 100',
    color: '#00E676',
    bg: 'rgba(0,230,118,.10)',
    border: 'rgba(0,230,118,.3)',
    description:
      'Verified, verified-adjacent, or high-authority account. Auto-protected — Ghoast will never unfollow these.',
  },
];

export default function TierSection() {
  return (
    <section
      id="ghost-tiers"
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
            Ghost tiers
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
            Not all ghosts are equal.
          </h2>
          <p
            style={{
              color: 'var(--muted)',
              marginTop: 16,
              fontSize: 17,
              maxWidth: 520,
              margin: '16px auto 0',
            }}
          >
            Ghoast scores every ghost across 5 dimensions and assigns a tier so you always
            know who to cut first.
          </p>
        </div>

        {/* Tiers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 16,
          }}
          className="tiers-grid"
        >
          {TIERS.map((tier) => (
            <div
              key={tier.number}
              style={{
                background: tier.bg,
                border: `1px solid ${tier.border}`,
                borderRadius: 16,
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Tier dot + number */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: tier.color,
                    boxShadow: `0 0 8px ${tier.color}`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--muted)',
                    letterSpacing: '.08em',
                  }}
                >
                  TIER {tier.number}
                </span>
              </div>

              {/* Label */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: tier.color,
                  letterSpacing: '-.2px',
                }}
              >
                {tier.label}
              </div>

              {/* Score range */}
              <div
                style={{
                  fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                Score {tier.score}
              </div>

              {/* Description */}
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                {tier.description}
              </p>

              {/* Auto-protected badge for Tier 5 */}
              {tier.number === 5 && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'rgba(0,230,118,.15)',
                    border: '1px solid rgba(0,230,118,.3)',
                    borderRadius: 10,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#00E676',
                    letterSpacing: '.06em',
                    width: 'fit-content',
                  }}
                >
                  🛡 Auto-protected
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Scoring dimensions */}
        <div
          style={{
            marginTop: 48,
            background: 'var(--slate2)',
            border: '1px solid rgba(123,79,255,.15)',
            borderRadius: 16,
            padding: '28px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 48,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            5 SCORING DIMENSIONS
          </div>
          {['Follower count', 'Following ratio', 'Engagement rate', 'Account age', 'Post frequency'].map(
            (dim, i) => (
              <div
                key={dim}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'var(--violet-lo)',
                    border: '1px solid var(--violet-mid)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--violet)',
                    fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                  }}
                >
                  {i + 1}
                </div>
                <span style={{ fontSize: 14, color: 'var(--ghost-text)' }}>{dim}</span>
              </div>
            ),
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .tiers-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .tiers-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
