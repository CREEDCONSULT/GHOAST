import Link from 'next/link';
import { copy } from '@/lib/copy';

export function PublicFooter() {
  return (
    <footer
      className="center"
      style={{
        borderTop: '1px solid var(--surface-2)',
        padding: '32px 20px',
        color: 'var(--text-3)',
        fontSize: '0.875rem',
      }}
    >
      <nav aria-label="Footer" style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
        <Link href="/privacy">{copy.footer.privacy}</Link>
        <Link href="/how-it-works">{copy.footer.howItWorks}</Link>
        <Link href="/pricing">{copy.footer.pricing}</Link>
        <Link href="/help">{copy.footer.help}</Link>
      </nav>
      <p style={{ marginTop: 16 }}>{copy.brand.name} — your data never leaves your device.</p>
    </footer>
  );
}
