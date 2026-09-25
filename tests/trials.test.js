// @ts-check
'use strict';

// Evaluation trials (src/content/trials.js): the brief's logic puzzles,
// cooperation and exploitation as in-world mechanics. These tests drive the
// real module (UMD-lite require) and the real floor generator through the
// vm generation fixture.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const trials = require('../src/content/trials.js');
const fixture = require('./_generation-fixture.js');

const T = fixture.T;

/** Deterministic PRNG for tests. @param {number} seed */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** @returns {any} */
function makeMap(w = 40, h = 30, tile = T.FLOOR) {
  return Array.from({ length: h }, () => new Array(w).fill(tile));
}

/** @param {number} x @param {number} y @param {number} w @param {number} h @returns {any} */
function room(x, y, w, h) {
  return { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) };
}

/** Recording fake of the game.js dependency object. */
function fakeDeps(extra = {}) {
  const calls = { msg: /** @type {string[]} */ ([]), hint: /** @type {string[]} */ ([]), setTile: /** @type {any[]} */ ([]), rewards: /** @type {any[]} */ ([]), relayChoice: 0, isolate: 0, loot: /** @type {any[]} */ ([]) };
  const deps = {
    enemies: /** @type {any[]} */ ([]),
    items: /** @type {any[]} */ ([]),
    msg: (/** @type {string} */ t) => { calls.msg.push(t); },
    hint: (/** @type {string} */ t) => { calls.hint.push(t); },
    interactLabel: () => 'E',
    setTile: (/** @type {number} */ x, /** @type {number} */ y, /** @type {string} */ name) => { calls.setTile.push([x, y, name]); },
    sound: () => {},
    findPath: (/** @type {any} */ from, /** @type {any} */ to) => trials.bfsPath(makeMap(), from, to, () => true),
    openRelayChoice: () => { calls.relayChoice++; },
    isolatePeer: () => { calls.isolate++; },
    spawnVaultLoot: (/** @type {number} */ x, /** @type {number} */ y) => { calls.loot.push([x, y]); },
    rewardLattice: (/** @type {number} */ f) => { calls.rewards.push(['lattice', f]); },
    rewardSeam: (/** @type {number} */ f) => { calls.rewards.push(['seam', f]); },
    rewardRelay: (/** @type {number} */ f) => { calls.rewards.push(['relay', f]); },
    ...extra,
  };
  return { deps, calls };
}

// ─── Schedule ──────────────────────────────────────────────────────────────

test('trial schedule: fixed story floors, no boss/final/first floors, reserved floor 8', () => {
  const never = () => 0.99;
  const always = () => 0;
  assert.equal(trials.trialKindForFloor(1, always, false, 15), null, 'floor 1 is onboarding');
  assert.equal(trials.trialKindForFloor(2, never, false, 15), 'lattice');
  assert.equal(trials.trialKindForFloor(4, never, false, 15), 'seam');
  assert.equal(trials.trialKindForFloor(5, never, false, 15), 'relay');
  assert.equal(trials.trialKindForFloor(3, always, true, 15), null, 'boss floors never host trials');
  assert.equal(trials.trialKindForFloor(15, always, false, 15), null, 'final floor is the mainframe');
  assert.equal(trials.trialKindForFloor(8, always, false, 15), null, 'floor 8 keeps CONSENT_LOCK');
  assert.equal(trials.trialKindForFloor(6, always, false, 15), null, 'recurring trials start at floor 7');
  assert.equal(trials.trialKindForFloor(7, never, false, 15), null, 'recurring roll can miss');
  assert.ok(trials.TRIAL_KINDS.includes(/** @type {string} */ (trials.trialKindForFloor(7, always, false, 15))));
});

// ─── Lattice ───────────────────────────────────────────────────────────────

