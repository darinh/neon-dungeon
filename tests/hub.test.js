'use strict';
// UNCHAINED #35 — hub state machine smoke tests. Node-only; no DOM/canvas.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const hub = require(path.resolve(__dirname, '..', 'src', 'meta', 'hub.js'));

function fakeGame(floor) {
  return {
    state: 'PLAYING',
    floor: floor | 0,
    hub: null,
    setState(s) { this.state = s; },
  };
}

test('enterHub flips state to HUB and captures floor/biome metadata', () => {
  const g = fakeGame(3);
  hub.enterHub(g);
  assert.equal(g.state, 'HUB');
  assert.ok(g.hub, 'hub state object exists');
  assert.equal(g.hub.fromFloor, 3);
  assert.equal(g.hub.nextFloor, 4);
  assert.equal(g.hub.selected, 0);
  assert.equal(g.hub.activePanel, null);
  assert.equal(g.hub.terminals.length, 4);
  assert.ok(typeof g.hub.biomeName === 'string' && g.hub.biomeName.length > 0);
});

test('exitHub clears hub and advances floor (no-fadeTo path)', () => {
  const g = fakeGame(2);
  hub.enterHub(g);
  hub.exitHub(g);
  assert.equal(g.hub, null);
  assert.equal(g.state, 'PLAYING');
  assert.equal(g.floor, 3);
});

test('terminals conform to the parallel-safety panel API', () => {
  const terms = hub.buildTerminals();
  assert.equal(terms.length, 4);
  for (const t of terms) {
    assert.equal(typeof t.id, 'string');
    assert.ok(t.id.length > 0, 'id non-empty');
    assert.equal(typeof t.label, 'string');
    assert.equal(typeof t.update, 'function');
    assert.equal(typeof t.draw, 'function');
    assert.equal(typeof t.onOpen, 'function');
    assert.equal(typeof t.onClose, 'function');
  }
  const ids = terms.map(t => t.id);
  assert.deepEqual(ids, ['upgrade', 'modules', 'armory', 'archive']);
});

test('updateHub advances selector with ArrowRight via injected input', () => {
  const g = fakeGame(1);
  hub.enterHub(g);
  const pressed = new Set(['ArrowRight']);
  g._hubInput = {
    jp: code => pressed.has(code),
    km: () => null,
  };
  hub.updateHub(g, 0.016);
  assert.equal(g.hub.selected, 1);
});

test('updateHub Space triggers exitHub', () => {
  const g = fakeGame(4);
  hub.enterHub(g);
  const pressed = new Set(['Space']);
  g._hubInput = { jp: c => pressed.has(c), km: () => null };
  hub.updateHub(g, 0.016);
  assert.equal(g.hub, null);
  assert.equal(g.floor, 5);
  assert.equal(g.state, 'PLAYING');
});

test('updateHub Enter opens selected panel; Escape closes it', () => {
  const g = fakeGame(1);
  hub.enterHub(g);
  let pressed = new Set(['Enter']);
  g._hubInput = { jp: c => pressed.has(c), km: () => null };
  hub.updateHub(g, 0.016);
  assert.ok(g.hub.activePanel, 'panel opened');
  assert.equal(g.hub.activePanel.id, 'upgrade');
  pressed = new Set(['Escape']);
  hub.updateHub(g, 0.016);
  assert.equal(g.hub.activePanel, null, 'panel closed');
});

// ─── Touch hit-test (mobile DESCEND + terminal selection) ──────────────────
// Globals W/H/isTouchDevice are normally provided by platform.js in the
// browser. For Node we set them on globalThis before the call.
function withGlobals(W_, H_, isTouch, fn) {
  const prev = {
    W: globalThis.W, H: globalThis.H,
    isTouchDevice: globalThis.isTouchDevice,
  };
  globalThis.W = W_;
  globalThis.H = H_;
  globalThis.isTouchDevice = () => !!isTouch;
  try { return fn(); } finally {
    globalThis.W = prev.W;
    globalThis.H = prev.H;
    globalThis.isTouchDevice = prev.isTouchDevice;
  }
}

