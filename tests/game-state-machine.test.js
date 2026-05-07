// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_SRC = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');
const HUB_SRC = fs.readFileSync(path.join(ROOT, 'src/meta/hub.js'), 'utf8');
const gameStates = require(path.join(ROOT, 'src/game-states.js'));

/**
 * @typedef {{
 *   game: any,
 *   store: Map<string, string>,
 *   musicCalls: any[][],
 *   audioCalls: any[][],
 *   loadedFloors: any[],
 *   meta: any,
 *   neon: any,
 * }} GameHarness
 */

class TestPlayer {
  constructor() {
    this.x = 4;
    this.y = 5;
    this.hp = 12;
    this.maxHp = 20;
    this.atk = 3;
    this.def = 1;
    this.level = 2;
    this.xp = 7;
    this.weapon = { _base: 'PULSE_PISTOL', _affixes: [] };
    this.weapons = [this.weapon];
    this.weaponIdx = 0;
    this.upgrades = {};
    this.perks = {};
    this.keys = { red: 0, blue: 0, gold: 0 };
    this.shards = 0;
    this.permSpeedBonus = 0;
    this.score = 25;
    this.energyShield = 0;
    this.energyShieldTimer = 0;
    this.credits = 0;
    this.loreRead = new Set();
    this.damageLog = {};
    this.enemiesKilled = 0;
    this.hitsBlocked = 0;
    this.roomsCleared = 0;
    this.eventsResolved = 0;
    this.bountiesCollected = 0;
    this.hackware = null;
    this.hackwareCooldown = 0;
    this.secondWindUsed = false;
    this.lastStandTimer = 0;
    this.lastStandCD = 0;
    this.augments = {};
    this.metaFlags = {};
    this.damageMult = 1;
    this.regenPerSec = 0;
    this.critChance = 0;
    this.sensorRadiusMult = 1;
    this.bonusCreditPerPickup = 0;
    this.dashIFrameBonus = 0;
    this.hackwareSlots = 3;
    this.activeBoosts = {};
  }
}

