/**
 * Copy registry — every user-facing string lives here (spec §21, §24,
 * §26.7: "no hard-coded copy"). Voice: calm, exact, lightly warm.
 */

export const copy = {
  brand: {
    name: 'GHOAST',
    tagline: 'Your Instagram has ghosts.',
  },

  landing: {
    h1: 'Your Instagram has ghosts.',
    sub: 'See exactly who doesn’t follow you back — from your own Instagram export, read on your device. Never your password.',
    cta: 'Find my ghosts — free',
    trustChips: ['No Instagram login', 'Processed on your device', 'Delete anytime'],
    howTitle: 'How it works',
    howSteps: [
      { title: 'Get your file', body: 'Instagram’s own “Download Your Information” export. We show you the exact taps.' },
      { title: 'Drop it in', body: 'The ZIP is read right here in your browser. It is never uploaded anywhere.' },
      { title: 'See your ghosts', body: 'The complete list of who doesn’t follow you back — sorted oldest first, every one explainable.' },
    ],
    honestyTitle: 'What GHOAST can’t see',
    honestyBody:
      'Your export contains usernames, profile links, and when each follow started. That’s the whole diet. No posts, no likes, no follower counts, no DMs — so we don’t show any. And GHOAST can’t unfollow anyone for you: you act, inside Instagram, at your own pace. That’s the point.',
    ethicalLine: 'An app that asks for your Instagram password can take your account. We never ask.',
    whatTitle: 'What you get',
    whatPoints: [
      { title: 'Ghosts', body: 'People you follow who don’t follow back — exact, provable, sortable by how long it’s been one-way.' },
      { title: 'Fans & mutuals', body: 'The rest of your graph, so you see the whole picture, not just the cleanup pile.' },
      { title: 'A calm cleanup', body: 'Decide account by account. GHOAST organizes; you act inside Instagram, at a safe pace.' },
      { title: 'Memory', body: 'With GHOAST+, each new scan shows what changed — verified unfollows, new ghosts, who became mutual.' },
    ],
  },

  onboarding: {
    step1Title: 'Ghosts, explained.',
    step1Body: 'You follow them. They don’t follow you back. That’s a ghost — and Instagram gives you no way to see the list.',
    step2Title: 'The privacy promise',
    step2Rows: [
      { title: 'No password', body: 'We never ask for your Instagram login. The official export is all we need.' },
      { title: 'On your device', body: 'Your file is opened and read in this browser. It is never uploaded.' },
      { title: 'You can delete everything', body: 'One tap in Settings wipes every scan and decision. Nothing exists on our side.' },
    ],
    step3Title: 'One file from Instagram',
    step3Body: 'Instagram lets you download a copy of your data. GHOAST reads just two lists from it: followers and following.',
    pathHaveFile: 'I already have my export',
    pathNeedFile: 'Help me get my file',
    skip: 'Skip intro',
    continue: 'Continue',
  },

  guide: {
    title: 'Get your Instagram file',
    intro: 'Instagram’s own “Download Your Information” gives you a ZIP. GHOAST reads that copy — never your password.',
    steps: [
      {
        title: 'Open Accounts Center',
        body: 'In Instagram: your profile → ☰ menu → Accounts Center.',
      },
      {
        title: 'Find “Download your information”',
        body: 'Tap “Your information and permissions” → “Download your information” → select your profile.',
      },
      {
        title: 'Choose only what we need',
        body: 'Pick “Some of your information”, tick “Followers and following”, choose JSON format, date range “All time”.',
      },
      {
        title: 'Wait for the email',
        body: 'Instagram takes a few minutes — sometimes a few hours — to prepare your file. You can close GHOAST; come back when it arrives.',
      },
    ],
    formatTip: 'Choose JSON when Instagram asks. (The other option, HTML, is for reading — not for us.)',
    dataMinTip: 'Pick “Followers and following” only. Smaller file, faster download, and we never see the rest of your life.',
    fileNameHint: 'The file will be named something like instagram-yourname-2026-09-30.zip. Check your Downloads folder.',
    waiting: 'Waiting on the email? That’s normal. You can close GHOAST — we’ll be here.',
    haveZip: 'I have my ZIP →',
    stepLabel: (n: number, total: number) => `Step ${n} of ${total}`,
  },

  upload: {
    title: 'Drop your Instagram ZIP here.',
    chooseFile: 'Choose ZIP file',
    dragHint: 'or drag it here',
    trust: 'Read on this device. Never uploaded. We look at two lists — followers and following — and nothing else.',
    dontUnzip: 'Don’t unzip it — GHOAST handles that.',
    analyze: 'Analyze my file →',
    whatWeRead: 'What exactly do you read?',
    whatWeReadBody:
      'Two files inside the archive: followers_and_following/followers_1.json and followers_and_following/following.json. Each gives us a username, a profile link, and when the follow started. Everything else in the archive is ignored — and never uploaded.',
    processing: ['Opening your archive', 'Finding your follows', 'Matching relationships', 'Meeting your ghosts'],
    processingNote: 'Less than a minute — it’s all happening here, on your device.',
    stale: (days: number) =>
      `This file is ${days} days old — your graph may have changed since.`,
    staleUse: 'Use it anyway',
    staleFresh: 'Get a fresh export',
    duplicate: (date: string) => `You’ve already scanned this exact file (on ${date}).`,
    duplicateView: 'View that scan',
    duplicateAnyway: 'Scan it anyway',
    interrupted: (name: string) =>
      `Your analysis was interrupted. Re-select ${name} to pick up where you left off.`,
    resume: 'Resume',
    errors: {
      not_zip: {
        title: 'That file didn’t open',
        body: 'It may be partially downloaded or re-zipped by another app. Try downloading the ZIP from Instagram’s email again, as-is.',
      },
      wrong_file: {
        title: 'This doesn’t look like an Instagram export',
        body: (name: string) =>
          `"${name}" doesn’t contain the followers and following lists. Your export is usually named instagram-yourname-<date>.zip.`,
      },
      html_export: {
        title: 'This export is in HTML format',
        body: 'We can’t read HTML exports. Re-request your data and choose JSON — it takes about 20 seconds.',
      },
      missing_lists: {
        title: 'This export is missing the lists we need',
        body: 'When you request your data, tick “Followers and following”. That’s the whole diet — GHOAST reads nothing else.',
      },
      empty_lists: {
        title: 'The lists in this export are empty',
        body: 'Instagram included the files but they’re empty. Re-request with date range “All time” and tick “Followers and following”.',
      },
      too_large: {
        title: 'That file is too large',
        body: 'Exports with only “Followers and following” selected are usually just a few MB. Re-request with only that section ticked.',
      },
      incomplete: {
        title: 'This export only contains half the picture',
        body: 'We found only one of the two lists (followers / following). Comparing them is the entire method, so both are required. Re-request and tick “Followers and following”.',
      },
    },
    errorGuideCta: 'Show me how to get the right file',
    tryAgain: 'Choose a different file',
  },

  board: {
    scanOf: (date: string) => `Scan of ${date}`,
    relationships: (n: number) => `${n.toLocaleString()} relationships`,
    heroGhost: (n: number) => `${n.toLocaleString()}`,
    heroLine: 'people you follow don’t follow back',
    ghostDefinition: 'A ghost is someone you follow who doesn’t follow you back. That’s all it means — it says nothing about them.',
    mutuals: 'Mutuals',
    fans: 'Fans',
    followingTotal: 'Following',
    followersTotal: 'Followers',
    laneLong: 'Long-standing ghosts',
    laneLongHint: 'Followed over a year ago, still one-way — start here.',
    laneRecent: 'Recent ghosts',
    laneRecentHint: 'Followed in the last 30 days — give these time. People aren’t notifications.',
    laneSavedKept: 'Saved & protected',
    laneSavedKeptHint: 'Your parked and protected accounts.',
    startReviewing: 'Start reviewing',
    browseList: 'Browse the full list',
    zeroGhosts: 'Zero ghosts. Every account you follow follows you back. Genuinely rare — enjoy it. ✨',
    partialBanner:
      'Showing ghosts only — the followers list was missing from this export, so fans and mutuals are unavailable.',
    addNewScan: 'Add a newer scan →',
    newScanToast: 'New scan loaded — filters reset.',
    statSortNote: 'Sorted oldest first — the longer it’s been one-way, the likelier it’s clutter.',
    snapshotInfo: 'Snapshot details',
    deleteThisScan: 'Delete this scan',
  },

  lists: {
    ghostsTitle: 'Ghosts',
    fansTitle: 'Fans',
    mutualsTitle: 'Mutuals',
    searchPlaceholder: 'Search usernames…',
    filters: { all: 'All', longstanding: 'Long-standing', recent: 'Recent', saved: 'Saved' },
    sorts: { oldest: 'Oldest first', newest: 'Newest first', az: 'A–Z', za: 'Z–A' },
    evidenceGhost: (since: string | null) =>
      since ? `Following since ${since} · not following back` : 'Not following back · follow date unknown',
    evidenceFan: (since: string | null) =>
      since ? `Follows you since ${since} · you don’t follow back` : 'Follows you · you don’t follow back',
    evidenceMutual: (since: string | null) =>
      since ? `Mutual since ${since} ✓` : 'Mutual ✓',
    noMatch: 'No accounts match — clear filters?',
    clearFilters: 'Clear filters',
    noFans: 'No follower-only accounts — everyone you follow, follows you, and vice versa.',
    noMutuals: 'No mutuals in this scan.',
    viewOnInstagram: 'View on Instagram',
    why: 'Why?',
    keep: 'Keep',
    save: 'Save',
    queue: 'Queue',
    selected: (n: number) => `${n} selected`,
    keepSelected: 'Keep selected',
    saveSelected: 'Save selected',
    clear: 'Clear',
    stateChips: {
      kept: 'Protected',
      queued: 'Queued',
      saved: 'Saved',
      handled_self: 'Marked unfollowed',
      handled_verified: 'Verified gone',
    },
  },

  review: {
    progress: (done: number, total: number) => `${done} of ${total} · this session`,
    buttons: { queue: 'Queue', later: 'Later', keep: 'Keep', skip: 'Skip' },
    whyTitle: 'Why you’re seeing this',
    whyBody: (username: string, since: string | null) =>
      `@${username} is in your export’s “following” list and not in “followers”` +
      (since ? `, and you followed them in ${since}.` : '.') +
      ' That’s the whole reason.',
    finishedTitle: 'Deck cleared',
    finishedBody: (q: number, k: number, s: number) =>
      `Session complete. ${q} queued, ${k} kept safe, ${s} saved for later. Nothing happened on Instagram that you didn’t do yourself.`,
    openQueue: 'Open cleanup queue',
    doneForNow: 'Done for now',
    empty: 'Nothing left to review — every ghost has a decision.',
    undoPrefix: (action: string, username: string) => `${action} @${username}`,
    undo: 'Undo',
    keepHint: 'Protected forever — never flagged again',
    queueHint: 'You intend to unfollow, yourself, on Instagram',
    laterHint: 'Park it in Saved',
    skipHint: 'Decide another time',
    gesturesHint: 'Swipe: ← queue · → keep · ↑ later · ↓ skip',
    viewProfile: 'View on Instagram ↗',
  },

  cleanup: {
    title: 'Cleanup queue',
    intro: 'You unfollow on Instagram — GHOAST never acts for you. Open a profile, unfollow there, come back and confirm.',
    open: 'Open in Instagram ↗',
    confirmTitle: (username: string) => `Did you unfollow @${username}?`,
    confirmYes: 'Yes, done ✓',
    confirmNo: 'Not yet',
    confirmKeep: 'Actually, keep them',
    breakTitle: 'Time for a breather',
    breakBody: (n: number) =>
      `Instagram prefers slow cleanups — ${n} opens already. Grab some water; your queue will be right here.`,
    breakResume: 'I’m back — keep going',
    breakSnooze: 'Remind me later',
    empty: 'Queue is empty. Queue accounts from Review or any list.',
    stillThereNote: 'Instagram may still show this account — the unfollow may not have completed.',
    selfReportNote: 'Marked as unfollowed — we’ll verify it’s really gone on your next scan.',
    verifiedNote: (date: string) => `Confirmed unfollowed ✓✓ (verified in your ${date} scan)`,
  },

  saved: {
    title: 'Saved for later',
    empty: 'Nothing parked here. Use “Later” in Review to set accounts aside without deciding.',
    resume: 'Resume reviewing',
  },

  kept: {
    title: 'Protected',
    empty: 'Protected accounts live here — people you never want flagged, like your venue or your mom.',
    protectedSince: (date: string) => `Protected since ${date}`,
    remove: 'Remove protection',
    removedToast: (username: string) => `@${username} is back in the eligible pool`,
  },

  account: {
    factsTitle: 'Relationship facts',
    youFollow: 'You follow them',
    theyFollow: 'They follow you',
    followingSince: 'Following since',
    memberOfScans: 'Seen in scans',
    evidenceTitle: 'Evidence & provenance',
    evidenceSource: (file: string) => `Source: your Instagram export “${file}”, followers_and_following lists ✓`,
    honestyTitle: 'What GHOAST can’t see',
    honestyBody:
      'GHOAST can’t see their posts, followers, or activity — only your export. That’s the deal that keeps this safe.',
    historyTitle: 'Decision history',
    changedOrGone: 'This account wasn’t in your latest scan. It may have changed username, deactivated, or been removed — we can’t tell which.',
    actions: { keep: 'Protect', unkeep: 'Remove protection', queue: 'Queue', saved: 'Save for later', open: 'Open on Instagram ↗', reset: 'Move back to unreviewed' },
    refollowNote: 'Already unfollowed? To reconnect you’ll need to re-follow on Instagram — GHOAST can’t do it for you.',
  },

  activity: {
    title: 'Activity',
    tabs: { handled: 'Handled', queued: 'Queued', kept: 'Kept', saved: 'Saved', skipped: 'Skipped' },
    empty: 'No activity yet — decisions you make show up here.',
    moveBack: 'Move back to unreviewed',
    handledSelf: 'Marked as unfollowed (you told us)',
    handledVerified: 'Verified unfollowed ✓✓',
  },

  history: {
    title: 'History',
    empty: 'Each scan you run is remembered here, so your second scan can show what changed.',
    gatedBody: 'Your graph moved while you weren’t looking. GHOAST+ remembers every scan, so you can see what changed.',
    comparison: (from: string, to: string) => `${from} → ${to}`,
    groups: {
      newGhosts: 'New ghosts',
      becameMutual: 'Became mutual ✨',
      youUnfollowed: 'You unfollowed — verified',
      newFollowers: 'New followers',
      lostFollowers: 'No longer following you',
      vanished: 'Changed username, deactivated, or removed',
    },
    vanishedNote: 'These accounts had decisions but appear in neither list now — we can’t tell which of the three happened.',
  },

  paywall: {
    title: 'GHOAST+ remembers',
    comparisonTrigger: 'Unlock comparison',
    body: 'Your first scan is free forever — the full list, triage, cleanup, all of it. GHOAST+ adds memory: history, and “what changed” between scans.',
    monthly: (price: string) => `${price} / month`,
    annual: (price: string) => `${price} / year`,
    notNow: 'Not now',
    checkout: 'Continue to checkout',
    secureNote: 'Secure checkout by Stripe. Your Instagram export is never involved in payment.',
    purchaseUnavailable:
      'Checkout isn’t available in this build yet — payments are being connected. The gate is real; we don’t unlock for free. Check back soon.',
  },

  settings: {
    title: 'Settings',
    appearance: 'Appearance',
    themeDark: 'Dark',
    themeLight: 'Light',
    motion: 'Reduce motion',
    pacing: 'Cleanup pace',
    pacingHint: (n: number) => `Suggest a breather after ${n} Instagram opens`,
    plan: 'Plan',
    planFree: 'Free — full scans, triage, cleanup, forever',
    planPlus: 'GHOAST+ — history and comparisons',
    data: 'Data',
    dataHint: 'Manage snapshots, or wipe everything',
    about: 'About',
    aboutHint: 'How GHOAST knows what it knows',
  },

  dataSettings: {
    title: 'Your data',
    snapshots: 'Stored snapshots',
    noSnapshots: 'No scans stored.',
    deleteScan: 'Delete',
    deleteAll: 'Delete everything',
    confirmTitle: 'Delete everything from this device?',
    confirmBody:
      'Scans, decisions, protected list — all of it, gone. There’s no copy on our side to clean up; it was never sent anywhere.',
    confirmDelete: 'Delete everything',
    confirmKeep: 'Keep my data',
    deletedToast: 'Everything deleted. GHOAST is a stranger again.',
  },

  help: {
    title: 'Help',
    entries: [
      {
        q: 'Do you need my Instagram password?',
        a: 'Never. GHOAST reads the official “Download Your Information” export that Instagram gives you. Your password — and even your login session — stays with Instagram.',
      },
      {
        q: 'Does my file get uploaded?',
        a: 'No. The ZIP is opened and read by your own browser, on your own device (or right here, if you’re on desktop). You can verify it: switch your network off after the page loads and everything still works.',
      },
      {
        q: 'Is this safe for my Instagram account?',
        a: 'Yes — GHOAST never touches your account. When you clean up, you do the unfollowing yourself inside Instagram, and GHOAST’s pacing reminders keep you off Instagram’s rate limits.',
      },
      {
        q: 'Can GHOAST see who’s private, or who viewed my profile?',
        a: 'No — and honestly, nobody can from an export. GHOAST doesn’t know who’s private; Instagram’s export doesn’t say. We only work with what your own data proves.',
      },
      {
        q: 'My export hasn’t arrived yet.',
        a: 'Instagram usually delivers within minutes, but larger accounts can wait hours. If it’s been over 48 hours, re-request it from Accounts Center → Your information and permissions → Download your information.',
      },
      {
        q: 'What format should I choose?',
        a: 'JSON. The HTML option is for humans reading; GHOAST needs the JSON. And tick only “Followers and following” — smaller file, faster delivery, more private.',
      },
    ],
  },

  footer: {
    privacy: 'Privacy',
    howItWorks: 'How it works',
    pricing: 'Pricing',
    help: 'Help',
  },

  a11y: {
    tabs: 'Primary',
    skipToContent: 'Skip to content',
    sortMenu: 'Sort accounts',
    filterAccounts: 'Filter accounts',
    accountActions: 'Account actions',
    close: 'Close',
    back: 'Back',
  },
} as const;

export type Copy = typeof copy;
