// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { statementStart } = require('./_source-files.js');

const ROOT = path.resolve(__dirname, '..');
const ENTITIES = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');

function loadEnemyClass() {
  const player = { x: 8, y: 5 };
  const sandbox = /** @type {any} */ ({
    player,
    _EG: { dungeon: { visible: Array.from({ length: 20 }, () => new Uint8Array(20).fill(1)) }, floorTime: 0 },
    TILE: 32,
    W: 800,
    H: 600,
    TWO_PI: Math.PI * 2,
    Math,
    Date: { now: () => 0 },
    rand: () => 0,
    isEnemyShieldGenProtected: () => false,
    NEON: {
      draw: {
        /** @param {any} ctx @param {number} x @param {number} y @param {number} r */
        circle(ctx, x, y, r) { ctx.calls.push({ op: 'circle', x, y, r }); },
        circleStroke() {},
        /** @param {any} ctx @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 */
        line(ctx, x1, y1, x2, y2) { ctx.calls.push({ op: 'line', x1, y1, x2, y2 }); },
        arcStroke() {},
      },
      boosts: {},
    },
    ctx: createCtx(),
  });
  const end = ENTITIES.indexOf('class Player');
  assert.ok(end > 0, 'Enemy class should precede Player class');
  vm.createContext(sandbox);
  vm.runInContext(`${ENTITIES.slice(0, end)}\nthis.Enemy = Enemy;`, sandbox);
  return sandbox;
}