/** @returns {GameHarness} */
function createHarness() {
  const store = new Map();
  /** @type {any[][]} */
  const musicCalls = [];
  /** @type {any[][]} */
  const audioCalls = [];
  /** @type {any[]} */
  const loadedFloors = [];
  const meta = {
    lastDifficulty: 'NORMAL',
    introSeen: true,
    shards: 0,
    cores: 0,
    runsCompleted: 0,
    stats: { totalRuns: 0 },
    totalShards: 0,
    bestFloor: 0,
    victories: 0,
    upgrades: {},
    upgradeNodes: {},
    modulesOwned: [],
    logsRead: [],
    logsFound: [],
    endingsUnlocked: [],
    clearedDifficulties: [],
  };
  /** @type {any} */
  const sandbox = {};
  const ctx = new Proxy(/** @type {Record<string | symbol, any>} */ ({}), {
    get(target, prop) {
      if (!(prop in target)) target[prop] = () => {};
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });

  /** @type {any} */
  const globals = {
    console: { log() {}, warn() {}, error() {} },
    Map,
    Set,
    WeakSet,
    Array,
    Object,
    Number,
    String,
    Math,
    JSON,
    Date,
    RegExp,
    Error,
    TypeError,
    Float32Array,
    Uint8Array,
    ArrayBuffer,
    DataView,
    Promise,
    W: 900,
    H: 600,
    SAVE_VERSION: 12,
    MAP_W: 60,
    MAP_H: 40,
    T: { FLOOR: 2, STAIRS: 3 },
    mouse: { x: 0, y: 0 },
    messages: [],
    layout: { compact: false },
    justPressed: new Set(),
    keys: new Set(),
    lastKey: '',
    ALT_KEYS: {},
    combo: { best: 0 },
    DIFFICULTIES: { NORMAL: { label: 'NORMAL', colour: '#fff' }, HARD: { label: 'HARD', colour: '#f80' } },
    DIFF_ORDER: [],
    DIFF_UNLOCK_REQS: {},
    FLOOR_MODIFIERS: {},
    enemies: [],
    items: [],
    projectiles: [],
    hazardZones: [],
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
    Player: TestPlayer,
    NEON: {
      gameStates,
      telemetry: { init() {}, track() {}, flush() {} },
      draw: { line() {}, roundRectFillStroke() {} },
      biomes: {
        areaForFloor: (/** @type {number} */ floor) => ({ id: 'test-area', name: 'TEST AREA', floor }),
        areaForIndex: () => ({ floors: [1] }),
      },
      save: { loadMeta: () => meta },
      upgrades: {
        defaultSelectorState: () => ({}),
        handleUpgradeInput() {},
        drawUpgradeMatrix() {},
      },
      modules: {
        defaultPanelState: () => ({}),
        handleModuleSlotsKey() {},
        drawModuleSlotsPanel() {},
        commitRunModules() {},
        clearRunModules() {},
      },
      logs: {
        groupedByAxiom: () => [],
        progress: () => ({ read: 0, total: 0 }),
        readLog() {},
      },
      whispers: {
        groupedByBiome: () => [],
        readWhisper() {},
      },
    },
    /** @param {string} name */
    requireNEON(name) {
      if (sandbox.NEON && sandbox.NEON[name]) return sandbox.NEON[name];
      throw new Error('missing NEON dependency: ' + name);
    },
    localStorage: {
      /** @param {string} key */
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      /** @param {string} key @param {any} value */
      setItem(key, value) { store.set(key, String(value)); },
      /** @param {string} key */
      removeItem(key) { store.delete(key); },
    },
    document: {
      /** @param {string} id */
      getElementById(id) {
        if (id === 'c') return sandbox.canvas;
        return { style: {} };
      },
      addEventListener() {},
    },
    window: {
      innerWidth: 900,
      innerHeight: 600,
      devicePixelRatio: 1,
      addEventListener() {},
      dispatchEvent() {},
      matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
    },
    canvas: {
      style: {},
      getContext() { return ctx; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 600 }; },
      addEventListener() {},
    },
    ctx,
    screen: { orientation: { addEventListener() {} } },
    navigator: { userAgent: '' },
    performance: { now() { return 0; } },
    requestAnimationFrame() { return 1; },
    setTimeout() { return 1; },
    clearTimeout() {},
    fetch() { return Promise.resolve({ ok: true, json: () => Promise.resolve({ version: 'test' }) }); },
    resize() {},
    updateBtns() {},
    resetTouch() {},
    loop() {},
    /** @param {string} action */
    km(action) { return action; },
    jp() { return false; },
    /** @param {number} min */
    rndInt(min) { return min; },
    rand() { return 0; },
    /** @param {number} min */
    rnd(min) { return min; },
    makeRandomSeed() { return 'RANDOM-SEED'; },
    /** @param {any} seed */
    normalizeSeed(seed) { return String(seed || 'RANDOM-SEED'); },
    /** @param {any} seed */
    setSeed(seed) { sandbox.__seed = String(seed); },
    getSeed() { return sandbox.__seed || 'RANDOM-SEED'; },
    getSeedHash() { return 12345; },
    snapshotRngStates() { return { main: 1 }; },
    calcRunShards() { return 0; },
    loadMeta() { return meta; },
    /** @param {any} nextMeta */
    saveMeta(nextMeta) { Object.assign(meta, nextMeta); },
    resetMeta() {},
    defaultCheats() { return {}; },
    applyMetaToPlayer() {},
    /** @param {string} base @param {any[]} affixes */
    buildWeapon(base, affixes) { return { _base: base, _affixes: Array.isArray(affixes) ? affixes.slice() : [] }; },
    /** @param {any} value */
    serializeMainframeFinaleState(value) { return value || null; },
    /** @param {any} value */
    restoreMainframeFinaleState(value) { return value || null; },
    /** @param {any} value */
    restoreSystemMessagesState(value) { return value || { entries: [], nextSequence: 1 }; },
    /** @param {any} value */
    serializeSystemMessagesState(value) { return value || { entries: [], nextSequence: 1 }; },
    serializeFloorSnapshot() { return { v: 1, marker: 'snapshot' }; },
    restoreFloorSnapshot() { return false; },
    clearLosCache() {},
    music: {
      /** @param {string} state */
      setState(state) { musicCalls.push(['setState', state]); },
      pause() { musicCalls.push(['pause']); },
      resume() { musicCalls.push(['resume']); },
      stop() { musicCalls.push(['stop']); },
      /** @param {number} floor */
      setFloor(floor) { musicCalls.push(['setFloor', floor]); },
    },
    audio: new Proxy(/** @type {Record<string | symbol, any>} */ ({}), {
      get(target, prop) {
        if (!(prop in target)) {
          /** @param {...any} args */
          target[prop] = (...args) => {
            audioCalls.push([String(prop), ...args]);
            return false;
          };
        }
        return target[prop];
      },
    }),
  };
  Object.assign(sandbox, globals);
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window.NEON = sandbox.NEON;

  vm.createContext(sandbox);
  vm.runInContext(HUB_SRC, sandbox, { filename: 'src/meta/hub.js' });
  vm.runInContext(GAME_SRC + '\nthis.__game = game;', sandbox, { filename: 'src/game.js' });
  const game = sandbox.__game;
  game.loadFloor = (/** @type {number} */ floor, /** @type {any} */ _savedModifier, /** @type {boolean | undefined} */ skipAutoSave) => {
    loadedFloors.push({ floor, skipAutoSave: !!skipAutoSave });
    game.floor = floor;
    game.dungeon = {
      map: [[sandbox.T.FLOOR]],
      visited: [[1]],
      light: [[1]],
      visible: [[1]],
      secretMask: [[0]],
      rooms: [],
      playerPos: { x: 1, y: 1 },
    };
  };
  return { game, store, musicCalls, audioCalls, loadedFloors, meta, neon: sandbox.NEON };
}

