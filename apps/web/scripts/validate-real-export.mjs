/**
 * Real-export validation harness (production hardening, phase 2).
 * Reads a real Instagram DYI ZIP from disk and reports:
 *  - top-level structure (paths only, first 40)
 *  - followers_and_following entries found (JSON vs HTML)
 *  - parse result via the same tolerant logic as the app adapter:
 *    counts, timestamps presence, href presence, anomalies
 * Prints NO usernames — aggregates only (privacy).
 */

import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';

const [, , zipPath] = process.argv;
if (!zipPath) {
  console.error('usage: node validate-real-export.mjs <path-to.zip>');
  process.exit(1);
}

const buf = new Uint8Array(readFileSync(zipPath));

console.log('file:', zipPath);
console.log('bytes:', buf.length);

// List entry names by scanning the ZIP central directory (no decompression).
function listZipNames(data) {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // find End Of Central Directory (signature 0x06054b50) from the tail
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65558); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip (no EOCD)');
  const count = dv.getUint16(eocd + 10, true);
  let offset = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(offset, true) !== 0x02014b50) break;
    const nameLen = dv.getUint16(offset + 28, true);
    const extraLen = dv.getUint16(offset + 30, true);
    const commentLen = dv.getUint16(offset + 32, true);
    const compSize = dv.getUint32(offset + 20, true);
    const name = new TextDecoder().decode(data.subarray(offset + 46, offset + 46 + nameLen));
    out.push({ name, compSize });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

let listing;
try {
  listing = listZipNames(buf);
} catch (e) {
  console.error('FAILED to read as zip:', e.message);
  process.exit(2);
}
const names = listing.map((l) => l.name);

console.log('total entries:', names.length);
const ff = names.filter((n) => /followers_and_following/i.test(n));
console.log('followers_and_following entries:', ff);
const anyHtml = ff.some((n) => /\.html?$/i.test(n));
const anyJson = ff.some((n) => /\.json$/i.test(n));
console.log('format:', anyJson ? 'JSON' : anyHtml ? 'HTML' : 'NONE FOUND');

if (!anyJson) process.exit(0);

const entries = unzipSync(buf, { filter: (f) => /followers_and_following\/.*\.json$/i.test(f.name) });
const jsonNames = Object.keys(entries);

function collect(root, sink) {
  if (Array.isArray(root)) {
    for (const item of root) collect(item, sink);
    return;
  }
  if (typeof root !== 'object' || root === null) return;
  const sld = root['string_list_data'];
  if (Array.isArray(sld)) {
    for (const d of sld) {
      if (d && typeof d === 'object' && typeof d.value === 'string' && d.value.trim()) {
        sink.push({
          hasHref: typeof d.href === 'string' && d.href.length > 0,
          hasTs: typeof d.timestamp === 'number' && d.timestamp > 0,
        });
      }
    }
    return;
  }
  for (const k of Object.keys(root)) collect(root[k], sink);
}

for (const name of jsonNames) {
  const sink = [];
  let ok = true;
  let rootKeys = null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(entries[name]));
    rootKeys = Array.isArray(parsed) ? ['<array>'] : Object.keys(parsed);
    collect(parsed, sink);
  } catch (e) {
    ok = false;
    console.log(`\n${name}: JSON PARSE FAILED: ${e.message}`);
    continue;
  }
  const withTs = sink.filter((s) => s.hasTs).length;
  const withHref = sink.filter((s) => s.hasHref).length;
  console.log(`\n${name}`);
  console.log('  root keys:', rootKeys);
  console.log('  entries:', sink.length, `| with timestamp: ${withTs} | with href: ${withHref}`);
}
