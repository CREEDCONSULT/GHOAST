/**
 * Real-export compatibility tests.
 *
 * If REAL_EXPORT_DIR is set (or known local paths exist), the parser is run
 * against genuine Instagram DYI exports and we assert it produces a coherent
 * result. On machines without real exports these tests are skipped — the
 * synthetic fixtures in parser.test.ts (built to match the observed real
 * structures) are the CI guarantee.
 */

import { existsSync, readdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeExport } from '@/lib/analysis';
import { parseInstagramExport } from '@/lib/parser/instagram-dyi';

const CANDIDATES: string[] = [
  ...(process.env.REAL_EXPORT_DIR && existsSync(process.env.REAL_EXPORT_DIR)
    ? readdirSync(process.env.REAL_EXPORT_DIR)
        .filter((f) => /^instagram-.*\.zip$/i.test(f))
        .map((f) => join(process.env.REAL_EXPORT_DIR as string, f))
    : []),
  // developer machine paths (skipped silently elsewhere)
  'C:/Users/daunt/Downloads/instagram-mr.c.mezie-2026-07-14-uBP6HrBg.zip',
  'C:/Users/daunt/Downloads/instagram-mr.c.mezie-2026-07-15-25aK58qJ.zip',
  'C:/Users/daunt/Downloads/instagram-mr.c.mezie-2026-07-15-BxlmW4Ud.zip',
].filter((p) => existsSync(p));

const describeIfReal = CANDIDATES.length > 0 ? describe : describe.skip;

describeIfReal('real Instagram exports', () => {
  for (const path of CANDIDATES) {
    test(`parses ${path.split(/[\\/]/).pop()}`, async () => {
      const buf = readFileSync(path);
      const file = new File([buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer], path, {
        type: 'application/zip',
      });
      const parsed = await parseInstagramExport(file);
      expect(parsed.partial).toBe(false);
      expect(parsed.followers.length).toBeGreaterThan(0);
      expect(parsed.following.length).toBeGreaterThan(0);
      // Real exports always carry timestamps + hrefs on every entry
      expect(parsed.followers.every((f) => f.since != null && f.href != null)).toBe(true);
      expect(parsed.following.every((f) => f.since != null && f.href != null)).toBe(true);

      const { counts } = analyzeExport(parsed, 'real-test');
      expect(counts.mutuals + counts.ghosts).toBe(counts.following);
      expect(counts.mutuals + counts.fans).toBe(counts.followers);
    });
  }
});
