'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
  const loadIdx = GAME.indexOf('loadFloor(n, savedModifier, skipAutoSave)');
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

test('save and continue persist exact mid-floor snapshot state', () => {
  assert.match(GAME, /const FLOOR_SNAPSHOT_VERSION = 1/);
  assert.match(GAME, /floorSnapshot:\s*serializeFloorSnapshot\(this\)/);
  assert.match(GAME, /player:\s*\{\s*x:p\.x,\s*y:p\.y,/);
  assert.match(GAME, /restoreFloorSnapshot\(this,\s*save\.floorSnapshot\)/);
  assert.ok(
    GAME.indexOf('this.loadFloor(save.floor||1, savedMod, true);') <
    GAME.indexOf('restoreFloorSnapshot(this, save.floorSnapshot);'),
    'Continue must regenerate the seeded floor before replaying the live floor snapshot'
  );
  assert.match(GAME, /dungeon:\s*serializeDungeonFloorSnapshot\(gameState\.dungeon\)/);
  assert.match(GAME, /enemies:\s*enemies\.map/);
  assert.match(GAME, /items:\s*items\.map\(serializeItemSnapshot\)/);
  assert.match(GAME, /projectiles:\s*projectiles\.map\([\s\S]*?serializeProjectileSnapshot/);
  assert.match(GAME, /replaceFloorArray\(enemies,\s*snapshot\.enemies/);
  assert.match(GAME, /replaceFloorArray\(items,\s*snapshot\.items,\s*restoreItemSnapshot\)/);
  assert.match(GAME, /gameState\.refreshSealedEntrances\(\)/);
});

test('floor snapshots restore player location, mutated floor state, and live actors', () => {
  const start = GAME.indexOf('const FLOOR_SNAPSHOT_VERSION = 1;');
  const end = GAME.indexOf('/** @type {Record<string, any>} */\nconst game = {', start);
  assert.ok(start >= 0 && end > start, 'floor snapshot helpers must be extractable');
  const helperBlock = GAME.slice(start, end);
  const released = [];
  const sandbox = {
    Set,
    WeakSet,
    Array,
    Object,
    Number,
    String,
    ArrayBuffer,
    DataView,
    Float32Array,
    Uint8Array,
    enemies: [],
    items: [],
    projectiles: [],
    hazardZones: [{ x: 7, y: 8, radius: 2 }],
    fuseShards: [],
    vcores: [],
    crates: [],
    beacons: [],
    mines: [],
    shieldGens: [],
    cameras: [],
    lasers: [],
    wallTurrets: [],
    disruptionFields: [],
    gravityWells: [],
    placedWalls: [],
    frostPatches: [],
    UPGRADES: [{ id: 'BOOST', name: 'Boost' }],
    buildWeapon(base, affixes) { return { _base: base, _affixes: affixes.slice(), displayName: base + ' rebuilt', _effects: affixes.map(id => 'effect:' + id) }; },
    Item: function Item(x, y, type) { this.x = x; this.y = y; this.type = type; },
    KeyItem: function KeyItem(x, y, colour, tileColour) { this.x = x; this.y = y; this.colour = colour; this.tileColour = tileColour; this.isKey = true; },
    WhisperItem: function WhisperItem(x, y, whisperId) { this.x = x; this.y = y; this.whisperId = whisperId; this.isWhisper = true; },
    WeaponCacheItem: function WeaponCacheItem(x, y, weapon) { this.x = x; this.y = y; this.weapon = weapon; this.isWeaponCache = true; },
    HarvestPickup: function HarvestPickup(x, y) { this.x = x; this.y = y; this.isHarvest = true; },
    ShockPulsePickup: function ShockPulsePickup(x, y) { this.x = x; this.y = y; this.isShockPulse = true; },
    VaultCoin: function VaultCoin(x, y, amt) { this.x = x; this.y = y; this.amt = amt; this.isHoard = true; this._big = true; },
    MagpieHoard: function MagpieHoard(x, y, amt) { this.x = x; this.y = y; this.amt = amt; this.isHoard = true; },
    Enemy: function Enemy(x, y, hp, atk, spd, xp, colour, type) { this.x = x; this.y = y; this.hp = hp; this.atk = atk; this.spd = spd; this.xp = xp; this.colour = colour; this.type = type; },
    Projectile: function Projectile(x, y, dx, dy, spd, dmg, maxRange, colour, piercing, fromPlayer, weaponName) {
      this.x = x; this.y = y; this.dx = dx; this.dy = dy; this.spd = spd; this.dmg = dmg; this.maxRange = maxRange;
      this.colour = colour; this.piercing = piercing; this.fromPlayer = fromPlayer; this.weaponName = weaponName;
      this.hitEnemies = new Set(); this.trail = [];
    },
    FuseShard: function FuseShard(x, y) { this.x = x; this.y = y; },
    registerEnemyInRoom(e) { if (e.room) e.room.registered = e; },
    clearEnemiesByRoom() { for (const room of sandbox.__rooms || []) delete room.registered; },
    releaseProjectile(p) { released.push(p); },
    _CG: { msg() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(`${helperBlock}
this.serializeFloorSnapshot = serializeFloorSnapshot;
this.restoreFloorSnapshot = restoreFloorSnapshot;`, sandbox);

  const room0 = {
    id: 'start',
    open: false,
    shopItems: [
      {
        id: 'SHOP_HEAL',
        name: 'Full Repair',
        sold: false,
        price: 62,
        fn(player) { player.hp = player.maxHp; }
      },
      {
        id: 'BOOST_COMBAT_STIM',
        boostId: 'COMBAT_STIM',
        name: 'Combat Stim',
        sold: true,
        price: 19,
        fn(player) { player.activeBoosts = { COMBAT_STIM: true }; }
      },
      {
        id: 'WEAPON_RAILGUN',
        name: 'Saved Railgun',
        sold: false,
        price: 99,
        _weaponObj: { _base: 'RAILGUN', _affixes: ['FLAME'], displayName: 'Saved Railgun' },
        fn(player) { player.weapon = { _base: 'RAILGUN', _affixes: ['FLAME'], from: 'saved' }; }
      }
    ]
  };
  const room1 = { id: 'boss', locked: true };
  sandbox.__rooms = [room0, room1];
  const sourceEnemy = { x: 9, y: 10, hp: 4, type: 'GUARD', colour: '#f00', room: room1, hitEnemies: new Set([{ stale: true }]) };
  sandbox.enemies.push(sourceEnemy);
  sandbox.items.push(new sandbox.Item(3, 4, sandbox.UPGRADES[0]));
  sandbox.items.push(new sandbox.WeaponCacheItem(4, 5, { _base: 'RAILGUN', _affixes: ['FLAME'], displayName: 'Railgun', colour: '#ff00c8' }));
  sandbox.projectiles.push({ x: 5, y: 6, dx: 1, dy: 0, spd: 8, dmg: 2, maxRange: 9, colour: '#0ff', piercing: true, fromPlayer: true, weaponName: 'TEST', hitEnemies: new Set([sourceEnemy]), homing: sourceEnemy, _owner: sourceEnemy });
  const sourceGame = {
    floor: 2,
    player: { x: 12.5, y: 13.5 },
    dungeon: {
      map: [['OPEN']],
      visited: [new Uint8Array([1])],
      light: [new Float32Array([0.75])],
      visible: [new Uint8Array([1])],
      secretMask: [new Uint8Array([0])],
      rooms: [room0, room1],
    },
    clearedRooms: new Set([room0]),
    bossRoom: room1,
    bossType: 'SENTINEL',
    bossSealed: true,
    bossAlive: true,
    challengeSealed: true,
    challengeWave: 2,
    challengeMaxWaves: 3,
    challengeComplete: false,
    mapRevealed: true,
    teleportCooldown: 1.5,
  };

  const snapshot = JSON.parse(JSON.stringify(sandbox.serializeFloorSnapshot(sourceGame)));
  assert.equal(snapshot.player.x, 12.5);
  assert.equal(snapshot.dungeon.map[0][0], 'OPEN');
  assert.deepEqual(snapshot.dungeon.light[0], [0.75]);
  assert.equal(snapshot.dungeon.rooms[0].shopItems[0].fn, undefined);
  assert.equal(snapshot.enemies[0]._roomIndex, 1);
  assert.equal(snapshot.enemies[0].room, undefined);
  assert.equal(snapshot.items[0].typeId, 'BOOST');
  assert.equal(snapshot.items[1]._kind, 'weaponCache');
  assert.equal(snapshot.items[1].weapon._base, 'RAILGUN');
  assert.deepEqual(Array.from(snapshot.projectiles[0]._hitEnemyIndices), [0]);
  assert.equal(snapshot.projectiles[0]._homingEnemyIndex, 0);
  assert.equal(snapshot.projectiles[0]._ownerEnemyIndex, 0);
  sandbox.projectiles.length = 0;
  sandbox.projectiles.push({ old: true, hitEnemies: new Set(), trail: [1] });

  const newRoom0 = {
    id: 'start',
    shopItems: [
      {
        id: 'BOOST_COMBAT_STIM',
        boostId: 'COMBAT_STIM',
        name: 'Combat Stim',
        sold: false,
        price: 19,
        fn(player) { player.activeBoosts = { COMBAT_STIM: true }; }
      },
      {
        id: 'WEAPON_RAILGUN',
        name: 'Regenerated Railgun',
        sold: false,
        price: 99,
        _weaponObj: { _base: 'RAILGUN', _affixes: ['FROST'], displayName: 'Regenerated Railgun' },
        fn(player) { player.weapon = { _base: 'RAILGUN', _affixes: ['FROST'], from: 'regenerated' }; }
      }
    ]
  };
  const newRoom1 = { id: 'boss' };
  const targetGame = {
    floor: 2,
    player: { x: 1, y: 1 },
    dungeon: {
      map: [['WALL']],
      visited: [new Uint8Array([0])],
      light: [new Float32Array([0])],
      visible: [new Uint8Array([0])],
      secretMask: [new Uint8Array([1])],
      rooms: [newRoom0, newRoom1],
    },
    clearedRooms: new Set(),
    bossRoom: null,
    refreshSealedEntrances() { this.refreshed = true; },
    markMapMutated() { this.mutated = true; },
  };
  const restored = sandbox.restoreFloorSnapshot(targetGame, snapshot);
  assert.equal(restored, true);
  assert.equal(targetGame.player.x, 12.5);
  assert.equal(targetGame.dungeon.map[0][0], 'OPEN');
  assert.equal(typeof targetGame.dungeon.light[0].fill, 'function');
  assert.equal(typeof targetGame.dungeon.visible[0].fill, 'function');
  assert.equal(targetGame.dungeon.light[0][0] > 0.7, true);
  assert.equal(sandbox.enemies.length, 1);
  assert.equal(sandbox.enemies[0].room, newRoom1);
  assert.equal(newRoom1.registered, sandbox.enemies[0]);
  assert.equal(sandbox.items[0].type.id, 'BOOST');
  assert.equal(sandbox.items[1].isWeaponCache, true);
  assert.equal(sandbox.items[1].weapon.displayName, 'RAILGUN rebuilt');
  assert.deepEqual(sandbox.items[1].weapon._effects, ['effect:FLAME']);
  assert.equal(released.length, 1);
  assert.equal(sandbox.projectiles.length, 1);
  assert.equal(sandbox.projectiles[0].x, 5);
  assert.equal(sandbox.projectiles[0].hitEnemies.has(sandbox.enemies[0]), true);
  assert.equal(sandbox.projectiles[0].homing, sandbox.enemies[0]);
  assert.equal(sandbox.projectiles[0]._owner, sandbox.enemies[0]);
  assert.equal(targetGame.clearedRooms.has(newRoom0), true);
  assert.equal(targetGame.bossRoom, newRoom1);
  assert.equal(targetGame.bossType, 'SENTINEL');
  assert.equal(targetGame.bossSealed, true);
  assert.equal(targetGame.challengeWave, 2);
  assert.equal(targetGame.mapRevealed, true);
  assert.equal(targetGame.refreshed, true);
  assert.equal(targetGame.mutated, true);
  assert.equal(typeof newRoom0.shopItems[0].fn, 'function');
  assert.equal(newRoom0.shopItems[0].id, 'SHOP_HEAL');
  assert.equal(newRoom0.shopItems[1].sold, true);
  const shopPlayer = { hp: 1, maxHp: 9, activeBoosts: {} };
  newRoom0.shopItems[0].fn(shopPlayer);
  assert.equal(shopPlayer.hp, 9);
  newRoom0.shopItems[1].fn(shopPlayer);
  assert.deepEqual(shopPlayer.activeBoosts, { COMBAT_STIM: true });
  assert.equal(typeof newRoom0.shopItems[2].fn, 'function');
  assert.equal(newRoom0.shopItems[2]._weaponObj._affixes[0], 'FLAME');
  newRoom0.shopItems[2].fn(shopPlayer);
  assert.deepEqual(shopPlayer.weapon._affixes, ['FLAME']);
  assert.deepEqual(shopPlayer.weapon._effects, ['effect:FLAME']);

  const legacyTypedArraySnapshot = JSON.parse(JSON.stringify(snapshot));
  legacyTypedArraySnapshot.dungeon.light = [{ 0: 0.5 }];
  legacyTypedArraySnapshot.dungeon.visible = [{ 0: 1 }];
  legacyTypedArraySnapshot.dungeon.visited = [{ 0: 1 }];
  legacyTypedArraySnapshot.dungeon.secretMask = [{ 0: 0 }];
  const legacyTarget = {
    floor: 2,
    player: { x: 1, y: 1 },
    dungeon: {
      map: [['WALL']],
      visited: [new Uint8Array([0])],
      light: [new Float32Array([0])],
      visible: [new Uint8Array([0])],
      secretMask: [new Uint8Array([1])],
      rooms: [newRoom0, newRoom1],
    },
    clearedRooms: new Set(),
    bossRoom: null,
    refreshSealedEntrances() {},
    markMapMutated() {},
  };
  assert.equal(sandbox.restoreFloorSnapshot(legacyTarget, legacyTypedArraySnapshot), true);
  assert.equal(typeof legacyTarget.dungeon.light[0].fill, 'function');
  assert.equal(legacyTarget.dungeon.visible[0][0], 1);

  const sparseObjectSnapshot = JSON.parse(JSON.stringify(snapshot));
  sparseObjectSnapshot.dungeon.light = [{ 0: 0.5 }];
  sparseObjectSnapshot.dungeon.visible = [{ 0: 1 }];
  const sparseFallbackLight = new Float32Array([0.1, 0.2]);
  const sparseFallbackVisible = new Uint8Array([1, 0]);
  const sparseFallbackLightGrid = [sparseFallbackLight];
  const sparseFallbackVisibleGrid = [sparseFallbackVisible];
  const sparseTarget = {
    floor: 2,
    player: { x: 1, y: 1 },
    dungeon: {
      map: [['WALL']],
      visited: [new Uint8Array([0])],
      light: sparseFallbackLightGrid,
      visible: sparseFallbackVisibleGrid,
      secretMask: [new Uint8Array([1])],
      rooms: [newRoom0, newRoom1],
    },
    clearedRooms: new Set(),
    bossRoom: null,
    refreshSealedEntrances() {},
    markMapMutated() {},
  };
  assert.equal(sandbox.restoreFloorSnapshot(sparseTarget, sparseObjectSnapshot), true);
  assert.equal(sparseTarget.dungeon.light, sparseFallbackLightGrid);
  assert.equal(sparseTarget.dungeon.visible, sparseFallbackVisibleGrid);
  assert.equal(sparseTarget.dungeon.light[0].length, 2);

  const truncatedSnapshot = JSON.parse(JSON.stringify(snapshot));
  truncatedSnapshot.dungeon.light = [];
  truncatedSnapshot.dungeon.visible = [];
  const fallbackLight = new Float32Array([0.25]);
  const fallbackVisible = new Uint8Array([1]);
  const fallbackLightGrid = [fallbackLight];
  const fallbackVisibleGrid = [fallbackVisible];
  const truncatedTarget = {
    floor: 2,
    player: { x: 1, y: 1 },
    dungeon: {
      map: [['WALL']],
      visited: [new Uint8Array([0])],
      light: fallbackLightGrid,
      visible: fallbackVisibleGrid,
      secretMask: [new Uint8Array([1])],
      rooms: [newRoom0, newRoom1],
    },
    clearedRooms: new Set(),
    bossRoom: null,
    refreshSealedEntrances() {},
    markMapMutated() {},
  };
  assert.equal(sandbox.restoreFloorSnapshot(truncatedTarget, truncatedSnapshot), true);
  assert.equal(truncatedTarget.dungeon.light, fallbackLightGrid);
  assert.equal(truncatedTarget.dungeon.light[0], fallbackLight);
  assert.equal(typeof truncatedTarget.dungeon.light[0].fill, 'function');
  assert.equal(truncatedTarget.dungeon.visible, fallbackVisibleGrid);
  assert.equal(truncatedTarget.dungeon.visible[0], fallbackVisible);
});

test('mobile/page lifecycle interruptions save current run before the browser can unload', () => {
  assert.match(PLATFORM, /const _RUN_SAVE_STATES = new Set\(\[/);
  assert.match(PLATFORM, /function saveRunForPageInterruption\(\)[\s\S]*_G\.saveGame\(\)/);
  assert.match(PLATFORM, /function _onVisibilityHidden\(\)[\s\S]*saveRunForPageInterruption\(\)/);
  assert.match(PLATFORM, /window\.addEventListener\('pagehide',\s*saveRunForPageInterruption\)/);
  assert.match(PLATFORM, /window\.addEventListener\('beforeunload',\s*saveRunForPageInterruption\)/);
});

test('touch input routes seed setup taps through the seed screen hit-test path', () => {
  assert.match(PLATFORM, /_G\.state === 'SEED_SETUP'[\s\S]*justPressed\.add\('MouseLeft'\)/);
  assert.match(GAME, /seedSetupHitTest\(mouse\.x, mouse\.y\)/);
});

test('mobile seed setup exposes a real text input for the OS keyboard', () => {
  assert.match(GAME, /sanitizeSeedSetupSeed\(value\)/);
  assert.match(GAME, /setSeedSetupSeed\(value\)[\s\S]*sanitizeSeedSetupSeed\(value\)/);
  assert.match(GAME, /seedSetupFieldHitTest\(x, y\)[\s\S]*seedSetupLayout\(\)/);
  assert.match(GAME, /Tap seed to edit, or use RANDOMIZE\./);

  assert.match(PLATFORM, /document\.createElement\('input'\)/);
  assert.match(PLATFORM, /el\.inputMode = 'text'/);
  assert.match(PLATFORM, /el\.addEventListener\('input'[\s\S]*_G\.setSeedSetupSeed\(el\.value\)/);
  assert.match(PLATFORM, /el\.addEventListener\('keydown'[\s\S]*e\.stopPropagation\(\)/);
  assert.match(PLATFORM, /_G\.seedSetupFieldHitTest\(cx, cy\)[\s\S]*focusSeedSetupInput\(t\.clientX, t\.clientY\)/);
});
