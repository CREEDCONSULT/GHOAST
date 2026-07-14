import { describe, it, expect } from '@jest/globals';
import { zipSync, strToU8 } from 'fflate';
import {
  parseExportFiles,
  parseExportZip,
  computeGhosts,
  ExportParseError,
} from '../../src/lib/instagram-export.js';

// ── Fixtures modelling Instagram's real Download-Your-Information JSON ──────────

// following.json — wrapped under relationships_following (current format)
const followingJson = JSON.stringify({
  relationships_following: [
    entry('alice', 1_600_000_000),
    entry('bob', 1_610_000_000),
    entry('carol', 1_620_000_000),
    entry('dave', 1_700_000_000), // followed recently
  ],
});

// followers_1.json — bare top-level array (current format for follower files)
const followers1Json = JSON.stringify([entry('alice', 1_600_000_100), entry('erin', 1_650_000_000)]);

// followers_2.json — split file, also a bare array
const followers2Json = JSON.stringify([entry('frank', 1_660_000_000)]);

// close_friends.json — wrapped under relationships_close_friends
const closeFriendsJson = JSON.stringify({
  relationships_close_friends: [entry('carol', 1_630_000_000)],
});

// liked_posts.json — title is the post owner's username
const likedPostsJson = JSON.stringify({
  likes_media_likes: [
    likeEntry('bob', 1_701_000_000),
    likeEntry('bob', 1_702_000_000),
    likeEntry('carol', 1_703_000_000),
  ],
});

// post_comments_1.json — bare array with string_map_data (Media Owner present)
const commentsJson = JSON.stringify([
  {
    string_map_data: {
      'Media Owner': { value: 'bob' },
      Comment: { value: 'nice!' },
      Time: { timestamp: 1_704_000_000 },
    },
  },
]);

function entry(username: string, timestamp: number) {
  return {
    title: '',
    media_list_data: [],
    string_list_data: [
      { href: `https://www.instagram.com/${username}`, value: username, timestamp },
    ],
  };
}

function likeEntry(ownerUsername: string, timestamp: number) {
  return {
    title: ownerUsername,
    string_list_data: [{ href: 'https://www.instagram.com/p/abc/', value: '👍', timestamp }],
  };
}

function fullFileSet(): Record<string, string> {
  return {
    'connections/followers_and_following/following.json': followingJson,
    'connections/followers_and_following/followers_1.json': followers1Json,
    'connections/followers_and_following/followers_2.json': followers2Json,
    'connections/followers_and_following/close_friends.json': closeFriendsJson,
    'your_instagram_activity/likes/liked_posts.json': likedPostsJson,
    'your_instagram_activity/comments/post_comments_1.json': commentsJson,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('parseExportFiles', () => {
  it('parses following with usernames and follow timestamps', () => {
    const parsed = parseExportFiles(fullFileSet());
    expect(parsed.following.map((f) => f.username).sort()).toEqual([
      'alice',
      'bob',
      'carol',
      'dave',
    ]);
    const alice = parsed.following.find((f) => f.username === 'alice')!;
    expect(alice.followedAt?.getTime()).toBe(1_600_000_000 * 1000);
  });

  it('merges followers across split files (followers_1, followers_2)', () => {
    const parsed = parseExportFiles(fullFileSet());
    expect(parsed.followers.map((f) => f.username).sort()).toEqual(['alice', 'erin', 'frank']);
  });

  it('parses close friends', () => {
    const parsed = parseExportFiles(fullFileSet());
    expect(parsed.closeFriends).toContain('carol');
  });

  it('aggregates engagement (likes + comments) by target username', () => {
    const parsed = parseExportFiles(fullFileSet());
    expect(parsed.engagement.get('bob')).toMatchObject({ likes: 2, comments: 1 });
    expect(parsed.engagement.get('carol')).toMatchObject({ likes: 1, comments: 0 });
  });

  it('is tolerant when optional files are missing', () => {
    const parsed = parseExportFiles({
      'following.json': followingJson,
      'followers_1.json': followers1Json,
    });
    expect(parsed.following).toHaveLength(4);
    expect(parsed.followers).toHaveLength(2);
    expect(parsed.closeFriends).toEqual([]);
    expect(parsed.engagement.size).toBe(0);
  });

  it('throws a typed error when neither following nor followers is present', () => {
    expect(() => parseExportFiles({ 'random.json': '{}' })).toThrow(ExportParseError);
  });

  it('ignores files with malformed JSON rather than crashing the whole import', () => {
    const parsed = parseExportFiles({
      'following.json': followingJson,
      'followers_1.json': followers1Json,
      'your_instagram_activity/likes/liked_posts.json': '{ this is not json',
    });
    expect(parsed.following).toHaveLength(4);
    expect(parsed.engagement.size).toBe(0);
  });
});

describe('parseExportZip', () => {
  it('extracts and parses the relevant JSON files from a zip, ignoring media', () => {
    const files: Record<string, Uint8Array> = {};
    for (const [name, content] of Object.entries(fullFileSet())) {
      files[name] = strToU8(content);
    }
    // an unrelated media file that must be ignored
    files['media/posts/photo.jpg'] = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
    const zip = zipSync(files);

    const parsed = parseExportZip(Buffer.from(zip));
    expect(parsed.following).toHaveLength(4);
    expect(parsed.followers).toHaveLength(3);
    expect(parsed.engagement.get('bob')?.likes).toBe(2);
  });
});

describe('computeGhosts', () => {
  it('returns accounts you follow that do not follow you back', () => {
    const parsed = parseExportFiles(fullFileSet());
    const ghosts = computeGhosts(parsed);
    // alice follows back; bob/carol/dave do not
    expect(ghosts.map((g) => g.username).sort()).toEqual(['bob', 'carol', 'dave']);
  });

  it('is case-insensitive when matching handles across lists', () => {
    const parsed = parseExportFiles({
      'following.json': JSON.stringify({ relationships_following: [entry('Alice', 1)] }),
      'followers_1.json': JSON.stringify([entry('alice', 2)]),
    });
    expect(computeGhosts(parsed)).toHaveLength(0);
  });

  it('attaches engagement and close-friend flags to each ghost', () => {
    const parsed = parseExportFiles(fullFileSet());
    const ghosts = computeGhosts(parsed);
    const carol = ghosts.find((g) => g.username === 'carol')!;
    expect(carol.isCloseFriend).toBe(true);
    expect(carol.likesGiven).toBe(1);
    const bob = ghosts.find((g) => g.username === 'bob')!;
    expect(bob.isCloseFriend).toBe(false);
    expect(bob.likesGiven).toBe(2);
    expect(bob.commentsGiven).toBe(1);
  });
});
