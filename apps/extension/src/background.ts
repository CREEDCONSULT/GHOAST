/**
 * GHOAST Companion — background service worker (MV3).
 *
 * Holds exactly one user-started session: an ordered username list received
 * from the GHOAST web app (origin-validated), drives one instagram.com tab
 * through one unfollow at a time with conservative pacing, collects receipts,
 * and HALTS THE WHOLE SESSION on challenge / rate-limit / login / ambiguity.
 *
 * No cookies, no sessions, no credentials — this worker never reads them.
 */

import {
  nextDelayMs,
  validateExternalCommand,
  type Pacing,
  type SessionCommand,
} from './protocol';

export interface ExtensionReceipt {
  ts: number;
  username: string;
  kind: 'opened' | 'requested' | 'confirmed' | 'skipped' | 'failed' | 'stopped';
  detail?: string;
}

interface SessionState {
  active: boolean;
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'done';
  total: number;
  remaining: string[];
  processed: string[];
  currentIndex: number;
  haltedReason: string | null;
  receipts: ExtensionReceipt[];
  pacing: Pacing | null;
  tabId: number | null;
}

const IDLE: SessionState = {
  active: false,
  status: 'idle',
  total: 0,
  remaining: [],
  processed: [],
  currentIndex: 0,
  haltedReason: null,
  receipts: [],
  pacing: null,
  tabId: null,
};

let state: SessionState = { ...IDLE };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function addReceipt(username: string, kind: ExtensionReceipt['kind'], detail?: string) {
  const receipt: ExtensionReceipt = { ts: Date.now(), username, kind };
  if (detail !== undefined) receipt.detail = detail;
  state.receipts.push(receipt);
  void chrome.storage.session.set({ ghoastSession: state });
}

function publicState() {
  return {
    active: state.active,
    status: state.status,
    total: state.total,
    currentIndex: state.currentIndex,
    haltedReason: state.haltedReason,
    receipts: state.receipts,
  };
}

async function getOrCreateTab(): Promise<number> {
  if (state.tabId != null) {
    try {
      await chrome.tabs.get(state.tabId);
      return state.tabId;
    } catch {
      state.tabId = null;
    }
  }
  const tab = await chrome.tabs.create({ url: 'https://www.instagram.com/', active: true });
  state.tabId = tab.id!;
  return state.tabId;
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('tab_load_timeout'));
    }, 30_000);
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

interface ContentResult {
  kind: 'confirmed' | 'skipped' | 'failed' | 'stopped';
  detail?: string;
}

async function runSession(): Promise<void> {
  // Chrome minimum pacing check happens at validation time; belt-and-braces here too.
  while (state.status === 'running' && state.remaining.length > 0) {
    const username = state.remaining[0];
    if (!username) break;
    try {
      const tabId = await getOrCreateTab();
      await chrome.tabs.update(tabId, {
        url: `https://www.instagram.com/${encodeURIComponent(username)}/`,
        active: true,
      });
      await waitForTabLoad(tabId);
      addReceipt(username, 'opened');

      // Content script does the conservative DOM dance; result is typed.
      const result = (await chrome.tabs.sendMessage(tabId, {
        type: 'GHOAST_ACT_UNFOLLOW',
        username,
      })) as ContentResult;

      addReceipt(username, result.kind, result.detail);

      if (result.kind === 'stopped') {
        state.status = 'stopped';
        state.haltedReason = result.detail ?? 'halted';
        void chrome.storage.session.set({ ghoastSession: state });
        return;
      }
    } catch (e) {
      addReceipt(username, 'failed', (e as Error).message);
    }

    state.remaining.shift();
    state.processed.push(username);
    state.currentIndex = state.processed.length;
    void chrome.storage.session.set({ ghoastSession: state });

    if (state.status === 'running' && state.remaining.length > 0) {
      await sleep(nextDelayMs(state.pacing?.intervalSeconds ?? 45));
    }
  }
  if (state.remaining.length === 0 && state.status === 'running') {
    state.status = 'done';
    void chrome.storage.session.set({ ghoastSession: state });
  }
  state.active = false;
}

chrome.runtime.onMessageExternal.addListener((rawMsg: unknown, sender, sendResponse) => {
  const origin = sender.url ?? sender.origin ?? '';
  const err = validateExternalCommand(rawMsg, origin);
  if (err) {
    sendResponse({ ...publicState(), error: err });
    return false;
  }

  const msg = rawMsg as SessionCommand;
  switch (msg.type) {
    case 'GHOAST_BATCH_START':
      if (state.active && state.status === 'running') {
        sendResponse({ ...publicState(), error: 'already_running' });
        return false;
      }
      state = {
        ...IDLE,
        active: true,
        status: 'running',
        total: msg.usernames.length,
        remaining: [...msg.usernames],
        pacing: msg.pacing,
      };
      void chrome.storage.session.set({ ghoastSession: state });
      void runSession(); // async loop; receipts land in publicState
      sendResponse(publicState());
      return false;
    case 'GHOAST_BATCH_PAUSE':
      if (state.status === 'running') state.status = 'paused';
      sendResponse(publicState());
      return false;
    case 'GHOAST_BATCH_RESUME':
      if (state.status === 'paused') {
        state.status = 'running';
        void runSession();
      }
      sendResponse(publicState());
      return false;
    case 'GHOAST_BATCH_STOP':
      state.status = 'stopped';
      state.haltedReason = 'user_stopped';
      addReceipt(state.remaining[0] ?? '', 'stopped', 'user stopped the session');
      void chrome.storage.session.set({ ghoastSession: state });
      sendResponse(publicState());
      return false;
    case 'GHOAST_BATCH_STATUS':
      sendResponse(publicState());
      return false;
  }
  return false;
});

// Intentional: no onInstalled onboarding page, no alarms, no idle polling,
// no scheduled anything. Sessions exist only because a user pressed Start.