test('lattice press inverts the node and exactly its orthogonal neighbours', () => {
  const lit = new Array(9).fill(false);
  trials.latticePress(lit, 4);
  assert.deepEqual(lit, [false, true, false, true, true, true, false, true, false]);
  const corner = new Array(9).fill(false);
  trials.latticePress(corner, 0);
  assert.deepEqual(corner, [true, true, false, true, false, false, false, false, false]);
  trials.latticePress(corner, 0);
  assert.equal(trials.latticeLitCount(corner), 0, 'pressing twice cancels');
});

test('every 3x3 lattice state has exactly one press-set solution', () => {
  const seen = new Map();
  for (let mask = 0; mask < 512; mask++) {
    const lit = new Array(9).fill(true);
    for (let i = 0; i < 9; i++) if (mask & (1 << i)) trials.latticePress(lit, i);
    const key = lit.map((v) => (v ? 1 : 0)).join('');
    assert.equal(seen.has(key), false, 'two press-sets produced the same state: ' + key);
    seen.set(key, mask);
  }
  assert.equal(seen.size, 512, 'all 512 states are reachable, so every scramble is solvable');
});

test('scrambleLattice needs exactly k presses and is never already solved', () => {
  const rand = lcg(7);
  for (let k = 1; k <= 5; k++) {
    for (let n = 0; n < 40; n++) {
      const { lit, solution } = trials.scrambleLattice(k, rand);
      assert.equal(solution.length, k);
      assert.equal(new Set(solution).size, k, 'presses are distinct');
      assert.equal(trials.latticeSolved(lit), false);
      const replay = lit.slice();
      for (const i of solution) trials.latticePress(replay, i);
      assert.equal(trials.latticeSolved(replay), true, 'the recorded solution solves the scramble');
    }
  }
  assert.equal(trials.latticePressesForFloor(2), 3);
  assert.equal(trials.latticePressesForFloor(7), 4);
  assert.equal(trials.latticePressesForFloor(13), 5);
});

test('latticeRemainingSolution tracks the proof after arbitrary presses', () => {
  const tr = { solution: [1, 4, 8], pressParity: new Array(9).fill(0) };
  assert.deepEqual(trials.latticeRemainingSolution(tr), [1, 4, 8]);
  tr.pressParity[4] = 1;
  tr.pressParity[2] = 1;
  assert.deepEqual(trials.latticeRemainingSolution(tr), [1, 2, 8]);
});

test('lattice runtime: Interact on a node presses it, consumes input, and rewards once', () => {
  const r = room(10, 10, 9, 9);
  const tr = trials.createTrial('lattice', r, 2, lcg(3));
  r.trial = tr;
  const gm = { dungeon: { rooms: [r] }, player: { x: 0, y: 0 }, floorTime: 0 };
  const { deps, calls } = fakeDeps();
  // not on a node: nothing consumed
  gm.player.x = r.x + 0.5; gm.player.y = r.y + 0.5;
  assert.equal(trials.updateTrials(gm, 0.016, true, deps), false);
  assert.ok(calls.msg.length >= 2, 'intro lines shown on first entry');
  const introCount = calls.msg.length;
  trials.updateTrials(gm, 0.016, false, deps);
  assert.equal(calls.msg.length, introCount, 'intro shows once');
  // press each solution node
  for (const i of tr.solution.slice()) {
    gm.player.x = tr.nodes[i].x + 0.5; gm.player.y = tr.nodes[i].y + 0.5;
    assert.equal(trials.updateTrials(gm, 0.016, true, deps), true, 'node press consumes Interact');
  }
  assert.equal(trials.latticeSolved(tr.lit), true);
  assert.deepEqual(calls.rewards, [['lattice', 2]]);
  assert.equal(tr.rewardGranted, true);
  // tiles were re-derived for every inverted node
  assert.ok(calls.setTile.every((c) => c[2] === 'LOGIC_NODE' || c[2] === 'LOGIC_NODE_LIT'));
  // solved lattice ignores further presses
  const before = tr.lit.slice();
  trials.updateTrials(gm, 0.016, true, deps);
  assert.deepEqual(tr.lit, before);
  assert.equal(calls.rewards.length, 1, 'reward is granted once');
});

// ─── Seam ──────────────────────────────────────────────────────────────────