test('menu start transition enters PLAYING through the canonical state machine', () => {
  const h = createHarness();

  assert.equal(h.game.state, gameStates.GAME_STATES.MENU);
  h.game.startGame({ seed: 'WI05', skipConfirm: true, skipIntro: true });

  assert.equal(h.game.state, gameStates.GAME_STATES.SYSTEM_MESSAGE);
  assert.equal(h.game.systemMessageReturnState, gameStates.GAME_STATES.PLAYING);
  assert.equal(h.game.systemMessages.activeId, 'boot-inventory');
  assert.equal(
    h.game.systemMessages.entries.find((/** @type {any} */ entry) => entry.id === 'boot-inventory').state,
    'delivered'
  );
  assert.equal(h.game.runSeed, 'WI05');
  assert.deepEqual(h.loadedFloors, [{ floor: 1, skipAutoSave: true }]);
  assert.deepEqual(h.audioCalls.filter((call) => call[0] === 'resume'), [['resume']]);
});

test('pause and resume preserve pause flags and music side effects', () => {
  const h = createHarness();
  h.game.setState(gameStates.GAME_STATES.PLAYING);

  h.game.wasAutoPaused = true;
  h.game.setState(gameStates.GAME_STATES.PAUSED);
  assert.equal(h.game.state, gameStates.GAME_STATES.PAUSED);
  assert.equal(h.game._pauseSel, -1);
  assert.ok(h.musicCalls.some((call) => call[0] === 'pause'));

  h.game.setState(gameStates.GAME_STATES.PLAYING);
  assert.equal(h.game.state, gameStates.GAME_STATES.PLAYING);
  assert.equal(h.game.wasAutoPaused, false);
  assert.ok(h.musicCalls.some((call) => call[0] === 'resume'));
});

