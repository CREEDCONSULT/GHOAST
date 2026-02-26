/**
 * Nav — Fixed top navigation bar
 * Server component by default; mobile hamburger is a client island.
 */
import Link from 'next/link';
import MobileNav from './MobileNav';

export default function Nav() {
  return (
    <nav
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 100,
        height: 64,
        padding: '0 48px',
        background: 'rgba(8,8,16,.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(123,79,255,.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Logo + wordmark */}
      <Link
        href="/"
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        aria-label="Ghoast home"
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: 'var(--grad)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 900,
            color: '#fff',
          }}
        >
          G
        </div>
        <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--ghost-text)' }}>
          Gh<span className="gradient-text">oa</span>st
        </span>
      </Link>

      {/* Desktop nav links */}
      <div
        className="hide-mobile"
        style={{ display: 'flex', alignItems: 'center', gap: 32 }}
      >
        <Link href="#how-it-works" style={navLinkStyle}>How it works</Link>
        <Link href="#tiers" style={navLinkStyle}>Ghost tiers</Link>
        <Link href="#pricing" style={navLinkStyle}>Pricing</Link>
      </div>

      {/* Desktop CTA */}
      <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/login" style={navSecondaryStyle}>Log in</Link>
        <Link
          href="/register"
          style={{
            background: 'var(--grad)',
            padding: '9px 22px',
            borderRadius: 9,
            fontSize: 14,
            fontWeight: 700,
            color: '#fff',
            textDecoration: 'none',
            boxShadow: '0 0 20px rgba(123,79,255,.35)',
          }}
        >
          Get started free
        </Link>
      </div>

      {/* Mobile hamburger */}
      <MobileNav />
    </nav>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--muted)',
  textDecoration: 'none',
  transition: 'color .2s',
};

const navSecondaryStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--muted)',
  textDecoration: 'none',
};
