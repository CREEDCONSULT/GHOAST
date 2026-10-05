/**
 * Instagram DOM interpreter — the ONLY code that touches instagram.com pages.
 *
 * Design contract (Batch Cleanup Assistant v1):
 *  - Conservative: find works of the CURRENT visible UI (button text / dialog
 *    semantics), never position guessing, never attribute scraping tricks.
 *  - Stop rather than guess: any ambiguity returns a typed failure instead of
 *    a best-effort click.
 *  - Reads only the follow/unfollow control cluster of the CURRENT profile
 *    page. No cookies, no DMs, no posts, no other page data.
 */

export type HaltReason =
  | 'challenge' // instagram challenge/checkpoint screen
  | 'rate_limit' // "try again later" / action-blocked modal
  | 'login_required' // user is not logged in
  | 'unexpected_modal'
  | 'ambiguous_controls'
  | 'not_profile_page';

export type DomVerdict =
  | { kind: 'halt'; reason: HaltReason }
  | { kind: 'not_following' } // already not following — nothing to do
  | { kind: 'ready_to_unfollow'; button: HTMLElement }
  | { kind: 'waiting' }; // control not visible yet; caller may retry briefly

const HALT_TEXT_PATTERNS: Array<{ reason: HaltReason; patterns: RegExp[] }> = [
  {
    reason: 'challenge',
    patterns: [/challenge_required/i, /verify your identity/i, /unusual activity/i, /checkpoint/i],
  },
  {
    reason: 'rate_limit',
    patterns: [
      /try again later/i,
      /we limit how often/i,
      /action blocked/i,
      /temporarily blocked/i,
    ],
  },
  {
    reason: 'login_required',
    patterns: [/log in to continue/i, /sign up to see/i],
  },
];

function visible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect?.();
  // jsdom (tests) reports zero rects — treat as visible there
  if (!rect || (rect.width === 0 && rect.height === 0)) return true;
  const style = getComputedStyle(el as HTMLElement);
  return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0;
}

function allVisibleText(doc: Document): string {
  // innerText is layout-aware in browsers; jsdom lacks it → textContent fallback.
  const body = doc.body as HTMLElement | null;
  const raw = (body?.innerText ?? body?.textContent ?? '') as string;
  return raw.slice(0, 50_000);
}

/** Detect hard-stop page states before touching anything. */
export function detectHalt(doc: Document): HaltReason | null {
  // Login screen → not logged in: the assistant must stop (never log in for anyone).
  if (doc.querySelector('form#loginForm, input[name="username"][type="text"]')) {
    return 'login_required';
  }
  const text = allVisibleText(doc);
  for (const { reason, patterns } of HALT_TEXT_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return reason;
  }
  return null;
}

/** Conservative profile-page + Following-button discovery. */
export function evaluateProfileControls(doc: Document, expectedUsername: string): DomVerdict {
  const halt = detectHalt(doc);
  if (halt) return { kind: 'halt', reason: halt };

  // Confirm we're on the intended profile: username appears in title or main heading.
  const expected = expectedUsername.toLowerCase();
  const title = (doc.title ?? '').toLowerCase();
  const headingText = [...doc.querySelectorAll('h1, h2, header span, header a')]
    .map((el) => (el.textContent ?? '').toLowerCase())
    .join(' ');
  if (!title.includes(expected) && !headingText.includes(expected)) {
    return { kind: 'halt', reason: 'not_profile_page' };
  }

  // Find follow-state controls by their VISIBLE LABEL, not classes.
  const candidates = [...doc.querySelectorAll('button, [role="button"]')].filter(visible);
  const textOf = (el: Element) => (el.textContent ?? '').trim();

  const followingBtns = candidates.filter((el) => /^following$/i.test(textOf(el)));
  const followBtns = candidates.filter((el) => /^follow$/i.test(textOf(el)));

  if (followingBtns.length === 1) return { kind: 'ready_to_unfollow', button: followingBtns[0] as HTMLElement };

  if (followingBtns.length === 0 && followBtns.length === 1) return { kind: 'not_following' };

  // Zero or several matching controls → ambiguous → stop rather than guess.
  return { kind: 'halt', reason: 'ambiguous_controls' };
}

/**
 * Inside the unfollow confirmation dialog, find the explicit "Unfollow" control.
 * Ambiguity (no dialog, no button, multiple) → halt: 'unexpected_modal'.
 */
export function findUnfollowConfirm(doc: Document): HTMLElement | { halt: HaltReason } {
  const dialogs = [...doc.querySelectorAll('[role="dialog"]')].filter(visible);
  const dialog = dialogs[0];
  if (dialogs.length !== 1 || !dialog) return { halt: 'unexpected_modal' };
  const buttons = [...dialog.querySelectorAll('button')].filter(visible);
  const unfollowButtons = buttons.filter((b) => /^unfollow$/i.test((b.textContent ?? '').trim()));
  if (unfollowButtons.length !== 1) return { halt: 'unexpected_modal' };
  return unfollowButtons[0] as HTMLElement;
}

/** Post-action verification: the canonical control should now read "Follow". */
export function verifyUnfollowed(doc: Document): 'confirmed' | 'unchanged' | 'ambiguous' {
  const controls = [...doc.querySelectorAll('button, [role="button"]')].filter(visible);
  const follows = controls.filter((el) => /^follow$/i.test((el.textContent ?? '').trim()));
  const followings = controls.filter((el) => /^following$/i.test((el.textContent ?? '').trim()));
  if (follows.length === 1 && followings.length === 0) return 'confirmed';
  if (followings.length === 0) return 'unchanged';
  return 'ambiguous';
}