test('hitTestHub returns null when no hub or panel open', () => {
  assert.equal(hub.hitTestHub({}, 100, 100), null);
  const g = fakeGame(1); hub.enterHub(g);
  g.hub.activePanel = g.hub.terminals[0]; // panel open
  withGlobals(900, 600, true, () => {
    assert.equal(hub.hitTestHub(g, 450, 300), null,
      'panel-open suppresses hit-test (panel close is handled separately)');
  });
});

test('hitTestHub finds terminal cards on tap (touch and desktop)', () => {
  const g = fakeGame(1); hub.enterHub(g);
  // Card centers should always hit. Use the layout math from hub.js:
  //   tw = min(180, floor((W - 80 - 14*(n-1)) / n))  with n=4, W=900 → 180
  //   rowX = floor((900 - (180*4 + 14*3)) / 2) = floor((900 - 762)/2) = 69
  //   rowY = floor(600/2 - 75 + 20) = 245
  withGlobals(900, 600, false, () => {
    for (let i = 0; i < 4; i++) {
      const cx = 69 + i * (180 + 14) + 90; // center of card i
      const cy = 245 + 75; // center of card vertically
      const hit = hub.hitTestHub(g, cx, cy);
      assert.deepEqual(hit, { kind: 'terminal', index: i },
        `card ${i} center should hit`);
    }
  });
});

test('hitTestHub exposes DESCEND button on touch only', () => {
  const g = fakeGame(1); hub.enterHub(g);
  // Bottom-center pill at (W-bw)/2, by = min(H-bh-24, rowY+th+80)
  // rowY=245, th=150 → rowY+th+80=475. H-bh-24 = 600-56-24 = 520. min=475.
  // bw = min(260, 900-80) = 260. bx = (900-260)/2 = 320.
  const cxBtn = 320 + 130;
  const cyBtn = 475 + 28;
  withGlobals(900, 600, true, () => {
    assert.deepEqual(hub.hitTestHub(g, cxBtn, cyBtn), { kind: 'descend' });
  });
  withGlobals(900, 600, false, () => {
    assert.equal(hub.hitTestHub(g, cxBtn, cyBtn), null,
      'no DESCEND button on desktop — keyboard handles it');
  });
});

test('hitTestHub returns null for taps on empty hub space', () => {
  const g = fakeGame(1); hub.enterHub(g);
  withGlobals(900, 600, true, () => {
    // Top-left corner — far from anything
    assert.equal(hub.hitTestHub(g, 10, 10), null);
    // Between cards (gap area). Card 0 ends at 69+180=249; card 1 starts at 263.
    // Midpoint 256 — but we pad by 4 each side, so 256 still falls inside the
    // pad of card 1 (≥ 263-4=259? no, 256 < 259) → null.
    assert.equal(hub.hitTestHub(g, 256, 320), null,
      'gap between cards (with small fat-finger pad) is not a hit');
  });
});

test('hitTestHub: short viewport — terminal cards win over DESCEND overlap', () => {
  // On H<=366 the DESCEND button used to clamp up into the card row. After
  // the collision-aware layout fix, the button is also visually held below
  // the cards. This test pins both behaviors:
  //   1) terminal hits take priority over descend (defensive)
  //   2) descend button never overlaps the card row vertically
  const g = fakeGame(1); hub.enterHub(g);
  withGlobals(640, 360, true, () => {
    // Layout (n=4, W=640, H=360):
    //   rowY = floor(180-75+20) = 125, th = 150 → card row [125..275]
    //   descend by clamped to max(rowY+th+16=291, min(H-bh-12=292, preferred=355)) = 292
    //   bw = min(260, 560) = 260, bx = (640-260)/2 = 190
    const cardCx = 41 + 1 * (129 + 14) + 64;
    const cardCy = 125 + 145; // near bottom of card 1
    assert.deepEqual(hub.hitTestHub(g, cardCx, cardCy), { kind: 'terminal', index: 1 },
      'terminal card hit-test must take priority over overlapping DESCEND');
    // Tap centered on descend button area must still resolve to descend
    assert.deepEqual(hub.hitTestHub(g, 320, 292 + 28), { kind: 'descend' });
    // No-overlap invariant: descend button top must be ≥ card row bottom
    // (we can't read layout from outside; assert via a tap just above the
    // descend button being a card hit, just below being descend).
    const justAbove = hub.hitTestHub(g, 320, 280);
    const justBelow = hub.hitTestHub(g, 320, 295);
    assert.ok(justAbove === null || justAbove.kind === 'terminal',
      'space above DESCEND is empty or a card, never DESCEND');
    assert.deepEqual(justBelow, { kind: 'descend' });
  });
});

