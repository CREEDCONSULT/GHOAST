'use client';

import { ListPage } from '@/components/ListPage';
import { copy } from '@/lib/copy';

export default function FansPage() {
  return (
    <ListPage
      direction="follower"
      title={copy.lists.fansTitle}
      emptyMessage={copy.lists.noFans}
      showBandFilters={false}
    />
  );
}
