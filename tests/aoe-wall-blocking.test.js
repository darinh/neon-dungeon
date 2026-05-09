// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { T, hasLOS } = require('./_generation-fixture.js');

const CONTENT_HACKWARE = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content', 'hackware.js'), 'utf8');
const CONTENT_PROJECTILES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content', 'projectiles.js'), 'utf8');
const ENTITIES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
const ENTITIES_COMBAT_EFFECTS = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities', 'combat-effects.js'), 'utf8');
const ENTITIES_FUSE_SHARDS = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities', 'fuse-shards.js'), 'utf8');

/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const CONTENT_HACKWARE_NC = stripComments(CONTENT_HACKWARE);
const CONTENT_PROJECTILES_NC = stripComments(CONTENT_PROJECTILES);
const ENTITIES_NC = stripComments(ENTITIES);
const ENTITIES_COMBAT_EFFECTS_NC = stripComments(ENTITIES_COMBAT_EFFECTS);
const ENTITIES_FUSE_SHARDS_NC = stripComments(ENTITIES_FUSE_SHARDS);

/**
 * @param {string} src
 * @param {RegExp} openerRe
 * @returns {string}
 */
function extractBlock(src, openerRe) {
  const i = src.search(openerRe);
  assert.notEqual(i, -1, `missing opener ${openerRe}`);
  const open = src.indexOf('{', i);
  assert.notEqual(open, -1, `missing block for ${openerRe}`);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  assert.fail(`unterminated block for ${openerRe}`);
}

test('EMP_BURST cannot collapse fields or wells through walls and doors', () => {
  const body = extractBlock(CONTENT_HACKWARE_NC, /case\s+'EMP_BURST':/);
  const fieldLoop = extractBlock(body, /for\s*\(\s*const\s+f\s+of\s+disruptionFields\s*\)/);
  const wellLoop = extractBlock(body, /for\s*\(\s*const\s+w\s+of\s+gravityWells\s*\)/);

  assert.match(fieldLoop, /dist\(player\.x,\s*player\.y,\s*f\.x,\s*f\.y\)\s*<\s*radius\s*&&\s*map\s*&&\s*hasLOS\(player\.x,\s*player\.y,\s*f\.x,\s*f\.y,\s*map\)/);
  assert.match(wellLoop, /dist\(player\.x,\s*player\.y,\s*w\.x,\s*w\.y\)\s*<\s*radius\s*&&\s*map\s*&&\s*hasLOS\(player\.x,\s*player\.y,\s*w\.x,\s*w\.y,\s*map\)/);
});

test('EMP_LINE cannot collapse fields or wells through walls and doors', () => {
  const body = extractBlock(CONTENT_HACKWARE_NC, /case\s+'EMP_LINE':/);
  const fieldLoop = extractBlock(body, /for\s*\(\s*const\s+f\s+of\s+disruptionFields\s*\)/);
  const wellLoop = extractBlock(body, /for\s*\(\s*const\s+w\s+of\s+gravityWells\s*\)/);

  assert.match(fieldLoop, /segDist2\(f\.x,\s*f\.y\)\s*<\s*WIDTH_SQ\s*&&\s*hasLOS\(player\.x,\s*player\.y,\s*f\.x,\s*f\.y,\s*map\)/);
  assert.match(wellLoop, /segDist2\(w\.x,\s*w\.y\)\s*<\s*WIDTH_SQ\s*&&\s*hasLOS\(player\.x,\s*player\.y,\s*w\.x,\s*w\.y,\s*map\)/);
});

test('enemy death AoE and NEXUS feedback use LOS gates', () => {
  const detonateBody = extractBlock(ENTITIES_COMBAT_EFFECTS_NC, /function\s+applyOnKill\s*\(/);
  assert.match(detonateBody, /dist\(e\.x,\s*e\.y,\s*enemy\.x,\s*enemy\.y\)\s*<\s*aoeR\s*&&\s*hasLOS\(enemy\.x,\s*enemy\.y,\s*e\.x,\s*e\.y,\s*_EG\.dungeon\.map\)/);
  assert.match(detonateBody, /dist\(p\.x,\s*p\.y,\s*enemy\.x,\s*enemy\.y\)\s*<\s*aoeR\s*&&\s*hasLOS\(enemy\.x,\s*enemy\.y,\s*p\.x,\s*p\.y,\s*_EG\.dungeon\.map\)/);

  const nexusIdx = ENTITIES_NC.indexOf("this.type === 'NEXUS' && this._nxLinks");
  assert.notEqual(nexusIdx, -1, 'NEXUS death feedback branch must exist');
  const nexusBranch = ENTITIES_NC.slice(nexusIdx, nexusIdx + 600);
  const nexusLoop = extractBlock(nexusBranch, /for\s*\(\s*const\s+linked\s+of\s+this\._nxLinks\s*\)/);
  assert.match(nexusLoop, /if\s*\(\s*!hasLOS\(this\.x,\s*this\.y,\s*linked\.x,\s*linked\.y,\s*_EG\.dungeon\.map\)\)\s*continue/);
});

test('grenade bomb zones keep player damage LOS-gated', () => {
  const hazardBody = extractBlock(CONTENT_PROJECTILES_NC, /function\s+updateHazardZones\s*\(/);
  assert.match(hazardBody, /dist\(player\.x,\s*player\.y,\s*z\.x,\s*z\.y\)\s*<\s*z\.radius\s*&&\s*hasLOS\(z\.x,\s*z\.y,\s*player\.x,\s*player\.y,\s*_CG\.dungeon\.map\)/);
});

test('blast line-of-sight is blocked by closed doors', () => {
  const map = Array.from({ length: 5 }, () => Array(5).fill(T.FLOOR));
  const row = map[2];
  assert.ok(row);
  row[2] = T.DOOR;
  assert.equal(hasLOS(1.5, 2.5, 3.5, 2.5, map), false, 'closed doors must block bomb and AoE line-of-sight');
});

test('blast line-of-sight is blocked by challenge gates', () => {
  const map = Array.from({ length: 5 }, () => Array(5).fill(T.FLOOR));
  const row = map[2];
  assert.ok(row);
  row[2] = T.CHALLENGE_GATE;
  assert.equal(hasLOS(1.5, 2.5, 3.5, 2.5, map), false, 'challenge gates are door-like blast blockers');
});

test('fuse shard bomb damage and wall breaking are LOS-gated', () => {
  const bombBody = extractBlock(ENTITIES_FUSE_SHARDS_NC, /function\s+_detonateBombAt\s*\(/);
  const enemyLoop = extractBlock(bombBody, /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/);
  assert.match(enemyLoop, /map\s*&&\s*dist\(x,\s*y,\s*e\.x,\s*e\.y\)\s*<\s*BOMB_BLAST_RADIUS\s*&&\s*hasLOS\(x,\s*y,\s*e\.x,\s*e\.y,\s*map\)/);
  assert.match(bombBody, /if\s*\(\s*!hasLOS\(x,\s*y,\s*tx\s*\+\s*0\.5,\s*ty\s*\+\s*0\.5,\s*map\)\)\s*continue/);
});

test('tunneller eruption AoE is LOS-gated', () => {
  const tunnellerBody = extractBlock(ENTITIES_NC, /aiTunneller\s*\([^)]*\)\s*\{/);
  assert.match(tunnellerBody, /dist\(this\.x,\s*this\.y,\s*player\.x,\s*player\.y\)\s*<\s*aoeR\s*&&\s*this\._canTarget\(\)\s*&&\s*hasLOS\(this\.x,\s*this\.y,\s*player\.x,\s*player\.y,\s*map\)/);
});
