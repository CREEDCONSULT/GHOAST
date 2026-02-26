/**
 * HeroWidget — Ghost analysis dashboard preview.
 * Shows a static snapshot of what the product looks like.
 * Server component.
 */

const TIER_COLORS: Record<number, string> = {
  1: '#FF3E3E',
  2: '#FF7A3E',
  3: '#FFD166',
  4: '#7B4FFF',
  5: '#00E676',
};

const TIER_LABELS: Record<number, string> = {
  1: 'Safe to Cut',
  2: 'Probably Cut',
  3: 'Your Call',
  4: 'Might Keep',
  5: 'Keep Following',
};

const SAMPLE_GHOSTS = [
  { handle: '@fashion_queen_', displayName: 'Fashion Queen', followers: 12400, tier: 1, score: 8 },
  { handle: '@tech_guru99', displayName: 'Tech Guru', followers: 890, tier: 1, score: 14 },
  { handle: '@mia.travels', displayName: 'Mia Travels', followers: 3200, tier: 2, score: 28 },
  { handle: '@daily_inspo', displayName: 'Daily Inspo', followers: 45600, tier: 3, score: 52 },
  { handle: '@old_classmate', displayName: 'Old Classmate', followers: 156, tier: 4, score: 71 },
];

export default function HeroWidget() {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 720,
        background: 'var(--slate)',
        border: '1px solid var(--violet-mid)',
        borderRadius: 20,
        padding: 32,
        boxShadow: '0 0 60px rgba(123,79,255,.12), 0 40px 80px rgba(0,0,0,.4)',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: 'var(--grad)',
        }}
      />

      {/* Widget header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Ghost Analysis
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ghost-text)' }}>
            @yourhandle
          </div>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(0,229,255,.1)',
            border: '1px solid rgba(0,229,255,.3)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'var(--cyan)',
          }}
        >
          <span className="pulse-dot" aria-hidden="true" />
          Scanning
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          { label: 'Ghosts Found', value: '1,247', color: 'var(--tier-1)' },
          { label: 'Ratio', value: '0.81', color: 'var(--cyan)' },
          { label: 'Can Remove', value: '312', color: 'var(--violet)' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--specter)',
              borderRadius: 12,
              padding: 18,
              textAlign: 'center',
              border: '1px solid rgba(123,79,255,.15)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                fontSize: 28,
                fontWeight: 500,
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 4 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Ghost list sample */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SAMPLE_GHOSTS.map((ghost) => (
          <div
            key={ghost.handle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--specter)',
              borderRadius: 10,
              padding: '10px 14px',
              border: '1px solid rgba(123,79,255,.1)',
            }}
          >
            {/* Avatar placeholder */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: `rgba(123,79,255,.2)`,
                border: `1px solid ${TIER_COLORS[ghost.tier]}44`,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--muted)',
              }}
            >
              {ghost.displayName[0]}
            </div>

            {/* Handle + tier */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ghost-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ghost.handle}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {ghost.followers.toLocaleString()} followers
              </div>
            </div>

            {/* Tier badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: TIER_COLORS[ghost.tier],
                  boxShadow: `0 0 6px ${TIER_COLORS[ghost.tier]}88`,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {TIER_LABELS[ghost.tier]}
              </span>
            </div>

            {/* Score */}
            <div
              style={{
                fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                fontSize: 13,
                fontWeight: 500,
                color: TIER_COLORS[ghost.tier],
                minWidth: 28,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {ghost.score}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Showing 5 of 1,247 ghosts
        </span>
        <div
          style={{
            background: 'var(--grad)',
            color: '#fff',
            padding: '8px 18px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Start Ghosting →
        </div>
      </div>
    </div>
  );
}
