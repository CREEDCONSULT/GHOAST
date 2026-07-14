/**
 * HowItWorks — 3-step process section.
 * Server component.
 */

const STEPS = [
  {
    number: '01',
    title: 'Upload your data export',
    description:
      'Download your own data from Instagram (the official "Download your information" export) and drop the file into Ghoast. No password, no login, no access to your account — ever.',
    icon: '📦',
  },
  {
    number: '02',
    title: 'See your ghosts, ranked',
    description:
      'Ghoast compares your following against your followers and ranks everyone who doesn’t follow you back — using your own likes, comments, and Close Friends to flag who you’d actually miss.',
    icon: '👻',
  },
  {
    number: '03',
    title: 'Clean up, guided',
    description:
      'Work down your ghost list tier by tier. Ghoast deep-links each profile so you unfollow on Instagram in a tap, then checks them off and tracks your ratio over time.',
    icon: '✅',
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{ padding: '100px 48px' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Section header */}
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
            How it works
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
            Three steps to a cleaner ratio.
          </h2>
          <p style={{ color: 'var(--muted)', marginTop: 16, fontSize: 17, maxWidth: 480, margin: '16px auto 0' }}>
            No app to install. No bot software. Runs entirely on our servers.
          </p>
        </div>

        {/* Steps grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
          }}
          className="steps-grid"
        >
          {STEPS.map((step) => (
            <div
              key={step.number}
              style={{
                background: 'var(--slate)',
                border: '1px solid rgba(123,79,255,.18)',
                borderRadius: 18,
                padding: 32,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Step number watermark */}
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 20,
                  fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                  fontSize: 48,
                  fontWeight: 500,
                  color: 'rgba(123,79,255,.08)',
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                {step.number}
              </div>

              {/* Icon */}
              <div style={{ fontSize: 32, marginBottom: 20 }}>{step.icon}</div>

              {/* Title */}
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--ghost-text)',
                  letterSpacing: '-.3px',
                  marginBottom: 12,
                }}
              >
                {step.title}
              </h3>

              {/* Description */}
              <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.65 }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
