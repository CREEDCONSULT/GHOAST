/**
 * Client-side export trimming.
 *
 * Instagram's full "Download your information" ZIP can be hundreds of MB (it includes
 * all your photos/videos/messages). Ghoast only needs a handful of small JSON files.
 * Rather than upload the whole thing (which blows past the server's size limit), we
 * open the ZIP in the browser, keep only the relevant JSON files, and repackage them
 * into a tiny ZIP that uploads in seconds.
 */

import { unzipSync, zipSync, strToU8 } from 'fflate';

// Only read files up to this size into memory in the browser (guards against OOM on
// enormous exports). The relevant JSON is tiny; this ceiling is about the container ZIP.
const MAX_READ_BYTES = 400 * 1024 * 1024; // 400 MB

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
      'That file is very large. Re-request your export and choose "Some of your information" ' +
        '— just Followers and following (plus Likes and Comments) — in JSON format.',
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

function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
}

/**
 * Returns a small File ready to upload: for a ZIP, a trimmed ZIP of only the relevant
 * JSON files; for a single JSON file, the file unchanged.
 */
export async function prepareExportForUpload(file: File): Promise<File> {
  const name = file.name.toLowerCase();

  // A single JSON file is already small — pass it through.
  if (name.endsWith('.json') && !name.endsWith('.zip')) return file;

  if (file.size > MAX_READ_BYTES) throw new ExportTooLargeError();

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeZip(bytes)) {
    // Not a zip and not .json — let the server try to parse it as a single file.
    return file;
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: (f) => isRelevant(f.name) });
  } catch {
    throw new NoRelevantFilesError();
  }

  const kept = Object.entries(entries).filter(([, data]) => data.length > 0);
  if (kept.length === 0) throw new NoRelevantFilesError();

  // Flatten paths to basenames (the server parser matches on basename anyway) and repackage.
  const trimmed: Record<string, Uint8Array> = {};
  for (const [path, data] of kept) trimmed[BASENAME(path)] = data;

  const zipped = zipSync(trimmed, { level: 6 });
  // Copy into a fresh Uint8Array so the Blob owns a clean ArrayBuffer.
  const out = new Uint8Array(zipped.length);
  out.set(zipped);
  return new File([out], 'ghoast-export.zip', { type: 'application/zip' });
}

// Re-exported for callers that want to encode fixture data in tests.
export { strToU8 };
