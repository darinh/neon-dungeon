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
const CONTENT = read('src/content.js');
const CONTENT_PICKUPS = read('src/content/pickups.js');
const PLATFORM = read('src/platform.js');

test('secret rooms spawn a distinct pre-rolled weapon cache reward', () => {
  assert.match(CONTENT_PICKUPS, /class WeaponCacheItem[\s\S]*this\.isWeaponCache = true;/,
    'weapon cache must be a distinct pickup class');
  assert.match(CONTENT, /function rollSecretWeaponCacheWeapon\(player, floor\)[\s\S]*WEAPON_KEYS\.filter\(k => !owned\.has\(k\)\)/,
    'secret cache roll should prefer weapon bases not already in the belt');
  assert.match(CONTENT, /return rollWeapon\(baseKey, Math\.min\(10, \(floor \| 0\) \+ 2\)\);/,
    'secret cache weapons should be floor-scaled and slightly premium');

  const revealIdx = GAME.indexOf('revealSecretRoom(sr)');
  const creditIdx = GAME.indexOf('const secretCr =', revealIdx);
  assert.ok(revealIdx >= 0 && creditIdx > revealIdx, 'revealSecretRoom block must be findable');
  const revealBlock = GAME.slice(revealIdx, creditIdx);
  assert.match(revealBlock, /rollSecretWeaponCacheWeapon\(this\.player, floorNum\)/,
    'secret-room reveal should roll the cache with player/belt context');
  assert.match(revealBlock, /items\.push\(new WeaponCacheItem\(sr\.cx \+ 0\.5, sr\.cy \+ 0\.5, cacheWeapon\)\);/,
    'secret-room reveal should place the cache as a floor pickup');
});

test('weapon cache pickup adds to open belt or opens explicit replacement modal', () => {
  assert.match(GAME, /if \(it\.isWeaponCache\) \{[\s\S]*items\.splice\(i, 1\);[\s\S]*this\.collectWeaponCache\(it\.weapon\);[\s\S]*return;/,
    'pickup loop must route weapon caches before generic upgrade handling');
  assert.match(GAME, /collectWeaponCache\(weapon\) \{[\s\S]*this\.player\.collectWeapon\(weapon\)[\s\S]*WEAPON CACHE: /,
    'cache collection should fill open belt slots first');
  assert.match(GAME, /this\.weaponSwapChoice = \{[\s\S]*weapon,[\s\S]*selected:[\s\S]*_arm: 0\.25[\s\S]*\};[\s\S]*this\.setState\('WEAPON_SWAP'\);/,
    'full belts should open an armed WEAPON_SWAP state');
  assert.match(GAME, /applyWeaponSwapChoice\(idx\) \{[\s\S]*this\.player\.swapWeapon\(idx, weapon\);[\s\S]*this\.player\.weaponIdx = idx;[\s\S]*this\.player\.shootCooldown = 0;/,
    'replacement must update belt slot, active index, active weapon, and cooldown');
  assert.match(GAME, /else \{[\s\S]*Weapon cache skipped/,
    'replacement modal must have an explicit skip path');
});

test('weapon swap modal is wired into update, render, and mobile touch routing', () => {
  assert.match(GAME, /case 'WEAPON_SWAP':\s*this\.updateWeaponSwap\(dt\); break;/,
    'game update switch must dispatch WEAPON_SWAP');
  assert.match(GAME, /case 'WEAPON_SWAP':\s*this\.renderPlaying\(\); this\.renderWeaponSwap\(\); break;/,
    'game render switch must draw WEAPON_SWAP over the world');
  assert.match(GAME, /function getWeaponSwapLayout\(narrow\)/,
    'modal update/render should share a layout helper');
  assert.match(GAME, /renderWeaponSwap\(\)[\s\S]*1-3 replace/,
    'rendered modal should explain keyboard replacement controls');
  assert.match(PLATFORM, /TOUCH_ROUTE_AS_CLICK_STATES\.has\(_G\.state\)[\s\S]*?routeTouchAsMouseClick\(cx, cy\);[\s\S]*?continue;/,
    'mobile WEAPON_SWAP touches must be coordinate-routed for hit testing');
});

test('weapon swap survives mobile/page interruption autosaves', () => {
  assert.match(read('src/game-states.js'), /RUN_SAVE_STATES = new Set\(\[[\s\S]*GAME_STATES\.WEAPON_SWAP/,
    'WEAPON_SWAP must autosave on visibility/pagehide interruptions');
  assert.match(GAME, /const pendingWeaponSwap = this\.state === 'WEAPON_SWAP'[\s\S]*weaponSwapChoice\.weapon\._base[\s\S]*selected: this\.weaponSwapChoice\.selected \| 0/,
    'saveGame must persist the pending cache weapon and selected row');
  assert.match(GAME, /weaponSwapChoice: pendingWeaponSwap,/,
    'save payload must include pending weapon swap choice');
  assert.match(GAME, /if \(save\.weaponSwapChoice && save\.weaponSwapChoice\.weapon && save\.weaponSwapChoice\.weapon\._base\) \{[\s\S]*this\.weaponSwapChoice = \{[\s\S]*weapon: buildWeapon\(save\.weaponSwapChoice\.weapon\._base, affixes\),[\s\S]*_arm: 0[\s\S]*this\.setState\('WEAPON_SWAP'\);[\s\S]*return;/,
    'continueGame must restore the modal instead of dropping the consumed cache');
});

test('weapon cache snapshot restore rebuilds runtime weapon behavior', () => {
  assert.match(GAME, /saved\._kind === 'weaponCache'[\s\S]*const affixes = savedWeapon && Array\.isArray\(savedWeapon\._affixes\)[\s\S]*buildWeapon\(savedWeapon && savedWeapon\._base \? savedWeapon\._base : 'PULSE_PISTOL', affixes\)[\s\S]*new WeaponCacheItem/,
    'weapon cache restore must rebuild the cached weapon through buildWeapon');
  assert.match(GAME, /if \(saved\._kind === 'weaponCache'\) \{[\s\S]*restoredItem\.weapon = buildWeapon/,
    'Object.assign must not leave weaponCache.weapon as the serialized data-only copy');
});