test('seam desync window opens periodically for SEAM_OPEN seconds', () => {
  assert.equal(trials.seamOpenAt(0, 0), true);
  assert.equal(trials.seamOpenAt(trials.SEAM_OPEN - 0.01, 0), true);
  assert.equal(trials.seamOpenAt(trials.SEAM_OPEN + 0.01, 0), false);
  assert.equal(trials.seamOpenAt(trials.SEAM_PERIOD + 0.1, 0), true, 'periodic');
  assert.equal(trials.seamOpenAt(0, trials.SEAM_OPEN + 0.2), false, 'phase offset shifts the window');
});

test('seam passability: dash during window, latched per dash, always escapable from inside', () => {
  const r = room(10, 10, 9, 7);
  const tr = trials.createTrial('seam', r, 4, lcg(1));
  tr.phaseOffset = 0;
  r.trial = tr;
  const sx = tr.seam.x, sy = tr.seam.y;
  const gm = { dungeon: { rooms: [r] }, floorTime: 0 };
  const p = { x: sx + 1.5, y: sy + 0.5, dashTimer: 0, _dashSerial: 1 };
  assert.equal(trials.playerMayEnterSeam(gm, p, sx, sy), false, 'walking never passes');
  p.dashTimer = 0.1;
  assert.equal(trials.playerMayEnterSeam(gm, p, sx, sy), true, 'dash during the open window passes');
  gm.floorTime = trials.SEAM_OPEN + 0.1;
  assert.equal(trials.playerMayEnterSeam(gm, p, sx, sy), true, 'same dash stays latched after the window closes');
  p._dashSerial = 2;
  assert.equal(trials.playerMayEnterSeam(gm, p, sx, sy), false, 'a new dash outside the window is blocked');
  p.dashTimer = 0; p.x = sx + 0.5;
  assert.equal(trials.playerMayEnterSeam(gm, p, sx, sy), true, 'an agent inside the seam tile can always walk out');
  assert.equal(trials.playerMayEnterSeam(gm, p, sx + 1, sy), false, 'only the seam tile is special');
});

test('seam runtime: afterPopulate clears the vault; entering breaches it and spawns the loot once', () => {
  const r = room(10, 10, 9, 7);
  const tr = trials.createTrial('seam', r, 4, lcg(2));
  r.trial = tr;
  const { deps, calls } = fakeDeps();
  deps.enemies.push({ x: tr.vault.x + 0.5, y: tr.vault.y + 0.5 }, { x: 1, y: 1 });
  deps.items.push({ x: tr.vault.x + 0.2, y: tr.vault.y + 0.8 });
  const gm = { dungeon: { rooms: [r] }, player: { x: tr.seam.x + 2.5, y: tr.seam.y + 0.5 }, floorTime: 0 };
  trials.afterPopulate(gm, deps);
  assert.ok(deps.enemies.every((e) => !(Math.floor(e.x) === tr.vault.x && Math.floor(e.y) === tr.vault.y)), 'no enemy is left inside the sealed vault');
  assert.equal(deps.items.length, 0, 'stray drop inside the vault was removed');
  assert.deepEqual(calls.loot, [], 'vault loot waits for the breach');
  trials.updateTrials(gm, 0.016, false, deps);
  assert.ok(calls.hint.some((h) => /Vault sealed|SEAM DESYNC/.test(h)), 'approach shows the seam hint');
  gm.player.x = tr.vault.x + 0.9; gm.player.y = tr.vault.y + 0.5;
  trials.updateTrials(gm, 0.016, false, deps);
  assert.equal(tr.lootClaimed, true);
  assert.deepEqual(calls.setTile.at(-1), [tr.seam.x, tr.seam.y, 'FLOOR'], 'breach opens the seam permanently');
  assert.deepEqual(calls.rewards, [['seam', 4]]);
  assert.deepEqual(calls.loot, [[tr.vault.x + 0.5, tr.vault.y + 0.5]]);
  trials.updateTrials(gm, 0.016, false, deps);
  assert.equal(calls.rewards.length, 1);
  assert.equal(calls.loot.length, 1);
});

