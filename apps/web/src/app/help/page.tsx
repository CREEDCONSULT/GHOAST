import type { Metadata } from 'next';
import { PublicFooter } from '@/components/PublicFooter';
import { copy } from '@/lib/copy';

export const metadata: Metadata = { title: 'Help' };

export default function HelpPage() {
  return (
    <main id="main">
      <div className="public-page">
        <h1>{copy.help.title}</h1>
        <div className="stack-lg mt-4">
          {copy.help.entries.map((e) => (
            <details key={e.q} className="card">
              <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 32 }}>{e.q}</summary>
              <p className="muted mt-2" style={{ margin: 0 }}>{e.a}</p>
            </details>
          ))}
        </div>
      </div>
      <PublicFooter />
    </main>
  );
}
