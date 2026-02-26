/**
 * DashboardPreview — Static mock of the Ghoast dashboard.
 * Shows the ghost list with tier badges, scores, and queue CTA.
 * Server component.
 */

const SAMPLE_GHOSTS = [
  { handle: '@coldlead_99',      score: 8,  tier: 1, color: '#FF3E3E', label: 'Safe to Cut',    ratio: '0.02x',  followers: '44' },
  { handle: '@ghost.account_',   score: 14, tier: 1, color: '#FF3E3E', label: 'Safe to Cut',    ratio: '0.04x',  followers: '112' },
  { handle: '@silent_follow22',  score: 31, tier: 2, color: '#FF7A3E', label: 'Probably Cut',   ratio: '0.18x',  followers: '830' },
  { handle: '@lurker.mode',      score: 28, tier: 2, color: '#FF7A3E', label: 'Probably Cut',   ratio: '0.11x',  followers: '290' },
  { handle: '@maybe.maybe_',     score: 55, tier: 3, color: '#FFD166', label: 'Your Call',      ratio: '0.62x',  followers: '3.1K' },
  { handle: '@brand_collab',     score: 72, tier: 4, color: '#7B4FFF', label: 'Might Keep',     ratio: '1.8x',   followers: '28K' },
  { handle: '@verified.creator', score: 94, tier: 5, color: '#00E676', label: 'Keep Following', ratio: '12.4x',  followers: '482K' },
];

export default function DashboardPreview() {
  return (
    <section
      style={{ padding: '100px 48px' }}
      id="dashboard-preview"
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 40,
            flexWrap: 'wrap',
            gap: 24,
          }}
        >
          <div>
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
                marginBottom: 16,
              }}
            >
              Ghost list
            </div>
            <h2
              style={{
                fontWeight: 900,
                letterSpacing: '-1.5px',
                lineHeight: 1.05,
                fontSize: 'clamp(32px, 4vw, 48px)',
                color: 'var(--ghost-text)',
                margin: 0,
              }}
            >
              Your ghosts, ranked.
            </h2>
            <p style={{ color: 'var(--muted)', marginTop: 12, fontSize: 16 }}>
              Sort by tier, score, or follower count. Select and queue in one click.
            </p>
          </div>

          {/* CTA button */}
          <a
            href="/register"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--grad)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              borderRadius: 12,
              padding: '12px 24px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Try it free →
          </a>
        </div>

        {/* Mock dashboard */}
        <div
          style={{
            background: 'var(--slate)',
            border: '1px solid rgba(123,79,255,.2)',
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          {/* Dashboard header bar */}
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid rgba(123,79,255,.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                @youraccount
              </div>
              <div
                style={{
                  background: 'rgba(0,230,118,.12)',
                  border: '1px solid rgba(0,230,118,.25)',
                  borderRadius: 8,
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#00E676',
                }}
              >
                ✓ Scan complete
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                <span style={{ color: 'var(--ghost-text)', fontWeight: 700 }}>247</span> ghosts found
              </div>
              <button
                style={{
                  background: 'var(--grad)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: 10,
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
                disabled
                aria-label="Start queue (demo)"
              >
                ⚡ Start queue
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div
            style={{
              padding: '10px 24px',
              borderBottom: '1px solid rgba(123,79,255,.08)',
              display: 'grid',
              gridTemplateColumns: '1fr 80px 80px 100px 140px',
              gap: 16,
              alignItems: 'center',
            }}
            className="ghost-row-cols"
          >
            {['Account', 'Score', 'Tier', 'Followers', 'Ratio'].map((col) => (
              <div
                key={col}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                {col}
              </div>
            ))}
          </div>

          {/* Ghost rows */}
          {SAMPLE_GHOSTS.map((ghost, i) => (
            <div
              key={ghost.handle}
              style={{
                padding: '14px 24px',
                borderBottom: i < SAMPLE_GHOSTS.length - 1 ? '1px solid rgba(123,79,255,.06)' : 'none',
                display: 'grid',
                gridTemplateColumns: '1fr 80px 80px 100px 140px',
                gap: 16,
                alignItems: 'center',
                opacity: ghost.tier === 5 ? 0.6 : 1,
              }}
              className="ghost-row-cols"
            >
              {/* Handle */}
              <div
                style={{
                  fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                  fontSize: 14,
                  color: 'var(--ghost-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {/* Avatar placeholder */}
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: `${ghost.color}22`,
                    border: `1px solid ${ghost.color}44`,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: ghost.color,
                    fontWeight: 700,
                  }}
                >
                  {ghost.handle[1].toUpperCase()}
                </div>
                {ghost.handle}
              </div>

              {/* Score */}
              <div
                style={{
                  fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: ghost.color,
                }}
              >
                {ghost.score}
              </div>

              {/* Tier */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: ghost.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  T{ghost.tier}
                </span>
              </div>

              {/* Followers */}
              <div
                style={{
                  fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                {ghost.followers}
              </div>

              {/* Ratio */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                    fontSize: 13,
                    color: 'var(--muted)',
                  }}
                >
                  {ghost.ratio}
                </div>
                {ghost.tier === 5 && (
                  <span style={{ fontSize: 11, color: '#00E676' }}>🛡</span>
                )}
              </div>
            </div>
          ))}

          {/* Footer count */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid rgba(123,79,255,.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Showing 7 of 247 ghosts
            </span>
            <span style={{ fontSize: 13, color: 'var(--violet)', fontWeight: 600, cursor: 'default' }}>
              View all →
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .ghost-row-cols {
            grid-template-columns: 1fr 60px 60px !important;
          }
          .ghost-row-cols > *:nth-child(4),
          .ghost-row-cols > *:nth-child(5) {
            display: none !important;
          }
        }
      `}</style>
    </section>
  );
}