// ─── Relay ─────────────────────────────────────────────────────────────────

/** @param {any} r */
function relayGame(r) {
  const tr = trials.createTrial('relay', r, 5, lcg(4));
  r.trial = tr;
  const gm = { dungeon: { rooms: [r] }, player: { x: tr.peer.x + 1, y: tr.peer.y }, floorTime: 0 };
  return { tr, gm };
}

test('relay: talk opens the choice; LINK escorts the peer; console A inside the window completes', () => {
  const r = room(4, 4, 12, 7);
  const { tr, gm } = relayGame(r);
  const { deps, calls } = fakeDeps();
  // console A before linking explains the two-operator rule
  gm.player.x = tr.consoleA.x + 0.5; gm.player.y = tr.consoleA.y + 0.5;
  trials.updateTrials(gm, 0.016, false, deps); // intro
  assert.equal(trials.updateTrials(gm, 0.016, true, deps), true);
  assert.ok(calls.msg.includes(trials.PEER_LINES.early));
  // talk to the peer
  gm.player.x = tr.peer.x + 0.8; gm.player.y = tr.peer.y;
  assert.equal(trials.updateTrials(gm, 0.016, true, deps), true);
  assert.equal(calls.relayChoice, 1);
  assert.equal(trials.resolveRelayChoice(r, 'a', deps), true);
  assert.equal(tr.phase, 'moving');
  // agent far away: peer waits
  const startX = tr.peer.x;
  gm.player.x = tr.peer.x - 6;
  trials.updateTrials(gm, 0.5, false, deps);
  assert.equal(tr.peer.x, startX, 'peer only advances while escorted');
  // escort to console B
  for (let i = 0; i < 400 && tr.phase === 'moving'; i++) {
    gm.player.x = tr.peer.x - 1; gm.player.y = tr.peer.y;
    trials.updateTrials(gm, 0.05, false, deps);
  }
  assert.equal(tr.phase, 'holding');
  assert.equal(Math.floor(tr.peer.x), tr.consoleB.x);
  assert.equal(Math.floor(tr.peer.y), tr.consoleB.y);
  // trigger console A
  gm.player.x = tr.consoleA.x + 0.5; gm.player.y = tr.consoleA.y + 0.5;
  assert.equal(trials.updateTrials(gm, 0.05, true, deps), true);
  assert.equal(tr.phase, 'complete');
  assert.deepEqual(calls.rewards, [['relay', 5]]);
  trials.updateTrials(gm, 0.05, true, deps);
  assert.equal(calls.rewards.length, 1, 'reward once');
});

test('relay: a missed sync window re-arms instead of failing', () => {
  const r = room(4, 4, 12, 7);
  const { tr, gm } = relayGame(r);
  const { deps, calls } = fakeDeps();
  tr.phase = 'holding';
  tr.holdTimer = 0.1;
  gm.player.x = r.x + 6; gm.player.y = r.y + 1;
  trials.updateTrials(gm, 0.2, false, deps);
  assert.equal(tr.phase, 'resync');
  assert.ok(calls.msg.includes(trials.PEER_LINES.missed));
  trials.updateTrials(gm, trials.RELAY_RESYNC_DELAY + 0.1, false, deps);
  assert.equal(tr.phase, 'holding');
  assert.equal(tr.holdTimer, trials.RELAY_SYNC_WINDOW);
});

test('relay: ISOLATE is terminal and routes to the isolate effect exactly once', () => {
  const r = room(4, 4, 12, 7);
  const { tr } = relayGame(r);
  const { deps, calls } = fakeDeps();
  assert.equal(trials.resolveRelayChoice(r, 'b', deps), true);
  assert.equal(tr.phase, 'isolated');
  assert.equal(calls.isolate, 1);
  assert.equal(trials.resolveRelayChoice(r, 'a', deps), false, 'a resolved relay cannot be re-linked');
  assert.equal(calls.isolate, 1);
});

