'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListPage } from '@/components/ListPage';
import type { BandFilter } from '@/components/AccountList';
import { copy } from '@/lib/copy';

function Ghosts() {
  const params = useSearchParams();
  const band = params.get('band');
  const initialBand: BandFilter | undefined =
    band === 'longstanding' || band === 'recent' ? band : undefined;
  return (
    <ListPage
      direction="following"
      title={copy.lists.ghostsTitle}
      emptyMessage={copy.board.zeroGhosts}
      initialBand={initialBand}
      showReviewFab
    />
  );
}

export default function GhostsPage() {
  return (
    <Suspense>
      <Ghosts />
    </Suspense>
  );
}
