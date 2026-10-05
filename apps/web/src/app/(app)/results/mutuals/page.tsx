'use client';

import { ListPage } from '@/components/ListPage';
import { copy } from '@/lib/copy';

export default function MutualsPage() {
  return (
    <ListPage
      direction="mutual"
      title={copy.lists.mutualsTitle}
      emptyMessage={copy.lists.noMutuals}
      showBandFilters={false}
    />
  );
}
