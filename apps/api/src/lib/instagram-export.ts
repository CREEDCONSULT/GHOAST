/**
 * Instagram Data-Export Parser (compliant ingestion)
 *
 * Parses Instagram's official "Download Your Information" export — the user's OWN
 * data, exported by them, uploaded to Ghoast. There is NO Instagram API access,
 * NO session cookie, and NO automation here. Everything is derived from the files
 * the user provides.
 *
 * The export format has shifted across Instagram versions, so parsing is deliberately
 * tolerant: it accepts entries whether they are wrapped under a `relationships_*` key
 * or presented as a bare top-level array, and it skips files it cannot read rather
 * than failing the whole import.
 *
 * Files we care about (JSON export):
 *   connections/followers_and_following/following.json      → who you follow
 *   connections/followers_and_following/followers_1.json…   → who follows you (may be split)
 *   connections/followers_and_following/close_friends.json  → your Close Friends
 *   your_instagram_activity/likes/liked_posts.json          → posts you liked (owner = engagement)
 *   your_instagram_activity/comments/post_comments_1.json…  → comments you left
 */

import { unzipSync, strFromU8 } from 'fflate';
import { logger } from './logger.js';

// ── Errors ──────────────────────────────────────────────────────────────────────

export class ExportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportParseError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FollowEntry {
  username: string;
  href: string | null;
  followedAt: Date | null;
}

export interface EngagementStat {
  likes: number;
  comments: number;
  lastAt: Date | null;
}

export interface ParsedExport {
  following: FollowEntry[];
  followers: FollowEntry[];
  closeFriends: string[];
  /** username (lowercased) → engagement the Ghoast user directed at that account */
  engagement: Map<string, EngagementStat>;
  /** true if the upload included likes/comments files at all (so a zero is a real zero) */
  engagementFilesPresent: boolean;
}

export interface GhostCandidate {
  username: string;
  href: string | null;
  followedAt: Date | null;
  isCloseFriend: boolean;
  likesGiven: number;
  commentsGiven: number;
  lastEngagedAt: Date | null;
}

// ── Filename matchers ───────────────────────────────────────────────────────────

const BASENAME = (path: string): string => path.split('/').pop()?.toLowerCase() ?? '';

const isFollowingFile = (p: string): boolean => /^following(_\d+)?\.json$/.test(BASENAME(p));
const isFollowersFile = (p: string): boolean => /^followers(_\d+)?\.json$/.test(BASENAME(p));
const isCloseFriendsFile = (p: string): boolean => BASENAME(p) === 'close_friends.json';
const isLikedPostsFile = (p: string): boolean =>
  BASENAME(p) === 'liked_posts.json' || BASENAME(p) === 'liked_comments.json';
const isCommentsFile = (p: string): boolean => /^(post_comments|reels_comments)(_\d+)?\.json$/.test(BASENAME(p));

const RELEVANT = (p: string): boolean =>
  isFollowingFile(p) ||
  isFollowersFile(p) ||
  isCloseFriendsFile(p) ||
  isLikedPostsFile(p) ||
  isCommentsFile(p);

// ── Low-level tolerant extractors ────────────────────────────────────────────────

type RawStringListDatum = { href?: unknown; value?: unknown; timestamp?: unknown };
type RawEntry = {
  title?: unknown;
  string_list_data?: RawStringListDatum[];
  string_map_data?: Record<string, { value?: unknown; timestamp?: unknown }>;
};

/**
 * Instagram wraps relationship lists under a `relationships_*` key OR presents them as a
 * bare array. Return the array of entries regardless of which shape we got.
 */
function unwrapEntries(parsed: unknown): RawEntry[] {
  if (Array.isArray(parsed)) return parsed as RawEntry[];
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    // find the first array-valued property (relationships_following / _followers / _close_friends / likes_media_likes …)
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) return value as RawEntry[];
    }
  }
  return [];
}

function toDate(timestamp: unknown): Date | null {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  // Instagram timestamps are Unix seconds
  return new Date(timestamp * 1000);
}

/**
 * Strip NUL bytes and other C0 control characters. PostgreSQL text columns cannot store
 * a NUL (0x00) — it aborts the whole query — and real Instagram handles never contain
 * control characters, so removing them is safe and makes the import robust to odd data.
 */
function sanitize(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 31 || code === 127) continue; // C0 controls + DEL, incl. NUL (0x00)
    out += ch;
  }
  return out.trim();
}

/** Extract {username, href, followedAt} from a relationships-style entry. */
function parseFollowEntry(raw: RawEntry): FollowEntry | null {
  const datum = raw.string_list_data?.[0];
  if (!datum || typeof datum.value !== 'string') return null;
  const username = sanitize(datum.value);
  if (username.length === 0) return null;
  return {
    username,
    href: typeof datum.href === 'string' ? sanitize(datum.href) : null,
    followedAt: toDate(datum.timestamp),
  };
}

