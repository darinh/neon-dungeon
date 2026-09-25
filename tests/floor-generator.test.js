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