function createCtx() {
  /** @type {any[]} */
  const calls = [];
  return {
    calls,
    fillStyle: '#ffb700',
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: '#000',
    lineWidth: 1,
    save() { this.calls.push({ op: 'save' }); },
    restore() { this.calls.push({ op: 'restore' }); },
    /** @param {number} x @param {number} y */
    translate(x, y) { this.calls.push({ op: 'translate', x, y }); },
    /** @param {number} angle */
    rotate(angle) { this.calls.push({ op: 'rotate', angle }); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    /** @param {number} x @param {number} y @param {number} w @param {number} h */
    fillRect(x, y, w, h) { this.calls.push({ op: 'fillRect', x, y, w, h }); },
  };
}

/**
 * @param {{x:number,y:number}} playerPos
 */
function drawTurret(playerPos) {
  const sandbox = loadEnemyClass();
  Object.assign(sandbox.player, playerPos);
  sandbox._EG.player = sandbox.player;
  sandbox.ctx.calls.length = 0;
  const turret = new sandbox.Enemy(5, 5, 10, 1, 0, 1, '#ffb700', 'TURRET');
  turret.bobAngle = 0;
  turret.draw(0, 0);
  return sandbox.ctx.calls;
}

test('TURRET draw no longer uses the two-rectangle health-pickup plus pattern', () => {
  const calls = drawTurret({ x: 8, y: 5 }).filter((/** @type {any} */ c) => c.op === 'fillRect');
  const plusRects = calls.filter((/** @type {any} */ c) =>
    (Math.abs(c.w - 4.48) < 0.001 && Math.abs(c.h - 12.16) < 0.001) ||
    (Math.abs(c.w - 12.16) < 0.001 && Math.abs(c.h - 4.48) < 0.001)
  );
  assert.equal(plusRects.length, 0, JSON.stringify(calls));
});

test('TURRET barrel points east toward an eastern player', () => {
  const calls = drawTurret({ x: 8, y: 5 });
  const angle = calls.find((/** @type {any} */ c) => c.op === 'rotate')?.angle;
  assert.equal(angle, 0);
  const barrel = calls.filter((/** @type {any} */ c) => c.op === 'fillRect').find((/** @type {any} */ c) => c.x === 0);
  assert.ok(barrel, 'barrel rect should be drawn from translated origin');
  assert.ok(barrel.w > barrel.h, 'barrel should be a long horizontal rect before rotation');
});

test('TURRET barrel points south toward a southern player', () => {
  const calls = drawTurret({ x: 5, y: 8 });
  const angle = calls.find((/** @type {any} */ c) => c.op === 'rotate')?.angle;
  assert.ok(Math.abs(angle - Math.PI / 2) < 1e-12, `expected south-facing barrel, got ${angle}`);
});

// ─── Exploit-trial seam collision (src/entities.js playerTilePassable) ───

/** @param {string} name */
function extractFunction(name) {
  const start = ENTITIES.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  let depth = 0;
  for (let i = ENTITIES.indexOf('{', start); i < ENTITIES.length; i++) {
    if (ENTITIES[i] === '{') depth++;
    else if (ENTITIES[i] === '}' && --depth === 0) return ENTITIES.slice(start, i + 1);
  }
  assert.fail(name + ' unbalanced');
}

const TILES = { WALL: 1, FLOOR: 2, SEAM_WALL: 30 };

/** @param {any} neon */
function loadPlayerTilePassable(neon) {
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  return new Function('T', 'isPassable', 'NEON', '_EG',
    extractFunction('playerTilePassable') + '\nreturn playerTilePassable;'
  )(TILES, (/** @type {number} */ t) => t === TILES.FLOOR, neon, { tag: 'game' });
}

test('playerTilePassable matches isPassable for ordinary tiles', () => {
  const fn = loadPlayerTilePassable({ trials: { playerMayEnterSeam() { return true; } } });
  assert.equal(fn({}, TILES.FLOOR, 1, 1), true);
  assert.equal(fn({}, TILES.WALL, 1, 1), false, 'a wall never becomes passable');
});

test('playerTilePassable delegates only the seam tile to NEON.trials with the live game', () => {
  /** @type {any[]} */
  const calls = [];
  const fn = loadPlayerTilePassable({ trials: { playerMayEnterSeam(/** @type {any[]} */ ...args) { calls.push(args); return args[2] === 7; } } });
  const player = { x: 7.5, y: 3.5 };
  assert.equal(fn(player, TILES.SEAM_WALL, 7, 3), true);
  assert.equal(fn(player, TILES.SEAM_WALL, 8, 3), false);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], [{ tag: 'game' }, player, 7, 3, undefined], 'the dash flag is forwarded (undefined for plain checks)');
  const noTrials = loadPlayerTilePassable(undefined);
  assert.equal(noTrials(player, TILES.SEAM_WALL, 7, 3), false, 'without the trials module the seam is a wall');
});

test('movement call sites pass the right tile, coordinates and dash flag', () => {
  // Exact argument order at every call site (a swapped tx/ox or dash flag fails).
  assert.match(ENTITIES, /noClip \|\| playerTilePassable\(this, map\[ty\]\[tx\], tx, ty, true\)\)\) this\.x=nx;\s*\n\s*else this\.dashTimer=0;/, 'dash x step');
  assert.match(ENTITIES, /noClip \|\| playerTilePassable\(this, map\[oy\]\[ox\], ox, oy, true\)\)\) this\.y=ny;\s*\n\s*else this\.dashTimer=0;/, 'dash y step');
  assert.match(ENTITIES, /noClip \|\| playerTilePassable\(this, map\[ty\]\[tx\], tx, ty, false\)\)\) this\.x=nx;\s*\n\s*if \(ox>=0/, 'walk x step');
  assert.match(ENTITIES, /noClip \|\| playerTilePassable\(this, map\[oy\]\[ox\], ox, oy, false\)\)\) this\.y=ny;/, 'walk y step');
  assert.match(ENTITIES, /if \(!noClip\) resolvePlayerCornerCut\(this, map, dashPrevX, dashPrevY, true\);/);
  assert.match(ENTITIES, /if \(!noClip\) resolvePlayerCornerCut\(this, map, walkPrevX, walkPrevY, false\);/);
  assert.match(ENTITIES, /if \(!playerCheatEnabled\('noClip'\)\) resolvePlayerCornerCut\(this, map, pullPrevX, pullPrevY, false\);/, 'gravity pull resolves corner cuts too');
  const depen = statementStart(ENTITIES, {
    className: 'Player',
    method: 'update',
    includes: "if (!playerCheatEnabled('noClip')) depenetratePlayer(this, map);",
  });
  const dash = statementStart(ENTITIES, {
    className: 'Player',
    method: 'update',
    includes: 'if (this.dashTimer>0)',
  });
  assert.ok(depen > 0 && depen < dash, 'depenetration runs before the dash/walk movement');
  assert.doesNotMatch(ENTITIES, /function playerStepPassable\(/, 'no same-tile shortcut helper remains');
  assert.match(ENTITIES, /this\.dashTimer=0\.12;\s*\n\s*this\._dashSerial = \(this\._dashSerial \| 0\) \+ 1;/);
});