function safeJsonParse(content: string): unknown | undefined {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

// ── File-group parsers ───────────────────────────────────────────────────────────

function parseFollowList(content: string): FollowEntry[] {
  const json = safeJsonParse(content);
  if (json === undefined) return [];
  return unwrapEntries(json)
    .map(parseFollowEntry)
    .filter((e): e is FollowEntry => e !== null);
}

function parseCloseFriends(content: string): string[] {
  return parseFollowList(content).map((e) => e.username);
}

/** liked_posts.json: each entry's `title` is the username whose post you liked. */
function accrueLikes(content: string, engagement: Map<string, EngagementStat>): void {
  const json = safeJsonParse(content);
  if (json === undefined) return;
  for (const raw of unwrapEntries(json)) {
    if (typeof raw.title !== 'string' || raw.title.length === 0) continue;
    const at = toDate(raw.string_list_data?.[0]?.timestamp);
    bump(engagement, raw.title, 'likes', at);
  }
}

/** post_comments_1.json: string_map_data may carry a "Media Owner" and a "Time". */
function accrueComments(content: string, engagement: Map<string, EngagementStat>): void {
  const json = safeJsonParse(content);
  if (json === undefined) return;
  for (const raw of unwrapEntries(json)) {
    const map = raw.string_map_data;
    const ownerRaw =
      map?.['Media Owner']?.value ?? map?.['media_owner']?.value ?? (typeof raw.title === 'string' ? raw.title : undefined);
    if (typeof ownerRaw !== 'string' || ownerRaw.length === 0) continue;
    const at = toDate(map?.['Time']?.timestamp ?? map?.['time']?.timestamp);
    bump(engagement, ownerRaw, 'comments', at);
  }
}

function bump(
  engagement: Map<string, EngagementStat>,
  username: string,
  kind: 'likes' | 'comments',
  at: Date | null,
): void {
  const key = sanitize(username).toLowerCase();
  if (key.length === 0) return;
  const cur = engagement.get(key) ?? { likes: 0, comments: 0, lastAt: null };
  cur[kind] += 1;
  if (at && (!cur.lastAt || at > cur.lastAt)) cur.lastAt = at;
  engagement.set(key, cur);
}

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Parse a map of {filepath → text content} into a normalized export.
 * Filepaths may be full export paths or bare filenames.
 */
export function parseExportFiles(files: Record<string, string>): ParsedExport {
  const following: FollowEntry[] = [];
  const followers: FollowEntry[] = [];
  const closeFriends: string[] = [];
  const engagement = new Map<string, EngagementStat>();
  let engagementFilesPresent = false;

  for (const [path, content] of Object.entries(files)) {
    if (isFollowingFile(path)) following.push(...parseFollowList(content));
    else if (isFollowersFile(path)) followers.push(...parseFollowList(content));
    else if (isCloseFriendsFile(path)) closeFriends.push(...parseCloseFriends(content));
    else if (isLikedPostsFile(path)) {
      engagementFilesPresent = true;
      accrueLikes(content, engagement);
    } else if (isCommentsFile(path)) {
      engagementFilesPresent = true;
      accrueComments(content, engagement);
    }
  }

  if (following.length === 0 && followers.length === 0) {
    throw new ExportParseError(
      'No following.json or followers file was found in the upload. Make sure you selected ' +
        '"Followers and following" in JSON format when requesting your Instagram data.',
    );
  }

  const result = {
    following: dedupeByUsername(following),
    followers: dedupeByUsername(followers),
    closeFriends: Array.from(new Set(closeFriends)),
    engagement,
    engagementFilesPresent,
  };
  logger.info(
    {
      following: result.following.length,
      followers: result.followers.length,
      closeFriends: result.closeFriends.length,
      engagement: result.engagement.size,
      engagementFilesPresent,
      sampleFollowing: result.following.slice(0, 3).map((f) => f.username),
      sampleFollowers: result.followers.slice(0, 3).map((f) => f.username),
    },
    'export parsed counts',
  );
  return result;
}

/**
 * Parse a full Instagram export ZIP. Extracts only the relevant JSON files
 * (ignores photos/videos/messages) to keep memory bounded.
 */
export function parseExportZip(zipBuffer: Buffer | Uint8Array): ParsedExport {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBuffer instanceof Buffer ? new Uint8Array(zipBuffer) : zipBuffer, {
      filter: (file) => RELEVANT(file.name),
    });
  } catch {
    throw new ExportParseError(
      'Could not read that file as a ZIP. Upload the .zip Instagram emailed you, or the ' +
        'individual .json files (following.json and followers_1.json).',
    );
  }

  const files: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(entries)) {
    files[name] = strFromU8(bytes);
  }
  // Diagnostic: which relevant files (and sizes) did we actually receive in the upload?
  logger.info(
    { zipEntries: Object.entries(entries).map(([n, b]) => `${n}:${b.length}`) },
    'export zip parsed',
  );
  return parseExportFiles(files);
}

/**
 * Ghosts = accounts you follow that do not follow you back (case-insensitive on handle),
 * enriched with your own engagement + close-friend membership.
 */
export function computeGhosts(parsed: ParsedExport): GhostCandidate[] {
  const followerSet = new Set(parsed.followers.map((f) => f.username.toLowerCase()));
  const closeFriendSet = new Set(parsed.closeFriends.map((u) => u.toLowerCase()));

  return parsed.following
    .filter((f) => !followerSet.has(f.username.toLowerCase()))
    .map((f) => {
      const eng = parsed.engagement.get(f.username.toLowerCase());
      return {
        username: f.username,
        href: f.href,
        followedAt: f.followedAt,
        isCloseFriend: closeFriendSet.has(f.username.toLowerCase()),
        likesGiven: eng?.likes ?? 0,
        commentsGiven: eng?.comments ?? 0,
        lastEngagedAt: eng?.lastAt ?? null,
      };
    });
}

function dedupeByUsername(entries: FollowEntry[]): FollowEntry[] {
  const seen = new Map<string, FollowEntry>();
  for (const e of entries) {
    const key = e.username.toLowerCase();
    if (!seen.has(key)) seen.set(key, e);
  }
  return Array.from(seen.values());
}