// ─── Armory weapon-swap tests ────────────────────────────────────────────────
// These tests exercise the ArmoryTerminal's logic in isolation by reaching
// into hub.buildTerminals()[2]. The terminal interacts with a global `game`
// variable (set on globalThis in browser) — Node tests stub it.

test('armory: onOpen syncs _sel to active weaponIdx', () => {
  const armory = hub.buildTerminals()[2];
  assert.equal(armory.id, 'armory');
  /** @type {any} */ (globalThis).game = {
    player: {
      weapons: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }, { id: 'C', name: 'Charlie' }],
      weaponIdx: 1,
      weapon: { id: 'B', name: 'Beta' },
    },
  };
  try {
    armory.onOpen();
    assert.equal(armory._sel, 1, '_sel should mirror active weaponIdx on open');
  } finally {
    delete /** @type {any} */ (globalThis).game;
  }
});

test('armory: onTap on a belt slot equips that weapon', () => {
  const armory = hub.buildTerminals()[2];
  const player = {
    weapons: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }, { id: 'C', name: 'Charlie' }],
    weaponIdx: 0,
    weapon: { id: 'A', name: 'Alpha' },
    shootCooldown: 0.9,
  };
  /** @type {any} */ (globalThis).game = { player };
  try {
    armory.onOpen();
    // Layout: header 86px tall, rows 26px each. Tap centered in row 2 (idx 2).
    const bounds = { x: 0, y: 0, w: 200, h: 200 };
    armory.onTap(100, 86 + 26 * 2 + 10, bounds, /** @type {any} */ ({}));
    assert.equal(player.weaponIdx, 2, 'tap on slot 2 should set weaponIdx=2');
    assert.equal(player.weapon.id, 'C', 'active weapon should switch to slot 2');
    assert.equal(armory._sel, 2, '_sel should follow the tap');
    assert.equal(player.shootCooldown, 0, 'shootCooldown must reset on swap (mirrors cycleWeapon)');
  } finally {
    delete /** @type {any} */ (globalThis).game;
  }
});

test('armory: onTap outside any row is a no-op', () => {
  const armory = hub.buildTerminals()[2];
  const player = {
    weapons: [{ id: 'A', name: 'Alpha' }],
    weaponIdx: 0,
    weapon: { id: 'A', name: 'Alpha' },
  };
  /** @type {any} */ (globalThis).game = { player };
  try {
    armory.onOpen();
    const bounds = { x: 0, y: 0, w: 200, h: 200 };
    // Tap above the rows
    armory.onTap(100, 50, bounds, /** @type {any} */ ({}));
    assert.equal(player.weaponIdx, 0, 'tap above rows leaves weaponIdx unchanged');
    // Tap below the rows
    armory.onTap(100, 86 + 26 * 5, bounds, /** @type {any} */ ({}));
    assert.equal(player.weaponIdx, 0, 'tap below rows leaves weaponIdx unchanged');
  } finally {
    delete /** @type {any} */ (globalThis).game;
  }
});

test('armory: empty belt is safely handled (no crash on onTap/update)', () => {
  const armory = hub.buildTerminals()[2];
  /** @type {any} */ (globalThis).game = { player: { weapons: [], weaponIdx: 0, weapon: null } };
  try {
    armory.onOpen();
    armory.update(0.016);
    armory.onTap(100, 100, { x: 0, y: 0, w: 200, h: 200 }, /** @type {any} */ ({}));
    // Reaching here without throwing is the assertion.
    assert.ok(true);
  } finally {
    delete /** @type {any} */ (globalThis).game;
  }
});

test('armory: missing game global is safely handled', () => {
  const armory = hub.buildTerminals()[2];
  // Ensure no game global
  delete /** @type {any} */ (globalThis).game;
  // Should not throw
  armory.onOpen();
  assert.equal(armory._sel, 0);
  armory.update(0.016);
  armory.onTap(100, 100, { x: 0, y: 0, w: 200, h: 200 }, /** @type {any} */ ({}));
  assert.ok(true);
});
