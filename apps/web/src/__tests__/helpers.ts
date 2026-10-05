/**
 * Test fixtures — build synthetic Instagram DYI ZIPs with fflate,
 * including malformed/HTML/split-file variants (spec §22 coverage).
 */

import { zipSync, strToU8 } from 'fflate';

export interface FixtureUser {
  username: string;
  since?: number; // seconds epoch
}

// Followers shape (real 2026 export): username in string_list_data[].value, title empty.
function followerEntry(u: FixtureUser) {
  return {
    title: '',
    media_list_data: [],
    string_list_data: [
      {
        href: `https://www.instagram.com/${u.username}`,
        value: u.username,
        ...(u.since != null ? { timestamp: u.since } : {}),
      },
    ],
  };
}

// Following shape (real 2026 export): username in the item's `title`;
// string_list_data entries carry only href + timestamp (NO `value`).
function followingEntry(u: FixtureUser) {
  return {
    title: u.username,
    media_list_data: [],
    string_list_data: [
      {
        href: `https://www.instagram.com/${u.username}`,
        ...(u.since != null ? { timestamp: u.since } : {}),
      },
    ],
  };
}

export function buildExportZip(opts: {
  following: FixtureUser[];
  followers: FixtureUser[];
  splitFollowers?: boolean; // emit followers_1.json + followers_2.json
  name?: string;
}): File {
  const files: Record<string, Uint8Array> = {
    // Real exports nest under connections/ — the adapter must match by substring.
    'connections/followers_and_following/following.json': strToU8(
      JSON.stringify({ relationships_following: opts.following.map(followingEntry) }),
    ),
    'connections/followers_and_following/blocked_profiles.json': strToU8('[]'),
  };
  if (opts.splitFollowers && opts.followers.length > 1) {
    const half = Math.ceil(opts.followers.length / 2);
    files['connections/followers_and_following/followers_1.json'] = strToU8(
      JSON.stringify(opts.followers.slice(0, half).map(followerEntry)),
    );
    files['connections/followers_and_following/followers_2.json'] = strToU8(
      JSON.stringify(opts.followers.slice(half).map(followerEntry)),
    );
  } else {
    files['connections/followers_and_following/followers_1.json'] = strToU8(
      JSON.stringify(opts.followers.map(followerEntry)),
    );
  }
  return new File([zipSync(files).slice().buffer as ArrayBuffer], opts.name ?? 'instagram-testuser-2026-09-30.zip', {
    type: 'application/zip',
  });
}

export function buildHtmlExportZip(): File {
  const files = {
    'connections/followers_and_following/followers_1.html': strToU8('<html><body>followers</body></html>'),
    'connections/followers_and_following/following.html': strToU8('<html><body>following</body></html>'),
  };
  return new File([zipSync(files).slice().buffer as ArrayBuffer], 'instagram-html.zip', { type: 'application/zip' });
}

export function buildWrongFileZip(): File {
  const files = { 'photos/holiday.jpg': strToU8('fake-jpeg-bytes') };
  return new File([zipSync(files).slice().buffer as ArrayBuffer], 'photos.zip', { type: 'application/zip' });
}

export function buildCorruptFile(): File {
  return new File([new Uint8Array([1, 2, 3, 4, 5]).buffer as ArrayBuffer], 'broken.zip', { type: 'application/zip' });
}

export function buildEmptyListsZip(): File {
  const files = {
    'connections/followers_and_following/followers_1.json': strToU8('[]'),
    'connections/followers_and_following/following.json': strToU8('{"relationships_following":[]}'),
  };
  return new File([zipSync(files).slice().buffer as ArrayBuffer], 'instagram-empty.zip', { type: 'application/zip' });
}
