import { diffSnapshots } from '@/lib/comparison';
import type { Decision, Relation } from '@/lib/types';

function rel(snapshotId: string, username: string, direction: Relation['direction']): Relation {
  return { snapshotId, username, href: null, direction, followingSince: 100, followerSince: 100 };
}

describe('comparison engine', () => {
  const from = 'snap-a';
  const to = 'snap-b';

  it('computes all five delta groups exactly', () => {
    const prev: Relation[] = [
      rel(from, 'mutual_stays', 'mutual'),
      rel(from, 'ghost_becomes_mutual', 'following'),
      rel(from, 'ghost_stays', 'following'),
      rel(from, 'i_unfollowed', 'following'),
      rel(from, 'fan_stays', 'follower'),
      rel(from, 'fan_left', 'follower'),
    ];
    const next: Relation[] = [
      rel(to, 'mutual_stays', 'mutual'),
      rel(to, 'ghost_becomes_mutual', 'mutual'),
      rel(to, 'ghost_stays', 'following'),
      rel(to, 'fan_stays', 'follower'),
      rel(to, 'brand_new_ghost', 'following'),
      rel(to, 'brand_new_follower', 'follower'),
    ];

    const decisions: Decision[] = [
      {
        username: 'i_unfollowed',
        state: 'queued',
        updatedAt: 0,
        sourceScanId: from,
        href: null,
        stillPresent: false,
      },
    ];

    const c = diffSnapshots(prev, next, decisions, from, to);
    expect(c.newGhosts).toEqual(['brand_new_ghost']);
    expect(c.becameMutual).toEqual(['ghost_becomes_mutual']);
    expect(c.youUnfollowed).toEqual(['i_unfollowed']);
    // "ghost_becomes_mutual" is legitimately BOTH a became-mutual and a new follower
    expect(c.newFollowers).toEqual(['brand_new_follower', 'ghost_becomes_mutual']);
    expect(c.lostFollowers).toEqual(['fan_left']);
    // "i_unfollowed" had a queued decision and is now gone from both lists → vanished tracks it
    expect(c.vanished).toEqual(['i_unfollowed']);
  });

  it('is case-insensitive across snapshots', () => {
    const prev = [rel(from, 'Alice', 'following')];
    const next = [rel(to, 'alice', 'following')];
    const c = diffSnapshots(prev, next, [], from, to);
    expect(c.youUnfollowed).toEqual([]);
    expect(c.newGhosts).toEqual([]);
  });
});
