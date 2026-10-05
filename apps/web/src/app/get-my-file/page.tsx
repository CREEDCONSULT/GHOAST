'use client';

/**
 * S-04 Export guide — steps with persistence (spec §8.2: user can leave and
 * return; guide progress remembered locally).
 */

import Link from 'next/link';
import { Beacon } from '@/components/Beacon';
import { GuideContent } from '@/components/GuideContent';
import { copy } from '@/lib/copy';

export default function GetMyFilePage() {
  return (
    <main id="main">
      <Beacon event="export_guide_open" />
      <div className="public-page" style={{ paddingTop: 48 }}>
        <div className="spread mb-4">
          <Link href="/start" className="micro">← {copy.a11y.back}</Link>
          <Link href="/upload" className="micro">{copy.guide.haveZip}</Link>
        </div>
        <h1>{copy.guide.title}</h1>
        <p className="lead muted">{copy.guide.intro}</p>

        <GuideContent />

        <div className="card mt-6" role="note">
          <p style={{ margin: 0 }}>{copy.guide.waiting}</p>
          <p className="mt-4">
            <Link href="/upload" className="btn btn-primary">{copy.guide.haveZip}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
