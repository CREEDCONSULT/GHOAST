'use client';

/**
 * C-01 AppShell — bottom tab bar (mobile) / left rail (desktop), spec §15.
 * Tabs: Home · Review · Saved · Settings. Review carries the unreviewed
 * badge (capped at 99+).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { copy } from '@/lib/copy';
import { useEffect } from 'react';

interface Tab {
  href: string;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { href: '/results', label: 'Home', icon: '👻' },
  { href: '/review', label: 'Review', icon: '🃏' },
  { href: '/saved', label: 'Saved', icon: '🔖' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

const RAIL_EXTRA: Tab[] = [
  { href: '/results/ghosts', label: 'Ghosts', icon: '📋' },
  { href: '/results/fans', label: 'Fans', icon: '✨' },
  { href: '/cleanup', label: 'Cleanup', icon: '🧹' },
  { href: '/kept', label: 'Protected', icon: '🛡' },
  { href: '/activity', label: 'Activity', icon: '🧾' },
  { href: '/history', label: 'History', icon: '🕘' },
];

function useUnreviewedCount(): number {
  return (
    useLiveQuery(async () => {
      const snaps = await db.snapshots.orderBy('createdAt').reverse().limit(1).toArray();
      const snap = snaps[0];
      if (!snap) return 0;
      const relations = await db.relations
        .where('[snapshotId+direction]')
        .equals([snap.id, 'following'])
        .toArray();
      const decisions = await db.decisions.toArray();
      const decided = new Set(decisions.map((d) => d.username));
      return relations.filter((r) => !decided.has(r.username.toLowerCase())).length;
    }, []) ?? 0
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const unreviewed = useUnreviewedCount();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || (href === '/results' && pathname.startsWith('/results'));

  return (
    <div className="app-with-rail">
      <nav className="rail" aria-label={copy.a11y.tabs}>
        <Link
          href="/results"
          style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-1)', marginBottom: 16 }}
        >
          <span className="ghost-mark" aria-hidden="true">👻</span> GHOAST
        </Link>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={isActive(t.href) ? 'page' : undefined}>
            <span aria-hidden="true">{t.icon}</span> {t.label}
            {t.href === '/review' && unreviewed > 0 && (
              <span className="badge badge-queued tnum" style={{ marginLeft: 'auto' }}>
                {unreviewed > 99 ? '99+' : unreviewed}
              </span>
            )}
          </Link>
        ))}
        {RAIL_EXTRA.map((t) => (
          <Link key={t.href} href={t.href} aria-current={pathname === t.href ? 'page' : undefined}>
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </Link>
        ))}
      </nav>

      <main id="main">{children}</main>

      <nav className="tabbar" aria-label={copy.a11y.tabs}>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={isActive(t.href) ? 'page' : undefined}>
            <span aria-hidden="true" style={{ position: 'relative' }}>
              {t.icon}
              {t.href === '/review' && unreviewed > 0 && (
                <span className="tab-badge">{unreviewed > 99 ? '99+' : unreviewed}</span>
              )}
            </span>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
