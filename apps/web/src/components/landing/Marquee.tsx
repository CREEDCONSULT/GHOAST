/**
 * Marquee — Scrolling social proof strip.
 * Shows stat/fact chips in a continuous loop.
 * Server component.
 */

const CHIPS = [
  '🔍 Instant ghost analysis',
  '🛡️ No password, no login, ever',
  '📦 Uses your own Instagram export',
  '📊 Engagement-aware ghost scoring',
  '🎯 Tier 5 ghosts auto-protected',
  '💳 No card needed to start',
  '📈 Daily ratio snapshots',
  '✅ Guided one-tap cleanup',
  '🔒 100% Instagram-ToS compliant',
  '👻 Know who you’d actually miss',
];

export default function Marquee() {
  // Double the chips so the seamless loop works
  const doubled = [...CHIPS, ...CHIPS];

  return (
    <div
      style={{
        borderTop: '1px solid rgba(123,79,255,.1)',
        borderBottom: '1px solid rgba(123,79,255,.1)',
        padding: '14px 0',
        overflow: 'hidden',
        background: 'rgba(123,79,255,.04)',
      }}
      aria-hidden="true"
    >
      <div className="marquee-track">
        {doubled.map((chip, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 32px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {chip}
            <span style={{ color: 'var(--violet-mid)', margin: '0 16px' }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
