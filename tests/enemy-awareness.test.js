'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { extractStatementRange } = require('./_source-files.js');

const ENTITIES = fs.readFileSync(path.join(__dirname, '..', 'src/entities.js'), 'utf8');
const ENEMY_AWARENESS = fs.readFileSync(path.join(__dirname, '..', 'src/entities', 'enemy-awareness.js'), 'utf8');
const ENEMY_TARGETING = fs.readFileSync(path.join(__dirname, '..', 'src/entities', 'enemy-targeting.js'), 'utf8');

function sourceBetween(start, end, source = ENTITIES) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing start marker ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing end marker ${end}`);
  return source.slice(startIndex, endIndex);
}

function targetMemoryHarness({ canTarget = true, los = true } = {}) {
  const state = { canTarget, los };
  const block = extractStatementRange(ENTITIES, {
    className: 'Enemy',
    method: 'update',
    fromIncludes: 'this._tx = this.patrolTarget ? this.patrolTarget.x : this.x',
    untilIncludes: "this.stunTimer > 0 && this.type === 'REAPER'",
  });
  const run = vm.runInNewContext(`(function targetMemoryBlock(
    dt, player, map, dist, canTargetPlayer, hasLOS,
    ENEMY_SIGHT_RANGE, ENEMY_LEASH_DEFEND_RANGE, ENEMY_TARGET_MEMORY_SECONDS
  ) {
${block}
  })`);
  const enemy = {
    x: 5,
    y: 5,
    state: 'PATROL',
    isBoss: false,
    patrolTarget: null,
    _tauntTarget: null,
    _targetKnown: false,
    _targetLostTimer: 0,
    _lastSeenX: 5,
    _lastSeenY: 5,
    _tx: 5,
    _ty: 5,
    _isLeashedFromRoom() { return false; },
    _forgetTarget() {
      this._targetKnown = false;
      this._targetLostTimer = 0;
      this._lastSeenX = this.x;
      this._lastSeenY = this.y;
      if (this.state === 'CHASE') this.state = 'PATROL';
    },
  };
  const player = { x: 10, y: 5 };
  const step = (dt = 0.016) => run.call(
    enemy,
    dt,
    player,
    null,
    (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    () => state.canTarget,
    () => state.los,
    15,
    2.5,
    3
  );
  return { enemy, player, state, step };
}

test('enemy targeting uses last-seen memory instead of live player coordinates', () => {
  const update = sourceBetween('  update(dt, player, map) {', '  meleeAttack(player) {');

  assert.match(ENEMY_AWARENESS, /const ENEMY_TARGET_MEMORY_SECONDS = 3;/);
  assert.match(ENEMY_AWARENESS, /const ENEMY_SIGHT_RANGE = 15;/);
  assert.match(ENEMY_AWARENESS, /const ENEMY_ROOM_LEASH_TILES = 8;/);
  assert.match(ENEMY_AWARENESS, /const ENEMY_LEASH_DEFEND_RANGE = 2\.5;/);
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
  const canTarget = sourceBetween('Enemy.prototype._canTarget = function _canTarget() {', 'Enemy.prototype._forgetTarget', ENEMY_TARGETING);
  const forget = sourceBetween('Enemy.prototype._forgetTarget = function _forgetTarget() {', 'Enemy.prototype._isLeashedFromRoom', ENEMY_TARGETING);
  const leash = sourceBetween('Enemy.prototype._isLeashedFromRoom = function _isLeashedFromRoom() {', '};', ENEMY_TARGETING);

  assert.match(canTarget, /this\._targetKnown && canTargetPlayer\(\)/);
  assert.match(forget, /this\._targetKnown = false;/);
  assert.match(forget, /if \(this\.state === 'CHASE'\) this\.state = 'PATROL';/);
  assert.match(leash, /if \(!this\.room \|\| this\.isBoss \|\| this\._summoned \|\| this\._ghIsGhost\) return false;/);
  assert.match(leash, /ENEMY_ROOM_LEASH_TILES \* ENEMY_ROOM_LEASH_TILES/);
});

test('target memory behavior acquires by LOS, chases last seen point, then forgets after 3 seconds', () => {
  const { enemy, player, state, step } = targetMemoryHarness({ los: true });
  enemy.state = 'CHASE';
  step();
  assert.equal(enemy._targetKnown, true);
  assert.equal(enemy._tx, 10);
  assert.equal(enemy._ty, 5);

  player.x = 14;
  state.los = false;
  step(2.9);
  assert.equal(enemy._targetKnown, true);
  assert.equal(enemy._tx, 10, 'blind enemies chase the last seen X, not the live player X');
  assert.equal(enemy._targetLostTimer, 2.9);

  step(0.11);
  assert.equal(enemy._targetKnown, false);
  assert.equal(enemy.state, 'PATROL');
  assert.equal(enemy._tx, enemy.x);
  assert.equal(enemy._ty, enemy.y);
});

test('target memory behavior leashes normal enemies but preserves close defense, bosses, and taunts', () => {
  const leashed = targetMemoryHarness({ los: true });
  leashed.enemy._isLeashedFromRoom = () => true;
  leashed.step();
  assert.equal(leashed.enemy._targetKnown, false, 'leashed normal enemy should not acquire distant target');

  leashed.player.x = 6;
  leashed.step();
  assert.equal(leashed.enemy._targetKnown, true, 'leashed normal enemy should defend itself at close range');
  assert.equal(leashed.enemy._tx, 6);

  const boss = targetMemoryHarness({ los: false });
  boss.enemy.isBoss = true;
  boss.player.x = 20;
  boss.step();
  assert.equal(boss.enemy._targetKnown, true, 'bosses keep arena targeting without LOS');
  assert.equal(boss.enemy._tx, 20);

  const taunted = targetMemoryHarness({ los: false, canTarget: false });
  taunted.enemy._tauntTarget = { x: 12, y: 7, age: 0.2, maxAge: 5 };
  taunted.step();
  assert.equal(taunted.enemy._targetKnown, true, 'taunts keep legacy forced targeting');
  assert.equal(taunted.enemy._tx, 12);
  assert.equal(taunted.enemy._ty, 7);
});