// ─── Behaviour: movement helpers run against real maps ────────────────────

const trialsModule = require('../src/content/trials.js');

/**
 * Load the real movement helpers (playerTilePassable, resolvePlayerCornerCut,
 * depenetratePlayer) against the real trials module.
 * @param {any} [eg] extra game fields (e.g. bossSealed/bossRoom)
 */
function loadMovement(eg) {
  const T = { WALL: 1, FLOOR: 2, SEAM_WALL: 30 };
  const room = { x: 10, y: 10, w: 9, h: 7, cx: 14, cy: 13 };
  const trial = trialsModule.createTrial('seam', room, 4, () => 0.5);
  trial.phaseOffset = 0;
  /** @type {any} */ (room).trial = trial;
  /** @type {any} */
  const map = Array.from({ length: 30 }, () => new Array(30).fill(T.FLOOR));
  for (const w of trial.walls) map[w.y][w.x] = T.WALL;
  map[trial.seam.y][trial.seam.x] = T.SEAM_WALL;
  const gm = { dungeon: { rooms: [room], map }, floorTime: 0, ...(eg || {}) };
  /** @type {Record<string, boolean>} */
  const cheats = { noClip: false };
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  const api = new Function('T', 'isPassable', 'NEON', '_EG', 'playerCheatEnabled',
    [extractFunction('playerTilePassable'), extractFunction('resolvePlayerCornerCut'), extractFunction('depenetratePlayer'),
      extractFunction('markPlayerStood'), extractFunction('findPlayerUnembedTile'),
      extractFunction('playerSafeRecordUsable'), extractFunction('playerSavePosition'),
      'return { playerTilePassable, resolvePlayerCornerCut, depenetratePlayer, playerSavePosition, findPlayerUnembedTile };'].join('\n')
  )(T, (/** @type {number} */ t) => t === T.FLOOR, { trials: trialsModule }, gm, (/** @type {string} */ id) => !!cheats[id]);
  /** One movement step mirroring Player.update's dash/walk blocks. @param {any} p @param {number} nx @param {number} ny @param {boolean} dashing */
  const step = (p, nx, ny, dashing) => {
    const tx = Math.floor(nx), ty = Math.floor(p.y), ox = Math.floor(p.x), oy = Math.floor(ny);
    const px = p.x, py = p.y;
    if (api.playerTilePassable(p, map[ty][tx], tx, ty, dashing)) p.x = nx;
    if (api.playerTilePassable(p, map[oy][ox], ox, oy, dashing)) p.y = ny;
    api.resolvePlayerCornerCut(p, map, px, py, dashing);
  };
  return { T, map, trial, gm, step, api, cheats };
}

test('a diagonal dash past the open seam can no longer embed the agent in the vault corner', () => {
  const { T, map, trial, step } = loadMovement();
  const p = { x: trial.seam.x + 1.1, y: trial.seam.y + 0.1, dashTimer: 0.1, _dashSerial: 1 };
  const d = 18 / 60 * Math.SQRT1_2; // one 60fps north-west dash step per axis
  step(p, p.x - d, p.y - d, true);
  const tile = map[Math.floor(p.y)][Math.floor(p.x)];
  assert.notEqual(tile, T.WALL, `agent ended inside a wall at ${p.x.toFixed(3)},${p.y.toFixed(3)}`);
});

