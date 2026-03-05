'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spinner size={28} />
      </div>
    );
  }

  if (!user) return null;

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const tierLabel: Record<string, string> = {
    FREE: 'Free',
    PRO: 'Pro',
    PRO_PLUS: 'Pro+',
  };

  return (
    <div className="app-body">
      <div className="noise-layer" />
      <div className="orb orb-1" />
      <div className="orb orb-3" />

      {/* App nav */}
      <nav className="app-nav">
        {/* Logo */}
        <Link
          href="/app/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--grad)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 900,
              color: '#fff',
            }}
          >
            G
          </div>
          <span style={{ fontSize: 16, fontWeight: 800 }}>
            Gh<span className="gradient-text">oa</span>st
          </span>
        </Link>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Tier badge */}
          <div
            style={{
              background: 'var(--violet-lo)',
              border: '1px solid var(--violet-mid)',
              borderRadius: 20,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase' as const,
              color: 'var(--violet)',
            }}
          >
            {tierLabel[user.tier] ?? user.tier}
          </div>

          {/* Credit balance */}
          {(user.tier === 'FREE' || user.creditBalance > 0) && (
            <div
              style={{
                fontFamily: 'DM Mono',
                fontSize: 13,
                color: 'var(--muted)',
              }}
            >
              <span style={{ color: 'var(--ghost-text)', fontWeight: 500 }}>
                {user.creditBalance}
              </span>{' '}
              credits
            </div>
          )}

          {/* Upgrade CTA for free users */}
          {user.tier === 'FREE' && (
            <Link
              href="/pricing"
              style={{
                background: 'var(--grad)',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 0 16px rgba(123,79,255,.3)',
              }}
            >
              Upgrade
            </Link>
          )}

          {/* User menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--specter)',
                border: '1px solid rgba(123,79,255,.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--ghost-text)',
              }}
            >
              {user.email[0].toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
                padding: '4px 8px',
                borderRadius: 6,
                transition: 'color .15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ghost-text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="app-content" style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </main>
    </div>
  );
}
