'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/** @param {string} file */
function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const GAME = read('src/game.js');
const CONTENT = read('src/content.js');
const ENTITIES = read('src/entities.js');
const RENDER = read('src/render.js');
const PLATFORM = read('src/platform.js');

test('seeded gameplay files do not call Math.random directly', () => {
  const gameplayFiles = {
    'src/game.js': GAME,
    'src/content.js': CONTENT,
    'src/entities.js': ENTITIES,
    'src/render.js': RENDER,
  };
  for (const [file, src] of Object.entries(gameplayFiles)) {
    assert.equal(
      /\bMath\.random\s*\(/.test(stripComments(src)),
      false,
      `${file} must use engine/math.js RNG streams instead of Math.random()`
    );
  }
});

test('new game flow collects a seed before startGame initializes the run RNG', () => {
  assert.match(GAME, /case 'SEED_SETUP':\s*this\.updateSeedSetup\(dt\);/);
  assert.match(GAME, /case 'SEED_SETUP':\s*this\.renderSeedSetup\(\);/);
  assert.match(GAME, /action:\s*diffAction[\s\S]*isDiffRow:\s*true/);
  assert.match(GAME, /:\s*\(\) => this\.openSeedSetup\(\)/);

  const startIdx = GAME.indexOf('startGame(opts)');
  const endIdx = GAME.indexOf('openSeedSetup()', startIdx);
  assert.ok(startIdx >= 0 && endIdx > startIdx, 'startGame block must be findable');
  const startBlock = GAME.slice(startIdx, endIdx);
  assert.match(startBlock, /const chosenSeed = normalizeSeed\(/);
  assert.match(startBlock, /setSeed\(chosenSeed\);/);
  assert.match(startBlock, /this\.runSeed = getSeed\(\);/);
  assert.match(startBlock, /this\.runSeedHash = getSeedHash\(\);/);
  assert.ok(
    startBlock.indexOf('setSeed(chosenSeed);') < startBlock.indexOf('applyMetaToPlayer(this.player)'),
    'startGame must seed the custom RNG before meta/game generation can roll'
  );
});

test('floor generation uses derived seed streams for world, spawn, and event work', () => {
  const loadIdx = GAME.indexOf('loadFloor(n, savedModifier)');
  const nextIdx = GAME.indexOf('startGame(opts)', loadIdx);
  assert.ok(loadIdx >= 0 && nextIdx > loadIdx, 'loadFloor block must be findable');
  const loadBlock = GAME.slice(loadIdx, nextIdx);
  assert.match(loadBlock, /withDerivedRngStream\('world:floor:' \+ n,\s*\(\) => generateFloor\(n\)\)/);
  assert.match(loadBlock, /withDerivedRngStream\('spawn:floor:' \+ n,\s*\(\) => populateFloor\(this\.dungeon,n\)\)/);
  assert.match(loadBlock, /withDerivedRngStream\('event:floor:' \+ n \+ ':quest',\s*\(\) => this\.generateQuest\(n\)\)/);
});

test('save and continue persist seed and RNG stream state', () => {
  assert.match(GAME, /runSeed:\s*this\.runSeed/);
  assert.match(GAME, /runSeedHash:\s*this\.runSeedHash/);
  assert.match(GAME, /rngStates:\s*snapshotRngStates\(\)/);
  assert.match(GAME, /setSeed\(save\.runSeed \|\| \('LEGACY-' \+ String\(save\.floor \|\| 1\)\), save\.rngStates \|\| null\)/);
});

test('touch input routes seed setup taps through the seed screen hit-test path', () => {
  assert.match(PLATFORM, /_G\.state === 'SEED_SETUP'[\s\S]*justPressed\.add\('MouseLeft'\)/);
  assert.match(GAME, /seedSetupHitTest\(mouse\.x, mouse\.y\)/);
});
