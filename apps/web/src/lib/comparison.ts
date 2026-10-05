/**
 * Comparison engine — pure set diffs between two snapshots (spec §11, §S-16).
 *
 * Everything here is exact username-set arithmetic; nothing is inferred.
 * "You unfollowed" means: in your previous following list, not in your new
 * one — provable from the two exports. "Vanished" means: an account you had
 * a decision about is in neither list now — it changed username, deactivated
 * or was removed, and we honestly cannot tell which (spec §22).
 */

import type { Comparison, Decision, Relation } from './types';

function sets(relations: Relation[]) {
  const following = new Set<string>();
  const followers = new Set<string>();
  for (const r of relations) {
    const u = r.username.toLowerCase();
    if (r.direction === 'following' || r.direction === 'mutual') following.add(u);
    if (r.direction === 'follower' || r.direction === 'mutual') followers.add(u);
  }
  return { following, followers };
}

export function diffSnapshots(
  fromRelations: Relation[],
  toRelations: Relation[],
  decisions: Decision[],
  fromSnapshotId: string,
  toSnapshotId: string,
): Comparison {
  const prev = sets(fromRelations);
  const next = sets(toRelations);

  const prevGhosts = new Set([...prev.following].filter((u) => !prev.followers.has(u)));
  const nextGhosts = new Set([...next.following].filter((u) => !next.followers.has(u)));

  const newGhosts = [...nextGhosts].filter((u) => !prevGhosts.has(u));
  const becameMutual = [...prevGhosts].filter((u) => next.following.has(u) && next.followers.has(u));
  const youUnfollowed = [...prev.following].filter((u) => !next.following.has(u));
  const newFollowers = [...next.followers].filter((u) => !prev.followers.has(u));
  const lostFollowers = [...prev.followers].filter((u) => !next.followers.has(u));

  const knownNext = new Set([...next.following, ...next.followers]);
  const vanished = decisions
    .filter((d) => d.state === 'kept' || d.state === 'queued' || d.state === 'saved')
    .map((d) => d.username.toLowerCase())
    .filter((u) => !knownNext.has(u));

  const sortCaseInsensitive = (a: string, b: string) => a.localeCompare(b);

  return {
    id: `${fromSnapshotId}→${toSnapshotId}`,
    fromSnapshotId,
    toSnapshotId,
    createdAt: Date.now(),
    newGhosts: newGhosts.sort(sortCaseInsensitive),
    becameMutual: becameMutual.sort(sortCaseInsensitive),
    youUnfollowed: youUnfollowed.sort(sortCaseInsensitive),
    newFollowers: newFollowers.sort(sortCaseInsensitive),
    lostFollowers: lostFollowers.sort(sortCaseInsensitive),
    vanished: vanished.sort(sortCaseInsensitive),
  };
}