test('an agent inside a wall cannot walk through it to the far side (reviewers\' sealed-entrance repro)', () => {
  const { T, map, step } = loadMovement();
  // A sealed west entrance: arena floor to the east, corridor floor to the west.
  map[17][10] = T.WALL;
  const p = { x: 10.5, y: 17.5, dashTimer: 0, _dashSerial: 1 };
  for (let i = 0; i < 60; i++) step(p, p.x - 3.5 / 60, p.y, false); // hold west for 1 s
  assert.ok(p.x >= 10, `agent walked out of the wall into the corridor (x=${p.x.toFixed(2)})`);
  for (let i = 0; i < 60; i++) step(p, p.x, p.y - 3.5 / 60, false); // hold north for 1 s
  assert.equal(Math.floor(p.y), 17, 'no axis lets an embedded agent pass through the wall');
});

test('depenetratePlayer restores the last safe position of the same map after an embed', () => {
  const { T, map, api } = loadMovement();
  map[17][10] = T.WALL;
  /** @type {any} */
  const p = { x: 11.4, y: 17.5, dashTimer: 0 };
  assert.equal(api.depenetratePlayer(p, map), false, 'a passable tile only records the safe position');
  assert.equal(p._safeX, 11.4);
  p.x = 10.5; // knockback + clamp left the centre inside the sealed entrance
  assert.equal(api.depenetratePlayer(p, map), true);
  assert.deepEqual([p.x, p.y], [11.4, 17.5], 'restored to the recorded safe position inside the arena');
  const other = map.map((/** @type {any[]} */ r) => r.slice());
  p.x = 10.5;
  p._safeX = 3.5; p._safeY = 17.5; p._safeMap = other;
  api.depenetratePlayer(p, map);
  assert.notDeepEqual([p.x, p.y], [3.5, 17.5], 'a record from another map (previous floor) is ignored');
});

test('depenetratePlayer without a record prefers the sealed arena over the corridor', () => {
  const arena = { x: 10, y: 12, w: 10, h: 10 };
  const { T, map, api } = loadMovement({ bossSealed: true, bossRoom: arena });
  map[17][10] = T.WALL; // sealed entrance on the arena's west edge ring
  /** @type {any} */
  const p = { x: 9.5, y: 17.5, dashTimer: 0 };
  assert.equal(api.depenetratePlayer(p, map), false, 'stood on the corridor tile west of the entrance');
  p._safeMap = null; // no usable record (e.g. right after a resume)
  p.x = 10.5; // embedded in the sealed entrance
  assert.equal(api.depenetratePlayer(p, map), true);
  assert.ok(p.x >= arena.x && p.x < arena.x + arena.w && p.y >= arena.y && p.y < arena.y + arena.h,
    `the arena outranks the stood-on corridor tile, got ${p.x},${p.y}`);
  assert.equal(map[Math.floor(p.y)][Math.floor(p.x)], T.FLOOR);
});