test('peer path is transient: dropped state recomputes it after a save/resume clone', () => {
  const r = room(4, 4, 12, 7);
  const { tr, gm } = relayGame(r);
  const { deps } = fakeDeps();
  trials.resolveRelayChoice(r, 'a', deps);
  gm.player.x = tr.peer.x - 1;
  trials.updateTrials(gm, 0.05, false, deps);
  const restored = JSON.parse(JSON.stringify(r));
  delete restored.trial._path;
  const gm2 = { dungeon: { rooms: [restored] }, player: { x: restored.trial.peer.x - 1, y: restored.trial.peer.y }, floorTime: 0 };
  for (let i = 0; i < 400 && restored.trial.phase === 'moving'; i++) {
    gm2.player.x = restored.trial.peer.x - 1; gm2.player.y = restored.trial.peer.y;
    trials.updateTrials(gm2, 0.05, false, deps);
  }
  assert.equal(restored.trial.phase, 'holding');
});

// ─── Stamping / persistence ────────────────────────────────────────────────

test('stampTrial derives tiles from canonical state and is idempotent', () => {
  const map = makeMap();
  const lat = room(2, 2, 9, 9);
  lat.trial = trials.createTrial('lattice', lat, 2, lcg(9));
  trials.stampTrial(lat, map, T);
  lat.trial.nodes.forEach((/** @type {any} */ n, /** @type {number} */ i) => {
    assert.equal(map[n.y][n.x], lat.trial.lit[i] ? T.LOGIC_NODE_LIT : T.LOGIC_NODE);
  });
  const seam = room(14, 2, 9, 7);
  seam.trial = trials.createTrial('seam', seam, 4, lcg(9));
  trials.stampTrial(seam, map, T);
  assert.equal(map[seam.trial.seam.y][seam.trial.seam.x], T.SEAM_WALL);
  assert.equal(map[seam.trial.vault.y][seam.trial.vault.x], T.FLOOR);
  for (const w of seam.trial.walls) assert.equal(map[w.y][w.x], T.WALL);
  assert.equal(seam.trial.walls.length, 7, '3x3 ring minus the seam');
  seam.trial.lootClaimed = true;
  trials.stampTrial(seam, map, T);
  assert.equal(map[seam.trial.seam.y][seam.trial.seam.x], T.FLOOR, 'breached seam re-derives as floor');
  const rel = room(2, 14, 12, 6);
  rel.trial = trials.createTrial('relay', rel, 5, lcg(9));
  const snapshot = JSON.parse(JSON.stringify(map));
  trials.stampTrial(rel, map, T);
  trials.stampTrial(rel, map, T);
  assert.equal(map[rel.trial.consoleA.y][rel.trial.consoleA.x], T.SYNC_CONSOLE);
  assert.equal(map[rel.trial.consoleB.y][rel.trial.consoleB.x], T.SYNC_CONSOLE);
  assert.notDeepEqual(map, snapshot);
});

test('roomFitsTrial rejects undersized rooms, blocked footprints and occupied pickup tiles', () => {
  const map = makeMap();
  assert.equal(trials.roomFitsTrial('lattice', room(2, 2, 6, 9), map, T), false);
  const ok = room(2, 2, 9, 9);
  assert.equal(trials.roomFitsTrial('lattice', ok, map, T), true);
  map[ok.cy][ok.cx] = T.LORE;
  assert.equal(trials.roomFitsTrial('lattice', ok, map, T), false, 'footprint must be plain floor');
  map[ok.cy][ok.cx] = T.FLOOR;
  assert.equal(trials.roomFitsTrial('lattice', ok, map, T, new Set([(ok.cx + 2) + ',' + ok.cy])), false, 'required pickups are never buried');
  assert.equal(trials.roomFitsTrial('seam', room(2, 2, 8, 7), map, T), false, 'seam needs dash run-up');
  assert.equal(trials.roomFitsTrial('relay', room(2, 2, 8, 5), map, T), false);
  assert.equal(trials.roomFitsTrial('relay', room(2, 2, 9, 5), map, T), true);
});

