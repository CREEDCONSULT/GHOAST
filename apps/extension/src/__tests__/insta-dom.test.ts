/**
 * Content-script DOM logic against mock Instagram DOM fixtures.
 * No real Instagram pages, no real accounts — fixtures only.
 */

import {
  detectHalt,
  evaluateProfileControls,
  findUnfollowConfirm,
  verifyUnfollowed,
} from '../insta-dom';

function doc(html: string, title = 'user_name • Instagram'): Document {
  const d = document.implementation.createHTMLDocument('');
  d.documentElement.innerHTML = `<head><title>${title}</title></head><body>${html}</body>`;
  return d;
}

describe('detectHalt', () => {
  it('detects the login screen and refuses everything', () => {
    expect(detectHalt(doc('<form id="loginForm"><input name="username" type="text"/></form>'))).toBe('login_required');
  });
  it('detects rate-limit modals by text', () => {
    expect(detectHalt(doc('<div class="x">We limit how often you can do certain things on Instagram.</div>'))).toBe('rate_limit');
    expect(detectHalt(doc('<div>Try again later</div>'))).toBe('rate_limit');
  });
  it('detects challenges/checkpoints', () => {
    expect(detectHalt(doc('<div>challenge_required</div>'))).toBe('challenge');
    expect(detectHalt(doc('<div>We detected unusual activity on your account</div>'))).toBe('challenge');
  });
  it('returns null on a clean profile page', () => {
    expect(detectHalt(doc('<h1>someone</h1><button>Following</button>'))).toBeNull();
  });
});

describe('evaluateProfileControls', () => {
  it('readies exactly one visible "Following" button', () => {
    const d = doc('<header><span>bob.tunes</span></header><main><button>Following</button></main>', 'bob.tunes • Instagram');
    const v = evaluateProfileControls(d, 'bob.tunes');
    expect(v.kind).toBe('ready_to_unfollow');
  });

  it('reports not_following when only "Follow" exists', () => {
    const d = doc('<header><span>bob.tunes</span></header><button>Follow</button>', 'bob.tunes • Instagram');
    expect(evaluateProfileControls(d, 'bob.tunes').kind).toBe('not_following');
  });

  it('stops on ambiguous duplicate controls (never guesses)', () => {
    const d = doc('<header><span>bob.tunes</span></header><button>Following</button><button>Following</button>', 'bob.tunes');
    expect(evaluateProfileControls(d, 'bob.tunes')).toEqual({ kind: 'halt', reason: 'ambiguous_controls' });
  });

  it('stops when the page does not match the expected username', () => {
    const d = doc('<h1>mallory</h1><button>Following</button>', 'mallory');
    expect(evaluateProfileControls(d, 'bob.tunes')).toEqual({ kind: 'halt', reason: 'not_profile_page' });
  });

  it('halts before evaluating controls when a challenge is present', () => {
    const d = doc('<div>unusual activity</div><button>Following</button>', 'bob.tunes');
    expect(evaluateProfileControls(d, 'bob.tunes')).toEqual({ kind: 'halt', reason: 'challenge' });
  });
});

describe('findUnfollowConfirm', () => {
  it('finds the single Unfollow control in the single dialog', () => {
    const d = doc('<div role="dialog"><button>Cancel</button><button>Unfollow</button></div>');
    const r = findUnfollowConfirm(d);
    expect('halt' in r).toBe(false);
  });
  it('halts when the dialog is missing or ambiguous', () => {
    expect(findUnfollowConfirm(doc('<div></div>'))).toEqual({ halt: 'unexpected_modal' });
    expect(findUnfollowConfirm(doc('<div role="dialog"></div><div role="dialog"></div>'))).toEqual({ halt: 'unexpected_modal' });
    expect(findUnfollowConfirm(doc('<div role="dialog"><button>Maybe</button></div>'))).toEqual({ halt: 'unexpected_modal' });
  });
});

describe('verifyUnfollowed', () => {
  it('confirms only when the control flipped to a single "Follow"', () => {
    expect(verifyUnfollowed(doc('<button>Follow</button>'))).toBe('confirmed');
    expect(verifyUnfollowed(doc('<button>Following</button>'))).toBe('ambiguous');
    expect(verifyUnfollowed(doc('<button>Follow</button><button>Following</button>'))).toBe('ambiguous');
    expect(verifyUnfollowed(doc('<div></div>'))).toBe('unchanged');
  });
});
