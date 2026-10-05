import { analyzeExport, bandFor, profileUrl } from '@/lib/analysis';

describe('analysis engine', () => {
  const snap = 'snap-1';

  it('classifies mutuals, ghosts and fans exactly', () => {
    const { relations, counts } = analyzeExport(
      {
        following: [
          { username: 'mutual1', href: null, since: 100 },
          { username: 'ghost1', href: null, since: 200 },
        ],
        followers: [
          { username: 'mutual1', href: null, since: 150 },
          { username: 'fan1', href: null, since: 300 },
        ],
        partial: false,
      },
      snap,
    );
    expect(counts).toEqual({ following: 2, followers: 2, mutuals: 1, ghosts: 1, fans: 1 });
    const byName = Object.fromEntries(relations.map((r) => [r.username, r]));
    expect(byName['mutual1'].direction).toBe('mutual');
    expect(byName['mutual1'].followingSince).toBe(100);
    expect(byName['mutual1'].followerSince).toBe(150);
    expect(byName['ghost1'].direction).toBe('following');
    expect(byName['fan1'].direction).toBe('follower');
  });

  it('bands by relationship age: recent < 30d, long-standing > 1y', () => {
    const now = Date.UTC(2026, 8, 30); // 2026-09-30
    const s = (days: number) => now / 1000 - days * 86400;
    expect(bandFor(s(5), now)).toBe('recent');
    expect(bandFor(s(200), now)).toBe('settling');
    expect(bandFor(s(800), now)).toBe('longstanding');
    expect(bandFor(null, now)).toBe('unknown');
  });

  it('profileUrl trusts only https instagram.com hrefs (XSS defense)', () => {
    expect(profileUrl('alice', null)).toBe('https://instagram.com/alice');
    expect(profileUrl('alice', 'https://www.instagram.com/alice')).toBe('https://www.instagram.com/alice');
    expect(profileUrl('alice', 'javascript:alert(1)')).toBe('https://instagram.com/alice');
    expect(profileUrl('alice', 'https://evil.example.com/alice')).toBe('https://instagram.com/alice');
    expect(profileUrl('alice', 'http://instagram.com/alice')).toBe('https://instagram.com/alice');
  });
});