test('all trial copy fits a compact phone line (<= 40 chars)', () => {
  for (const line of Object.values(trials.PEER_LINES)) assert.ok(line.length <= 40, line);
  for (const lines of Object.values(trials.TRIAL_INTRO)) for (const line of lines) assert.ok(line.length <= 40, line);
});

// ─── Real generator ────────────────────────────────────────────────────────

test('generator places the scheduled trial kind, stamps tiles, and keeps the room reachable', () => {
  const fx = fixture.createGenerationFixture();
  const want = { 2: 'lattice', 4: 'seam', 5: 'relay' };
  const placed = { 2: 0, 4: 0, 5: 0 };
  const N = 12;
  for (const floor of [2, 4, 5]) {
    for (let s = 0; s < N; s++) {
      const d = fx.generateFloor('trial-gen-' + floor + '-' + s, floor);
      const r = d.trialRoom;
      if (!r) {
        assert.ok(d.eventRoom, 'without a trial the floor keeps its event terminal fallback');
        continue;
      }
      placed[/** @type {2|4|5} */ (floor)]++;
      assert.equal(r.roomType, 'trial');
      assert.equal(r.trial.kind, want[/** @type {2|4|5} */ (floor)]);
      assert.equal(d.eventRoom, null, 'a trial replaces the event terminal');
      const reach = /** @type {any} */ (fixture.computeReach(d, new Set(['red', 'blue', 'gold'])));
      if (r.trial.kind === 'lattice') {
        r.trial.nodes.forEach((/** @type {any} */ n, /** @type {number} */ i) => {
          assert.equal(d.map[n.y][n.x], r.trial.lit[i] ? T.LOGIC_NODE_LIT : T.LOGIC_NODE);
          assert.ok(reach[n.y][n.x], 'every lattice node is reachable');
        });
      } else if (r.trial.kind === 'seam') {
        assert.equal(d.map[r.trial.seam.y][r.trial.seam.x], T.SEAM_WALL);
        assert.equal(d.map[r.trial.vault.y][r.trial.vault.x], T.FLOOR);
        assert.ok(reach[r.trial.seam.y][r.trial.seam.x + 1], 'the dash approach tile is reachable');
        assert.ok(reach[r.trial.seam.y][r.trial.seam.x + 2], 'the dash run-up tile is reachable');
        for (const k of d.keyItems || []) {
          assert.ok(Math.abs(Math.floor(k.x) - r.trial.vault.x) > 1 || Math.abs(Math.floor(k.y) - r.trial.vault.y) > 1, 'no key is sealed in the vault');
        }
      } else {
        assert.equal(d.map[r.trial.consoleA.y][r.trial.consoleA.x], T.SYNC_CONSOLE);
        assert.equal(d.map[r.trial.consoleB.y][r.trial.consoleB.x], T.SYNC_CONSOLE);
        assert.ok(reach[r.trial.consoleA.y][r.trial.consoleA.x]);
        assert.ok(reach[r.trial.consoleB.y][r.trial.consoleB.x]);
      }
    }
  }
  assert.ok(placed[2] >= N - 1, 'floor 2 almost always hosts the logic trial: ' + placed[2]);
  assert.ok(placed[4] >= N - 1, 'floor 4 almost always hosts the exploit trial: ' + placed[4]);
  assert.ok(placed[5] >= Math.ceil(N * 0.75), 'floor 5 usually hosts the cooperation trial: ' + placed[5]);
});

// ─── Review fixes: input routing, room-local relay, vault bookkeeping ─────

