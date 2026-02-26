/**
 * Hero — Landing page hero section.
 * Headline + subtitle + CTAs + HeroWidget.
 * Server component (no interactivity needed).
 */
import Link from 'next/link';
import HeroWidget from './HeroWidget';

export default function Hero() {
  return (
    <section
      style={{
        paddingTop: 160,
        paddingBottom: 80,
        paddingLeft: 48,
        paddingRight: 48,
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 32,
      }}
    >
      {/* Live badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--violet-lo)',
          border: '1px solid var(--violet-mid)',
          borderRadius: 20,
          padding: '5px 14px',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'var(--cyan)',
        }}
      >
        <span className="pulse-dot" aria-hidden="true" />
        Live ghost intelligence
      </div>

      {/* Main headline */}
      <h1
        style={{
          fontWeight: 900,
          letterSpacing: '-3px',
          lineHeight: .95,
          fontSize: 'clamp(56px, 9vw, 108px)',
          color: 'var(--ghost-text)',
          maxWidth: 900,
        }}
      >
        See who ghosted<br />
        <span className="gradient-text" style={{ position: 'relative' }}>
          your count.
        </span>
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 'clamp(16px, 2vw, 20px)',
          color: 'var(--muted)',
          maxWidth: 560,
          lineHeight: 1.6,
        }}
      >
        Ghoast scans your Instagram following list, ranks every ghost across
        five dimensions, and bulk-unfollows them with Instagram-safe delays.
        Clean your list. Fix your ratio.
      </p>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/register"
          className="btn-primary-inline"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--grad)',
            color: '#fff',
            border: 'none',
            padding: '16px 36px',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-.3px',
            boxShadow: '0 0 40px rgba(123,79,255,.4)',
            textDecoration: 'none',
            transition: 'all .2s',
            minHeight: 44,
          }}
        >
          Scan My Account Free →
        </Link>
        <Link
          href="#how-it-works"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            color: 'var(--ghost-text)',
            border: '1px solid rgba(255,255,255,.12)',
            padding: '16px 36px',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all .2s',
            minHeight: 44,
          }}
        >
          See how it works
        </Link>
      </div>

      {/* Social proof */}
      <p style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: '.02em' }}>
        Free to start · No Instagram password required · Instagram-safe delays built in
      </p>

      {/* Hero widget */}
      <HeroWidget />
    </section>
  );
}
