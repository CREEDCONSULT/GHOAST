import { parseInstagramExport } from '@/lib/parser/instagram-dyi';
import { ExportParseError } from '@/lib/types';
import {
  buildCorruptFile,
  buildEmptyListsZip,
  buildExportZip,
  buildHtmlExportZip,
  buildWrongFileZip,
} from './helpers';

describe('instagram-dyi adapter', () => {
  it('parses following + followers with timestamps and hrefs', async () => {
    const file = buildExportZip({
      following: [
        { username: 'alice', since: 1700000000 },
        { username: 'bob' }, // no timestamp — must not break parsing
      ],
      followers: [{ username: 'alice', since: 1700000100 }],
    });
    const parsed = await parseInstagramExport(file);
    expect(parsed.partial).toBe(false);
    expect(parsed.following).toHaveLength(2);
    expect(parsed.followers).toHaveLength(1);
    const alice = parsed.following.find((f) => f.username === 'alice');
    expect(alice?.since).toBe(1700000000);
    expect(alice?.href).toContain('instagram.com/alice');
    const bob = parsed.following.find((f) => f.username === 'bob');
    expect(bob?.since).toBeNull();
  });

  it('merges split followers files (followers_1.json, followers_2.json)', async () => {
    const file = buildExportZip({
      following: [{ username: 'alice' }],
      followers: [{ username: 'alice' }, { username: 'carol' }, { username: 'dave' }],
      splitFollowers: true,
    });
    const parsed = await parseInstagramExport(file);
    expect(parsed.followers).toHaveLength(3);
  });

  it('dedupes case-insensitively, preferring entries with timestamps', async () => {
    const file = buildExportZip({
      following: [{ username: 'Alice' }],
      followers: [{ username: 'alice', since: 1700000000 }, { username: 'ALICE' }],
    });
    const parsed = await parseInstagramExport(file);
    expect(parsed.followers).toHaveLength(1);
    expect(parsed.followers[0].since).toBe(1700000000);
  });

  it('rejects HTML exports with a repairable error', async () => {
    await expect(parseInstagramExport(buildHtmlExportZip())).rejects.toMatchObject({
      code: 'html_export',
    });
  });

  it('rejects non-Instagram zips', async () => {
    await expect(parseInstagramExport(buildWrongFileZip())).rejects.toMatchObject({
      code: 'wrong_file',
    });
  });

  it('rejects corrupt files as not_zip', async () => {
    await expect(parseInstagramExport(buildCorruptFile())).rejects.toMatchObject({
      code: 'not_zip',
    });
  });

  it('accepts a genuinely zero-relationship export (valid empty lists)', async () => {
    const parsed = await parseInstagramExport(buildEmptyListsZip());
    expect(parsed.following).toHaveLength(0);
    expect(parsed.followers).toHaveLength(0);
    expect(parsed.partial).toBe(false);
  });

  it('rejects exports whose list files are all corrupt JSON', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const file = new File(
      [zipSync({
        'connections/followers_and_following/followers_1.json': strToU8('{not json'),
        'connections/followers_and_following/following.json': strToU8('{"relationships_following": [{{'),
      }).slice().buffer as ArrayBuffer],
      'corrupt-lists.zip',
      { type: 'application/zip' },
    );
    await expect(parseInstagramExport(file)).rejects.toMatchObject({ code: 'empty_lists' });
  });

  it('parses the real 2026 shape: following.json with title-based usernames (no value field)', async () => {
    // Regression for the real-export drift found 2026-10-05 — without this,
    // every genuine export parsed as "0 following".
    const file = buildExportZip({
      following: [{ username: 'realuser', since: 1700000000 }],
      followers: [],
    });
    const parsed = await parseInstagramExport(file);
    expect(parsed.following).toEqual([
      { username: 'realuser', href: 'https://www.instagram.com/realuser', since: 1700000000 },
    ]);
  });

  it('rejects a >2GB file before reading it', async () => {
    const big = new File([], 'huge.zip');
    Object.defineProperty(big, 'size', { value: 2 * 1024 * 1024 * 1024 + 1 });
    await expect(parseInstagramExport(big)).rejects.toBeInstanceOf(ExportParseError);
    await expect(parseInstagramExport(big)).rejects.toMatchObject({ code: 'too_large' });
  });

  it('handles a large export (10k relationships) comfortably under the 8s target', async () => {
    const following = Array.from({ length: 6000 }, (_, i) => ({ username: `f_${i}`, since: 1_600_000_000 + i }));
    const followers = Array.from({ length: 4500 }, (_, i) => ({ username: `f_${i}`, since: 1_600_000_000 + i }));
    const file = buildExportZip({ following, followers });
    const start = performance.now();
    const parsed = await parseInstagramExport(file);
    expect(parsed.following).toHaveLength(6000);
    expect(parsed.followers).toHaveLength(4500);
    expect(performance.now() - start).toBeLessThan(8000);
  });
});
