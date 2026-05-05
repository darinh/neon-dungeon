'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(path.join(__dirname, '..', 'src/entities.js'), 'utf8');

function sourceBetween(start, end) {
  const startIndex = ENTITIES.indexOf(start);
  assert.notEqual(startIndex, -1, `missing start marker ${start}`);
  const endIndex = ENTITIES.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing end marker ${end}`);
  return ENTITIES.slice(startIndex, endIndex);
}

test('enemy targeting uses last-seen memory instead of live player coordinates', () => {
  const update = sourceBetween('  update(dt, player, map) {', '  // Taunt-aware targeting check');

  assert.match(ENTITIES, /const ENEMY_TARGET_MEMORY_SECONDS = 3;/);
  assert.match(ENTITIES, /const ENEMY_SIGHT_RANGE = 15;/);
  assert.match(ENTITIES, /const ENEMY_ROOM_LEASH_TILES = 8;/);
  assert.match(ENTITIES, /const ENEMY_LEASH_DEFEND_RANGE = 2\.5;/);
  assert.match(update, /this\._tx = this\.patrolTarget \? this\.patrolTarget\.x : this\.x;/);
  assert.doesNotMatch(update, /this\._tx = player\.x;\s*this\._ty = player\.y;/);
  assert.match(update, /const canAcquireTarget = !targetLeashed \|\| liveTargetDist <= ENEMY_LEASH_DEFEND_RANGE;/);
  assert.match(update, /const targetVisible = liveTargetable && canAcquireTarget && liveTargetDist < ENEMY_SIGHT_RANGE &&\s+hasLOS\(this\.x, this\.y, liveTargetX, liveTargetY, map\);/);
  assert.match(update, /const targetForced = tauntActive \|\| \(this\.isBoss && canTargetPlayer\(\)\);/);
  assert.match(update, /if \(targetForced \|\| targetVisible\) \{/);
  assert.match(update, /this\._lastSeenX = liveTargetX;/);
  assert.match(update, /this\._lastSeenY = liveTargetY;/);
  assert.match(update, /this\._targetLostTimer >= ENEMY_TARGET_MEMORY_SECONDS \|\| targetLeashed/);
  assert.match(update, /this\._tx = this\._lastSeenX;/);
  assert.match(update, /const los = !!targetVisible;/);
});

test('_canTarget and room leash depend on active target knowledge', () => {
  const canTarget = sourceBetween('  _canTarget() {', '  _forgetTarget()');
  const forget = sourceBetween('  _forgetTarget() {', '  _isLeashedFromRoom()');
  const leash = sourceBetween('  _isLeashedFromRoom() {', '  moveToward(tx,ty,spd,dt,map,ignoreWalls) {');

  assert.match(canTarget, /this\._targetKnown && canTargetPlayer\(\)/);
  assert.match(forget, /this\._targetKnown = false;/);
  assert.match(forget, /if \(this\.state === 'CHASE'\) this\.state = 'PATROL';/);
  assert.match(leash, /if \(!this\.room \|\| this\.isBoss \|\| this\._summoned \|\| this\._ghIsGhost\) return false;/);
  assert.match(leash, /ENEMY_ROOM_LEASH_TILES \* ENEMY_ROOM_LEASH_TILES/);
});
