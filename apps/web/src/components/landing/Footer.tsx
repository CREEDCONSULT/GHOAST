/**
 * Footer — Site footer with nav links and legal.
 * Server component.
 */

const LINKS = {
  Product: [
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Ghost tiers', href: '#ghost-tiers' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Dashboard preview', href: '#dashboard-preview' },
  ],
  Account: [
    { label: 'Log in', href: '/login' },
    { label: 'Sign up free', href: '/register' },
    { label: 'Billing', href: '/billing' },
  ],
  Legal: [
    { label: 'Privacy policy', href: '/privacy' },
    { label: 'Terms of service', href: '/terms' },
    { label: 'Cookie policy', href: '/cookies' },
  ],
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        padding: '80px 48px 48px',
        borderTop: '1px solid rgba(123,79,255,.12)',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Top row: logo + links */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '200px repeat(3, 1fr)',
            gap: 48,
            marginBottom: 64,
          }}
          className="footer-grid"
        >
          {/* Brand column */}
          <div>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--grad)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 900,
                  color: '#fff',
                  letterSpacing: '-1px',
                  flexShrink: 0,
                }}
              >
                G
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: '-0.5px',
                  color: 'var(--ghost-text)',
                }}
              >
                gh
                <span
                  style={{
                    background: 'var(--grad)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  oa
                </span>
                st
              </span>
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
              Instagram follower intelligence. See who ghosted you. Clean your ratio.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([group, links]) => (
            <div key={group}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  marginBottom: 16,
                }}
              >
                {group}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      style={{
                        fontSize: 14,
                        color: 'var(--muted)',
                        textDecoration: 'none',
                        transition: 'color .15s',
                      }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row: copyright + disclaimer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
            paddingTop: 28,
            borderTop: '1px solid rgba(123,79,255,.08)',
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            © {year} Ghoast. All rights reserved.
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              maxWidth: 480,
              lineHeight: 1.6,
              opacity: 0.65,
            }}
          >
            Ghoast is not affiliated with, endorsed by, or sponsored by Instagram or Meta Platforms, Inc.
            Use responsibly and in accordance with Instagram&apos;s Terms of Service.
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
