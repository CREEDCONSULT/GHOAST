/**
 * Instagram "Download Your Information" export adapter.
 * Version: dyi-2024-json (Meta DYI JSON structure as of writing).
 *
 * Meta changes export formats occasionally. This adapter is deliberately
 * defensive: it accepts every shape we have seen (top-level array, wrapped
 * in `relationships_*`, nested `string_list_data`) and rejects everything
 * else loudly with a typed error the UI can turn into repair guidance.
 *
 * Expected layout inside the ZIP (verified against real 2026 exports):
 *   connections/followers_and_following/followers_1.json[, followers_2.json, ...]
 *   connections/followers_and_following/following.json
 * Entries — TWO real shapes, both handled:
 *   followers_N.json: top-level array of { title:"", string_list_data:[{ href, value, timestamp }] }
 *                     (username in `value`)
 *   following.json:   { relationships_following: [{ title:"<username>", string_list_data:[{ href, timestamp }] }] }
 *                     (username in `title`; `value` is ABSENT — real Meta drift, caught 2026-10-05)
 *   value/title — username · href — instagram.com/<username> · timestamp — seconds epoch
 * THAT IS EVERYTHING THE EXPORT CONTAINS. (Spec §3.2.)
 *
 * Runs 100% client-side; the bytes never leave the device (architecture
 * promise, spec §14 — enforced platform-wide via connect-src 'self').
 */

import { unzipSync } from 'fflate';
import type { ParsedEntry, ParsedExport } from '../types';
import { ExportParseError } from '../types';

export const ADAPTER_VERSION = 'dyi-2024-json';
const MAX_ZIP_BYTES = 2 * 1024 * 1024 * 1024; // spec §10 S-05: 2GB guard

interface RawStringDatum {
  href?: unknown;
  value?: unknown;
  timestamp?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Pull {username, href, since} out of one string_list_data entry, tolerantly. */
function readDatum(d: unknown): ParsedEntry | null {
  if (!isRecord(d)) return null;
  const raw = d as RawStringDatum;
  const value = typeof raw.value === 'string' ? raw.value.trim() : '';
  if (!value) return null;
  const href = typeof raw.href === 'string' ? raw.href : null;
  const since =
    typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp) && raw.timestamp > 0
      ? raw.timestamp
      : null;
  return { username: value, href, since };
}

/** Collect every string_list_data entry reachable from a parsed JSON root. */
function collectEntries(root: unknown, sink: ParsedEntry[]): void {
  if (Array.isArray(root)) {
    for (const item of root) collectEntries(item, sink);
    return;
  }
  if (!isRecord(root)) return;
  const sld = root['string_list_data'];
  if (Array.isArray(sld)) {
    // Meta shapes (verified against real 2026 exports): if `value` is absent,
    // the username is the parent item's `title`.
    const title = typeof root['title'] === 'string' ? root['title'].trim() : '';
    for (const d of sld) {
      const entry = readDatum(d);
      if (entry) {
        sink.push(entry);
      } else if (title && isRecord(d)) {
        const raw = d as RawStringDatum;
        sink.push({
          username: title,
          href: typeof raw.href === 'string' ? raw.href : null,
          since:
            typeof raw.timestamp === 'number' &&
            Number.isFinite(raw.timestamp) &&
            raw.timestamp > 0
              ? raw.timestamp
              : null,
        });
      }
    }
    return; // a node with string_list_data is a leaf for our purposes
  }
  for (const key of Object.keys(root)) collectEntries(root[key], sink);
}

function dedupe(entries: ParsedEntry[]): ParsedEntry[] {
  const byUser = new Map<string, ParsedEntry>();
  for (const e of entries) {
    const key = e.username.toLowerCase();
    const prev = byUser.get(key);
    if (!prev) {
      byUser.set(key, e);
    } else if (prev.since == null && e.since != null) {
      byUser.set(key, e); // prefer the entry that knows the start date
    }
  }
  return [...byUser.values()];
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Parse an Instagram DYI ZIP. Throws ExportParseError with a typed code on
 * every failure mode the UI knows how to repair (spec §13 step 5, §22).
 */
export async function parseInstagramExport(file: File): Promise<ParsedExport> {
  if (file.size > MAX_ZIP_BYTES) {
    throw new ExportParseError('too_large', file.name);
  }

  let entries: Record<string, Uint8Array>;
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    entries = unzipSync(buf, {
      // Only decompress entries we might care about; leave the rest unread.
      filter: (f) => /followers_and_following\//.test(f.name),
    });
  } catch {
    throw new ExportParseError('not_zip', file.name);
  }

  const names = Object.keys(entries);

  // HTML-format export: structure present, but not machine-readable for us.
  if (
    names.some((n) => /followers_and_following\/.*\.html?$/i.test(n)) &&
    !names.some((n) => /followers_and_following\/.*\.json$/i.test(n))
  ) {
    throw new ExportParseError('html_export', file.name);
  }

  const followerFiles = names
    .filter((n) => /followers_and_following\/followers(_\d+)?\.json$/i.test(n))
    .sort();
  const followingFiles = names.filter((n) =>
    /followers_and_following\/following\.json$/i.test(n),
  );

  if (followerFiles.length === 0 && followingFiles.length === 0) {
    if (names.length === 0) throw new ExportParseError('wrong_file', file.name);
    throw new ExportParseError('missing_lists', file.name);
  }

  const readList = (files: string[]): { entries: ParsedEntry[]; failedFiles: number } => {
    const sink: ParsedEntry[] = [];
    let failedFiles = 0;
    for (const name of files) {
      let root: unknown;
      try {
        root = JSON.parse(decode(entries[name]));
      } catch {
        // A single corrupt split file shouldn't nuke the whole scan — but it
        // IS counted below so an all-corrupt export can't masquerade as empty.
        failedFiles++;
        continue;
      }
      collectEntries(root, sink);
    }
    return { entries: dedupe(sink), failedFiles };
  };

  const followersResult = readList(followerFiles);
  const followingResult = readList(followingFiles);
  const followers = followersResult.entries;
  const following = followingResult.entries;

  // Distinguish "genuinely zero relationships" (valid → zero-ghosts celebration)
  // from "files were unreadable" (error with repair guidance).
  const allFilesFailed =
    followerFiles.length + followingFiles.length > 0 &&
    followersResult.failedFiles + followingResult.failedFiles ===
      followerFiles.length + followingFiles.length;
  if (allFilesFailed) {
    throw new ExportParseError('empty_lists', file.name);
  }

  return { following, followers, partial: followerFiles.length === 0 || followingFiles.length === 0 };
}