test('depenetration fallback never snaps into the sealed vault, an unseen pocket or a secret room', () => {
  // Reviewer's vault case: embedded in the vault's south wall with no record.
  {
    const { T, map, trial, api } = loadMovement();
    const wall = { x: trial.vault.x, y: trial.vault.y + 1 };
    assert.equal(map[wall.y][wall.x], T.WALL, 'south ring wall of the vault');
    const p = { x: wall.x + 0.5, y: wall.y + 0.5, dashTimer: 0 };
    assert.equal(api.depenetratePlayer(p, map), true);
    assert.notDeepEqual([Math.floor(p.x), Math.floor(p.y)], [trial.vault.x, trial.vault.y], 'not into the sealed vault');
    assert.equal(map[Math.floor(p.y)][Math.floor(p.x)], T.FLOOR);
  }
  // Gated pocket north of a wall; only the agent's side (south) has been seen.
  {
    const { T, map, gm, api } = loadMovement();
    for (let x = 0; x < 10; x++) map[20][x] = T.WALL;
    gm.dungeon.visited = Array.from({ length: 30 }, (_, y) => new Uint8Array(30).fill(y >= 21 ? 1 : 0));
    const p = { x: 5.5, y: 20.5, dashTimer: 0 };
    api.depenetratePlayer(p, map);
    assert.equal(Math.floor(p.y), 21, 'snapped to the seen side, although the pocket tile is scanned first');
    // Unrevealed secret-room tiles are never candidates, even when seen-state ties.
    gm.dungeon.visited = null;
    gm.dungeon.secretMask = Array.from({ length: 30 }, (_, y) => new Uint8Array(30).fill(y === 19 ? 1 : 0));
    const q = { x: 5.5, y: 20.5, dashTimer: 0 };
    api.depenetratePlayer(q, map);
    assert.notEqual(Math.floor(q.y), 19, 'never into an unrevealed secret room');
  }
});

test('after a full map reveal the fallback still prefers the side the agent actually stood on', () => {
  // The lattice reward (revealFloorLayout) marks every non-secret tile seen,
  // lock-gated pockets included, so "seen" cannot tell the sides apart.
  const { T, map, gm, api } = loadMovement();
  for (let x = 0; x < 10; x++) map[20][x] = T.WALL; // pocket (north) | corridor (south)
  gm.dungeon.visited = Array.from({ length: 30 }, () => new Uint8Array(30).fill(1));
  /** @type {any} */
  const p = { x: 5.5, y: 22.5, dashTimer: 0 };
  api.depenetratePlayer(p, map); // walking along the corridor records where it stood
  p.y = 21.5; api.depenetratePlayer(p, map);
  p._safeMap = null; // no usable record
  p.x = 5.5; p.y = 20.5; // knocked into the wall
  assert.equal(api.depenetratePlayer(p, map), true);
  assert.deepEqual([p.x, p.y], [5.5, 21.5], 'back to the stood-on corridor tile, not into the pocket scanned first');
  // Stood-on tiles belong to one floor: on another floor's map they are ignored.
  const next = map.map((/** @type {any[]} */ r) => r.slice());
  assert.deepEqual(api.findPlayerUnembedTile({ ...p, x: 5.5, y: 20.5 }, next), { x: 5.5, y: 19.5 },
    'another floor: no stood record, so the nearest tile in scan order wins');
  // Standing on the next floor starts that floor's own record.
  /** @type {any} */
  const q = { ...p, x: 5.5, y: 21.5 };
  api.depenetratePlayer(q, next);
  q._safeMap = null;
  q.y = 20.5;
  assert.equal(api.depenetratePlayer(q, next), true);
  assert.deepEqual([q.x, q.y], [5.5, 21.5], "the next floor's stood-on record decides");
});

