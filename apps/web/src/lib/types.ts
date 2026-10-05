/**
 * GHOAST data model — spec §26.3.
 *
 * Everything GHOAST knows derives from exactly two lists in the user's own
 * Instagram "Download Your Information" export: followers and following.
 * Each entry contributes a username, a profile URL, and (usually) the
 * timestamp the relationship started. Nothing else is knowable, so nothing
 * else is stored. (Spec §3.2 — the Export Constraint.)
 */

export type Direction = 'following' | 'follower' | 'mutual';

export interface SnapshotCounts {
  following: number;
  followers: number;
  mutuals: number;
  ghosts: number;
  fans: number;
}

export interface Snapshot {
  id: string;
  createdAt: number; // ms epoch — when GHOAST processed it
  fileName: string;
  fileHash: string; // sha-256 of the ZIP bytes, for duplicate detection
  fileLastModified: number | null; // File.lastModified (export freshness hint)
  counts: SnapshotCounts;
  /** true when only one of the two lists was present (partial mode, spec §22) */
  partial: boolean;
}

export interface Relation {
  id?: number;
  snapshotId: string;
  username: string;
  href: string | null; // instagram.com/<username> URL from the export itself
  direction: Direction;
  followingSince: number | null; // seconds epoch — when the user followed them
  followerSince: number | null; // seconds epoch — when they followed the user
}

/**
 * Decisions are username-keyed and scan-independent (spec §26.3): a Kept
 * account stays protected across every future scan.
 */
export type DecisionState =
  | 'kept'
  | 'queued'
  | 'saved'
  | 'handled_self' // user told us they unfollowed — not yet verified
  | 'handled_verified'; // a later export confirmed the account is gone

export interface Decision {
  username: string;
  state: DecisionState;
  updatedAt: number;
  sourceScanId: string; // scan in which the decision was last changed
  href: string | null; // remembered so cleanup links survive renames/vanish
  stillPresent: boolean; // handled_self but the account still appears in the latest scan
}

export interface Comparison {
  id: string;
  fromSnapshotId: string;
  toSnapshotId: string;
  createdAt: number;
  newGhosts: string[];
  becameMutual: string[];
  youUnfollowed: string[]; // verified by export: previously following, now not
  newFollowers: string[];
  lostFollowers: string[];
  vanished: string[]; // had a decision, now in neither list: renamed/deactivated/removed — we can't tell which (spec §22)
}

export type LedgerAction =
  | 'kept'
  | 'unkept'
  | 'queued'
  | 'unqueued'
  | 'saved'
  | 'unsaved'
  | 'skipped'
  | 'handled_self'
  | 'handled_verified'
  | 'reset'; // moved back to unreviewed

export interface LedgerEvent {
  id?: number;
  ts: number;
  username: string;
  action: LedgerAction;
  prevState: DecisionState | null;
  newState: DecisionState | null;
  snapshotId: string; // scan context in which the event happened
}

export interface SettingsRecord {
  id: 'app';
  theme: 'dark' | 'light';
  reducedMotion: boolean;
  pacingThreshold: number; // break sheet after N Instagram opens (spec default 25)
  plan: 'free' | 'plus';
  /** Stripe Checkout session id used to grant `plus`; enables restore/recheck */
  stripeSessionId: string | null;
  /** Opt-in anonymous analytics (default off) — docs/production/ANALYTICS_SCHEMA.md */
  analyticsOptIn: boolean;
  /** Random anonymous id for analytics; regenerable, never tied to any account */
  analyticsId: string | null;
  seenCoachMarks: string[];
  guideStep: number; // /get-my-file progress persistence
  /** Interruption recovery (spec §22): name of the file being processed when interrupted */
  pendingJobFileName: string | null;
  /** Review-session resume (spec §12): snapshot + counter when a deck session was open */
  reviewSession: { snapshotId: string; done: number; opensSinceBreak: number } | null;
}

// ── Cleanup batches (Batch Cleanup Assistant v1) ────────────────────────────
// Execution is ALWAYS user-directed: the batch orders work; a human (or the
// optional browser assistant driven by an explicit user-started session) acts
// inside Instagram. A browser action may only ever become handled_self; only
// a later export can reconcile to handled_verified (invariant, spec §8.5).

export type CleanupBatchStatus = 'draft' | 'running' | 'paused' | 'stopped' | 'done';

export type CleanupReceiptKind =
  | 'opened' // profile opened for the user to act on
  | 'requested' // assistant attempted an unfollow click
  | 'confirmed' // user/assistant confirmed the unfollow happened (self-reported)
  | 'skipped' // user/assistant intentionally passed
  | 'failed' // action could not be completed (ambiguous/absent controls…)
  | 'stopped'; // session halted (pacing break, challenge, user stop)

export interface CleanupReceipt {
  ts: number;
  username: string;
  kind: CleanupReceiptKind;
  detail?: string; // freeform reason for failed/stopped — never raw DOM or page data
}

export interface CleanupPacing {
  /** seconds between assistant-driven actions (assistant path) */
  intervalSeconds: number;
  /** break reminder after this many opens/actions */
  breakEvery: number;
}

export interface CleanupBatch {
  id: string;
  sourceSnapshotId: string;
  createdAt: number;
  status: CleanupBatchStatus;
  usernames: string[]; // ordered work list (no duplicates by construction)
  currentIndex: number;
  completed: number;
  skipped: number;
  failed: number;
  pacing: CleanupPacing;
  receipts: CleanupReceipt[];
  /** 'manual' = user drives via deep links; 'extension' = browser assistant */
  driver: 'manual' | 'extension';
}

export const DEFAULT_CLEANUP_PACING: CleanupPacing = { intervalSeconds: 45, breakEvery: 25 };

export const DEFAULT_SETTINGS: SettingsRecord = {
  id: 'app',
  theme: 'dark',
  reducedMotion: false,
  pacingThreshold: 25,
  plan: 'free',
  stripeSessionId: null,
  analyticsOptIn: false,
  analyticsId: null,
  seenCoachMarks: [],
  guideStep: 0,
  pendingJobFileName: null,
  reviewSession: null,
};

/** Relationship-age bands (display-only derived grouping — spec §11). */
export type Band = 'recent' | 'settling' | 'longstanding' | 'unknown';

export interface ParsedEntry {
  username: string;
  href: string | null;
  since: number | null;
}

export interface ParsedExport {
  following: ParsedEntry[];
  followers: ParsedEntry[];
  partial: boolean;
}

export type ParseErrorCode =
  | 'not_zip' // file could not be inflated at all
  | 'wrong_file' // valid zip, but no Instagram export structure inside
  | 'html_export' // export delivered in HTML format — needs re-request as JSON
  | 'missing_lists' // followers_and_following present but both lists unusable
  | 'empty_lists' // lists parsed to zero entries
  | 'incomplete' // only one of followers/following present — ghosts are uncomputable
  | 'too_large';

export class ExportParseError extends Error {
  readonly code: ParseErrorCode;
  readonly fileName: string;
  constructor(code: ParseErrorCode, fileName: string, detail?: string) {
    super(detail ?? code);
    this.name = 'ExportParseError';
    this.code = code;
    this.fileName = fileName;
  }
}
