// @ts-check
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

const GAME = read('src/game.js');
const ENTITIES = read('src/entities.js');
const RENDER = read('src/render.js');

test('FEET sequence opens the hidden cheat menu without text-entry capture', () => {
  assert.match(GAME, /const CHEAT_SEQUENCE = \['KeyF', 'KeyE', 'KeyE', 'KeyT'\]/);
  assert.match(GAME, /advanceCheatSequence\(this\.cheatSequenceProgress,\s*code\)/);
  assert.match(GAME, /this\.openCheatMenu\(\)/);
  assert.match(GAME, /this\.setState\('CHEATS'\)/);
  assert.match(GAME, /case 'CHEATS':\s+this\.updateCheatMenu\(\);/);
  assert.match(GAME, /case 'CHEATS':[\s\S]*?this\.renderCheatMenu\(\);/);
  assert.match(GAME, /cheatReturnState !== 'HUB'/);
  assert.doesNotMatch(GAME, /if \(this\.updateCheatHotkey\(\)\) return/);
  assert.match(GAME, /this\.updateCheatHotkey\(\);\s*switch\(this\.state\)/);
  assert.match(GAME, /this\._cheatMenuJustOpened = true;\s*this\.setState\('CHEATS'\)/);
  assert.match(GAME, /if \(this\._cheatMenuJustOpened\) \{\s*this\._cheatMenuJustOpened = false;\s*return;\s*\}/);
  assert.match(GAME, /this\.state === 'NAME_ENTRY' \|\| this\.state === 'SEED_SETUP'/);
  assert.match(GAME, /this\.state === 'SETTINGS' && this\.settingsCapture/);
});

test('cheat menu exposes runtime-only toggles and dirties minimap on show-map changes', () => {
  assert.match(GAME, /id:'invulnerable'[\s\S]*?name:'INVULNERABILITY'/);
  assert.match(GAME, /id:'noClip'[\s\S]*?name:'NO-CLIP'/);
  assert.match(GAME, /id:'revealMap'[\s\S]*?name:'SHOW MAP'/);
  assert.match(GAME, /id:'hyperMode'[\s\S]*?name:'HYPER MODE'/);
  assert.match(GAME, /this\.cheats = Object\.assign\(defaultCheats\(\), this\.cheats \|\| \{\}\)/);
  assert.match(GAME, /if \(def\.id === 'revealMap'\) this\._minimapDirty = true/);

  const saveStart = GAME.indexOf('saveGame()');
  const saveEnd = GAME.indexOf('continueGame()', saveStart);
  assert.ok(saveStart >= 0 && saveEnd > saveStart, 'saveGame block must be extractable');
  assert.doesNotMatch(GAME.slice(saveStart, saveEnd), /\bcheats\s*:/, 'cheats must not be written to normal save data');

  const startStart = GAME.indexOf('startGame(opts)');
  const startEnd = GAME.indexOf('openSeedSetup()', startStart);
  assert.ok(startStart >= 0 && startEnd > startStart, 'startGame block must be extractable');
  assert.match(GAME.slice(startStart, startEnd), /this\.cheats = defaultCheats\(\)/);
  assert.match(GAME.slice(startStart, startEnd), /this\._cheatMenuJustOpened = false/);

  const continueStart = GAME.indexOf('continueGame()');
  const continueEnd = GAME.indexOf('update(dt)', continueStart);
  assert.ok(continueStart >= 0 && continueEnd > continueStart, 'continueGame block must be extractable');
  assert.match(GAME.slice(continueStart, continueEnd), /this\.cheats = defaultCheats\(\)/);
  assert.match(GAME.slice(continueStart, continueEnd), /this\._cheatMenuJustOpened = false/);
});

test('gameplay cheat hooks cover damage, movement, speed, and map reveal', () => {
  assert.match(ENTITIES, /function playerCheatEnabled\(id\)[\s\S]*?_EG\.cheats && _EG\.cheats\[id\]/);
  assert.match(ENTITIES, /playerCheatEnabled\('invulnerable'\) && !options\.ignoreCheats/);
  assert.equal(
    (ENTITIES.match(/noClip \|\| isPassable/g) || []).length,
    4,
    'dash X/Y and normal X/Y movement must all bypass passability when no-clip is active'
  );
  assert.match(ENTITIES, /playerCheatEnabled\('hyperMode'\)\) spd \*= 2/);
  assert.equal(
    (RENDER.match(/_RG\.mapRevealed \|\| !!\(_RG\.cheats && _RG\.cheats\.revealMap\)/g) || []).length,
    2,
    'corner and expanded minimaps must both honor the show-map cheat without mutating mapRevealed'
  );
});