test('save and continue preserve persistence-facing choice state', () => {
  const h = createHarness();
  h.game.startGame({ seed: 'SAVE-SEED', skipConfirm: true, skipIntro: true });
  h.game.floor = 7;
  h.game.difficulty = 'HARD';
  h.game.runTime = 33;
  h.game.player.score = 777;
  h.game.weaponSwapChoice = {
    weapon: { _base: 'RAILGUN', _affixes: ['MARK'] },
    selected: 1,
  };
  h.game.setState(gameStates.GAME_STATES.WEAPON_SWAP);

  h.game.saveGame();
  const saved = JSON.parse(h.store.get('neonDungeonSave') || '{}');
  assert.equal(saved.floor, 7);
  assert.equal(saved.difficulty, 'HARD');
  assert.deepEqual(saved.weaponSwapChoice, {
    weapon: { _base: 'RAILGUN', _affixes: ['MARK'] },
    selected: 1,
  });

  h.game.setState(gameStates.GAME_STATES.MENU);
  h.game.player = null;
  h.game.weaponSwapChoice = null;
  h.game.continueGame();

  assert.equal(h.game.state, gameStates.GAME_STATES.WEAPON_SWAP);
  assert.equal(h.game.floor, 7);
  assert.equal(h.game.player.score, 777);
  assert.equal(h.game.runSeed, 'SAVE-SEED');
  assert.deepEqual(h.loadedFloors.at(-1), { floor: 7, skipAutoSave: true });
});

test('floor descent enters the production hub before fading to the next floor', () => {
  const h = createHarness();
  h.game.startGame({ seed: 'DESCEND', skipConfirm: true, skipIntro: true });
  h.game.setState(gameStates.GAME_STATES.PLAYING);
  h.game.floor = 2;
  h.game.player.x = 9;
  h.game.player.y = 10;
  h.game.player.hp = 8;
  h.game.player.score = 100;

  h.game.descend();

  assert.equal(h.game.state, gameStates.GAME_STATES.HUB);
  assert.equal(h.game.hub.fromFloor, 2);
  assert.equal(h.game.hub.nextFloor, 3);
  assert.equal(h.game.hub.biomeName, 'TEST AREA');
  assert.deepEqual(
    Array.from(h.game.hub.terminals, (/** @type {any} */ terminal) => terminal.id),
    ['upgrade', 'modules', 'armory', 'archive']
  );
  assert.equal(h.game._exitPos.x, 9);
  assert.equal(h.game._exitPos.y, 10);
  assert.equal(h.game.player.score, 1180);
  assert.ok(h.audioCalls.some((call) => call[0] === 'hubAmbient'));

  h.neon.hub.exitHub(h.game);
  assert.equal(h.game.state, gameStates.GAME_STATES.FADE);
  assert.equal(h.game.transitionText, 'DESCENDING TO FLOOR 3');
  assert.equal(h.game.fadeNextState, gameStates.GAME_STATES.PLAYING);
  h.game.updateFade(0.4);
  assert.deepEqual(h.loadedFloors.at(-1), { floor: 3, skipAutoSave: false });
  h.game.updateFade(0.15);
  h.game.updateFade(0.4);
  assert.equal(h.game.state, gameStates.GAME_STATES.PLAYING);
});

test('final-floor descent routes through the victory end state', () => {
  const h = createHarness();
  h.game.startGame({ seed: 'VICTORY', skipConfirm: true, skipIntro: true });
  h.game.setState(gameStates.GAME_STATES.PLAYING);
  h.game.floor = 15;
  h.game.player.hp = 5;
  h.game.player.score = 10;
  h.store.set('neonDungeonScores', JSON.stringify(
    Array.from({ length: 10 }, (_value, index) => ({ name: 'CPU', score: 100000 - index }))
  ));

  h.game.descend();

  assert.equal(h.game.lastRunRecap.victory, true);
  assert.equal(h.game.state, gameStates.GAME_STATES.VICTORY);
  assert.equal(h.game.player.score, 7560);
  assert.ok(h.audioCalls.some((call) => call[0] === 'victory'));
  assert.ok(h.musicCalls.some((call) => call[0] === 'stop'));
});

test('setState rejects states outside the canonical vocabulary', () => {
  const h = createHarness();

  assert.throws(
    () => h.game.setState('NOT_A_STATE'),
    /Unknown game state "NOT_A_STATE"/
  );
  assert.equal(h.game.state, gameStates.GAME_STATES.MENU);
});
