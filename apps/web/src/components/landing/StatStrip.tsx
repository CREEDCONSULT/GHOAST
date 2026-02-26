/**
 * StatStrip — 4 key social proof stats.
 * Server component.
 */

const STATS = [
  {
    value: '2.4M+',
    label: 'Ghosts removed',
  },
  {
    value: '186K',
    label: 'Accounts cleaned',
  },
  {
    value: '99.1%',
    label: 'Accounts kept safe',
  },
  {
    value: '< 30s',
    label: 'Avg scan time',
  },
];

export default function StatStrip() {
  return (
    <section style={{ padding: '0 48px' }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          background: 'var(--slate)',
          border: '1px solid rgba(123,79,255,.2)',
          borderRadius: 20,
          padding: '40px 48px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
        className="stat-strip-grid"
      >
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            height: 120,
            background: 'rgba(123,79,255,.06)',
            borderRadius: '50%',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />

        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            style={{
              textAlign: 'center',
              position: 'relative',
              paddingRight: i < STATS.length - 1 ? 24 : 0,
              borderRight: i < STATS.length - 1 ? '1px solid rgba(123,79,255,.12)' : 'none',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                fontSize: 'clamp(28px, 3.5vw, 42px)',
                fontWeight: 500,
                background: 'var(--grad)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1.1,
                marginBottom: 8,
              }}
            >
              {stat.value}
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .stat-strip-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 420px) {
          .stat-strip-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
