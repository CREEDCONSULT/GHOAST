import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideContent } from '@/components/GuideContent';
import { PublicFooter } from '@/components/PublicFooter';
import { copy } from '@/lib/copy';

export const metadata: Metadata = { title: 'How it works' };

export default function HowItWorksPage() {
  return (
    <main id="main">
      <div className="public-page">
        <h1>{copy.guide.title}</h1>
        <p className="lead muted">{copy.guide.intro}</p>
        <GuideContent numbered />
        <p className="mt-6">
          <Link href="/upload" className="btn btn-primary">
            {copy.guide.haveZip}
          </Link>
        </p>
      </div>
      <PublicFooter />
    </main>
  );
}
