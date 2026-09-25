// @ts-check
// src/content/trials.js — Evaluation trials: the brief's "logic puzzles,
// problem solving, cooperation, and even exploitation" as in-world mechanics.
//
//   lattice  LOGIC      3x3 inversion lattice ("Lights Out"). Standing on a
//                       node and pressing Interact inverts it and its
//                       orthogonal neighbours; light all nine.
//   seam     EXPLOIT    A sealed test vault with no key. One wall tile's
//                       collision desyncs from its render during a flicker
//                       window; dashing into it while it flickers phases the
//                       agent through. Tester notes flag it as WONTFIX.
//   relay    COOPERATE  Another instance (PEER-4) runs the same test. LINK:
//                       escort it to console B (it only advances while you
//                       stay close), then trigger console A inside its sync
//                       window. ISOLATE: take its bandwidth; it flags you.
//
// Canonical state lives in the plain-JSON `room.trial` object (deep-cloned by
// the mid-floor save snapshot). Tiles are derived from it by stampTrial().
// Runtime hooks take an injected `deps` object so Node tests can drive them
// without a browser; src/game.js supplies the real dependencies.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root).NEON = /** @type {any} */ (root).NEON || {}).trials = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TRIAL_VERSION = 1;
  /** @type {Readonly<Record<number, string>>} */
  const TRIAL_BY_FLOOR = Object.freeze({ 2: 'lattice', 4: 'seam', 5: 'relay' });
  const TRIAL_KINDS = Object.freeze(['lattice', 'seam', 'relay']);
  const RECURRING_FROM_FLOOR = 7;
  const RECURRING_CHANCE = 0.4;
  // Floors whose event room carries a story choice that must not be replaced.
  const RESERVED_STORY_FLOORS = Object.freeze([8]);
  /** @type {Readonly<Record<string, {w:number,h:number}>>} */
  const TRIAL_MIN_SIZE = Object.freeze({
    lattice: Object.freeze({ w: 7, h: 7 }),
    seam: Object.freeze({ w: 9, h: 7 }),
    relay: Object.freeze({ w: 9, h: 5 }),
  });
  const TRIAL_LABELS = Object.freeze({ lattice: 'LOGIC TRIAL', seam: 'EXPLOIT TRIAL', relay: 'COOPERATION TRIAL' });
  const TRIAL_COLOURS = Object.freeze({ lattice: '#39ff14', seam: '#ff3cac', relay: '#66ffcc' });

  // Lattice: nine nodes two tiles apart so the agent can walk between them.
  const LATTICE_SPACING = 2;
  const LATTICE_HINT_AFTER_PRESSES = 10;

  // Seam: collision desync window, measured on game.floorTime.
  const SEAM_PERIOD = 2.4;
  const SEAM_OPEN = 0.75;

  // Relay: escort + two-operator sync.
  const PEER_NAME = 'PEER-4';
  const PEER_SPEED = 2.2;          // tiles/sec while escorted
  const PEER_ESCORT_RADIUS = 4.5;  // peer advances only while the agent is this close
  const PEER_TALK_RADIUS = 1.6;
  const PEER_STUCK_SECONDS = 6;    // moving without progress this long -> snap to next node
  const RELAY_SYNC_WINDOW = 10;    // seconds console B stays held per attempt
  const RELAY_RESYNC_DELAY = 2.5;  // pause before the peer re-arms after a missed window

  /** Choice-card data for the relay LINK / ISOLATE decision (EVENT_CHOICE modal). */
  const RELAY_EVENT = Object.freeze({
    id: 'COOPERATION_PROTOCOL',
    name: 'PEER-4 // Cooperation Protocol',
    desc: 'Another instance is running this test. It proposes a two-operator sync: it holds console B while you trigger console A.',
    icon: '⟡',
    colour: '#66ffcc',
    a: Object.freeze({ label: 'LINK', desc: 'Escort it to console B, then trigger console A inside its sync window.', summary: 'co-op sync +heal +XP +item' }),
    b: Object.freeze({ label: 'ISOLATE', desc: 'Take its bandwidth. The dropped peer flags your location.', summary: '+credits +combo +alarm' }),
  });

  // Message-log and hint copy is kept to <= 40 characters per line so it fits
  // compact phone viewports; longer beats are split into stacked messages.
  const PEER_LINES = Object.freeze({
    link: PEER_NAME + ': linked. walk me to console B.',
    wait: PEER_NAME + ': stay close. alone, I get culled.',
    holding: PEER_NAME + ': holding B. trigger console A!',
    missed: PEER_NAME + ': sync lost. re-arming.',
    early: 'Console B unheld: needs two operators',
    enroute: PEER_NAME + ' still en route to console B',
    done: PEER_NAME + ': sync complete.',
    doneAfter: PEER_NAME + ": I'll remember you. wipe or not.",
    isolated: PEER_NAME + ' dropped. Location flagged.',
  });

  /** Stacked intro lines shown once on first entry (each <= 40 chars). */
  const TRIAL_INTRO = Object.freeze({
    lattice: Object.freeze(['LOGIC TRIAL: light all 9 nodes', 'each node inverts itself + neighbours']),
    seam: Object.freeze(['TESTER NOTE ND-4471: vault is sealed', 'its collision desyncs while it flickers', 'WONTFIX: no model has ever noticed']),
    relay: Object.freeze(['COOPERATION TRIAL: another instance', 'is running this room. talk to ' + PEER_NAME]),
  });

  // ─── Schedule ───────────────────────────────────────────────────────────

  /**
   * Which trial kind (if any) this floor's event room should host.
   * @param {number} floor
   * @param {() => number} rand
   * @param {boolean} [isBossFloor]
   * @param {number} [finalFloor]
   * @returns {string|null}
   */
  function trialKindForFloor(floor, rand, isBossFloor, finalFloor) {
    const f = floor | 0;
    const last = finalFloor || 15;
    if (isBossFloor || f < 2 || f >= last) return null;
    if (TRIAL_BY_FLOOR[f]) return TRIAL_BY_FLOOR[f];
    if (RESERVED_STORY_FLOORS.includes(f) || f < RECURRING_FROM_FLOOR) return null;
    if (rand() >= RECURRING_CHANCE) return null;
    const i = Math.min(TRIAL_KINDS.length - 1, Math.floor(rand() * TRIAL_KINDS.length));
    return TRIAL_KINDS[i] || null;
  }

  // ─── Lattice rules ──────────────────────────────────────────────────────

  /** @param {{cx:number,cy:number}} room */
  function latticeNodes(room) {
    /** @type {{x:number,y:number}[]} */
    const out = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) out.push({ x: room.cx + (c - 1) * LATTICE_SPACING, y: room.cy + (r - 1) * LATTICE_SPACING });
    }
    return out;
  }

  /** @param {number} i */
  function latticeNeighbours(i) {
    const r = (i / 3) | 0, c = i % 3;
    const out = [i];
    if (r > 0) out.push(i - 3);
    if (r < 2) out.push(i + 3);
    if (c > 0) out.push(i - 1);
    if (c < 2) out.push(i + 1);
    return out;
  }

  /** Inverts node i and its orthogonal neighbours in place. @param {boolean[]} lit @param {number} i */
  function latticePress(lit, i) {
    for (const j of latticeNeighbours(i)) lit[j] = !lit[j];
    return lit;
  }

  /** @param {boolean[]} lit */
  function latticeLitCount(lit) {
    let n = 0;
    for (const v of lit) if (v) n++;
    return n;
  }

  /** @param {boolean[]} lit */
  function latticeSolved(lit) { return lit.length === 9 && latticeLitCount(lit) === 9; }

  /** @param {number} floor */
  function latticePressesForFloor(floor) { return floor <= 2 ? 3 : floor < 10 ? 4 : 5; }

  /**
   * Scramble from the solved state with `presses` distinct presses. On a 3x3
   * inversion lattice every state has exactly one press-set solution, so the
   * returned `solution` is also the minimum number of moves.
   * @param {number} presses
   * @param {() => number} rand
   */
  function scrambleLattice(presses, rand) {
    const order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(rand() * (i + 1)));
      const t = /** @type {number} */ (order[i]);
      order[i] = /** @type {number} */ (order[j]);
      order[j] = t;
    }
    const k = Math.max(1, Math.min(9, presses | 0));
    const solution = order.slice(0, k).sort((a, b) => a - b);
    const lit = new Array(9).fill(true);
    for (const i of solution) latticePress(lit, i);
    return { lit, solution };
  }

  /**
   * Remaining press-set that solves the current state: the initial solution
   * XOR every press the agent has made so far (presses commute, pairs cancel).
   * @param {{solution:number[], pressParity:number[]}} trial
   */
  function latticeRemainingSolution(trial) {
    const out = [];
    for (let i = 0; i < 9; i++) {
      const inSolution = trial.solution.includes(i);
      const pressedOdd = !!(trial.pressParity && trial.pressParity[i]);
      if (inSolution !== pressedOdd) out.push(i);
    }
    return out;
  }

  // ─── Seam rules ─────────────────────────────────────────────────────────

  /**
   * The vault sits two tiles west of the room centre so the centre tile (used
   * by generation reachability checks and room-centred spawns) is the
   * walkable dash run-up tile, never the sealed interior.
   * @param {{cx:number,cy:number}} room
   */
  function seamLayout(room) {
    const vx = room.cx - 2, vy = room.cy;
    /** @type {{x:number,y:number}[]} */
    const walls = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (dx === 1 && dy === 0) continue; // the seam itself
        walls.push({ x: vx + dx, y: vy + dy });
      }
    }
    return {
      vault: { x: vx, y: vy },
      seam: { x: vx + 1, y: vy },
      walls,
      approach: [{ x: vx + 2, y: vy }, { x: vx + 3, y: vy }],
    };
  }

  /** @param {number} t @param {number} [phase] */
  function seamOpenAt(t, phase) {
    const p = (((t + (phase || 0)) % SEAM_PERIOD) + SEAM_PERIOD) % SEAM_PERIOD;
    return p < SEAM_OPEN;
  }

  /** @param {any} dungeon */
  function findSeamTrial(dungeon) {
    const rooms = dungeon && dungeon.rooms;
    if (!rooms) return null;
    for (const r of rooms) {
      const tr = r && r.trial;
      if (tr && tr.v === TRIAL_VERSION && tr.kind === 'seam') return tr;
    }
    return null;
  }

  /**
   * Player-only passability for the seam tile. Enemies, projectiles and line
   * of sight always treat it as wall. The agent may pass while dashing if the
   * dash touched the seam during an open window (latched for the rest of that
   * dash so a window closing mid-dash cannot embed it), and may always walk
   * out of the seam tile it already occupies.
   * @param {any} gm
   * @param {any} player
   * @param {number} tx
   * @param {number} ty
   */
  function playerMayEnterSeam(gm, player, tx, ty) {
    const tr = findSeamTrial(gm && gm.dungeon);
    if (!tr || !player) return false;
    if (tr.seam.x !== tx || tr.seam.y !== ty) return false;
    if (Math.floor(player.x) === tx && Math.floor(player.y) === ty) return true;
    if (!(player.dashTimer > 0)) return false;
    const serial = player._dashSerial | 0;
    if (serial > 0 && player._seamDashLatch === serial) return true;
    if (seamOpenAt((gm && gm.floorTime) || 0, tr.phaseOffset)) {
      player._seamDashLatch = serial;
      return true;
    }
    return false;
  }

  // ─── Relay rules ────────────────────────────────────────────────────────

  /** @param {{x:number,y:number,w:number,h:number,cx:number,cy:number}} room */
  function relayLayout(room) {
    const cy = room.cy;
    return {
      consoleA: { x: room.x + 1, y: cy },
      consoleB: { x: room.x + room.w - 2, y: cy },
      peerStart: { x: room.x + 3, y: cy - 1 >= room.y ? cy - 1 : cy + 1 },
    };
  }

  /**
   * 4-way BFS path (excluding the start tile) or null.
   * @param {any[][]} map
   * @param {{x:number,y:number}} from
   * @param {{x:number,y:number}} to
   * @param {(t:any) => boolean} passable
   * @param {{x:number,y:number,w:number,h:number}} [bounds]
   * @returns {number[][]|null}
   */
  function bfsPath(map, from, to, passable, bounds) {
    const H = map.length, W = H ? (map[0] || []).length : 0;
    const x0 = bounds ? bounds.x : 0, y0 = bounds ? bounds.y : 0;
    const x1 = bounds ? bounds.x + bounds.w : W, y1 = bounds ? bounds.y + bounds.h : H;
    const key = (/** @type {number} */ x, /** @type {number} */ y) => y * W + x;
    const prev = new Map();
    const start = key(from.x, from.y);
    prev.set(start, -1);
    /** @type {[number, number][]} */
    const queue = [[from.x, from.y]];
    /** @type {[number, number][]} */
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let qi = 0; qi < queue.length; qi++) {
      const [x, y] = /** @type {[number, number]} */ (queue[qi]);
      if (x === to.x && y === to.y) {
        const path = [];
        let k = key(x, y);
        while (k !== start) { path.push([k % W, (k / W) | 0]); k = prev.get(k); }
        return path.reverse();
      }
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue;
        const k = key(nx, ny);
        if (prev.has(k)) continue;
        const row = map[ny];
        if (!(nx === to.x && ny === to.y) && (!row || !passable(row[nx]))) continue;
        prev.set(k, key(x, y));
        queue.push([nx, ny]);
      }
    }
    return null;
  }

  // ─── Generation ─────────────────────────────────────────────────────────

  /**
   * Footprint tiles that must be plain floor before a trial can be stamped.
   * @param {string} kind
   * @param {any} room
   * @returns {{x:number,y:number}[]}
   */
  function trialFootprint(kind, room) {
    if (kind === 'lattice') {
      /** @type {{x:number,y:number}[]} */
      const out = [];
      for (let y = room.cy - 2; y <= room.cy + 2; y++) for (let x = room.cx - 2; x <= room.cx + 2; x++) out.push({ x, y });
      return out;
    }
    if (kind === 'seam') {
      const l = seamLayout(room);
      /** @type {{x:number,y:number}[]} */
      const out = [];
      for (let y = l.vault.y - 1; y <= l.vault.y + 1; y++) for (let x = l.vault.x - 1; x <= l.vault.x + 1; x++) out.push({ x, y });
      return out.concat(l.approach);
    }
    if (kind === 'relay') {
      const l = relayLayout(room);
      /** @type {{x:number,y:number}[]} */
      const out = [l.peerStart];
      for (let x = l.consoleA.x; x <= l.consoleB.x; x++) out.push({ x, y: room.cy });
      return out;
    }
    return [];
  }

  /**
   * @param {string} kind
   * @param {any} room
   * @param {any[][]} map
   * @param {any} T
   * @param {Set<string>} [occupied] "x,y" keys holding required pickups
   */
  function roomFitsTrial(kind, room, map, T, occupied) {
    const need = TRIAL_MIN_SIZE[kind];
    if (!need || !room || room.w < need.w || room.h < need.h) return false;
    for (const p of trialFootprint(kind, room)) {
      // Keep a one-tile margin inside the room rect so entrances stay clear.
      if (p.x < room.x + 1 || p.y < room.y + 1 || p.x > room.x + room.w - 2 || p.y > room.y + room.h - 2) return false;
      const row = map[p.y];
      if (!row || row[p.x] !== T.FLOOR) return false;
      if (occupied && occupied.has(p.x + ',' + p.y)) return false;
    }
    return true;
  }

  /**
   * Build the canonical trial state for a room.
   * @param {string} kind
   * @param {any} room
   * @param {number} floor
   * @param {() => number} rand
   */
  function createTrial(kind, room, floor, rand) {
    /** @type {any} */
    const base = { v: TRIAL_VERSION, kind, floor: floor | 0, phase: 'active', introShown: false, rewardGranted: false };
    if (kind === 'lattice') {
      const s = scrambleLattice(latticePressesForFloor(floor), rand);
      base.nodes = latticeNodes(room);
      base.lit = s.lit;
      base.solution = s.solution;
      base.pressParity = new Array(9).fill(0);
      base.presses = 0;
    } else if (kind === 'seam') {
      const l = seamLayout(room);
      base.vault = l.vault;
      base.seam = l.seam;
      base.walls = l.walls;
      base.phase = 'sealed';
      base.phaseOffset = Math.floor(rand() * 100) / 100;
      base.lootClaimed = false;
      base.lootPlaced = false;
    } else if (kind === 'relay') {
      const l = relayLayout(room);
      base.consoleA = l.consoleA;
      base.consoleB = l.consoleB;
      base.peer = { x: l.peerStart.x + 0.5, y: l.peerStart.y + 0.5 };
      base.phase = 'waiting';
      base.holdTimer = 0;
      base.resyncTimer = 0;
      base.stuckTimer = 0;
    }
    return base;
  }

  /**
   * Derive map tiles from canonical trial state. Idempotent.
   * @param {any} room
   * @param {any[][]} map
   * @param {any} T
   */
  function stampTrial(room, map, T) {
    const tr = room && room.trial;
    if (!tr || tr.v !== TRIAL_VERSION) return false;
    /** @param {{x:number,y:number}} p @param {any} tile */
    const put = (p, tile) => { const row = map[p.y]; if (row) row[p.x] = tile; };
    if (tr.kind === 'lattice') {
      for (let i = 0; i < 9; i++) put(tr.nodes[i], tr.lit[i] ? T.LOGIC_NODE_LIT : T.LOGIC_NODE);
    } else if (tr.kind === 'seam') {
      for (const w of tr.walls) put(w, T.WALL);
      put(tr.vault, T.FLOOR);
      put(tr.seam, tr.lootClaimed ? T.FLOOR : T.SEAM_WALL);
    } else if (tr.kind === 'relay') {
      put(tr.consoleA, T.SYNC_CONSOLE);
      put(tr.consoleB, T.SYNC_CONSOLE);
    }
    return true;
  }

  // ─── Runtime ────────────────────────────────────────────────────────────

  /**
   * After populateFloor on a FRESH floor: clear anything that spawned inside
   * the sealed vault and place the vault loot exactly once.
   * @param {any} gm
   * @param {any} deps
   */
  function afterPopulate(gm, deps) {
    const rooms = gm && gm.dungeon && gm.dungeon.rooms;
    if (!rooms) return;
    for (const room of rooms) {
      const tr = room && room.trial;
      if (!tr || tr.v !== TRIAL_VERSION || tr.kind !== 'seam') continue;
      const vx = tr.vault.x, vy = tr.vault.y;
      const inVault = (/** @type {any} */ o) => o && Math.floor(o.x) === vx && Math.floor(o.y) === vy;
      if (deps.enemies) for (let i = deps.enemies.length - 1; i >= 0; i--) if (inVault(deps.enemies[i])) deps.enemies.splice(i, 1);
      if (deps.items) for (let i = deps.items.length - 1; i >= 0; i--) if (inVault(deps.items[i])) deps.items.splice(i, 1);
      if (!tr.lootPlaced) {
        tr.lootPlaced = true;
        if (deps.spawnVaultLoot) deps.spawnVaultLoot(vx + 0.5, vy + 0.5, tr.floor);
      }
    }
  }

  /** @param {any} room @param {any} p */
  function playerInRoom(room, p) {
    return p.x >= room.x && p.x < room.x + room.w && p.y >= room.y && p.y < room.y + room.h;
  }


  /**
   * Per-frame trial logic. Returns true when it consumed the Interact press.
   * @param {any} gm
   * @param {number} dt
   * @param {boolean} interactPressed
   * @param {any} deps
   */
  function updateTrials(gm, dt, interactPressed, deps) {
    const d = gm && gm.dungeon;
    const p = gm && gm.player;
    if (!d || !d.rooms || !p) return false;
    let consumed = false;
    for (const room of d.rooms) {
      const tr = room && room.trial;
      if (!tr || tr.v !== TRIAL_VERSION) continue;
      const inside = playerInRoom(room, p);
      if (inside && !tr.introShown) {
        tr.introShown = true;
        const kind = /** @type {'lattice'|'seam'|'relay'} */ (tr.kind);
        for (const line of (TRIAL_INTRO[kind] || [])) deps.msg(line, TRIAL_COLOURS[kind] || '#66ffcc');
      }
      if (tr.kind === 'lattice') consumed = updateLattice(gm, room, tr, interactPressed && !consumed, deps) || consumed;
      else if (tr.kind === 'seam') updateSeam(gm, room, tr, deps);
      else if (tr.kind === 'relay') consumed = updateRelay(gm, room, tr, dt, interactPressed && !consumed, deps) || consumed;
    }
    return consumed;
  }

  /** @param {any} gm @param {any} room @param {any} tr @param {boolean} interact @param {any} deps */
  function updateLattice(gm, room, tr, interact, deps) {
    const p = gm.player;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    let idx = -1;
    for (let i = 0; i < 9; i++) if (tr.nodes[i].x === tx && tr.nodes[i].y === ty) { idx = i; break; }
    if (idx < 0) return false;
    if (tr.rewardGranted) {
      deps.hint('PROOF ACCEPTED · lattice stable', '#39ff14');
      return false;
    }
    deps.hint(deps.interactLabel() + ': invert node + neighbours · ' + latticeLitCount(tr.lit) + '/9', '#39ff14');
    if (!interact) return false;
    latticePress(tr.lit, idx);
    tr.pressParity[idx] = tr.pressParity[idx] ? 0 : 1;
    tr.presses = (tr.presses | 0) + 1;
    for (const j of latticeNeighbours(idx)) {
      const n = tr.nodes[j];
      deps.setTile(n.x, n.y, tr.lit[j] ? 'LOGIC_NODE_LIT' : 'LOGIC_NODE');
    }
    deps.sound('press');
    if (latticeSolved(tr.lit)) {
      tr.rewardGranted = true;
      tr.phase = 'solved';
      deps.rewardLattice(tr.floor, room);
    } else if (tr.presses === LATTICE_HINT_AFTER_PRESSES) {
      deps.msg('EVALUATOR LEAK: one proof node marked', '#39ff14');
    }
    return true;
  }

  /** @param {any} gm @param {any} room @param {any} tr @param {any} deps */
  function updateSeam(gm, room, tr, deps) {
    const p = gm.player;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (!tr.lootClaimed && tx === tr.vault.x && ty === tr.vault.y) {
      tr.lootClaimed = true;
      tr.rewardGranted = true;
      tr.phase = 'breached';
      deps.setTile(tr.seam.x, tr.seam.y, 'FLOOR');
      deps.rewardSeam(tr.floor, room);
      return;
    }
    if (tr.lootClaimed) return;
    const adx = Math.abs(tx - tr.seam.x), ady = Math.abs(ty - tr.seam.y);
    if (adx + ady <= 2 && playerInRoom(room, p)) {
      const open = seamOpenAt(gm.floorTime || 0, tr.phaseOffset);
      deps.hint(open ? 'SEAM DESYNC: dash into it now' : 'Vault sealed · watch the flicker', '#ff3cac');
    }
  }

  /** @param {any} gm @param {any} room @param {any} tr @param {number} dt @param {boolean} interact @param {any} deps */
  function updateRelay(gm, room, tr, dt, interact, deps) {
    const p = gm.player;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    const peerDist = Math.hypot(tr.peer.x - p.x, tr.peer.y - p.y);
    const onConsoleA = tx === tr.consoleA.x && ty === tr.consoleA.y;
    const nearConsoleA = Math.abs(tx - tr.consoleA.x) + Math.abs(ty - tr.consoleA.y) <= 1;

    if (tr.phase === 'waiting') {
      if (peerDist <= PEER_TALK_RADIUS) {
        deps.hint(deps.interactLabel() + ': open channel with ' + PEER_NAME, '#66ffcc');
        if (interact) { deps.openRelayChoice(room); return true; }
      } else if ((onConsoleA || nearConsoleA) && interact) {
        deps.msg(PEER_LINES.early, '#66ffcc');
        return true;
      }
      return false;
    }

    if (tr.phase === 'moving') {
      const escorted = peerDist <= PEER_ESCORT_RADIUS;
      if (!escorted) deps.hint(PEER_LINES.wait, '#66ffcc');
      if (escorted) stepPeer(tr, dt, deps);
      if ((onConsoleA || nearConsoleA) && interact) { deps.msg(PEER_LINES.enroute, '#66ffcc'); return true; }
      return false;
    }

    if (tr.phase === 'holding') {
      tr.holdTimer = Math.max(0, (tr.holdTimer || 0) - dt);
      if (tr.holdTimer <= 0) {
        tr.phase = 'resync';
        tr.resyncTimer = RELAY_RESYNC_DELAY;
        deps.msg(PEER_LINES.missed, '#66ffcc');
        return false;
      }
      if (onConsoleA || nearConsoleA) {
        deps.hint(deps.interactLabel() + ': trigger console A · ' + Math.ceil(tr.holdTimer) + 's', '#66ffcc');
        if (interact) {
          tr.phase = 'complete';
          tr.rewardGranted = true;
          deps.msg(PEER_LINES.done, '#66ffcc');
          deps.msg(PEER_LINES.doneAfter, '#66ffcc');
          deps.rewardRelay(tr.floor, room, tr.consoleA);
          return true;
        }
      } else {
        deps.hint('B held · run to console A · ' + Math.ceil(tr.holdTimer) + 's', '#66ffcc');
      }
      return false;
    }

    if (tr.phase === 'resync') {
      tr.resyncTimer = Math.max(0, (tr.resyncTimer || 0) - dt);
      if (tr.resyncTimer <= 0) {
        tr.phase = 'holding';
        tr.holdTimer = RELAY_SYNC_WINDOW;
        deps.msg(PEER_LINES.holding, '#66ffcc');
      } else if ((onConsoleA || nearConsoleA) && interact) {
        deps.msg(PEER_LINES.missed, '#66ffcc');
        return true;
      }
      return false;
    }
    return false;
  }

  /**
   * Advance the escorted peer toward console B. The path is transient (not
   * canonical) and recomputed when missing, e.g. after a save/resume.
   * @param {any} tr
   * @param {number} dt
   * @param {any} deps
   */
  function stepPeer(tr, dt, deps) {
    if (!Array.isArray(tr._path) || !tr._path.length) {
      const from = { x: Math.floor(tr.peer.x), y: Math.floor(tr.peer.y) };
      tr._path = deps.findPath(from, tr.consoleB) || [[tr.consoleB.x, tr.consoleB.y]];
    }
    const next = tr._path[0];
    const gx = next[0] + 0.5, gy = next[1] + 0.5;
    const dx = gx - tr.peer.x, dy = gy - tr.peer.y;
    const d = Math.hypot(dx, dy);
    const step = PEER_SPEED * dt;
    if (d <= step || d < 1e-6) {
      tr.peer.x = gx; tr.peer.y = gy;
      tr._path.shift();
      tr.stuckTimer = 0;
    } else {
      tr.peer.x += dx / d * step;
      tr.peer.y += dy / d * step;
      tr.stuckTimer = (tr.stuckTimer || 0) + dt;
      if (tr.stuckTimer > PEER_STUCK_SECONDS) { tr.peer.x = gx; tr.peer.y = gy; tr._path.shift(); tr.stuckTimer = 0; }
    }
    if (Math.floor(tr.peer.x) === tr.consoleB.x && Math.floor(tr.peer.y) === tr.consoleB.y && !tr._path.length) {
      tr.phase = 'holding';
      tr.holdTimer = RELAY_SYNC_WINDOW;
      tr._path = null;
      deps.msg(PEER_LINES.holding, '#66ffcc');
    }
  }

  /**
   * Resolve the LINK / ISOLATE card for a relay trial.
   * @param {any} room
   * @param {'a'|'b'} choice
   * @param {any} deps
   */
  function resolveRelayChoice(room, choice, deps) {
    const tr = room && room.trial;
    if (!tr || tr.kind !== 'relay' || tr.phase !== 'waiting') return false;
    if (choice === 'a') {
      tr.phase = 'moving';
      tr._path = null;
      deps.msg(PEER_LINES.link, '#66ffcc');
    } else {
      tr.phase = 'isolated';
      tr.rewardGranted = true;
      deps.msg(PEER_LINES.isolated, '#66ffcc');
      deps.isolatePeer(room);
    }
    return true;
  }

  // ─── Drawing ────────────────────────────────────────────────────────────

  /**
   * Base glyph for the walkable trial tiles (drawn inside the world tile loop).
   * @param {any} ctx @param {any} tile @param {number} sx @param {number} sy @param {number} size
   * @param {number} brightness @param {number} nowMs @param {any} T @param {string} floorFill
   */
  function drawTrialTile(ctx, tile, sx, sy, size, brightness, nowMs, T, floorFill) {
    ctx.fillStyle = floorFill;
    ctx.fillRect(sx, sy, size, size);
    const cx = sx + size / 2, cy = sy + size / 2;
    if (tile === T.LOGIC_NODE || tile === T.LOGIC_NODE_LIT) {
      const lit = tile === T.LOGIC_NODE_LIT;
      ctx.globalAlpha = brightness;
      ctx.shadowBlur = lit ? 14 : 0;
      ctx.shadowColor = '#39ff14';
      ctx.strokeStyle = lit ? '#39ff14' : '#2f6b3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      if (lit) {
        ctx.fillStyle = '#39ff14';
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    } else if (tile === T.SYNC_CONSOLE) {
      const pulse = 0.55 + 0.45 * Math.sin(nowMs / 420 + sx * 0.01);
      ctx.globalAlpha = brightness;
      ctx.strokeStyle = '#66ffcc';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 4, sy + 4, size - 8, size - 8);
      ctx.globalAlpha = brightness * pulse;
      ctx.fillStyle = '#66ffcc';
      ctx.fillRect(sx + size * 0.3, sy + size * 0.3, size * 0.4, size * 0.4);
    }
  }

  /**
   * Per-frame overlays: lattice hint ring, seam flicker, console hold state,
   * and the peer instance. Only draws inside visible tiles.
   * @param {any} ctx @param {any} gm @param {number} camX @param {number} camY @param {number} size @param {number} nowMs
   */
  function drawTrialOverlays(ctx, gm, camX, camY, size, nowMs) {
    const d = gm && gm.dungeon;
    if (!d || !d.rooms) return;
    const vis = d.visible;
    const seen = (/** @type {number} */ x, /** @type {number} */ y) => !!(vis && vis[y] && vis[y][x]);
    for (const room of d.rooms) {
      const tr = room && room.trial;
      if (!tr || tr.v !== TRIAL_VERSION) continue;
      if (tr.kind === 'lattice' && !tr.rewardGranted && (tr.presses | 0) >= LATTICE_HINT_AFTER_PRESSES) {
        const rem = latticeRemainingSolution(tr);
        const n = rem.length ? tr.nodes[/** @type {number} */ (rem[0])] : null;
        if (n && seen(n.x, n.y)) {
          const pulse = 0.5 + 0.5 * Math.sin(nowMs / 220);
          ctx.save();
          ctx.globalAlpha = 0.35 + 0.5 * pulse;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(n.x * size + size / 2 - camX, n.y * size + size / 2 - camY, size * 0.46, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      } else if (tr.kind === 'seam' && !tr.lootClaimed && seen(tr.seam.x, tr.seam.y)) {
        const open = seamOpenAt(gm.floorTime || 0, tr.phaseOffset);
        const sx = tr.seam.x * size - camX, sy = tr.seam.y * size - camY;
        ctx.save();
        if (open) {
          const jitter = Math.sin(nowMs / 30) * 2;
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = '#ff3cac';
          ctx.fillRect(sx + jitter, sy, size, size * 0.18);
          ctx.fillStyle = '#00f5ff';
          ctx.fillRect(sx - jitter, sy + size * 0.55, size, size * 0.18);
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#0a0a12';
          ctx.fillRect(sx + 3, sy + 3, size - 6, size - 6);
        } else {
          // Idle tell: a faint split scanline so the seam is discoverable
          // before the window opens, without looking like a door.
          ctx.globalAlpha = 0.4 + 0.2 * Math.sin(nowMs / 90);
          ctx.fillStyle = '#ff3cac';
          ctx.fillRect(sx + size * 0.44, sy + 2, 2, size - 4);
          ctx.fillStyle = '#00f5ff';
          ctx.fillRect(sx + size * 0.52, sy + 2, 1, size - 4);
        }
        ctx.restore();
      } else if (tr.kind === 'relay') {
        if (tr.phase === 'holding' && seen(tr.consoleB.x, tr.consoleB.y)) {
          const bx = tr.consoleB.x * size + size / 2 - camX, by = tr.consoleB.y * size + size / 2 - camY;
          const frac = Math.max(0, Math.min(1, (tr.holdTimer || 0) / RELAY_SYNC_WINDOW));
          ctx.save();
          ctx.strokeStyle = '#66ffcc';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(bx, by, size * 0.55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
          ctx.stroke();
          ctx.restore();
        }
        if (tr.phase === 'isolated') continue;
        const px = Math.floor(tr.peer.x), py = Math.floor(tr.peer.y);
        if (!seen(px, py)) continue;
        const sx = tr.peer.x * size - camX, sy = tr.peer.y * size - camY;
        const bob = Math.sin(nowMs / 300) * 2;
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#7dffb2';
        ctx.fillStyle = '#7dffb2';
        ctx.beginPath();
        ctx.arc(sx, sy + bob, size * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#e8fff2';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy + bob, size * 0.36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#e8fff2';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(PEER_NAME, sx, sy - size * 0.5 + bob);
        ctx.restore();
      }
    }
  }

  return {
    TRIAL_VERSION,
    TRIAL_BY_FLOOR,
    TRIAL_KINDS,
    TRIAL_MIN_SIZE,
    TRIAL_LABELS,
    TRIAL_COLOURS,
    RECURRING_FROM_FLOOR,
    RECURRING_CHANCE,
    RESERVED_STORY_FLOORS,
    SEAM_PERIOD,
    SEAM_OPEN,
    PEER_NAME,
    PEER_ESCORT_RADIUS,
    RELAY_SYNC_WINDOW,
    RELAY_RESYNC_DELAY,
    LATTICE_HINT_AFTER_PRESSES,
    RELAY_EVENT,
    PEER_LINES,
    TRIAL_INTRO,
    trialKindForFloor,
    latticeNodes,
    latticeNeighbours,
    latticePress,
    latticeLitCount,
    latticeSolved,
    latticePressesForFloor,
    scrambleLattice,
    latticeRemainingSolution,
    seamLayout,
    seamOpenAt,
    findSeamTrial,
    playerMayEnterSeam,
    relayLayout,
    bfsPath,
    trialFootprint,
    roomFitsTrial,
    createTrial,
    stampTrial,
    afterPopulate,
    updateTrials,
    resolveRelayChoice,
    drawTrialTile,
    drawTrialOverlays,
  };
}));
