/**
 * GHOAST Companion — content script for instagram.com.
 *
 * Runs only when the background worker asks it to act on ONE profile during
 * an explicit user-started session. Conservative by construction: if the
 * visible UI doesn't match the expected Following → Unfollow flow exactly,
 * it reports a halt instead of guessing.
 *
 * Privacy: reads only the follow-control cluster of the current profile page.
 * No cookies (no permission), no DMs, no posts, no data leaves the page.
 */

import { evaluateProfileControls, findUnfollowConfirm, verifyUnfollowed } from './insta-dom';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function act(username: string) {
  // 1. Evaluate page state — halt conditions checked inside.
  let verdict = evaluateProfileControls(document, username);
  // Brief grace for slow control hydration (max ~4s), then stop guessing.
  for (let i = 0; verdict.kind === 'waiting' && i < 4; i++) {
    await sleep(1000);
    verdict = evaluateProfileControls(document, username);
  }

  switch (verdict.kind) {
    case 'halt':
      return { kind: 'stopped', detail: verdict.reason } as const;
    case 'not_following':
      return { kind: 'skipped', detail: 'already not following' } as const;
    case 'waiting':
      return { kind: 'failed', detail: 'controls_not_visible' } as const;
    case 'ready_to_unfollow':
      break;
  }

  // 2. Open the confirmation dialog.
  verdict.button.click();
  await sleep(800);

  const confirm = findUnfollowConfirm(document);
  if ('halt' in confirm) return { kind: 'stopped', detail: confirm.halt } as const;

  // 3. Confirm.
  confirm.click();
  await sleep(1500);

  // 4. Verify the visible state flipped — receivers of this receipt treat it
  // as SELF-REPORTED evidence (GHOAST core never marks it verified).
  const after = verifyUnfollowed(document);
  if (after === 'confirmed') return { kind: 'confirmed' } as const;
  if (after === 'unchanged') return { kind: 'failed', detail: 'state_unchanged_after_click' } as const;
  return { kind: 'stopped', detail: 'ambiguous_controls' } as const;
}

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if ((msg as { type?: string })?.type !== 'GHOAST_ACT_UNFOLLOW') return false;
  const username = (msg as { username?: unknown }).username;
  if (typeof username !== 'string' || !/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
    sendResponse({ kind: 'failed', detail: 'invalid_username' });
    return false;
  }
  void act(username).then(sendResponse);
  return true; // async response
});
