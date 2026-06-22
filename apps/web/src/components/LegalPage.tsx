import Link from 'next/link';
import type { ReactNode } from 'react';

export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <main style={{ minHeight: '100vh', padding: '48px 20px 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--cyan)', fontSize: 14 }}>
          Ghoast
        </Link>
        <h1 style={{ fontSize: 36, margin: '28px 0 6px' }}>{title}</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 36 }}>
          Effective {effectiveDate}
        </p>
        <article
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            color: 'var(--ghost-text)',
            lineHeight: 1.75,
          }}
        >
          {children}
        </article>
      </div>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>{title}</h2>
      <div style={{ color: 'var(--muted)' }}>{children}</div>
    </section>
  );
}
