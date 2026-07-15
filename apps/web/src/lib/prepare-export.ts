/**
 * Client-side export trimming (streaming).
 *
 * Instagram's full "Download your information" ZIP can be many hundreds of MB or even
 * GBs (it includes all your photos/videos/messages). Ghoast only needs a handful of
 * small JSON files. We stream the ZIP through fflate in the browser — reading it in
 * chunks and decompressing ONLY the relevant JSON entries (media entries are skipped
 * without being loaded) — then repackage the tiny result for upload. Memory stays low
 * regardless of how large the original export is.
 */

import { Unzip, UnzipInflate, zipSync } from 'fflate';

// Sanity ceiling — streaming keeps memory low, but refuse truly absurd inputs.
const MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB

const BASENAME = (path: string): string => path.split('/').pop()?.toLowerCase() ?? '';
const isRelevant = (p: string): boolean => {
  const b = BASENAME(p);
  return (
    /^following(_\d+)?\.json$/.test(b) ||
    /^followers(_\d+)?\.json$/.test(b) ||
    b === 'close_friends.json' ||
    b === 'liked_posts.json' ||
    b === 'liked_comments.json' ||
    /^(post_comments|reels_comments)(_\d+)?\.json$/.test(b)
  );
};

export class ExportTooLargeError extends Error {
  constructor() {
    super(
      'That file is unexpectedly huge. Re-request your export and choose "Some of your ' +
        'information" — Followers and following (plus Likes and Comments) — in JSON format.',
    );
    this.name = 'ExportTooLargeError';
  }
}

export class NoRelevantFilesError extends Error {
  constructor() {
    super(
      'Couldn’t find your followers/following data in that file. Make sure you selected ' +
        '"Followers and following" in JSON (not HTML) format when requesting your export.',
    );
    this.name = 'NoRelevantFilesError';
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Returns a small File ready to upload: for a ZIP, a trimmed ZIP of only the relevant
 * JSON files; for a single JSON file, the file unchanged.
 */
export async function prepareExportForUpload(file: File): Promise<File> {
  const name = file.name.toLowerCase();

  // A single JSON file is already small — pass it through.
  if (name.endsWith('.json') && !name.endsWith('.zip')) return file;

  if (file.size > MAX_FILE_BYTES) throw new ExportTooLargeError();

  const collected: Record<string, Uint8Array[]> = {};
  let streamError: unknown = null;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (entry) => {
    if (!isRelevant(entry.name)) return; // skip media: never start() → data isn't decompressed
    const base = BASENAME(entry.name);
    const parts: Uint8Array[] = [];
    collected[base] = parts;
    entry.ondata = (err, chunk) => {
      if (err) streamError = err;
      else if (chunk && chunk.length) parts.push(chunk);
    };
    entry.start();
  };

  const reader = file.stream().getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) unzip.push(value, false);
      if (streamError) throw streamError;
    }
    unzip.push(new Uint8Array(0), true);
  } catch {
    // Not a readable ZIP (e.g. HTML export, corrupt file) — or an inflate error.
    reader.releaseLock?.();
    throw new NoRelevantFilesError();
  }

  const trimmed: Record<string, Uint8Array> = {};
  for (const [base, parts] of Object.entries(collected)) {
    const data = concat(parts);
    if (data.length > 0) trimmed[base] = data;
  }

  if (Object.keys(trimmed).length === 0) throw new NoRelevantFilesError();

  const zipped = zipSync(trimmed, { level: 6 });
  const out = new Uint8Array(zipped.length);
  out.set(zipped);
  return new File([out], 'ghoast-export.zip', { type: 'application/zip' });
}