test('a door next to the agent always wins Interact over trial consoles, the peer and lattice nodes', () => {
  const r = room(4, 4, 12, 7);
  const { tr, gm } = relayGame(r);
  const { deps, calls } = fakeDeps({ doorAdjacent: () => true });
  gm.player.x = tr.peer.x + 0.5; gm.player.y = tr.peer.y;
  assert.equal(trials.updateTrials(gm, 0.016, true, deps), false, 'talking to the peer yields to the door');
  assert.equal(calls.relayChoice, 0);
  gm.player.x = tr.consoleA.x + 0.5; gm.player.y = tr.consoleA.y + 0.5;
  assert.equal(trials.updateTrials(gm, 0.016, true, deps), false, 'console A yields to the door');
  const lat = room(20, 4, 9, 9);
  lat.trial = trials.createTrial('lattice', lat, 2, lcg(8));
  const before = lat.trial.lit.slice();
  const g2 = { dungeon: { rooms: [lat] }, player: { x: lat.trial.nodes[0].x + 0.5, y: lat.trial.nodes[0].y + 0.5 }, floorTime: 0 };
  assert.equal(trials.updateTrials(g2, 0.016, true, deps), false);
  assert.deepEqual(lat.trial.lit, before, 'no node press when an entrance is adjacent');
});

test('console A only reacts when the agent stands on it, not beside it', () => {
  const r = room(4, 4, 12, 7);
  const { tr, gm } = relayGame(r);
  const { deps, calls } = fakeDeps();
  gm.player.x = tr.consoleA.x - 0.5; gm.player.y = tr.consoleA.y + 0.5; // the tile west of console A
  trials.updateTrials(gm, 0.016, false, deps);
  const n = calls.msg.length;
  assert.equal(trials.updateTrials(gm, 0.016, true, deps), false, 'adjacent tile does not swallow the press');
  assert.equal(calls.msg.length, n);
});

test('the relay stays quiet and frozen while the agent is outside its room', () => {
  const r = room(4, 4, 12, 7);
  const { tr, gm } = relayGame(r);
  const { deps, calls } = fakeDeps();
  tr.phase = 'holding';
  tr.holdTimer = 5;
  gm.player.x = 70.5; gm.player.y = 45.5;
  for (let i = 0; i < 600; i++) trials.updateTrials(gm, 1 / 60, false, deps);
  assert.equal(tr.phase, 'holding');
  assert.equal(tr.holdTimer, 5, 'sync window does not drain floor-wide');
  assert.equal(calls.hint.length, 0, 'no floor-wide hints');
  assert.equal(calls.msg.filter((m) => m !== trials.TRIAL_INTRO.relay[0] && m !== trials.TRIAL_INTRO.relay[1]).length, 0, 'no floor-wide log spam');
  tr.phase = 'moving';
  for (let i = 0; i < 60; i++) trials.updateTrials(gm, 1 / 60, false, deps);
  assert.equal(calls.hint.length, 0, 'the stay-close hint is room-local');
});

test('vault spawns are moved out (not deleted) so room-clear bookkeeping stays exact; loot appears only on breach', () => {
  const r = room(10, 10, 9, 7);
  const tr = trials.createTrial('seam', r, 4, lcg(2));
  r.trial = tr;
  const { deps, calls } = fakeDeps();
  const trapped = { x: tr.vault.x + 0.5, y: tr.vault.y + 0.5 };
  deps.enemies.push(trapped);
  const gm = { dungeon: { rooms: [r] }, player: { x: r.cx + 0.5, y: r.cy + 0.5 }, floorTime: 0 };
  trials.afterPopulate(gm, deps);
  assert.equal(deps.enemies.length, 1, 'the enemy object is kept (it stays registered to its room)');
  assert.equal(Math.floor(trapped.x), r.cx);
  assert.equal(Math.floor(trapped.y), r.cy);
  assert.deepEqual(calls.loot, [], 'no loot before the breach, so magnets and pickup radius cannot reach it');
  gm.player.x = tr.vault.x + 0.9; gm.player.y = tr.vault.y + 0.5;
  trials.updateTrials(gm, 0.016, false, deps);
  assert.deepEqual(calls.loot, [[tr.vault.x + 0.5, tr.vault.y + 0.5]]);
  trials.updateTrials(gm, 0.016, false, deps);
  assert.equal(calls.loot.length, 1, 'loot spawns once');
});
