// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  createGenerationFixture,
  physicalReachWithKeys,
} = require('./_generation-fixture.js');

const BOSS_FLOORS = [3, 6, 9, 12, 15];
const SAMPLE_SEEDS = Array.from({ length: 25 }, (_unused, i) => `boss-room-candidate-${i + 1}`);

test('boss floors choose a reachable expandable 15x15 arena in at least 95% of seeded samples', () => {
  const fixture = createGenerationFixture();
  const failures = [];
  let total = 0;
  for (const floor of BOSS_FLOORS) {
    for (const seed of SAMPLE_SEEDS) {
      total++;
      const dungeon = fixture.generateFloor(seed, floor);
      const bossRoom = dungeon.bossRoom;
      const reach = physicalReachWithKeys(dungeon).vis;
      const sized = bossRoom && bossRoom.w >= 15 && bossRoom.h >= 15;
      const reachable = bossRoom && reach[bossRoom.cy]?.[bossRoom.cx] === 1;
      if (!sized || !reachable) {
        failures.push({
          seed,
          floor,
          size: bossRoom ? `${bossRoom.w}x${bossRoom.h}` : 'missing',
          reachable: !!reachable,
        });
      }
    }
  }
  const successRate = (total - failures.length) / total;
  assert.ok(
    successRate >= 0.95,
    `boss room success rate ${(successRate * 100).toFixed(2)}% below 95%; failures: ${JSON.stringify(failures)}`
  );
  assert.equal(failures.some(f => !f.reachable), false, `unreachable boss room failures: ${JSON.stringify(failures)}`);
});

// ─── Evaluation trial rooms ─────────────────────────────────────────────

const fixture = require('./_generation-fixture.js');

const T = fixture.T;

/** @param {any} room @param {number} x @param {number} y */
function inside(room, x, y) {
  return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
}

test('trial rooms are reserved before hazard, lore and pad passes touch them', () => {
  const fx = fixture.createGenerationFixture();
  const forbidden = new Set([T.LORE, T.TRAP_SPIKE, T.TRAP_SLOW, T.SHOCK_TILE, T.REPULSOR, T.TOXIC, T.PLASMA, T.TELEPORT_PAD, T.EVENT_TERMINAL]);
  let checked = 0;
  for (const floor of [4, 5, 7, 10]) {
    for (let s = 0; s < 10; s++) {
      const d = fx.generateFloor('trial-reserve-' + floor + '-' + s, floor);
      const r = d.trialRoom;
      if (!r) continue;
      checked++;
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          assert.equal(forbidden.has(d.map[y][x]), false, `floor ${floor} seed ${s}: tile ${d.map[y][x]} at ${x},${y} inside a trial room`);
        }
      }
      assert.ok(d.specialRooms.includes(r), 'trial room is registered as a special room');
      assert.ok(d.rooms.includes(r));
      const tinted = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (d.map[y][x] === T.FLOOR) tinted.push(d.roomColour[y][x]);
      assert.ok(tinted.length > 0 && tinted.every((c) => c === '#081a14'), 'trial floor tiles carry the trial tint');
    }
  }
  assert.ok(checked >= 15, 'enough trial rooms were sampled: ' + checked);
});

test('no required pickup is ever placed inside a trial footprint', () => {
  const fx = fixture.createGenerationFixture();
  for (const floor of [2, 4, 5]) {
    for (let s = 0; s < 10; s++) {
      const d = fx.generateFloor('trial-pickups-' + floor + '-' + s, floor);
      const r = d.trialRoom;
      if (!r || r.trial.kind !== 'seam') continue;
      for (const k of [...d.keyItems, ...d.whisperItems]) {
        const kx = Math.floor(k.x), ky = Math.floor(k.y);
        if (!inside(r, kx, ky)) continue;
        const inVault = Math.abs(kx - r.trial.vault.x) <= 1 && Math.abs(ky - r.trial.vault.y) <= 1;
        assert.equal(inVault, false, 'a key/whisper was sealed inside the exploit vault');
      }
    }
  }
});

test('floors without a fitting trial room keep the legacy event terminal', () => {
  const fx = fixture.createGenerationFixture();
  let fallback = 0, trial = 0;
  for (let s = 0; s < 20; s++) {
    const d = fx.generateFloor('trial-fallback-' + s, 5);
    if (d.trialRoom) { trial++; assert.equal(d.eventRoom, null); continue; }
    fallback++;
    assert.ok(d.eventRoom, 'fallback floor has an event room');
    assert.equal(d.map[d.eventRoom.cy][d.eventRoom.cx], T.EVENT_TERMINAL);
  }
  assert.ok(trial > 0, 'some floor-5 samples host the cooperation trial');
  assert.equal(trial + fallback, 20);
});
