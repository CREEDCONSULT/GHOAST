/**
 * Analysis engine — relationship topology + time, nothing else (spec §3.2).
 *
 * All classification is exact set math over the two export lists:
 *   mutuals  = following ∩ followers
 *   ghosts   = following ∖ followers   (the user follows; not followed back)
 *   fans     = followers ∖ following   (they follow the user; not followed back)
 *
 * Relationship age bands are the product's only ranking signal (spec §11 —
 * "sorting by staleness IS the ranking, and the UI says so").
 */

import type { Band, ParsedExport, Relation, SnapshotCounts } from './types';

export const BAND_RECENT_DAYS = 30;
export const BAND_LONGSTANDING_DAYS = 365;

const DAY_S = 86_400;

export function bandFor(sinceSeconds: number | null, nowMs: number = Date.now()): Band {
  if (sinceSeconds == null) return 'unknown';
  const ageDays = (nowMs / 1000 - sinceSeconds) / DAY_S;
  if (ageDays < BAND_RECENT_DAYS) return 'recent';
  if (ageDays > BAND_LONGSTANDING_DAYS) return 'longstanding';
  return 'settling';
}

export function bandLabel(band: Band): string {
  switch (band) {
    case 'recent':
      return 'recent';
    case 'settling':
      return 'settling';
    case 'longstanding':
      return 'long-standing';
    case 'unknown':
      return 'date unknown';
  }
}

export interface AnalysisResult {
  relations: Relation[];
  counts: SnapshotCounts;
}

export function analyzeExport(parsed: ParsedExport, snapshotId: string): AnalysisResult {
  const followerMap = new Map(parsed.followers.map((f) => [f.username.toLowerCase(), f]));
  const followingMap = new Map(parsed.following.map((f) => [f.username.toLowerCase(), f]));

  const relations: Relation[] = [];
  let mutuals = 0,
    ghosts = 0,
    fans = 0;

  for (const [key, fl] of followingMap) {
    const fr = followerMap.get(key);
    if (fr) {
      mutuals++;
      relations.push({
        snapshotId,
        username: fl.username,
        href: fl.href ?? fr.href,
        direction: 'mutual',
        followingSince: fl.since,
        followerSince: fr.since,
      });
    } else {
      ghosts++;
      relations.push({
        snapshotId,
        username: fl.username,
        href: fl.href,
        direction: 'following', // a "ghost": user follows them, they don't follow back
        followingSince: fl.since,
        followerSince: null,
      });
    }
  }

  for (const [key, fr] of followerMap) {
    if (!followingMap.has(key)) {
      fans++;
      relations.push({
        snapshotId,
        username: fr.username,
        href: fr.href,
        direction: 'follower', // a "fan": they follow the user, user doesn't follow back
        followingSince: null,
        followerSince: fr.since,
      });
    }
  }

  return {
    relations,
    counts: {
      following: parsed.following.length,
      followers: parsed.followers.length,
      mutuals,
      ghosts,
      fans,
    },
  };
}

/**
 * instagram.com profile URL — prefer the export's own href, else derive.
 * The href comes from a user-supplied file: only https instagram.com hosts
 * are trusted (XSS-injection defense; anything else falls back to derived).
 */
export function profileUrl(username: string, href: string | null): string {
  const fallback = `https://instagram.com/${encodeURIComponent(username)}`;
  if (!href) return fallback;
  try {
    const u = new URL(href);
    const hostOk = u.protocol === 'https:' && /(^|\.)instagram\.com$/i.test(u.hostname);
    return hostOk ? href : fallback;
  } catch {
    return fallback;
  }
}

/** Human relationship duration, honest about precision ("since Mar 2021"). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatSince(sinceSeconds: number | null): string | null {
  if (sinceSeconds == null) return null;
  const d = new Date(sinceSeconds * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDuration(sinceSeconds: number | null, nowMs: number = Date.now()): string | null {
  if (sinceSeconds == null) return null;
  const days = Math.max(0, Math.floor((nowMs / 1000 - sinceSeconds) / DAY_S));
  if (days < 30) return days <= 1 ? '1 day' : `${days} days`;
  if (days < 365) {
    const m = Math.round(days / 30.4);
    return m <= 1 ? 'about a month' : `${m} months`;
  }
  const y = Math.floor(days / 365);
  return y <= 1 ? 'over a year' : `${y}+ years`;
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms));
}
