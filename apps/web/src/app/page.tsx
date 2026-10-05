import Link from 'next/link';
import { Beacon } from '@/components/Beacon';
import { PublicFooter } from '@/components/PublicFooter';
import { copy } from '@/lib/copy';

export default function LandingPage() {
  return (
    <main id="main">
      <Beacon event="landing_view" />
      <div className="public-page center" style={{ paddingTop: 64 }}>
        <nav className="spread mb-4" aria-label="Site">
          <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>
            <span className="ghost-mark" aria-hidden="true">👻</span> {copy.brand.name}
          </span>
          <Link href="/help" className="micro">{copy.footer.help}</Link>
        </nav>

        <p className="ghost-hero" aria-hidden="true">👻</p>
        <h1>{copy.landing.h1}</h1>
        <p className="lead muted">{copy.landing.sub}</p>
        <p className="mt-6">
          <Link href="/start" className="btn btn-primary">
            {copy.landing.cta}
          </Link>
        </p>
        <div className="trust-strip mt-6">
          {copy.landing.trustChips.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </div>

        <section className="mt-6" style={{ textAlign: 'left', marginTop: 64 }}>
          <h2>{copy.landing.howTitle}</h2>
          <div className="stack-lg mt-4">
            {copy.landing.howSteps.map((s, i) => (
              <div key={s.title} className="card">
                <h3>
                  <span className="muted">{i + 1}.</span> {s.title}
                </h3>
                <p className="muted" style={{ margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ textAlign: 'left', marginTop: 64 }}>
          <h2>{copy.landing.whatTitle}</h2>
          <div className="stack-lg mt-4">
            {copy.landing.whatPoints.map((p) => (
              <div key={p.title} className="card">
                <h3>{p.title}</h3>
                <p className="muted" style={{ margin: 0 }}>{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ textAlign: 'left', marginTop: 64 }}>
          <div className="card">
            <h2>{copy.landing.honestyTitle}</h2>
            <p className="muted" style={{ margin: 0 }}>{copy.landing.honestyBody}</p>
            <p className="micro muted mt-2" style={{ margin: 0 }}>🛡 {copy.landing.ethicalLine}</p>
          </div>
        </section>

        <p style={{ marginTop: 64 }}>
          <Link href="/start" className="btn btn-primary">
            {copy.landing.cta}
          </Link>{' '}
          <Link href="/how-it-works" className="btn btn-tertiary">
            {copy.footer.howItWorks}
          </Link>
        </p>
      </div>
      <PublicFooter />
    </main>
  );
}
