// @ts-check
'use strict';

// Floor-generator behaviour for evaluation trial rooms (see also
// tests/trials.test.js for the trial rules themselves).

const { test } = require('node:test');
const assert = require('node:assert/strict');
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