test('a safe record outside a sealed arena is never restored while the agent is embedded inside it', () => {
  const arena = { x: 10, y: 12, w: 10, h: 10 };
  const { T, map, api } = loadMovement({ bossSealed: true, bossRoom: arena });
  map[17][10] = T.WALL; // the entrance sealed on the frame a knockback embedded the agent in it
  /** @type {any} */
  const p = { x: 10.5, y: 17.5, dashTimer: 0, _safeX: 9.5, _safeY: 17.5, _safeMap: map };
  assert.equal(api.depenetratePlayer(p, map), true);
  assert.ok(p.x >= arena.x && p.x < arena.x + arena.w, `stayed inside the sealed arena, got x=${p.x}`);
  /** @type {any} */
  const q = { x: 10.5, y: 17.5, dashTimer: 0, _safeX: 11.4, _safeY: 17.5, _safeMap: map };
  api.depenetratePlayer(q, map);
  assert.deepEqual([q.x, q.y], [11.4, 17.5], 'a record inside the arena is still restored exactly');
  // The arena's edge ring is walkable floor (clampToBossRoom allows it): a
  // record there, kiting along the wall, is inside the arena too.
  /** @type {any} */
  const r = { x: 10.5, y: 17.5, dashTimer: 0, _safeX: 10.5, _safeY: 16.2, _safeMap: map };
  api.depenetratePlayer(r, map);
  assert.deepEqual([r.x, r.y], [10.5, 16.2], 'an edge-ring record is restored exactly');
  assert.deepEqual(api.playerSavePosition({ ...r, x: 10.5, y: 17.5 }, map), { x: 10.5, y: 16.2 },
    'and a save on that frame persists it');
});

test('a save taken on the frame the agent is embedded stores its last safe position, not the wall', () => {
  const { T, map, api, cheats } = loadMovement();
  map[17][10] = T.WALL;
  /** @type {any} */
  const p = { x: 11.4, y: 17.5, dashTimer: 0 };
  api.depenetratePlayer(p, map);
  assert.deepEqual(api.playerSavePosition(p, map), { x: 11.4, y: 17.5 }, 'unembedded: the live position');
  p.x = 10.5; // a knockback left the centre inside the wall; the save runs before the next frame
  assert.deepEqual(api.playerSavePosition(p, map), { x: 11.4, y: 17.5 }, 'embedded: the restorable safe position');
  assert.equal(p.x, 10.5, 'saving never moves the live agent');
  cheats.noClip = true;
  assert.deepEqual(api.playerSavePosition(p, map), { x: 10.5, y: 17.5 }, 'noClip keeps the raw position');
  cheats.noClip = false;
  // No usable record: persist where the next frame's depenetration would put
  // it (here the stood-on tile east of the wall), never the wall itself.
  p._safeMap = null;
  const saved = api.playerSavePosition(p, map);
  assert.deepEqual(saved, { x: 11.5, y: 17.5 }, 'no usable record: the unembed choice, not the wall');
  assert.deepEqual(saved, api.findPlayerUnembedTile(p, map));
  assert.deepEqual([p.x, p.y], [10.5, 17.5], 'still never moves the live agent');
  // Nothing passable within reach: the raw position is all there is.
  const solid = map.map((/** @type {any[]} */ r) => r.map(() => T.WALL));
  assert.deepEqual(api.playerSavePosition({ x: 15.5, y: 15.5, dashTimer: 0 }, solid), { x: 15.5, y: 15.5 });
});

test('the seam tile the agent is dashing through is not treated as an embed', () => {
  const { trial, api, map } = loadMovement();
  const p = { x: trial.seam.x + 0.5, y: trial.seam.y + 0.5, dashTimer: 0.05, _dashSerial: 2 };
  assert.equal(api.depenetratePlayer(p, map), false);
  assert.deepEqual([p.x, p.y], [trial.seam.x + 0.5, trial.seam.y + 0.5]);
});

test('dash steps honour the seam window even after the dash timer ran out on the final frame', () => {
  const { T, map, trial, step } = loadMovement();
  const p = { x: trial.seam.x + 1.2, y: trial.seam.y + 0.5, dashTimer: -0.03, _dashSerial: 3 };
  step(p, p.x - 0.36, p.y, true);
  assert.equal(map[Math.floor(p.y)][Math.floor(p.x)], T.SEAM_WALL, 'final-frame dash still enters the open seam');
  const q = { x: trial.seam.x + 1.2, y: trial.seam.y + 0.5, dashTimer: 0, _dashSerial: 4 };
  step(q, q.x - 0.36, q.y, false);
  assert.equal(Math.floor(q.x), trial.seam.x + 1, 'walking into the seam is still blocked');
});
