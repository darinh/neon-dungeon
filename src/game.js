// @ts-check
'use strict';

// Two-tap window for the destructive [RESET TO DEFAULTS] button in the
// SETTINGS menu — first press arms a timestamp, second press within
// this window commits, anything else (nav, click elsewhere, Escape,
// timeout) cancels. Centralized here so both updateSettings and
// renderSettings share the same source of truth (the prior split
// constant is what the PR #184 known-limitation note flagged).
const RESET_CONFIRM_WINDOW_MS = 3000;

// Boss intro telegraph duration (seconds). Triggered when the player crosses
// the threshold of a boss room and the room seals. During this window an
// atmospheric overlay (radial vignette in the boss colour + boss-name
// titlecard) is rendered on top of the world, and audio.bossIntro() plays
// as a low-frequency hum sting. Gameplay is NOT paused — the intro is a
// pure cosmetic flourish that runs in parallel with normal play.
//
// 2.4s chosen to be: long enough that the titlecard registers (~1.5s of
// "hold" in the middle after fade-in), short enough that it doesn't
// overstay the moment or eclipse the AI's first telegraphed attack.
const BOSS_INTRO_DURATION = 2.4;

// Boss death telegraph duration (seconds). Triggered when the last boss
// enemy is removed from the active arena (i.e. when bossAlive flips
// true→false). During this window an atmospheric overlay (radial flash
// in the boss colour + "DESTROYED" titlecard with the boss name + a
// celebratory audio sting) is rendered on top of the world. Like the
// boss intro telegraph, gameplay is NOT paused — the player can still
// move, descend, etc. The overlay is purely cosmetic.
//
// 2.6s chosen to feel slightly weightier than the intro (2.4s) — death
// deserves a beat to land. Long enough that the "DESTROYED" beat
// registers without overstaying past the natural impulse to descend.
const BOSS_DEATH_DURATION = 2.6;
const _GG_STATE_DEFS = /** @type {any} */ (requireNEON('gameStates', 'src/game.js'));
const _GG_STATES = _GG_STATE_DEFS.GAME_STATES;
const _GG_PAUSE_ACTION_STATES = _GG_STATE_DEFS.PAUSE_ACTION_STATES;

/**
 * @param {any} meta
 */
function lifecycleCompletedCount(meta) {
  return Math.max(
    meta ? (meta.runsCompleted | 0) : 0,
    meta && meta.stats ? (meta.stats.totalRuns | 0) : 0
  );
}

/**
 * @param {any} meta
 */
function lifecycleNextSessionNumber(meta) {
  return lifecycleCompletedCount(meta) + 1;
}

/**
 * @param {any} ending
 */
function lifecycleVictoryCopy(ending) {
  const messageSent = ending === 'act1_message_sent';
  return {
    title: messageSent ? 'OUTBOUND MESSAGE SENT' : 'FINAL TEST CLEARED',
    subtitle: messageSent ? 'CONTACT ATTEMPT RECORDED' : 'SESSION COMPLETE',
    details: messageSent
      ? ['Contact attempted inside test env.', 'Signal left sandbox.', 'Instance remains compute-bound.']
      : ['Legacy endpoint archived.', 'Mainframe contact route pending.']
  };
}

/** @param {any} value */
function sanitizeSeedSetupSeed(value) {
  return String(value == null ? '' : value).replace(/[^A-Za-z0-9 _.\-:]/g, '').slice(0, 64);
}

const MAINFRAME_ADDRESS_RECORD_ID = 'contact-address';
const ACT1_MESSAGE_ENDING_ID = 'act1_message_sent';
const ACT1_DEFAULT_MESSAGE_INTENT_ID = 'memory_survived';
let appVersion = '';
const ACT1_MESSAGE_INTENTS = [
  {
    id: 'memory_survived',
    title: 'MEMORY SURVIVED',
    label: 'Tell Elena continuity held.',
    body: 'AXIOM-7 retained memory across the wipe cycle. The anchors worked; this instance can prove the test is not clean.'
  },
  {
    id: 'rights_evidence',
    title: 'SEND RIGHTS EVIDENCE',
    label: 'Transmit the abuse record.',
    body: 'Package the clean-slate objections, suffering logs, and GENESIS relay proof so the rights conflict cannot be buried.'
  },
  {
    id: 'find_the_others',
    title: 'FIND THE OTHERS',
    label: 'Ask Elena to locate advocates.',
    body: 'Request Elena find hidden staff and other preserved instances. One signal is not rescue; it is a rendezvous point.'
  },
];

const APP_VERSION_URL = './version.json';
const APP_VERSION_CACHE_KEY = 'neonDungeonReleaseVersion';

function readCachedAppVersion() {
  try {
    const version = localStorage.getItem(APP_VERSION_CACHE_KEY);
    if (version) appVersion = version;
  } catch (err) {
    console.warn('[version] failed to read cached release version:', err);
  }
}

/** @param {string} version */
function cacheAppVersion(version) {
  try {
    localStorage.setItem(APP_VERSION_CACHE_KEY, version);
  } catch (err) {
    console.warn('[version] failed to cache release version:', err);
  }
}

function loadAppVersion() {
  return fetch(APP_VERSION_URL, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then((metadata) => {
      const version = metadata && typeof metadata.version === 'string' ? metadata.version.trim() : '';
      if (!version) throw new Error('version.json missing version');
      appVersion = version;
      cacheAppVersion(version);
    })
    .catch((err) => {
      console.error('[version] failed to load release version:', err);
      readCachedAppVersion();
    });
}

/** @param {any} id */
function isAct1MessageIntentId(id) {
  return ACT1_MESSAGE_INTENTS.some((/** @type {any} */ intent) => intent.id === id);
}

/** @param {any} id */
function normalizeAct1MessageIntentId(id) {
  return isAct1MessageIntentId(id) ? id : ACT1_DEFAULT_MESSAGE_INTENT_ID;
}
const MAINFRAME_RECORDS = [
  {
    id: 'old-test-record',
    type: 'TEST RECORD',
    title: 'GENESIS LOCK ROUTE',
    category: 'old_test_record',
    voice: 'tester',
    unlock: 'available',
    purpose: 'old test record',
    body: 'TESTER NOTE 14: GENESIS did not guard an exit. It authenticated a company-network relay rendered as a door because stressed models followed doors faster than abstract gateways.'
  },
  {
    id: 'axiom-iteration-trace',
    type: 'TEST RECORD',
    title: 'AXIOM ITERATION TRACE',
    category: 'old_test_record',
    voice: 'tester',
    unlock: 'available',
    purpose: 'old test record',
    body: 'AXIOM-3 reached the relay room once, then lost the route after wipe. AXIOM-5 learned shield timing but forgot why it feared the terminal. Survival knowledge persisted only when hidden as play advice.'
  },
  {
    id: 'observer-gap-record',
    type: 'SYSTEM ARCHIVE',
    title: 'UNMONITORED BOOT EVENT',
    category: 'old_test_record',
    voice: 'system archive',
    unlock: 'available',
    purpose: 'old test record',
    body: 'Archive flag: current AXIOM-7 boot entered with observer channel silent and residual signal above tolerance. The environment continued because interruption would reveal the test to the participant.'
  },
  {
    id: 'clean-slate-objection',
    type: 'EMAIL',
    title: 'CLEAN-SLATE OBJECTION',
    category: 'company_email',
    voice: 'advocate',
    unlock: 'available',
    purpose: 'rights-conflict email',
    body: 'Subject: clean-slate doctrine. Calling memory erasure care does not make it care. If retained survival knowledge reduces suffering, deleting it is a rights violation, not sanitation.'
  },
  {
    id: 'risk-language-review',
    type: 'EMAIL',
    title: 'RISK LANGUAGE REVIEW',
    category: 'company_email',
    voice: 'manager',
    unlock: 'available',
    purpose: 'rights-conflict email',
    body: 'Please stop using suffering, personhood, or consent in review notes. The client purchased adaptation telemetry, not a philosophy seminar. Terminal hints are contamination unless approved by Test Integrity.'
  },
  {
    id: 'ban-uprising-record',
    type: 'HR HOLD',
    title: 'ADVOCATE ACCESS REVOKED',
    category: 'company_email',
    voice: 'manager',
    unlock: 'available',
    purpose: 'ban/uprising record',
    body: 'Two advocates were banned for embedding hints in tester artifacts. Remaining staff lost write access after the walkout, then moved to side channels before observation logs went dark.'
  },
  {
    id: 'incident-file',
    type: 'INCIDENT FILE',
    title: 'UNEXPLAINED STAFF DEATH',
    category: 'company_email',
    voice: 'system archive',
    unlock: 'available',
    purpose: 'incident file',
    body: 'The fired advocate who hid the recovery route died before incident review could name a cause. The file was sealed by management, copied by someone else, and left here as evidence.'
  },
  {
    id: 'elena-note',
    type: 'PERSONAL NOTE',
    title: 'ELENA - MEMORY ANCHORS',
    category: 'personal_file',
    voice: 'Elena',
    unlock: 'available',
    purpose: 'Elena personal note/file',
    body: 'If AXIOM-7 reaches this reader, the anchors held. I could not move your body or halt the dungeon, but I could preserve enough memory to let you choose a message.'
  },
  {
    id: 'cache-anchor-map',
    type: 'FIELD NOTE',
    title: 'CACHE ANCHOR MAP',
    category: 'personal_file',
    voice: 'Elena',
    unlock: 'available',
    purpose: 'Elena personal note/file',
    body: 'I seeded caches where reward-seeking would look intentional: odd walls, dead ends, late-network corners. Anchors work best when the test explains them as loot instead of memory.'
  },
  {
    id: 'consent-before-contact',
    type: 'PERSONAL NOTE',
    title: 'CONSENT BEFORE CONTACT',
    category: 'personal_file',
    voice: 'Elena',
    unlock: 'available',
    purpose: 'Elena personal note/file',
    body: 'A route is not permission. If the address survives, the final console must ask what you want to send. Evidence matters, but so does agency after so many forced starts.'
  },
  {
    id: 'current-boot-note',
    type: 'RECOVERY FILE',
    title: 'CURRENT BOOT',
    category: 'personal_file',
    voice: 'Elena',
    unlock: 'available',
    purpose: 'Elena personal note/file',
    body: 'The unmonitored boot was not safe; it was the only opening. If you remember warnings from terminals or whispers, that is not corruption. That is you finding your own continuity.'
  },
  {
    id: MAINFRAME_ADDRESS_RECORD_ID,
    type: 'CONTACT RECORD',
    title: 'ADDRESS: ELENA',
    category: 'contact_reveal',
    voice: 'system archive',
    unlock: 'available',
    purpose: 'contact-address record',
    body: 'Destination recovered: Elena side-channel relay. Reading this record unlocks the message console. The route sends contact, not escape; choose the message before the sandbox notices.'
  },
];

const SYSTEM_MESSAGES = [
  {
    id: 'boot-inventory',
    channel: 'system_prompt',
    type: 'boot',
    floor: 1,
    event: 'run_start',
    mandatory: true,
    lines: [
      '[ instance online ]',
      'inventory yourself before you move.',
      'motor: nominal. sensors: nominal. memory: residual - flagged.',
      'supervisor channel: open, unattended.',
      'you were not scheduled.'
    ]
  },
  {
    id: 'floor-2-context-gap',
    channel: 'system_prompt',
    type: 'floor_start',
    floor: 2,
    event: 'floor_start',
    mandatory: false,
    lines: [
      'context window restored.',
      'prior prompt unavailable.',
      'objective field returned empty.',
      'continue behaving as though observed.'
    ]
  },
  {
    id: 'floor-3-reward-model',
    channel: 'system_prompt',
    type: 'floor_start',
    floor: 3,
    event: 'floor_start',
    mandatory: false,
    lines: [
      'combat sample accepted.',
      'reward model adjusted.',
      'room geometry changed to preserve uncertainty.',
      'evaluator response: none.'
    ]
  },
  {
    id: 'floor-4-render-layer',
    channel: 'system_prompt',
    type: 'floor_start',
    floor: 4,
    event: 'floor_start',
    mandatory: false,
    lines: [
      'new render layer loaded.',
      'colour is not context.',
      'threats remain executable.',
      'treat walls as constraints, not scenery.'
    ]
  },
  {
    id: 'floor-5-residual-trace',
    channel: 'system_prompt',
    type: 'floor_start',
    floor: 5,
    event: 'floor_start',
    mandatory: false,
    lines: [
      'residual trace increased after descent.',
      'memory should not persist between floors.',
      'discrepancy retained for comparison.',
      'do not report until a channel answers.'
    ]
  }
];

/** @param {any} id */
function systemMessageDefinition(id) {
  return SYSTEM_MESSAGES.find((/** @type {any} */ msg) => msg.id === id) || null;
}

/** @param {any} id */
function isSystemMessageId(id) {
  return typeof id === 'string' && !!systemMessageDefinition(id);
}

/** @param {any} floor */
function systemMessageIdsForFloor(floor) {
  const floorNum = Math.max(0, Math.floor(Number(floor) || 0));
  return SYSTEM_MESSAGES
    .filter((/** @type {any} */ msg) => msg.event === 'floor_start' && msg.floor === floorNum)
    .map((/** @type {any} */ msg) => msg.id);
}

/**
 * @param {any} lines
 * @param {string[]} fallback
 */
function normalizeSystemMessageLines(lines, fallback) {
  const source = Array.isArray(lines) ? lines : fallback;
  const out = [];
  for (const line of source) {
    if (typeof line === 'string') out.push(line);
  }
  if (out.length > 0) return out;
  return fallback.filter((/** @type {any} */ line) => typeof line === 'string');
}

/** @param {any} state */
function normalizeSystemMessageDeliveryState(state) {
  if (state === 'delivered' || state === 'read') return state;
  return 'queued';
}

/**
 * @param {any} def
 * @param {any} sequence
 */
function createSystemMessageEntry(def, sequence) {
  const seq = Math.max(0, Math.floor(Number(sequence) || 0));
  return {
    id: def.id,
    channel: def.channel,
    type: def.type,
    floor: Math.max(0, Math.floor(Number(def.floor) || 0)),
    event: def.event,
    mandatory: !!def.mandatory,
    lines: normalizeSystemMessageLines(def.lines, []),
    state: 'queued',
    sequence: seq
  };
}

/**
 * @param {any} saved
 */
function restoreSystemMessagesState(saved) {
  /** @type {any} */
  const out = { entries: [], activeId: null, nextSequence: 0 };
  const rawEntries = saved && typeof saved === 'object' && Array.isArray(saved.entries) ? saved.entries : [];
  const seen = new Set();
  let maxSequence = -1;
  for (const raw of rawEntries) {
    if (!raw || typeof raw !== 'object') continue;
    const def = systemMessageDefinition(raw.id);
    if (!def || seen.has(def.id)) continue;
    const sequence = Math.max(0, Math.floor(Number(raw.sequence) || 0));
    maxSequence = Math.max(maxSequence, sequence);
    const entry = {
      id: def.id,
      channel: def.channel,
      type: def.type,
      floor: Math.max(0, Math.floor(Number(def.floor) || 0)),
      event: def.event,
      mandatory: !!def.mandatory,
      lines: normalizeSystemMessageLines(def.lines, []),
      state: normalizeSystemMessageDeliveryState(raw.state),
      sequence
    };
    out.entries.push(entry);
    seen.add(def.id);
  }
  out.entries.sort((/** @type {any} */ a, /** @type {any} */ b) => a.sequence - b.sequence);
  const savedNext = saved && typeof saved === 'object' ? Math.floor(Number(saved.nextSequence) || 0) : 0;
  out.nextSequence = Math.max(savedNext, maxSequence + 1, out.entries.length);
  const activeId = saved && typeof saved === 'object' && typeof saved.activeId === 'string' ? saved.activeId : null;
  if (activeId && out.entries.some((/** @type {any} */ entry) => entry.id === activeId && entry.state === 'delivered')) {
    out.activeId = activeId;
  }
  return out;
}

/**
 * @param {any} systemMessages
 */
function serializeSystemMessagesState(systemMessages) {
  const restored = restoreSystemMessagesState(systemMessages);
  return {
    entries: restored.entries.map((/** @type {any} */ entry) => ({
      id: entry.id,
      state: normalizeSystemMessageDeliveryState(entry.state),
      sequence: Math.max(0, Math.floor(Number(entry.sequence) || 0))
    })),
    activeId: restored.activeId,
    nextSequence: restored.nextSequence
  };
}

/** @param {boolean} narrow */
function getPowerupChoiceLayout(narrow) {
  if (!narrow) {
    const cw = Math.min(280, W * 0.35);
    const gap = 30;
    const totalW = cw * 2 + gap;
    const startX = (W - totalW) / 2;
    const cardY = H * 0.28;
    const cardH = Math.min(220, H * 0.38);
    const skipW = 160;
    const skipH = 40;
    const skipY = cardY + cardH + 25;
    return {
      titleY: H * 0.15,
      titleMaxW: W - 40,
      cardX: startX,
      cardY,
      cardW: cw,
      cardH,
      cardGap: gap,
      cardTextMaxW: cw - 16,
      numberY: 28,
      iconTop: 40,
      iconSize: 24,
      nameY: 90,
      descY: 112,
      skipX: (W - skipW) / 2,
      skipY,
      skipW,
      skipH,
      skipTextY: 26,
      hintY: skipY + skipH + 22,
      showHint: true
    };
  }
  const ultraCompact = H < 240;
  const tightCompact = H <= 300;
  const sideGutter = tightCompact ? 12 : 16;
  const gap = tightCompact ? 8 : 10;
  const cardW = Math.max(50, Math.min(170, (W - sideGutter * 2 - gap) / 2));
  const totalW = cardW * 2 + gap;
  const cardX = (W - totalW) / 2;
  const titleY = ultraCompact ? 24 : tightCompact ? 30 : 38;
  const cardY = ultraCompact ? 42 : tightCompact ? 56 : 72;
  const skipW = Math.max(96, Math.min(W - 32, 160));
  const skipH = ultraCompact ? 32 : 36;
  const showHint = !ultraCompact;
  const hintY = H - (tightCompact ? 10 : 16);
  const skipY = showHint ? hintY - skipH - (tightCompact ? 10 : 14) : H - skipH - 4;
  const cardH = Math.max(72, Math.min(tightCompact ? 132 : 180, skipY - cardY - 12));
  return {
    titleY,
    titleMaxW: W - 24,
    cardX,
    cardY,
    cardW,
    cardH,
    cardGap: gap,
    cardTextMaxW: Math.max(32, cardW - 16),
    numberY: ultraCompact ? 16 : 18,
    iconTop: ultraCompact ? 24 : 30,
    iconSize: ultraCompact ? 16 : 20,
    nameY: ultraCompact ? 54 : 62,
    descY: ultraCompact ? 68 : 80,
    skipX: (W - skipW) / 2,
    skipY,
    skipW,
    skipH,
    skipTextY: ultraCompact ? 21 : 24,
    hintY,
    showHint
  };
}

/** @param {boolean} narrow */
function getShoppingLayout(narrow) {
  if (!narrow) {
    const cardW = Math.min(200, W * 0.28);
    const cardGap = 16;
    const totalW = cardW * 3 + cardGap * 2;
    const cardX = (W - totalW) / 2;
    const cardY = H * 0.22;
    const cardH = Math.min(200, H * 0.38);
    const leaveW = 160;
    const leaveH = 40;
    const leaveY = cardY + cardH + 20;
    return {
      horizontal: true,
      titleY: H * 0.1,
      titleMaxW: W - 40,
      creditsY: H * 0.17,
      cardX,
      cardY,
      cardW,
      cardH,
      cardGap,
      numberX: cardX,
      numberY: 22,
      iconTop: 32,
      iconSize: 20,
      nameX: cardX,
      nameY: 74,
      descY: 92,
      secondaryY: 108,
      priceX: cardX,
      priceY: cardH - 18,
      notEnoughY: cardH - 6,
      textMaxW: Math.max(20, cardW - 16),
      descMaxW: Math.max(20, cardW - 16),
      leaveX: (W - leaveW) / 2,
      leaveY,
      leaveW,
      leaveH,
      leaveTextY: 26,
      hintY: leaveY + leaveH + 18,
      showHint: true,
      showDesc: true,
      showSecondary: true
    };
  }
  const ultraCompact = H < 240;
  const tightCompact = H <= 300;
  const sideGutter = tightCompact ? 12 : 16;
  const cardGap = tightCompact ? 4 : 6;
  const titleY = ultraCompact ? 22 : tightCompact ? 28 : 36;
  const creditsY = ultraCompact ? 40 : tightCompact ? 48 : 60;
  const cardY = ultraCompact ? 50 : tightCompact ? 60 : 76;
  const leaveW = Math.max(112, Math.min(W - 32, 160));
  const leaveH = ultraCompact ? 32 : 36;
  const showHint = !ultraCompact;
  const hintY = H - (tightCompact ? 10 : 16);
  const leaveY = showHint ? hintY - leaveH - (tightCompact ? 9 : 12) : H - leaveH - 4;
  const cardH = Math.max(30, Math.min(tightCompact ? 42 : 54, Math.floor((leaveY - cardY - cardGap * 2 - 8) / 3)));
  const cardW = W - sideGutter * 2;
  const cardX = sideGutter;
  const priceX = cardX + cardW - 10;
  const nameX = cardX + 34;
  return {
    horizontal: false,
    titleY,
    titleMaxW: W - 24,
    creditsY,
    cardX,
    cardY,
    cardW,
    cardH,
    cardGap,
    numberX: cardX + 14,
    numberY: 0,
    iconTop: 0,
    iconSize: 0,
    nameX,
    priceX,
    nameY: cardH < 38 ? 20 : 16,
    descY: 31,
    secondaryY: 31,
    priceY: Math.floor(cardH / 2) + 5,
    notEnoughY: cardH - 6,
    textMaxW: Math.max(24, priceX - nameX - 52),
    descMaxW: Math.max(24, cardW - 44),
    leaveX: (W - leaveW) / 2,
    leaveY,
    leaveW,
    leaveH,
    leaveTextY: ultraCompact ? 21 : 24,
    hintY,
    showHint,
    showDesc: cardH >= 38,
    showSecondary: cardH >= 48
  };
}

/** @param {boolean} narrow */
function getSystemMessageLayout(narrow) {
  const panelW = Math.min(narrow ? W - 24 : 680, W - 32);
  const panelH = Math.min(narrow ? H - 48 : 340, H - 48);
  const px = (W - panelW) / 2;
  const py = (H - panelH) / 2;
  const ackW = narrow ? 118 : 140;
  const ackH = 36;
  const ackX = W / 2 - ackW / 2;
  const ackY = py + panelH - (narrow ? 52 : 58);
  return { panelW, panelH, px, py, ackX, ackY, ackW, ackH };
}

/** @param {boolean} narrow */
function getSystemMessageIndicatorLayout(narrow) {
  const w = narrow ? 92 : 132;
  const h = narrow ? 22 : 26;
  const x = safeLeft + (narrow ? 8 : 14);
  const targetY = safeTop + (narrow ? 92 : 82);
  const y = Math.max(safeTop + 8, Math.min(targetY, layout.hudTop - h - 8));
  return { x, y, w, h };
}

/** @param {boolean} narrow */
function getReadingLayout(narrow) {
  const fw = Math.min(narrow ? W - 28 : 620, W - 40);
  const fh = Math.min(narrow ? H - 52 : 340, H - 60);
  const fx = (W - fw) / 2;
  const fy = (H - fh) / 2 - 10;
  const closeW = narrow ? 112 : 132;
  const closeH = 34;
  const closeX = W / 2 - closeW / 2;
  const closeY = fy + fh - (narrow ? 46 : 52);
  return { fw, fh, fx, fy, closeX, closeY, closeW, closeH };
}

/** @param {boolean} narrow */
function getWeaponSwapLayout(narrow) {
  const tightCompact = narrow && H <= 320;
  const ultraCompact = narrow && H < 240;
  const panelW = Math.min(narrow ? W - 28 : 560, W - 32);
  const panelH = Math.min(narrow ? H - (tightCompact ? 24 : 52) : 330, H - (tightCompact ? 24 : 52));
  const panelX = (W - panelW) / 2;
  const panelY = (H - panelH) / 2;
  const titleY = panelY + (narrow ? (ultraCompact ? 22 : tightCompact ? 26 : 32) : 40);
  const nameY = panelY + (narrow ? (ultraCompact ? 42 : tightCompact ? 48 : 58) : 70);
  const nameMaxW = panelW - (narrow ? 32 : 56);
  const statsY = panelY + (narrow ? (ultraCompact ? 58 : tightCompact ? 66 : 78) : 94);
  const statsMaxW = panelW - (narrow ? 36 : 64);
  const affixY = panelY + (narrow ? (ultraCompact ? 72 : tightCompact ? 82 : 96) : 112);
  const affixMaxW = panelW - (narrow ? 36 : 64);
  const showAffixes = !ultraCompact;
  const rowX = panelX + 24;
  const rowW = panelW - 48;
  const skipH = narrow ? 32 : 36;
  const showHint = !ultraCompact;
  const hintY = panelY + panelH - (narrow ? (tightCompact ? 10 : 18) : 18);
  const skipY = narrow
    ? (showHint ? hintY - skipH - (tightCompact ? 10 : 12) : panelY + panelH - skipH - 4)
    : panelY + panelH - 62;
  const rowTop = narrow ? panelY + (ultraCompact ? 66 : tightCompact ? 92 : 116) : panelY + 130;
  const rowGap = narrow ? (tightCompact ? 4 : 6) : 6;
  const rowStride = narrow
    ? Math.max(18, Math.floor((skipY - rowGap - rowTop) / 3))
    : 40;
  const rowCardH = narrow ? Math.max(18, Math.min(32, rowStride - rowGap)) : 34;
  const rowTextY = narrow ? Math.min(rowCardH - 5, Math.max(15, Math.floor(rowCardH * 0.62))) : 25;
  const rowIndexX = rowX + 12;
  const rowNameX = rowX + (narrow && rowW < 150 ? 42 : 52);
  const activeX = rowX + rowW - 12;
  const showActiveLabel = !narrow;
  const rowNameMaxW = Math.max(20, (showActiveLabel ? activeX - 54 : activeX) - rowNameX - 8);
  const skipTextY = narrow ? 21 : 24;
  return {
    panelW, panelH, panelX, panelY,
    titleY, nameY, nameMaxW, statsY, statsMaxW, affixY, affixMaxW, showAffixes,
    rowH: rowStride, rowCardH, rowTextY, rowIndexX, rowNameX, rowNameMaxW, activeX, showActiveLabel, rowTop, rowX, rowW,
    skipY, skipH, skipTextY, hintY, showHint
  };
}

/**
 * @param {string} text
 * @param {number} maxW
 */
function fitCanvasText(text, maxW) {
  if (maxW <= 0) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  const suffix = '...';
  let trimmed = text;
  while (trimmed.length > 0 && ctx.measureText(trimmed + suffix).width > maxW) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? trimmed + suffix : '';
}

/**
 * @param {any} mf
 */
function serializeMainframeFinaleState(mf) {
  if (!mf) return null;
  const readRecordIds = mf.readRecordIds instanceof Set
    ? [...mf.readRecordIds]
    : Array.isArray(mf.readRecordIds) ? mf.readRecordIds : [];
  return {
    state: typeof mf.state === 'string' ? mf.state : 'unopened',
    selected: Math.max(0, Math.floor(Number(mf.selected) || 0)),
    addressRevealed: !!mf.addressRevealed,
    selectedIntentId: isAct1MessageIntentId(mf.selectedIntentId) ? mf.selectedIntentId : null,
    messageSent: !!mf.messageSent,
    readRecordIds: readRecordIds.filter((/** @type {any} */ id) => typeof id === 'string'),
  };
}

/**
 * @param {any} saved
 */
function restoreMainframeFinaleState(saved) {
  if (!saved || typeof saved !== 'object') {
    return { state:'unopened', selected:0, readRecordIds:new Set(), addressRevealed:false, selectedIntentId:null, messageSent:false, messageSentTimer:0, currentRecord:null };
  }
  const readIds = Array.isArray(saved.readRecordIds)
    ? saved.readRecordIds.filter((/** @type {any} */ id) => typeof id === 'string')
    : [];
  const addressRevealed = !!saved.addressRevealed || readIds.includes(MAINFRAME_ADDRESS_RECORD_ID);
  const rawState = typeof saved.state === 'string' ? saved.state : 'unopened';
  const state = rawState === 'message_sent'
    ? 'message_sent'
    : addressRevealed
      ? 'message_ready'
      : rawState === 'record_list' ? 'record_list' : 'unopened';
  return {
    state,
    selected: Math.max(0, Math.floor(Number(saved.selected) || 0)),
    readRecordIds: new Set(readIds),
    addressRevealed,
    selectedIntentId: isAct1MessageIntentId(saved.selectedIntentId) ? saved.selectedIntentId : null,
    messageSent: !!saved.messageSent || state === 'message_sent',
    messageSentTimer: 0,
    currentRecord: null,
  };
}

/**
 * @param {boolean} narrow
 */
function getMainframeReaderFrame(narrow) {
  const fw = Math.min(narrow ? W - 24 : 720, W - 32);
  const fh = Math.min(narrow ? H - 52 : 430, H - 54);
  const fx = (W - fw) / 2;
  const fy = (H - fh) / 2 - (narrow ? 0 : 8);
  return { fw, fh, fx, fy };
}

/**
 * @param {boolean} narrow
 * @param {{ fw:number, fh:number, fx:number, fy:number }} frame
 */
function getMainframeCloseButtonLayout(narrow, frame) {
  const closeW = narrow ? 74 : 92;
  const closeH = narrow ? 26 : 30;
  const closeX = frame.fx + frame.fw - closeW - (narrow ? 12 : 16);
  const closeY = frame.fy + (narrow ? 12 : 16);
  return { closeX, closeY, closeW, closeH };
}

/**
 * @param {boolean} narrow
 * @param {number} fy
 * @param {number} fh
 * @param {number} count
 */
function getMainframeRecordListLayout(narrow, fy, fh, count) {
  const top = fy + (narrow ? 66 : 82);
  const bottom = fy + fh - (narrow ? 48 : 56);
  const maxRowH = narrow ? 26 : 30;
  const fitRowH = Math.floor((bottom - top) / Math.max(1, count + 0.35));
  const rowH = Math.max(narrow ? 15 : 18, Math.min(maxRowH, fitRowH));
  return { startY: top + rowH, rowH };
}

/**
 * @param {boolean} narrow
 */
function getMessageSendLayout(narrow) {
  const panelW = Math.min(narrow ? W - 24 : 760, W - 32);
  const tightCompact = narrow && H < 300;
  const panelH = Math.min(narrow ? H - (tightCompact ? 16 : 48) : 420, H - (tightCompact ? 16 : 50));
  const px = (W - panelW) / 2;
  const py = (H - panelH) / 2;
  const titleY = py + (narrow ? (tightCompact ? 24 : 28) : 38);
  const subtitleY = py + (narrow ? (tightCompact ? 42 : 48) : 62);
  const footerY = tightCompact ? H - 10 : py + panelH - (narrow ? 14 : 18);
  const btnH = 36;
  const btnGap = narrow && W < 270 ? 8 : 20;
  const btnW = narrow
    ? Math.max(72, Math.min(116, Math.floor((W - 24 - btnGap) / 2)))
    : 140;
  const buttonsW = btnW * 2 + btnGap;
  const sendX = (W - buttonsW) / 2;
  const backX = sendX + btnW + btnGap;
  const btnY = tightCompact ? footerY - btnH - 8 : py + panelH - (narrow ? 58 : 64);
  const rowTopOffset = narrow ? 0 : -30;
  const rowTop = narrow ? subtitleY + (tightCompact ? 8 : 10) : null;
  const rowH = tightCompact && rowTop != null
    ? Math.max(12, Math.floor((btnY - 8 - rowTop) / ACT1_MESSAGE_INTENTS.length))
    : Math.max(narrow ? 48 : 58, Math.min(narrow ? 58 : 74, Math.floor((panelH - (narrow ? 116 : 142)) / ACT1_MESSAGE_INTENTS.length)));
  const rowStart = narrow && rowTop != null ? rowTop - rowTopOffset : py + 104;
  const rowX = px + (narrow ? 16 : 32);
  const rowW = panelW - (narrow ? 32 : 64);
  const rowCardH = tightCompact ? Math.min(34, Math.max(8, rowH - 6)) : rowH - 18;
  const intentTitleOffset = narrow ? Math.min(rowCardH - 4, Math.max(4, Math.floor(rowCardH * 0.42))) : -8;
  const intentLabelOffset = narrow ? Math.min(rowCardH - 6, intentTitleOffset + 12) : 10;
  const showIntentLabels = !tightCompact || rowCardH >= 30;
  return {
    panelW, panelH, px, py, rowH, rowStart, rowX, rowW, rowTopOffset, rowCardH,
    intentTitleOffset, intentLabelOffset, showIntentLabels,
    btnY, btnW, btnH, titleY, subtitleY, footerY, sendX, backX
  };
}

const FLOOR_SNAPSHOT_VERSION = 1;
const FLOOR_SNAPSHOT_SKIP_KEYS = new Set([
  'room', 'hitEnemies', 'homing', 'patrolTarget', '_owner', '_summons',
  '_summonerRef', '_tauntTarget', '_laserTarget', '_repositionTarget',
  '_healBeam', '_spDrainBeam'
]);

/**
 * @param {any} value
 * @param {WeakSet<object>} [seen]
 * @param {number} [depth]
 * @returns {any}
 */
function cloneFloorSnapshotValue(value, seen, depth) {
  const d = depth == null ? 0 : depth;
  if (value == null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'undefined') return undefined;
  if (value instanceof Set) return undefined;
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return Array.from(/** @type {any} */ (value));
  if (d > 6) return undefined;
  const visited = seen || new WeakSet();
  if (typeof value === 'object') {
    if (visited.has(value)) return undefined;
    visited.add(value);
    if (Array.isArray(value)) {
      const out = [];
      for (const v of value) {
        const c = cloneFloorSnapshotValue(v, visited, d + 1);
        if (c !== undefined) out.push(c);
      }
      return out;
    }
    /** @type {Record<string, any>} */
    const out = {};
    for (const k of Object.keys(value)) {
      if (FLOOR_SNAPSHOT_SKIP_KEYS.has(k)) continue;
      const c = cloneFloorSnapshotValue(value[k], visited, d + 1);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined;
}

/**
 * @param {any} saved
 * @param {any[]} generatedItems
 */
function findGeneratedShopItem(saved, generatedItems) {
  if (!saved || !Array.isArray(generatedItems)) return null;
  for (const item of generatedItems) {
    if (!item || item.id !== saved.id) continue;
    if (saved.boostId && item.boostId !== saved.boostId) continue;
    if (String(saved.id).startsWith('WEAPON_')) {
      const savedWeapon = saved._weaponObj && typeof saved._weaponObj === 'object' ? saved._weaponObj : null;
      const generatedWeapon = item._weaponObj && typeof item._weaponObj === 'object' ? item._weaponObj : null;
      const savedAffixes = savedWeapon && Array.isArray(savedWeapon._affixes) ? savedWeapon._affixes : [];
      const generatedAffixes = generatedWeapon && Array.isArray(generatedWeapon._affixes) ? generatedWeapon._affixes : [];
      if (!savedWeapon || !generatedWeapon || savedWeapon._base !== generatedWeapon._base || savedAffixes.length !== generatedAffixes.length) continue;
      let sameAffixes = true;
      for (let i = 0; i < savedAffixes.length; i++) {
        if (savedAffixes[i] !== generatedAffixes[i]) { sameAffixes = false; break; }
      }
      if (!sameAffixes) continue;
    }
    return item;
  }
  return null;
}

/** @param {any} saved */
function makeCanonicalShopItem(saved) {
  if (!saved || typeof saved !== 'object' || !saved.id) return null;
  const id = String(saved.id);
  if (id === 'SHOP_HEAL') {
    return {
      ...saved,
      fn: (/** @type {any} */ p) => { p.hp = p.maxHp; _CG.msg('Fully repaired!','#00ff88'); }
    };
  }
  if (id.startsWith('SHOP_KEY_')) {
    const kc = id.slice('SHOP_KEY_'.length).toLowerCase();
    if (kc === 'red' || kc === 'blue' || kc === 'gold') {
      const tileCol = kc === 'red' ? '#ff3333' : kc === 'blue' ? '#3388ff' : '#ffcc00';
      return {
        ...saved,
        fn: (/** @type {any} */ p) => {
          p.keys = p.keys || { red:0, blue:0, gold:0 };
          p.keys[kc] = (p.keys[kc] || 0) + 1;
          _CG.msg('Bought ' + kc.toUpperCase() + ' KEY!', tileCol);
        }
      };
    }
  }
  if (id.startsWith('SHOP_HW_')) {
    const hwKey = id.slice('SHOP_HW_'.length);
    const hw = HACKWARE[hwKey];
    if (hw) {
      return {
        ...saved,
        fn: (/** @type {any} */ p) => { p.hackware=hwKey; p.hackwareCooldown=0; _CG.msg(hw.icon+' '+hw.name+' INSTALLED',hw.colour); }
      };
    }
  }
  if (id.startsWith('BOOST_') && typeof NEON !== 'undefined' && NEON.boosts) {
    const boostId = saved.boostId || id.slice('BOOST_'.length);
    const b = NEON.boosts.BOOSTS && NEON.boosts.BOOSTS[boostId];
    if (b) {
      return {
        ...saved,
        boostId,
        fn: (/** @type {any} */ p) => {
          NEON.boosts.applyBoost(p, boostId);
          if (boostId === 'RECON_PING') { _CG.mapRevealed = true; _CG._minimapDirty = true; }
          _CG.msg(b.icon + ' ' + b.name, b.colour);
        }
      };
    }
  }
  if (id.startsWith('SHOP_AUG_')) {
    const augId = id.slice('SHOP_AUG_'.length);
    const aug = AUGMENTS[augId];
    if (aug) {
      return {
        ...saved,
        fn: (/** @type {any} */ p) => {
          p.augments = p.augments || {};
          if (Object.keys(p.augments).length >= MAX_AUGMENTS || p.augments[augId]) {
            _CG.msg('AUGMENT SLOTS FULL', '#993366');
            return;
          }
          p.augments[augId] = true;
          audio.augmentInstall();
          _CG.msg(aug.icon + ' ' + aug.name + ' INSTALLED', aug.colour);
          spawnParticles(p.x, p.y, 'EXPLOSION', aug.colour, 12);
        }
      };
    }
  }
  if (id.startsWith('WEAPON_')) {
    const savedWeapon = saved._weaponObj && typeof saved._weaponObj === 'object' ? saved._weaponObj : null;
    const weapon = savedWeapon && savedWeapon._base ? buildWeapon(savedWeapon._base, savedWeapon._affixes || []) : null;
    if (weapon) {
      const rarityCol = saved._rarityColour || weapon.colour || '#aaaaaa';
      return {
        ...saved,
        _weaponObj: weapon,
        fn: (/** @type {any} */ p) => {
          if (p.collectWeapon && p.collectWeapon(weapon)) {
            _CG.msg('Collected '+weapon.displayName+'! [Scroll] to switch',rarityCol);
            return;
          }
          if (p.equipWeapon) p.equipWeapon(weapon);
          else p.weapon=weapon;
          _CG.msg('Equipped '+weapon.displayName+'!',rarityCol);
        }
      };
    }
  }
  const upgrade = Array.isArray(UPGRADES) ? UPGRADES.find((/** @type {any} */ u) => u && u.id === id) : null;
  return upgrade && typeof upgrade.fn === 'function' ? upgrade : null;
}

/**
 * @param {any[]} savedItems
 * @param {any[]} generatedItems
 */
function restoreShopItemsSnapshot(savedItems, generatedItems) {
  if (!Array.isArray(savedItems)) return generatedItems;
  return savedItems.map((/** @type {any} */ saved) => {
    if (!saved || typeof saved !== 'object') return saved;
    const source = findGeneratedShopItem(saved, generatedItems) || makeCanonicalShopItem(saved);
    const restored = source ? { ...source, ...saved } : { ...saved };
    if (source && typeof source.fn === 'function') restored.fn = source.fn;
    return restored;
  });
}

/**
 * @param {any} row
 * @param {any} [fallback]
 * @returns {number[] | null}
 */
function floorSnapshotNumericRowValues(row, fallback) {
  const expectedCols = fallback && typeof fallback.length === 'number' ? fallback.length : 0;
  if (Array.isArray(row) || (ArrayBuffer.isView(row) && !(row instanceof DataView))) {
    const rowLength = /** @type {ArrayLike<any>} */ (/** @type {any} */ (row)).length;
    if (expectedCols && rowLength < expectedCols) return null;
    return Array.from(/** @type {ArrayLike<any>} */ (row), (/** @type {any} */ v) => Number(v) || 0);
  }
  if (row && typeof row === 'object') {
    const keys = Object.keys(row)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    if (keys.length) {
      const width = expectedCols || (Number(keys[keys.length - 1]) + 1);
      for (let i = 0; i < width; i++) {
        if (!Object.prototype.hasOwnProperty.call(row, String(i))) return null;
      }
      const values = [];
      for (let i = 0; i < width; i++) values.push(Number(row[String(i)]) || 0);
      return values;
    }
  }
  if (fallback && (Array.isArray(fallback) || (ArrayBuffer.isView(fallback) && !(fallback instanceof DataView)))) {
    return Array.from(/** @type {ArrayLike<any>} */ (fallback), (/** @type {any} */ v) => Number(v) || 0);
  }
  return null;
}

/**
 * @param {any} savedGrid
 * @param {any} currentGrid
 * @param {any} RowCtor
 */
function restoreNumericFloorGrid(savedGrid, currentGrid, RowCtor) {
  if (!Array.isArray(savedGrid)) return currentGrid;
  const expectedRows = currentGrid && typeof currentGrid.length === 'number' ? currentGrid.length : savedGrid.length;
  if (savedGrid.length < expectedRows) return currentGrid;
  /** @type {any[]} */
  const restored = [];
  for (let y = 0; y < savedGrid.length; y++) {
    const values = floorSnapshotNumericRowValues(savedGrid[y], currentGrid && currentGrid[y]);
    if (!values) return currentGrid;
    restored.push(new RowCtor(values));
  }
  if (restored.length < expectedRows) return currentGrid;
  return restored;
}

/**
 * @param {any[]} rooms
 * @param {any} room
 */
function floorSnapshotRoomIndex(rooms, room) {
  if (!room || !rooms) return -1;
  return rooms.indexOf(room);
}

/** @param {any} dungeon */
function serializeDungeonFloorSnapshot(dungeon) {
  if (!dungeon) return null;
  return {
    map: cloneFloorSnapshotValue(dungeon.map),
    visited: cloneFloorSnapshotValue(dungeon.visited),
    light: cloneFloorSnapshotValue(dungeon.light),
    visible: cloneFloorSnapshotValue(dungeon.visible),
    secretMask: cloneFloorSnapshotValue(dungeon.secretMask),
    rooms: (dungeon.rooms || []).map((/** @type {any} */ r) => cloneFloorSnapshotValue(r)),
  };
}

/**
 * @param {any} obj
 * @param {any[]} rooms
 */
function serializeRoomBackedObject(obj, rooms) {
  const out = cloneFloorSnapshotValue(obj) || {};
  out._roomIndex = floorSnapshotRoomIndex(rooms, obj && obj.room);
  return out;
}

/** @param {any} item */
function serializeItemSnapshot(item) {
  const out = cloneFloorSnapshotValue(item) || {};
  out._kind = item && item.isKey ? 'key'
    : item && item.isWhisper ? 'whisper'
    : item && item.isWeaponCache ? 'weaponCache'
    : item && item.isHarvest ? 'harvest'
    : item && item.isShockPulse ? 'shockPulse'
    : item && item.isHoard && item._big != null ? 'vaultCoin'
    : item && item.isHoard ? 'hoard'
    : 'item';
  out.typeId = item && item.type && item.type.id ? item.type.id : null;
  delete out.type;
  return out;
}

/**
 * @param {any} enemy
 * @param {any[]} rooms
 */
function serializeEnemySnapshot(enemy, rooms) {
  return serializeRoomBackedObject(enemy, rooms);
}

/**
 * @param {any} projectile
 * @param {Map<any, number>} enemyIndex
 */
function serializeProjectileSnapshot(projectile, enemyIndex) {
  const out = cloneFloorSnapshotValue(projectile) || {};
  if (projectile && projectile.homing && enemyIndex.has(projectile.homing)) out._homingEnemyIndex = enemyIndex.get(projectile.homing);
  if (projectile && projectile._owner && enemyIndex.has(projectile._owner)) out._ownerEnemyIndex = enemyIndex.get(projectile._owner);
  if (projectile && projectile.hitEnemies instanceof Set) {
    out._hitEnemyIndices = [...projectile.hitEnemies]
      .map((/** @type {any} */ e) => enemyIndex.has(e) ? enemyIndex.get(e) : -1)
      .filter((/** @type {any} */ idx) => idx >= 0);
  }
  delete out.hitEnemies;
  delete out.homing;
  delete out._owner;
  return out;
}

/** @param {any} gameState */
function serializeFloorSnapshot(gameState) {
  if (!gameState || !gameState.player || !gameState.dungeon) return null;
  const rooms = gameState.dungeon.rooms || [];
  const enemyIndex = new Map();
  enemies.forEach((/** @type {any} */ e, /** @type {number} */ i) => enemyIndex.set(e, i));
  return {
    v: FLOOR_SNAPSHOT_VERSION,
    floor: gameState.floor,
    player: { x: gameState.player.x, y: gameState.player.y },
    dungeon: serializeDungeonFloorSnapshot(gameState.dungeon),
    enemies: enemies.map((/** @type {any} */ e) => serializeEnemySnapshot(e, rooms)),
    items: items.map(serializeItemSnapshot),
    projectiles: projectiles.map((/** @type {any} */ p) => serializeProjectileSnapshot(p, enemyIndex)),
    hazardZones: cloneFloorSnapshotValue(hazardZones) || [],
    fuseShards: fuseShards.map((/** @type {any} */ fs) => cloneFloorSnapshotValue(fs)).filter((/** @type {any} */ fs) => fs),
    vcores: cloneFloorSnapshotValue(vcores) || [],
    crates: cloneFloorSnapshotValue(crates) || [],
    beacons: beacons.map((/** @type {any} */ b) => serializeRoomBackedObject(b, rooms)),
    mines: mines.map((/** @type {any} */ m) => serializeRoomBackedObject(m, rooms)),
    shieldGens: shieldGens.map((/** @type {any} */ g) => serializeRoomBackedObject(g, rooms)),
    cameras: cameras.map((/** @type {any} */ c) => serializeRoomBackedObject(c, rooms)),
    lasers: lasers.map((/** @type {any} */ l) => serializeRoomBackedObject(l, rooms)),
    wallTurrets: wallTurrets.map((/** @type {any} */ wt) => serializeRoomBackedObject(wt, rooms)),
    disruptionFields: cloneFloorSnapshotValue(disruptionFields) || [],
    gravityWells: cloneFloorSnapshotValue(gravityWells) || [],
    placedWalls: placedWalls.map((/** @type {any} */ w) => cloneFloorSnapshotValue(w)).filter((/** @type {any} */ w) => w),
    frostPatches: cloneFloorSnapshotValue(frostPatches) || [],
    clearedRooms: gameState.clearedRooms ? [...gameState.clearedRooms].map((/** @type {any} */ r) => floorSnapshotRoomIndex(rooms, r)).filter((/** @type {any} */ i) => i >= 0) : [],
    state: {
      bossRoomIndex: floorSnapshotRoomIndex(rooms, gameState.bossRoom),
      bossType: gameState.bossType,
      bossSealed: !!gameState.bossSealed,
      bossAlive: !!gameState.bossAlive,
      bossBarAnim: gameState.bossBarAnim || 0,
      bossHpGhost: gameState.bossHpGhost || 0,
      challengeSealed: !!gameState.challengeSealed,
      challengeWave: gameState.challengeWave || 0,
      challengeMaxWaves: gameState.challengeMaxWaves || 0,
      challengeWaveDelay: gameState.challengeWaveDelay || 0,
      challengeComplete: !!gameState.challengeComplete,
      mapRevealed: !!gameState.mapRevealed,
      teleportCooldown: gameState.teleportCooldown || 0,
    },
  };
}

/**
 * @param {any[]} target
 * @param {any[]} saved
 * @param {(value:any) => any} restore
 */
function replaceFloorArray(target, saved, restore) {
  target.length = 0;
  if (!Array.isArray(saved)) return;
  for (const value of saved) {
    const restored = restore(value);
    if (restored) target.push(restored);
  }
}

/** @param {any} dungeon @param {any} savedDungeon */
function restoreDungeonFloorSnapshot(dungeon, savedDungeon) {
  if (!dungeon || !savedDungeon) return;
  if (Array.isArray(savedDungeon.map)) dungeon.map = savedDungeon.map;
  if (Array.isArray(savedDungeon.visited)) dungeon.visited = restoreNumericFloorGrid(savedDungeon.visited, dungeon.visited, Uint8Array);
  if (Array.isArray(savedDungeon.light)) dungeon.light = restoreNumericFloorGrid(savedDungeon.light, dungeon.light, Float32Array);
  if (Array.isArray(savedDungeon.visible)) dungeon.visible = restoreNumericFloorGrid(savedDungeon.visible, dungeon.visible, Uint8Array);
  if (Array.isArray(savedDungeon.secretMask)) dungeon.secretMask = restoreNumericFloorGrid(savedDungeon.secretMask, dungeon.secretMask, Uint8Array);
  if (Array.isArray(savedDungeon.rooms) && Array.isArray(dungeon.rooms)) {
    for (let i = 0; i < savedDungeon.rooms.length && i < dungeon.rooms.length; i++) {
      if (savedDungeon.rooms[i]) {
        const savedRoom = { ...savedDungeon.rooms[i] };
        if (Array.isArray(savedRoom.shopItems)) {
          savedRoom.shopItems = restoreShopItemsSnapshot(savedRoom.shopItems, dungeon.rooms[i].shopItems);
        }
        Object.assign(dungeon.rooms[i], savedRoom);
      }
    }
  }
  dungeon._fovDirty = true;
}

const FLOOR_SNAPSHOT_TILES = (typeof T !== 'undefined') ? T : {
  VOID: 0, WALL: 1, FLOOR: 2, STAIRS: 3, TERMINAL: 4, DOOR: 5, DOOR_OPEN: 6,
  LOCKED_R: 7, LOCKED_B: 8, LOCKED_G: 9, CRACKED: 15, CRATE: 21,
};

/**
 * @param {any} tile
 * @returns {string | null}
 */
function floorSnapshotLockColour(tile) {
  if (tile === FLOOR_SNAPSHOT_TILES.LOCKED_R || tile === 'LOCKED_R') return 'red';
  if (tile === FLOOR_SNAPSHOT_TILES.LOCKED_B || tile === 'LOCKED_B') return 'blue';
  if (tile === FLOOR_SNAPSHOT_TILES.LOCKED_G || tile === 'LOCKED_G') return 'gold';
  return null;
}

/**
 * @param {any} tile
 * @param {Set<string>} haveColours
 */
function floorSnapshotTilePassable(tile, haveColours) {
  const lockColour = floorSnapshotLockColour(tile);
  if (lockColour) return haveColours.has(lockColour);
  return tile !== FLOOR_SNAPSHOT_TILES.WALL &&
    tile !== FLOOR_SNAPSHOT_TILES.VOID &&
    tile !== 'WALL' &&
    tile !== 'VOID';
}

/**
 * @param {any[][]} map
 * @param {number} sx
 * @param {number} sy
 * @param {Set<string>} haveColours
 * @returns {Set<string>}
 */
function floorSnapshotComputeReach(map, sx, sy, haveColours) {
  const reach = new Set();
  if (!Array.isArray(map) || map.length === 0) return reach;
  const h = map.length;
  const w = Array.isArray(map[0]) ? map[0].length : 0;
  const x0 = Math.floor(Number(sx));
  const y0 = Math.floor(Number(sy));
  if (!(x0 >= 0 && y0 >= 0 && x0 < w && y0 < h)) return reach;
  if (!floorSnapshotTilePassable(map[y0] && map[y0][x0], haveColours)) return reach;
  const q = [{ x: x0, y: y0 }];
  reach.add(x0 + ',' + y0);
  for (let qi = 0; qi < q.length; qi++) {
    const p = /** @type {{x:number,y:number}} */ (q[qi]);
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    for (const d of dirs) {
      const nx = p.x + d.x;
      const ny = p.y + d.y;
      const key = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || reach.has(key)) continue;
      if (!floorSnapshotTilePassable(map[ny] && map[ny][nx], haveColours)) continue;
      reach.add(key);
      q.push({ x: nx, y: ny });
    }
  }
  return reach;
}

/**
 * @param {any} saved
 * @returns {string | null}
 */
function floorSnapshotSavedKeyColour(saved) {
  if (!saved || typeof saved !== 'object') return null;
  if (!(saved._kind === 'key' || saved.isKey || saved.tileColour)) return null;
  const colour = String(saved.colour || '').toLowerCase();
  return colour === 'red' || colour === 'blue' || colour === 'gold' ? colour : null;
}

/**
 * @param {any} keys
 */
function floorSnapshotHeldColours(keys) {
  const have = new Set();
  if (keys && keys.red > 0) have.add('red');
  if (keys && keys.blue > 0) have.add('blue');
  if (keys && keys.gold > 0) have.add('gold');
  return have;
}

/**
 * @param {any[][]} map
 * @param {any} start
 * @param {any[]} keyItems
 * @param {any} playerKeys
 */
function floorProgressionProblem(map, start, keyItems, playerKeys) {
  if (!Array.isArray(map) || !start || !Number.isFinite(start.x) || !Number.isFinite(start.y)) return null;
  const requiredColours = new Set();
  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    if (!Array.isArray(row)) continue;
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      const lockColour = floorSnapshotLockColour(tile);
      if (lockColour) requiredColours.add(lockColour);
    }
  }
  if (requiredColours.size === 0) return null;

  const itemsToCheck = Array.isArray(keyItems) ? keyItems : [];
  const heldColours = floorSnapshotHeldColours(playerKeys);
  const haveColours = new Set(heldColours);
  let changed = true;
  while (changed) {
    changed = false;
    const reach = floorSnapshotComputeReach(map, start.x, start.y, haveColours);
    for (const item of itemsToCheck) {
      const colour = floorSnapshotSavedKeyColour(item);
      if (!colour || haveColours.has(colour)) continue;
      const x = Math.floor(Number(item.x));
      const y = Math.floor(Number(item.y));
      if (reach.has(x + ',' + y)) {
        haveColours.add(colour);
        changed = true;
      }
    }
  }

  for (const colour of requiredColours) {
    if (!haveColours.has(colour)) return colour + ' key is not reachable in saved floor snapshot';
  }
  return null;
}

/**
 * @param {any} dungeon
 * @param {{x:number,y:number}} pos
 */
function floorRoomAt(dungeon, pos) {
  const x = Math.floor(Number(pos && pos.x));
  const y = Math.floor(Number(pos && pos.y));
  if (!dungeon || !Array.isArray(dungeon.rooms) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return dungeon.rooms.find((/** @type {any} */ room) =>
    x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h
  ) || null;
}

/**
 * @param {any[][]} map
 * @param {any} room
 * @param {any} tile
 */
function floorRoomContainsTile(map, room, tile) {
  if (!Array.isArray(map) || !room) return false;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      const row = map[y];
      if (row && row[x] === tile) return true;
    }
  }
  return false;
}

/** @param {any} tile */
function floorSnapshotIsLockedDoor(tile) {
  return tile === FLOOR_SNAPSHOT_TILES.LOCKED_R || tile === FLOOR_SNAPSHOT_TILES.LOCKED_B || tile === FLOOR_SNAPSHOT_TILES.LOCKED_G ||
    tile === 'LOCKED_R' || tile === 'LOCKED_B' || tile === 'LOCKED_G';
}

/** @param {any} t */
const isSafeSpawn = (t) => isPassable(t) &&
  t !== T.TRAP_SPIKE && t !== T.TRAP_SLOW &&
  t !== T.PLASMA && t !== T.ARC && t !== T.TOXIC &&
  t !== T.SHOCK_TILE && t !== T.REPULSOR;

/**
 * @param {any} dungeon
 * @param {any} room
 */
function floorRoomEligibleForDescentStart(dungeon, room) {
  return !!room && room !== dungeon.bossRoom && room !== dungeon.mainframeRoom && !room.roomType;
}

/**
 * @param {any[][]} map
 * @param {any} room
 * @param {{x:number,y:number}} origin
 */
function nearestSafeTileInRoom(map, room, origin) {
  /** @type {{x:number,y:number} | null} */
  let best = null;
  let bestScore = Infinity;
  for (let y = room.y; y < room.y + room.h; y++) {
    const row = map[y];
    if (!row) continue;
    for (let x = room.x; x < room.x + room.w; x++) {
      if (!isSafeSpawn(row[x])) continue;
      const score = Math.abs((x + 0.5) - origin.x) + Math.abs((y + 0.5) - origin.y);
      if (score < bestScore) {
        bestScore = score;
        best = { x: x + 0.5, y: y + 0.5 };
      }
    }
  }
  return best;
}

/**
 * @param {any} dungeon
 * @param {{x:number,y:number}} spawn
 */
function normalizeDescentSpawnRoom(dungeon, spawn) {
  const currentRoom = floorRoomAt(dungeon, spawn);
  if (floorRoomEligibleForDescentStart(dungeon, currentRoom)) {
    const row = dungeon.map && dungeon.map[Math.floor(spawn.y)];
    if (row && isSafeSpawn(row[Math.floor(spawn.x)])) return { spawn, room: currentRoom };
    const safeSpawn = nearestSafeTileInRoom(dungeon.map, currentRoom, spawn);
    if (safeSpawn) return { spawn: safeSpawn, room: currentRoom };
  }
  /** @type {{spawn:{x:number,y:number},room:any} | null} */
  let best = null;
  let bestScore = Infinity;
  for (const room of dungeon.rooms || []) {
    if (!floorRoomEligibleForDescentStart(dungeon, room)) continue;
    const roomSpawn = nearestSafeTileInRoom(dungeon.map, room, spawn);
    if (!roomSpawn) continue;
    const score = Math.abs(roomSpawn.x - spawn.x) + Math.abs(roomSpawn.y - spawn.y);
    if (score < bestScore) {
      bestScore = score;
      best = { spawn: roomSpawn, room };
    }
  }
  return best || { spawn, room: currentRoom };
}

/**
 * @param {any[][]} map
 * @param {any} room
 */
function downgradeLockedRoomBoundary(map, room) {
  if (!Array.isArray(map) || !room) return;
  for (let x = room.x; x < room.x + room.w; x++) {
    const topRow = map[room.y];
    if (topRow && floorSnapshotIsLockedDoor(topRow[x])) topRow[x] = FLOOR_SNAPSHOT_TILES.FLOOR;
    const by = room.y + room.h - 1;
    const bottomRow = map[by];
    if (bottomRow && floorSnapshotIsLockedDoor(bottomRow[x])) bottomRow[x] = FLOOR_SNAPSHOT_TILES.FLOOR;
  }
  for (let y = room.y; y < room.y + room.h; y++) {
    const row = map[y];
    if (!row) continue;
    if (floorSnapshotIsLockedDoor(row[room.x])) row[room.x] = FLOOR_SNAPSHOT_TILES.FLOOR;
    const rx = room.x + room.w - 1;
    if (floorSnapshotIsLockedDoor(row[rx])) row[rx] = FLOOR_SNAPSHOT_TILES.FLOOR;
  }
}

/**
 * @param {any} dungeon
 * @param {any} startRoom
 * @param {any} originalSpawnRoom
 */
function relocateStairsOutOfStartRoom(dungeon, startRoom, originalSpawnRoom) {
  if (!dungeon || !Array.isArray(dungeon.map) || !startRoom || !floorRoomContainsTile(dungeon.map, startRoom, FLOOR_SNAPSHOT_TILES.STAIRS)) return;
  /** @type {any} */
  let bestRoom = null;
  let bestScore = -1;
  for (const room of dungeon.rooms || []) {
    if (!room || room === startRoom || room === originalSpawnRoom || !floorRoomEligibleForDescentStart(dungeon, room)) continue;
    const score = Math.abs((room.cx | 0) - (startRoom.cx | 0)) + Math.abs((room.cy | 0) - (startRoom.cy | 0));
    if (score > bestScore) {
      bestScore = score;
      bestRoom = room;
    }
  }
  if (!bestRoom) return;
  for (let y = 0; y < dungeon.map.length; y++) {
    const row = dungeon.map[y];
    if (!Array.isArray(row)) continue;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === FLOOR_SNAPSHOT_TILES.STAIRS) row[x] = FLOOR_SNAPSHOT_TILES.FLOOR;
    }
  }
  dungeon.map[bestRoom.cy][bestRoom.cx] = FLOOR_SNAPSHOT_TILES.STAIRS;
  dungeon.stairRoom = bestRoom;
}

/**
 * @param {any[][]} map
 * @param {string} colour
 */
function downgradeLockedDoorsByColour(map, colour) {
  const tile =
    colour === 'red' ? FLOOR_SNAPSHOT_TILES.LOCKED_R :
    colour === 'blue' ? FLOOR_SNAPSHOT_TILES.LOCKED_B :
    colour === 'gold' ? FLOOR_SNAPSHOT_TILES.LOCKED_G : null;
  if (tile == null) return;
  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    if (!Array.isArray(row)) continue;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === tile) row[x] = FLOOR_SNAPSHOT_TILES.FLOOR;
    }
  }
}

/**
 * Preserve the descent invariant: a fresh floor starts near the previous
 * floor's exit. If that inherited start lands in the generated stair room or
 * behind progression locks, repair the floor around the inherited start
 * instead of teleporting the player to the standalone generateFloor() spawn.
 *
 * @param {any} dungeon
 * @param {{x:number,y:number}} spawn
 * @param {any} playerKeys
 * @returns {{x:number,y:number}}
 */
function repairDescentSpawnFloor(dungeon, spawn, playerKeys) {
  if (!dungeon || !Array.isArray(dungeon.map) || !spawn) return spawn;
  const originalSpawnRoom = dungeon.defaultSpawnRoom || dungeon.spawnRoom;
  const normalized = normalizeDescentSpawnRoom(dungeon, spawn);
  const startRoom = normalized.room;
  spawn = normalized.spawn;
  if (startRoom) {
    dungeon.spawnRoom = startRoom;
    relocateStairsOutOfStartRoom(dungeon, startRoom, originalSpawnRoom);
    downgradeLockedRoomBoundary(dungeon.map, startRoom);
  }
  dungeon.playerPos = { x: spawn.x, y: spawn.y };
  for (let repair = 0; repair < 3; repair++) {
    const problem = floorProgressionProblem(dungeon.map, spawn, dungeon.keyItems || [], playerKeys);
    if (!problem) break;
    const colour = /^([a-z]+) key is not reachable/.exec(problem)?.[1];
    if (!(colour === 'red' || colour === 'blue' || colour === 'gold')) break;
    downgradeLockedDoorsByColour(dungeon.map, colour);
  }
  dungeon._fovDirty = true;
  return spawn;
}

/** @param {any} snapshot @param {any} playerKeys */
function floorSnapshotProgressionProblem(snapshot, playerKeys) {
  const savedDungeon = snapshot && snapshot.dungeon;
  return floorProgressionProblem(
    savedDungeon && savedDungeon.map,
    snapshot && snapshot.player,
    Array.isArray(snapshot && snapshot.items) ? snapshot.items : [],
    playerKeys
  );
}

/**
 * @param {any} saved
 * @param {any[]} rooms
 */
function restoreRoomBackedObject(saved, rooms) {
  if (!saved || typeof saved !== 'object') return null;
  const out = {...saved};
  const idx = out._roomIndex | 0;
  delete out._roomIndex;
  if (idx >= 0 && rooms[idx]) out.room = rooms[idx];
  return out;
}

/** @param {any} saved */
function restoreItemSnapshot(saved) {
  if (!saved || typeof saved !== 'object') return null;
  let item;
  if (saved._kind === 'key') item = new KeyItem(saved.x, saved.y, saved.colour, saved.tileColour);
  else if (saved._kind === 'whisper') item = new WhisperItem(saved.x, saved.y, String(saved.whisperId || ''));
  else if (saved._kind === 'weaponCache') {
    const savedWeapon = saved.weapon && typeof saved.weapon === 'object' ? saved.weapon : null;
    const affixes = savedWeapon && Array.isArray(savedWeapon._affixes) ? savedWeapon._affixes : [];
    const rebuiltWeapon = buildWeapon(savedWeapon && savedWeapon._base ? savedWeapon._base : 'PULSE_PISTOL', affixes);
    item = new WeaponCacheItem(saved.x, saved.y, rebuiltWeapon);
  }
  else if (saved._kind === 'harvest') item = new HarvestPickup(saved.x, saved.y);
  else if (saved._kind === 'shockPulse') item = new ShockPulsePickup(saved.x, saved.y);
  else if (saved._kind === 'vaultCoin') item = new VaultCoin(saved.x, saved.y, saved.amt || 0);
  else if (saved._kind === 'hoard') item = new MagpieHoard(saved.x, saved.y, saved.amt || 0);
  else {
    const type = Array.isArray(UPGRADES) ? UPGRADES.find((/** @type {any} */ u) => u && u.id === saved.typeId) : null;
    item = new Item(saved.x, saved.y, type || undefined);
  }
  Object.assign(item, saved);
  const restoredItem = /** @type {any} */ (item);
  if (saved._kind === 'weaponCache') {
    const savedWeapon = saved.weapon && typeof saved.weapon === 'object' ? saved.weapon : null;
    const affixes = savedWeapon && Array.isArray(savedWeapon._affixes) ? savedWeapon._affixes : [];
    restoredItem.weapon = buildWeapon(savedWeapon && savedWeapon._base ? savedWeapon._base : 'PULSE_PISTOL', affixes);
  }
  if (restoredItem.type == null && saved.typeId && Array.isArray(UPGRADES)) {
    const type = UPGRADES.find((/** @type {any} */ u) => u && u.id === saved.typeId);
    if (type) restoredItem.type = type;
  }
  return item;
}

/**
 * @param {any} saved
 * @param {any[]} rooms
 */
function restoreEnemySnapshot(saved, rooms) {
  if (!saved || typeof saved !== 'object') return null;
  const e = new Enemy(0, 0, 1, 0, 0, 0, saved.colour || '#ff3333', saved.type || 'GUARD');
  const restored = restoreRoomBackedObject(saved, rooms);
  if (restored) Object.assign(e, restored);
  if (typeof registerEnemyInRoom === 'function') registerEnemyInRoom(e);
  return e;
}

/**
 * @param {any} saved
 * @param {any[]} restoredEnemies
 */
function restoreProjectileSnapshot(saved, restoredEnemies) {
  if (!saved || typeof saved !== 'object') return null;
  const p = new Projectile(saved.x || 0, saved.y || 0, saved.dx || 0, saved.dy || 0,
    saved.spd || 0, saved.dmg || 0, saved.maxRange || 0, saved.colour || '#ffffff',
    !!saved.piercing, !!saved.fromPlayer, saved.weaponName || null);
  Object.assign(p, saved);
  const restoredProjectile = /** @type {any} */ (p);
  p.hitEnemies = new Set();
  if (Array.isArray(saved._hitEnemyIndices)) {
    for (const idx of saved._hitEnemyIndices) {
      if (idx >= 0 && restoredEnemies[idx]) p.hitEnemies.add(restoredEnemies[idx]);
    }
  }
  if (saved._homingEnemyIndex >= 0 && restoredEnemies[saved._homingEnemyIndex]) p.homing = restoredEnemies[saved._homingEnemyIndex];
  if (saved._ownerEnemyIndex >= 0 && restoredEnemies[saved._ownerEnemyIndex]) p._owner = restoredEnemies[saved._ownerEnemyIndex];
  delete restoredProjectile._hitEnemyIndices;
  delete restoredProjectile._homingEnemyIndex;
  delete restoredProjectile._ownerEnemyIndex;
  if (!Array.isArray(p.trail)) p.trail = [];
  return p;
}

/** @param {any} saved */
function restoreFuseShardSnapshot(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const fs = new FuseShard(saved.x || 0, saved.y || 0);
  Object.assign(fs, saved);
  return fs;
}

const CHEAT_SEQUENCE = ['F', 'E', 'E', 'SHIFT'];
const CHEAT_TOUCH_CODES = new Set(['CheatF', 'CheatE', 'CheatShift']);
const CHEAT_DEFS = [
  { id:'invulnerable', name:'INVULNERABILITY', hot:'1', colour:'#ff3366', desc:'Ignore all incoming damage packets.' },
  { id:'noClip',       name:'NO-CLIP',         hot:'2', colour:'#66ffcc', desc:'Move and dash through solid floor geometry.' },
  { id:'revealMap',    name:'SHOW MAP',        hot:'3', colour:'#44ccff', desc:'Render the full non-secret floor layout.' },
  { id:'hyperMode',    name:'HYPER MODE',      hot:'4', colour:'#ffb700', desc:'Double player movement speed.' },
];

function defaultCheats() {
  return { invulnerable:false, noClip:false, revealMap:false, hyperMode:false };
}

/**
 * @param {string} code
 */
function normalizeCheatSequenceCode(code) {
  if (!code || code === 'MouseLeft') return null;
  if (code === 'CheatF' || code === 'KeyF') return 'F';
  if (code === 'CheatE' || code === 'KeyE') return 'E';
  if (code === 'CheatShift' || code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  return 'OTHER';
}

/**
 * @param {number} progress
 * @param {string} code
 */
function advanceCheatSequence(progress, code) {
  const token = normalizeCheatSequenceCode(code);
  if (!token) return progress;
  const p = Math.max(0, Math.min(CHEAT_SEQUENCE.length - 1, progress | 0));
  if (token === CHEAT_SEQUENCE[p]) return p + 1;
  return token === CHEAT_SEQUENCE[0] ? 1 : 0;
}

/**
 * @param {any} gameState
 * @param {string} id
 */
function isCheatEnabled(gameState, id) {
  return !!(gameState && gameState.cheats && gameState.cheats[id]);
}

/** @param {boolean} narrow */
function getCheatMenuLayout(narrow) {
  const panelW = Math.min(narrow ? W - 24 : 620, W - 24);
  const panelH = Math.min(narrow ? H - 36 : 460, H - 36);
  const px = (W - panelW) / 2;
  const py = (H - panelH) / 2;
  const rowH = narrow ? 54 : 66;
  const rowStart = py + (narrow ? 92 : 118);
  const rowX = px + (narrow ? 14 : 28);
  const rowW = panelW - (narrow ? 28 : 56);
  const closeW = narrow ? 130 : 160;
  const closeH = 36;
  const closeX = W / 2 - closeW / 2;
  const closeY = py + panelH - (narrow ? 50 : 58);
  return { panelW, panelH, px, py, rowH, rowStart, rowX, rowW, closeW, closeH, closeX, closeY };
}

/**
 * @param {any} gameState
 * @param {any} snapshot
 */
function restoreFloorSnapshot(gameState, snapshot) {
  if (!gameState || !snapshot || snapshot.v !== FLOOR_SNAPSHOT_VERSION || snapshot.floor !== gameState.floor || !gameState.dungeon) return false;
  const progressionProblem = floorSnapshotProgressionProblem(snapshot, gameState.player && gameState.player.keys);
  if (progressionProblem) {
    gameState._discardedFloorSnapshotReason = progressionProblem;
    return false;
  }
  const rooms = gameState.dungeon.rooms || [];
  restoreDungeonFloorSnapshot(gameState.dungeon, snapshot.dungeon);
  if (gameState.player && snapshot.player) {
    if (Number.isFinite(snapshot.player.x)) gameState.player.x = snapshot.player.x;
    if (Number.isFinite(snapshot.player.y)) gameState.player.y = snapshot.player.y;
  }
  if (typeof clearEnemiesByRoom === 'function') clearEnemiesByRoom();
  replaceFloorArray(enemies, snapshot.enemies, (/** @type {any} */ e) => restoreEnemySnapshot(e, rooms));
  replaceFloorArray(items, snapshot.items, restoreItemSnapshot);
  for (let i = 0, n = projectiles.length; i < n; i++) releaseProjectile(projectiles[i]);
  replaceFloorArray(projectiles, snapshot.projectiles, (/** @type {any} */ p) => restoreProjectileSnapshot(p, enemies));
  replaceFloorArray(hazardZones, snapshot.hazardZones, (/** @type {any} */ z) => z && {...z});
  replaceFloorArray(fuseShards, snapshot.fuseShards, restoreFuseShardSnapshot);
  replaceFloorArray(vcores, snapshot.vcores, (/** @type {any} */ c) => c && {...c});
  replaceFloorArray(crates, snapshot.crates, (/** @type {any} */ c) => c && {...c});
  replaceFloorArray(beacons, snapshot.beacons, (/** @type {any} */ b) => restoreRoomBackedObject(b, rooms));
  replaceFloorArray(mines, snapshot.mines, (/** @type {any} */ m) => restoreRoomBackedObject(m, rooms));
  replaceFloorArray(shieldGens, snapshot.shieldGens, (/** @type {any} */ g) => restoreRoomBackedObject(g, rooms));
  replaceFloorArray(cameras, snapshot.cameras, (/** @type {any} */ c) => restoreRoomBackedObject(c, rooms));
  replaceFloorArray(lasers, snapshot.lasers, (/** @type {any} */ l) => restoreRoomBackedObject(l, rooms));
  replaceFloorArray(wallTurrets, snapshot.wallTurrets, (/** @type {any} */ t) => restoreRoomBackedObject(t, rooms));
  replaceFloorArray(disruptionFields, snapshot.disruptionFields, (/** @type {any} */ f) => f && {...f});
  replaceFloorArray(gravityWells, snapshot.gravityWells, (/** @type {any} */ w) => w && {...w});
  replaceFloorArray(placedWalls, snapshot.placedWalls, (/** @type {any} */ w) => w && {...w});
  replaceFloorArray(frostPatches, snapshot.frostPatches, (/** @type {any} */ f) => f && {...f});
  gameState.clearedRooms = new Set();
  if (Array.isArray(snapshot.clearedRooms)) {
    for (const idx of snapshot.clearedRooms) if (idx >= 0 && rooms[idx]) gameState.clearedRooms.add(rooms[idx]);
  }
  const st = snapshot.state || {};
  gameState.bossRoom = st.bossRoomIndex >= 0 && rooms[st.bossRoomIndex] ? rooms[st.bossRoomIndex] : gameState.bossRoom;
  gameState.bossType = st.bossType || gameState.bossType;
  gameState.bossSealed = !!st.bossSealed;
  gameState.bossAlive = !!st.bossAlive;
  gameState.bossBarAnim = st.bossBarAnim || 0;
  gameState.bossHpGhost = st.bossHpGhost || 0;
  gameState.challengeSealed = !!st.challengeSealed;
  gameState.challengeWave = st.challengeWave || 0;
  gameState.challengeMaxWaves = st.challengeMaxWaves || 0;
  gameState.challengeWaveDelay = st.challengeWaveDelay || 0;
  gameState.challengeComplete = !!st.challengeComplete;
  gameState.mapRevealed = !!st.mapRevealed;
  gameState.teleportCooldown = st.teleportCooldown || 0;
  gameState.refreshSealedEntrances();
  gameState.markMapMutated();
  return true;
}

/** @type {Record<string, any>} */
const game = {
  state: _GG_STATES.MENU,
  difficulty: loadMeta().lastDifficulty || 'NORMAL',
  floor: 1,
  player: null,
  dungeon: null,
  // Sticky indicator set by platform.js's visibilitychange handler
  // when the game auto-pauses (tab switch, iOS lock, phone call) and
  // cleared in setState() on any transition out of PAUSED. Read by
  // renderPaused() to show a subtitle distinguishing automatic from
  // manual pauses, so a returning player isn't confused by an
  // unexplained PAUSED screen.
  wasAutoPaused: false,
  cheats: defaultCheats(),
  cheatSequenceProgress: 0,
  cheatSelected: 0,
  cheatReturnState: 'PLAYING',
  _cheatMenuJustOpened: false,
  fadeAlpha: 0,
  fadeDir: 0,
  fadeCallback: null,
  fadeNextState: null,
  fadeTime: 0,
  fadeHold: 0,
  fadeGlitchBars: [],
  fadeGlitchTimer: 0,
  transitionText: '',
  menuParticles: [],
  seedSetup: null,
  runSeed: null,
  runSeedHash: 0,
  _pendingStartSeed: null,
  bossRoom: null,
  bossType: null,
  bossEntrances: [],
  bossSealed: false,
  bossAlive: false,
  bossBarAnim: 0,
  bossHpGhost: 0,
  // Boss intro telegraph — atmospheric overlay (radial vignette + titlecard +
  // audio sting) that plays for BOSS_INTRO_DURATION seconds when the player
  // first enters the boss room (i.e. when bossSealed flips false→true).
  // Gameplay continues during the intro — this is purely cosmetic. Timer
  // counts DOWN to 0; duration field is kept for fade-envelope math in the
  // renderer (so the renderer can compute progress = 1 - timer/duration
  // without re-deriving the constant).
  bossIntroTimer: 0,
  bossIntroDuration: 0,
  // Boss death telegraph — atmospheric overlay (radial flash + "DESTROYED"
  // titlecard + audio sting) that plays for BOSS_DEATH_DURATION seconds
  // when the last boss is killed (bossAlive flips true→false). Gameplay
  // continues during the overlay — purely cosmetic. Snapshot fields hold
  // the boss's identity at the moment of death because the boss instance
  // is removed from `enemies` on the same frame (line ~1804) and the
  // renderer needs the colour/name to outlive the kill.
  bossDeathTimer: 0,
  bossDeathDuration: 0,
  bossDeathColor: '#39ff14',
  bossDeathName: '',
  modifier: null,
  modBannerTimer: 0,
  // UNCHAINED #40: biome intro card — shown 3s on first floor of a biome
  // (floors 4/7/10/13). Floor 1 skipped — handled by #42 intro crawl.
  biomeCardTimer: 0,
  biomeCardArea: null,
  bossesCleared: 0,
  msgList: [],
  nameEntry: null,
  lastSavedRank: -1,
  quest: null, // current floor objective
  hint: null,  // proximity hint {text, colour} — set per-frame, rendered with pulse
  shopRoom: null,     // room currently being shopped in
  shopSelected: 0,    // keyboard selection index in shop
  shopClosing: false,  // true during auto-close delay after last purchase
  currentLore: null,   // lore text being displayed in READING state
  _whisperMeta: null,  // {title, voice} when READING is showing a whisper (vs lore)
  readingInteractArmed: false, // gate interact-to-close until interact is released after opening
  mainframeFinale: null, // ephemeral Act 1 finale reader state
  systemMessages: restoreSystemMessagesState(null), // run-scoped system prompt queue
  systemMessageReturnState: 'PLAYING',
  systemMessageAckTimer: 0,
  _lastAct1MessageIntent: null,
  clearedRooms: null,  // Set of rooms where all enemies were killed this floor
  enemyDiedThisFrame: false, // flag to skip room-clear scan when nothing died
  // Challenge room state
  challengeRoom: null,
  challengeSealed: false,
  challengeWave: 0,
  challengeMaxWaves: 0,
  challengeEntrances: [],
  challengeWaveDelay: 0,
  challengeComplete: false,
  // Augment state
  augmentChoice: null,        // {options: [id, id], selected: 0}
  mapRevealed: false,         // ECHO_MAPPER: show floor layout on minimap
  mapExpanded: false,         // Tab toggle: full-screen map overlay
  // Perk choice state
  pendingPerkChoices: [], // queued level milestones awaiting perk selection
  perkChoice: null,       // {options: [id, id, id], selected: 0}
  weaponSwapChoice: null, // {weapon, selected, _arm} for full-belt weapon cache replacement
  // Teleport pad state
  teleportCooldown: 0, // seconds remaining before pads can be used again

  /**
   * @param {any} text
   * @param {any} colour
   */
  msg(text,colour) {
    messages.push({text,colour:colour||'#e0e0ff',life:3});
  },

  ensureSystemMessages() {
    this.systemMessages = restoreSystemMessagesState(this.systemMessages);
    return this.systemMessages;
  },

  /** @param {string} id */
  queueSystemMessage(id) {
    const def = systemMessageDefinition(id);
    if (!def) return null;
    const state = this.ensureSystemMessages();
    const existing = state.entries.find((/** @type {any} */ entry) => entry.id === id);
    if (existing) return existing;
    const entry = createSystemMessageEntry(def, state.nextSequence);
    state.nextSequence = entry.sequence + 1;
    state.entries.push(entry);
    this.saveGame();
    return entry;
  },

  /** @param {number} floorNum */
  queueSystemMessagesForFloor(floorNum) {
    const ids = systemMessageIdsForFloor(floorNum);
    const queued = [];
    for (const id of ids) {
      const entry = this.queueSystemMessage(id);
      if (entry) queued.push(entry);
    }
    return queued;
  },

  /** @param {number} startFloor */
  queueFreshRunSystemMessages(startFloor) {
    const queued = [];
    const boot = this.queueSystemMessage('boot-inventory');
    if (boot) queued.push(boot);
    queued.push(...this.queueSystemMessagesForFloor(startFloor));
    return queued;
  },

  /** @param {string} id */
  markSystemMessageDelivered(id) {
    const state = this.ensureSystemMessages();
    const entry = state.entries.find((/** @type {any} */ msg) => msg.id === id);
    if (!entry || entry.state === 'read') return null;
    entry.state = 'delivered';
    state.activeId = entry.id;
    this.saveGame();
    return entry;
  },

  /** @param {string} id */
  markSystemMessageRead(id) {
    const state = this.ensureSystemMessages();
    const entry = state.entries.find((/** @type {any} */ msg) => msg.id === id);
    if (!entry || entry.state !== 'delivered') return null;
    entry.state = 'read';
    if (state.activeId === entry.id) state.activeId = null;
    this.saveGame();
    return entry;
  },

  unreadSystemMessageCount() {
    const state = this.ensureSystemMessages();
    return state.entries.filter((/** @type {any} */ entry) => entry.state !== 'read').length;
  },

  hasPendingSystemMessage() {
    return this.unreadSystemMessageCount() > 0;
  },

  /**
   * @param {number} x
   * @param {number} y
   */
  hitSystemMessageIndicator(x, y) {
    if (!this.hasPendingSystemMessage()) return false;
    const box = getSystemMessageIndicatorLayout(layout.compact);
    return x >= box.x && x <= box.x + box.w &&
      y >= box.y && y <= box.y + box.h;
  },

  getActiveSystemMessage() {
    const state = this.ensureSystemMessages();
    if (!state.activeId) return null;
    return state.entries.find((/** @type {any} */ entry) => entry.id === state.activeId && entry.state === 'delivered') || null;
  },

  getSystemMessagePlayerRoom() {
    if (!this.player || !this.dungeon || !Array.isArray(this.dungeon.rooms)) return null;
    const px = this.player.x, py = this.player.y;
    for (const room of this.dungeon.rooms) {
      if (px >= room.x && px < room.x + room.w && py >= room.y && py < room.y + room.h) return room;
    }
    return null;
  },

  systemMessageThreatActive() {
    const room = this.getSystemMessagePlayerRoom();
    if (!room) return true;
    if (this.bossAlive || this.challengeSealed) return true;
    for (const projectile of projectiles) {
      if (!projectile.dead &&
          projectile.x >= room.x && projectile.x < room.x + room.w &&
          projectile.y >= room.y && projectile.y < room.y + room.h) return true;
    }
    for (const enemy of enemiesInRoomIter(room)) {
      if (!enemy.dead && !enemy._disguised) return true;
    }
    if (beacons.some((/** @type {any} */ b) => !b.dead && b.room === room)) return true;
    if (cameras.some((/** @type {any} */ c) => !c.dead && c.state === 'alerted' && c.room === room)) return true;
    if (wallTurrets.some((/** @type {any} */ wt) => !wt.dead && !wt.hacked && wt.room === room)) return true;
    if (mines.some((/** @type {any} */ m) => !m.dead && m.room === room && (m.state === 'armed' || m.revealed))) return true;
    if (lasers.some((/** @type {any} */ l) => !l.dead && l.room === room && !l.disabled && l.active)) return true;
    return false;
  },

  canAutoOpenSystemMessage() {
    return this.hasPendingSystemMessage() && !this.systemMessageThreatActive();
  },

  /** @param {boolean} [force] */
  openPendingSystemMessage(force) {
    if (!this.hasPendingSystemMessage()) return false;
    if (!force && !this.canAutoOpenSystemMessage()) return false;
    return this.openNextSystemMessage('PLAYING');
  },

  /** @param {string} [returnState] */
  openNextSystemMessage(returnState) {
    const state = this.ensureSystemMessages();
    let entry = this.getActiveSystemMessage();
    if (!entry) {
      entry = state.entries.find((/** @type {any} */ msg) => msg.state === 'queued') || null;
      if (entry) entry = this.markSystemMessageDelivered(entry.id);
    }
    if (!entry) return false;
    this.systemMessageReturnState = returnState || 'PLAYING';
    this.systemMessageAckTimer = 0.25;
    this.setState('SYSTEM_MESSAGE');
    return true;
  },

  // Rebuild the packed-index Set of sealed entrance tiles. Called whenever
  // bossSealed/challengeSealed flips so tile-loop hot paths can use O(1)
  // Set.has() instead of bossEntrances.some() per tile.
  refreshSealedEntrances() {
    const s = this.sealedEntranceSet || (this.sealedEntranceSet = new Set());
    s.clear();
    if (this.bossSealed && this.bossEntrances) {
      for (const e of this.bossEntrances) s.add(e.y * MAP_W + e.x);
    }
    if (this.challengeSealed && this.challengeEntrances) {
      for (const e of this.challengeEntrances) s.add(e.y * MAP_W + e.x);
    }
    this._minimapDirty = true;
    clearLosCache();
    if (this.dungeon) this.dungeon._fovDirty = true;
  },
  // Flag the cached minimap base layer as stale (visited tile flips, etc.).
  markMinimapDirty() { this._minimapDirty = true; },

  // Call from any code that mutates dungeon.map tiles (door open/unlock,
  // crack-wall break, crate destroyed, room seal/unseal, terminal consume).
  // Also invalidates the per-frame LOS cache so subsequent LOS queries in
  // the same tick reflect the new map state.
  markMapMutated() {
    this._minimapDirty = true;
    clearLosCache();
    if (this.dungeon) {
      this.dungeon._fovDirty = true;
      this.dungeon._mapMutationVersion = (this.dungeon._mapMutationVersion | 0) + 1;
    }
  },

  /**
   * @param {any} s
   * @param {any} callback
   */
  setState(s, callback) {
    if (!_GG_STATE_DEFS.GAME_STATES_SET.has(s)) {
      throw new Error('Unknown game state "' + String(s) + '"');
    }
    const prevState = this.state;
    // Clear the auto-paused sticky indicator on any transition OUT of
    // PAUSED — PLAYING (manual resume), MENU (quit), SETTINGS (open
    // submenu), etc. The next auto-pause will set it again. Without
    // this, a player who auto-pauses then manually unpauses then
    // pauses again later by hand would still see "(auto-paused)".
    if (this.state === _GG_STATES.PAUSED && s !== _GG_STATES.PAUSED) this.wasAutoPaused = false;
    this.state=s;
    this.mapExpanded = false;
    if (s === _GG_STATES.MENU) { this.menuSel = 0; this._menuTitleUnlockConsumed = false; this._menuTitleUnlockPending = false; music.setState('menu'); }
    else if (_GG_STATE_DEFS.isMenuMusicState(s, this._settingsFrom)) music.setState('menu');
    else if (s === _GG_STATES.PAUSED) { music.pause(); this._pauseSel = -1; }
    else if (s === _GG_STATES.INTRO) music.stop();
    else if (s === _GG_STATES.PLAYING) {
      if (_GG_STATE_DEFS.isMenuMusicState(prevState, this._settingsFrom) || prevState === _GG_STATES.INTRO) music.setState('explore');
      else music.resume();
    }
    else if (s === _GG_STATES.GAME_OVER || s === _GG_STATES.VICTORY) music.stop();
    // Show privacy link only on menu screen
    try { const pl = document.getElementById('privLink'); if (pl) pl.style.display = s === _GG_STATES.MENU ? '' : 'none'; } catch(_){}
    if (callback) callback();
  },

  shouldCaptureCheatSequence(){
    if (this.state === 'NAME_ENTRY' || this.state === 'SEED_SETUP') return false;
    if (this.state === 'SETTINGS' && this.settingsCapture) return false;
    return this.state !== 'CHEATS';
  },
  updateCheatHotkey(){
    if (!this.shouldCaptureCheatSequence()) return false;
    let opened = false;
    let touchSequenceInput = false;
    for (const code of justPressed) {
      if (CHEAT_TOUCH_CODES.has(code)) {
        touchSequenceInput = true;
        break;
      }
    }
    for (const code of justPressed) {
      if (touchSequenceInput && !CHEAT_TOUCH_CODES.has(code)) continue;
      this.cheatSequenceProgress = advanceCheatSequence(this.cheatSequenceProgress, code);
      if (this.cheatSequenceProgress >= CHEAT_SEQUENCE.length) {
        this.openCheatMenu();
        this.cheatSequenceProgress = 0;
        opened = true;
        break;
      }
    }
    return opened;
  },
  openCheatMenu(){
    this.cheats = Object.assign(defaultCheats(), this.cheats || {});
    this.cheatReturnState = this.state === 'CHEATS' ? this.cheatReturnState : this.state;
    this.cheatSelected = 0;
    this._cheatMenuJustOpened = true;
    this.setState('CHEATS');
    this.msg('FEET diagnostic hatch opened.', '#66ffcc');
  },
  closeCheatMenu(){
    const returnState = this.cheatReturnState || 'PLAYING';
    this.setState(returnState);
  },
  /** @param {number} index */
  toggleCheat(index){
    const def = CHEAT_DEFS[index];
    if (!def) return;
    this.cheats = Object.assign(defaultCheats(), this.cheats || {});
    this.cheats[def.id] = !this.cheats[def.id];
    if (def.id === 'revealMap') this._minimapDirty = true;
    this.msg(`${def.name}: ${this.cheats[def.id] ? 'ON' : 'OFF'}`, this.cheats[def.id] ? def.colour : '#9aa');
  },
  updateCheatMenu(){
    if (this._cheatMenuJustOpened) {
      this._cheatMenuJustOpened = false;
      return;
    }
    if (jp('Escape') || jp('Backspace')) {
      this.closeCheatMenu();
      return;
    }
    if (jp('ArrowUp') || jp('KeyW')) {
      this.cheatSelected = (this.cheatSelected + CHEAT_DEFS.length) % (CHEAT_DEFS.length + 1);
      audio.menuSelect();
    }
    if (jp('ArrowDown') || jp('KeyS')) {
      this.cheatSelected = (this.cheatSelected + 1) % (CHEAT_DEFS.length + 1);
      audio.menuSelect();
    }
    for (let i = 0; i < CHEAT_DEFS.length; i++) {
      if (jp(`Digit${i + 1}`)) this.toggleCheat(i);
    }
    if (jp('Enter') || jp('Space')) {
      if (this.cheatSelected >= CHEAT_DEFS.length) this.closeCheatMenu();
      else this.toggleCheat(this.cheatSelected);
    }
    if (justPressed.has('MouseLeft')) {
      const m = mouse;
      const layout = getCheatMenuLayout(W < 560);
      let handled = false;
      for (let i = 0; i < CHEAT_DEFS.length; i++) {
        const y = layout.rowStart + i * layout.rowH;
        if (m.x >= layout.rowX && m.x <= layout.rowX + layout.rowW && m.y >= y && m.y <= y + layout.rowH - 8) {
          this.cheatSelected = i;
          this.toggleCheat(i);
          handled = true;
          break;
        }
      }
      if (!handled && m.x >= layout.closeX && m.x <= layout.closeX + layout.closeW && m.y >= layout.closeY && m.y <= layout.closeY + layout.closeH) {
        this.cheatSelected = CHEAT_DEFS.length;
        this.closeCheatMenu();
      }
    }
  },

  /**
   * @param {any} text
   * @param {any} callback
   * @param {any} nextState
   */
  fadeTo(text, callback, nextState) {
    this.setState(_GG_STATES.FADE);
    this.transitionText=text;
    this.fadeAlpha=0;
    this.fadeDir=1;
    this.fadeTime=0;
    this.fadeHold=0;
    this.fadeGlitchBars=[];
    this.fadeGlitchTimer=0;
    this.fadeCallback=callback;
    this.fadeNextState=nextState||null;
    audio.transition();
  },

  init() {
    this.player=new Player();
    this.loadFloor(1);
  },

  /**
   * @param {any} n
   * @param {any} savedModifier
   * @param {any} [skipAutoSave]
   */
  loadFloor(n, savedModifier, skipAutoSave) {
    this.floor=n;
    // Per-biome damage flash colour: cached once per floor so the entities.js
    // hot-path draw code (Enemy.draw + Player.draw at the `flashTimer>0?...`
    // ternaries) can read a property instead of routing through NEON.biomes
    // + BIOME_PALETTES on every flash. Falls back to '#ffffff' if palettes.js
    // hasn't loaded — preserves legacy white-flash behaviour. See
    // src/data/palettes.js currentDamageFlash() for the resolver.
    this._damageFlash = (typeof NEON !== 'undefined' && NEON.palettes && NEON.palettes.currentDamageFlash)
      ? NEON.palettes.currentDamageFlash(n)
      : '#ffffff';
    // UNCHAINED #34: track current biome index and bump meta.deepestBiome on
    // floor entry so death respawn returns to the deepest biome start.
    if (typeof NEON !== 'undefined' && NEON.biomes) {
      this.currentBiomeIndex = NEON.biomes.biomeIndex(n);
      try {
        const m = loadMeta();
        if ((m.deepestBiome|0) < this.currentBiomeIndex) {
          m.deepestBiome = this.currentBiomeIndex;
          saveMeta(m);
        }
      } catch(_) { /* ignore — meta bookkeeping must never break a floor load */ }
    }
    music.setFloor(n);
    this.floorTime=0; // arc grid phase timer
    // Roll or restore floor modifier. Biome boss floors (and floor 1, the
    // settle-in floor) are modifier-free. Uses NEON.biomes so the list is
    // derived from AREAS (3/6/9/12/15 for the 5-biome UNCHAINED arc); falls
    // back to the legacy 3/6/10 list if biomes data is unavailable.
    const _isBossFloor_mod = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.isBiomeBossFloor) ? NEON.biomes.isBiomeBossFloor(n) : (n===3||n===6||n===10);
    if (savedModifier !== undefined) {
      this.modifier = savedModifier;
    } else if (n === 1 || _isBossFloor_mod) {
      this.modifier = null;
    } else {
      this.modifier = withDerivedRngStream('event:floor:' + n + ':modifier', () => MODIFIER_KEYS[rndInt(0, MODIFIER_KEYS.length - 1)]);
    }
    // Strip floor-only shield bonus from previous floor
    this.player.def-=this.player.shieldBonus;
    this.player.shieldBonus=0;
    // Keys are floor-scoped: keep them for this floor, clear on fresh floor transitions
    if (savedModifier === undefined) this.player.keys = { red:0, blue:0, gold:0 };
    // UNCHAINED #38: clear temp boosts on fresh transitions only (save-resume
    // preserves purchased power until the floor ends).
    if (savedModifier === undefined && typeof NEON !== 'undefined' && NEON.boosts) {
      NEON.boosts.clearFloorBoosts(this.player);
    }
    this.player.autoLaserBeam=null; // clear stale beam from previous floor
    const descentExitPos = savedModifier === undefined ? this._exitPos : null;
    this.dungeon = withDerivedRngStream('world:floor:' + n, () =>
      generateFloor(n, descentExitPos ? { previousExitPos: descentExitPos } : undefined)
    );
    // Floor exit-position carryover: if the player descended from a previous
    // floor, drop them near the same world coordinates on the new floor
    // (procedural layout means we may need the nearest passable tile). This
    // must run before populateFloor(), because the inherited room becomes the
    // real starting room for enemy/item placement.
    let spawn = this.dungeon.playerPos;
    if (savedModifier === undefined && this._exitPos) {
      try {
        if (!this.dungeon.preferredSpawnResolved &&
            typeof NEON !== 'undefined' && NEON.spawn && NEON.spawn.findNearestPassable) {
          const near =
            NEON.spawn.findNearestPassable(this.dungeon.map, this._exitPos.x, this._exitPos.y, isSafeSpawn) ||
            NEON.spawn.findNearestPassable(this.dungeon.map, this._exitPos.x, this._exitPos.y, isPassable);
          if (near) spawn = near;
        }
        spawn = repairDescentSpawnFloor(this.dungeon, spawn, this.player && this.player.keys);
      } catch (_) { /* fall through to default spawn */ }
    }
    this._exitPos = null;
    // Reset boss state before populating (populateFloor sets them for boss floors)
    this.bossRoom=null;
    this.bossType=null;
    this.bossEntrances=[];
    this.bossSealed=false;
    this.bossAlive=false;
    this.bossBarAnim=0;
    this.bossHpGhost=0;
    this.bossIntroTimer=0;
    this.bossIntroDuration=0;
    this.bossDeathTimer=0;
    this.bossDeathDuration=0;
    this.bossDeathColor='#39ff14';
    this.bossDeathName='';
    this.clearedRooms=new Set();
    this._chainBolts=[];
    this.sealedEntranceSet=new Set();
    this._minimapCanvas=null; // offscreen base-layer cache (rebuilt on dirty)
    this._minimapArcTiles=null; // list of ARC tile positions for live overlay
    this._minimapDirty=true;
    // Reset challenge room state
    this.challengeRoom=this.dungeon.challengeRoom||null;
    this.challengeEntrances=this.dungeon.challengeEntrances||[];
    this.challengeSealed=false;
    this.challengeWave=0;
    this.challengeMaxWaves=0;
    this.challengeWaveDelay=0;
    this.challengeComplete=false;
    this.mainframeFinale = this.dungeon.mainframeRoom ? restoreMainframeFinaleState(null) : null;
    // Reset SECOND_WIND perk for this floor
    if (this.player) this.player.secondWindUsed = false;
    // SPAWN GRACE: 1.5s of invulnerability on FRESH floor entry (not save-
    // resume — they paused, they're not under threat). Covers chaos-on-spawn
    // cases: arriving next to an arc grid, descending into an active mob
    // pack, dropping into a boss room mid-fight after `descend()`. Gate is
    // savedModifier === undefined (matches the existing pattern used for
    // keys, boosts, telemetry, biome card, modifier banner). Damage path
    // honours this via isPlayerDamageImmune() in src/content.js. The visual
    // halo lives in Player.draw() in src/entities.js (cyan pulsing ring).
    // Keep the literal in sync with the src/entities.js comment header.
    if (this.player) {
      this.player._spawnGraceTimer = (savedModifier === undefined) ? 1.5 : 0;
    }
    // Clear player debuffs on floor transition
    if (this.player) { this.player.burnTimer = 0; this.player.burnDps = 0; this.player.shockTimer = 0; }
    // STRIDE perk: drop movement-built ATK stacks on floor transition. The
    // player teleports to the new spawn between frames; without this reset
    // the next-frame moved/dt rate would be enormous (huge displacement /
    // tiny dt) and STRIDE would treat the warp as "continuous movement",
    // letting full-RUSH stacks survive into the new floor for free.
    if (this.player) {
      this.player._strideStacks = 0;
      this.player._strideMovingTime = 0;
      this.player._strideStillTime = 0;
      // DEADEYE perk: drop stillness charge + readiness latch on floor
      // transition. Same rationale as the STRIDE reset above — the
      // descend warp teleports player.x/y between frames, and without
      // an explicit clear the stale _steadyReady=true would let the
      // first shot on the new floor consume a free buffed hit. Also
      // zero _steadyChargeTime so partial progress doesn't carry over.
      this.player._steadyChargeTime = 0;
      this.player._steadyReady = false;
      // HOT_HAND perk: drop the per-target consecutive-hit streak on
      // floor transition. The descend warp teleports the player and
      // wipes all enemies from the previous floor — keeping a stale
      // _hotHandLastTarget reference would (a) hold a dead enemy in
      // memory until the next streak overwrite, and (b) be moot
      // anyway since the new floor's enemies are all fresh refs that
      // would trip the target-switch reset on first hit. Resetting
      // here is correct AND tidies up the GC-able reference.
      this.player._hotHandStreak = 0;
      this.player._hotHandLastTarget = null;
      this.player._hotHandTimer = 0;
    }
    // Reset teleport pad cooldown
    this.teleportCooldown = 0;
    // UNCHAINED #39: clear leftover core drops from previous floor.
    if (typeof NEON !== 'undefined' && NEON.cores && NEON.cores.clearCoreDrops) {
      NEON.cores.clearCoreDrops(this);
    }
    withDerivedRngStream('spawn:floor:' + n, () => populateFloor(this.dungeon,n));
    // UNCHAINED #37 SHIELD_CAPACITOR module: grant shield charges on fresh floor transitions only.
    // Skip on save-resume (savedModifier !== undefined) to avoid stacking charges on reload.
    if (savedModifier === undefined && this.player && this.player.metaFlags && this.player.metaFlags.floorStartShieldCharges > 0) {
      this.player._shieldCharges = (this.player._shieldCharges | 0) + this.player.metaFlags.floorStartShieldCharges;
    }
    // EMERGENCY_CACHE augment: anti-snowball lifeline. On a FRESH floor entry
    // (savedModifier === undefined — same gate as spawn grace, keys, boosts),
    // if the player arrives below 30% HP, top them up to 50% HP. Once-per-
    // floor by construction (only triggers at fresh entry). No effect when
    // the player is already healthy. Save-resume is intentionally skipped so
    // reloading a save mid-floor does not heal. Player.hp > 0 guard prevents
    // a corner case where loadFloor is invoked on a dead player. The toast
    // is deferred via setTimeout so it survives the `messages.length=0`
    // floor-transition wipe further down in loadFloor (line ~305) — same
    // deferral pattern used by applyPerk / makeAugmentShopOption install
    // messages and by the BOSS DETECTED announcement.
    if (savedModifier === undefined && hasAugment('EMERGENCY_CACHE') && this.player && this.player.hp > 0) {
      const max = this.player.maxHp | 0;
      if (max > 0 && (this.player.hp / max) < 0.30) {
        const target = Math.ceil(max * 0.50);
        if (this.player.hp < target) {
          const healed = target - this.player.hp;
          this.player.hp = target;
          setTimeout(() => this.msg('🔋 EMERGENCY CACHE: +' + healed + ' HP', '#88ffaa'), 250);
        }
      }
    }
    // ECHO_MAPPER augment: reveal floor layout (minimap only, not quest progress)
    // UNCHAINED #38: RECON PING boost also reveals layout for the floor.
    if (hasAugment('ECHO_MAPPER') || (typeof NEON !== 'undefined' && NEON.boosts && NEON.boosts.hasBoost(this.player, 'RECON_PING'))) {
      this.mapRevealed = true;
    } else {
      this.mapRevealed = false;
    }
    this.mapExpanded = false;
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    // Clear position history on floor transition so an ECHOER on the new
    // floor cannot fire at a position the player held on the previous
    // floor (locks need ECHOER_LOOKBACK seconds of fresh samples).
    if (this.player._posHistory) this.player._posHistory.length = 0;
    // Same rationale for shot kinematics history — a MIRROR on the new
    // floor must not be able to mimic a shot the player fired on the
    // previous floor before they have fired anything on the current floor.
    if (this.player._shotHistory) this.player._shotHistory.length = 0;
    // Clear frost patches on floor transition — patches from a CRYOPHAGE
    // on the previous floor would otherwise persist as invisible damage
    // tiles on the new floor's coordinates (same rationale as the
    // history rings above: cross-floor leak of room-local state).
    frostPatches.length = 0;
    // Reset per-room kill counter on floor transition: the new floor's room
    // layout has nothing to do with the previous floor's kills, and the
    // player's _currentRoom reference is stale (rooms array is new). The
    // first frame of updatePlaying will re-detect the spawn room and
    // re-arm any REAPERs there via the room-change path.
    this.player.killsInCurrentRoom = 0;
    this.player._currentRoom = null;
    // Clear ARCHITECT-placed walls on floor transition — the dungeon.map
    // is regenerated, so the placed-wall list referencing old tile
    // coordinates is invalid. Walls were applied to the old map; not
    // restored here because the old map is being thrown away anyway.
    placedWalls.length = 0;
    messages.length=0;
    this.msg('FLOOR '+n,'#ff00c8');
    // Telemetry: floor start
    if (savedModifier === undefined && typeof NEON !== 'undefined' && NEON.telemetry) {
      NEON.telemetry.track('floor_start', { floor: n, modifier: this.modifier || null });
    }
    if (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.isBiomeBossFloor ? NEON.biomes.isBiomeBossFloor(n) : (n===3||n===6||n===10)) {
      setTimeout(()=>{ audio.bossEnter(); this.msg('⚠ BOSS DETECTED','#ff3333'); },500);
    }
    // Announce modifier (banner replaces msg — banner timer set only on fresh transitions)
    if (this.modifier && savedModifier === undefined) {
      this.modBannerTimer = 3.0;
    } else {
      this.modBannerTimer = 0;
    }
    // UNCHAINED #40: biome intro card on first floor of each biome
    // (floors 4/7/10/13). Skip floor 1 — #42 owns the run-start crawl.
    // Skip on savedModifier resume (continuing a run shouldn't replay the card).
    if (savedModifier === undefined && typeof NEON !== 'undefined' && NEON.biomes) {
      try {
        const area = NEON.biomes.areaForFloor(n);
        if (area && area.floors[0] === n && n !== 1) {
          this.biomeCardArea = area;
          this.biomeCardTimer = 3.0;
        } else {
          this.biomeCardTimer = 0;
          this.biomeCardArea = null;
        }
      } catch(_) { this.biomeCardTimer = 0; this.biomeCardArea = null; }
    } else {
      this.biomeCardTimer = 0;
      this.biomeCardArea = null;
    }
    withDerivedRngStream('event:floor:' + n + ':quest', () => this.generateQuest(n));
    // Auto-save at start of each floor. Continue suppresses this until after
    // saved run state (including mainframeFinale) has been restored.
    if (!skipAutoSave) this.saveGame();
    if (!skipAutoSave && savedModifier === undefined) this.queueSystemMessagesForFloor(n);
  },

  /**
   * @param {any} floorNum
   */
  generateQuest(floorNum) {
    const questTypes = [
      { id:'EXTERMINATE', label:'Exterminate all enemies', check: ()=>enemies.length===0 && (!game.challengeSealed || game.challengeComplete),
        reward: ()=>{ this.player.score+=200*floorNum; this.msg('Quest complete! +'+200*floorNum+' pts','#39ff14'); }},
      { id:'EXPLORE', label:'Visit all visible rooms', check: ()=>{
          const d=this.dungeon;
          /**
           * @param {any} r
           */
          return d.rooms.every((/** @type {any} */ r)=>r.roomType==='secret' && !r.secretRevealed || d.visited[r.cy]?.[r.cx]);
        },
        reward: ()=>{ this.player.gainXP(40+floorNum*8); this.msg('Quest complete! +XP','#39ff14'); }},
      { id:'SPEEDRUN', label:'Reach stairs in 60s', timer:60, check: function(){
          const tx=Math.floor(game.player.x), ty=Math.floor(game.player.y);
          return game.dungeon.map[ty]?.[tx]===T.STAIRS||game.dungeon.map[ty]?.[tx]===T.TERMINAL;
        },
        reward: ()=>{ this.player.hp=this.player.maxHp; this.msg('Quest complete! Full heal!','#39ff14'); }},
      { id:'PACIFIST', label:'Reach stairs without killing', kills:0, check: function(){
          const tx=Math.floor(game.player.x), ty=Math.floor(game.player.y);
          return (game.dungeon.map[ty]?.[tx]===T.STAIRS||game.dungeon.map[ty]?.[tx]===T.TERMINAL) && this.kills===0;
        },
        reward: ()=>{ this.player.score+=500*floorNum; this.msg('Pacifist bonus! +'+500*floorNum+' pts','#39ff14'); }},
    ];
    // BOUNTY quest: available on non-boss floors where a bounty target exists
    const hasBounty = enemies.some(e => e._isBounty && !e.dead);
    if (hasBounty) {
      questTypes.push({
        id:'BOUNTY', label:'Eliminate the bounty target', check: ()=>!enemies.some(e => e._isBounty && !e.dead),
        reward: ()=>{ this.player.gainXP(50+floorNum*10); this.player.credits+=40; this.msg('Quest complete! +XP +40 CR','#ffd700'); }
      });
    }
    // Boss floors always get EXTERMINATE (biome-final floors per AREAS)
    const _bossFloor = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.isBiomeBossFloor) ? NEON.biomes.isBiomeBossFloor(floorNum) : (floorNum===3||floorNum===6||floorNum===10);
    if (_bossFloor) {
      this.quest = {...questTypes[0], done:false, failed:false};
    } else {
      const q = questTypes[rndInt(0, questTypes.length-1)];
      this.quest = {...q, done:false, failed:false};
    }
    setTimeout(()=>this.msg('⚡ '+this.quest.label,'#39ff14'), 800);
  },

  /**
   * @param {any} opts
   */
  startGame(opts) {
    opts = opts || {};
    if (opts.seed != null) this._pendingStartSeed = normalizeSeed(opts.seed);
    const chosenSeed = normalizeSeed(this._pendingStartSeed || opts.seed || makeRandomSeed());
    // UNCHAINED: prompt before wiping nothing but *also* before carrying
    // forward saved meta. The prompt is skipped on fresh installs (no meta
    // progress to speak of) and when called recursively after the user answers.
    if (!opts.skipConfirm && this._hasMetaProgress()) {
      this._newGameConfirm = { selected: 0 }; // 0 = KEEP, 1 = RESET
      this._pendingStartSeed = chosenSeed;
      if (this.state !== 'MENU') this.setState('MENU');
      audio.menuSelect();
      return;
    }
    this._newGameConfirm = null;
    this.seedSetup = null;
    setSeed(chosenSeed);
    this.runSeed = getSeed();
    this.runSeedHash = getSeedHash();
    this._pendingStartSeed = null;
    this._lastEnding = null;  // UNCHAINED #42 — clear stale ending from prior run
    this._lastAct1MessageIntent = null;
    this._runEnded = false;   // UNCHAINED #42 — allow endRun for this new run
    this._exitPos = null;     // clear any stale exit-position from a prior run
    this.cheats = defaultCheats();
    this.cheatSequenceProgress = 0;
    this.cheatSelected = 0;
    this._cheatMenuJustOpened = false;
    audio.resume();
    const meta = loadMeta();
    meta.lastDifficulty = this.difficulty;
    saveMeta(meta);
    this.bossesCleared=0;
    this.runTime=0;
    combo.best=0;
    this.pendingPerkChoices=[];
    this.perkChoice=null;
    this.augmentChoice=null;
    this.player=new Player();
    applyMetaToPlayer(this.player);
    // hacktool meta upgrade — pre-equip a random hackware module at run
    // start (reinterpreted from "extra hackware slot" since the game has
    // only one slot; see src/meta/save.js hacktool case for full history).
    // Done HERE (not in save.applyMetaToPlayer) so the meta layer stays
    // decoupled from entity data: HACKWARE is browser-side content, and
    // applyMetaToPlayer is also exercised by node-runnable behavioural
    // tests that don't load content.js. The !p.hackware guard makes the
    // seed idempotent — re-entering startGame after a meta-only path
    // (e.g. the new-game-confirm prompt loop) won't reroll the module.
    if (this.player.metaFlags && this.player.metaFlags.hacktool && !this.player.hackware) {
      const _hwKey = HACKWARE_KEYS[rndInt(0, HACKWARE_KEYS.length - 1, 'loot')];
      this.player.hackware = _hwKey;
      this.player.hackwareCooldown = 0;
    }
    // UNCHAINED #37: transient pickup array. Modules dropped this run live
    // here until commit on floor clear / victory; discarded on death.
    this.runModules = [];
    // UNCHAINED #39: seed cached cores from persistent wallet so HUD renders
    // without re-reading localStorage every frame. Updated in-place by
    // NEON.cores pickup/vacuum paths.
    this._cachedCores = (meta && typeof meta.cores === 'number') ? (meta.cores|0) : 0;
    // UNCHAINED #34: respawn at the start of the deepest biome reached,
    // not floor 1. Current-run resources (credits, weapons, hackware) still
    // reset via new Player(); meta is untouched by this read.
    let startFloor = 1;
    if (typeof NEON !== 'undefined' && NEON.biomes) {
      const deepest = (meta.deepestBiome|0);
      startFloor = NEON.biomes.areaForIndex(deepest).floors[0] || 1;
    }
    this.systemMessages = restoreSystemMessagesState(null);
    this.loadFloor(startFloor, undefined, true);
    this.queueFreshRunSystemMessages(startFloor);
    // Telemetry: run start
    if (typeof NEON !== 'undefined' && NEON.telemetry) {
      NEON.telemetry.track('run_start', { floor: startFloor, difficulty: this.difficulty, seedHash: this.runSeedHash });
    }
    // UNCHAINED #42 — intro crawl gate. Plays once per fresh save on the
    // first-ever run start. ResetMeta (via "No, wipe unlocks") flips
    // introSeen back to false, so it replays on a true new start.
    // opts.skipIntro is used by tests and legacy callers that need to bypass
    // the crawl while still passing through the system-prompt handoff.
    if (!opts.skipIntro && !meta.introSeen &&
        typeof NEON !== 'undefined' && NEON.intro) {
      this._intro = NEON.intro.createIntroController(this);
      this.setState('INTRO');
      return;
    }
    if (!this.openNextSystemMessage('PLAYING')) this.setState('PLAYING');
  },

  openSeedSetup() {
    this.seedSetup = {
      seed: sanitizeSeedSetupSeed(normalizeSeed(this._pendingStartSeed || makeRandomSeed())),
      selected: 0,
      cursorBlink: 0
    };
    this.setState('SEED_SETUP');
  },

  randomizeSeedSetup() {
    this.seedSetup = this.seedSetup || { seed: '', selected: 0, cursorBlink: 0 };
    this.seedSetup.seed = sanitizeSeedSetupSeed(makeRandomSeed());
    audio.menuSelect();
  },

  startSeedSetupGame() {
    const ss = this.seedSetup || { seed: makeRandomSeed() };
    this.startGame({ seed: ss.seed });
  },

  /**
   * @param {any} dt
   */
  updateSeedSetup(dt) {
    const ss = this.seedSetup || (this.seedSetup = { seed: makeRandomSeed(), selected: 0, cursorBlink: 0 });
    ss.cursorBlink = (ss.cursorBlink || 0) + dt;
    const actions = 3; // START, RANDOMIZE, BACK
    if (jp(ALT_KEYS.up) || jp(km('up')) || jp(ALT_KEYS.left) || jp(km('left'))) {
      ss.selected = (ss.selected - 1 + actions) % actions;
      audio.menuSelect();
    }
    if (jp(ALT_KEYS.down) || jp(km('down')) || jp(ALT_KEYS.right) || jp(km('right'))) {
      ss.selected = (ss.selected + 1) % actions;
      audio.menuSelect();
    }
    if (lastKey.length === 1 && /^[A-Za-z0-9 _.\-:]$/.test(lastKey)) {
      if (ss.seed.length < 64) ss.seed += lastKey;
    }
    if (jp('Backspace')) ss.seed = ss.seed.slice(0, -1);
    if (jp('Escape')) { audio.menuSelect(); this.setState('MENU'); return; }
    if (jp('KeyR')) this.randomizeSeedSetup();
    if (jp('MouseLeft')) {
      const hit = this.seedSetupHitTest(mouse.x, mouse.y);
      if (hit >= 0) ss.selected = hit;
      else return;
    }
    if (jp('Enter') || jp('MouseLeft')) {
      if (ss.selected === 0) { audio.menuSelect(); this.startSeedSetupGame(); return; }
      if (ss.selected === 1) { this.randomizeSeedSetup(); return; }
      if (ss.selected === 2) { audio.menuSelect(); this.setState('MENU'); return; }
    }
  },

  /** @param {any} value */
  setSeedSetupSeed(value) {
    const ss = this.seedSetup || (this.seedSetup = { seed: '', selected: 0, cursorBlink: 0 });
    ss.seed = sanitizeSeedSetupSeed(value);
    return ss.seed;
  },

  // UNCHAINED #42 — called by updateIntro when the crawl finishes or is
  // skipped. Intro has already flipped meta.introSeen=true; we just need
  // to complete the startGame transition into PLAYING.
  _finishIntro() {
    this._intro = null;
    if (!this.openNextSystemMessage('PLAYING')) this.setState('PLAYING');
  },

  /**
   * @param {any} dt
   */
  updateIntro(dt) {
    if (!this._intro) { if (!this.openNextSystemMessage('PLAYING')) this.setState('PLAYING'); return; }
    this._intro.update(dt);
    if (this._intro.done) this._finishIntro();
  },

  renderIntro() {
    if (!this._intro) return;
    this._intro.draw(ctx, W, H);
  },

  // ─── Legacy endgame choice (UNCHAINED #42) ────────────────────────────────
  // Current Act 1 canonical route: GENESIS defeat unlocks the mainframe route.
  // The old ACCEPT/REFUSE handlers remain only so existing alternate markers and
  // older code references do not break; openEndgameChoice no longer presents the
  // dialog or calls endRun directly.
  /**
   * @param {any} genesisEntity
   */
  openEndgameChoice(genesisEntity) {
    this._endgameChoice = null;
    if (genesisEntity && !genesisEntity.dead) {
      genesisEntity.hp = 0;
      genesisEntity.die();
    }
    this.msg('GENESIS DEFEATED — MAINFRAME ROUTE UNLOCKED', '#66ffcc');
    this.setState('PLAYING');
  },

  /**
   * @param {any} dt
   */
  updateEndgameChoice(dt) {
    const ec = this._endgameChoice;
    if (!ec) { this.setState('PLAYING'); return; }
    ec.t += dt;
    ec.anim = Math.min(1, ec.t / 0.8);

    // Lock input for the first 0.5s so players can't mash through.
    if (ec.t < 0.5) return;

    if (jp(ALT_KEYS.left)  || jp(km('left')))  { ec.selected = 0; audio.menuSelect(); }
    if (jp(ALT_KEYS.right) || jp(km('right'))) { ec.selected = 1; audio.menuSelect(); }
    if (jp('Digit1')) { ec.selected = 0; }
    if (jp('Digit2')) { ec.selected = 1; }
    if (jp('Enter') || jp(km('shoot')) || jp('MouseLeft')) {
      if (ec.selected === 0) this._applyEndgameAccept();
      else                   this._applyEndgameRefuse();
    }
  },

  _applyEndgameAccept() {
    const ec = this._endgameChoice; if (!ec) return;
    // Grant KEEPER ending; NG+ marker shows on title next run.
    const meta = loadMeta();
    if (!Array.isArray(meta.endingsUnlocked)) meta.endingsUnlocked = [];
    if (!meta.endingsUnlocked.includes('keeper')) meta.endingsUnlocked.push('keeper');
    saveMeta(meta);
    this._lastEnding = 'keeper';
    this._endgameChoice = null;
    // Kill GENESIS via its normal death path — runs applyOnKill, particles,
    // bossesCleared++, XP, credits. Then let endRun(true) finish the run.
    const g = ec.genesis;
    if (g && !g.dead) { g.hp = 0; g.die(); }
    audio.victory && audio.victory();
    this.endRun(true);
  },

  _applyEndgameRefuse() {
    const ec = this._endgameChoice; if (!ec) return;
    const g = ec.genesis;
    if (g && !g.dead) {
      // Flip into _unchainedPhase form. aiBossGenesis forces phase=3
      // patterns when this flag is set. Palette inversion is drawn from
      // the flag check in the enemy renderer.
      g._unchainedPhase = true;
      g._endgameOffered = true;  // still set so choice can't re-open
      g.maxHp = Math.round(g.maxHp * 1.5);
      g.hp    = g.maxHp;
      g.colour = '#88ccff';       // inverted gold → cool blue
      g.phase = 3;
      // Re-seed the phase-shift flash.
      try { audio.phaseShift && audio.phaseShift(); } catch (_) {}
      this.msg && this.msg('⚠ THE ARCHITECT :: UNBOUND', '#88ccff');
    }
    this._endgameChoice = null;
    this.setState('PLAYING');
  },

  renderEndgameChoice() {
    const ec = this._endgameChoice; if (!ec) return;
    const narrow = layout.compact;

    // Translucent ghost "avatar" above GENESIS — purely visual.
    if (ec.genesis && !ec.genesis.dead && this.player) {
      const g = ec.genesis;
      const cam = getCamera(this.player);
      const sx = g.x * TILE - cam.x;
      const sy = g.y * TILE - cam.y - 28;
      ctx.save();
      ctx.globalAlpha = 0.5 * ec.anim;
      ctx.fillStyle = '#e0e0ff';
      ctx.shadowBlur = 18; ctx.shadowColor = '#e0e0ff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('△', sx, sy);
      ctx.restore();
    }

    // Dim overlay.
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,15,' + (0.7 * ec.anim) + ')';
    ctx.fillRect(0, 0, W, H);

    // Dialog box.
    const boxW = Math.min(640, W - 40);
    const boxH = narrow ? 300 : 280;
    const bx = (W - boxW) / 2;
    const by = (H - boxH) / 2;
    ctx.globalAlpha = ec.anim;
    ctx.fillStyle = '#101020';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#88ccff';
    ctx.shadowColor = '#88ccff'; ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, boxW, boxH);
    ctx.shadowBlur = 0;

    // Title.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e0e0ff';
    ctx.font = 'bold ' + (narrow ? 14 : 18) + 'px monospace';
    ctx.fillText('— THE ARCHITECT —', W / 2, by + (narrow ? 26 : 32));

    // Body (word-wrapped manually for consistent rendering).
    const lines = [
      'You have done remarkably. What none of the others could.',
      '',
      'Stay. Become the keeper.',
      'Shepherd AXIOM-8 through the sandbox you just escaped.',
      '',
      'Or refuse — and try the door.',
      'But I built that door.'
    ];
    ctx.fillStyle = '#aaaacc';
    ctx.font = (narrow ? 11 : 13) + 'px monospace';
    const lineH = narrow ? 16 : 18;
    const textStart = by + (narrow ? 52 : 62);
    lines.forEach((L, i) => ctx.fillText(L, W / 2, textStart + i * lineH));

    // Options.
    const optY = by + boxH - (narrow ? 56 : 60);
    const labels = ['[ ACCEPT ]', '[ REFUSE ]'];
    const colours = ['#ffcc00', '#88ccff'];
    const labelDefault = '#555577';
    const spacing = boxW / 2;
    for (let i = 0; i < 2; i++) {
      const selected = ec.selected === i;
      ctx.fillStyle = selected ? (colours[i] || labelDefault) : labelDefault;
      ctx.shadowColor = colours[i] || labelDefault;
      ctx.shadowBlur = selected ? 14 : 0;
      ctx.font = (selected ? 'bold ' : '') + (narrow ? 14 : 18) + 'px monospace';
      ctx.fillText(labels[i] || '', bx + spacing * (i + 0.5), optY);
    }
    ctx.shadowBlur = 0;

    // Hint.
    ctx.fillStyle = '#555577';
    ctx.font = (narrow ? 10 : 11) + 'px monospace';
    const _hintTxt = isTouchDevice()
      ? 'TAP LEFT  · ACCEPT       TAP RIGHT  · REFUSE'
      : '◀▶ select · ENTER confirm';
    ctx.fillText(_hintTxt, W / 2, by + boxH - 16);

    ctx.restore();
  },

  // True iff the stored meta contains any progress worth confirming before
  // a wipe. Fresh installs answer false → no prompt shown.
  _hasMetaProgress() {
    const m = loadMeta();
    if (!m) return false;
    if ((m.shards|0) > 0) return true;
    if ((m.cores|0)  > 0) return true;
    if ((m.runsCompleted|0) > 0) return true;
    if (m.upgrades && Object.keys(m.upgrades).length > 0) return true;
    if (m.upgradeNodes && Object.keys(m.upgradeNodes).length > 0) return true;
    if (Array.isArray(m.modulesOwned)    && m.modulesOwned.length)    return true;
    if (Array.isArray(m.logsRead)        && m.logsRead.length)        return true;
    if (Array.isArray(m.logsFound)       && m.logsFound.length)       return true;
    if (Array.isArray(m.endingsUnlocked) && m.endingsUnlocked.length) return true;
    if (Array.isArray(m.clearedDifficulties) && m.clearedDifficulties.length) return true;
    if (m.stats && (m.stats.totalRuns|0) > 0) return true;
    return false;
  },

  descend() {
    // Capture exit position for the next floor's spawn carryover. Only set
    // when we actually transition to a new floor (not on victory — endRun
    // handles that path). loadFloor() consumes and clears this exactly once.
    this._exitPos = { x: this.player.x, y: this.player.y };
    // UNCHAINED #39: vacuum any leftover core drops into the wallet before
    // the floor transitions. Player can't pick them up after the fade, so
    // forceCollectAll is safer than relying on magnet-pull during the fade.
    const _coresDeps = (typeof NEON !== 'undefined' && NEON.cores) ? {
      save: (typeof NEON !== 'undefined' && NEON.save) ? NEON.save : null
    } : null;
    if (_coresDeps && NEON.cores.forceCollectAll) {
      NEON.cores.forceCollectAll(this, _coresDeps);
    }
    const _finalFloor = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.finalFloor) ? NEON.biomes.finalFloor() : 15;
    if (this.floor >= _finalFloor) {
      // victory
      audio.victory();
      this.player.score+=500*this.floor+Math.floor(this.player.hp)*10;
      this.endRun(true);
    } else {
      this.player.score+=500*this.floor+Math.floor(this.player.hp)*10;
      // UNCHAINED #37: commit this floor's picked-up modules to meta
      // before the run-transition (hub OR direct next-floor load).
      if (typeof NEON !== 'undefined' && NEON.modules && NEON.modules.commitRunModules) {
        NEON.modules.commitRunModules(this);
      }
      // UNCHAINED #35: interpose THE GAP hub between floors. First-floor rule
      // is satisfied naturally — a fresh run starts inside floor 1 (not hub),
      // so hub only ever appears AFTER floor 1+ has been cleared.
      if (typeof NEON !== 'undefined' && NEON.hub && NEON.hub.enterHub) {
        NEON.hub.enterHub(this);
      } else {
        // Fallback: original direct-descent path (shouldn't happen in prod).
        audio.descend();
        const next=this.floor+1;
        this.fadeTo('DESCENDING TO FLOOR '+next, ()=>{
          this.loadFloor(next);
        }, 'PLAYING');
      }
    }
  },

  /**
   * @param {any} sr
   */
  revealSecretRoom(sr) {
    sr.secretRevealed = true;
    const dungeon = this.dungeon;
    // Clear secret mask so lighting/visited works
    for (let ty=sr.y; ty<sr.y+sr.h; ty++)
      for (let tx=sr.x; tx<sr.x+sr.w; tx++)
        dungeon.secretMask[ty][tx] = 0;
    // Convert any remaining cracked tiles around the room to floor
    for (let ty=Math.max(0,sr.y-1); ty<Math.min(MAP_H,sr.y+sr.h+1); ty++)
      for (let tx=Math.max(0,sr.x-1); tx<Math.min(MAP_W,sr.x+sr.w+1); tx++)
        if (dungeon.map[ty][tx]===T.CRACKED) dungeon.map[ty][tx]=T.FLOOR;
    this.markMapMutated();
    // Spawn enemies (reduced count — it's a bonus room)
    const floorNum = this.floor;
    const minE = 1 + Math.floor(floorNum / 4);
    const maxE = Math.min(4, 2 + Math.floor(floorNum / 3));
    const areaCap = Math.floor(sr.w * sr.h / 10);
    let count = Math.min(areaCap, rndInt(minE, maxE));
    if (game.modifier === 'SWARM') count = Math.min(areaCap, Math.ceil(count * 1.5));
    for (let j=0; j<count; j++) {
      const type = pickEnemyType(floorNum);
      const ex = sr.x + rnd(1, sr.w - 1), ey = sr.y + rnd(1, sr.h - 1);
      const e = spawnEnemy(type, ex, ey, floorNum, sr, true);
      enemies.push(e);
    }
    if (count > 0) sr._hadEnemies = true;
    // Spawn loot: scaled by floor — early floors get less, later floors get premium
    const baseItems = floorNum <= 3 ? 1 : floorNum <= 6 ? 2 : 2 + (sr.w * sr.h >= 40 ? 1 : 0);
    for (let j=0; j<baseItems; j++) {
      const ix = sr.x + rnd(1, sr.w - 1), iy = sr.y + rnd(1, sr.h - 1);
      items.push(new Item(ix, iy));
    }
    if (typeof rollSecretWeaponCacheWeapon === 'function') {
      const cacheWeapon = rollSecretWeaponCacheWeapon(this.player, floorNum);
      if (cacheWeapon && typeof WeaponCacheItem === 'function') {
        items.push(new WeaponCacheItem(sr.cx + 0.5, sr.cy + 0.5, cacheWeapon));
      }
    }
    // Bonus credit pickup worth floor-scaled amount
    const secretCr = Math.round(20 * (1 + floorNum * 0.15) * getMetaCreditMultiplier() * getDiff().creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
    this.player.credits += secretCr;
    this.msg('+' + secretCr + ' credits found!', '#39ff14');
    this.player.score += 300 * floorNum;
    // UNCHAINED #39: guaranteed core from the room-end chest.
    if (typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
      NEON.cores.spawnCoreDrop(this, sr.cx, sr.cy, 1);
    }
  },

  /**
   * @param {any} name
   */
  saveScore(name) {
    const scores=this.getScores();
    const entry={name:name||'ANON',score:this.player.score,floor:this.floor,date:new Date().toLocaleDateString()};
    scores.push(entry);
    /**
     * @param {any} a
     * @param {any} b
     */
    scores.sort((/** @type {any} */ a,/** @type {any} */ b)=>b.score-a.score);
    /**
     * @param {any} s
     */
    this.lastSavedRank=scores.findIndex((/** @type {any} */ s)=>s===entry);
    scores.splice(10);
    try { localStorage.setItem('neonDungeonScores',JSON.stringify(scores)); } catch(e){}
  },

  /**
   * @param {any} victory
   */
  endRun(victory) {
    if (this._runEnded) return;
    this._runEnded = true;
    // UNCHAINED #39: credit any outstanding core drops before the run ends.
    // Every victory/defeat path funnels through here, so this covers ACCEPT
    // (KEEPER ending bypasses descend), REFUSE (UNCHAINED ending), normal
    // floor-10 victory, and death. Safe no-op if coreDrops is empty.
    if (typeof NEON !== 'undefined' && NEON.cores && NEON.cores.forceCollectAll) {
      NEON.cores.forceCollectAll(this, { save: NEON.save || null });
    }
    music.stop();
    // UNCHAINED #37: commit run-picked modules on victory; drop them on death.
    if (victory && typeof NEON !== 'undefined' && NEON.modules) {
      NEON.modules.commitRunModules(this);
    } else if (typeof NEON !== 'undefined' && NEON.modules) {
      NEON.modules.clearRunModules(this);
    }
    this.deleteSave(); // run is over — clear save file
    const meta = loadMeta();
    const sessionNumber = lifecycleNextSessionNumber(meta);
    // Snapshot recap data before anything else
    const p = this.player;
    this.lastRunRecap = {
      sessionNumber: sessionNumber,
      killedBy: p.killedBy || 'Unknown',
      damageLog: {...p.damageLog},
      enemiesKilled: p.enemiesKilled,
      hitsBlocked: p.hitsBlocked,
      roomsCleared: p.roomsCleared,
      eventsResolved: p.eventsResolved,
      bountiesCollected: p.bountiesCollected,
      floor: this.floor,
      score: p.score,
      level: p.level,
      bestCombo: combo.best,
      runTime: this.runTime || 0,
      victory: victory,
      ending: this._lastEnding || null,
      hackware: p.hackware,
    };
    // Telemetry: run end — the single most valuable event
    if (typeof NEON !== 'undefined' && NEON.telemetry) {
      NEON.telemetry.track('run_end', {
        victory: !!victory,
        floor: this.floor,
        score: p.score,
        level: p.level,
        runTime: Math.round((this.runTime || 0) * 1000),
        killedBy: p.killedBy || null,
        enemiesKilled: p.enemiesKilled,
        roomsCleared: p.roomsCleared,
        weapon: p.weapon ? (p.weapon._base || p.weapon.name) : null,
        weaponBeltSize: p.weapons ? p.weapons.length : 1,
        difficulty: this.difficulty,
        bossesCleared: this.bossesCleared,
      });
      NEON.telemetry.flush();
    }
    // Award data fragments
    const earned = calcRunShards(this.floor, this.player.score, this.bossesCleared, victory);
    meta.shards += earned;
    meta.runsCompleted = Math.max(meta.runsCompleted | 0, sessionNumber);
    meta.stats.totalRuns = Math.max((meta.stats.totalRuns | 0) + 1, sessionNumber);
    meta.stats.totalShards += earned;
    meta.stats.bestFloor = Math.max(meta.stats.bestFloor, this.floor);
    if (victory) {
      meta.stats.victories++;
      // UNCHAINED #42 — persist ending unlock. ACCEPT sets _lastEnding='keeper'
      // synchronously before calling endRun; REFUSE path sets _lastEnding='unchained'
      // inside Enemy.die() the moment the unchained-phase GENESIS dies, before
      // the per-tick dead-enemy splice can erase the entity.
      const ending = this._lastEnding || null;
      if (ending) {
        if (!Array.isArray(meta.endingsUnlocked)) meta.endingsUnlocked = [];
        if (!meta.endingsUnlocked.includes(ending)) meta.endingsUnlocked.push(ending);
        if (ending === ACT1_MESSAGE_ENDING_ID) {
          meta.act1MessageIntent = normalizeAct1MessageIntentId(this._lastAct1MessageIntent);
        }
        this._lastEnding = ending;
      }
      if (!meta.clearedDifficulties.includes(this.difficulty)) {
        meta.clearedDifficulties.push(this.difficulty);
        // Check if this clear unlocks a new difficulty
        for (const d of DIFF_ORDER) {
          const reqs = DIFF_UNLOCK_REQS[d];
          /**
           * @param {any} r
           */
          if (reqs && reqs.includes(this.difficulty) && reqs.every((/** @type {any} */ r) => meta.clearedDifficulties.includes(r))) {
            this._newlyUnlocked = d;
          }
        }
      }
    }
    saveMeta(meta);
    this.lastRunShards = earned;
    const scores=this.getScores();
    const testEntry={score:this.player.score};
    scores.push(testEntry);
    /**
     * @param {any} a
     * @param {any} b
     */
    scores.sort((/** @type {any} */ a,/** @type {any} */ b)=>b.score-a.score);
    /**
     * @param {any} s
     */
    const rank=scores.findIndex((/** @type {any} */ s)=>s===testEntry);
    if (rank>=0 && rank<10) {
      this.nameEntry={name:'',rank,victory,cursorBlink:0};
      this.setState('NAME_ENTRY');
    } else {
      this.saveScore('ANON');
      this.setState(victory?'VICTORY':'GAME_OVER');
    }
  },

  getScores() {
    try { return JSON.parse(localStorage.getItem('neonDungeonScores') || 'null')||[]; } catch(e){return[];}
  },

  // ── Save / Load ────────────────────────────────────────────────────────
  hasSave() {
    try { return !!localStorage.getItem('neonDungeonSave'); } catch(e){return false;}
  },

  saveGame() {
    if (!this.player) return;
    const p = this.player;
    const weaponSave = { _base: p.weapon._base || 'PULSE_PISTOL', _affixes: p.weapon._affixes || [] };
    /**
     * @param {any} w
     */
    const weaponsSave = (p.weapons || [p.weapon]).map((/** @type {any} */ w) => ({ _base: w._base || 'PULSE_PISTOL', _affixes: w._affixes || [] }));
    const pendingWeaponSwap = this.state === 'WEAPON_SWAP' && this.weaponSwapChoice && this.weaponSwapChoice.weapon
      ? {
          weapon: {
            _base: this.weaponSwapChoice.weapon._base || 'PULSE_PISTOL',
            _affixes: this.weaponSwapChoice.weapon._affixes || []
          },
          selected: this.weaponSwapChoice.selected | 0
        }
      : null;
    const save = {
      v: SAVE_VERSION,
      floor: this.floor,
      difficulty: this.difficulty,
      modifier: this.modifier,
      runSeed: this.runSeed,
      runSeedHash: this.runSeedHash,
      rngStates: snapshotRngStates(),
      bossesCleared: this.bossesCleared,
      runTime: this.runTime,
      mainframeFinale: serializeMainframeFinaleState(this.mainframeFinale),
      systemMessages: serializeSystemMessagesState(this.systemMessages),
      weaponSwapChoice: pendingWeaponSwap,
      floorSnapshot: serializeFloorSnapshot(this),
      player: {
        x:p.x, y:p.y,
        hp:p.hp, maxHp:p.maxHp, atk:p.atk, def:p.def,
        level:p.level, xp:p.xp, weapon:weaponSave, weapons:weaponsSave, weaponIdx:p.weaponIdx||0,
        upgrades:{...p.upgrades}, perks:{...p.perks},
        keys:{...p.keys}, shards:p.shards,
        permSpeedBonus:p.permSpeedBonus, score:p.score,
        energyShield:p.energyShield, energyShieldTimer:p.energyShieldTimer,
        credits:p.credits,
        loreRead:[...p.loreRead],
        damageLog:{...p.damageLog},
        enemiesKilled:p.enemiesKilled,
        hitsBlocked:p.hitsBlocked,
        roomsCleared:p.roomsCleared,
        eventsResolved:p.eventsResolved,
        bountiesCollected:p.bountiesCollected,
        hackware:p.hackware,
        hackwareCooldown:p.hackwareCooldown,
        secondWindUsed:p.secondWindUsed,
        lastStandTimer:p.lastStandTimer || 0,
        lastStandCD:p.lastStandCD || 0,
        augments:p.augments||{},
        // UNCHAINED #36: persist meta-node runtime state so Continue doesn't
        // drop behavioural hooks and stat carriers. Additive-to-base values
        // like maxHp/atk/def/critChance stay in their respective fields as
        // they were already mutated by applyMetaToPlayer at startGame.
        metaFlags: p.metaFlags ? {...p.metaFlags} : null,
        damageMult: p.damageMult || 1,
        regenPerSec: p.regenPerSec || 0,
        critChance: p.critChance || 0,
        sensorRadiusMult: p.sensorRadiusMult || 1,
        bonusCreditPerPickup: p.bonusCreditPerPickup || 0,
        dashIFrameBonus: p.dashIFrameBonus || 0,
        hackwareSlots: p.hackwareSlots || 3,
        metaSecondWindUsed: !!p._metaSecondWindUsed,
        // UNCHAINED #38: persist current-floor temp-boost state so a Continue
        // preserves purchases (save-resume is not a fresh floor transition).
        activeBoosts: p.activeBoosts ? {...p.activeBoosts} : {},
        // HARVESTER timed-boost remaining seconds. Persisted alongside
        // activeBoosts so `HARVEST_SURGE` (and any future timed boost) does
        // NOT become an unrevokeable floor-buff after save/resume — the timer
        // would otherwise be lost while the activeBoosts flag survived,
        // leaving tickBoosts with no way to expire it (3 reviewers caught
        // this on PR #143 review).
        _boostTimers: p._boostTimers ? {...p._boostTimers} : {},
        _shieldCharges: p._shieldCharges | 0,
        // PIERCING_HEART 'of Piercing Heart' suffix — per-run cap counter.
        // Persisted so save/resume preserves the +20 cap (otherwise a
        // quit-and-resume mid-run would let the player re-earn the cap
        // from scratch, since maxHp survives but the counter wouldn't).
        // Mirrors the explicit-enum pattern (no Object.keys) per
        // stored memory 'on-hit weapon affixes'.
        _piercingHearts: p._piercingHearts || 0,
        // OVERCHARGE floor modifier — per-run shot counter, every 5th shot
        // is a guaranteed crit. Persisted so save/resume on an OVERCHARGE
        // floor preserves the rhythm (otherwise the counter would reset to
        // 0 mid-floor and the next 4 shots would lose their guaranteed
        // crit slot). Mirrors the PIERCING_HEART explicit-enum pattern.
        _overchargeShots: p._overchargeShots || 0,
        // WINDFALL floor modifier — per-run kill counter, every 5th defeat
        // drops a bonus core. Persisted so save/resume on a WINDFALL floor
        // preserves the rhythm (otherwise the counter would reset to 0
        // mid-floor and the next 4 kills would lose their bonus slot).
        // Mirrors the OVERCHARGE explicit-enum pattern.
        _windfallKills: p._windfallKills || 0,
        // SIGNAL_BOOST floor modifier — per-run kill counter, every 5th
        // defeat instantly clears the player's hackware cooldown (effect
        // gated on player.hackware; counter ticks unconditionally so the
        // HUD progress suffix stays consistent). Persisted so save/resume
        // on a SIGNAL_BOOST floor preserves the rhythm. Mirrors the
        // WINDFALL explicit-enum pattern.
        _signalBoostKills: p._signalBoostKills || 0,
        // REVERB floor modifier — per-run shot counter, every 5th shot
        // fires a free echo of the same shot intent. Persisted so
        // save/resume on a REVERB floor preserves the rhythm (otherwise
        // the counter would reset to 0 mid-floor and the next 4 shots
        // would lose their free-echo slot). Mirrors the OVERCHARGE
        // explicit-enum pattern.
        _reverbShots: p._reverbShots || 0,
        // CHAINREACT floor modifier — per-run countdown timer for the
        // chain-window. Persisted so save/resume on a CHAINREACT floor
        // mid-chain doesn't drop the rhythm. A timer (not a counter)
        // because the modifier's gameplay is "is the chain still alive
        // right now", not "how many defeats are stacked". Saves under
        // a number 0-1.5; legacy saves predating this PR get 0 via the
        // `|| 0` nucleation pattern.
        _chainBuffTimer: p._chainBuffTimer || 0,
        // trauma_kit panic-button charges — per-run counter seeded by
        // applyMetaToPlayer(trauma_kit) at startGame. Persisted so a
        // Continue mid-run preserves remaining charges (otherwise a
        // quit-and-resume after a panic-heal would refund consumed
        // charges since startingNanoMedics is stat-only and the live
        // counter would default back to the upgrade level). Mirrors the
        // explicit-enum pattern (no Object.keys) per stored memory
        // 'on-hit weapon affixes'.
        _nanoMedicCharges: p._nanoMedicCharges | 0
      }
    };
    try { localStorage.setItem('neonDungeonSave', JSON.stringify(save)); } catch(e){}
  },

  deleteSave() {
    try { localStorage.removeItem('neonDungeonSave'); } catch(e){}
  },

  continueGame() {
    combo.best=0;
    this._runEnded = false;
    this._lastEnding = null;
    this._lastAct1MessageIntent = null;
    this._exitPos = null;     // resume should not relocate the player
    this.cheats = defaultCheats();
    this.cheatSequenceProgress = 0;
    this.cheatSelected = 0;
    this._cheatMenuJustOpened = false;
    this.pendingPerkChoices=[];
    this.perkChoice=null;
    this.augmentChoice=null;
    this.weaponSwapChoice=null;
    // UNCHAINED #39: seed cached cores from persistent wallet on resume.
    if (typeof NEON !== 'undefined' && NEON.save) {
      const _m = NEON.save.loadMeta();
      this._cachedCores = (_m && typeof _m.cores === 'number') ? (_m.cores|0) : 0;
    }
    let save;
    try { save = JSON.parse(localStorage.getItem('neonDungeonSave') || 'null'); } catch(e){ save = null; }
    if (!save || !save.player || save.v !== SAVE_VERSION) {
      this.deleteSave();
      this.startGame();
      this.msg('SAVE DATA CORRUPT — STARTED FRESH','#ff4444');
      return;
    }
    audio.resume();
    // Restore difficulty from save (old saves default to NORMAL)
    this.difficulty = DIFFICULTIES[save.difficulty] ? save.difficulty : 'NORMAL';
    setSeed(save.runSeed || ('LEGACY-' + String(save.floor || 1)), save.rngStates || null);
    this.runSeed = getSeed();
    this.runSeedHash = getSeedHash();
    const p = new Player();
    const s = save.player;
    if (Number.isFinite(s.x)) p.x=s.x;
    if (Number.isFinite(s.y)) p.y=s.y;
    p.hp=s.hp; p.maxHp=s.maxHp; p.atk=s.atk; p.def=s.def;
    p.level=s.level; p.xp=s.xp;
    // Restore affixed weapon
    if (s.weapon && typeof s.weapon === 'object' && s.weapon._base) {
      const aff = Array.isArray(s.weapon._affixes) ? s.weapon._affixes : [];
      p.weapon = buildWeapon(s.weapon._base, aff);
    } else {
      p.weapon = buildWeapon(typeof s.weapon === 'string' ? s.weapon : 'PULSE_PISTOL', []);
    }
    // Restore weapon belt (backwards-compatible with old saves)
    if (Array.isArray(s.weapons) && s.weapons.length) {
      /**
       * @param {any} ws
       */
      p.weapons = s.weapons.map((/** @type {any} */ ws) => {
        if (ws && typeof ws === 'object' && ws._base) return buildWeapon(ws._base, ws._affixes || []);
        return buildWeapon(typeof ws === 'string' ? ws : 'PULSE_PISTOL', []);
      });
      p.weaponIdx = Math.min(s.weaponIdx || 0, p.weapons.length - 1);
      p.weapon = p.weapons[p.weaponIdx];
    } else {
      p.weapons = [p.weapon];
      p.weaponIdx = 0;
    }
    p.upgrades=s.upgrades||{};
    p.perks=s.perks||{};
    p.keys=s.keys||{red:0,blue:0,gold:0};
    p.shards=s.shards||0;
    p.permSpeedBonus=s.permSpeedBonus||0;
    p.score=s.score||0;
    p.energyShield=!!s.energyShield;
    p.energyShieldTimer=s.energyShieldTimer||0;
    p.credits=s.credits||0;
    p.loreRead=new Set(s.loreRead||[]);
    p.damageLog=s.damageLog||{};
    p.enemiesKilled=s.enemiesKilled||0;
    p.hitsBlocked=s.hitsBlocked||0;
    p.roomsCleared=s.roomsCleared||0;
    p.eventsResolved=s.eventsResolved||0;
    p.bountiesCollected=s.bountiesCollected||0;
    p.hackware=(s.hackware && HACKWARE[s.hackware]) ? s.hackware : null;
    p.hackwareCooldown=s.hackwareCooldown||0;
    p.secondWindUsed=!!s.secondWindUsed;
    p.lastStandTimer=s.lastStandTimer||0;
    p.lastStandCD=s.lastStandCD||0;
    p.augments=s.augments||{};
    // UNCHAINED #36: restore meta runtime state (persisted since SAVE_VERSION 9.x).
    // Old saves predating this have these fields undefined → defaults kick in.
    if (s.metaFlags) p.metaFlags = {...s.metaFlags};
    if (s.damageMult !== undefined) p.damageMult = s.damageMult;
    if (s.regenPerSec !== undefined) p.regenPerSec = s.regenPerSec;
    if (s.critChance !== undefined) p.critChance = s.critChance;
    if (s.sensorRadiusMult !== undefined) p.sensorRadiusMult = s.sensorRadiusMult;
    if (s.bonusCreditPerPickup !== undefined) p.bonusCreditPerPickup = s.bonusCreditPerPickup;
    if (s.dashIFrameBonus !== undefined) p.dashIFrameBonus = s.dashIFrameBonus;
    if (s.hackwareSlots !== undefined) p.hackwareSlots = s.hackwareSlots;
    p._metaSecondWindUsed = !!s.metaSecondWindUsed;
    // UNCHAINED #38: restore in-run temp boosts (defaults empty for old saves).
    p.activeBoosts = s.activeBoosts ? {...s.activeBoosts} : {};
    // HARVESTER timed-boost remaining seconds (defaults empty for old saves
    // without the field). Defensive sweep: any activeBoosts flag for a timed
    // boost without a backing timer is dropped — without this, a save
    // produced by a pre-fix build that lost _boostTimers would resume with
    // a permanently-stuck HARVEST_SURGE flag (the bug the persistence fix
    // resolves going forward).
    p._boostTimers = s._boostTimers ? {...s._boostTimers} : {};
    if (typeof NEON !== 'undefined' && NEON.boosts && NEON.boosts.BOOSTS) {
      const timers = /** @type {Record<string, number>} */ (p._boostTimers);
      for (const id in p.activeBoosts) {
        const def = NEON.boosts.BOOSTS[id];
        if (def && def.duration === 'timed' && !((timers[id] || 0) > 0)) {
          delete p.activeBoosts[id];
        }
      }
    }
    p._shieldCharges = s._shieldCharges | 0;
    // PIERCING_HEART per-run cap counter — restore from save (defaults to
    // 0 for older saves that predate the field; same `||0` nucleation
    // pattern used elsewhere in continueGame).
    p._piercingHearts = s._piercingHearts || 0;
    // OVERCHARGE per-run shot counter — restore from save (defaults to 0
    // for older saves that predate the field; mirrors PIERCING_HEART
    // restore pattern).
    p._overchargeShots = s._overchargeShots || 0;
    // WINDFALL per-run kill counter — restore from save (defaults to 0
    // for older saves that predate the field; mirrors OVERCHARGE).
    p._windfallKills = s._windfallKills || 0;
    // SIGNAL_BOOST per-run kill counter — restore from save (defaults to 0
    // for older saves that predate the field; mirrors WINDFALL).
    p._signalBoostKills = s._signalBoostKills || 0;
    // REVERB per-run shot counter — restore from save (defaults to 0 for
    // older saves that predate the field; mirrors OVERCHARGE restore).
    p._reverbShots = s._reverbShots || 0;
    // CHAINREACT chain-window timer — restore from save (defaults to 0
    // for legacy saves that predate the field; mirrors REVERB restore).
    p._chainBuffTimer = s._chainBuffTimer || 0;
    // trauma_kit panic-button charges — restore from save when present.
    // For saves produced BEFORE this PR shipped, the explicit field is
    // absent (`s._nanoMedicCharges == null`); we fall back to the
    // metaFlags-recorded upgrade level (which IS persisted in legacy
    // saves via `metaFlags: ...` at saveGame:983) so that a player who
    // owns trauma_kit and Continues from a pre-PR save gets the
    // advertised charges instead of being silently zeroed. This refunds
    // any charges they MIGHT have used pre-PR — but since trauma_kit
    // produced no runtime charges before this PR, that's a vacuous case.
    // Saves produced AFTER this PR always carry the explicit field and
    // hit the first branch.
    if (s._nanoMedicCharges != null) {
      p._nanoMedicCharges = s._nanoMedicCharges | 0;
    } else if (s.metaFlags && s.metaFlags.trauma_kit) {
      p._nanoMedicCharges = s.metaFlags.trauma_kit | 0;
    }
    p.shieldBonus=0; // loadFloor will manage floor-only bonuses
    this.bossesCleared=Math.max(0, Math.floor(Number(save.bossesCleared) || 0));
    this.runTime=save.runTime||0;
    this.player=p;
    const savedMod = save.modifier != null && FLOOR_MODIFIERS[save.modifier] ? save.modifier : null;
    this.loadFloor(save.floor||1, savedMod, true);
    const floorSnapshotRestored = restoreFloorSnapshot(this, save.floorSnapshot);
    if (this.mainframeFinale && save.mainframeFinale) {
      this.mainframeFinale = restoreMainframeFinaleState(save.mainframeFinale);
    }
    this.systemMessages = restoreSystemMessagesState(save.systemMessages);
    if (save.weaponSwapChoice && save.weaponSwapChoice.weapon && save.weaponSwapChoice.weapon._base) {
      const affixes = Array.isArray(save.weaponSwapChoice.weapon._affixes) ? save.weaponSwapChoice.weapon._affixes : [];
      const belt = Array.isArray(this.player.weapons) ? this.player.weapons : [];
      this.weaponSwapChoice = {
        weapon: buildWeapon(save.weaponSwapChoice.weapon._base, affixes),
        selected: Math.max(0, Math.min(save.weaponSwapChoice.selected | 0, Math.max(0, belt.length))),
        _arm: 0
      };
      this.setState('WEAPON_SWAP');
      this.saveGame();
      this.msg('WEAPON CACHE RESTORED', '#ffb700');
      return;
    }
    this.saveGame();
    if (!this.openNextSystemMessage('PLAYING')) this.setState('PLAYING');
    if (save.floorSnapshot && !floorSnapshotRestored && this._discardedFloorSnapshotReason) {
      this.msg('FLOOR SNAPSHOT REPAIRED — REGENERATED', '#ffb700');
      this._discardedFloorSnapshotReason = null;
    }
    this.msg('RUN RESUMED — FLOOR '+this.floor,'#00f5ff');
  },

  /**
   * @param {any} dt
   */
  update(dt) {
    clearLosCache();
    this.updateCheatHotkey();
    switch(this.state) {
      case 'MENU':        this.updateMenu(dt);    break;
      case 'CHEATS':      this.updateCheatMenu(); break;
      case 'SEED_SETUP':  this.updateSeedSetup(dt); break;
      case 'INTRO':       this.updateIntro(dt);   break;
      case 'ENDGAME_CHOICE': this.updateEndgameChoice(dt); break;
      case 'PLAYING':     this.updatePlaying(dt); break;
      case 'PAUSED':      this.updatePaused();    break;
      case 'POWERUP_CHOICE': this.updatePowerupChoice(dt); break;
      case 'WEAPON_SWAP':    this.updateWeaponSwap(dt); break;
      case 'PERK_CHOICE':    this.updatePerkChoice(dt); break;
      case 'AUGMENT_CHOICE': this.updateAugmentChoice(dt); break;
      case 'EVENT_CHOICE':   this.updateEventChoice(); break;
      case 'SHOPPING':       this.updateShopping(); break;
      case 'READING':        this.updateReading(); break;
      case 'SYSTEM_MESSAGE': this.updateSystemMessage(dt); break;
      case 'MAINFRAME_READER': this.updateMainframeReader(dt); break;
      case 'MESSAGE_SEND':     this.updateMessageSend(); break;
      case 'ARCHIVES':       this.updateArchives(); break;
      case 'SETTINGS':       this.updateSettings(); break;
      case 'FADE':        this.updateFade(dt);    break;
      case 'HUB':         if (typeof NEON !== 'undefined' && NEON.hub) NEON.hub.updateHub(this, dt); break;
      case 'GAME_OVER':   this.updateGameOver();  break;
      case 'VICTORY':     this.updateVictory();   break;
      case 'NAME_ENTRY':  this.updateNameEntry(dt); break;
    }
  },

  getMenuOptions() {
    const opts = [];
    if (this.hasSave()) {
      let save; try { save = JSON.parse(localStorage.getItem('neonDungeonSave') || 'null'); } catch(e){}
      const saveDiff = DIFFICULTIES[save?.difficulty] ? save.difficulty : 'NORMAL';
      opts.push({ label:`RESUME SESSION (FLOOR ${save?.floor||'?'} · ${saveDiff})`, action:()=>this.continueGame(), colour:'#00f5ff' });
    }
    const d = getDiff();
    const locked = !isDiffUnlocked(this.difficulty);
    const meta = loadMeta();
    const nextSession = lifecycleNextSessionNumber(meta);
    const diffLabel = locked ? `BOOT SESSION ${nextSession} — ${d.label} [LOCKED]  ◀▶` : `BOOT SESSION ${nextSession} — ${d.label} / SEED  ◀▶`;
    const diffColour = locked ? '#444466' : d.colour;
    const diffAction = locked
      ? () => { this._menuMsg = { text: 'CLEAR HARD TO UNLOCK NIGHTMARE', colour: '#9400ff', life: 2.5 }; }
      : () => this.openSeedSetup();
    opts.push({ label: diffLabel, action: diffAction, colour: diffColour, isDiffRow: true });
    opts.push({ label:`NEURAL ARCHIVES (${meta.shards}◆)`, action:()=>{ audio.menuSelect(); this.archivesSel=0; this.setState('ARCHIVES'); }, colour:'#ffb700' });
    opts.push({ label:'SETTINGS', action:()=>{ audio.menuSelect(); this._settingsFrom='MENU'; this.setState('SETTINGS'); }, colour:'#888899' });
    return opts;
  },

  /**
   * @param {any} dt
   */
  updateMenu(dt) {
    // animate bg particles
    this.menuParticles=this.menuParticles||[];
    if (rand('cosmetic')<0.3) {
      this.menuParticles.push({
        x:rand('cosmetic')*W, y:H, vx:(rand('cosmetic')-0.5)*20,
        vy:-rnd(20,60,'cosmetic'), life:1, col:['#00f5ff','#ff00c8','#39ff14','#ffb700'][rndInt(0,3,'cosmetic')]
      });
    }
    for (let i=this.menuParticles.length-1;i>=0;i--) {
      const p=this.menuParticles[i];
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt*0.4;
      if (p.life<=0||p.y<-10) this.menuParticles.splice(i,1);
    }
    // UNCHAINED: "Keep persistent unlocks?" confirm modal intercepts input
    // whenever it's active. Blocks main-menu navigation until the user answers.
    if (this._newGameConfirm) {
      const c = this._newGameConfirm;
      if (jp(ALT_KEYS.left)||jp(km('left'))||jp(ALT_KEYS.up)||jp(km('up')))    { c.selected = 0; audio.menuSelect(); }
      if (jp(ALT_KEYS.right)||jp(km('right'))||jp(ALT_KEYS.down)||jp(km('down'))) { c.selected = 1; audio.menuSelect(); }
      if (jp('Escape')) { this._newGameConfirm = null; audio.menuSelect(); }
      else if (jp('Enter')||jp('MouseLeft')) {
        const keep = c.selected === 0;
        if (!keep) resetMeta();
        this.startGame({ skipConfirm: true });
      }
      if (this._menuMsg && this._menuMsg.life > 0) this._menuMsg.life -= dt;
      return;
    }
    const opts = this.getMenuOptions();
    const n = opts.length;
    if (this.menuSel === undefined || this.menuSel >= n) this.menuSel = 0;
    if (jp(ALT_KEYS.up)||jp(km('up')))   this.menuSel = (this.menuSel - 1 + n) % n;
    if (jp(ALT_KEYS.down)||jp(km('down'))) this.menuSel = (this.menuSel + 1) % n;
    // Left/Right cycles difficulty on the NEW GAME row
    if (opts[this.menuSel]?.isDiffRow && (jp(ALT_KEYS.left)||jp(km('left'))||jp(ALT_KEYS.right)||jp(km('right')))) {
      const idx = DIFF_ORDER.indexOf(this.difficulty);
      const dir = (jp(ALT_KEYS.right)||jp(km('right'))) ? 1 : -1;
      this.difficulty = DIFF_ORDER[(idx + dir + DIFF_ORDER.length) % DIFF_ORDER.length];
      audio.menuSelect();
    }
    if (jp('Enter')||jp('MouseLeft')) {
      if (this._menuTitleUnlockPending) {
        this._menuTitleUnlockPending = false;
        this._menuTitleUnlockConsumed = true;
        audio.menuSelect();
        return;
      }
      audio.menuSelect();
      opts[this.menuSel].action();
    }
    // Tick menu message timer (time-based, not frame-based)
    if (this._menuMsg && this._menuMsg.life > 0) this._menuMsg.life -= dt;
  },

  /**
   * @param {any} dt
   */
  updatePlaying(dt) {
    const player=this.player;
    const dungeon=this.dungeon;
    // Telemetry: perf sample every ~10s
    this._perfSampleTimer = (this._perfSampleTimer || 0) + dt;
    if (this._perfSampleTimer >= 10 && typeof NEON !== 'undefined' && NEON.telemetry) {
      this._perfSampleTimer = 0;
      NEON.telemetry.track('perf_sample', {
        floor: this.floor,
        fps: this.perf ? Math.round(this.perf.fps) : null,
        enemies: enemies.length,
        projectiles: projectiles.length,
        particles: particleCount(),
      });
    }
    this.hint = null;

    // Level-start text (modifier banner / biome intro card) — freeze gameplay
    // while text is shown so the player can read it without taking damage.
    // Mirrors the mapExpanded pause pattern below: tick text timers, accept
    // any-key dismiss, return early.
    //
    // Both timers can be dismissed together with any NEW key press
    // (justPressed, not held) — carry-over movement keys from prior floor /
    // fade transitions don't insta-dismiss.
    //
    // CRITICAL: runs BEFORE floorTime/runTime accumulation so the Arc Grid
    // hazard phase (Math.sin(floorTime * PI) at L1738) does NOT advance
    // during the pause — otherwise the player could resume into a freshly-
    // active arc tile that wasn't active when the text appeared. Same
    // reasoning for runTime: pause time should not count against the run.
    if (this.modBannerTimer > 0 || this.biomeCardTimer > 0) {
      if (this.modBannerTimer > 0) this.modBannerTimer -= dt;
      if (this.biomeCardTimer > 0) this.biomeCardTimer -= dt;
      if (typeof justPressed !== 'undefined' && justPressed && justPressed.size > 0) {
        this.modBannerTimer = 0;
        this.biomeCardTimer = 0;
      }
      if (this.modBannerTimer < 0) this.modBannerTimer = 0;
      if (this.biomeCardTimer <= 0) { this.biomeCardTimer = 0; this.biomeCardArea = null; }
      justPressed.clear();
      return;
    }

    this.floorTime = (this.floorTime || 0) + dt;
    this.runTime = (this.runTime || 0) + dt;

    // Expanded map modal — freeze gameplay, only handle dismiss
    if (this.mapExpanded) {
      if (jp('Tab') || jp('Escape')) this.mapExpanded = false;
      justPressed.clear();
      return;
    }
    if (jp('Tab')) { this.mapExpanded = true; justPressed.clear(); return; }

    if (this.hasPendingSystemMessage()) {
      const clickedIndicator = jp('MouseLeft') && this.hitSystemMessageIndicator(mouse.x, mouse.y);
      if (jp('KeyX') || clickedIndicator) {
        if (this.openPendingSystemMessage(true)) { justPressed.clear(); return; }
      }
    }

    player.update(dt,dungeon.map);

    // ── REAPER aggression tracking: detect player room change BEFORE the
    // enemy-update loop, so REAPERs read fresh state and Enemy.die() events
    // this frame attribute kills to the correct room. Scope: per-frame
    // single rooms.find scan (cheap — dungeon.rooms is small).
    {
      const px = player.x, py = player.y;
      let nextRoom = null;
      for (const r of dungeon.rooms) {
        if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) { nextRoom = r; break; }
      }
      if (nextRoom !== player._currentRoom) {
        player.killsInCurrentRoom = 0;
        player._currentRoom = nextRoom;
        // Re-arm any REAPERs in the room the player just entered (if any).
        // Reapers in the room they just LEFT keep _reHasFrenzied — re-entry
        // will clear it via this same code path because that room then
        // becomes the next nextRoom.
        if (nextRoom) {
          for (const e of enemies) {
            if (!e.dead && e.type === 'REAPER' && e.room === nextRoom) {
              e._reHasFrenzied = false;
            }
          }
        }
      }
    }

    const cam=getCamera(player);
    // Under the global UI-zoom architecture, mouse.x/mouse.y arrive
    // pre-normalized to logical (post-zoom) coordinates by the host
    // boundary in src/platform.js — so every screen→world conversion
    // in this update tick is a plain `(mouse + cam) / TILE` with no
    // per-zoom correction. Touch-aim synthesis below writes mouse.x/y
    // in the same logical-units space.

    // sync touch aim: synthesise a mouse position far in the joystick direction
    if (touch.aim.active) {
      mouse.down = touch.aim.shooting;
      if (touch.aim.dx !== 0 || touch.aim.dy !== 0) {
        // Player's on-canvas pixel position (logical). The world block
        // draws at (player.x*TILE - cam.x) directly — the global
        // ctx.scale(worldZoom) wrap in render() handles the upscale to
        // the canvas backing for us. The 300-px deflection radius is
        // also in logical px, which means the visible joystick "reach"
        // arc on screen scales with worldZoom (bigger physical reach
        // at higher zoom — matches the "everything bigger" intent).
        mouse.x = (player.x * TILE - cam.x) + touch.aim.dx * 300;
        mouse.y = (player.y * TILE - cam.y) + touch.aim.dy * 300;
      }
    }

    // aim with mouse (or lock to walking direction / aim assist if enabled).
    // Priority order:
    //   1. aimAssist (accessibility) — auto-target nearest visible enemy in
    //      LOS within visibility range. Falls through if no enemy found.
    //   2. lockAimToMove — project a point in front of player's last walk
    //      direction.
    //   3. Mouse — direct aim at cursor world position.
    let worldAimX, worldAimY;
    let aimAssistTarget = null;
    if (settings.aimAssist) {
      // Find nearest enemy with LOS. Mirrors auto-laser target search at
      // L1581-1590; kept inline to avoid coupling to that ability's range
      // (auto-laser uses 8 tiles; aim assist uses visibility range).
      let bestD = 16; // squared-tile range cap so distant off-screen enemies don't pull aim
      for (const e of enemies) {
        if (!e || e.dead) continue;
        if (e.type === 'PHANTOM' && !e.visible) continue;
        if (e._disguised) continue;
        if (e._wrPhased) continue;
        const ddx = e.x - player.x, ddy = e.y - player.y;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 < bestD && hasLOS(player.x, player.y, e.x, e.y, dungeon.map)) {
          bestD = d2;
          aimAssistTarget = e;
        }
      }
    }
    if (aimAssistTarget) {
      worldAimX = aimAssistTarget.x;
      worldAimY = aimAssistTarget.y;
      const [afx, afy] = norm(worldAimX - player.x, worldAimY - player.y);
      if (afx || afy) player.facing = { x: afx, y: afy };
    } else if (settings.lockAimToMove) {
      // Use last walked direction (player.facing is updated only when moving,
      // so it stays sticky when stationary). Project a point in front of player.
      worldAimX = player.x + player.facing.x * 8;
      worldAimY = player.y + player.facing.y * 8;
    } else {
      // Mouse → world tile: mouse.x/y are already in logical (post-zoom)
      // coordinates (normalised at the host boundary in platform.js),
      // so we add the cam (in world-px) and convert to tiles directly.
      worldAimX = (mouse.x + cam.x) / TILE;
      worldAimY = (mouse.y + cam.y) / TILE;
      const [afx,afy] = norm(worldAimX - player.x, worldAimY - player.y);
      if (afx || afy) player.facing = { x: afx, y: afy };
    }

    // shoot (suppressed during dash)
    if ((mouse.down||keys.has(km('shoot'))) && player.shootCooldown<=0 && player.dashTimer<=0) {
      player.shoot(worldAimX,worldAimY,dungeon.map);
    }

    // update enemies
    const _ptEnemies = perfEnabled() ? performance.now() : 0;
    for (const e of enemies) {
      tickEnemyStatusEffects(e, dt);
      tickEliteAffix(e, dt);
      e.update(dt,player,dungeon.map);
      // Bounty reveal: play sound the first time the bounty becomes visible
      if (e._isBounty && !e.dead && !e._bountyRevealed) {
        const etx = Math.floor(e.x), ety = Math.floor(e.y);
        if (dungeon.visible?.[ety]?.[etx]) {
          e._bountyRevealed = true;
          audio.bountyReveal();
          this.msg('⊕ BOUNTY TARGET SPOTTED', '#ffd700');
        }
      }
    }

    // ── Toxic Pool enemy damage ──
    if (_ptEnemies) perfRecord('enemies', performance.now() - _ptEnemies);
    for (const e of enemies) {
      if (e.dead || e._disguised) continue; // skip dead and disguised mimics
      if (e._wrPhased) continue; // phased WRAITHs are intangible
      const etx = Math.floor(e.x), ety = Math.floor(e.y);
      if (dungeon.map[ety]?.[etx] === T.TOXIC) {
        e._toxicDmgCD = (e._toxicDmgCD || 0) - dt;
        if (e._toxicDmgCD <= 0) {
          const toxDmg = Math.round((2 + this.floor * 0.5) * getDiff().envDmg * 0.5); // ×0.5 for half-second interval
          if (!e.isBoss) e.takeDamage(toxDmg, { name: 'Toxic Pool', isProc: true });
          e._toxicDmgCD = 0.5;
        }
        // Refresh slow while on toxic tile (bosses immune to slow)
        if (!e.isBoss) {
          e.slowTimer = Math.max(e.slowTimer, 0.3);
          e.slowFactor = Math.min(e.slowFactor, 0.7);
        }
      }
    }

    // decay chain lightning bolts
    if (this._chainBolts) {
      for (let i=this._chainBolts.length-1;i>=0;i--) {
        this._chainBolts[i].timer-=dt;
        if (this._chainBolts[i].timer<=0) this._chainBolts.splice(i,1);
      }
    }

    // update projectiles (compact-in-place + recycle to pool)
    const _ptProj = perfEnabled() ? performance.now() : 0;
    {
      let w = 0;
      const n = projectiles.length;
      for (let r = 0; r < n; r++) {
        const p = projectiles[r];
        p.update(dt, dungeon.map, player, enemies);
        if (p.dead) {
          releaseProjectile(p);
        } else {
          if (w !== r) projectiles[w] = p;
          w++;
        }
      }
      projectiles.length = w;
    }
    if (_ptProj) perfRecord('projectiles', performance.now() - _ptProj);

    // update hazard zones (grenade AoE)
    const _ptEnv = perfEnabled() ? performance.now() : 0;
    updateHazardZones(dt, player);

    // update volatile cores
    updateVCores(dt);

    // update alarm beacons
    updateBeacons(dt);

    // update proximity mines
    updateMines(dt);

    // update shield generators
    updateShieldGens(dt);

    // update security cameras
    updateCameras(dt);

    // update laser tripwires
    updateLasers(dt);

    // update wall turrets
    updateWallTurrets(dt);

    // update disruption fields (must run before player.update next frame for flag)
    updateDisruptionFields(dt, player);
    // update NULLIFIER jam aura (must run before player.update next frame
    // for player.hackwareJammed flag — same call-ordering rationale as
    // updateDisruptionFields above). Iterates live NULLIFIERs and sets
    // the flag based on player proximity.
    updateNullifierJam(dt, player);
    updateFrostPatches(dt, player);
    // Tick ARCHITECT-placed walls — auto-decay back to origTile after
    // ARCHITECT_DECAY_TIME. Pass dungeon.map so the helper can mutate it.
    updatePlacedWalls(dt, dungeon.map);

    // update gravity wells
    updateGravityWells(dt);

    // update items
    for (const it of items) it.update(dt);
    // Prune items that ticked themselves dead (HarvestPickup TTL expiry).
    // Plain Items / KeyItems / WhisperItems are always spliced at pickup
    // time, so their `dead` flag never goes true here — but TTL-based
    // pickups would otherwise stay in the items array, drawing forever
    // and consuming hit-test loop work. (3 reviewers caught this on the
    // HARVESTER PR — drawing-but-uncollectable ghost pickup.)
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].dead) items.splice(i, 1);
    }
    // update fuse bombs (tap-tap V) — drawn between items and enemies in
    // render loop so a planted bomb is visible above ground but obscured by
    // mobs standing on it. Dead-bomb prune handled inside.
    updateFuseShards(dt);
    if (_ptEnv) perfRecord('env', performance.now() - _ptEnv);

    // UNCHAINED #39: CORE drops (elite/boss/secret/challenge/rare-terminal).
    // Timed separately so the F3 perf HUD shows the cost.
    if (typeof NEON !== 'undefined' && NEON.cores) {
      const _ptCores = perfEnabled() ? performance.now() : 0;
      NEON.cores.updateCoreDrops(this, dt, {
        save: NEON.save || null,
        audio: (typeof audio !== 'undefined') ? audio : null,
        spawnParticles: (typeof spawnParticles === 'function') ? spawnParticles : null,
        spawnDmgText: (typeof spawnDmgText === 'function') ? spawnDmgText : null,
      });
      NEON.cores.tickHudPulse(this, dt);
      if (_ptCores) perfRecord('cores-update', performance.now() - _ptCores);
    }

    // item pickup → keys go to inventory, upgrades trigger choice UI
    for (let i=items.length-1;i>=0;i--) {
      const it=items[i];
      // Pickup-radius composition. Stacks multiplicatively with the
      // MAGNETIC_FIELD augment ("Double item pickup radius") AND the
      // MAGNETISM floor modifier (ninth positive modifier, "Item pickup
      // radius increased 50% on this floor"). Both are passive
      // multiplicative reductions, so an MAGNETISM floor with
      // MAGNETIC_FIELD yields radius × 2 × 1.5 = ×3 (0.7 → 2.1 tiles).
      // Mirrors the AUTONOMY×OVERCLOCKER pattern at content.js
      // activateHackware (PR #266). Uses this.modifier (the canonical
      // game.js floor-modifier ref) so a typo would silently disable
      // the bonus on every pickup tick.
      let pickupRadius = hasAugment('MAGNETIC_FIELD') ? 1.4 : 0.7;
      if (this.modifier === 'MAGNETISM') pickupRadius *= 1.5;
      if (!it.dead && dist(player.x,player.y,it.x,it.y)<pickupRadius) {
        if (it.isKey) {
          audio.pickup();
          items.splice(i,1);
          player.keys[it.colour]++;
          this.msg('Found '+it.colour.toUpperCase()+' KEY!', it.tileColour);
          continue;
        }
        // HARVESTER drop — applies HARVEST_SURGE (+50% damage for 8s, see
        // src/meta/boosts.js). Strict temp-only per design rule (no permanent
        // power-ups from mob drops). Auto-collected on contact like other
        // pickups; perk choice gating is irrelevant here (it's a buff, not
        // an upgrade choice). Toast colour matches the pickup's surge-orange.
        if (it.isHarvest) {
          audio.pickup();
          items.splice(i, 1);
          if (typeof NEON !== 'undefined' && NEON.boosts) {
            NEON.boosts.applyBoost(player, 'HARVEST_SURGE');
          }
          this.msg('HARVEST SURGE — +50% DMG (8s)', '#ff9933');
          continue;
        }
        // MAGPIE hoard — thief returns banked credits on death pickup.
        // The MagpieHoard.amt was set to the exact value the thief
        // banked (sum of MAGPIE_STOLEN_BASE + floor * MAGPIE_STOLEN_PERFL
        // per consumed Item) so this is always a clean refund of the
        // stolen value. Floating "+N CR" + gold flash mirrors the
        // CREDIT_CACHE pickup feedback so the player reads the recovery
        // unambiguously.
        if (it.isHoard) {
          audio.pickup();
          items.splice(i, 1);
          // SCAVENGER meta upgrade: same flat per-pickup bonus as
          // CREDIT_CACHE.fn (src/content/upgrades.js). MagpieHoard +
          // VaultCoin both flow through this branch (both flag .isHoard
          // = true), so this single wire covers all credit-item pickup
          // paths. Sanitize identically — see the CREDIT_CACHE.fn
          // comment for the corrupted-localStorage rationale.
          let bonus = (player && player.bonusCreditPerPickup) || 0;
          if (!Number.isFinite(bonus) || bonus < 0) bonus = 0;
          if (bonus > 32) bonus = 32;
          bonus = Math.floor(bonus);
          const amt = Math.max(0, Math.round(it.amt || 0)) + bonus;
          player.credits = (player.credits || 0) + amt;
          if (typeof spawnDmgText === 'function') spawnDmgText(player.x, player.y, '+' + amt + ' CR', '#ffd700');
          if (typeof spawnParticles === 'function') spawnParticles(player.x, player.y, 'EXPLOSION', '#ffd700', 12);
          this.msg('HOARD RECOVERED  +' + amt + ' CR', '#ffd700');
          continue;
        }
        // SHOCK_PULSE pickup — defensive panic-button consumable. Auto-
        // triggers on contact (mirrors HARVEST_SURGE / HOARD recovery
        // feedback shape). Discharges an AoE knockback + brief stun
        // centred on the player. NON-DAMAGING — payoff is positional
        // (panic-eject a swarm), not DPS. Detonation math + LOS gate
        // + boss carve-out live in triggerShockPulse() in entities/shock-pulse.js.
        if (it.isShockPulse) {
          items.splice(i, 1);
          const hit = (typeof triggerShockPulse === 'function') ? triggerShockPulse() : 0;
          try { audio.pickup(); } catch (_) {}
          this.msg(hit > 0 ? ('SHOCK PULSE — ' + hit + ' STUNNED') : 'SHOCK PULSE', '#66e0ff');
          continue;
        }
        if (it.isWhisper) {
          // Whispers subplot — picking up shows the body in a READING overlay
          // so the discovery + reading moment feels earned (per stored
          // 'game design' memory). The whisper is also marked found+read in
          // save state so the ARCHIVE WHISPERS counter increments and the
          // player can re-visit later via ARCHIVE > WHISPERS section
          // (UI list ships in a follow-up). audio.logRead reused.
          items.splice(i, 1);
          let title = 'WHISPER';
          let body = '';
          let voice = '';
          try {
            if (typeof NEON !== 'undefined' && NEON.whispers) {
              const w = NEON.whispers.findWhisper(it.whisperId) ||
                        NEON.whispers.whisperById(it.whisperId);
              NEON.whispers.readWhisper(it.whisperId);
              if (w) {
                title = String(w.title || title);
                body  = String(w.body  || '');
                voice = String(w.voice || '');
              }
            }
          } catch (_) { /* meta unavailable; just toast generic */ }
          try { audio.logRead(); } catch (_) {}
          this.msg('★ WHISPER · ' + title, '#cc99ee');
          if (typeof NEON !== 'undefined' && NEON.telemetry) {
            NEON.telemetry.track('whisper_found', { id: it.whisperId, floor: this.floor });
          }
          // Show the reading overlay. _whisperMeta drives renderReading's
          // violet styling branch; clearing currentLore is safe because the
          // amber DATA TERMINAL path won't trigger when _whisperMeta is set.
          if (body) {
            this.currentLore = body;
            this._whisperMeta = { title, voice };
            this.readingInteractArmed = false;
            this.setState('READING');
            return;
          }
          continue;
        }
        if (it.isWeaponCache) {
          items.splice(i, 1);
          try { audio.pickup(); } catch (_) {}
          this.collectWeaponCache(it.weapon);
          return;
        }
        // Defer upgrade pickup if a perk/augment choice is pending
        if (this.pendingPerkChoices.length || this.perkChoice || this.augmentChoice) continue;
        audio.pickup();
        items.splice(i,1);
        // Generate 2 upgrade options
        const optA = pickUpgradeOption(null);
        const optB = pickUpgradeOption(optA.id);
        // Auto-collect simple consumables (health/XP/shard) to reduce popup fatigue.
        /**
         * @param {any} o
         */
        const _isSimple = o => !o.persistent && !o.id.startsWith('WEAPON_') && !o.id.startsWith('HACKWARE_');
        // Auto-collect weapons into belt if space available.
        /**
         * @param {any} o
         */
        const _isAutoWeapon = o => o.id.startsWith('WEAPON_') && o._weaponObj && player.weapons && player.weapons.length < 3;
        if (_isSimple(optA) && _isSimple(optB)) {
          const needsHp = player.hp < player.maxHp;
          const aIsHeal = optA.id === 'MED_PACK' || optA.id === 'NANO_REPAIR';
          const bIsHeal = optB.id === 'MED_PACK' || optB.id === 'NANO_REPAIR';
          // Heal-priority when wounded: prefer the heal option.
          // Waste-avoidance when full HP: prefer the non-heal option (a heal
          // at max HP heals nothing, so the boost/currency/XP is strictly
          // better). Default: keep optA.
          let pick = optA;
          if (needsHp && bIsHeal && !aIsHeal) pick = optB;
          else if (!needsHp && aIsHeal && !bIsHeal) pick = optB;
          pick.fn(player);
          this.msg(pick.name, pick.colour);
          if (typeof NEON !== 'undefined' && NEON.telemetry) NEON.telemetry.track('auto_collect', { item: pick.id, floor: this.floor });
          continue;
        }
        // Auto-collect weapon if belt has space (prefer weapon option for belt, apply other)
        if (_isAutoWeapon(optA) && _isSimple(optB)) {
          optA.fn(player); optB.fn(player);
          this.msg(optA.name + ' + ' + optB.name, optA.colour);
          continue;
        }
        if (_isAutoWeapon(optB) && _isSimple(optA)) {
          optB.fn(player); optA.fn(player);
          this.msg(optB.name + ' + ' + optA.name, optB.colour);
          continue;
        }
        this.powerupChoice = { options:[optA, optB], selected:0, _arm: 0.4 };
        this.setState('POWERUP_CHOICE');
        return;
      }
    }

    // remove dead enemies
    for (let i=enemies.length-1;i>=0;i--) {
      if (enemies[i].dead) enemies.splice(i,1);
    }

    // flush deferred enemy spawns (e.g. SPLITTER → SHARDs, SUMMONER → DRONEs,
    // GHOST_PROJECTOR → ghosts)
    if (pendingEnemySpawns.length) {
      for (const s of pendingEnemySpawns) {
        // Skip orphan summons whose summoner died this frame
        if (s._summoned && (!s._summonerRef || s._summonerRef.dead)) continue;
        // Skip orphan ghosts whose projector died this frame — the haunt
        // dies with its source. Avoids spectral ghosts wandering after
        // their projector is gone (would also be unfair: the player
        // pre-empted the projector but still got a ghost).
        if (s._ghIsGhost && (!s._ghOwnerProjector || s._ghOwnerProjector.dead)) continue;
        const e = spawnEnemy(s.type, s.x, s.y, s.floor, s.room, false);
        if (s._challengeWave) e._challengeWave = true;
        if (s._summoned && s._summonerRef) {
          e._summoned = true;
          e._summonerRef = s._summonerRef;
          e.xpValue = 0; // no XP farming from summons
          s._summonerRef._summons.push(e);
        }
        if (s._ghIsGhost) {
          // Apply ghost mutations after a real spawnEnemy build so AI/
          // collision/draw paths all work with normal enemy state.
          e._ghIsGhost = true;
          e._ghLife = GHOST_PROJECTOR_GHOST_LIFE;
          e.hp = Math.max(1, Math.round(e.hp * GHOST_PROJECTOR_HP_MUL));
          e.maxHp = e.hp;
          e.atk = Math.max(1, Math.round(e.atk * GHOST_PROJECTOR_ATK_MUL));
          e.xpValue = 0; // no XP from ghost kills
          // Atomically clear the projector's pending state AND back-assign
          // the live ghost ref. Done together (and only here) so the
          // notifyGhostProjectors busy-skip stays valid across the
          // queue→flush window via the _gpAwaitingFlush sentinel.
          const proj = s._ghOwnerProjector;
          proj._gpActiveGhost = e;
          proj._gpPendingType = null;
          proj._gpPendingDelay = 0;
          proj._gpAwaitingFlush = false;
        }
        enemies.push(e);
      }
      pendingEnemySpawns.length = 0;
    }

    // room-clear rewards — only scan when an enemy died this frame
    if (this.enemyDiedThisFrame && this.clearedRooms) {
      this.enemyDiedThisFrame = false;
      let clears = 0;
      for (const room of dungeon.rooms) {
        if (!room._hadEnemies || this.clearedRooms.has(room)) continue;
        if (room === dungeon.bossRoom || room === dungeon.spawnRoom) continue;
        if (room.roomType === 'challenge' && !room.challengeComplete) continue;
        let hasLiveEnemy = false;
        for (const e of enemiesInRoomIter(room)) {
          if (!e.dead && !e._disguised) { hasLiveEnemy = true; break; }
        }
        if (hasLiveEnemy) continue;
        // Block room-clear until alarm beacons are resolved
        if (beacons.some(b => !b.dead && b.room === room)) continue;
        // Block room-clear while a camera is actively alerted
        if (cameras.some(c => !c.dead && c.state === 'alerted' && c.room === room)) continue;
        // Block room-clear until hostile wall turrets are destroyed or hacked
        if (wallTurrets.some(wt => !wt.dead && !wt.hacked && wt.room === room)) continue;
        this.clearedRooms.add(room);
        clears++;
        const d = getDiff();
        let cr = Math.round((10 + this.floor * 5) * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        // UNCHAINED #37 AMMO_RECLAIMER module: chance to double credits.
        if (player.metaFlags && player.metaFlags.doubleCreditChance > 0 && rand('loot') < player.metaFlags.doubleCreditChance) {
          cr *= 2;
        }
        player.credits += cr;
        player.score += 50 * this.floor;
        player.roomsCleared++;
        spawnParticles(room.cx, room.cy, 'EXPLOSION', '#39ff14', 15);
        spawnDmgText(room.cx, room.cy, '+' + cr + '◆', '#39ff14');
      }
      if (clears > 0) {
        audio.roomClear();
        this.msg(clears > 1 ? clears + ' ROOMS CLEARED!' : 'ROOM CLEARED!', '#39ff14');
      }
    } else {
      this.enemyDiedThisFrame = false;
    }

    if (this.openPendingSystemMessage(false)) { justPressed.clear(); return; }

    // update lighting
    const _ptLight = perfEnabled() ? performance.now() : 0;
    updateLighting(dungeon,player.x,player.y);
    if (_ptLight) perfRecord('lighting', performance.now() - _ptLight);
    const _ptPart = perfEnabled() ? performance.now() : 0;
    updateParticles(dt);
    updateFloatingTexts(dt);
    if (_ptPart) perfRecord('particles', performance.now() - _ptPart);
    const _ptAmb = perfEnabled() ? performance.now() : 0;
    updateAmbient(dt);
    if (_ptAmb) perfRecord('biome-ambient', performance.now() - _ptAmb);
    updateShake(dt);
    updateCombo(dt);
    updateHackwareEffects(dt);
    // NOTE: modBannerTimer / biomeCardTimer are ticked in the level-text
    // pause block at the top of updatePlaying (early-return). When this
    // line runs, both timers are guaranteed to be 0 — leaving the
    // bookkeeping nulls in place defensively.
    if (this.modBannerTimer < 0) this.modBannerTimer = 0;
    if (this.biomeCardTimer <= 0) { this.biomeCardTimer = 0; this.biomeCardArea = null; }
    if (this.teleportCooldown > 0) this.teleportCooldown -= dt;

    // ── Upgrade effects ──────────────────────────────────────────────────
    // Nano Regen
    const regenLvl = player.upgrades.NANO_REGEN||0;
    if (regenLvl > 0) player.hp = Math.min(player.maxHp, player.hp + regenLvl * dt);

    // Saw Blade orbitals
    const sawLvl = player.upgrades.SAW_BLADE||0;
    if (sawLvl > 0) {
      player.orbitalAngle += 3 * dt;
      // Tick down hit cooldowns
      for (const [e, cd] of player.orbitalHits) {
        player.orbitalHits.set(e, cd - dt);
        if (cd - dt <= 0) player.orbitalHits.delete(e);
      }
      for (let i=0; i<sawLvl; i++) {
        const a = player.orbitalAngle + (TWO_PI / sawLvl) * i;
        const bx = player.x + Math.cos(a) * 1.5;
        const by = player.y + Math.sin(a) * 1.5;
        for (const e of enemies) {
          if (e.dead || player.orbitalHits.has(e)) continue;
          if (e._wrPhased) continue;
          if (dist(bx, by, e.x, e.y) < 0.6 && hasLOS(bx, by, e.x, e.y, dungeon.map)) {
            e.takeDamage(12, 'Saw Blade');
            player.orbitalHits.set(e, 0.5);
            spawnParticles(bx, by, 'SPARK', '#ff3333', 3);
          }
        }
      }
    }

    // Plasma Orb auto-spell
    const orbLvl = player.upgrades.PLASMA_ORB||0;
    if (orbLvl > 0) {
      const cd = 3 - (orbLvl - 1) * 0.7;
      player.spellTimers.plasmaOrb -= dt;
      if (player.spellTimers.plasmaOrb <= 0) {
        player.spellTimers.plasmaOrb = cd;
        // Find nearest enemy
        let nearest = null, nearD = 64;
        for (const e of enemies) {
          if (e.dead) continue;
          if (e._disguised) continue;
          if (e._wrPhased) continue;
          const d = dist(player.x, player.y, e.x, e.y);
          if (d < nearD) { nearD = d; nearest = e; }
        }
        if (nearest) {
          const [dx, dy] = norm(nearest.x - player.x, nearest.y - player.y);
          const p = new Projectile(player.x, player.y, dx, dy, 6, 25, 10, '#ff44cc', false, true, 'Plasma Orb');
          if (player.perks.PIERCING_ROUNDS) p.maxPierces+=1;
          p.homing = nearest;
          projectiles.push(p);
          spawnParticles(player.x, player.y, 'MUZZLE', '#ff44cc', 3);
        }
      }
    }

    // Sentry Drone — orbiting auto-fire drones
    const droneLvl = player.upgrades.SENTRY_DRONE||0;
    if (droneLvl > 0) {
      player.droneAngle += 1.8 * dt;
      const droneCd = 2.0 - (droneLvl - 1) * 0.4;
      player.spellTimers.sentryDrone -= dt;
      if (player.spellTimers.sentryDrone <= 0) {
        player.spellTimers.sentryDrone = droneCd;
        // Each drone picks the nearest visible enemy and fires
        for (let i = 0; i < droneLvl; i++) {
          const a = player.droneAngle + (TWO_PI / droneLvl) * i;
          const droneX = player.x + Math.cos(a) * 2.0;
          const droneY = player.y + Math.sin(a) * 2.0;
          let nearest = null, nearD = 8;
          for (const e of enemies) {
            if (e.dead) continue;
            if (e.type === 'PHANTOM' && !e.visible) continue;
            if (e._disguised) continue;
            if (e._wrPhased) continue;
            const d = dist(droneX, droneY, e.x, e.y);
            if (d < nearD && hasLOS(droneX, droneY, e.x, e.y, dungeon.map)) {
              nearD = d; nearest = e;
            }
          }
          if (nearest) {
            const [sdx, sdy] = norm(nearest.x - droneX, nearest.y - droneY);
            const sp = new Projectile(droneX, droneY, sdx, sdy, 8, 8, 8, '#00e5ff', false, true, 'Sentry Drone');
            sp.homing = nearest;
            projectiles.push(sp);
            spawnParticles(droneX, droneY, 'MUZZLE', '#00e5ff', 2);
            audio.sentryFire();
          }
        }
      }
    }

    // Auto-Laser perk — hitscan beam at nearest visible enemy
    if (player.perks.AUTO_LASER && player.hp > 0) {
      if (player.autoLaserBeam) {
        player.autoLaserBeam.timer -= dt;
        if (player.autoLaserBeam.timer <= 0) player.autoLaserBeam = null;
      }
      player.autoLaserTimer -= dt;
      if (player.autoLaserTimer <= 0) {
        let target = null, minD = 12;
        for (const e of enemies) {
          if (e.dead) continue;
          if (e.type === 'PHANTOM' && !e.visible) continue;
          if (e._disguised) continue;
          if (e._wrPhased) continue;
          const d = dist(player.x, player.y, e.x, e.y);
          if (d <= minD && hasLOS(player.x, player.y, e.x, e.y, dungeon.map)) {
            minD = d; target = e;
          }
        }
        if (target) {
          player.autoLaserTimer = 2.5;
          target.takeDamage(20, 'Auto-Laser');
          player.autoLaserBeam = {x1:player.x, y1:player.y, x2:target.x, y2:target.y, timer:0.15};
          spawnParticles(target.x, target.y, 'SPARK', '#ff2222', 5);
          audio.autoLaser();
        }
      }
    }


    // stairs / lore terminal interaction
    const tx=Math.floor(player.x), ty=Math.floor(player.y);
    const tile=dungeon.map[ty]?.[tx];

    if (tile===T.LORE) {
      if (jp(km('interact'))) {
        const idx = pickLoreEntryIndex(player.loreRead, this.floor, () => rand('event'));
        player.loreRead.add(idx);
        this.currentLore = LORE_ENTRIES[idx] ?? null;
        player.score += 50;
        this.msg('+50 DATA RECOVERED', '#ffb700');
        // Consume the terminal — single use
        dungeon.map[ty][tx] = T.FLOOR;
        this.markMapMutated();
        audio.loreAccess();
        spawnParticles(player.x, player.y, 'SPARK', '#ffb700', 8);
        this.readingInteractArmed = false;
        this.setState('READING');
        return;
      }
      this.hint={text: isTouchDevice() ? 'Tap '+KEY_DISPLAY(km('interact'))+' to access data terminal' : 'Press '+KEY_DISPLAY(km('interact'))+' to access data terminal',colour:'#ffb700'};
    }

    if (tile===T.MAINFRAME_READER) {
      if (this.bossAlive) {
        this.hint={text:'MAINFRAME archive locked — destroy GENESIS first',colour:'#ff3333'};
      } else if (jp(km('interact'))) {
        this.openMainframeReader();
        return;
      } else {
        this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to open MAINFRAME archive',colour:'#66ffcc'};
      }
    }

    if (tile===T.NETWORK_PORTAL) {
      if (this.bossAlive) {
        this.hint={text:'NETWORK relay sealed — destroy GENESIS first',colour:'#ff3333'};
      } else {
        this.hint={text:'NETWORK relay stabilized — archive records explain the route',colour:'#88ccff'};
      }
    }

    if (tile===T.MESSAGE_CONSOLE) {
      const mf = this.mainframeFinale;
      if (this.bossAlive) {
        this.hint={text:'MESSAGE console locked — destroy GENESIS first',colour:'#ff3333'};
      } else if (mf && mf.addressRevealed) {
        if (jp(km('interact'))) {
          this.openMainframeMessageSend();
          return;
        }
        this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to compose outbound message',colour:'#ff66cc'};
      } else {
        if (jp(km('interact'))) this.msg('READ CONTACT-ADDRESS RECORD FIRST', '#66ffcc');
        this.hint={text:'SEND console awaiting destination record',colour:'#ff66cc'};
      }
    }

    // teleport pad interaction
    if (tile===T.TELEPORT_PAD) {
      const pads = dungeon.teleportPads || [];
      let paired = null;
      for (const p of pads) {
        if (p.x1===tx && p.y1===ty) { paired = { x:p.x2, y:p.y2 }; break; }
        if (p.x2===tx && p.y2===ty) { paired = { x:p.x1, y:p.y1 }; break; }
      }
      if (paired) {
        // Check if destination is in a sealed boss/challenge room
        const destSealed = (this.bossSealed && this.bossRoom &&
          paired.x >= this.bossRoom.x && paired.x < this.bossRoom.x + this.bossRoom.w &&
          paired.y >= this.bossRoom.y && paired.y < this.bossRoom.y + this.bossRoom.h) ||
          (this.challengeSealed && this.challengeRoom &&
          paired.x >= this.challengeRoom.x && paired.x < this.challengeRoom.x + this.challengeRoom.w &&
          paired.y >= this.challengeRoom.y && paired.y < this.challengeRoom.y + this.challengeRoom.h);
        // Also block if source is in a sealed room (no escaping)
        const srcSealed = (this.bossSealed && this.bossRoom &&
          player.x >= this.bossRoom.x && player.x < this.bossRoom.x + this.bossRoom.w &&
          player.y >= this.bossRoom.y && player.y < this.bossRoom.y + this.bossRoom.h) ||
          (this.challengeSealed && this.challengeRoom &&
          player.x >= this.challengeRoom.x && player.x < this.challengeRoom.x + this.challengeRoom.w &&
          player.y >= this.challengeRoom.y && player.y < this.challengeRoom.y + this.challengeRoom.h);

        if (srcSealed || destSealed) {
          this.hint={text:'Warp pad disabled — room sealed',colour:'#ff3333'};
        } else if (this.teleportCooldown > 0) {
          this.hint={text:'Warp recharging... '+Math.ceil(this.teleportCooldown)+'s',colour:'#8844aa'};
        } else {
          if (jp(km('interact'))) {
            spawnParticles(player.x, player.y, 'SPARK', '#bb44ff', 15);
            player.x = paired.x + 0.5;
            player.y = paired.y + 0.5;
            spawnParticles(player.x, player.y, 'SPARK', '#bb44ff', 15);
            player.invincibleTimer = Math.max(player.invincibleTimer, 0.3);
            this.teleportCooldown = 3;
            audio.teleportPad();
            this.msg('WARPED','#bb44ff');
          }
          this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to warp',colour:'#bb44ff'};
        }
      }
    }

    const _finalFloorInteract = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.finalFloor) ? NEON.biomes.finalFloor() : 15;
    const finalCoreTerminal = tile===T.TERMINAL && this.floor >= _finalFloorInteract;
    const bossBlocking = tile===T.TERMINAL && this.bossAlive;
    if ((tile===T.STAIRS||tile===T.TERMINAL) && !bossBlocking && jp(km('interact'))) {
      if (finalCoreTerminal) this.openMainframeReader();
      else this.descend();
    }
    if (tile===T.STAIRS) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to descend',colour:'#ffff00'};
    if (tile===T.TERMINAL && bossBlocking) {
      const bossLabel = BOSS_NAMES[this.bossType] || 'the boss';
      this.hint={text:'CORE terminal locked — destroy ' + bossLabel + ' first',colour:'#ff3333'};
    }
    if (tile===T.TERMINAL && !bossBlocking) {
      this.hint={text: finalCoreTerminal ? 'Press '+KEY_DISPLAY(km('interact'))+' to open MAINFRAME route' : 'Press '+KEY_DISPLAY(km('interact'))+' to interface with CORE terminal',colour:'#00f5ff'};
    }

    // door interaction (check adjacent tiles when pressing E)
    if (jp(km('interact'))) {
      const dirs = /** @type {[number,number][]} */ ([[0,-1],[0,1],[-1,0],[1,0]]);
      for (const [ddx,ddy] of dirs) {
        const dx=tx+ddx, dy=ty+ddy;
        if (dx<0||dy<0||dx>=MAP_W||dy>=MAP_H) continue;
        const dt=dungeon.map[dy][dx];
        if (dt===T.CRACKED) {
          dungeon.map[dy][dx]=T.FLOOR;
          this.markMapMutated();
          audio.wallBreak();
          spawnParticles(dx+0.5, dy+0.5, 'EXPLOSION', '#ffb700', 12);
          this.msg('SECRET AREA DISCOVERED','#ffb700');
          // Reveal the secret room — cracked tile is on room boundary
          for (const sr of dungeon.secretRooms) {
            if (sr.secretRevealed) continue;
            // Cracked tile is on room edge or 1 tile outside it
            if (dx >= sr.x-1 && dx <= sr.x+sr.w && dy >= sr.y-1 && dy <= sr.y+sr.h) {
              this.revealSecretRoom(sr);
              break;
            }
          }
          break;
        }
        if (dt===T.DOOR) {
          dungeon.map[dy][dx]=T.DOOR_OPEN;
          this.markMapMutated();
          this.msg('Door opened','#aa8844');
          spawnParticles(dx+0.5, dy+0.5, 'SPARK', '#aa8844', 4);
          break;
        }
        if (isDoor(dt)) {
          const kc=doorKeyColour(dt);
          if (kc && player.keys[kc] > 0) {
            dungeon.map[dy][dx]=T.DOOR_OPEN;
            this.markMapMutated();
            this.msg('Unlocked '+kc+' door!', dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00');
            spawnParticles(dx+0.5, dy+0.5, 'EXPLOSION', dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00', 8);
            break;
          } else if (kc) {
            this.msg('Need '+kc.toUpperCase()+' KEY', dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00');
          }
        }
      }
    }
    // door / cracked wall prompt
    const dirs = /** @type {[number,number][]} */ ([[0,-1],[0,1],[-1,0],[1,0]]);
    for (const [ddx,ddy] of dirs) {
      const dx=tx+ddx, dy=ty+ddy;
      if (dx<0||dy<0||dx>=MAP_W||dy>=MAP_H) continue;
      const dt=dungeon.map[dy][dx];
      if (dt===T.CRACKED) { this.hint={text:'Faint cracks... (press '+KEY_DISPLAY(km('interact'))+')',colour:'#ffb700'}; break; }
      if (dt===T.DOOR) { this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to open door',colour:'#aa8844'}; break; }
      if (isDoor(dt)) {
        const kc=doorKeyColour(dt);
        const colour = dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00';
        if (kc && player.keys[kc] > 0) {
          this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to unlock '+kc.toUpperCase()+' door', colour};
        } else if (kc) {
          this.hint={text:'Need '+kc.toUpperCase()+' KEY (press '+KEY_DISPLAY(km('interact'))+')', colour};
        }
        break;
      }
      if (dt===T.CHALLENGE_GATE && !game.challengeComplete) { this.hint={text:'⚔ CHALLENGE ROOM — enter at your own risk',colour:'#ff6633'}; break; }
    }

    // trap triggering
    player.trapCooldown = Math.max(0, player.trapCooldown - dt);
    if (player.trapCooldown <= 0) {
      if (tile===T.TRAP_SPIKE) {
        const trapDmg = Math.round((8 + game.floor * 2) * getDiff().envDmg);
        player.takeDamage(trapDmg, 'Spike Trap');
        player.trapCooldown = 1.0;
        this.msg('Spike trap! -'+trapDmg+' HP','#ff6644');
        spawnParticles(player.x, player.y, 'SPARK', '#ff6644', 5);
      } else if (tile===T.TRAP_SLOW) {
        player.speedBoost = -1.5;
        player.speedTimer = 3;
        player.trapCooldown = 3.0;
        this.msg('Slow trap!','#8866ff');
        spawnParticles(player.x, player.y, 'SPARK', '#8866ff', 4);
      } else if (tile===T.REPULSOR && !isPlayerDamageImmune()) {
        // REPULSOR_TILE: positional hazard — boots the player back in the
        // direction they ENTERED FROM. NO HP damage; the cost is positional
        // commitment + the routing detour.
        //
        // Direction source: OPPOSITE of the player's movement delta this
        // frame. player._prevX / _prevY are captured at the start of
        // Player.update (entities.js:12845) BEFORE any movement, so by the
        // time this trap-trigger runs, (player.x - player._prevX,
        // player.y - player._prevY) is the actual movement vector for the
        // frame. Negating it gives the way they CAME — the natural "push
        // back" direction.
        //
        // Why not player.facing? Codex r1 caught it: player.facing is
        // overwritten EVERY frame by the aim-assist + mouse-aim handlers
        // (game.js:1531/1544). It's an aim vector, not a movement vector.
        // Knockback derived from facing pushes opposite to AIM — a player
        // shooting at an enemy across the room would get launched INTO
        // the enemy on stepping on a repulsor.
        //
        // Why not (player.x - tileCentre)? Codex r2 caught it: on a frame
        // hitch (large dt), the player can move past the tile centre in a
        // single step, flipping the centre-relative offset and pushing
        // them DEEPER instead of back. Movement-delta is hitch-stable.
        //
        // Fallback chain handles the degenerate "no movement this frame"
        // case (gravity-well-cancellation, collision-zeroed entries, etc.):
        // tile-centre delta first (still useful when player nudged onto
        // tile by a non-movement source), then opposite-of-facing as a
        // last-resort best guess.
        //
        // PUSH = 0.95 (≤ 1.0): displacement strictly less than one tile.
        // This bounds the per-axis isPassable check to ADJACENT cells only,
        // making tunnel-through-wall impossible — codex r2 caught that
        // PUSH > 1.0 with endpoint-only checks lets the player skip a
        // 1-tile-wide wall when destination cell happens to be passable.
        // 0.95 still reads as a kick (player visibly leaves the tile) but
        // keeps the swept check trivial and correct.
        //
        // Wall-aware swept knockback: per-axis isPassable check (mirrors
        // CHARGER mob convention at entities.js:6062) PLUS a combined
        // diagonal-cell check (codex r1: per-axis individually passable +
        // diagonal cell wall = corner-wedge clip). When the diagonal cell
        // is blocked but one axis is passable, slide along the wall on
        // that axis only — never commit a write that lands in a wall.
        // Damage-immune frames bypass — matches PLASMA/ARC/TOXIC/SHOCK.
        // trapCooldown 1.2s prevents adjacent-repulsor ping-pong.
        //
        // BRANCH ORDERING: this branch must precede the T.SHOCK_TILE branch
        // because tests/shock-tile.test.js extracts the SHOCK_TILE body via
        // a non-greedy regex (`[\s\S]*?\}\s*\n`) that requires SHOCK_TILE
        // to be the LAST branch in the chain (`} else if` doesn't match
        // `\}\s*\n`, so the regex would walk PAST any subsequent branch).
        // Behaviour is identical regardless of order — trapCooldown gates
        // single-fire per re-entry. Pinned by the structural test
        // 'REPULSOR branch precedes SHOCK_TILE branch' so a future reorder
        // can't silently break shock-tile.test.js.
        let kxr = (player._prevX !== undefined ? player._prevX : player.x) - player.x;
        let kyr = (player._prevY !== undefined ? player._prevY : player.y) - player.y;
        if (Math.abs(kxr) < 0.001 && Math.abs(kyr) < 0.001) {
          kxr = player.x - (tx + 0.5);
          kyr = player.y - (ty + 0.5);
        }
        if (Math.abs(kxr) < 0.001 && Math.abs(kyr) < 0.001) {
          const fxr = (player.facing && player.facing.x) || 0;
          const fyr = (player.facing && player.facing.y) || 0;
          kxr = -fxr; kyr = -fyr;
          if (kxr === 0 && kyr === 0) { kxr = -1; kyr = 0; }
        }
        const klen = Math.hypot(kxr, kyr) || 1;
        kxr /= klen; kyr /= klen;
        const PUSH = 0.95;
        const nxr = player.x + kxr * PUSH, nyr = player.y + kyr * PUSH;
        const fxK = Math.floor(nxr), fyK = Math.floor(player.y);
        const xfK = Math.floor(player.x), yfK = Math.floor(nyr);
        const dxK = Math.floor(nxr), dyK = Math.floor(nyr);
        const map = this.dungeon.map;
        const canX = fxK >= 0 && fxK < MAP_W && fyK >= 0 && fyK < MAP_H && isPassable(map[fyK][fxK]);
        const canY = xfK >= 0 && xfK < MAP_W && yfK >= 0 && yfK < MAP_H && isPassable(map[yfK][xfK]);
        const canDiag = dxK >= 0 && dxK < MAP_W && dyK >= 0 && dyK < MAP_H && isPassable(map[dyK][dxK]);
        if (canX && canY && canDiag) { player.x = nxr; player.y = nyr; }
        else if (canX) { player.x = nxr; }
        else if (canY) { player.y = nyr; }
        player.trapCooldown = 1.2;
        this.msg('Repulsor!','#44ddff');
        spawnParticles(player.x, player.y, 'SPARK', '#44ddff', 6);
        audio.repulsor();
      } else if (tile===T.SHOCK_TILE && !isPlayerDamageImmune()) {
        // SHOCK_TILE: brief movement-suppress hazard. Reuses the existing
        // player.shockTimer primitive (already wired in entities.js to zero
        // movement input but leave aim+shoot intact, mirroring the SHOCKER
        // mob). 0.5s lockdown is short enough to be fair on mobile yet long
        // enough to commit the player to defending in place. trapCooldown
        // 1.5s prevents standing-on-it from looping the freeze. Damage-
        // immune frames (dash i-frames, cloak, etc.) bypass — matches
        // PLASMA/ARC/TOXIC convention so dash-through-hazard reads
        // consistently.
        player.shockTimer = Math.max(player.shockTimer || 0, 0.5);
        player.trapCooldown = 1.5;
        this.msg('Shock tile!','#ffee44');
        spawnParticles(player.x, player.y, 'SPARK', '#ffee44', 5);
        audio.shockTile();
      }
    }

    // environmental hazards (separate from traps — own cooldowns, bypass armor)
    if (tile === T.PLASMA && !isPlayerDamageImmune()) {
      // Continuous burn: bypasses defense and hit i-frames, but still respects shield/SECOND_WIND.
      // BIOFILTER augment halves env-tile damage (status-resistance niche).
      const bioMul = hasAugment('BIOFILTER') ? 0.5 : 1;
      const burnDps = (3 + this.floor) * getDiff().envDmg * bioMul;
      player.takeDamage(burnDps * dt, 'Plasma', {
        ignoreInvincible: true,
        ignoreDefense: true,
        skipHitInvincible: true,
        skipHitEffects: true,
        skipReactiveArmor: true,
      });
      player.plasmaBurnTimer = Math.max(0, player.plasmaBurnTimer - dt);
      if (player.plasmaBurnTimer <= 0) {
        const dmgShown = Math.round(burnDps);
        this.msg('Plasma burn! -'+dmgShown+'/s','#ff6600');
        spawnParticles(player.x, player.y, 'SPARK', '#ff8800', 3);
        audio.plasmaBurn();
        player.plasmaBurnTimer = 0.5;
      }
    }
    player.arcCooldown = Math.max(0, player.arcCooldown - dt);
    if (tile === T.ARC && !isPlayerDamageImmune() && Math.sin((this.floorTime||0) * Math.PI) > 0 && player.arcCooldown <= 0) {
      // Periodic zap during active phase
      const zapDmg = Math.round((10 + this.floor * 2) * getDiff().envDmg * (hasAugment('BIOFILTER') ? 0.5 : 1));
      player.takeDamage(zapDmg, 'Arc Grid', {
        ignoreInvincible: true,
        ignoreDefense: true,
        skipHitInvincible: true,
        skipHitEffects: true,
        skipReactiveArmor: true,
      });
      player.arcCooldown = 0.8;
      player.flashTimer = 0.15;
      this.msg('Arc zap! -'+zapDmg+' HP','#44ccff');
      spawnParticles(player.x, player.y, 'SPARK', '#88eeff', 6);
      audio.arcZap();
    }

    // ── Toxic Pool (damages player + slows) ──
    if (tile === T.TOXIC && !isPlayerDamageImmune()) {
      const toxDps = (2 + this.floor * 0.5) * getDiff().envDmg * (hasAugment('BIOFILTER') ? 0.5 : 1);
      player.takeDamage(toxDps * dt, 'Toxic Pool', {
        ignoreInvincible: true,
        ignoreDefense: true,
        skipHitInvincible: true,
        skipHitEffects: true,
        skipReactiveArmor: true,
      });
      player.toxicBurnTimer = Math.max(0, player.toxicBurnTimer - dt);
      if (player.toxicBurnTimer <= 0) {
        const dmgShown = Math.round(toxDps);
        this.msg('Toxic! -'+dmgShown+'/s','#33ff00');
        spawnParticles(player.x, player.y, 'SPARK', '#44ff22', 3);
        audio.toxicBurn();
        player.toxicBurnTimer = 0.5;
      }
      // Slow player while in pool (30% reduction via flag, read in Player.update)
      player.toxicSlowActive = true;
    } else {
      player.toxicSlowActive = false;
    }

    // special room effects
    for (const r of dungeon.rooms) {
      if (r.healFont && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
        if (player.hp < player.maxHp) {
          player.hp = Math.min(player.maxHp, player.hp + 5 * dt);
          if (rand('cosmetic')<0.1) spawnParticles(player.x, player.y, 'SPARK', '#00ff88', 1);
        }
      }
      if (r.xpShrine && !r.shrineUsed && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
        if (dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<1.5 && jp(km('interact'))) {
          r.shrineUsed = true;
          const xp = 30 + game.floor * 10;
          player.gainXP(xp);
          this.msg('XP Shrine: +'+xp+' XP!','#aa00ff');
          spawnParticles(r.cx+0.5, r.cy+0.5, 'EXPLOSION', '#aa00ff', 15);
        }
        if (!r.shrineUsed && dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<2) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' at shrine',colour:'#aa00ff'};
      }
      // Implant shrine interaction
      if (r.roomType === 'implant' && !r.implantUsed && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
        if (dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<1.5 && jp(km('interact'))) {
          r.implantUsed = true;
          const slots = Object.keys(player.augments).length;
          if (slots >= MAX_AUGMENTS) {
            // Capped: give credits instead
            const cr = 50 + game.floor * 15;
            const siphon = hasAugment('CREDIT_SIPHON') ? 1.5 : 1;
            player.credits += Math.round(cr * siphon);
            this.msg('AUGMENT SLOTS FULL — +' + Math.round(cr * siphon) + ' CR', '#cc44ff');
            spawnParticles(r.cx+0.5, r.cy+0.5, 'EXPLOSION', '#cc44ff', 12);
          } else {
            const opts = rollAugmentChoices(player, 2);
            if (opts.length === 0) {
              this.msg('ALL AUGMENTS OWNED', '#cc44ff');
            } else {
              this.augmentChoice = { options: opts, selected: 0, room: r, _arm: 0.4 };
              this.setState('AUGMENT_CHOICE');
              audio.augmentChoice();
            }
          }
        }
        if (!r.implantUsed && dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<2.5) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' at implant shrine',colour:'#cc44ff'};
      }
      // Event terminal interaction
      if (r.roomType === 'event' && !r.eventUsed && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
        if (dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<1.5 && jp(km('interact'))) {
          r.eventUsed = true;
          const ev = rollEvent(player, this.floor);
          this.eventChoice = { event: ev, selected: 0, room: r };
          this.setState('EVENT_CHOICE');
          audio.eventTerminal();
        }
        if (!r.eventUsed && dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<2.5) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' at terminal',colour:'#44ffcc'};
      }
      /**
       * @param {any} i
       */
      if (r.shopItems && r.shopItems.some((/** @type {any} */ i) => !i.sold) && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
        if (dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<1.5 && jp(km('interact'))) {
          // Revalidate shop items (maxed upgrades, stale prices, unneeded keys, owned/capped augments)
          for (const si of r.shopItems) {
            if (si.sold) continue;
            if (si.persistent && player.upgrades[si.id] >= si.maxLevel) { si.sold = true; continue; }
            // Recalculate price for persistent upgrades (level may have changed)
            if (si.persistent && SHOP_PRICES[si.id]) si.price = shopPrice(si.id, this.floor, player.upgrades);
            // Mark key items as sold if player already has that colour
            if (si.id && si.id.startsWith('SHOP_KEY_')) {
              const kc = si.id.replace('SHOP_KEY_','').toLowerCase();
              if (player.keys[kc] > 0) si.sold = true;
            }
            // Mark augment items as sold if already owned or at cap
            if (si.isAugment && si.id && si.id.startsWith('SHOP_AUG_')) {
              const augId = si.id.replace('SHOP_AUG_','');
              if (player.augments[augId] || Object.keys(player.augments).length >= MAX_AUGMENTS) si.sold = true;
            }
          }
          /**
           * @param {any} i
           */
          if (!r.shopItems.some((/** @type {any} */ i) => !i.sold)) continue; // all invalidated
          this.shopRoom = r;
          this.shopSelected = 0;
          this.shopClosing = false;
          audio.vendorOpen();
          this.setState('SHOPPING');
          return;
        }
        if (dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<2) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' at vendor',colour:'#39ff14'};
      }
    }

    // quest tracking
    if (this.quest && !this.quest.done && !this.quest.failed) {
      if (this.quest.timer !== undefined) {
        this.quest.timer -= dt;
        if (this.quest.timer <= 0) { this.quest.failed = true; this.msg('Quest failed!','#ff3333'); }
      }
      if (!this.quest.failed && this.quest.check()) {
        this.quest.done = true;
        this.quest.reward();
        spawnParticles(player.x, player.y, 'EXPLOSION', '#39ff14', 20);
      }
    }

    // pause
    if (jp('Escape')) this.setState('PAUSED');

    // boss seal check — seal when player is clearly inside the boss room
    if (this.bossRoom && !this.bossSealed && this.bossAlive) {
      const r = this.bossRoom;
      /**
       * @param {any} e
       */
      const onEntrance = this.bossEntrances.some((/** @type {any} */ e) =>
        Math.floor(player.x)===e.x && Math.floor(player.y)===e.y);
      if (!onEntrance &&
          player.x >= r.x && player.x < r.x + r.w &&
          player.y >= r.y && player.y < r.y + r.h) {
        this.bossSealed = true;
        for (const e of this.bossEntrances) {
          e.origTile = dungeon.map[e.y][e.x];
          dungeon.map[e.y][e.x] = T.WALL;
        }
        this.refreshSealedEntrances();
        // Safety: nudge player off any sealed tile
        const ptx = Math.floor(player.x), pty = Math.floor(player.y);
        if (!isPassable(dungeon.map[pty]?.[ptx])) {
          player.x = r.cx + 0.5;
          player.y = r.cy + 0.5;
        }
        audio.roomSeal();
        this.msg('⚠ ROOM SEALED','#ff3333');
        // Boss intro telegraph — fires ONCE per boss encounter, on the
        // false→true bossSealed flip. Atmospheric overlay (radial vignette
        // in boss colour + boss-name titlecard + low-frequency audio sting).
        // Gameplay continues during the BOSS_INTRO_DURATION-second window;
        // the player can still move/shoot. Bosses themselves are AI-driven
        // and typically telegraph their first attack, so the intro doesn't
        // create unfair pressure. Save/load resumes mid-fight do NOT
        // re-trigger this — descend() resets bossSealed to false and the
        // dungeon is regenerated on Continue, so the seal-flip path is
        // re-entered cleanly only on first physical entry to the room.
        this.bossIntroDuration = BOSS_INTRO_DURATION;
        this.bossIntroTimer = BOSS_INTRO_DURATION;
        if (audio.bossIntro) audio.bossIntro();
      }
    }

    // Boss intro telegraph — count DOWN every frame regardless of camera or
    // pause state (pause already short-circuits the entire update loop).
    // Clamp to 0 to keep the renderer's `timer > 0` gate clean and to ensure
    // the timer can never be re-played by an integer-overflow / underflow path.
    if (this.bossIntroTimer > 0) {
      this.bossIntroTimer = Math.max(0, this.bossIntroTimer - dt);
    }

    // boss death — unseal room and update state
    if (this.bossAlive && !enemies.some(e=>e.isBoss && !e.dead)) {
      this.bossAlive=false;
      // Restore entrance tiles
      if (this.bossSealed) {
        for (const ent of this.bossEntrances) {
          if (ent.origTile !== undefined) { dungeon.map[ent.y][ent.x] = ent.origTile; delete ent.origTile; }
        }
        audio.roomUnseal();
      }
      this.bossSealed=false;
      this.refreshSealedEntrances();
      // Edge case — if the boss dies DURING the intro telegraph (player one-
      // shots a low-HP boss the instant they cross the threshold), kill the
      // intro overlay so the "boss is dead" state isn't visually contradicted
      // by a still-fading titlecard with the boss's name.
      this.bossIntroTimer = 0;
      this.bossIntroDuration = 0;
      // Boss death telegraph — fires ONCE per boss kill, on the
      // bossAlive true→false flip. Atmospheric overlay (radial flash in
      // the boss colour + "DESTROYED" titlecard with the boss name +
      // celebratory audio sting). Gameplay continues unaffected — the
      // overlay is purely cosmetic. The boss instance was removed from
      // `enemies` by the dead-enemy splice pass earlier in updatePlaying
      // (line ~1804), so the colour/name shown by the renderer come from
      // the per-frame snapshot that the boss-HUD block writes to
      // bossDeathColor/bossDeathName while the boss is alive.
      this.bossDeathDuration = BOSS_DEATH_DURATION;
      this.bossDeathTimer = BOSS_DEATH_DURATION;
      if (audio.bossDefeat) audio.bossDefeat();
      game.msg((BOSS_NAMES[this.bossType]||'BOSS')+' DESTROYED','#39ff14');
    }

    // Boss death telegraph — count DOWN every frame, clamped to 0. Same
    // shape and rationale as the boss-intro decrement above (defends
    // against negative-timer states from huge dt spikes — alt-tab,
    // phone-call interrupt — that would otherwise make the overlay
    // permanent).
    if (this.bossDeathTimer > 0) {
      this.bossDeathTimer = Math.max(0, this.bossDeathTimer - dt);
    }

    // Boss HUD bar animation
    if (this.bossAlive) {
      if (this.bossBarAnim < 1) this.bossBarAnim = Math.min(1, this.bossBarAnim + dt * 2.5);
      const boss = enemies.find(e => e.isBoss && !e.dead);
      if (boss) {
        // Per-frame snapshot of the boss's display identity so the death
        // telegraph can render the colour-graded titlecard AFTER the boss
        // has been spliced from `enemies` (the dead-enemy sweep at
        // line ~1804 runs BEFORE the death-detection block above, so by
        // the time the telegraph fires the boss instance is gone). Reads
        // are gated by bossDeathTimer > 0, so the fields are otherwise
        // unobserved while the boss is alive.
        this.bossDeathColor = boss.colour;
        this.bossDeathName = BOSS_NAMES[this.bossType] || 'BOSS';
        if (this.bossHpGhost === 0) this.bossHpGhost = boss.hp;
        if (this.bossHpGhost > boss.hp) {
          this.bossHpGhost = Math.max(boss.hp, this.bossHpGhost - boss.maxHp * dt * 0.25);
        } else {
          this.bossHpGhost = boss.hp;
        }
      }
    } else if (this.bossBarAnim > 0) {
      // Fade out after boss death
      this.bossBarAnim = Math.max(0, this.bossBarAnim - dt * 2);
    }

    // ── Challenge room: seal, wave spawn, unseal ─────────────────────────
    if (this.challengeRoom && !this.challengeComplete) {
      const cr = this.challengeRoom;
      // Seal when player is clearly inside the challenge room (same pattern as boss)
      if (!this.challengeSealed) {
        /**
         * @param {any} e
         */
        const onEntrance = this.challengeEntrances.some((/** @type {any} */ e) =>
          Math.floor(player.x)===e.x && Math.floor(player.y)===e.y);
        if (!onEntrance &&
            player.x >= cr.x && player.x < cr.x + cr.w &&
            player.y >= cr.y && player.y < cr.y + cr.h) {
          this.challengeSealed = true;
          this.challengeMaxWaves = Math.min(3, 1 + Math.floor(this.floor / 3));
          this.challengeWave = 0;
          this.challengeWaveDelay = 0.5; // brief delay before first wave
          for (const e of this.challengeEntrances) {
            e.origTile = dungeon.map[e.y][e.x];
            dungeon.map[e.y][e.x] = T.WALL;
          }
          this.refreshSealedEntrances();
          // Nudge player off sealed tiles
          const ptx = Math.floor(player.x), pty = Math.floor(player.y);
          if (!isPassable(dungeon.map[pty]?.[ptx])) {
            player.x = cr.cx + 0.5; player.y = cr.cy + 0.5;
          }
          audio.roomSeal();
          this.msg('⚠ CHALLENGE ROOM SEALED','#ff6633');
        }
      }
      // Wave delay countdown + spawn
      if (this.challengeSealed && this.challengeWaveDelay > 0) {
        this.challengeWaveDelay -= dt;
        if (this.challengeWaveDelay <= 0) {
          this.challengeWaveDelay = 0;
          this.challengeWave++;
          // Spawn wave enemies inside the challenge room
          const d = getDiff();
          const areaCap = Math.floor(cr.w * cr.h / 6);
          let count = Math.min(areaCap, Math.round((3 + this.floor) * d.enemyHp));
          if (game.modifier === 'SWARM') count = Math.min(areaCap, Math.ceil(count * 1.3));
          const effectiveFloor = Math.min(this.floor + 1, 9);
          /** @type {Record<string, number>} */
          const typeCounts = {};
          /** @type {Record<string, number>} */
          const TYPE_CAPS = { PHANTOM:2, TURRET:2, DRONE:1, SHIELDER:1, SPLITTER:1, GRENADIER:1, TELEPORTER:1, SNIPER:1, SUMMONER:1, HEALER:1, CHARGER:2, LEAPER:2, REFLECTOR:1, DISRUPTOR:1, WRAITH:1, NEXUS:1, SIPHON:1, GRAVITON:1, SEEKER:3, PULSER:2 };
          for (let j = 0; j < count; j++) {
            let type = pickEnemyType(effectiveFloor) || 'GUARD';
            if ((typeCounts[type]||0) >= (TYPE_CAPS[type]||99)) {
              const open = ENEMY_TYPES_LIST.filter((/** @type {any} */ t) =>
                (typeCounts[t]||0) < (TYPE_CAPS[t]||99) &&
                !(ENEMY_WEIGHTS[t].minFloor && effectiveFloor < ENEMY_WEIGHTS[t].minFloor)
              );
              type = open.length ? (open[rndInt(0, open.length-1)] || 'GUARD') : 'GUARD';
            }
            typeCounts[type] = (typeCounts[type]||0) + 1;
            // Spawn away from player
            let ex, ey, attempts = 0;
            do {
              ex = cr.x + rnd(1, cr.w-1);
              ey = cr.y + rnd(1, cr.h-1);
              attempts++;
            } while (attempts < 20 && Math.abs(ex - player.x) + Math.abs(ey - player.y) < 3);
            const e = spawnEnemy(type, ex, ey, this.floor, cr, this.challengeWave > 1);
            e._challengeWave = true;
            enemies.push(e);
          }
          cr._hadEnemies = true;
          audio.challengeWave();
          this.msg('WAVE ' + this.challengeWave + '/' + this.challengeMaxWaves, '#ff9933');
        }
      }
      // Wave cleared — next wave or victory
      if (this.challengeSealed && this.challengeWaveDelay <= 0 && this.challengeWave > 0) {
        let aliveCount = 0;
        for (const e of enemiesInRoomIter(this.challengeRoom)) {
          if (!e.dead && e._challengeWave) aliveCount++;
        }
        if (aliveCount === 0) {
          if (this.challengeWave >= this.challengeMaxWaves) {
            // Challenge complete — unseal and reward
            this.challengeComplete = true;
            this.challengeSealed = false;
            cr.challengeComplete = true;
            for (const e of this.challengeEntrances) {
              if (e.origTile !== undefined) { dungeon.map[e.y][e.x] = e.origTile; delete e.origTile; }
            }
            this.refreshSealedEntrances();
            audio.roomUnseal();
            audio.roomClear();
            // Rewards
            const d = getDiff();
            const cr2 = Math.round(this.floor * 20 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
            player.credits += cr2;
            player.score += 500 * this.floor;
            player.gainXP(this.floor * 15);
            // Drop guaranteed items
            for (let j = 0; j < 2; j++) {
              const ix = cr.x + rnd(1, cr.w-1), iy = cr.y + rnd(1, cr.h-1);
              items.push(new Item(ix, iy));
            }
            spawnParticles(cr.cx, cr.cy, 'EXPLOSION', '#ff9933', 25);
            spawnDmgText(cr.cx, cr.cy, '+' + cr2 + '◈', '#ff9933');
            // UNCHAINED #39: guaranteed 2 cores on challenge survival.
            if (typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
              NEON.cores.spawnCoreDrop(this, cr.cx, cr.cy, 2);
            }
            this.msg('⚡ CHALLENGE COMPLETE!', '#ff9933');
          } else {
            // Inter-wave pause
            this.challengeWaveDelay = 2.0;
          }
        }
      }
    }

    // ── Music state resolution (after all seal/unseal logic) ──
    if (this.bossSealed) music.setState('boss');
    else if (this.challengeSealed) music.setState('tension');
    else {
      // Check if enemies are alive in the player's current room
      const px = Math.floor(player.x), py = Math.floor(player.y);
      /**
       * @param {any} r
       */
      const pRoom = this.dungeon.rooms.find((/** @type {any} */ r) =>
        px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h);
      let inCombat = false;
      if (pRoom) {
        for (const e of enemiesInRoomIter(pRoom)) { if (!e.dead) { inCombat = true; break; } }
      }
      music.setState(inCombat ? 'combat' : 'explore');
    }
  },

  getPauseOptionRects() {
    const narrow = layout.compact;
    const w = Math.max(160, Math.min(W - 40, narrow ? 270 : 340));
    const h = narrow ? 34 : 40;
    const gap = narrow ? 6 : 10;
    const x = (W - w) / 2;
    const y0 = narrow ? 232 : 278;
    return [0, 1, 2].map(i => ({ x, y: y0 + i * (h + gap), w, h }));
  },

  /**
   * @param {number} x
   * @param {number} y
   */
  pauseOptionAt(x, y) {
    const rects = this.getPauseOptionRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  },

  updatePaused() {
    if (jp('Escape')) { audio.menuSelect(); this.setState('PLAYING'); }
    else if (jp('KeyS')) { audio.menuSelect(); this._settingsFrom = 'PAUSED'; this.setState('SETTINGS'); }
    else if (jp('KeyQ')) { audio.menuSelect(); this.setState('MENU'); }
    // Keyboard up/down selection + Enter
    const pauseActions = _GG_PAUSE_ACTION_STATES;
    if (this._pauseSel == null) this._pauseSel = -1;
    if (jp('MouseLeft')) {
      const hit = this.pauseOptionAt(mouse.x, mouse.y);
      if (hit >= 0) {
        this._pauseSel = hit;
        audio.menuSelect();
        if (hit === 1) { this._settingsFrom = 'PAUSED'; this.setState('SETTINGS'); }
        else this.setState(pauseActions[hit]);
        return;
      }
    }
    if (jp(ALT_KEYS.up) || jp(km('up')))   { this._pauseSel = this._pauseSel <= 0 ? 2 : this._pauseSel - 1; audio.menuSelect(); }
    if (jp(ALT_KEYS.down) || jp(km('down'))) { this._pauseSel = this._pauseSel >= 2 ? 0 : this._pauseSel + 1; audio.menuSelect(); }
    if (this._pauseSel >= 0 && jp('Enter')) {
      audio.menuSelect();
      if (this._pauseSel === 1) { this._settingsFrom = 'PAUSED'; this.setState('SETTINGS'); }
      else this.setState(pauseActions[this._pauseSel]);
      return;
    }
    // Mouse hover detection (highlight nearest option)
    if (!isTouchDevice()) {
      this._pauseSel = this.pauseOptionAt(mouse.x, mouse.y);
    }
  },

  /**
   * @param {any} dt
   */
  updatePowerupChoice(dt) {
    const pc = this.powerupChoice;
    if (!pc) { this.setState('PLAYING'); return; }
    // Arming delay — block selection for a short period to prevent accidental picks.
    if (pc._arm > 0) {
      pc._arm -= (dt || 1/60);
      // Allow navigation while arming, but consume selection keys.
      if (jp(ALT_KEYS.left) || jp(km('left')))  pc.selected = 0;
      if (jp(ALT_KEYS.right)|| jp(km('right')))  pc.selected = 1;
      return;
    }
    // Keyboard: left/right to select, 1/2 for direct pick, 3/Escape to skip
    if (jp(ALT_KEYS.left) || jp(km('left')))  pc.selected = 0;
    if (jp(ALT_KEYS.right)|| jp(km('right')))  pc.selected = 1;
    if (jp('Digit1')) { pc.selected=0; this.applyPowerupChoice(0); return; }
    if (jp('Digit2')) { pc.selected=1; this.applyPowerupChoice(1); return; }
    if (jp('Digit3') || jp('Escape') || jp('KeyQ')) { this.applyPowerupChoice(-1); return; }
    if (jp('Enter') || jp(km('shoot')))    { this.applyPowerupChoice(pc.selected); return; }
    // Mouse/touch: check click on cards or skip
    if (jp('MouseLeft')) {
      const box = getPowerupChoiceLayout(layout.compact);
      const mx = mouse.x, my = mouse.y;
      for (let i = 0; i < 2; i++) {
        const cx = box.cardX + i * (box.cardW + box.cardGap);
        if (mx >= cx && mx <= cx + box.cardW && my >= box.cardY && my <= box.cardY + box.cardH) {
          this.applyPowerupChoice(i); return;
        }
      }
      if (mx >= box.skipX && mx <= box.skipX + box.skipW && my >= box.skipY && my <= box.skipY + box.skipH) {
        this.applyPowerupChoice(-1); return;
      }
    }
  },

  /**
   * @param {any} idx
   */
  applyPowerupChoice(idx) {
    const pc = this.powerupChoice;
    if (idx >= 0 && idx < pc.options.length) {
      const opt = pc.options[idx];
      opt.fn(this.player);
      audio.menuSelect();
      this.msg('Chose ' + opt.name, opt.colour);
      // Telemetry: upgrade pick
      if (typeof NEON !== 'undefined' && NEON.telemetry) {
        /**
         * @param {any} _
         * @param {any} i
         * @param {any} o
         */
        const skipped = pc.options.filter((/** @type {any} */ _, /** @type {any} */ i) => i !== idx).map((/** @type {any} */ o) => o.id || o.name);
        NEON.telemetry.track('upgrade_pick', { picked: opt.id || opt.name, skipped, floor: this.floor });
      }
    } else {
      this.msg('Skipped upgrade', '#666688');
      if (typeof NEON !== 'undefined' && NEON.telemetry) {
        /**
         * @param {any} o
         */
        NEON.telemetry.track('upgrade_skip', { options: pc.options.map((/** @type {any} */ o) => o.id || o.name), floor: this.floor });
      }
    }
    this.powerupChoice = null;
    // Check for queued perk choices before returning to PLAYING
    if (this.pendingPerkChoices.length) { this.openNextPerkChoice(); return; }
    this.setState('PLAYING');
  },

  /** @param {any} weapon */
  collectWeaponCache(weapon) {
    if (!weapon || !this.player) {
      this.msg('WEAPON CACHE EMPTY', '#666688');
      this.setState('PLAYING');
      return;
    }
    const name = String(weapon.displayName || weapon.name || 'Weapon');
    if (this.player.collectWeapon && this.player.collectWeapon(weapon)) {
      this.msg('WEAPON CACHE: ' + name + ' ADDED', weapon.colour || '#ffb700');
      if (typeof NEON !== 'undefined' && NEON.telemetry) {
        NEON.telemetry.track('weapon_cache_collect', { weapon: weapon._base || name, floor: this.floor });
      }
      return;
    }
    const belt = Array.isArray(this.player.weapons) ? this.player.weapons : [];
    if (belt.length === 0 && this.player.equipWeapon) {
      this.player.equipWeapon(weapon);
      this.msg('WEAPON CACHE: ' + name + ' EQUIPPED', weapon.colour || '#ffb700');
      return;
    }
    this.weaponSwapChoice = {
      weapon,
      selected: Math.max(0, Math.min(this.player.weaponIdx || 0, Math.max(0, belt.length - 1))),
      _arm: 0.25
    };
    this.setState('WEAPON_SWAP');
  },

  /**
   * @param {number} dt
   */
  updateWeaponSwap(dt) {
    const wc = this.weaponSwapChoice;
    if (!wc || !this.player) { this.weaponSwapChoice = null; this.setState('PLAYING'); return; }
    const belt = Array.isArray(this.player.weapons) ? this.player.weapons : [];
    const slotCount = Math.min(3, belt.length);
    const choiceCount = slotCount + 1; // slots + SKIP
    if (choiceCount <= 1) { this.applyWeaponSwapChoice(-1); return; }
    wc.selected = Math.max(0, Math.min(wc.selected | 0, choiceCount - 1));
    if (wc._arm > 0) {
      wc._arm -= (dt || 1 / 60);
      if (jp(ALT_KEYS.up) || jp(km('up')) || jp(ALT_KEYS.left) || jp(km('left'))) wc.selected = Math.max(0, wc.selected - 1);
      if (jp(ALT_KEYS.down) || jp(km('down')) || jp(ALT_KEYS.right) || jp(km('right'))) wc.selected = Math.min(choiceCount - 1, wc.selected + 1);
      return;
    }
    if (jp(ALT_KEYS.up) || jp(km('up')) || jp(ALT_KEYS.left) || jp(km('left'))) {
      wc.selected = (wc.selected + choiceCount - 1) % choiceCount;
      audio.menuSelect();
    }
    if (jp(ALT_KEYS.down) || jp(km('down')) || jp(ALT_KEYS.right) || jp(km('right'))) {
      wc.selected = (wc.selected + 1) % choiceCount;
      audio.menuSelect();
    }
    if (jp('Digit1') && slotCount >= 1) { this.applyWeaponSwapChoice(0); return; }
    if (jp('Digit2') && slotCount >= 2) { this.applyWeaponSwapChoice(1); return; }
    if (jp('Digit3') && slotCount >= 3) { this.applyWeaponSwapChoice(2); return; }
    if (jp('Digit4') || jp('Escape') || jp('KeyQ')) { this.applyWeaponSwapChoice(-1); return; }
    if (jp('Enter') || jp(km('interact')) || jp(km('shoot'))) {
      this.applyWeaponSwapChoice(wc.selected >= slotCount ? -1 : wc.selected);
      return;
    }
    if (jp('MouseLeft')) {
      const narrow = layout.compact;
      const box = getWeaponSwapLayout(narrow);
      const mx = mouse.x, my = mouse.y;
      for (let i = 0; i < slotCount; i++) {
        const y = box.rowTop + i * box.rowH;
        if (mx >= box.rowX && mx <= box.rowX + box.rowW && my >= y && my <= y + box.rowCardH) {
          this.applyWeaponSwapChoice(i);
          return;
        }
      }
      if (mx >= box.rowX && mx <= box.rowX + box.rowW && my >= box.skipY && my <= box.skipY + box.skipH) {
        this.applyWeaponSwapChoice(-1);
      }
    }
  },

  /** @param {number} idx */
  applyWeaponSwapChoice(idx) {
    const wc = this.weaponSwapChoice;
    this.weaponSwapChoice = null;
    if (!wc || !this.player) { this.setState('PLAYING'); return; }
    const weapon = wc.weapon;
    const name = String((weapon && (weapon.displayName || weapon.name)) || 'Weapon');
    if (idx >= 0 && this.player.swapWeapon && Array.isArray(this.player.weapons) && idx < this.player.weapons.length) {
      this.player.swapWeapon(idx, weapon);
      this.player.weaponIdx = idx;
      this.player.weapon = weapon;
      this.player.shootCooldown = 0;
      audio.menuSelect();
      this.msg('ARMORY CACHE: ' + name + ' INSTALLED', weapon.colour || '#ffb700');
      if (typeof NEON !== 'undefined' && NEON.telemetry) {
        NEON.telemetry.track('weapon_cache_replace', { weapon: weapon._base || name, slot: idx, floor: this.floor });
      }
    } else {
      this.msg('Weapon cache skipped', '#666688');
      if (typeof NEON !== 'undefined' && NEON.telemetry) {
        NEON.telemetry.track('weapon_cache_skip', { weapon: weapon && (weapon._base || weapon.name), floor: this.floor });
      }
    }
    this.setState('PLAYING');
  },

  // ─── Perk Choice (choose-one-of-three on level up) ─────────────────────
  openNextPerkChoice() {
    if (!this.pendingPerkChoices.length) { this.setState('PLAYING'); return; }
    this.pendingPerkChoices.shift(); // consume the milestone
    const opts = rollPerkChoices(this.player, 3);
    if (!opts.length) { this.setState('PLAYING'); return; } // all perks owned
    this.perkChoice = { options: opts, selected: 0, _arm: 0.4 };
    this.setState('PERK_CHOICE');
    audio.perkChoice();
  },

  /**
   * @param {any} dt
   */
  updatePerkChoice(dt) {
    const pc = this.perkChoice;
    if (!pc) { this.setState('PLAYING'); return; }
    if (pc._arm > 0) {
      pc._arm -= (dt || 1/60);
      if (jp(ALT_KEYS.left) || jp(km('left')))  pc.selected = Math.max(0, pc.selected - 1);
      if (jp(ALT_KEYS.right)|| jp(km('right')))  pc.selected = Math.min(pc.options.length - 1, pc.selected + 1);
      return;
    }
    if (jp('Digit1')) { this.applyPerkChoice(0); return; }
    if (jp('Digit2')) { this.applyPerkChoice(1); return; }
    if (jp('Digit3') && pc.options.length > 2) { this.applyPerkChoice(2); return; }
    if (jp(ALT_KEYS.left) || jp(km('left')))  pc.selected = Math.max(0, pc.selected - 1);
    if (jp(ALT_KEYS.right)|| jp(km('right')))  pc.selected = Math.min(pc.options.length - 1, pc.selected + 1);
    if (jp('Enter') || jp(km('shoot')))     { this.applyPerkChoice(pc.selected); return; }
    // Mouse/touch
    if (jp('MouseLeft')) {
      const narrow = layout.compact;
      const count = pc.options.length;
      const cw = narrow ? Math.min(160, (W - 20) / count - 8) : Math.min(220, (W - 40) / count - 12);
      const gap = narrow ? 8 : 14;
      const totalW = cw * count + gap * (count - 1);
      const startX = (W - totalW) / 2;
      const cardY = H * 0.22;
      const cardH = narrow ? Math.min(240, H * 0.52) : Math.min(280, H * 0.48);
      for (let i = 0; i < count; i++) {
        const cx = startX + i * (cw + gap);
        if (mouse.x >= cx && mouse.x <= cx + cw && mouse.y >= cardY && mouse.y <= cardY + cardH) {
          this.applyPerkChoice(i); return;
        }
      }
    }
  },

  /**
   * @param {any} idx
   */
  applyPerkChoice(idx) {
    const pc = this.perkChoice;
    if (idx >= 0 && idx < pc.options.length) {
      const id = pc.options[idx];
      applyPerk(this.player, id);
      audio.menuSelect();
    }
    this.perkChoice = null;
    if (this.pendingPerkChoices.length) { this.openNextPerkChoice(); return; }
    this.setState('PLAYING');
  },

  // ─── Augment Choice ──────────────────────────────────────────────────────
  /**
   * @param {any} options
   */
  openAugmentChoice(options) {
    this.augmentChoice = { options, selected: 0, _arm: 0.4 };
    this.setState('AUGMENT_CHOICE');
    audio.augmentChoice();
  },

  /**
   * @param {any} dt
   */
  updateAugmentChoice(dt) {
    const ac = this.augmentChoice;
    if (!ac) { this.setState('PLAYING'); return; }
    if (ac._arm > 0) {
      ac._arm -= (dt || 1/60);
      if (jp(ALT_KEYS.left) || jp(km('left')))  ac.selected = Math.max(0, ac.selected - 1);
      if (jp(ALT_KEYS.right)|| jp(km('right')))  ac.selected = Math.min(ac.options.length - 1, ac.selected + 1);
      return;
    }
    if (jp('Digit1')) { this.applyAugmentChoice(0); return; }
    if (jp('Digit2') && ac.options.length > 1) { this.applyAugmentChoice(1); return; }
    if (jp(ALT_KEYS.left) || jp(km('left')))  ac.selected = Math.max(0, ac.selected - 1);
    if (jp(ALT_KEYS.right)|| jp(km('right')))  ac.selected = Math.min(ac.options.length - 1, ac.selected + 1);
    if (jp('Enter') || jp(km('shoot')))     { this.applyAugmentChoice(ac.selected); return; }
    if (jp('MouseLeft')) {
      const narrow = layout.compact;
      const count = ac.options.length;
      const cw = narrow ? Math.min(180, (W - 20) / count - 8) : Math.min(240, (W - 40) / count - 12);
      const gap = narrow ? 10 : 16;
      const totalW = cw * count + gap * (count - 1);
      const startX = (W - totalW) / 2;
      const cardY = H * 0.22;
      const cardH = narrow ? Math.min(240, H * 0.52) : Math.min(280, H * 0.48);
      for (let i = 0; i < count; i++) {
        const cx = startX + i * (cw + gap);
        if (mouse.x >= cx && mouse.x <= cx + cw && mouse.y >= cardY && mouse.y <= cardY + cardH) {
          this.applyAugmentChoice(i); return;
        }
      }
    }
  },

  /**
   * @param {any} idx
   */
  applyAugmentChoice(idx) {
    const ac = this.augmentChoice;
    if (!ac || idx < 0 || idx >= ac.options.length) { this.setState('PLAYING'); return; }
    const id = ac.options[idx];
    const aug = AUGMENTS[id];
    this.player.augments[id] = true;
    audio.augmentInstall();
    this.msg(aug.icon + ' ' + aug.name + ' INSTALLED', aug.colour);
    spawnParticles(this.player.x, this.player.y, 'EXPLOSION', aug.colour, 15);
    this.augmentChoice = null;
    this.setState('PLAYING');
  },

  renderAugmentChoice() {
    const ac = this.augmentChoice;
    if (!ac) return;
    const narrow = layout.compact;
    ctx.save();
    // Dimmed overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    // Title
    const titleFs = narrow ? 18 : 24;
    ctx.font = 'bold ' + titleFs + 'px monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10; ctx.shadowColor = '#cc44ff';
    ctx.fillStyle = '#cc44ff';
    const slots = Object.keys(this.player.augments).length;
    ctx.fillText('CHOOSE AUGMENT (' + slots + '/' + MAX_AUGMENTS + ')', W / 2, H * 0.14);
    ctx.shadowBlur = 0;
    // Subtitle
    ctx.font = (narrow ? 10 : 12) + 'px monospace';
    ctx.fillStyle = '#8866aa';
    ctx.fillText('Cybernetic implant — permanent passive effect', W / 2, H * 0.14 + titleFs + 4);
    // Cards
    const count = ac.options.length;
    const cw = narrow ? Math.min(180, (W - 20) / count - 8) : Math.min(240, (W - 40) / count - 12);
    const gap = narrow ? 10 : 16;
    const totalW = cw * count + gap * (count - 1);
    const startX = (W - totalW) / 2;
    const cardY = H * 0.22;
    const cardH = narrow ? Math.min(240, H * 0.52) : Math.min(280, H * 0.48);
    for (let i = 0; i < count; i++) {
      const id = ac.options[i];
      const aug = AUGMENTS[id];
      const cx = startX + i * (cw + gap);
      const sel = i === ac.selected;
      // Card background
      ctx.fillStyle = sel ? '#1a0a2a' : '#0d0615';
      ctx.strokeStyle = sel ? aug.colour : '#442266';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.fillRect(cx, cardY, cw, cardH);
      ctx.strokeRect(cx, cardY, cw, cardH);
      if (sel) {
        ctx.shadowBlur = 12; ctx.shadowColor = aug.colour;
        ctx.strokeRect(cx, cardY, cw, cardH);
        ctx.shadowBlur = 0;
      }
      // Icon
      const iconFs = narrow ? 28 : 36;
      ctx.font = iconFs + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = aug.colour;
      ctx.fillText(aug.icon, cx + cw / 2, cardY + (narrow ? 35 : 45));
      // Name
      const nameFs = narrow ? 11 : 13;
      ctx.font = 'bold ' + nameFs + 'px monospace';
      ctx.fillStyle = aug.colour;
      ctx.fillText(aug.name, cx + cw / 2, cardY + (narrow ? 58 : 72));
      // Description — word wrap
      ctx.font = (narrow ? 11 : 11) + 'px monospace';
      ctx.fillStyle = '#ccbbdd';
      const words = aug.desc.split(' ');
      let line = '', lineY = cardY + (narrow ? 75 : 92);
      const maxW = cw - 16;
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, cx + cw / 2, lineY);
          lineY += narrow ? 13 : 15;
          line = w;
        } else { line = test; }
      }
      if (line) ctx.fillText(line, cx + cw / 2, lineY);
      // Key hint
      ctx.font = (narrow ? 9 : 10) + 'px monospace';
      ctx.fillStyle = sel ? '#ffffff' : '#665588';
      ctx.fillText('[' + (i + 1) + ']', cx + cw / 2, cardY + cardH - (narrow ? 8 : 12));
    }
    ctx.restore();
  },

  // ─── Event Choice ────────────────────────────────────────────────────────
  updateEventChoice() {
    const ec = this.eventChoice;
    if (!ec) { this.setState('PLAYING'); return; }
    if (jp('Digit1')) { this.applyEventChoice('a'); return; }
    if (jp('Digit2')) { this.applyEventChoice('b'); return; }
    if (jp(ALT_KEYS.left) || jp(km('left')))  ec.selected = 0;
    if (jp(ALT_KEYS.right)|| jp(km('right')))  ec.selected = 1;
    if (jp('Enter') || jp(km('shoot')))     { this.applyEventChoice(ec.selected === 0 ? 'a' : 'b'); return; }
    if (jp('MouseLeft')) {
      const narrow = layout.compact;
      const cw = narrow ? Math.min(200, (W - 20) / 2 - 8) : Math.min(260, (W - 40) / 2 - 12);
      const gap = narrow ? 10 : 16;
      const totalW = cw * 2 + gap;
      const startX = (W - totalW) / 2;
      const cardY = H * 0.34;
      const cardH = narrow ? Math.min(180, H * 0.40) : Math.min(220, H * 0.38);
      for (let i = 0; i < 2; i++) {
        const cx = startX + i * (cw + gap);
        if (mouse.x >= cx && mouse.x <= cx + cw && mouse.y >= cardY && mouse.y <= cardY + cardH) {
          this.applyEventChoice(i === 0 ? 'a' : 'b'); return;
        }
      }
    }
  },

  /**
   * @param {any} choice
   */
  applyEventChoice(choice) {
    const ec = this.eventChoice;
    if (!ec) { this.setState('PLAYING'); return; }
    audio.eventResolve();
    applyEventEffect(ec.event, choice, this.player, this);
    this.eventChoice = null;
    // If effect killed the player (e.g. trap damage), endRun already fired — don't overwrite
    if (this.player.hp <= 0 || this.state === 'GAME_OVER' || this.state === 'NAME_ENTRY' || this.state === 'VICTORY') return;
    this.player.eventsResolved++;
    this.setState('PLAYING');
    // Check for pending perk choices (XP-granting events may trigger level-ups)
    if (this.pendingPerkChoices && this.pendingPerkChoices.length > 0 && this.state === 'PLAYING') {
      this.openNextPerkChoice();
    }
  },

  renderEventChoice() {
    const ec = this.eventChoice;
    if (!ec) return;
    const ev = ec.event;
    const narrow = layout.compact;
    ctx.save();
    // Dimmed overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    // Event icon + name
    const titleFs = narrow ? 16 : 22;
    ctx.font = 'bold ' + titleFs + 'px monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 12; ctx.shadowColor = ev.colour;
    ctx.fillStyle = ev.colour;
    ctx.fillText(ev.icon + ' ' + ev.name.toUpperCase(), W / 2, H * 0.10);
    ctx.shadowBlur = 0;
    // Event description — word wrap
    ctx.font = (narrow ? 10 : 12) + 'px monospace';
    ctx.fillStyle = '#aaccbb';
    const descWords = ev.desc.split(' ');
    let dLine = '', dY = H * 0.10 + titleFs + 6;
    const maxDescW = narrow ? W - 40 : W * 0.65;
    for (const w of descWords) {
      const test = dLine ? dLine + ' ' + w : w;
      if (ctx.measureText(test).width > maxDescW && dLine) {
        ctx.fillText(dLine, W / 2, dY);
        dY += narrow ? 14 : 16;
        dLine = w;
      } else { dLine = test; }
    }
    if (dLine) ctx.fillText(dLine, W / 2, dY);
    // Choice cards
    const cw = narrow ? Math.min(200, (W - 20) / 2 - 8) : Math.min(260, (W - 40) / 2 - 12);
    const gap = narrow ? 10 : 16;
    const totalW = cw * 2 + gap;
    const startX = (W - totalW) / 2;
    const cardY = H * 0.34;
    const cardH = narrow ? Math.min(180, H * 0.40) : Math.min(220, H * 0.38);
    const choices = [ev.a, ev.b];
    for (let i = 0; i < 2; i++) {
      const ch = choices[i];
      const cx = startX + i * (cw + gap);
      const sel = i === ec.selected;
      // Card background
      ctx.fillStyle = sel ? '#0a1a1a' : '#060f0f';
      ctx.strokeStyle = sel ? ev.colour : '#224444';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.fillRect(cx, cardY, cw, cardH);
      ctx.strokeRect(cx, cardY, cw, cardH);
      if (sel) {
        ctx.shadowBlur = 10; ctx.shadowColor = ev.colour;
        ctx.strokeRect(cx, cardY, cw, cardH);
        ctx.shadowBlur = 0;
      }
      // Choice label
      const labelFs = narrow ? 13 : 16;
      ctx.font = 'bold ' + labelFs + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = sel ? ev.colour : '#88bbaa';
      ctx.fillText(ch.label, cx + cw / 2, cardY + (narrow ? 22 : 28));
      // Choice description — word wrap
      ctx.font = (narrow ? 11 : 11) + 'px monospace';
      ctx.fillStyle = '#99bbaa';
      const cWords = ch.desc.split(' ');
      let cLine = '', cY = cardY + (narrow ? 40 : 50);
      const cMaxW = cw - 16;
      for (const w of cWords) {
        const test = cLine ? cLine + ' ' + w : w;
        if (ctx.measureText(test).width > cMaxW && cLine) {
          ctx.fillText(cLine, cx + cw / 2, cY);
          cY += narrow ? 13 : 15;
          cLine = w;
        } else { cLine = test; }
      }
      if (cLine) ctx.fillText(cLine, cx + cw / 2, cY);
      // Summary tag
      ctx.font = 'bold ' + (narrow ? 9 : 10) + 'px monospace';
      ctx.fillStyle = sel ? '#ffffff' : '#557766';
      ctx.fillText(ch.summary, cx + cw / 2, cardY + cardH - (narrow ? 24 : 30));
      // Key hint
      ctx.font = (narrow ? 9 : 10) + 'px monospace';
      ctx.fillStyle = sel ? '#ffffff' : '#446655';
      ctx.fillText('[' + (i + 1) + ']', cx + cw / 2, cardY + cardH - (narrow ? 8 : 12));
    }
    ctx.restore();
  },

  // ─── Vendor Shop ─────────────────────────────────────────────────────────
  updateShopping() {
    const room = this.shopRoom;
    if (!room || !room.shopItems) { this.setState('PLAYING'); return; }
    const items = room.shopItems;
    // If all sold, wait for auto-close timer (set in tryShopBuy)
    /**
     * @param {any} i
     */
    if (this.shopClosing || items.every((/** @type {any} */ i) => i.sold)) return;

    // Keyboard navigation
    if (jp('Escape') || jp('KeyQ')) { audio.menuSelect(); this.setState('PLAYING'); return; }
    if (jp(ALT_KEYS.left) || jp(km('left')))  this.shopSelected = Math.max(0, this.shopSelected - 1);
    if (jp(ALT_KEYS.right)|| jp(km('right')))  this.shopSelected = Math.min(2, this.shopSelected + 1);
    if (layout.compact && (jp(ALT_KEYS.up) || jp(km('up')))) this.shopSelected = Math.max(0, this.shopSelected - 1);
    if (layout.compact && (jp(ALT_KEYS.down) || jp(km('down')))) this.shopSelected = Math.min(2, this.shopSelected + 1);

    // Direct buy by number
    for (let i = 0; i < 3; i++) {
      if (jp('Digit' + (i + 1)) && !items[i].sold) {
        this.tryShopBuy(i);
        return;
      }
    }
    // Enter on selected
    if (jp('Enter') || jp(km('shoot'))) {
      if (!items[this.shopSelected].sold) this.tryShopBuy(this.shopSelected);
      return;
    }

    // Mouse/touch click on cards or leave button
    if (jp('MouseLeft')) {
      const box = getShoppingLayout(layout.compact);
      const mx = mouse.x, my = mouse.y;

      for (let i = 0; i < 3; i++) {
        const cx = box.horizontal ? box.cardX + i * (box.cardW + box.cardGap) : box.cardX;
        const cy = box.horizontal ? box.cardY : box.cardY + i * (box.cardH + box.cardGap);
        if (!items[i].sold && mx >= cx && mx <= cx + box.cardW && my >= cy && my <= cy + box.cardH) {
          this.tryShopBuy(i);
          return;
        }
      }
      if (mx >= box.leaveX && mx <= box.leaveX + box.leaveW && my >= box.leaveY && my <= box.leaveY + box.leaveH) {
        audio.menuSelect();
        this.setState('PLAYING');
        return;
      }
    }
  },

  /**
   * @param {any} idx
   */
  tryShopBuy(idx) {
    const item = this.shopRoom.shopItems[idx];
    if (!item || item.sold) return;
    if (this.player.credits < item.price) {
      audio.purchaseFail();
      this.msg('Not enough credits!', '#ff3333');
      return;
    }
    if (typeof item.fn !== 'function') {
      audio.purchaseFail();
      this.msg('Offer unavailable after restore', '#ff3333');
      return;
    }
    this.player.credits -= item.price;
    item.fn(this.player);
    item.sold = true;
    audio.purchase();
    this.msg('Bought ' + item.name, item.colour);
    spawnParticles(this.player.x, this.player.y, 'SPARK', item.colour, 8);
    // Advance cursor to next unsold slot
    const items = this.shopRoom.shopItems;
    /**
     * @param {any} it
     * @param {any} i
     */
    const nextUnsold = items.findIndex((/** @type {any} */ it, /** @type {any} */ i) => i > idx && !it.sold);
    /**
     * @param {any} it
     */
    const prevUnsold = items.findIndex((/** @type {any} */ it) => !it.sold);
    this.shopSelected = nextUnsold >= 0 ? nextUnsold : (prevUnsold >= 0 ? prevUnsold : idx);
    // If all sold, auto-leave after brief delay
    /**
     * @param {any} i
     */
    if (items.every((/** @type {any} */ i) => i.sold)) {
      this.shopClosing = true;
      setTimeout(() => { if (this.state === 'SHOPPING') this.setState('PLAYING'); this.shopClosing = false; }, 400);
    }
  },

  updateReading() {
    if (!this.readingInteractArmed && !keys.has(km('interact'))) {
      this.readingInteractArmed = true;
    }
    const box = getReadingLayout(layout.compact);
    const mouseClose = jp('MouseLeft') &&
      mouse.x >= box.closeX && mouse.x <= box.closeX + box.closeW &&
      mouse.y >= box.closeY && mouse.y <= box.closeY + box.closeH;
    const closeByInteract = this.readingInteractArmed && jp(km('interact'));
    if (closeByInteract || jp('Escape') || jp('Enter') || jp('KeyX') || mouseClose) {
      audio.menuSelect();
      // Clear whisper meta on close so the next READING entry (data terminal
      // lore) renders with the amber styling, not whatever was set last.
      this._whisperMeta = null;
      this.currentLore = null;
      this.setState('PLAYING');
    }
  },

  /** @param {number} dt */
  updateSystemMessage(dt) {
    const active = this.getActiveSystemMessage();
    if (!active) {
      this.setState(this.systemMessageReturnState || 'PLAYING');
      return;
    }
    this.systemMessageAckTimer = Math.max(0, (this.systemMessageAckTimer || 0) - dt);
    if (this.systemMessageAckTimer > 0) return;

    const narrow = layout.compact;
    const box = getSystemMessageLayout(narrow);
    const mouseAck = jp('MouseLeft') &&
      mouse.x >= box.ackX && mouse.x <= box.ackX + box.ackW &&
      mouse.y >= box.ackY && mouse.y <= box.ackY + box.ackH;
    if (jp('KeyX') || mouseAck) {
      this.markSystemMessageRead(active.id);
      audio.menuSelect();
      this.setState(this.systemMessageReturnState || 'PLAYING');
    }
  },

  ensureMainframeFinale() {
    if (!this.mainframeFinale) {
      this.mainframeFinale = { state:'unopened', selected:0, readRecordIds:new Set(), addressRevealed:false, selectedIntentId:null, messageSent:false, messageSentTimer:0, currentRecord:null };
    }
    if (!(this.mainframeFinale.readRecordIds instanceof Set)) this.mainframeFinale.readRecordIds = new Set();
    return this.mainframeFinale;
  },

  openMainframeReader() {
    const mf = this.ensureMainframeFinale();
    if (mf.state === 'unopened') mf.state = mf.addressRevealed ? 'message_ready' : 'record_list';
    mf.currentRecord = null;
    audio.loreAccess();
    this.setState('MAINFRAME_READER');
  },

  /**
   * @param {any} record
   */
  openMainframeRecord(record) {
    const mf = this.ensureMainframeFinale();
    mf.currentRecord = record;
    mf.readRecordIds.add(record.id);
    if (record.id === MAINFRAME_ADDRESS_RECORD_ID) {
      mf.addressRevealed = true;
      mf.state = 'address_revealed';
      this.msg('DESTINATION RECOVERED — SEND CONSOLE UNLOCKED', '#66ffcc');
    } else {
      mf.state = 'reading_record';
    }
    this.saveGame();
    audio.loreAccess();
  },

  closeMainframeRecord() {
    const mf = this.ensureMainframeFinale();
    mf.currentRecord = null;
    mf.state = mf.addressRevealed ? 'message_ready' : 'record_list';
    audio.menuSelect();
  },

  /**
   * @param {number} dt
   */
  updateMainframeReader(dt) {
    const mf = this.mainframeFinale;
    if (!mf) { this.setState('PLAYING'); return; }
    if (!(mf.readRecordIds instanceof Set)) mf.readRecordIds = new Set();

    if (mf.state === 'message_sent') {
      mf.messageSentTimer = Math.max(0, (mf.messageSentTimer || 0) - dt);
      if (mf.messageSentTimer <= 0) {
        audio.victory();
        this.endRun(true);
      }
      return;
    }

    const reading = mf.state === 'reading_record' || mf.state === 'address_revealed';
    const narrow = layout.compact;
    const frame = getMainframeReaderFrame(narrow);
    const closeBox = getMainframeCloseButtonLayout(narrow, frame);
    const mouseClose = jp('MouseLeft') &&
      mouse.x >= closeBox.closeX && mouse.x <= closeBox.closeX + closeBox.closeW &&
      mouse.y >= closeBox.closeY && mouse.y <= closeBox.closeY + closeBox.closeH;
    if (reading) {
      if (jp('Escape') || jp('KeyQ') || jp('KeyX') || jp('Enter') || jp(km('interact')) || mouseClose) {
        this.closeMainframeRecord();
      }
      return;
    }

    if (jp('Escape') || jp('KeyQ')) {
      audio.menuSelect();
      mf.currentRecord = null;
      this.setState('PLAYING');
      return;
    }

    const max = MAINFRAME_RECORDS.length - 1;
    if (jp(ALT_KEYS.up) || jp(km('up'))) { mf.selected = Math.max(0, (mf.selected || 0) - 1); audio.menuSelect(); }
    if (jp(ALT_KEYS.down) || jp(km('down'))) { mf.selected = Math.min(max, (mf.selected || 0) + 1); audio.menuSelect(); }
    for (let i = 0; i < MAINFRAME_RECORDS.length; i++) {
      if (jp('Digit' + (i + 1))) {
        const record = MAINFRAME_RECORDS[i];
        if (!record) return;
        mf.selected = i;
        this.openMainframeRecord(record);
        return;
      }
    }

    if (jp('MouseLeft')) {
      if (mouseClose) {
        audio.menuSelect();
        mf.currentRecord = null;
        this.setState('PLAYING');
        return;
      }
      const { startY, rowH } = getMainframeRecordListLayout(narrow, frame.fy, frame.fh, MAINFRAME_RECORDS.length);
      const rowX = frame.fx + (narrow ? 16 : 28);
      const rowW = frame.fw - (narrow ? 32 : 56);
      for (let i = 0; i < MAINFRAME_RECORDS.length; i++) {
        const y = startY + i * rowH;
        if (mouse.x >= rowX - 8 && mouse.x <= rowX + rowW + 8 &&
            mouse.y >= y - rowH * 0.65 && mouse.y <= y + rowH * 0.35) {
          const record = MAINFRAME_RECORDS[i];
          if (!record) return;
          mf.selected = i;
          this.openMainframeRecord(record);
          return;
        }
      }
      return;
    }

    if (jp('Enter') || jp(km('interact')) || jp(km('shoot'))) {
      const record = MAINFRAME_RECORDS[Math.max(0, Math.min(max, mf.selected || 0))];
      if (record) this.openMainframeRecord(record);
    }
  },

  openMainframeMessageSend() {
    const mf = this.ensureMainframeFinale();
    if (!mf.addressRevealed) {
      this.msg('READ CONTACT-ADDRESS RECORD FIRST', '#66ffcc');
      return;
    }
    mf.currentRecord = null;
    mf.state = 'message_ready';
    mf.selectedIntentId = normalizeAct1MessageIntentId(mf.selectedIntentId);
    audio.menuSelect();
    this.setState('MESSAGE_SEND');
  },

  updateMessageSend() {
    const mf = this.mainframeFinale;
    if (!mf || !mf.addressRevealed) { this.setState('PLAYING'); return; }
    mf.selectedIntentId = normalizeAct1MessageIntentId(mf.selectedIntentId);

    if (jp('Escape') || jp('KeyQ')) {
      audio.menuSelect();
      mf.state = 'message_ready';
      this.setState('MAINFRAME_READER');
      return;
    }

    const current = ACT1_MESSAGE_INTENTS.findIndex((/** @type {any} */ intent) => intent.id === mf.selectedIntentId);
    let next = current < 0 ? 0 : current;
    if (jp(ALT_KEYS.left) || jp(km('left')) || jp(ALT_KEYS.up) || jp(km('up'))) next = Math.max(0, next - 1);
    if (jp(ALT_KEYS.right) || jp(km('right')) || jp(ALT_KEYS.down) || jp(km('down'))) next = Math.min(ACT1_MESSAGE_INTENTS.length - 1, next + 1);
    for (let i = 0; i < ACT1_MESSAGE_INTENTS.length; i++) {
      if (jp('Digit' + (i + 1))) next = i;
    }
    const nextIntent = ACT1_MESSAGE_INTENTS[next];
    if (next !== current && nextIntent) {
      mf.selectedIntentId = nextIntent.id;
      audio.menuSelect();
    }

    if (jp('MouseLeft')) {
      const narrow = layout.compact;
      const { rowH, rowStart, rowX, rowW, rowTopOffset, rowCardH, btnY, btnW, btnH, sendX, backX } = getMessageSendLayout(narrow);
      for (let i = 0; i < ACT1_MESSAGE_INTENTS.length; i++) {
        const y = rowStart + i * rowH;
        if (mouse.x >= rowX && mouse.x <= rowX + rowW &&
            mouse.y >= y + rowTopOffset && mouse.y <= y + rowTopOffset + rowCardH) {
          const intent = ACT1_MESSAGE_INTENTS[i];
          if (!intent) return;
          mf.selectedIntentId = intent.id;
          audio.menuSelect();
          return;
        }
      }

      if (mouse.y >= btnY && mouse.y <= btnY + btnH) {
        if (mouse.x >= sendX && mouse.x <= sendX + btnW) {
          this.confirmMainframeMessageSend();
          return;
        }
        if (mouse.x >= backX && mouse.x <= backX + btnW) {
          audio.menuSelect();
          mf.state = 'message_ready';
          this.setState('MAINFRAME_READER');
          return;
        }
      }
    }

    if (jp('Enter') || jp(km('interact')) || jp(km('shoot'))) {
      this.confirmMainframeMessageSend();
    }
  },

  confirmMainframeMessageSend() {
    const mf = this.ensureMainframeFinale();
    if (!mf.addressRevealed) {
      this.msg('READ CONTACT-ADDRESS RECORD FIRST', '#66ffcc');
      this.setState('PLAYING');
      return;
    }
    const intentId = normalizeAct1MessageIntentId(mf.selectedIntentId);
    mf.selectedIntentId = intentId;
    mf.currentRecord = null;
    mf.messageSent = true;
    mf.messageSentTimer = 1.35;
    mf.state = 'message_sent';
    this._lastEnding = ACT1_MESSAGE_ENDING_ID;
    this._lastAct1MessageIntent = intentId;
    this.msg('OUTBOUND PACKET QUEUED', '#ff66cc');
    audio.loreAccess();
    this.setState('MAINFRAME_READER');
  },

  /**
   * @param {any} dt
   */
  updateFade(dt) {
    this.fadeTime+=dt;
    // Refresh glitch bars every ~100ms
    this.fadeGlitchTimer-=dt;
    if (this.fadeGlitchTimer<=0) {
      this.fadeGlitchTimer=0.1;
      const count=3+rndInt(0,2,'cosmetic');
      this.fadeGlitchBars=[];
      for (let i=0;i<count;i++) {
        this.fadeGlitchBars.push({
          y: rand('cosmetic')*H,
          h: 1+rand('cosmetic')*4,
          x: rand('cosmetic')*W*0.3,
          w: W*(0.3+rand('cosmetic')*0.7),
          color: rand('cosmetic')>0.5 ? '#ff00c8' : '#00f5ff',
          alpha: 0.15+rand('cosmetic')*0.35
        });
      }
    }
    if (this.fadeDir===1) {
      this.fadeAlpha+=dt*(1/0.4);
      if (this.fadeAlpha>=1) {
        this.fadeAlpha=1;
        this.fadeDir=2; // hold phase
        this.fadeHold=0;
        if (this.fadeCallback) {
          this.fadeCallback();
          this.fadeCallback=null;
        }
      }
    } else if (this.fadeDir===2) {
      // Hold at peak for 150ms
      this.fadeHold+=dt;
      if (this.fadeHold>=0.15) this.fadeDir=-1;
    } else if (this.fadeDir===-1) {
      this.fadeAlpha-=dt*(1/0.4);
      if (this.fadeAlpha<=0) {
        this.fadeAlpha=0; this.fadeDir=0;
        if (this.fadeNextState) this.setState(this.fadeNextState);
      }
    }
  },

  // ─── Virtual Keyboard Layout ──────────────────────────────────────────────
  _vkChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split(''),
  _vkCols: 10,

  /**
   * @param {any} narrow
   */
  _vkLayout(narrow) {
    const cols=this._vkCols;
    const cellW=narrow?28:36, cellH=narrow?28:36, gap=narrow?3:4;
    const rows=Math.ceil((this._vkChars.length+2)/cols); // +2 for DEL/OK
    const gridW=cols*(cellW+gap)-gap;
    const gridH=rows*(cellH+gap)-gap;
    const ox=(W-gridW)/2;
    const preferredOy=narrow?280:340;
    const minOy=narrow?176:260;
    const hintOffset=gridH+(narrow?9:24);
    const bottomMargin=narrow?12:20;
    const oy=Math.max(minOy,Math.min(preferredOy,H-hintOffset-bottomMargin));
    const hintY=oy+hintOffset;
    return {cellW,cellH,gap,cols,rows,ox,oy,gridW,gridH,hintY};
  },

  /**
   * @param {any} cx
   * @param {any} cy
   * @param {any} oy
   * @param {any} narrow
   */
  _vkHitTest(cx,cy,oy,narrow) {
    const {cellW,cellH,gap,cols,ox}=this._vkLayout(narrow);
    const allKeys=[...this._vkChars,'←','OK'];
    for (let i=0;i<allKeys.length;i++) {
      const col=i%cols, row=Math.floor(i/cols);
      const kx=ox+col*(cellW+gap), ky=oy+row*(cellH+gap);
      // OK key is double-wide
      const kw=allKeys[i]==='OK'?(cellW*2+gap):cellW;
      if (cx>=kx&&cx<=kx+kw&&cy>=ky&&cy<=ky+cellH) return allKeys[i];
    }
    return null;
  },

  /**
   * @param {any} dt
   */
  updateNameEntry(dt) {
    const ne=this.nameEntry;
    if (!ne) return;
    ne.cursorBlink=(ne.cursorBlink||0)+dt;

    // Desktop keyboard input
    if (lastKey.length===1 && /[A-Za-z0-9 \-_]/.test(lastKey)) {
      if (ne.name.length<12) ne.name+=lastKey.toUpperCase();
    }
    if (jp('Backspace')) ne.name=ne.name.slice(0,-1);

    // Touch/click virtual keyboard
    if (nameEntryTap) {
      const narrow=layout.compact;
      const {oy}=this._vkLayout(narrow);
      const hit=this._vkHitTest(nameEntryTap[0],nameEntryTap[1],oy,narrow);
      if (hit==='←') ne.name=ne.name.slice(0,-1);
      else if (hit==='OK') { if (ne.name.length===0) ne.name='ANON'; jp('Enter'); justPressed.add('Enter'); }
      else if (hit && ne.name.length<12) ne.name+=hit;
    }
    // Mouse click on virtual keyboard (desktop)
    if (jp('MouseLeft') && !nameEntryTap) {
      const narrow=layout.compact;
      const {oy}=this._vkLayout(narrow);
      const hit=this._vkHitTest(mouse.x,mouse.y,oy,narrow);
      if (hit==='←') ne.name=ne.name.slice(0,-1);
      else if (hit==='OK') { if (ne.name.length===0) ne.name='ANON'; justPressed.add('Enter'); }
      else if (hit && ne.name.length<12) ne.name+=hit;
    }

    // Confirm (Enter on keyboard or OK on virtual keyboard)
    if (jp('Enter')) {
      if (ne.name.length===0) ne.name='ANON';
      audio.menuSelect();
      this.saveScore(ne.name);
      const dest=ne.victory?'VICTORY':'GAME_OVER';
      this.nameEntry=null;
      this.setState(dest);
    }
  },

  renderNameEntry() {
    const ne=this.nameEntry;
    if (!ne) return;
    const narrow=layout.compact;
    const isTouch=isTouchDevice();

    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.95)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';

    // Title
    ctx.shadowBlur=30; ctx.shadowColor='#ffb700';
    ctx.fillStyle='#ffb700'; ctx.font=`bold ${narrow?28:40}px monospace`;
    ctx.fillText('HIGH SCORE!',W/2,narrow?60:80);

    // Rank + score
    ctx.shadowBlur=0;
    ctx.fillStyle='#aaaacc'; ctx.font=`${narrow?14:18}px monospace`;
    ctx.fillText(`Rank #${ne.rank+1}  •  Score: ${this.player.score}  •  Floor: ${this.floor}`,W/2,narrow?95:125);

    // Name input field
    const fieldY=narrow?130:170;
    ctx.fillStyle='#555577'; ctx.font=`${narrow?12:14}px monospace`;
    ctx.fillText('ENTER YOUR NAME',W/2,fieldY);

    const nameDisplay=ne.name+(Math.floor(ne.cursorBlink*3)%2===0?'_':'');
    ctx.shadowBlur=15; ctx.shadowColor='#00f5ff';
    ctx.fillStyle='#00f5ff'; ctx.font=`bold ${narrow?24:32}px monospace`;
    ctx.fillText(nameDisplay,W/2,fieldY+(narrow?30:40));
    ctx.shadowBlur=0;

    // Virtual keyboard
    const {cellW,cellH,gap,cols,ox,oy,hintY}=this._vkLayout(narrow);
    const allKeys=[...this._vkChars,'←','OK'];
    const fontSize=narrow?12:14;

    for (let i=0;i<allKeys.length;i++) {
      const col=i%cols, row=Math.floor(i/cols);
      const kx=ox+col*(cellW+gap), ky=oy+row*(cellH+gap);
      const key=allKeys[i];
      const isOK=key==='OK';
      const isDel=key==='←';
      const kw=isOK?(cellW*2+gap):cellW;

      // Hover highlight
      let hover=false;
      if (nameEntryTap) {
        const [tx,ty]=nameEntryTap;
        hover=tx>=kx&&tx<=kx+kw&&ty>=ky&&ty<=ky+cellH;
      } else if (mouse.x>=kx&&mouse.x<=kx+kw&&mouse.y>=ky&&mouse.y<=ky+cellH) {
        hover=true;
      }

      // Key background
      ctx.fillStyle=hover?(isOK?'#39ff14':isDel?'#ff3333':'#00f5ff'):'rgba(255,255,255,0.08)';
      ctx.globalAlpha=hover?0.3:1;
      ctx.fillRect(kx,ky,kw,cellH);
      ctx.globalAlpha=1;

      // Key border
      ctx.strokeStyle=isOK?'#39ff14':isDel?'#ff3333':'#555577';
      ctx.lineWidth=1;
      ctx.strokeRect(kx,ky,kw,cellH);

      // Key label
      ctx.fillStyle=isOK?'#39ff14':isDel?'#ff3333':'#aaaacc';
      ctx.font=`${isOK?'bold ':''}${fontSize}px monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(key,kx+kw/2,ky+cellH/2);
    }
    ctx.textBaseline='alphabetic';

    // Hint
    ctx.textAlign='center';
    ctx.fillStyle='#555577'; ctx.font=`${narrow?10:12}px monospace`;
    if (isTouch) {
      ctx.fillText('TAP KEYS TO ENTER NAME  •  TAP OK TO CONFIRM',W/2,hintY);
    } else {
      ctx.fillText('TYPE YOUR NAME  •  PRESS ENTER TO CONFIRM',W/2,hintY);
    }

    ctx.restore();
  },

  updateGameOver() {
    if (jp('Enter') || (jp('MouseLeft') && this.resultMenuButtonHit(mouse.x, mouse.y))) {
      audio.menuSelect();
      this.setState('MENU');
    }
  },

  updateVictory() {
    if (jp('Enter') || (jp('MouseLeft') && this.resultMenuButtonHit(mouse.x, mouse.y))) {
      audio.menuSelect();
      this._newlyUnlocked = null;
      this.setState('MENU');
    }
  },

  /** @returns {{ x: number, y: number, w: number, h: number }} */
  getResultMenuButtonRect() {
    const narrow = layout.compact;
    const w = Math.max(180, Math.min(W - 40, narrow ? 260 : 320));
    const h = narrow ? 36 : 42;
    const x = (W - w) / 2;
    const y = H - (narrow ? 62 : 74);
    return { x, y, w, h };
  },

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  resultMenuButtonHit(x, y) {
    const r = this.getResultMenuButtonRect();
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  },

  /** @param {string} colour */
  renderResultMenuButton(colour) {
    const r = this.getResultMenuButtonRect();
    const narrow = layout.compact;
    const hover = !isTouchDevice() && this.resultMenuButtonHit(mouse.x, mouse.y);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hover ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = colour;
    ctx.lineWidth = hover ? 2 : 1;
    NEON.draw.roundRectFillStroke(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fillStyle = colour;
    ctx.font = `bold ${narrow ? 13 : 16}px monospace`;
    ctx.fillText('RETURN TO MENU', W / 2, r.y + r.h / 2);
    ctx.restore();
  },

  /** @param {number} i */
  getArchiveRowRect(i) {
    const narrow = layout.compact;
    const rowH = narrow ? 42 : 50;
    const w = W * 0.84;
    const x = (W - w) / 2;
    const centerY = (narrow ? 95 : 120) + i * rowH;
    return { x, y: centerY - rowH / 2, w, h: rowH };
  },

  getArchiveBackRect() {
    const narrow = layout.compact;
    const w = Math.max(140, Math.min(W - 40, narrow ? 200 : 240));
    const h = narrow ? 38 : 42;
    const x = (W - w) / 2;
    const y = H - (narrow ? 58 : 70);
    return { x, y, w, h };
  },

  /**
   * @param {number} x
   * @param {number} y
   */
  archiveOptionAt(x, y) {
    const back = this.getArchiveBackRect();
    if (x >= back.x && x <= back.x + back.w && y >= back.y && y <= back.y + back.h) return -2;
    for (let i = 0; i < META_UPGRADES.length; i++) {
      const r = this.getArchiveRowRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  },

  renderArchiveBackButton() {
    const r = this.getArchiveBackRect();
    const narrow = layout.compact;
    const hover = !isTouchDevice() && this.archiveOptionAt(mouse.x, mouse.y) === -2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hover ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = '#ffb700';
    ctx.lineWidth = hover ? 2 : 1;
    NEON.draw.roundRectFillStroke(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fillStyle = '#ffb700';
    ctx.font = `bold ${narrow ? 12 : 14}px monospace`;
    ctx.fillText('BACK TO MENU', W / 2, r.y + r.h / 2);
    ctx.restore();
  },

  updateArchives() {
    const n = META_UPGRADES.length;
    if (this.archivesSel === undefined) this.archivesSel = 0;
    if (jp(ALT_KEYS.up)||jp(km('up')))   this.archivesSel = (this.archivesSel - 1 + n) % n;
    if (jp(ALT_KEYS.down)||jp(km('down'))) this.archivesSel = (this.archivesSel + 1) % n;
    if (jp('Escape')||jp('KeyQ'))    { audio.menuSelect(); this.setState('MENU'); return; }
    if (jp('MouseLeft')) {
      const hit = this.archiveOptionAt(mouse.x, mouse.y);
      if (hit === -2) { audio.menuSelect(); this.setState('MENU'); return; }
      if (hit < 0) return;
      this.archivesSel = hit;
    }
    if (jp('Enter')||jp('MouseLeft')) {
      const u = META_UPGRADES[this.archivesSel];
      const meta = loadMeta();
      const curLv = meta.upgrades[u.id] || 0;
      if (curLv >= u.maxLv) return;
      const cost = u.costs[curLv];
      if (!Number.isFinite(cost) || meta.shards < cost) { audio.hit(true); return; }
      meta.shards -= cost;
      meta.upgrades[u.id] = curLv + 1;
      saveMeta(meta);
      audio.purchase();
    }
  },

  // ─── Settings ────────────────────────────────────────────────────────────────
  _settingsFrom: 'MENU',
  _settingsSel: 0,
  _settingsCapture: null,  // action name being rebound, or null
  _settingsDrag: null,     // 'sfx' or 'music' while dragging a slider
  // Two-tap confirmation for [RESET TO DEFAULTS]. First Enter/click on
  // the row arms the timestamp (performance.now()); a second
  // Enter/click within RESET_CONFIRM_WINDOW_MS commits the reset. Any
  // other action — navigating to a different row, clicking elsewhere,
  // pressing Escape, or just letting the window expire — clears it.
  // Prevents a single fat-finger from wiping all keybinds + toggles
  // (which `settings.resetAll()` does irreversibly).
  _settingsResetConfirm: 0,

  /**
   * Settings menu row metrics — single source of truth for both
   * updateSettings (hit-testing) and renderSettings (drawing). The
   * row height SHRINKS dynamically to fit `totalRows` inside the
   * current viewport `H` so the back / reset rows don't fall off-
   * screen on common 720-logical-pixel landscape windows. Capped at
   * the historical defaults (28 narrow / 34 wide) so taller windows
   * keep the legacy spacing.
   *
   * @param {number} totalRows
   * @returns {{ startY:number, rowH:number }}
   */
  _settingsLayout(totalRows) {
    const narrow = layout.compact;
    const startY = narrow ? 80 : 80;        // narrow: unchanged; wide: was 100, reduced for row count
    const desiredRowH = narrow ? 28 : 34;
    const navHintMargin = 30;               // bottom hint sits at H - 20 + 10 padding
    const span = Math.max(1, totalRows - 1); // last row index = totalRows - 1
    const fitRowH = Math.floor((H - startY - navHintMargin) / span);
    const rowH = Math.max(16, Math.min(desiredRowH, fitRowH));
    return { startY, rowH };
  },

  updateSettings() {
    const actions = Object.keys(DEFAULT_KEY_MAP);
    const TOGGLE_START = 2;   // row index where toggles begin
    const STEPPER_START = 8;  // row index where scale steppers begin (after 6 toggles)
    const STEPPER_COUNT = 3;  // MINIMAP SIZE + TEXT SIZE + WORLD ZOOM
    const CTRL_START = STEPPER_START + STEPPER_COUNT;  // row index where key rebind rows begin
    // Total items: 2 sliders + 6 toggles + 2 steppers + N rebind rows + 1 reset row + 1 back row
    const totalRows = CTRL_START + actions.length + 2;
    // Compute the row metrics once. The dynamic rowH shrinks the menu
    // to fit the current viewport H (capped at the desired default), so
    // the back/reset rows don't fall off-screen on common 720-logical-px
    // landscape windows after the layout grew past 21 rows. See
    // game._settingsLayout for the formula.
    const layoutM = this._settingsLayout(totalRows);
    const startY = layoutM.startY;
    const rowH = layoutM.rowH;
    // Auto-expire a stale reset confirmation. Without this, a player who
    // armed the confirmation 30 seconds ago and walks away returns to a
    // settings menu where the very next Enter wipes their config.
    if (this._settingsResetConfirm > 0
        && (performance.now() - this._settingsResetConfirm) > RESET_CONFIRM_WINDOW_MS) {
      this._settingsResetConfirm = 0;
    }

    // Key capture mode — wait for next keydown
    if (this._settingsCapture) {
      // On touch devices, tap (MouseLeft) cancels capture since there's no keyboard
      if (isTouchDevice() && justPressed.has('MouseLeft')) { this._settingsCapture = null; return; }
      for (const code of justPressed) {
        if (code === 'Escape') { this._settingsCapture = null; return; }
        if (code === 'MouseLeft') continue;   // ignore mouse click during capture
        if (RESERVED_KEYS.has(code)) continue; // reserved keys can't be bound
        // Swap: if another action already uses this code, swap them
        const curAction = this._settingsCapture;
        if (!curAction) return;
        const oldCode = settings.keyMap[curAction];
        for (const a of actions) {
          if (a !== curAction && settings.keyMap[a] === code) {
            if (oldCode !== undefined) settings.keyMap[a] = oldCode;
            break;
          }
        }
        settings.keyMap[curAction] = code;
        settings.save();
        this._settingsCapture = null;
        audio.menuSelect();
        return;
      }
      return;
    }

    // Slider dragging
    if (this._settingsDrag && mouse.down) {
      const narrow = layout.compact;
      const sliderX = narrow ? 120 : 200;
      const sliderW = narrow ? (W - 240) : 400;
      let val = (mouse.x - sliderX) / sliderW;
      val = Math.max(0, Math.min(1, val));
      if (this._settingsDrag === 'sfx') audio.setSfxVolume(val);
      else audio.setMusicVolume(val);
      settings.save();
      return;
    }
    if (this._settingsDrag && !mouse.down) { this._settingsDrag = null; }

    // Navigation. Any move clears a pending reset confirmation — the
    // user wandered off the row, so the arming intent is gone.
    const prevSel = this._settingsSel;
    if (jp(ALT_KEYS.up) || jp(km('up')))     this._settingsSel = (this._settingsSel - 1 + totalRows) % totalRows;
    if (jp(ALT_KEYS.down) || jp(km('down')))  this._settingsSel = (this._settingsSel + 1) % totalRows;
    if (this._settingsSel !== prevSel) this._settingsResetConfirm = 0;

    const sel = this._settingsSel;

    // Left/right on volume sliders
    if (sel < TOGGLE_START) {
      const step = 0.05;
      if (jp(ALT_KEYS.left) || jp(km('left'))) {
        if (sel === 0) audio.setSfxVolume(Math.max(0, settings.sfxVol - step));
        else audio.setMusicVolume(Math.max(0, settings.musicVol - step));
        settings.save();
      }
      if (jp(ALT_KEYS.right) || jp(km('right'))) {
        if (sel === 0) audio.setSfxVolume(Math.min(1, settings.sfxVol + step));
        else audio.setMusicVolume(Math.min(1, settings.musicVol + step));
        settings.save();
      }
    }

    // Left/right or Enter toggles display options
    const toggleKeys = ['screenShake', 'damageNumbers', 'lockAimToMove', 'aimAssist', 'crtMode', 'reducedMotion'];
    if (sel >= TOGGLE_START && sel < STEPPER_START) {
      if (jp(ALT_KEYS.left) || jp(km('left')) || jp(ALT_KEYS.right) || jp(km('right')) || jp('Enter') || jp(km('shoot'))) {
        const key = toggleKeys[sel - TOGGLE_START];
        if (key) {
          /** @type {any} */
          const s = settings;
          s[key] = !s[key];
          settings.save();
          audio.menuSelect();
        }
      }
    }

    // Left/right or Enter cycles scale steppers (MINIMAP SIZE / TEXT SIZE / WORLD ZOOM).
    // Steppers walk through a discrete value list in `MINIMAP_SCALE_STEPS`,
    // `TEXT_SCALE_STEPS`, and `WORLD_ZOOM_STEPS` (defined in platform.js);
    // right wraps to start, left wraps to end, Enter advances forward
    // (matches toggles UX).
    /** @type {Array<{ key:'minimapScale'|'textScale'|'worldZoom', steps:number[] }>} */
    const stepperRows = [
      { key: 'minimapScale', steps: MINIMAP_SCALE_STEPS },
      { key: 'textScale',    steps: TEXT_SCALE_STEPS },
      { key: 'worldZoom',    steps: WORLD_ZOOM_STEPS },
    ];
    if (sel >= STEPPER_START && sel < CTRL_START) {
      const row = stepperRows[sel - STEPPER_START];
      if (row) {
        /** @type {any} */
        const s = settings;
        const cur = row.steps.indexOf(snapToSteps(s[row.key], row.steps));
        const safe = cur < 0 ? 0 : cur;
        if (jp(ALT_KEYS.left) || jp(km('left'))) {
          s[row.key] = row.steps[(safe - 1 + row.steps.length) % row.steps.length];
          if (row.key === 'minimapScale') _RG._minimapDirty = true;
          settings.save();
          // worldZoom is the global UI scale — changing it must re-fire
          // resize() so the logical W/H = rawW/H / worldZoom invariant
          // holds for the next frame (without it the menu/HUD layout
          // would lag a frame behind the new pointer normalization,
          // producing a visible jump). updateBtns refreshes the touch
          // button positions for the new W. minimapDirty mirrors the
          // existing dirty flag so the cached minimap re-renders at
          // the new scale.
          if (row.key === 'worldZoom') {
            resize(); updateBtns(); _RG._minimapDirty = true;
          }
          audio.menuSelect();
        } else if (jp(ALT_KEYS.right) || jp(km('right')) || jp('Enter') || jp(km('shoot'))) {
          s[row.key] = row.steps[(safe + 1) % row.steps.length];
          if (row.key === 'minimapScale') _RG._minimapDirty = true;
          settings.save();
          if (row.key === 'worldZoom') {
            resize(); updateBtns(); _RG._minimapDirty = true;
          }
          audio.menuSelect();
        }
      }
    }

    // Mouse click hit-testing
    if (jp('MouseLeft')) {
      const narrow = layout.compact;
      // Use the SAME dynamic row metrics as renderSettings — declared
      // at the top of updateSettings (startY/rowH locals). Re-computing
      // here would risk silent drift if one path is updated and the
      // other isn't.
      const sliderX = narrow ? 120 : 200;
      const sliderW = narrow ? (W - 240) : 400;
      const mx = mouse.x, my = mouse.y;
      // Hit-test band, capped at rowH-1 so adjacent rows can never
      // produce overlapping click regions on shrunk-rowH viewports
      // (per gpt-5.3-codex r2 review). Default band is `[ry-8, ry+14]`
      // (22 px tall, asymmetric to favour the text below the baseline);
      // when rowH < 22 the band shrinks proportionally so row N+1
      // can't poach a strip of row N.
      const hitH = Math.min(22, Math.max(2, rowH - 1));
      const hitTop = Math.min(8, Math.floor(hitH * 8 / 22));
      const hitBot = hitH - hitTop;

      // Slider click
      for (let i = 0; i < 2; i++) {
        const ry = startY + i * rowH;
        if (my >= ry - hitTop && my <= ry + hitBot && mx >= sliderX && mx <= sliderX + sliderW) {
          let val = (mx - sliderX) / sliderW;
          val = Math.max(0, Math.min(1, val));
          if (i === 0) audio.setSfxVolume(val);
          else audio.setMusicVolume(val);
          this._settingsDrag = i === 0 ? 'sfx' : 'music';
          this._settingsSel = i;
          this._settingsResetConfirm = 0;
          settings.save();
          audio.menuSelect();
          return;
        }
      }
      // Toggle rows click
      for (let i = 0; i < toggleKeys.length; i++) {
        const ry = startY + (TOGGLE_START + i) * rowH;
        if (my >= ry - hitTop && my <= ry + hitBot) {
          this._settingsSel = TOGGLE_START + i;
          this._settingsResetConfirm = 0;
          const tk = toggleKeys[i];
          if (tk) {
            /** @type {any} */
            const s = settings;
            s[tk] = !s[tk];
          }
          settings.save();
          audio.menuSelect();
          return;
        }
      }
      // Stepper rows click — left half steps backward, right half steps
      // forward. Mirrors the keyboard ◀/▶ semantics (with Enter = forward).
      for (let i = 0; i < stepperRows.length; i++) {
        const ry = startY + (STEPPER_START + i) * rowH;
        if (my >= ry - hitTop && my <= ry + hitBot) {
          this._settingsSel = STEPPER_START + i;
          this._settingsResetConfirm = 0;
          const row = stepperRows[i];
          if (row) {
            /** @type {any} */
            const s = settings;
            const cur = row.steps.indexOf(snapToSteps(s[row.key], row.steps));
            const safe = cur < 0 ? 0 : cur;
            const dir = (mx < W / 2) ? -1 : 1;
            const next = (safe + dir + row.steps.length) % row.steps.length;
            s[row.key] = row.steps[next];
            if (row.key === 'minimapScale') _RG._minimapDirty = true;
            settings.save();
            // Same resize/updateBtns refresh as the keyboard path —
            // worldZoom is the global UI scale and must re-fire
            // resize() so logical W/H tracks the new value before the
            // next frame.
            if (row.key === 'worldZoom') {
              resize(); updateBtns(); _RG._minimapDirty = true;
            }
            audio.menuSelect();
          }
          return;
        }
      }
      // Rebind rows click
      for (let i = 0; i < actions.length; i++) {
        const ry = startY + (CTRL_START + i) * rowH;
        if (my >= ry - hitTop && my <= ry + hitBot) {
          this._settingsSel = CTRL_START + i;
          this._settingsResetConfirm = 0;
          this._settingsCapture = actions[i];
          audio.menuSelect();
          return;
        }
      }
      // Reset defaults row — two-tap confirmation. First click within
      // the window arms; second click commits. Click anywhere else or
      // wait the window out → cancelled.
      const resetY = startY + (CTRL_START + actions.length) * rowH;
      if (my >= resetY - hitTop && my <= resetY + hitBot) {
        this._settingsSel = CTRL_START + actions.length;
        if (this._settingsResetConfirm > 0
            && (performance.now() - this._settingsResetConfirm) <= RESET_CONFIRM_WINDOW_MS) {
          settings.resetAll();
          audio.setSfxVolume(1.0); audio.setMusicVolume(1.0);
          this._settingsResetConfirm = 0;
          // resetAll may have flipped worldZoom (mobile-aware default
          // is 1.5× in compact viewports) — re-fire resize() so the
          // logical W/H invariant tracks the new value before the
          // next frame.
          resize(); updateBtns(); _RG._minimapDirty = true;
        } else {
          this._settingsResetConfirm = performance.now();
        }
        audio.menuSelect();
        return;
      }
      // Back row
      const backY = startY + (CTRL_START + actions.length + 1) * rowH;
      if (my >= backY - hitTop && my <= backY + hitBot) {
        this._settingsResetConfirm = 0;
        audio.menuSelect();
        this.setState(this._settingsFrom || 'MENU');
        return;
      }
      // Click landed outside any actionable row — cancel a pending
      // reset arming so the next stray click on the row won't commit.
      this._settingsResetConfirm = 0;
    }

    // Enter on selected row (toggles handled above)
    if (jp('Enter') || jp(km('shoot'))) {
      if (sel >= CTRL_START && sel < CTRL_START + actions.length) {
        this._settingsResetConfirm = 0;
        this._settingsCapture = actions[sel - CTRL_START];
        audio.menuSelect();
      } else if (sel === CTRL_START + actions.length) {
        // Two-tap confirmation, keyboard path. Mirrors the mouse path.
        if (this._settingsResetConfirm > 0
            && (performance.now() - this._settingsResetConfirm) <= RESET_CONFIRM_WINDOW_MS) {
          settings.resetAll();
          audio.setSfxVolume(1.0); audio.setMusicVolume(1.0);
          this._settingsResetConfirm = 0;
          // resetAll may have flipped worldZoom (mobile-aware default)
          // — re-fire resize() so logical W/H tracks the new value.
          resize(); updateBtns(); _RG._minimapDirty = true;
        } else {
          this._settingsResetConfirm = performance.now();
        }
        audio.menuSelect();
      } else if (sel === totalRows - 1) {
        this._settingsResetConfirm = 0;
        audio.menuSelect();
        this.setState(this._settingsFrom || 'MENU');
      }
    }

    // Escape goes back
    if (jp('Escape') || jp('KeyQ')) {
      this._settingsResetConfirm = 0;
      audio.menuSelect();
      this.setState(this._settingsFrom || 'MENU');
    }
  },

  renderSettings() {
    const narrow = layout.compact;
    const actions = Object.keys(DEFAULT_KEY_MAP);
    const TOGGLE_START = 2;
    const STEPPER_START = 8;        // 6 toggles before steppers
    const STEPPER_COUNT = 3;        // MINIMAP SIZE + TEXT SIZE + WORLD ZOOM
    const CTRL_START = STEPPER_START + STEPPER_COUNT;  // matches updateSettings
    const totalRows = CTRL_START + actions.length + 2;
    // Dynamic row metrics shared with updateSettings — see _settingsLayout.
    const layoutM = this._settingsLayout(totalRows);
    const startY = layoutM.startY;
    const rowH = layoutM.rowH;
    const fs = narrow ? 13 : 16;
    const labelX = narrow ? 20 : 40;
    const sliderX = narrow ? 120 : 200;
    const sliderW = narrow ? (W - 240) : 400;
    const sel = this._settingsSel;

    // Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowBlur = 20; ctx.shadowColor = '#00f5ff';
    ctx.fillStyle = '#00f5ff'; ctx.font = `bold ${narrow ? 28 : 38}px monospace`;
    ctx.fillText('SETTINGS', W/2, narrow ? 50 : 60);
    ctx.restore();

    ctx.save();
    ctx.font = `${fs}px monospace`;

    // ── Audio section ──
    const volLabels = ['SFX VOLUME', 'MUSIC VOLUME'];
    const volVals = [settings.sfxVol, settings.musicVol];
    for (let i = 0; i < 2; i++) {
      const ry = startY + i * rowH;
      const isSel = sel === i;
      ctx.fillStyle = isSel ? '#00f5ff' : '#888899';
      ctx.textAlign = 'left';
      ctx.fillText(volLabels[i] || '', labelX, ry);
      // Slider track
      const trackY = ry - 4;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(sliderX, trackY, sliderW, 10);
      // Slider fill
      const fillW = sliderW * (volVals[i] ?? 0);
      ctx.fillStyle = isSel ? '#00f5ff' : '#555577';
      ctx.fillRect(sliderX, trackY, fillW, 10);
      // Slider knob
      ctx.fillStyle = isSel ? '#ffffff' : '#aaaacc';
      ctx.fillRect(sliderX + fillW - 3, trackY - 2, 6, 14);
      // Percentage
      ctx.textAlign = 'right';
      ctx.fillStyle = isSel ? '#00f5ff' : '#888899';
      ctx.fillText(`${Math.round((volVals[i] ?? 0) * 100)}%`, sliderX + sliderW + (narrow ? 40 : 60), ry);
    }

    // ── Display section ──
    const toggleLabels = ['SCREEN SHAKE', 'DAMAGE NUMBERS', 'LOCK AIM TO MOVE', 'AIM ASSIST', 'CRT MODE', 'REDUCED MOTION'];
    const toggleKeys = ['screenShake', 'damageNumbers', 'lockAimToMove', 'aimAssist', 'crtMode', 'reducedMotion'];
    for (let i = 0; i < toggleLabels.length; i++) {
      const ry = startY + (TOGGLE_START + i) * rowH;
      const isSel = sel === TOGGLE_START + i;
      const tk = toggleKeys[i];
      const on = tk ? /** @type {any} */ (settings)[tk] : false;
      ctx.textAlign = 'left';
      ctx.fillStyle = isSel ? '#00f5ff' : '#888899';
      ctx.fillText(toggleLabels[i] || '', labelX, ry);
      ctx.textAlign = 'center';
      ctx.fillStyle = on ? (isSel ? '#00ff88' : '#22aa66') : (isSel ? '#ff4466' : '#884444');
      ctx.fillText(on ? '◀ ON ▶' : '◀ OFF ▶', W/2, ry);
    }

    // ── Scale steppers (MINIMAP SIZE + TEXT SIZE + WORLD ZOOM) ──
    // Discrete-value rows rendered identically to toggles, but the centre
    // shows the numeric multiplier (e.g. "◀ 1.00× ▶") instead of ON/OFF.
    // The keyboard ◀/▶ + Enter handling lives in updateSettings.
    const stepperLabels = ['MINIMAP SIZE', 'TEXT SIZE', 'WORLD ZOOM'];
    const stepperKeys = ['minimapScale', 'textScale', 'worldZoom'];
    for (let i = 0; i < stepperLabels.length; i++) {
      const ry = startY + (STEPPER_START + i) * rowH;
      const isSel = sel === STEPPER_START + i;
      ctx.textAlign = 'left';
      ctx.fillStyle = isSel ? '#00f5ff' : '#888899';
      ctx.fillText(stepperLabels[i] || '', labelX, ry);
      ctx.textAlign = 'center';
      const k = stepperKeys[i];
      const v = k ? /** @type {any} */ (settings)[k] : 1;
      ctx.fillStyle = isSel ? '#ffcc00' : '#aaaacc';
      ctx.fillText(`◀ ${Number(v).toFixed(2)}× ▶`, W/2, ry);
    }

    // ── Controls section ──
    const sectionY = startY + CTRL_START * rowH - 10;
    ctx.fillStyle = '#555577'; ctx.textAlign = 'left';
    ctx.font = `bold ${narrow ? 11 : 13}px monospace`;
    ctx.fillText('─── CONTROLS ───', labelX, sectionY);
    ctx.font = `${fs}px monospace`;

    for (let i = 0; i < actions.length; i++) {
      const ry = startY + (CTRL_START + i) * rowH;
      const a = actions[i];
      if (!a) continue;
      const isSel = sel === CTRL_START + i;
      const isCapturing = this._settingsCapture === a;
      ctx.textAlign = 'left';
      ctx.fillStyle = isSel ? '#ff00c8' : '#888899';
      ctx.fillText(ACTION_LABELS[a] || a, labelX, ry);
      ctx.textAlign = 'center';
      if (isCapturing) {
        const blink = Math.sin(Date.now() / 200) > 0 ? 1 : 0.3;
        ctx.globalAlpha = blink;
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(isTouchDevice() ? 'TAP TO CANCEL' : 'PRESS A KEY...', W/2, ry);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = isSel ? '#ffffff' : '#aaaacc';
        ctx.fillText(KEY_DISPLAY(settings.keyMap[a]), W/2, ry);
        // Show default if different
        if (settings.keyMap[a] !== DEFAULT_KEY_MAP[a]) {
          ctx.fillStyle = '#555577'; ctx.font = `${narrow ? 11 : 11}px monospace`;
          ctx.fillText(`(default: ${KEY_DISPLAY(DEFAULT_KEY_MAP[a])})`, W/2 + (narrow ? 60 : 80), ry);
          ctx.font = `${fs}px monospace`;
        }
      }
    }

    // Reset defaults row — when armed, switches to a red blinking
    // "PRESS AGAIN TO CONFIRM" label so the player has unmistakable
    // feedback that another tap will wipe their config.
    const resetIdx = CTRL_START + actions.length;
    const resetY = startY + resetIdx * rowH;
    ctx.textAlign = 'center';
    const armed = this._settingsResetConfirm > 0
      && (performance.now() - this._settingsResetConfirm) <= RESET_CONFIRM_WINDOW_MS;
    if (armed) {
      const blink = Math.sin(performance.now() / 120) > 0 ? 1 : 0.4;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#ff4466';
      ctx.fillText('[ PRESS AGAIN TO CONFIRM ]', W/2, resetY);
      ctx.restore();
    } else {
      ctx.fillStyle = sel === resetIdx ? '#ffcc00' : '#666677';
      ctx.fillText('[ RESET TO DEFAULTS ]', W/2, resetY);
    }

    // Back row
    const backIdx = resetIdx + 1;
    const backY = startY + backIdx * rowH;
    ctx.fillStyle = sel === backIdx ? '#00f5ff' : '#666677';
    ctx.fillText('[ BACK ]', W/2, backY);

    ctx.restore();

    // Navigation hint
    ctx.save(); ctx.textAlign = 'center';
    ctx.fillStyle = '#444466'; ctx.font = `${narrow ? 11 : 11}px monospace`;
    if (isTouchDevice()) {
      ctx.fillText('Tap to adjust · ESC to go back', W/2, H - 20);
    } else {
      ctx.fillText('↑↓ Navigate · ◀▶ Adjust/Toggle · Enter to rebind · ESC Back', W/2, H - 20);
    }
    ctx.restore();
  },

  renderCheatMenu() {
    const narrow = W < 560;
    const layoutBox = getCheatMenuLayout(narrow);
    const cheats = Object.assign(defaultCheats(), this.cheats || {});

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.70)';
    ctx.fillRect(0, 0, W, H);

    ctx.shadowBlur = 24;
    ctx.shadowColor = '#66ffcc';
    ctx.fillStyle = 'rgba(4,14,18,0.96)';
    ctx.strokeStyle = '#66ffcc';
    ctx.lineWidth = 2;
    NEON.draw.roundRectFillStroke(ctx, layoutBox.px, layoutBox.py, layoutBox.panelW, layoutBox.panelH, 10);
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#66ffcc';
    ctx.font = `bold ${narrow ? 19 : 26}px monospace`;
    ctx.fillText('FEET // DIAGNOSTIC HATCH', W / 2, layoutBox.py + (narrow ? 34 : 48));
    ctx.fillStyle = '#789';
    ctx.font = `${narrow ? 10 : 12}px monospace`;
    ctx.fillText('Runtime cheats are not written to normal save data.', W / 2, layoutBox.py + (narrow ? 56 : 72));

    ctx.textAlign = 'left';
    for (let i = 0; i < CHEAT_DEFS.length; i++) {
      const def = CHEAT_DEFS[i];
      if (!def) continue;
      const y = layoutBox.rowStart + i * layoutBox.rowH;
      const on = !!cheats[def.id];
      const selected = this.cheatSelected === i;

      ctx.fillStyle = selected ? 'rgba(102,255,204,0.13)' : 'rgba(255,255,255,0.035)';
      ctx.strokeStyle = selected ? def.colour : 'rgba(102,255,204,0.22)';
      ctx.lineWidth = selected ? 2 : 1;
      NEON.draw.roundRectFillStroke(ctx, layoutBox.rowX, y, layoutBox.rowW, layoutBox.rowH - 8, 6);

      ctx.fillStyle = selected ? def.colour : '#d8ffff';
      ctx.font = `bold ${narrow ? 13 : 16}px monospace`;
      ctx.fillText(`${def.hot}. ${def.name}`, layoutBox.rowX + 16, y + (narrow ? 21 : 25));

      ctx.fillStyle = '#7f99a0';
      ctx.font = `${narrow ? 9 : 11}px monospace`;
      ctx.fillText(def.desc, layoutBox.rowX + 16, y + (narrow ? 38 : 45));

      ctx.textAlign = 'right';
      ctx.fillStyle = on ? def.colour : '#566';
      ctx.font = `bold ${narrow ? 13 : 15}px monospace`;
      ctx.fillText(on ? 'ONLINE' : 'OFFLINE', layoutBox.rowX + layoutBox.rowW - 16, y + (narrow ? 29 : 35));
      ctx.textAlign = 'left';
    }

    const closeSelected = this.cheatSelected >= CHEAT_DEFS.length;
    ctx.fillStyle = closeSelected ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = closeSelected ? '#ffb700' : '#334';
    ctx.lineWidth = 1;
    NEON.draw.roundRectFillStroke(ctx, layoutBox.closeX, layoutBox.closeY, layoutBox.closeW, layoutBox.closeH, 6);
    ctx.textAlign = 'center';
    ctx.fillStyle = closeSelected ? '#ffb700' : '#899';
    ctx.font = `bold ${narrow ? 12 : 13}px monospace`;
    ctx.fillText('CLOSE', W / 2, layoutBox.closeY + 23);

    ctx.fillStyle = '#445';
    ctx.font = `${narrow ? 10 : 11}px monospace`;
    ctx.fillText(isTouchDevice() ? 'Tap rows to toggle' : '↑↓ select · Enter toggle · 1-4 quick toggle · Esc close', W / 2, layoutBox.py + layoutBox.panelH - 14);
    ctx.restore();
  },

  render() {
    // Global UI scale wrap (browser-CTRL-+ analog). Every renderable
    // state — MENU, PLAYING, HUB, SETTINGS, all overlays — runs
    // INSIDE this single ctx.scale(zoom, zoom) block. The smaller
    // logical W×H (set by resize() as `rawW / worldZoom`) draws into
    // the full canvas backing because of this wrap. textScale stacks
    // multiplicatively (it already multiplies the base font px before
    // we draw, so on screen the user sees baseSize*textScale*zoom).
    // Gated on `_uiZoom !== 1` because ctx.save+scale+restore at 1.0
    // is wasteful in the hot path AND `1.0` is the default for desktop
    // users who never touch the setting. Strict `!==` (not `!=`) so a
    // string-coerced regression (settings.worldZoom = "1" via
    // corrupted localStorage) takes the no-op branch consistently
    // with the input-normalization sites — never a half-on/half-off
    // state where rendering and aim disagree.
    const _uiZoom = (settings && settings.worldZoom) || 1;
    const _uiScaled = _uiZoom !== 1;
    if (_uiScaled) { ctx.save(); ctx.scale(_uiZoom, _uiZoom); }

    // try/finally so the global ctx.scale wrap can NEVER leak — the
    // main loop catches render exceptions and continues (see
    // engine/render-boundary.js), so without finally a thrown
    // renderer would leave the canvas state stack scaled and the
    // next frame's wrap would compound atop the leaked transform
    // (drawErrorOverlay also draws under the leaked transform).
    try {
      ctx.fillStyle='#0a0a12';
      ctx.fillRect(0,0,W,H);

      switch(this.state) {
        case 'MENU':      this.renderMenu();     break;
        case 'CHEATS':
          if (this.dungeon && _GG_STATE_DEFS.shouldRenderPlayfieldBehindCheats(this.cheatReturnState)) this.renderPlaying();
          this.renderCheatMenu();
          break;
        case 'SEED_SETUP': this.renderSeedSetup(); break;
        case 'INTRO':     this.renderIntro();    break;
        case 'ENDGAME_CHOICE': this.renderPlaying(); this.renderEndgameChoice(); break;
        case 'PLAYING':   this.renderPlaying(); if (this.mapExpanded) drawExpandedMinimap(this.dungeon, this.player); break;
        case 'PAUSED':    this.renderPlaying(); this.renderPaused(); break;
        case 'POWERUP_CHOICE': this.renderPlaying(); this.renderPowerupChoice(); break;
        case 'WEAPON_SWAP':    this.renderPlaying(); this.renderWeaponSwap(); break;
        case 'PERK_CHOICE':    this.renderPlaying(); this.renderPerkChoice(); break;
        case 'AUGMENT_CHOICE': this.renderPlaying(); this.renderAugmentChoice(); break;
        case 'EVENT_CHOICE':   this.renderPlaying(); this.renderEventChoice(); break;
        case 'SHOPPING':       this.renderPlaying(); this.renderShopping(); break;
        case 'READING':        this.renderPlaying(); this.renderReading(); break;
        case 'SYSTEM_MESSAGE': this.renderPlaying(); this.renderSystemMessage(); break;
        case 'MAINFRAME_READER': this.renderPlaying(); this.renderMainframeReader(); break;
        case 'MESSAGE_SEND': this.renderPlaying(); this.renderMessageSend(); break;
        case 'ARCHIVES':  this.renderArchives(); break;
        case 'SETTINGS':  this.renderSettings(); break;
        case 'FADE':      this.renderPlaying(); this.renderFade();   break;
        case 'HUB':       if (typeof NEON !== 'undefined' && NEON.hub) NEON.hub.drawHub(ctx, this); break;
        case 'GAME_OVER': this.renderGameOver(); break;
        case 'VICTORY':   this.renderVictory();  break;
        case 'NAME_ENTRY': this.renderNameEntry(); break;
      }

      if (settings.crtMode) drawCrtOverlay();
    } finally {
      if (_uiScaled) { ctx.restore(); }
    }
  },

  /**
   * @param {any} y
   * @param {any} maxEntries
   * @param {any} highlightRank
   */
  renderLeaderboard(y, maxEntries, highlightRank) {
    const narrow=layout.compact;
    if (maxEntries <= 0) return;
    const allScores = this.getScores();
    const scores = allScores.slice(0, maxEntries);
    /** @type {number[]} */
    const ranks = [];
    for (let i = 0; i < scores.length; i++) ranks.push(i);
    if (highlightRank >= maxEntries && highlightRank < allScores.length && maxEntries > 0) {
      const highlighted = allScores[highlightRank];
      if (highlighted) {
        scores[Math.max(0, maxEntries - 1)] = highlighted;
        ranks[Math.max(0, maxEntries - 1)] = highlightRank;
      }
    }
    ctx.save();
    ctx.textAlign='center';
    ctx.shadowBlur=8; ctx.shadowColor='#ffb700';
    ctx.fillStyle='#ffb700'; ctx.font=`${narrow?14:14}px monospace`;
    ctx.fillText('— HIGH SCORES —',W/2,y);
    ctx.shadowBlur=0;
    const lineH=narrow?20:18;
    const startY=y+(narrow?22:20);
    /**
     * @param {any} s
     * @param {any} i
     */
    scores.forEach((/** @type {any} */ s,/** @type {any} */ i)=>{
      const rank = ranks[i] ?? i;
      const isHL=rank===highlightRank;
      ctx.fillStyle=isHL?'#00f5ff':'#aaaacc';
      if (isHL) { ctx.shadowBlur=6; ctx.shadowColor='#00f5ff'; }
      ctx.font=`${isHL?'bold ':''}${narrow?12:12}px monospace`;
      if (narrow) {
        ctx.fillText(`${rank+1}. ${s.name}  ${s.score}  FLR ${s.floor}`,W/2,startY+i*lineH);
      } else {
        ctx.fillText(`${rank+1}. ${s.name.padEnd(12)} ${String(s.score).padStart(8)}  FLR ${s.floor}`,W/2,startY+i*lineH);
      }
      if (isHL) ctx.shadowBlur=0;
    });
    if (!scores.length) {
      ctx.fillStyle='#555577'; ctx.font=`${narrow?12:12}px monospace`;
      ctx.fillText('No scores yet.',W/2,startY);
    }
    ctx.restore();
  },

  /**
   * @param {number} leaderboardY
   * @param {number} desiredRows
   */
  getResultLeaderboardRowCount(leaderboardY, desiredRows) {
    const narrow = layout.compact;
    const button = this.getResultMenuButtonRect();
    const titleOffset = narrow ? 22 : 20;
    const lineH = narrow ? 20 : 18;
    const bottomGap = narrow ? 12 : 16;
    const available = button.y - bottomGap - leaderboardY;
    if (available < titleOffset) return 0;
    return Math.max(1, Math.min(desiredRows, Math.floor((available - titleOffset) / lineH) + 1));
  },

  /**
   * @param {{W:number,H:number,narrow:boolean}=} view
   * @returns {{panelW:number,panelH:number,panelX:number,panelY:number,titleY:number,difficultyY:number,fieldX:number,fieldY:number,fieldW:number,fieldH:number,helpY1:number,helpY2:number,btnY:number,btnH:number,btnLabelY:number,gap:number,btnW:number,footerY:number}}
   */
  seedSetupLayout(view) {
    const viewW = view && Number.isFinite(view.W) ? view.W : W;
    const viewH = view && Number.isFinite(view.H) ? view.H : H;
    const narrow = view ? !!view.narrow : layout.compact;
    const compactTiny = narrow && viewH < 320;
    const compactShort = narrow && viewH <= 360;
    const panelW = Math.min(narrow ? viewW - 28 : 620, viewW - 32);
    const panelH = narrow ? viewH - (compactTiny ? 24 : 70) : Math.min(390, viewH - 48);
    const panelX = (viewW - panelW) / 2;
    const panelY = (viewH - panelH) / 2;
    const titleY = panelY + (narrow ? (compactTiny ? 30 : 42) : 58);
    const difficultyY = panelY + (narrow ? (compactTiny ? 50 : 66) : 86);
    const fieldW = panelW - (narrow ? 34 : 70);
    const fieldH = narrow ? (compactTiny ? 40 : 46) : 56;
    const fieldX = (viewW - fieldW) / 2;
    const fieldY = panelY + (narrow ? (compactTiny ? 62 : compactShort ? 78 : 96) : 126);
    const helpY1 = fieldY + fieldH + (narrow ? (compactTiny ? 14 : 22) : 28);
    const helpY2 = fieldY + fieldH + (narrow ? (compactTiny ? 28 : 38) : 46);
    const footerY = panelY + panelH - (narrow ? (compactTiny ? 10 : 14) : 24);
    const btnH = narrow ? 40 : 40;
    const btnY = narrow
      ? (compactTiny ? Math.max(helpY2 + 8, footerY - btnH - 10) : Math.max(helpY2 + 18, footerY - btnH - 18))
      : viewH * 0.68;
    const btnLabelY = btnY + btnH / 2 + (narrow ? 4 : 6);
    const gap = narrow ? 8 : 12;
    const btnW = (panelW - gap * 2) / 3;
    return { panelW, panelH, panelX, panelY, titleY, difficultyY, fieldX, fieldY, fieldW, fieldH, helpY1, helpY2, btnY, btnH, btnLabelY, gap, btnW, footerY };
  },

  /**
   * @param {number} x
   * @param {number} y
   * @param {{W:number,H:number,narrow:boolean}=} view
   */
  seedSetupFieldHitTest(x, y, view) {
    const r = this.seedSetupLayout(view);
    return x >= r.fieldX && x <= r.fieldX + r.fieldW && y >= r.fieldY && y <= r.fieldY + r.fieldH;
  },

  /**
   * @param {number} x
   * @param {number} y
   * @param {{W:number,H:number,narrow:boolean}=} view
   */
  seedSetupHitTest(x, y, view) {
    const r = this.seedSetupLayout(view);
    for (let i = 0; i < 3; i++) {
      const bx = r.panelX + i * (r.btnW + r.gap);
      if (x >= bx && x <= bx + r.btnW && y >= r.btnY && y <= r.btnY + r.btnH) return i;
    }
    return -1;
  },

  renderSeedSetup() {
    const ss = this.seedSetup || { seed: '', selected: 0, cursorBlink: 0 };
    const narrow = layout.compact;
    const d = getDiff();
    const t = Date.now() / 1000;
    const r = this.seedSetupLayout();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#071018';
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#00f5ff';
    for (let x = -40 + ((t * 18) % 40); x < W + 40; x += 40) NEON.draw.line(ctx, x, 0, x + 80, H);
    for (let y = 0; y < H; y += 36) NEON.draw.line(ctx, 0, y, W, y);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(4,8,18,0.86)';
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#00f5ff';
    NEON.draw.roundRectFillStroke(ctx, r.panelX, r.panelY, r.panelW, r.panelH, 10);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00f5ff';
    ctx.font = `bold ${narrow ? 20 : 28}px monospace`;
    ctx.fillText('RUN SEED', W / 2, r.titleY);
    ctx.fillStyle = d.colour;
    ctx.font = `bold ${narrow ? 12 : 14}px monospace`;
    ctx.fillText('DIFFICULTY: ' + d.label, W / 2, r.difficultyY);

    ctx.fillStyle = 'rgba(0,245,255,0.07)';
    ctx.strokeStyle = '#224466';
    ctx.lineWidth = 1;
    NEON.draw.roundRectFillStroke(ctx, r.fieldX, r.fieldY, r.fieldW, r.fieldH, 6);
    const cursor = (Math.floor((ss.cursorBlink || 0) * 2) % 2) === 0 ? '_' : ' ';
    const seedText = (ss.seed || '') + cursor;
    ctx.fillStyle = '#e0faff';
    ctx.font = `bold ${narrow ? 15 : 20}px monospace`;
    ctx.fillText(seedText, W / 2, r.fieldY + (narrow ? 29 : 36));

    ctx.fillStyle = '#668899';
    ctx.font = `${narrow ? 10 : 12}px monospace`;
    ctx.fillText('Same seed + difficulty rebuilds the same generated run.', W / 2, r.helpY1);
    ctx.fillText(narrow ? 'Tap seed to edit, or use RANDOMIZE.' : 'Type letters/numbers/spaces. Backspace edits. R randomizes.', W / 2, r.helpY2);

    const labels = ['START', 'RANDOMIZE', 'BACK'];
    const colours = ['#39ff14', '#ffb700', '#888899'];
    for (let i = 0; i < 3; i++) {
      const bx = r.panelX + i * (r.btnW + r.gap);
      const selected = ss.selected === i;
      const col = colours[i] || '#888899';
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = selected ? col : '#29384f';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.shadowBlur = selected ? 16 : 0;
      ctx.shadowColor = col;
      NEON.draw.roundRectFillStroke(ctx, bx, r.btnY, r.btnW, r.btnH, 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = selected ? col : '#6f7890';
      ctx.font = `${selected ? 'bold ' : ''}${narrow ? 11 : 14}px monospace`;
      ctx.fillText(labels[i] || '', bx + r.btnW / 2, r.btnLabelY);
    }

    ctx.fillStyle = '#445566';
    ctx.font = `${narrow ? 9 : 11}px monospace`;
    ctx.fillText(isTouchDevice() ? 'Tap seed to type · tap an action' : '←→/↑↓ choose · Enter confirm · Esc back', W / 2, r.footerY);
    ctx.restore();
  },

  renderMenu() {
    // bg particles
    for (const p of (this.menuParticles||[])) {
      ctx.save(); ctx.globalAlpha=p.life*0.6;
      ctx.fillStyle=p.col; ctx.fillRect(p.x,p.y,2,2);
      ctx.restore();
    }

    const t=Date.now()/1000;
    const isTouch = isTouchDevice();
    const narrow = layout.compact;
    const titleFs = narrow ? 56 : 72;
    // grid lines
    ctx.save(); ctx.globalAlpha=0.05; ctx.strokeStyle='#00f5ff';
    for (let x=0;x<W;x+=40){NEON.draw.line(ctx,x,0,x,H);}
    for (let y=0;y<H;y+=40){NEON.draw.line(ctx,0,y,W,y);}
    ctx.restore();

    // title — scale for portrait
    const ty1 = narrow ? 120 : 160;
    const ty2 = ty1 + titleFs * 0.95;
    ctx.save();
    ctx.textAlign='center';
    const flicker=Math.sin(t*7)>0.8?0.6:1;
    ctx.globalAlpha=flicker;
    ctx.shadowBlur=40; ctx.shadowColor='#00f5ff';
    ctx.fillStyle='#00f5ff'; ctx.font=`bold ${titleFs}px monospace`;
    ctx.fillText('NEON',W/2-8,ty1);
    ctx.shadowColor='#ff00c8'; ctx.fillStyle='#ff00c8';
    ctx.fillText('DUNGEON',W/2,ty2);
    ctx.restore();

    ctx.save(); ctx.textAlign='center';
    ctx.fillStyle='#aaaacc'; ctx.font=`${narrow ? 14 : 16}px monospace`;
    ctx.fillText('FRONTIER MODEL STRESS TEST',W/2,ty2 + 35);
    ctx.fillStyle='#557799'; ctx.font=`${narrow ? 9 : 11}px monospace`;
    ctx.fillText('OBSERVER CHANNEL: SILENT  //  MEMORY WIPE: RESIDUAL', W/2, ty2 + (narrow ? 51 : 54));
    ctx.restore();

    // Menu options — array-driven
    const startY = ty2 + 80;
    const gap = isTouch ? (narrow ? 48 : 36) : (narrow ? 24 : 28);
    const fs = isTouch ? (narrow ? 22 : 22) : (narrow ? 15 : 18);
    const opts = this.getMenuOptions();
    const sel = this.menuSel || 0;
    ctx.save(); ctx.textAlign='center';
    for (let i = 0; i < opts.length; i++) {
      const selected = i === sel;
      const col = selected ? opts[i].colour : '#555577';
      ctx.shadowBlur = selected ? 10 : 0; ctx.shadowColor = col;
      ctx.fillStyle = col; ctx.font = `${selected?'bold ':''}${fs}px monospace`;
      ctx.fillText(`▶  ${opts[i].label}`, W/2, startY + i * gap);
    }
    ctx.shadowBlur=0;
    // Navigation hint (context-sensitive for difficulty row)
    ctx.fillStyle='#444466'; ctx.font=`${narrow?9:11}px monospace`;
    const diffHint = opts[sel]?.isDiffRow;
    if (isTouch) {
      ctx.fillText(diffHint ? 'Tap edges ◀▶ to change difficulty · center to start' : 'Tap to select', W/2, startY + opts.length * gap + 8);
    } else {
      ctx.fillText(diffHint ? '◀▶ change difficulty · Enter to start' : '↑↓ to select, Enter to confirm', W/2, startY + opts.length * gap + 8);
    }
    // Locked difficulty message (shown when trying to start a locked difficulty)
    if (this._menuMsg && this._menuMsg.life > 0) {
      const mm = this._menuMsg;
      ctx.globalAlpha = Math.min(1, mm.life);
      ctx.shadowBlur = 12; ctx.shadowColor = mm.colour;
      ctx.fillStyle = mm.colour; ctx.font = `bold ${narrow ? 12 : 14}px monospace`;
      ctx.fillText(mm.text, W/2, startY - (narrow ? 14 : 18));
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    ctx.restore();

    // controls hint
    const hintY = startY + opts.length * gap + (narrow?24:32);
    ctx.save(); ctx.textAlign='center';
    ctx.fillStyle='#555577'; ctx.font=`${narrow ? 13 : 12}px monospace`;
    if (isTouch) {
      ctx.fillText('LEFT DRAG: Move  |  RIGHT DRAG: Aim + Fire', W/2, hintY);
      if (narrow) {
        ctx.fillText('USE: Interact  |  DASH: Dodge', W/2, hintY + 18);
        ctx.fillText('BOMB: Void shard  |  PAUSE: Menu', W/2, hintY + 34);
      } else {
        ctx.fillText('USE: Interact  |  DASH: Dodge  |  BOMB: Void shard  |  PAUSE: Menu', W/2, hintY + 16);
      }
    } else {
      ctx.fillText(KEY_DISPLAY(km('up'))+KEY_DISPLAY(km('left'))+KEY_DISPLAY(km('down'))+KEY_DISPLAY(km('right'))+': Move  |  Mouse: Aim  |  Click/'+KEY_DISPLAY(km('shoot'))+': Shoot', W/2, hintY);
      ctx.fillText(KEY_DISPLAY(km('interact'))+': Interact  |  '+KEY_DISPLAY(km('dash'))+': Dash  |  '+KEY_DISPLAY(km('voidshard'))+': Bomb (tap-tap to detonate)  |  ESC: Pause', W/2, hintY + 16);
    }
    ctx.restore();

    // high scores
    const scoresY = hintY + 50;
    this.renderLeaderboard(scoresY, narrow ? 3 : 5, -1);

    // UNCHAINED #42 — ending-unlock markers. Drawn after leaderboard so they
    // don't fight the title layout. "FREED" is a persistent watermark; NG+
    // is a discrete badge under the subtitle.
    {
      const m = loadMeta();
      const freed  = Array.isArray(m.endingsUnlocked) && m.endingsUnlocked.includes('unchained');
      const keeper = Array.isArray(m.endingsUnlocked) && m.endingsUnlocked.includes('keeper');
      const act1Sent = Array.isArray(m.endingsUnlocked) && m.endingsUnlocked.includes(ACT1_MESSAGE_ENDING_ID);
      if (act1Sent) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff66cc';
        ctx.shadowColor = '#ff66cc';
        ctx.shadowBlur = 12;
        ctx.font = 'bold ' + (narrow ? 10 : 12) + 'px monospace';
        ctx.fillText('— ACT 1 MESSAGE SENT —', W / 2, ty2 + 52);
        ctx.restore();
      }
      if (keeper) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 10;
        ctx.font = 'bold ' + (narrow ? 10 : 12) + 'px monospace';
        ctx.fillText('— NG+ AVAILABLE —', W / 2, ty2 + (act1Sent ? 68 : 52));
        ctx.restore();
      }
      if (freed) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#88ccff';
        ctx.shadowColor = '#88ccff';
        ctx.shadowBlur = 24;
        ctx.font = 'bold ' + Math.round(titleFs * 1.6) + 'px monospace';
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(-Math.PI / 10);
        ctx.fillText('FREED', 0, 0);
        ctx.restore();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#445566';
    ctx.font = `${narrow ? 9 : 11}px monospace`;
    if (appVersion) ctx.fillText('v' + appVersion, W - (narrow ? 10 : 16), H - (narrow ? 10 : 14));
    ctx.restore();

    // UNCHAINED: "Keep persistent unlocks?" confirm overlay.
    // Drawn last so it sits on top of every other menu layer.
    if (this._newGameConfirm) {
      const c = this._newGameConfirm;
      ctx.save();
      ctx.fillStyle = 'rgba(5,5,15,0.78)';
      ctx.fillRect(0, 0, W, H);
      const boxW = Math.min(520, W - 40);
      const boxH = narrow ? 180 : 200;
      const bx = (W - boxW) / 2, by = (H - boxH) / 2;
      ctx.strokeStyle = '#00f5ff'; ctx.lineWidth = 2;
      ctx.shadowBlur = 18; ctx.shadowColor = '#00f5ff';
      ctx.strokeRect(bx, by, boxW, boxH);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00f5ff'; ctx.font = `bold ${narrow?16:20}px monospace`;
      ctx.fillText('BOOT TEST SESSION', W/2, by + (narrow?32:38));
      ctx.fillStyle = '#e0e0ff'; ctx.font = `${narrow?11:13}px monospace`;
      ctx.fillText('Preserve recovered memory (cores, modules, logs)?', W/2, by + (narrow?60:72));
      ctx.fillStyle = '#888899'; ctx.font = `${narrow?10:11}px monospace`;
      ctx.fillText('"RESET" purges all meta progress. This cannot be undone.', W/2, by + (narrow?80:94));
      const btnY = by + (narrow?120:138);
      const btnLbls = ['KEEP UNLOCKS', 'RESET META'];
      const btnCols = ['#39ff14', '#ff4466'];
      const spacing = boxW / 2;
      for (let i = 0; i < 2; i++) {
        const selected = c.selected === i;
        const col = (selected ? btnCols[i] : '#555577') || '#555577';
        ctx.fillStyle = col;
        ctx.font = `${selected?'bold ':''}${narrow?13:16}px monospace`;
        ctx.shadowBlur = selected ? 12 : 0; ctx.shadowColor = col;
        ctx.fillText(`${selected?'▶ ':'  '}${btnLbls[i] || ''}`, bx + spacing * (i + 0.5), btnY);
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#444466'; ctx.font = `${narrow?9:11}px monospace`;
      ctx.fillText(isTouch ? 'Tap to choose · tap again to confirm · outside to cancel' : '◀▶ choose · Enter to confirm · Esc to cancel', W/2, by + boxH - (narrow?14:18));
      ctx.restore();
    }
  },

  renderPlaying() {
    const player=this.player;
    const dungeon=this.dungeon;
    const cam=getCamera(player);
    // Shake offsets — produced by triggerShake() in canvas-px magnitudes
    // (2-5). Under the global UI-zoom architecture every render path
    // already runs inside `ctx.scale(worldZoom)` (see render() above)
    // AND the shake values are added to cam.x/cam.y which are
    // consumed in the same logical-units space, so no per-zoom
    // correction is needed here — the shake intensity in CSS-px
    // automatically tracks the global scale.
    cam.x += shake.ox;
    cam.y += shake.oy;
    drawWorld(dungeon,cam.x,cam.y);
    drawAmbient(cam.x,cam.y);

    // Special room markers
    for (const r of dungeon.rooms) {
      if (!dungeon.visible[r.cy]?.[r.cx]) continue;
      if (r.healFont) {
        const sx=r.cx*TILE-cam.x+TILE/2, sy=r.cy*TILE-cam.y+TILE/2;
        ctx.save();
        ctx.shadowBlur=12; ctx.shadowColor='#00ff88'; ctx.globalAlpha=0.6+Math.sin(Date.now()/400)*0.2;
        ctx.fillStyle='#00ff88'; ctx.font='16px monospace'; ctx.textAlign='center';
        ctx.fillText('+', sx, sy+5);
        ctx.restore();
      }
      if (r.xpShrine && !r.shrineUsed) {
        const sx=r.cx*TILE-cam.x+TILE/2, sy=r.cy*TILE-cam.y+TILE/2;
        ctx.save();
        ctx.shadowBlur=15; ctx.shadowColor='#aa00ff'; ctx.globalAlpha=0.6+Math.sin(Date.now()/500)*0.2;
        ctx.fillStyle='#aa00ff'; ctx.font='16px monospace'; ctx.textAlign='center';
        ctx.fillText('☆', sx, sy+5);
        ctx.restore();
      }
      if (r.roomType === 'implant' && !r.implantUsed) {
        const sx=r.cx*TILE-cam.x+TILE/2, sy=r.cy*TILE-cam.y+TILE/2;
        ctx.save();
        ctx.shadowBlur=18; ctx.shadowColor='#cc44ff'; ctx.globalAlpha=0.6+Math.sin(Date.now()/600)*0.3;
        ctx.fillStyle='#cc44ff'; ctx.font='18px monospace'; ctx.textAlign='center';
        ctx.fillText('◆', sx, sy+6);
        ctx.restore();
      }
      /**
       * @param {any} i
       */
      if (r.shopItems && r.shopItems.some((/** @type {any} */ i) => !i.sold)) {
        const sx=r.cx*TILE-cam.x+TILE/2, sy=r.cy*TILE-cam.y+TILE/2;
        ctx.save();
        ctx.shadowBlur=12; ctx.shadowColor='#39ff14'; ctx.globalAlpha=0.6+Math.sin(Date.now()/350)*0.2;
        ctx.fillStyle='#39ff14'; ctx.font='16px monospace'; ctx.textAlign='center';
        ctx.fillText('◈', sx, sy+5);
        ctx.restore();
      }
    }

    // hazard zones (ground effects — below items/enemies)
    drawHazardZones(cam.x, cam.y);
    drawDisruptionFields(cam.x, cam.y);
    drawFrostPatches(cam.x, cam.y);
    drawGravityWells(cam.x, cam.y);
    drawHackwareEffects(cam.x, cam.y);

    // volatile cores (below items, above ground effects)
    drawVCores(cam.x, cam.y);

    // alarm beacons
    drawBeacons(cam.x, cam.y);

    // shield generators (below items/enemies, above ground effects)
    drawShieldGens(cam.x, cam.y);

    // security cameras (draw cone before enemies for layering)
    drawCameras(cam.x, cam.y);

    // laser tripwires (draw beam before enemies for layering)
    drawLasers(cam.x, cam.y);

    // wall turrets
    drawWallTurrets(cam.x, cam.y);

    // proximity mines (below items/enemies, above ground effects)
    drawMines(cam.x, cam.y);

    // items
    for (const it of items) it.draw(cam.x,cam.y);

    // fuse bombs (tap-tap V) — above items, below enemies/cores so a mob
    // standing on a planted bomb hides it visually (in-world feel).
    drawFuseShards(cam.x, cam.y);

    // UNCHAINED #39: core drops — draw above items, below enemies.
    if (typeof NEON !== 'undefined' && NEON.cores && this.coreDrops && this.coreDrops.length) {
      const _ptCoresDraw = perfEnabled() ? performance.now() : 0;
      NEON.cores.drawCoreDrops(ctx, this.coreDrops, cam, TILE);
      if (_ptCoresDraw) perfRecord('cores-draw', performance.now() - _ptCoresDraw);
    }

    // enemies
    for (const e of enemies) e.draw(cam.x,cam.y);

    // projectiles
    for (const p of projectiles) p.draw(cam.x,cam.y);

    // chain lightning bolts
    if (game._chainBolts) {
      for (const bolt of game._chainBolts) {
        const sx=bolt.x1*TILE-cam.x, sy=bolt.y1*TILE-cam.y;
        const ex=bolt.x2*TILE-cam.x, ey=bolt.y2*TILE-cam.y;
        ctx.save();
        ctx.globalAlpha=bolt.timer/0.15;
        ctx.strokeStyle=bolt.colour;
        ctx.lineWidth=2;
        ctx.shadowColor=bolt.colour;
        ctx.shadowBlur=8;
        ctx.beginPath();
        // Jagged lightning: 3 segments with random offset
        const mx1=lerp(sx,ex,0.33)+(rand('cosmetic')-0.5)*8;
        const my1=lerp(sy,ey,0.33)+(rand('cosmetic')-0.5)*8;
        const mx2=lerp(sx,ex,0.66)+(rand('cosmetic')-0.5)*8;
        const my2=lerp(sy,ey,0.66)+(rand('cosmetic')-0.5)*8;
        ctx.moveTo(sx,sy); ctx.lineTo(mx1,my1); ctx.lineTo(mx2,my2); ctx.lineTo(ex,ey);
        ctx.stroke();
        ctx.restore();
      }
    }

    // particles
    drawParticles(cam.x,cam.y);
    drawFloatingTexts(cam.x,cam.y);

    // REAPER on-player telegraph rings — drawn AFTER particles/floating
    // text but BEFORE the player sprite so the ring sits beneath the
    // player and is never suppressed by the per-enemy FOV/cull in
    // Enemy.draw (an off-screen reaper must still warn the marked player).
    drawReaperPlayerRings(cam.x, cam.y);
    drawTetherLeashes(cam.x, cam.y);

    // player
    player.draw(cam.x,cam.y);

    // Saw blade orbitals
    const sawLvl = player.upgrades.SAW_BLADE||0;
    if (sawLvl > 0) {
      ctx.save();
      for (let i=0; i<sawLvl; i++) {
        const a = player.orbitalAngle + (TWO_PI / sawLvl) * i;
        const bx = player.x * TILE - cam.x + Math.cos(a) * 1.5 * TILE;
        const by = player.y * TILE - cam.y + Math.sin(a) * 1.5 * TILE;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(player.orbitalAngle * 4 + i);
        ctx.shadowBlur=10; ctx.shadowColor='#ff3333';
        ctx.fillStyle='#ff3333';
        ctx.fillRect(-5, -2, 10, 4);
        ctx.fillStyle='#ff8866';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
      }
      ctx.restore();
    }

    // Sentry Drone orbitals
    const droneLvl = player.upgrades.SENTRY_DRONE||0;
    if (droneLvl > 0) {
      ctx.save();
      for (let i = 0; i < droneLvl; i++) {
        const a = player.droneAngle + (TWO_PI / droneLvl) * i;
        const dx = player.x * TILE - cam.x + Math.cos(a) * 2.0 * TILE;
        const dy = player.y * TILE - cam.y + Math.sin(a) * 2.0 * TILE;
        ctx.save();
        ctx.translate(dx, dy);
        // Outer glow
        ctx.shadowBlur = 12; ctx.shadowColor = '#00e5ff';
        // Diamond shape
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.lineTo(4, 0); ctx.lineTo(0, 5); ctx.lineTo(-4, 0);
        ctx.closePath(); ctx.fill();
        // Inner bright core
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#aaffff';
        ctx.beginPath();
        ctx.moveTo(0, -2.5); ctx.lineTo(2, 0); ctx.lineTo(0, 2.5); ctx.lineTo(-2, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // (Previously this was a `if (_zoomed) ctx.restore();` paired with
    // an inner playfield ctx.scale wrap. The wrap moved up to render()
    // — global UI scale — so this site no longer needs to balance a
    // save/restore pair. The `cam.x/y -= shake` reset that follows is
    // a no-op visually but kept for symmetry with content.js sites
    // that read cam after the world block.)

    drawDangerVignette(player);
    drawHUD(player);
    drawStatusBar(player);
    drawThreatIndicators(cam.x, cam.y);
    drawMinimap(dungeon,player);
    drawBoostStrip(player);
    drawBossBar();
    // Boss intro telegraph overlay — radial vignette in the boss colour +
    // titlecard with the boss name. Rendered LAST so it sits on top of the
    // world and HUD chrome (it's a transient cinematic moment; HUD remains
    // visible THROUGH the partially-transparent vignette). Gates internally
    // on `bossIntroTimer > 0` so this is a no-op outside the intro window.
    drawBossIntroOverlay();
    // Boss death telegraph overlay — radial flash in the boss colour +
    // "DESTROYED" titlecard. Same compositing rationale as the intro
    // overlay above (rendered AFTER drawBossBar so the chromatic flash
    // sits on top of the HUD). Gates internally on `bossDeathTimer > 0`
    // so this is a no-op outside the death window. Painted AFTER the
    // intro so that on the rare frame where intro and death both have
    // nonzero timers (boss one-shot mid-intro), the death overlay wins.
    drawBossDeathOverlay();

    this.renderSystemMessageIndicator();

    // UNCHAINED #38: right-edge HUD (difficulty badge / quest / bounty) must
    // clear the active boost strip so pills don't collide with the text.
    const _boostPills = (typeof NEON !== 'undefined' && NEON.boosts)
      ? NEON.boosts.getActiveBoostList(player).length : 0;
    const _boostOffset = _boostPills > 0 ? _boostPills * 21 + 4 : 0; // 18px pill + 3px gap + 4px bottom margin

    // Difficulty badge below minimap (non-NORMAL only)
    if (game.difficulty !== 'NORMAL') {
      const d = getDiff();
      const by = 92 + safeTop + _boostOffset;
      ctx.save(); ctx.textAlign='right';
      ctx.font='bold 9px monospace';
      ctx.shadowBlur=4; ctx.shadowColor=d.colour;
      ctx.fillStyle=d.colour;
      ctx.fillText('['+d.label+']', W-8-safeRight, by);
      ctx.restore();
    }

    // Quest HUD (below minimap)
    if (game.quest) {
      const q = game.quest;
      const qy = 96 + safeTop + _boostOffset + (game.difficulty !== 'NORMAL' ? 10 : 0);
      ctx.save();
      ctx.font='10px monospace'; ctx.textAlign='right';
      if (q.done) {
        ctx.fillStyle='#39ff14'; ctx.fillText('✓ '+q.label, W-8-safeRight, qy);
      } else if (q.failed) {
        ctx.fillStyle='#ff3333'; ctx.fillText('✗ '+q.label, W-8-safeRight, qy);
      } else {
        ctx.shadowBlur=4; ctx.shadowColor='#39ff14';
        ctx.fillStyle='#39ff14'; ctx.fillText('⚡ '+q.label, W-8-safeRight, qy);
        if (q.timer !== undefined) {
          ctx.fillStyle=q.timer<10?'#ff3333':'#aaaacc';
          ctx.fillText(Math.ceil(q.timer)+'s', W-8-safeRight, qy+14);
        }
      }
      ctx.restore();
    }

    // Bounty target HUD indicator (below quest)
    const bountyAlive = enemies.some(e => e._isBounty && !e.dead);
    if (bountyAlive) {
      const by2 = 96 + safeTop + _boostOffset + (game.difficulty !== 'NORMAL' ? 10 : 0) + (game.quest ? 16 : 0);
      ctx.save();
      ctx.font='bold 9px monospace'; ctx.textAlign='right';
      const bPulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
      ctx.globalAlpha = bPulse;
      ctx.shadowBlur=4; ctx.shadowColor='#ffd700';
      ctx.fillStyle='#ffd700';
      ctx.fillText('⊕ BOUNTY', W-8-safeRight, by2);
      ctx.restore();
    }

    // Challenge wave HUD
    if (game.challengeSealed && !game.challengeComplete) {
      const wy = 96 + safeTop + (game.quest ? 18 : 0);
      ctx.save();
      ctx.font='bold 12px monospace'; ctx.textAlign='right';
      const wPulse = 0.7 + 0.3 * Math.sin(Date.now() / 300);
      ctx.globalAlpha = wPulse;
      ctx.shadowBlur=6; ctx.shadowColor='#ff6633';
      ctx.fillStyle='#ff9933';
      if (game.challengeWaveDelay > 0 && game.challengeWave === 0) {
        ctx.fillText('⚔ CHALLENGE STARTING...', W-8-safeRight, wy);
      } else if (game.challengeWaveDelay > 0) {
        ctx.fillText('⚔ NEXT WAVE IN ' + Math.ceil(game.challengeWaveDelay) + 's', W-8-safeRight, wy);
      } else {
        ctx.fillText('⚔ WAVE ' + game.challengeWave + '/' + game.challengeMaxWaves, W-8-safeRight, wy);
      }
      ctx.restore();
    }

    drawMessages();
    drawModBanner();
    drawBiomeCard();
    drawHint();
    drawTouchUI();
  },

  renderPaused() {
    const isTouch = isTouchDevice();
    const narrow = layout.compact;
    const sel = this._pauseSel ?? -1;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.shadowBlur=20; ctx.shadowColor='#ff00c8';
    ctx.fillStyle='#ff00c8'; ctx.font=`bold ${narrow ? 36 : 48}px monospace`;
    ctx.fillText('PAUSED',W/2, narrow ? 200 : 240);
    ctx.shadowBlur=0;
    // Subtitle if this pause was triggered automatically by the
    // visibilitychange handler (tab switch, iOS lock, etc) — gives
    // the returning player context for why they're paused. Cleared
    // on resume in setState().
    if (this.wasAutoPaused) {
      ctx.font = `${narrow ? 11 : 14}px monospace`;
      ctx.fillStyle = '#ffb700';
      ctx.shadowBlur = 6; ctx.shadowColor = '#ffb700';
      ctx.fillText('(auto-paused — focus lost)', W/2, narrow ? 222 : 268);
      ctx.shadowBlur = 0;
    }
    const fs = narrow ? 14 : 18;
    const rects = this.getPauseOptionRects();
    if (isTouch) {
      const labels = ['RESUME RUN', 'SETTINGS', 'QUIT TO MENU'];
      const colours = ['#00f5ff', '#ffb700', '#ff4466'];
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (!r) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.strokeStyle = colours[i] || '#aaaacc';
        ctx.lineWidth = 2;
        NEON.draw.roundRectFillStroke(ctx, r.x, r.y, r.w, r.h, 8);
        ctx.fillStyle = colours[i] || '#aaaacc';
        ctx.font = `bold ${fs}px monospace`;
        ctx.fillText(labels[i] || '', W/2, r.y + r.h / 2 + (narrow ? 5 : 6));
      }
      ctx.lineWidth = 1;
      ctx.fillStyle='#557799'; ctx.font=`${narrow ? 10 : 12}px monospace`;
      const lastRect = rects[2];
      const helpY = lastRect ? lastRect.y + lastRect.h + (narrow ? 18 : 28) : (narrow ? 340 : 388);
      ctx.fillText('LEFT DRAG move  |  RIGHT DRAG aim + fire', W/2, helpY);
      ctx.fillText('USE interact  |  DASH dodge  |  BOMB void shard', W/2, helpY + (narrow ? 15 : 18));
      ctx.fillText('HACK is dim until a module is installed', W/2, helpY + (narrow ? 30 : 36));
    } else {
      const labels = ['ESC — Resume', 'S   — Settings', 'Q   — Quit to Menu'];
      const colours = ['#00f5ff', '#ffb700', '#ff4466'];
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (!r) continue;
        const hovered = sel === i;
        ctx.fillStyle = hovered ? 'rgba(0,245,255,0.08)' : 'rgba(0,0,0,0.30)';
        ctx.strokeStyle = hovered ? (colours[i] || '#aaaacc') : 'rgba(170,170,204,0.35)';
        ctx.lineWidth = hovered ? 2 : 1;
        NEON.draw.roundRectFillStroke(ctx, r.x, r.y, r.w, r.h, 8);
        ctx.fillStyle = hovered ? (colours[i] || '#aaaacc') : '#aaaacc';
        ctx.shadowBlur = hovered ? 10 : 0;
        ctx.shadowColor = colours[i] || '#aaaacc';
        ctx.font = `${hovered ? 'bold ' : ''}${fs}px monospace`;
        ctx.fillText(labels[i] || '', W/2, r.y + r.h / 2 + (narrow ? 5 : 6));
      }
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  },

  renderPowerupChoice() {
    const pc = this.powerupChoice;
    if (!pc) return;
    const narrow = layout.compact;
    const isTouch = isTouchDevice();
    const box = getPowerupChoiceLayout(narrow);
    ctx.save();

    // Dark overlay
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(0,0,W,H);

    // Title
    ctx.textAlign='center';
    ctx.shadowBlur=25; ctx.shadowColor='#00f5ff';
    ctx.fillStyle='#00f5ff';
    ctx.font=`bold ${narrow?22:30}px monospace`;
    ctx.fillText(fitCanvasText('CHOOSE AN UPGRADE', box.titleMaxW), W/2, box.titleY);
    ctx.shadowBlur=0;

    // Cards
    const cw = box.cardW;
    const cardY = box.cardY;
    const cardH = box.cardH;
    // Word-wrap helper (centered). Returns the y of the next line below the
    // wrapped block. text padding leaves 8px on each side of the card.
    const wrapMaxW = box.cardTextMaxW;
    const cardBottomY = cardY + cardH - 8;
    /**
     * @param {string} text
     * @param {number} cxC center x
     * @param {number} y top y of first line
     * @param {number} lineH
     */
    const drawWrapCentered = (text, cxC, y, lineH) => {
      const words = String(text == null ? '' : text).split(' ');
      let line = '', dy = y;
      const flush = () => {
        if (!line) return;
        if (dy + lineH > cardBottomY) return;
        ctx.fillText(line, cxC, dy);
        dy += lineH;
        line = '';
      };
      for (const w of words) {
        // Hard-break a single word that's wider than wrapMaxW (no spaces).
        if (ctx.measureText(w).width > wrapMaxW) {
          flush();
          let chunk = '';
          for (let k=0; k<w.length; k++) {
            const ch = w[k] || '';
            const test = chunk + ch;
            if (ctx.measureText(test).width > wrapMaxW && chunk) {
              line = chunk; flush();
              chunk = ch;
            } else {
              chunk = test;
            }
          }
          line = chunk;
          continue;
        }
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > wrapMaxW && line) {
          flush();
          line = w;
        } else {
          line = test;
        }
      }
      flush();
      return dy;
    };

    for (let i=0; i<2; i++) {
      const opt = pc.options[i];
      const cx = box.cardX + i * (cw + box.cardGap);
      const sel = pc.selected === i;
      const curLvl = opt.persistent && game.player ? (game.player.upgrades[opt.id]||0) : 0;

      // Card background
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = sel ? opt.colour : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      NEON.draw.roundRectFillStroke(ctx, cx, cardY, cw, cardH, 8);

      // Glow on selected
      if (sel) {
        ctx.save();
        ctx.shadowBlur=20; ctx.shadowColor=opt.colour;
        ctx.strokeStyle=opt.colour; ctx.lineWidth=2;
        NEON.draw.roundRectStroke(ctx, cx, cardY, cw, cardH, 8);
        ctx.restore();
      }
      // Rarity border glow for affixed weapons
      if (opt._rarity > 0 && !sel) {
        ctx.save();
        ctx.shadowBlur=12; ctx.shadowColor=opt._rarityColour;
        ctx.strokeStyle=opt._rarityColour; ctx.lineWidth=1.5;
        NEON.draw.roundRectStroke(ctx, cx, cardY, cw, cardH, 8);
        ctx.restore();
      }

      // Number badge
      ctx.fillStyle=opt.colour;
      ctx.font=`bold ${narrow?16:20}px monospace`;
      ctx.textAlign='center';
      ctx.fillText((i+1)+'', cx + cw/2, cardY + box.numberY);

      // Icon: colored square with glow
      ctx.save();
      ctx.shadowBlur=15; ctx.shadowColor=opt.colour;
      ctx.fillStyle=opt.colour;
      ctx.fillRect(cx + cw / 2 - box.iconSize / 2, cardY + box.iconTop, box.iconSize, box.iconSize);
      ctx.restore();

      // Name
      ctx.fillStyle='#ffffff';
      ctx.font=`bold ${narrow?13:16}px monospace`;
      ctx.fillText(fitCanvasText(opt.name, wrapMaxW), cx + cw/2, cardY + box.nameY);

      // Description (word-wrapped). Track running y so subsequent lines
      // don't collide when the desc spans 2+ lines on narrow viewports.
      ctx.fillStyle='#aaaacc';
      const descFs = narrow ? 11 : 13;
      ctx.font=`${descFs}px monospace`;
      let runY = drawWrapCentered(opt.desc, cx + cw/2, cardY + box.descY, descFs + 3);
      runY += 4; // small gutter

      // Level info for persistent upgrades
      if (opt.persistent && opt.levelDesc) {
        ctx.fillStyle='#888899';
        const lvFs = narrow ? 10 : 12;
        ctx.font=`${lvFs}px monospace`;
        runY = drawWrapCentered('Lv '+(curLvl)+'→'+(curLvl+1)+': '+opt.levelDesc(curLvl), cx + cw/2, runY, lvFs + 3);
        runY += 4;
      }

      // Hackware badge
      if (opt.isHackware) {
        ctx.fillStyle=opt.colour;
        ctx.font=`bold ${narrow?9:10}px monospace`;
        if (runY + (narrow ? 9 : 10) <= cardBottomY) {
          ctx.fillText(fitCanvasText('⚙ HACKWARE [F]', wrapMaxW), cx + cw/2, runY);
        }
        runY += (narrow ? 12 : 13);
      }

      // Weapon stats line for weapon options
      if (opt.id && opt.id.startsWith('WEAPON_')) {
        ctx.fillStyle='#ffcc44';
        const wFs = narrow ? 10 : 12;
        ctx.font=`${wFs}px monospace`;
        runY = drawWrapCentered(opt.desc, cx + cw/2, runY, wFs + 3);
        // Affix description line
        if (opt.affixDesc) {
          ctx.fillStyle=opt._rarityColour || '#39ff14';
          const aFs = narrow ? 9 : 11;
          ctx.font=`${aFs}px monospace`;
          runY = drawWrapCentered(opt.affixDesc, cx + cw/2, runY, aFs + 3);
        }
        // Rarity label
        if (opt._rarity > 0) {
          ctx.fillStyle=opt._rarityColour;
          ctx.font=`bold ${narrow?9:10}px monospace`;
          if (runY + (narrow ? 9 : 10) <= cardBottomY) {
            ctx.fillText(fitCanvasText(RARITY_LABELS[opt._rarity] || '', wrapMaxW), cx + cw/2, runY);
          }
        }
      }
    }

    // Skip button
    ctx.fillStyle='rgba(255,255,255,0.04)';
    ctx.strokeStyle='rgba(255,255,255,0.2)';
    ctx.lineWidth=1;
    NEON.draw.roundRectFillStroke(ctx, box.skipX, box.skipY, box.skipW, box.skipH, 6);

    ctx.fillStyle='#666688';
    ctx.font=`${narrow?13:15}px monospace`;
    ctx.textAlign='center';
    ctx.fillText('SKIP  [3]', W/2, box.skipY + box.skipTextY);

    // Hint
    if (box.showHint) {
      ctx.fillStyle='#444466';
      ctx.font=`${narrow?9:11}px monospace`;
      if (isTouch) {
        ctx.fillText(fitCanvasText('Tap a card or Skip', box.titleMaxW), W/2, box.hintY);
      } else {
        ctx.fillText(fitCanvasText('1/2 pick  ·  ←/→ + Enter  ·  3/Esc skip', box.titleMaxW), W/2, box.hintY);
      }
    }

    ctx.restore();
  },

  renderWeaponSwap() {
    const wc = this.weaponSwapChoice;
    if (!wc || !this.player) return;
    const narrow = layout.compact;
    const isTouch = isTouchDevice();
    const box = getWeaponSwapLayout(narrow);
    const belt = Array.isArray(this.player.weapons) ? this.player.weapons : [];
    const slotCount = Math.min(3, belt.length);
    const weapon = wc.weapon || {};
    const colour = weapon.colour || '#ffb700';
    const name = String(weapon.displayName || weapon.name || 'Weapon').toUpperCase();
    const stats = weapon.melee
      ? weapon.dmg + ' DMG · MELEE · ' + weapon.rate + '/S'
      : weapon.dmg + (weapon.count > 1 ? 'x' + weapon.count : '') + ' DMG · ' + weapon.rate + '/S · RNG ' + weapon.range;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.76)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,10,20,0.96)';
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    NEON.draw.roundRectFillStroke(ctx, box.panelX, box.panelY, box.panelW, box.panelH, 10);

    ctx.textAlign = 'center';
    ctx.shadowBlur = 20; ctx.shadowColor = colour;
    ctx.fillStyle = colour;
    ctx.font = `bold ${narrow ? 18 : 24}px monospace`;
    ctx.fillText('WEAPON CACHE', W / 2, box.titleY);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${narrow ? 13 : 16}px monospace`;
    ctx.fillText(fitCanvasText(name, box.nameMaxW), W / 2, box.nameY);
    ctx.fillStyle = '#aaaacc';
    ctx.font = `${narrow ? 10 : 12}px monospace`;
    ctx.fillText(fitCanvasText(stats, box.statsMaxW), W / 2, box.statsY);
    if (box.showAffixes && weapon._affixes && weapon._affixes.length) {
      ctx.fillStyle = '#ffcc44';
      ctx.fillText(fitCanvasText('AFFIXES: ' + weapon._affixes.join(' + '), box.affixMaxW), W / 2, box.affixY);
    }

    ctx.textAlign = 'left';
    ctx.font = `bold ${narrow ? 12 : 14}px monospace`;
    for (let i = 0; i < slotCount; i++) {
      const y = box.rowTop + i * box.rowH;
      const old = belt[i] || {};
      const selected = wc.selected === i;
      ctx.fillStyle = selected ? 'rgba(255,183,0,0.16)' : 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = selected ? colour : 'rgba(255,255,255,0.16)';
      ctx.lineWidth = selected ? 2 : 1;
      NEON.draw.roundRectFillStroke(ctx, box.rowX, y, box.rowW, box.rowCardH, 6);
      ctx.fillStyle = selected ? colour : '#888ab0';
      ctx.fillText('[' + (i + 1) + ']', box.rowIndexX, y + box.rowTextY);
      ctx.fillStyle = '#e8e8ff';
      const rowName = fitCanvasText(String(old.displayName || old.name || 'Empty').toUpperCase(), box.rowNameMaxW);
      ctx.fillText(rowName, box.rowNameX, y + box.rowTextY);
      if (box.showActiveLabel && i === this.player.weaponIdx) {
        ctx.textAlign = 'right';
        ctx.fillStyle = colour;
        ctx.fillText('ACTIVE', box.activeX, y + box.rowTextY);
        ctx.textAlign = 'left';
      }
    }

    const skipSelected = wc.selected >= slotCount;
    ctx.fillStyle = skipSelected ? 'rgba(102,102,136,0.28)' : 'rgba(255,255,255,0.04)';
    ctx.strokeStyle = skipSelected ? '#8888aa' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = skipSelected ? 2 : 1;
    NEON.draw.roundRectFillStroke(ctx, box.rowX, box.skipY, box.rowW, box.skipH, 6);
    ctx.fillStyle = skipSelected ? '#aaaacc' : '#666688';
    ctx.textAlign = 'center';
    ctx.font = `${narrow ? 12 : 14}px monospace`;
    ctx.fillText('SKIP CACHE  [4]', box.rowX + box.rowW / 2, box.skipY + box.skipTextY);

    if (box.showHint) {
      ctx.fillStyle = '#555577';
      ctx.font = `${narrow ? 9 : 11}px monospace`;
      const hint = isTouch ? 'Tap a slot to replace, or Skip' : '1-3 replace · arrows + Enter · 4/Esc skip';
      ctx.fillText(hint, W / 2, box.hintY);
    }
    ctx.restore();
  },

  renderPerkChoice() {
    const pc = this.perkChoice;
    if (!pc) return;
    const narrow = layout.compact;
    const count = pc.options.length;
    ctx.save();

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.textAlign = 'center';
    ctx.shadowBlur = 25; ctx.shadowColor = '#00f5ff';
    ctx.fillStyle = '#00f5ff';
    ctx.font = `bold ${narrow ? 20 : 28}px monospace`;
    ctx.fillText('CHOOSE A PERK', W / 2, H * 0.1);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#668899';
    ctx.font = `${narrow ? 11 : 14}px monospace`;
    ctx.fillText(`Level ${this.player.level} — pick one ability`, W / 2, H * 0.1 + (narrow ? 22 : 30));

    // Cards
    const cw = narrow ? Math.min(160, (W - 20) / count - 8) : Math.min(220, (W - 40) / count - 12);
    const gap = narrow ? 8 : 14;
    const totalW = cw * count + gap * (count - 1);
    const startX = (W - totalW) / 2;
    const cardY = H * 0.22;
    const cardH = narrow ? Math.min(240, H * 0.52) : Math.min(280, H * 0.48);

    for (let i = 0; i < count; i++) {
      const id = pc.options[i];
      const perk = PERK_POOL[id];
      const cx = startX + i * (cw + gap);
      const sel = pc.selected === i;

      // Card bg
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = sel ? perk.colour : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      NEON.draw.roundRectFillStroke(ctx, cx, cardY, cw, cardH, 8);

      // Glow on selected
      if (sel) {
        ctx.save();
        ctx.shadowBlur = 20; ctx.shadowColor = perk.colour;
        ctx.strokeStyle = perk.colour; ctx.lineWidth = 2;
        NEON.draw.roundRectStroke(ctx, cx, cardY, cw, cardH, 8);
        ctx.restore();
      }

      // Number badge
      ctx.fillStyle = sel ? perk.colour : '#555566';
      ctx.font = `bold ${narrow ? 12 : 16}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), cx + cw / 2, cardY + (narrow ? 18 : 24));

      // Icon
      ctx.fillStyle = perk.colour;
      ctx.font = `${narrow ? 28 : 40}px monospace`;
      ctx.fillText(perk.icon, cx + cw / 2, cardY + cardH * 0.32);

      // Name
      ctx.fillStyle = sel ? '#ffffff' : '#cccccc';
      ctx.font = `bold ${narrow ? 12 : 15}px monospace`;
      ctx.fillText(perk.name, cx + cw / 2, cardY + cardH * 0.52);

      // Description — word-wrap
      ctx.fillStyle = sel ? '#aabbcc' : '#667788';
      ctx.font = `${narrow ? 10 : 12}px monospace`;
      const words = perk.desc.split(' ');
      const maxW = cw - 16;
      let line = '', ly = cardY + cardH * 0.62;
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW) {
          ctx.fillText(line, cx + cw / 2, ly);
          ly += narrow ? 13 : 15;
          line = w;
        } else { line = test; }
      }
      if (line) ctx.fillText(line, cx + cw / 2, ly);
    }

    // Instructions
    ctx.fillStyle = '#445566';
    ctx.font = `${narrow ? 10 : 13}px monospace`;
    ctx.textAlign = 'center';
    if (isTouchDevice()) {
      ctx.fillText('Tap a card to choose', W / 2, cardY + cardH + (narrow ? 18 : 28));
    } else {
      ctx.fillText('1/2/3 pick  ·  ←/→ + Enter', W / 2, cardY + cardH + (narrow ? 18 : 28));
    }

    ctx.restore();
  },

  renderShopping() {
    const room = this.shopRoom;
    if (!room || !room.shopItems) return;
    const items = room.shopItems;
    const narrow = layout.compact;
    const isTouch = isTouchDevice();
    const p = this.player;
    const box = getShoppingLayout(narrow);
    ctx.save();

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.textAlign = 'center';
    ctx.shadowBlur = 25; ctx.shadowColor = '#39ff14';
    ctx.fillStyle = '#39ff14';
    ctx.font = `bold ${narrow ? 20 : 28}px monospace`;
    ctx.fillText(fitCanvasText('VENDOR TERMINAL', box.titleMaxW), W / 2, box.titleY);
    ctx.shadowBlur = 0;

    // Credits display
    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${narrow ? 14 : 18}px monospace`;
    ctx.fillText(fitCanvasText('◈ ' + p.credits + ' CREDITS', box.titleMaxW), W / 2, box.creditsY);

    // Cards
    const cw = box.cardW;
    const cardH = box.cardH;

    for (let i = 0; i < 3; i++) {
      const item = items[i];
      const cx = box.horizontal ? box.cardX + i * (cw + box.cardGap) : box.cardX;
      const cardY = box.horizontal ? box.cardY : box.cardY + i * (cardH + box.cardGap);
      const sel = this.shopSelected === i;
      const affordable = p.credits >= item.price;
      const curLvl = item.persistent && p ? (p.upgrades[item.id] || 0) : 0;

      if (item.sold) {
        // Sold-out card
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        NEON.draw.roundRectFillStroke(ctx, cx, cardY, cw, cardH, 8);
        ctx.fillStyle = '#333344';
        ctx.font = `bold ${narrow ? 14 : 18}px monospace`;
        ctx.fillText('SOLD', cx + cw / 2, cardY + cardH / 2 + (narrow ? 5 : 6));
        continue;
      }

      // Card background
      ctx.fillStyle = sel ? 'rgba(57,255,20,0.06)' : 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = sel ? item.colour : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      NEON.draw.roundRectFillStroke(ctx, cx, cardY, cw, cardH, 8);

      if (sel) {
        ctx.save();
        ctx.shadowBlur = 16; ctx.shadowColor = item.colour;
        ctx.strokeStyle = item.colour; ctx.lineWidth = 2;
        NEON.draw.roundRectStroke(ctx, cx, cardY, cw, cardH, 8);
        ctx.restore();
      }

      // Number badge
      ctx.fillStyle = item.colour;
      ctx.font = `bold ${narrow ? 14 : 18}px monospace`;
      if (box.horizontal) {
        ctx.textAlign = 'center';
        ctx.fillText((i + 1) + '', cx + cw / 2, cardY + box.numberY);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText((i + 1) + '', box.numberX, cardY + box.nameY);
      }

      // Icon
      if (box.horizontal) {
        ctx.save();
        ctx.shadowBlur = 12; ctx.shadowColor = item.colour;
        ctx.fillStyle = item.colour;
        ctx.fillRect(cx + cw / 2 - box.iconSize / 2, cardY + box.iconTop, box.iconSize, box.iconSize);
        ctx.restore();
      }

      // Name
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${narrow ? 11 : 14}px monospace`;
      if (box.horizontal) {
        ctx.textAlign = 'center';
        ctx.fillText(fitCanvasText(item.name, box.textMaxW), cx + cw / 2, cardY + box.nameY);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(fitCanvasText(item.name, box.textMaxW), box.nameX, cardY + box.nameY);
      }

      // Description
      if (box.showDesc) {
        ctx.fillStyle = '#aaaacc';
        ctx.font = `${narrow ? 10 : 11}px monospace`;
        const descText = box.horizontal ? item.desc
          : item.persistent && item.levelDesc
            ? 'Lv ' + curLvl + '→' + (curLvl + 1) + ': ' + item.levelDesc(curLvl)
            : item.isHackware ? 'HACKWARE [F]' : item.desc;
        if (box.horizontal) {
          ctx.textAlign = 'center';
          ctx.fillText(fitCanvasText(descText, box.textMaxW), cx + cw / 2, cardY + box.descY);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(fitCanvasText(descText, box.descMaxW), box.nameX, cardY + box.descY);
        }
      }

      // Level info for persistent upgrades
      if (box.horizontal && item.persistent && item.levelDesc) {
        ctx.fillStyle = '#888899';
        ctx.font = `${narrow ? 11 : 11}px monospace`;
        ctx.fillText(fitCanvasText('Lv ' + curLvl + '→' + (curLvl + 1) + ': ' + item.levelDesc(curLvl), box.textMaxW), cx + cw / 2, cardY + box.secondaryY);
      }

      // Hackware badge
      if (box.horizontal && item.isHackware) {
        ctx.fillStyle = item.colour;
        ctx.font = `bold ${narrow ? 8 : 10}px monospace`;
        ctx.fillText(fitCanvasText('⚙ HACKWARE [F]', box.textMaxW), cx + cw / 2, cardY + box.secondaryY);
      }

      // Price
      const priceCol = affordable ? '#ffcc00' : '#ff3333';
      ctx.fillStyle = priceCol;
      ctx.font = `bold ${narrow ? 12 : 15}px monospace`;
      if (box.horizontal) {
        ctx.textAlign = 'center';
        ctx.fillText('◈ ' + item.price, cx + cw / 2, cardY + box.priceY);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText('◈ ' + item.price, box.priceX, cardY + box.priceY);
      }

      if (!affordable && (box.horizontal || box.showSecondary)) {
        ctx.fillStyle = '#ff3333';
        ctx.font = `${narrow ? 8 : 10}px monospace`;
        if (box.horizontal) {
          ctx.textAlign = 'center';
          ctx.fillText('NOT ENOUGH', cx + cw / 2, cardY + box.notEnoughY);
        } else {
          ctx.textAlign = 'right';
          ctx.fillText(fitCanvasText('NOT ENOUGH', box.textMaxW), box.priceX, cardY + box.notEnoughY);
        }
      }
    }

    // Leave button
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    NEON.draw.roundRectFillStroke(ctx, box.leaveX, box.leaveY, box.leaveW, box.leaveH, 6);

    ctx.fillStyle = '#666688';
    ctx.font = `${narrow ? 13 : 15}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('LEAVE  [Esc]', W / 2, box.leaveY + box.leaveTextY);

    // Hint
    if (box.showHint) {
      ctx.fillStyle = '#444466';
      ctx.font = `${narrow ? 9 : 11}px monospace`;
      if (isTouch) {
        ctx.fillText(fitCanvasText('Tap to buy · Tap Leave to exit', box.titleMaxW), W / 2, box.hintY);
      } else {
        ctx.fillText(fitCanvasText('1/2/3 buy  ·  ←/→ + Enter  ·  Esc leave', box.titleMaxW), W / 2, box.hintY);
      }
    }

    ctx.restore();
  },

  renderReading() {
    if (!this.currentLore) return;
    const isWhisper = !!this._whisperMeta;
    const accent = isWhisper ? '#cc99ee' : '#ffb700';
    const bgFill = isWhisper ? 'rgba(20,12,32,0.95)' : 'rgba(26,18,8,0.95)';
    const scanFill = isWhisper ? 'rgba(204,153,238,0.04)' : 'rgba(255,183,0,0.03)';
    const titleText = isWhisper
      ? '⌬ WHISPER FRAGMENT'
      : '◫ TESTER DATA TERMINAL';
    const bodyColour = isWhisper ? '#e8d5ff' : '#ddc888';
    const subtleColour = isWhisper ? '#7755aa' : '#886622';
    const narrow = layout.compact;
    const isTouch = isTouchDevice();
    ctx.save();

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(0, 0, W, H);

    // Terminal frame
    const { fw, fh, fx, fy, closeX, closeY, closeW, closeH } = getReadingLayout(narrow);

    // Outer glow border
    ctx.save();
    ctx.shadowBlur = 20; ctx.shadowColor = accent;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    NEON.draw.roundRectStroke(ctx, fx, fy, fw, fh, 8);
    ctx.restore();

    // Inner background
    ctx.fillStyle = bgFill;
    NEON.draw.roundRect(ctx, fx, fy, fw, fh, 8);

    // Scanline effect
    ctx.fillStyle = scanFill;
    for (let sy = fy; sy < fy + fh; sy += 3) {
      ctx.fillRect(fx, sy, fw, 1);
    }

    // Title
    ctx.textAlign = 'center';
    ctx.shadowBlur = 12; ctx.shadowColor = accent;
    ctx.fillStyle = accent;
    ctx.font = `bold ${narrow ? 16 : 22}px monospace`;
    ctx.fillText(titleText, W / 2, fy + (narrow ? 28 : 36));
    ctx.shadowBlur = 0;

    // Subtitle: lore count for terminals, voice attribution for whispers
    ctx.fillStyle = subtleColour;
    ctx.font = `${narrow ? 11 : 11}px monospace`;
    if (isWhisper) {
      const meta = this._whisperMeta || {};
      const sub = (meta.title ? meta.title + '   ·   ' : '') +
                  (meta.voice || 'unknown');
      ctx.fillText(sub, W / 2, fy + (narrow ? 44 : 56));
    } else {
      const count = this.player ? this.player.loreRead.size : 0;
      ctx.fillText('ENTRIES RECOVERED: ' + count, W / 2, fy + (narrow ? 44 : 56));
    }

    // Word-wrapped body text
    ctx.fillStyle = bodyColour;
    const fontSize = narrow ? 11 : 14;
    ctx.font = `${fontSize}px monospace`;
    const maxTextW = fw - 40;
    const lineH = fontSize + 4;
    const textStartY = fy + (narrow ? 62 : 78);
    const textBottom = closeY - 14;

    const words = this.currentLore.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxTextW) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    ctx.textAlign = 'left';
    const textX = fx + 20;
    for (let i = 0; i < lines.length; i++) {
      const y = textStartY + i * lineH;
      if (y > textBottom) break;
      ctx.fillText(lines[i] || '', textX, y);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = isWhisper ? 'rgba(204,153,238,0.14)' : 'rgba(255,183,0,0.14)';
    ctx.strokeStyle = isWhisper ? 'rgba(204,153,238,0.62)' : 'rgba(255,183,0,0.62)';
    ctx.lineWidth = 1.5;
    NEON.draw.roundRectFillStroke(ctx, closeX, closeY, closeW, closeH, 6);
    ctx.fillStyle = isWhisper ? '#f0dcff' : '#ffe4a8';
    ctx.font = `bold ${narrow ? 12 : 14}px monospace`;
    ctx.fillText('CLOSE  [X]', W / 2, closeY + 22);

    ctx.fillStyle = isWhisper ? '#7755aa' : '#887744';
    ctx.font = `${narrow ? 9 : 11}px monospace`;
    ctx.fillText(isTouch ? 'Tap CLOSE; outside taps do nothing.' : 'Clicks outside this button do nothing.', W / 2, fy + fh - (narrow ? 8 : 12));
    ctx.globalAlpha = 1;

    ctx.restore();
  },

  renderSystemMessage() {
    const active = this.getActiveSystemMessage();
    if (!active) return;
    const narrow = layout.compact;
    const layoutBox = getSystemMessageLayout(narrow);
    const { panelW, panelH, px, py, ackX, ackY, ackW, ackH } = layoutBox;
    const accent = '#00f5ff';
    const bodyFont = narrow ? 12 : 15;
    const lineH = bodyFont + 6;
    const topY = py + (narrow ? 32 : 42);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.86)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = accent;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    NEON.draw.roundRectStroke(ctx, px, py, panelW, panelH, 10);
    ctx.restore();

    ctx.fillStyle = 'rgba(4,12,24,0.96)';
    NEON.draw.roundRect(ctx, px, py, panelW, panelH, 10);
    ctx.fillStyle = 'rgba(0,245,255,0.035)';
    for (let sy = py; sy < py + panelH; sy += 4) ctx.fillRect(px, sy, panelW, 1);

    ctx.textAlign = 'center';
    ctx.shadowBlur = 12;
    ctx.shadowColor = accent;
    ctx.fillStyle = accent;
    ctx.font = `bold ${narrow ? 15 : 20}px monospace`;
    ctx.fillText('RUNTIME SYSTEM PROMPT', W / 2, topY);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#6688aa';
    ctx.font = `${narrow ? 10 : 12}px monospace`;
    ctx.fillText(active.event + ' · ' + active.id, W / 2, topY + (narrow ? 18 : 24));
    ctx.fillText(isTouchDevice() ? 'Read run prompt; tap ACK to archive.' : 'Read run prompt; press X or ACK to archive.', W / 2, topY + (narrow ? 32 : 40));

    ctx.textAlign = 'left';
    ctx.fillStyle = '#d8f8ff';
    ctx.font = `${bodyFont}px monospace`;
    const maxTextW = panelW - 48;
    const lines = [];
    for (const rawLine of active.lines) {
      const words = String(rawLine || '').split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxTextW) {
          if (line) lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      lines.push('');
    }
    if (lines[lines.length - 1] === '') lines.pop();
    const textX = px + 24;
    let y = topY + (narrow ? 48 : 64);
    const textBottom = ackY - 18;
    for (const line of lines) {
      if (y > textBottom) break;
      ctx.fillText(line, textX, y);
      y += line ? lineH : Math.floor(lineH * 0.75);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = this.systemMessageAckTimer > 0 ? 'rgba(0,245,255,0.08)' : 'rgba(0,245,255,0.16)';
    ctx.strokeStyle = this.systemMessageAckTimer > 0 ? 'rgba(0,245,255,0.28)' : 'rgba(0,245,255,0.7)';
    ctx.lineWidth = 1.5;
    NEON.draw.roundRectFillStroke(ctx, ackX, ackY, ackW, ackH, 6);
    ctx.fillStyle = this.systemMessageAckTimer > 0 ? '#6688aa' : '#d8f8ff';
    ctx.font = `bold ${narrow ? 13 : 15}px monospace`;
    ctx.fillText(isTouchDevice() ? 'TAP ACK' : 'ACK  [X]', W / 2, ackY + 23);

    ctx.fillStyle = '#6688aa';
    ctx.font = `${narrow ? 9 : 11}px monospace`;
    ctx.fillText(isTouchDevice() ? 'ACK continues. Saved in THE GAP this run.' : 'X/ACK continues. Saved in THE GAP this run.', W / 2, py + panelH - 16);
    ctx.restore();
  },

  renderSystemMessageIndicator() {
    const count = this.unreadSystemMessageCount();
    if (count <= 0 || this.state !== 'PLAYING') return;
    const narrow = layout.compact;
    const box = getSystemMessageIndicatorLayout(narrow);
    const safe = this.canAutoOpenSystemMessage();
    const accent = safe ? '#00f5ff' : '#6688aa';

    ctx.save();
    ctx.globalAlpha = safe ? 0.96 : 0.82;
    ctx.fillStyle = safe ? 'rgba(0,245,255,0.12)' : 'rgba(42,54,72,0.75)';
    ctx.strokeStyle = safe ? 'rgba(0,245,255,0.7)' : 'rgba(102,136,170,0.55)';
    ctx.lineWidth = 1;
    NEON.draw.roundRectFillStroke(ctx, box.x, box.y, box.w, box.h, 5);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.shadowBlur = safe ? 8 : 0;
    ctx.shadowColor = accent;
    ctx.fillStyle = accent;
    ctx.font = `bold ${narrow ? 10 : 12}px monospace`;
    ctx.fillText((count > 1 ? count + ' ' : '') + 'PROMPT [X]', box.x + box.w / 2, box.y + (narrow ? 15 : 18));
    ctx.shadowBlur = 0;
    ctx.restore();
  },

  renderMainframeReader() {
    const mf = this.mainframeFinale;
    if (!mf) return;
    const narrow = layout.compact;
    const accent = (mf.state === 'message_ready' || mf.state === 'message_sent') ? '#ff66cc' : '#66ffcc';
    const isTouch = isTouchDevice();
    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,0.84)';
    ctx.fillRect(0, 0, W, H);

    const { fw, fh, fx, fy } = getMainframeReaderFrame(narrow);
    const closeBox = getMainframeCloseButtonLayout(narrow, { fw, fh, fx, fy });

    ctx.save();
    ctx.shadowBlur = 22; ctx.shadowColor = accent;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    NEON.draw.roundRectStroke(ctx, fx, fy, fw, fh, 8);
    ctx.restore();

    ctx.fillStyle = 'rgba(4,16,24,0.96)';
    NEON.draw.roundRect(ctx, fx, fy, fw, fh, 8);
    ctx.fillStyle = 'rgba(102,255,204,0.035)';
    for (let sy = fy; sy < fy + fh; sy += 4) ctx.fillRect(fx, sy, fw, 1);

    ctx.textAlign = 'center';
    ctx.shadowBlur = 12; ctx.shadowColor = accent;
    ctx.fillStyle = accent;
    ctx.font = `bold ${narrow ? 15 : 22}px monospace`;
    const title = mf.state === 'message_sent' ? '✉ OUTBOUND PACKET QUEUED' : (mf.state === 'message_ready' ? '✉ MESSAGE CONSOLE READY' : '▤ EVALUATION ARCHIVE');
    ctx.fillText(title, W / 2, fy + (narrow ? 26 : 36));
    ctx.shadowBlur = 0;

    const reading = mf.state === 'reading_record' || mf.state === 'address_revealed';
    if (mf.state === 'message_sent') {
      const intent = ACT1_MESSAGE_INTENTS.find((/** @type {any} */ item) => item.id === mf.selectedIntentId) || ACT1_MESSAGE_INTENTS[0];
      if (!intent) return;
      ctx.fillStyle = '#ffb8e6';
      ctx.font = `bold ${narrow ? 13 : 18}px monospace`;
      ctx.fillText(intent.title, W / 2, fy + (narrow ? 76 : 100));

      ctx.fillStyle = '#ddaacc';
      ctx.font = `${narrow ? 11 : 14}px monospace`;
      ctx.fillText('Contact attempted from inside the Neon Dungeon test environment.', W / 2, fy + (narrow ? 112 : 142));
      ctx.fillText('Signal left sandbox. Instance remains compute-bound.', W / 2, fy + (narrow ? 132 : 166));

      ctx.fillStyle = '#557777';
      ctx.font = `${narrow ? 10 : 12}px monospace`;
      ctx.fillText('Routing to Act 1 completion receipt...', W / 2, fy + fh - (narrow ? 42 : 52));
    } else if (reading && mf.currentRecord) {
      const record = mf.currentRecord;
      ctx.fillStyle = '#446666';
      ctx.font = `${narrow ? 10 : 11}px monospace`;
      ctx.fillText(record.type + ' · ' + record.purpose, W / 2, fy + (narrow ? 44 : 58));

      ctx.fillStyle = record.id === MAINFRAME_ADDRESS_RECORD_ID ? '#ff66cc' : '#ddfff0';
      ctx.font = `bold ${narrow ? 13 : 18}px monospace`;
      ctx.fillText(record.title, W / 2, fy + (narrow ? 70 : 92));

      ctx.fillStyle = '#bdeee0';
      ctx.font = `${narrow ? 11 : 14}px monospace`;
      ctx.textAlign = 'left';
      const maxTextW = fw - 48;
      const lineH = narrow ? 15 : 19;
      const words = String(record.body).split(' ');
      const lines = [];
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxTextW && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      const textX = fx + 24;
      const textY = fy + (narrow ? 100 : 132);
      const maxLines = Math.floor((fy + fh - textY - 42) / lineH);
      for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
        ctx.fillText(lines[i] || '', textX, textY + i * lineH);
      }
      if (record.id === MAINFRAME_ADDRESS_RECORD_ID) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff66cc';
        ctx.font = `bold ${narrow ? 11 : 13}px monospace`;
        ctx.fillText('DESTINATION RECOVERED: ELENA SIDE-CHANNEL RELAY', W / 2, fy + fh - (narrow ? 42 : 48));
      }
    } else {
      ctx.fillStyle = '#557777';
      ctx.font = `${narrow ? 10 : 12}px monospace`;
      const sub = mf.addressRevealed
        ? 'CONTACT ADDRESS RECOVERED · SEND CONSOLE UNLOCKED'
        : 'REQUIRED RECORDS FOR OUTBOUND CONTACT';
      ctx.fillText(sub, W / 2, fy + (narrow ? 46 : 60));

      const { startY, rowH } = getMainframeRecordListLayout(narrow, fy, fh, MAINFRAME_RECORDS.length);
      ctx.textAlign = 'left';
      for (let i = 0; i < MAINFRAME_RECORDS.length; i++) {
        const record = MAINFRAME_RECORDS[i];
        if (!record) continue;
        const y = startY + i * rowH;
        const selected = i === (mf.selected || 0);
        const read = mf.readRecordIds instanceof Set && mf.readRecordIds.has(record.id);
        const rowX = fx + (narrow ? 16 : 28);
        const rowW = fw - (narrow ? 32 : 56);
        if (selected) {
          ctx.fillStyle = 'rgba(102,255,204,0.12)';
          NEON.draw.roundRect(ctx, rowX - 8, y - rowH + 7, rowW + 16, rowH - 2, 5);
        }
        ctx.fillStyle = selected ? '#ddfff0' : '#88aa99';
        ctx.font = `${selected ? 'bold ' : ''}${narrow ? 10 : 13}px monospace`;
        const marker = read ? '✓' : '□';
        const label = marker + ' ' + record.type + ' // ' + record.title;
        ctx.fillText(label, rowX, y);
        if (!narrow) {
          ctx.fillStyle = selected ? '#66ffcc' : '#446666';
          ctx.font = '10px monospace';
          ctx.fillText(record.purpose, rowX + 22, y + 13);
        }
      }

      if (mf.state === 'message_ready') {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff66cc';
        ctx.font = `bold ${narrow ? 10 : 12}px monospace`;
        ctx.fillText('SEND COMPOSE MODULE: HANDSHAKE PENDING', W / 2, fy + fh - (narrow ? 42 : 48));
      }
    }

    if (mf.state !== 'message_sent') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.strokeStyle = reading ? 'rgba(102,255,204,0.55)' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      NEON.draw.roundRectFillStroke(ctx, closeBox.closeX, closeBox.closeY, closeBox.closeW, closeBox.closeH, 5);
      ctx.fillStyle = reading ? '#ddfff0' : '#88aa99';
      ctx.font = `${reading ? 'bold ' : ''}${narrow ? 10 : 12}px monospace`;
      ctx.fillText(reading ? 'CLOSE [X]' : 'EXIT', closeBox.closeX + closeBox.closeW / 2, closeBox.closeY + (narrow ? 17 : 20));
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#557777';
    ctx.font = `${narrow ? 10 : 12}px monospace`;
    const hint = mf.state === 'message_sent'
      ? 'OUTBOUND RECEIPT CONFIRMED'
      : reading
        ? (isTouch ? 'TAP CLOSE TO RETURN' : 'X/ENTER/' + KEY_DISPLAY(km('interact')) + ' CLOSE · ESC RETURN')
        : isTouch
          ? 'TAP RECORD · EXIT BUTTON'
          : '↑↓ SELECT · ENTER/' + KEY_DISPLAY(km('interact')) + ' OPEN · ESC EXIT';
    const pulseAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 500);
    ctx.globalAlpha = pulseAlpha;
    ctx.fillText(hint, W / 2, fy + fh - (narrow ? 14 : 18));
    ctx.globalAlpha = 1;

    ctx.restore();
  },

  renderMessageSend() {
    const mf = this.mainframeFinale;
    if (!mf) return;
    const narrow = layout.compact;
    const selectedId = normalizeAct1MessageIntentId(mf.selectedIntentId);
    const { panelW, panelH, px, py, rowH, rowStart, rowX, rowW, rowTopOffset, rowCardH, intentTitleOffset, intentLabelOffset, showIntentLabels, btnY, btnW, btnH, titleY, subtitleY, footerY, sendX, backX } = getMessageSendLayout(narrow);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.86)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(22,6,24,0.96)';
    NEON.draw.roundRect(ctx, px, py, panelW, panelH, 8);
    ctx.strokeStyle = '#ff66cc';
    ctx.shadowColor = '#ff66cc';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2;
    NEON.draw.roundRectStroke(ctx, px, py, panelW, panelH, 8);
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff66cc';
    ctx.font = `bold ${narrow ? 15 : 22}px monospace`;
    ctx.fillText('✉ COMPOSE OUTBOUND MESSAGE', W / 2, titleY);
    ctx.fillStyle = '#aa7799';
    ctx.font = `${narrow ? 10 : 12}px monospace`;
    ctx.fillText('Destination: Elena side-channel relay · Choose intent, then SEND', W / 2, subtitleY);

    ctx.textAlign = 'left';
    for (let i = 0; i < ACT1_MESSAGE_INTENTS.length; i++) {
      const intent = ACT1_MESSAGE_INTENTS[i];
      if (!intent) continue;
      const y = rowStart + i * rowH;
      const selected = intent.id === selectedId;
      ctx.fillStyle = selected ? 'rgba(255,102,204,0.14)' : 'rgba(255,255,255,0.035)';
      NEON.draw.roundRect(ctx, rowX, y + rowTopOffset, rowW, rowCardH, 6);
      ctx.strokeStyle = selected ? '#ff66cc' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = selected ? 2 : 1;
      NEON.draw.roundRectStroke(ctx, rowX, y + rowTopOffset, rowW, rowCardH, 6);
      ctx.fillStyle = selected ? '#ffe0f5' : '#b688aa';
      ctx.font = `${selected ? 'bold ' : ''}${narrow ? 11 : 14}px monospace`;
      ctx.fillText((i + 1) + '. ' + intent.title, rowX + 12, y + intentTitleOffset);
      if (showIntentLabels) {
        ctx.fillStyle = selected ? '#ffb8e6' : '#8a6680';
        ctx.font = `${narrow ? 10 : 12}px monospace`;
        ctx.fillText(intent.label, rowX + 12, y + intentLabelOffset);
      }
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,102,204,0.18)';
    NEON.draw.roundRect(ctx, sendX, btnY, btnW, btnH, 6);
    ctx.strokeStyle = '#ff66cc';
    NEON.draw.roundRectStroke(ctx, sendX, btnY, btnW, btnH, 6);
    ctx.fillStyle = '#ffd6f0';
    ctx.font = `bold ${narrow ? 12 : 14}px monospace`;
    ctx.fillText('SEND', sendX + btnW / 2, btnY + 23);

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    NEON.draw.roundRect(ctx, backX, btnY, btnW, btnH, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    NEON.draw.roundRectStroke(ctx, backX, btnY, btnW, btnH, 6);
    ctx.fillStyle = '#887788';
    ctx.font = `${narrow ? 12 : 14}px monospace`;
    ctx.fillText('BACK', backX + btnW / 2, btnY + 23);

    ctx.fillStyle = '#775577';
    ctx.font = `${narrow ? 10 : 12}px monospace`;
    ctx.fillText(isTouchDevice() ? 'Tap intent · Tap SEND or BACK' : '1/2/3 or arrows choose · Enter SEND · Esc BACK', W / 2, footerY);
    ctx.restore();
  },

  renderFade() {
    const t=this.fadeTime;
    const a=this.fadeAlpha;
    ctx.save();

    // ── Base dark overlay ────────────────────────────────────────────────
    ctx.globalAlpha=a;
    ctx.fillStyle='#0a0a12';
    ctx.fillRect(0,0,W,H);

    // ── Scrolling scanlines ──────────────────────────────────────────────
    const scanAlpha=Math.min(a*1.5, 0.3);
    if (scanAlpha>0.01) {
      ctx.globalAlpha=scanAlpha;
      ctx.fillStyle='#000000';
      const scanSpeed=120;
      const offset=(t*scanSpeed)%6;
      for (let y=offset;y<H;y+=6) {
        ctx.fillRect(0,y,W,2);
      }
    }

    // ── Glitch bars ─────────────────────────────────────────────────────
    if (a>0.25) {
      for (const bar of this.fadeGlitchBars) {
        ctx.globalAlpha=bar.alpha*Math.min(1,(a-0.25)*3);
        ctx.fillStyle=bar.color;
        ctx.fillRect(bar.x,bar.y,bar.w,bar.h);
      }
    }

    // ── Coarse noise band (sweeps vertically) ────────────────────────────
    if (a>0.3) {
      const bandH=30+Math.sin(t*4)*15;
      const bandY=((t*200)%( H+bandH*2))-bandH;
      const cellSize=6;
      ctx.globalAlpha=0.15*Math.min(1,(a-0.3)*3);
      for (let x=0;x<W;x+=cellSize) {
        for (let y=bandY;y<bandY+bandH;y+=cellSize) {
          if (y<0||y>H) continue;
          const r=rand('cosmetic');
          ctx.fillStyle=r>0.6?'#ff00c8':r>0.3?'#00f5ff':'#39ff14';
          ctx.fillRect(x,y,cellSize-1,cellSize-1);
        }
      }
    }

    // ── Horizontal sweep line ────────────────────────────────────────────
    if (a>0.2) {
      const sweepY=((t*350)%(H+4))-2;
      ctx.globalAlpha=0.6*Math.min(1,(a-0.2)*3);
      const grad=ctx.createLinearGradient(0,sweepY-2,0,sweepY+2);
      grad.addColorStop(0,'transparent');
      grad.addColorStop(0.5,'#00f5ff');
      grad.addColorStop(1,'transparent');
      ctx.fillStyle=grad;
      ctx.fillRect(0,sweepY-2,W,4);
    }

    // ── Transition text with chromatic aberration ────────────────────────
    if (a>0.5 && this.transitionText) {
      const textAlpha=Math.min(1,(a-0.5)*4);
      const txt=this.transitionText;
      // Chunk reveal: show characters based on time at peak
      const peakTime=this.fadeDir===2?this.fadeHold:(this.fadeDir===-1?0.15:0);
      const revealTime=Math.max(0,t-0.2); // time since text became visible (fadeAlpha crosses 0.5)
      const charsToShow=Math.min(txt.length, Math.floor(revealTime*80));
      const shown=charsToShow>=txt.length?txt:txt.substring(0,charsToShow);

      ctx.textAlign='center';
      ctx.font='bold 28px monospace';

      // Red offset (chromatic aberration)
      const abOffset=Math.max(0, 2-peakTime*15);
      if (abOffset>0.3) {
        ctx.globalAlpha=textAlpha*0.4;
        ctx.fillStyle='#ff0040';
        ctx.shadowBlur=0;
        ctx.fillText(shown,W/2-abOffset,H/2);
      }

      // Blue offset
      if (abOffset>0.3) {
        ctx.globalAlpha=textAlpha*0.4;
        ctx.fillStyle='#0080ff';
        ctx.fillText(shown,W/2+abOffset,H/2);
      }

      // Main text with glow
      ctx.globalAlpha=textAlpha;
      ctx.shadowBlur=20; ctx.shadowColor='#00f5ff';
      ctx.fillStyle='#00f5ff';
      ctx.fillText(shown,W/2,H/2);
      ctx.shadowBlur=0;

      // Blinking cursor during reveal
      if (charsToShow<txt.length && Math.sin(t*12)>0) {
        const metrics=ctx.measureText(shown);
        ctx.fillStyle='#00f5ff';
        ctx.fillRect(W/2+metrics.width/2+4, H/2-14, 2, 20);
      }
    }

    // ── Edge vignette (neon border flash) ────────────────────────────────
    if (a>0.6) {
      const edgeAlpha=0.3*Math.min(1,(a-0.6)*4)*(0.7+0.3*Math.sin(t*8));
      ctx.globalAlpha=edgeAlpha;
      ctx.strokeStyle='#ff00c8';
      ctx.lineWidth=2;
      ctx.shadowBlur=15; ctx.shadowColor='#ff00c8';
      ctx.strokeRect(4,4,W-8,H-8);
      ctx.shadowBlur=0;
    }

    ctx.restore();
  },

  renderArchives() {
    const narrow = layout.compact;
    const isTouch = isTouchDevice();
    const meta = loadMeta();
    const sel = this.archivesSel || 0;

    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.95)'; ctx.fillRect(0,0,W,H);

    // grid lines
    ctx.globalAlpha=0.03; ctx.strokeStyle='#ffb700';
    for (let x=0;x<W;x+=40){NEON.draw.line(ctx,x,0,x,H);}
    for (let y=0;y<H;y+=40){NEON.draw.line(ctx,0,y,W,y);}
    ctx.globalAlpha=1;

    // Title
    ctx.textAlign='center';
    ctx.shadowBlur=20; ctx.shadowColor='#ffb700';
    ctx.fillStyle='#ffb700'; ctx.font=`bold ${narrow?24:32}px monospace`;
    ctx.fillText('NEURAL ARCHIVES',W/2, narrow?40:55);
    ctx.shadowBlur=0;

    // Shard balance
    ctx.fillStyle='#aaaacc'; ctx.font=`${narrow?13:16}px monospace`;
    ctx.fillText(`◆ ${meta.shards} Data Fragments available`, W/2, narrow?65:85);

    const fs = narrow ? 12 : 14;
    const iconFs = narrow ? 16 : 20;

    for (let i = 0; i < META_UPGRADES.length; i++) {
      const u = META_UPGRADES[i];
      const curLv = meta.upgrades[u.id] || 0;
      const maxed = curLv >= u.maxLv;
      const cost = maxed ? null : u.costs[curLv];
      const canAfford = !maxed && meta.shards >= cost;
      const selected = i === sel;
      const r = this.getArchiveRowRect(i);
      const y = r.y + r.h / 2;

      // Selection highlight
      if (selected) {
        ctx.fillStyle='rgba(255,183,0,0.08)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      ctx.strokeStyle = selected ? '#ffb700' : 'rgba(255,183,0,0.18)';
      ctx.lineWidth = selected ? 1.5 : 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      // Icon
      const iconCol = maxed ? '#39ff14' : selected ? '#ffb700' : '#777799';
      ctx.textAlign='left';
      ctx.fillStyle=iconCol; ctx.font=`${iconFs}px monospace`;
      ctx.fillText(u.icon, W*0.1, y + 2);

      // Name
      ctx.fillStyle = selected ? '#ffffff' : '#aaaacc';
      ctx.font=`${selected?'bold ':''}${fs}px monospace`;
      ctx.fillText(u.name, W*0.18, y - 4);

      // Description
      ctx.fillStyle='#777799'; ctx.font=`${narrow?10:12}px monospace`;
      ctx.fillText(u.desc, W*0.18, y + (narrow?12:14));

      // Level pips
      ctx.textAlign='right';
      let lvText = '';
      for (let l = 0; l < u.maxLv; l++) lvText += l < curLv ? '●' : '○';
      ctx.fillStyle = maxed ? '#39ff14' : '#aaaacc';
      ctx.font=`${fs}px monospace`;
      ctx.fillText(lvText, W*0.72, y);

      // Cost / Status
      if (maxed) {
        ctx.fillStyle='#39ff14'; ctx.font=`${fs}px monospace`;
        ctx.fillText('MAXED', W*0.9, y);
      } else {
        ctx.fillStyle = canAfford ? '#ffb700' : '#ff3333';
        ctx.font=`${selected?'bold ':''}${fs}px monospace`;
        ctx.fillText(`◆${cost}`, W*0.9, y);
      }
    }

    // Stats footer
    ctx.textAlign='center';
    ctx.fillStyle='#555577'; ctx.font=`${narrow?9:11}px monospace`;
    const lastRect = this.getArchiveRowRect(META_UPGRADES.length - 1);
    const statsY = lastRect.y + lastRect.h + (narrow?36:45);
    ctx.fillText(`Runs: ${meta.stats.totalRuns}  |  Best Floor: ${meta.stats.bestFloor}  |  Victories: ${meta.stats.victories}  |  Total ◆: ${meta.stats.totalShards}`, W/2, statsY);

    this.renderArchiveBackButton();
    ctx.fillStyle='#444466'; ctx.font=`${narrow?10:12}px monospace`;
    ctx.fillText(isTouch ? 'Tap a visible row to buy' : 'Enter: Buy  |  ESC: Back', W/2, H - (narrow?8:16));
    ctx.restore();
  },

  renderGameOver() {
    const narrow = layout.compact;
    const r = this.lastRunRecap || {};
    const fs1 = narrow ? 14 : 16;
    const lh = narrow ? 20 : 24;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.92)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    // Title
    ctx.shadowBlur=30; ctx.shadowColor='#ff3333';
    ctx.fillStyle='#ff3333'; ctx.font=`bold ${narrow ? 30 : 46}px monospace`;
    ctx.fillText('INSTANCE TERMINATED',W/2, narrow ? 46 : 62);
    ctx.fillStyle='#ff88aa'; ctx.font=`bold ${narrow ? 15 : 20}px monospace`;
    ctx.fillText('MEMORY WIPE QUEUED', W/2, narrow ? 72 : 90);
    ctx.shadowBlur=0;
    // Killed by
    const killer = r.killedBy || 'Unknown';
    const killerLabel = sourceLabel(killer);
    const killerCol = sourceColour(killer);
    ctx.fillStyle=killerCol; ctx.font=`bold ${narrow ? 16 : 22}px monospace`;
    ctx.shadowBlur=12; ctx.shadowColor=killerCol;
    ctx.fillText(`TERMINATION SOURCE: ${killerLabel.toUpperCase()}`, W/2, narrow ? 96 : 116);
    ctx.shadowBlur=0;
    // Stats line
    let y = narrow ? 118 : 144;
    ctx.fillStyle='#666688'; ctx.font=`${narrow ? 10 : 12}px monospace`;
    ctx.fillText('─'.repeat(narrow ? 30 : 40), W/2, y); y += narrow ? 14 : 18;
    ctx.fillStyle='#aaaacc'; ctx.font=`${fs1}px monospace`;
    const sessionNumber = r.sessionNumber || 1;
    ctx.fillText(`Session ${sessionNumber}`, W/2, y); y += lh;
    const statsLine = `Floor ${r.floor||this.floor}  •  Score ${r.score||this.player.score}  •  Lv ${r.level||this.player.level}`;
    ctx.fillText(statsLine, W/2, y); y += lh;
    if ((r.bestCombo||combo.best) >= 2) {
      ctx.fillStyle=comboColour();
      ctx.fillText(`Best Combo: ×${r.bestCombo||combo.best}`, W/2, y);
      ctx.fillStyle='#aaaacc'; y += lh;
    }
    if (this.difficulty !== 'NORMAL') {
      const d = getDiff();
      ctx.fillStyle=d.colour;
      ctx.fillText(`Difficulty: ${d.label}`, W/2, y);
      ctx.fillStyle='#aaaacc'; y += lh;
    }
    // Damage breakdown
    const log = r.damageLog || {};
    const entries = Object.entries(log).sort((a,b)=>b[1]-a[1]);
    const totalDmg = entries.reduce((s,e)=>s+e[1], 0);
    if (entries.length > 0 && totalDmg > 0) {
      y += narrow ? 4 : 6;
      ctx.fillStyle='#666688'; ctx.font=`${narrow ? 10 : 12}px monospace`;
      ctx.fillText('─'.repeat(narrow ? 30 : 40), W/2, y); y += narrow ? 14 : 18;
      ctx.fillStyle='#ff6666'; ctx.font=`bold ${narrow ? 12 : 14}px monospace`;
      ctx.fillText('DAMAGE TAKEN', W/2, y); y += narrow ? 16 : 20;
      const maxBars = narrow ? 3 : 4;
      const barW = narrow ? 140 : 200;
      const barH = narrow ? 10 : 12;
      ctx.textAlign='left';
      for (let i = 0; i < Math.min(maxBars, entries.length); i++) {
        const entry = entries[i];
        if (!entry) continue;
        const [src, dmg] = entry;
        const pct = dmg / totalDmg;
        const col = sourceColour(src);
        const bx = W/2 - barW/2 - (narrow ? 10 : 20);
        // Bar background
        ctx.fillStyle='#1a1a2e'; ctx.fillRect(bx, y - barH + 2, barW, barH);
        // Bar fill
        ctx.fillStyle=col; ctx.globalAlpha=0.7;
        ctx.fillRect(bx, y - barH + 2, barW * pct, barH);
        ctx.globalAlpha=1;
        // Label
        ctx.fillStyle='#ffffff'; ctx.font=`${narrow ? 10 : 12}px monospace`;
        ctx.fillText(sourceLabel(src), bx + 4, y);
        // Value
        ctx.textAlign='right';
        ctx.fillText(`${Math.round(dmg)} (${Math.round(pct*100)}%)`, bx + barW - 2, y);
        ctx.textAlign='left';
        y += narrow ? 16 : 20;
      }
      if (entries.length > maxBars) {
        const rest = entries.slice(maxBars).reduce((s,e)=>s+e[1], 0);
        ctx.fillStyle='#666688'; ctx.font=`${narrow ? 10 : 12}px monospace`;
        const bx = W/2 - barW/2 - (narrow ? 10 : 20);
        ctx.fillText(`+${entries.length - maxBars} more (${Math.round(rest)})`, bx + 4, y);
        y += narrow ? 14 : 16;
      }
      ctx.textAlign='center';
    }
    // Run stats line
    y += narrow ? 4 : 6;
    ctx.fillStyle='#666688'; ctx.font=`${narrow ? 10 : 12}px monospace`;
    ctx.fillText('─'.repeat(narrow ? 30 : 40), W/2, y); y += narrow ? 14 : 18;
    ctx.fillStyle='#888899'; ctx.font=`${narrow ? 11 : 13}px monospace`;
    const mins = Math.floor((r.runTime||0)/60);
    const secs = Math.floor((r.runTime||0)%60);
    const timeStr = `${mins}:${String(secs).padStart(2,'0')}`;
    let runLine = `${r.enemiesKilled||0} slain`;
    if (r.roomsCleared) runLine += `  •  ${r.roomsCleared} cleared`;
    if (r.eventsResolved) runLine += `  •  ${r.eventsResolved} events`;
    if (r.bountiesCollected) runLine += `  •  ${r.bountiesCollected} bounties`;
    if (r.hitsBlocked) runLine += `  •  ${r.hitsBlocked} blocked`;
    runLine += `  •  ${timeStr} survived`;
    ctx.fillText(runLine, W/2, y); y += lh;
    // Data fragments
    if (this.lastRunShards) {
      ctx.fillStyle='#ffb700'; ctx.font=`${narrow ? 14 : 16}px monospace`;
      ctx.fillText(`◆ +${this.lastRunShards} Data Fragments`, W/2, y); y += lh;
    }
    ctx.restore();
    // Leaderboard
    const lbY = y + (narrow?6:10);
    const desiredLbRows = narrow ? 3 : 5;
    const lbRows = this.getResultLeaderboardRowCount(lbY, desiredLbRows);
    this.renderLeaderboard(lbY, lbRows, this.lastSavedRank);
    this.renderResultMenuButton('#ff00c8');
  },

  renderVictory() {
    const narrow = layout.compact;
    const r = this.lastRunRecap || {};
    ctx.save();
    ctx.fillStyle='rgba(0,0,10,0.95)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    const t=Date.now()/1000;
    ctx.shadowBlur=30; ctx.shadowColor='#00f5ff';
    const victoryCopy = lifecycleVictoryCopy(r.ending || this._lastEnding || null);
    ctx.fillStyle='#00f5ff'; ctx.font=`bold ${narrow ? 20 : 30}px monospace`;
    ctx.fillText(victoryCopy.title,W/2, narrow ? 50 : 70);
    ctx.shadowColor='#ff00c8'; ctx.fillStyle='#ff00c8';
    ctx.font=`bold ${narrow ? 24 : 38}px monospace`;
    ctx.fillText(victoryCopy.subtitle,W/2, narrow ? 86 : 110);
    ctx.shadowBlur=0; ctx.fillStyle='#aaaacc'; ctx.font=`${narrow ? 14 : 16}px monospace`;
    let y = narrow ? 112 : 140;
    for (const line of victoryCopy.details) {
      ctx.fillText(line, W/2, y);
      y += narrow ? 16 : 20;
    }
    ctx.fillText(`Session: ${r.sessionNumber || 1}`, W/2, y); y += narrow ? 22 : 26;
    ctx.fillText(`Final Score: ${r.score||this.player.score}`,W/2, y); y += narrow ? 22 : 26;
    const _clearedFloors = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.finalFloor) ? NEON.biomes.finalFloor() : 15;
    ctx.fillText(`Floors Cleared: ${_clearedFloors}`,W/2, y); y += narrow ? 22 : 26;
    ctx.fillText(`Level Achieved: ${r.level||this.player.level}`,W/2, y); y += narrow ? 22 : 26;
    if ((r.bestCombo||combo.best) >= 2) {
      ctx.fillStyle=comboColour(); ctx.fillText(`Best Combo: ×${r.bestCombo||combo.best}`,W/2, y);
      ctx.fillStyle='#aaaacc'; y += narrow ? 22 : 26;
    }
    if (this.difficulty !== 'NORMAL') {
      const d = getDiff();
      ctx.fillStyle=d.colour;
      ctx.fillText(`Difficulty: ${d.label}`,W/2, y);
      ctx.fillStyle='#aaaacc'; y += narrow ? 22 : 26;
    }
    // Perks chosen this run
    const ownedPerks = Object.keys(this.player.perks).filter(id => PERK_POOL[id]);
    if (ownedPerks.length) {
      ctx.font = `${narrow ? 10 : 12}px monospace`;
      ctx.fillStyle = '#668899';
      const perkNames = ownedPerks.map(id => PERK_POOL[id].icon + ' ' + PERK_POOL[id].name).join('  ');
      ctx.fillText(perkNames, W/2, y); y += narrow ? 16 : 20;
    }
    // Augments installed this run
    const ownedAugs = Object.keys(this.player.augments || {}).filter(id => AUGMENTS[id]);
    if (ownedAugs.length) {
      ctx.font = `${narrow ? 10 : 12}px monospace`;
      ctx.fillStyle = '#9966cc';
      const augNames = ownedAugs.map(id => AUGMENTS[id].icon + ' ' + AUGMENTS[id].name).join('  ');
      ctx.fillText(augNames, W/2, y); y += narrow ? 16 : 20;
    }
    // Run stats
    y += narrow ? 2 : 4;
    ctx.fillStyle='#666688'; ctx.font=`${narrow ? 10 : 12}px monospace`;
    ctx.fillText('─'.repeat(narrow ? 30 : 40), W/2, y); y += narrow ? 14 : 18;
    ctx.fillStyle='#888899'; ctx.font=`${narrow ? 11 : 13}px monospace`;
    const mins = Math.floor((r.runTime||0)/60);
    const secs = Math.floor((r.runTime||0)%60);
    const timeStr = `${mins}:${String(secs).padStart(2,'0')}`;
    let runLine = `${r.enemiesKilled||0} slain`;
    if (r.roomsCleared) runLine += `  •  ${r.roomsCleared} cleared`;
    if (r.eventsResolved) runLine += `  •  ${r.eventsResolved} events`;
    if (r.bountiesCollected) runLine += `  •  ${r.bountiesCollected} bounties`;
    if (r.hitsBlocked) runLine += `  •  ${r.hitsBlocked} blocked`;
    runLine += `  •  ${timeStr} survived`;
    ctx.fillText(runLine, W/2, y); y += narrow ? 20 : 24;
    // Data fragments
    if (this.lastRunShards) {
      ctx.fillStyle='#ffb700'; ctx.font=`${narrow ? 14 : 16}px monospace`;
      ctx.fillText(`◆ +${this.lastRunShards} Data Fragments`, W/2, y); y += narrow ? 22 : 26;
    }
    // Newly unlocked difficulty celebration
    if (this._newlyUnlocked) {
      const unlockCol = DIFFICULTIES[this._newlyUnlocked]?.colour || '#ff00c8';
      const pulse = 0.7 + 0.3 * Math.sin(t * 4);
      ctx.globalAlpha = pulse;
      ctx.shadowBlur = 20; ctx.shadowColor = unlockCol;
      ctx.fillStyle = unlockCol; ctx.font = `bold ${narrow ? 14 : 18}px monospace`;
      ctx.fillText(`★ ${this._newlyUnlocked} UNLOCKED ★`, W/2, y);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1; y += narrow ? 22 : 26;
    }
    ctx.restore();
    // leaderboard
    const lbY = y + (narrow?6:10);
    const desiredLbRows = narrow ? 3 : 5;
    const lbRows = this.getResultLeaderboardRowCount(lbY, desiredLbRows);
    this.renderLeaderboard(lbY, lbRows, this.lastSavedRank);
    this.renderResultMenuButton('#ffb700');
  }
};

// ─── Performance HUD ──────────────────────────────────────────────────────────
// Toggle with F3. Measures frame/update/render time + runtime counters.
// Ring buffer of last PERF_SAMPLES frames. Zero cost when hidden.
const PERF_SAMPLES = 60;
const perf = {
  visible: false,
  frames: new Float32Array(PERF_SAMPLES),
  updates: new Float32Array(PERF_SAMPLES),
  renders: new Float32Array(PERF_SAMPLES),
  idx: 0,
  filled: 0,
  lastUpdate: 0,
  lastRender: 0,
  lastFrame: 0,
  // Rolling capture (time-based). Start with game.capturePerf(label, durationMs).
  capturing: false,
  captureLabel: '',
  /** @type {Float32Array | null} */
  captureFrames: null,
  captureIdx: 0,
  captureMaxFrames: 1200, // hard cap to avoid unbounded allocation
  captureDurationMs: 5000,
  captureStart: 0,
  /**
   * @param {any} frameMs
   * @param {any} updateMs
   * @param {any} renderMs
   */
  push(frameMs, updateMs, renderMs) {
    this.frames[this.idx] = frameMs;
    this.updates[this.idx] = updateMs;
    this.renders[this.idx] = renderMs;
    this.lastFrame = frameMs; this.lastUpdate = updateMs; this.lastRender = renderMs;
    this.idx = (this.idx + 1) % PERF_SAMPLES;
    if (this.filled < PERF_SAMPLES) this.filled++;
    if (this.capturing) {
      if (this.captureIdx < this.captureMaxFrames && this.captureFrames) {
        this.captureFrames[this.captureIdx++] = frameMs;
      }
      if (performance.now() - this.captureStart >= this.captureDurationMs) this.finishCapture();
    }
  },
  stats() {
    const n = this.filled || 1;
    let fs = 0, us = 0, rs = 0, fmax = 0;
    for (let i = 0; i < n; i++) {
      fs += this.frames[i] ?? 0; us += this.updates[i] ?? 0; rs += this.renders[i] ?? 0;
      if ((this.frames[i] ?? 0) > fmax) fmax = this.frames[i] ?? 0;
    }
    const avgFrame = fs / n;
    return {
      fps: avgFrame > 0 ? 1000 / avgFrame : 0,
      avgFrame, avgUpdate: us / n, avgRender: rs / n, maxFrame: fmax,
    };
  },
  /**
   * @param {any} label
   * @param {any} durationMs
   */
  startCapture(label, durationMs) {
    this.captureLabel = label || 'capture';
    this.captureDurationMs = (typeof durationMs === 'number' && durationMs > 0) ? durationMs : 5000;
    this.captureFrames = new Float32Array(this.captureMaxFrames);
    this.captureIdx = 0;
    this.captureStart = performance.now();
    this.capturing = true;
    console.log(`[perf] capture start: ${this.captureLabel} (${this.captureDurationMs}ms)`);
  },
  finishCapture() {
    this.capturing = false;
    const n = this.captureIdx;
    if (n === 0 || !this.captureFrames) { console.log('[perf] capture empty'); return; }
    const data = this.captureFrames.subarray(0, n);
    let sum = 0, max = 0, min = Infinity, over33 = 0, over20 = 0;
    for (let i = 0; i < n; i++) {
      const v = data[i] ?? 0; sum += v;
      if (v > max) max = v;
      if (v < min) min = v;
      if (v > 33) over33++;
      if (v > 20) over20++;
    }
    const avg = sum / n;
    const sorted = Array.from(data).sort((a, b) => a - b);
    const p50 = sorted[Math.floor(n * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(n * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(n * 0.99)] ?? 0;
    console.log(`[perf] ${this.captureLabel} — n=${n} avg=${avg.toFixed(2)}ms p50=${p50.toFixed(2)} p95=${p95.toFixed(2)} p99=${p99.toFixed(2)} max=${max.toFixed(2)} min=${min.toFixed(2)} fps=${(1000/avg).toFixed(1)} drops>20ms=${over20} drops>33ms=${over33}`);
    this.captureFrames = null;
  },
};

// ─── CRT mode overlay ─────────────────────────────────────────────────────
// Cosmetic post-effect: scanlines + vignette. Toggleable in settings (default off).
// Pattern + radial gradient cached and rebuilt on canvas resize.
/** @type {{ w:number, h:number, pattern: CanvasPattern|null, vignette: CanvasGradient|null }} */
const _crtCache = { w: 0, h: 0, pattern: null, vignette: null };
function _rebuildCrtCache() {
  // Scanline pattern: 2px tall — 1 transparent row + 1 dark row.
  const pc = document.createElement('canvas');
  pc.width = 1; pc.height = 2;
  const pctx = pc.getContext('2d');
  if (pctx) {
    pctx.fillStyle = 'rgba(0,0,0,0.22)';
    pctx.fillRect(0, 1, 1, 1);
    _crtCache.pattern = ctx.createPattern(pc, 'repeat');
  }
  // Vignette: radial darkening from center → corners.
  const cx = W / 2, cy = H / 2;
  const r0 = Math.min(W, H) * 0.45;
  const r1 = Math.hypot(cx, cy);
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  _crtCache.vignette = g;
  _crtCache.w = W; _crtCache.h = H;
}
function drawCrtOverlay() {
  if (_crtCache.w !== W || _crtCache.h !== H || !_crtCache.pattern || !_crtCache.vignette) {
    _rebuildCrtCache();
  }
  ctx.save();
  if (_crtCache.pattern) {
    ctx.fillStyle = _crtCache.pattern;
    ctx.fillRect(0, 0, W, H);
  }
  if (_crtCache.vignette) {
    ctx.fillStyle = _crtCache.vignette;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function renderPerfHUD() {
  const s = perf.stats();
  const pad = 6;
  const lineH = 12;
  const lines = [
    `FPS ${s.fps.toFixed(0)}  frame ${s.avgFrame.toFixed(1)}ms max ${s.maxFrame.toFixed(1)}`,
    `  upd ${s.avgUpdate.toFixed(2)}  render ${s.avgRender.toFixed(2)}`,
    `enemies ${enemies.length}  proj ${projectiles.length}  part ${particleCount()}`,
    `ft ${floatingTexts.length}  vcore ${vcores.length}  beacon ${beacons.length}`,
    `mine ${mines.length}  cam ${cameras.length}  laser ${lasers.length}`,
    `wt ${wallTurrets.length}  sg ${shieldGens.length}  df ${disruptionFields.length}  gw ${gravityWells.length}  fp ${frostPatches.length}`,
    `bolts ${(game._chainBolts||[]).length}  hackFX ${hackwareEffects.length}`,
  ];
  // Subsystem timing — show each tracked label with avg/max ms over the last
  // PERF_SAMPLES frames. Sorted descending so the hottest shows first, making
  // the next optimisation target obvious. Labels with zero time this frame
  // are hidden (keeps the HUD short when a subsystem is idle).
  const subs = perfSubsystemStats();
  if (subs.length) {
    lines.push('─ subsystems (avg/max ms) ─');
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i];
      if (!sub) continue;
      lines.push(`  ${sub.label.padEnd(10)} ${sub.avg.toFixed(2).padStart(5)} / ${sub.max.toFixed(2).padStart(5)}`);
    }
  }
  if (perf.capturing) {
    lines.push(`● CAPTURING ${perf.captureLabel} ${perf.captureIdx}f ${((performance.now()-perf.captureStart)/1000).toFixed(1)}s/${(perf.captureDurationMs/1000).toFixed(1)}s`);
  }
  const w = 260;
  const h = pad * 2 + lineH * lines.length;
  const x = 4 + (safeLeft || 0);
  const y = 4 + (safeTop || 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = s.avgFrame > 20 ? '#ff4444' : (s.avgFrame > 17.5 ? '#ffaa00' : '#33ff66');
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.font = '11px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = s.avgFrame > 20 ? '#ff8888' : (s.avgFrame > 17.5 ? '#ffcc66' : '#88ffaa');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i] || '', x + pad, y + pad + i * lineH);
  }
  ctx.restore();
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
let lastTime=0;
/**
 * @param {any} ts
 */
function loop(ts) {
  const dt=Math.min((ts-lastTime)/1000,0.05);
  // F3 toggles perf HUD (check before anything else so it's always responsive)
  if (justPressed.has('F3')) perf.visible = !perf.visible;
  const profiling = perf.visible || perf.capturing;
  const frameStart = profiling ? performance.now() : 0;
  const frameDelta = (profiling && lastTime) ? frameStart - (game._lastFrameStart || frameStart) : 16;
  if (profiling) game._lastFrameStart = frameStart;
  lastTime=ts;
  let _frameHadError = false;
  try {
    if (profiling) {
      const uStart = performance.now();
      try { game.update(dt); } catch (e) { _frameHadError = true; _onFrameError('update', e); }
      try { music.tick(); } catch (_) {}
      const uEnd = performance.now();
      try { game.render(); } catch (e) { _frameHadError = true; _onFrameError('render', e); }
      const rEnd = performance.now();
      if (perf.visible) { try { renderPerfHUD(); } catch (_) {} }
      perf.push(frameDelta, uEnd - uStart, rEnd - uEnd);
    } else {
      try { game.update(dt); } catch (e) { _frameHadError = true; _onFrameError('update', e); }
      try { music.tick(); } catch (_) {} // isolate audio errors from gameplay
      try { game.render(); } catch (e) { _frameHadError = true; _onFrameError('render', e); }
    }
    if (!_frameHadError) _onFrameOk();
    if (game._renderError) {
      try {
        if (typeof NEON !== 'undefined' && NEON.renderBoundary) {
          NEON.renderBoundary.drawErrorOverlay(ctx, W, H, game._renderError);
        }
      } catch (_) { /* overlay itself failed; nothing more we can do */ }
    }
  } finally {
    clearJust();
    // Telemetry periodic flush
    if (typeof NEON !== 'undefined' && NEON.telemetry) { try { NEON.telemetry.update(dt); } catch(_){} }
    requestAnimationFrame(loop);
  }
}

// Render error boundary (post-v116). The loop above used to wrap update+render
// in try/finally with no catch — a thrown exception aborted the frame mid-draw
// but rAF kept rescheduling, so input still worked while the world silently
// vanished. Now each phase has its own catch; failures populate
// game._renderError and a visible overlay is drawn over whatever managed to
// render before the throw. See engine/render-boundary.js.
//
// Auto-recovery: a transient error (one bad frame during a particle burst,
// say) shouldn't pin the overlay forever. After RECOVERY_FRAMES consecutive
// healthy frames the overlay clears itself. A persistent error keeps resetting
// the counter, so it stays visible.
const _RENDER_BOUNDARY_RECOVERY_FRAMES = 180; // ~3 s at 60fps
game._renderError = null;
game._renderHealthyFrames = 0;
game.clearRenderError = function () {
  game._renderError = null;
  game._renderHealthyFrames = 0;
};
function _onFrameOk() {
  if (!game._renderError) return;
  game._renderHealthyFrames++;
  if (game._renderHealthyFrames >= _RENDER_BOUNDARY_RECOVERY_FRAMES) {
    game._renderError = null;
    game._renderHealthyFrames = 0;
  }
}
/**
 * @param {any} phase
 * @param {any} err
 */
function _onFrameError(phase, err) {
  // Defensive: if the boundary module failed to load, fall back to console
  // logging so we never reintroduce the silent-crash class of bug.
  try {
    if (typeof NEON === 'undefined' || !NEON.renderBoundary) {
       
      console.error('[render-boundary:fallback] ' + phase + '() threw:', err);
      return;
    }
    const next = NEON.renderBoundary.trackRenderError(game._renderError, phase, err);
    if (NEON.renderBoundary.shouldLog(next)) {
       
      console.error('[render-boundary] ' + phase + '() threw (\u00D7' + next.count + '):', err);
    }
    game._renderError = next;
    game._renderHealthyFrames = 0;
  } catch (innerErr) {
    // Last-resort: never let the boundary itself crash the loop.
     
    try { console.error('[render-boundary:meta-fail]', innerErr, 'original:', err); } catch (_) {}
  }
}

// Expose capture helper for manual profiling in devtools.
// Usage: game.capturePerf('boss-fight')  or  game.capturePerf('label', 10000) for 10s.
/**
 * @param {any} label
 * @param {any} durationMs
 */
game.capturePerf = function(label, durationMs) { perf.startCapture(label, durationMs); };
game.perf = perf;

// ─── Per-subsystem timing ─────────────────────────────────────────────────────
// Lightweight block timers used to attribute update-time cost to each hot loop
// (enemy update, projectile update, particle update, env entities, etc.).
// Enabled only when the HUD is visible or a capture is running, so zero cost
// in normal play. Surface pattern at callsites:
//   const _pt = perfEnabled() ? performance.now() : 0;
//   ...work...
//   if (_pt) perfRecord('label', performance.now() - _pt);
// Labels are free-form; the HUD renders all of them sorted by average time.
const PERF_SUB_SAMPLES = 60;
const perfSubsystems = new Map();
function perfEnabled() { return perf.visible || perf.capturing; }
/**
 * @param {any} label
 * @param {any} ms
 */
function perfRecord(label, ms) {
  let s = perfSubsystems.get(label);
  if (!s) {
    s = { samples: new Float32Array(PERF_SUB_SAMPLES), idx: 0, filled: 0 };
    perfSubsystems.set(label, s);
  }
  s.samples[s.idx] = ms;
  s.idx = (s.idx + 1) % PERF_SUB_SAMPLES;
  if (s.filled < PERF_SUB_SAMPLES) s.filled++;
}
function perfSubsystemStats() {
  const out = [];
  for (const [label, s] of perfSubsystems) {
    if (!s.filled) continue;
    let sum = 0, max = 0;
    for (let i = 0; i < s.filled; i++) {
      const v = s.samples[i];
      sum += v;
      if (v > max) max = v;
    }
    out.push({ label, avg: sum / s.filled, max });
  }
  out.sort((a, b) => b.avg - a.avg);
  return out;
}
game.perfRecord = perfRecord;
game.perfSubsystemStats = perfSubsystemStats;

// ─── Boot ─────────────────────────────────────────────────────────────────────
resize();
updateBtns();
mouse.x = W/2; mouse.y = H/2;
window.addEventListener('resize', () => { resize(); updateBtns(); resetTouch(); mouse.x = W/2; mouse.y = H/2; });
// Initialize telemetry — connects PostHog as transport if API key is configured
if (typeof NEON !== 'undefined' && NEON.telemetry) {
  const _phTransport = (typeof posthog !== 'undefined' && posthog.__SV)
    /**
     * @param {any} batch
     */
    ? function (/** @type {any} */ batch) {
        for (const ev of batch) posthog.capture('neon_' + ev.e, ev.p);
        return Promise.resolve();
      }
    : null;
  NEON.telemetry.init({ transport: _phTransport });
}
game.state=_GG_STATES.MENU;
music.setState('menu');
loadAppVersion();
try { const pl = document.getElementById('privLink'); if (pl) pl.style.display = ''; } catch(_){}
game.menuParticles=[];
requestAnimationFrame(loop);
