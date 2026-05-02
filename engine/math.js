// @ts-check
'use strict';
// engine/math.js — pure math + RNG primitives, zero game state.
//
// Engine layer (🟦): no NEON DUNGEON nouns, no DOM, no globals beyond UMD mount.
// Most functions are referentially transparent. RNG helpers can run either from
// Math.random() (legacy/default) or from a seeded run state initialised by the
// host. The module is still engine-generic: seeds and stream names are opaque.
//
// Surface:
//   rand(stream?)            → uniform float in [0, 1)
//   rnd(min, max)            → uniform float in [min, max)
//   rndInt(min, max)         → uniform int in [min, max] inclusive
//   chance(p, stream?)       → true with probability p
//   pick(arr, stream?)       → random array element or undefined
//   shuffleInPlace(arr, stream?) → Fisher-Yates shuffle
//   normalizeSeed(input)     → stable non-empty seed string
//   makeRandomSeed()         → human-friendly random seed
//   createRng(seed, stream, state?) → standalone seeded PRNG
//   setSeed(seed, states?)   → initialise active run RNG streams
//   clearSeed()              → restore unseeded legacy mode
//   getSeed()                → current normalized seed or null
//   getSeedHash()            → numeric hash of current seed or 0
//   snapshotStates()         → serializable active persistent stream states
//   restoreStates(states)    → restore active persistent stream states
//   withRngStream(name, fn)  → run fn using persistent stream name
//   withDerivedRngStream(name, fn) → run fn using temporary derived stream
//   clamp(v, lo, hi)         → v constrained to [lo, hi]
//   dist(ax, ay, bx, by)     → euclidean distance
//   dist2(ax, ay, bx, by)    → squared distance (cheap; preferred for compares)
//   norm(dx, dy)             → [nx, ny] unit vector; (0,0) → (0,0)
//   lerp(a, b, t)            → linear interp; no clamping of t
//
// Browser: attaches as `window.NEON.math` AND mounts each function as a bare
// global (rand/rnd/rndInt/etc.) for back-compat with the
// existing UMD script-tag callers in src/*.js. Must load BEFORE src/platform.js.
//
// Node: module.exports = the same surface.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const ns = /** @type {any} */ (r.NEON = r.NEON || {});
  ns.math = v;
  // Bare globals for back-compat with existing call sites.
  r.rand = v.rand;
  r.rnd = v.rnd;
  r.rndInt = v.rndInt;
  r.randChance = v.chance;
  r.randPick = v.pick;
  r.shuffleInPlace = v.shuffleInPlace;
  r.normalizeSeed = v.normalizeSeed;
  r.makeRandomSeed = v.makeRandomSeed;
  r.createRng = v.createRng;
  r.setSeed = v.setSeed;
  r.clearSeed = v.clearSeed;
  r.getSeed = v.getSeed;
  r.getSeedHash = v.getSeedHash;
  r.snapshotRngStates = v.snapshotStates;
  r.restoreRngStates = v.restoreStates;
  r.withRngStream = v.withRngStream;
  r.withDerivedRngStream = v.withDerivedRngStream;
  r.clamp = v.clamp;
  r.dist = v.dist;
  r.dist2 = v.dist2;
  r.norm = v.norm;
  r.lerp = v.lerp;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  const DEFAULT_STREAM = 'gameplay';
  const MAX_SEED_LEN = 64;
  /** @type {string|null} */
  let _activeSeed = null;
  let _activeSeedHash = 0;
  /** @type {Record<string, any>} */
  let _streams = Object.create(null);
  /** @type {any[]} */
  const _streamStack = [DEFAULT_STREAM];

  /** @param {any} input */
  function normalizeSeed(input) {
    let s = String(input == null ? '' : input).trim();
    s = s.replace(/\s+/g, ' ');
    if (!s) s = 'NEON-' + Date.now().toString(36).toUpperCase();
    if (s.length > MAX_SEED_LEN) s = s.slice(0, MAX_SEED_LEN);
    return s;
  }

  /** @param {string} s */
  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h += h << 13; h >>>= 0;
    h ^= h >>> 7;
    h += h << 3; h >>>= 0;
    h ^= h >>> 17;
    h += h << 5; h >>>= 0;
    return h >>> 0;
  }

  /** @param {string} seed @param {string} stream */
  function deriveState(seed, stream) {
    const h = hashString(seed + '\u001f' + stream);
    return (h || 0x9e3779b9) >>> 0;
  }

  /** @param {any} seed @param {string} [stream] @param {number} [state] */
  function createRng(seed, stream, state) {
    const normalizedSeed = normalizeSeed(seed);
    const streamName = String(stream || DEFAULT_STREAM);
    let s = (state == null ? deriveState(normalizedSeed, streamName) : Number(state)) >>> 0;
    if (s === 0) s = 0x9e3779b9;
    return {
      seed: normalizedSeed,
      stream: streamName,
      next() {
        s |= 0;
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      /** @param {number} min @param {number} max */
      rnd(min, max) { return min + this.next() * (max - min); },
      /** @param {number} min @param {number} max */
      int(min, max) { return Math.floor(this.rnd(min, max + 1)); },
      state() { return s >>> 0; },
      /** @param {number} nextState */
      setState(nextState) {
        s = Number(nextState) >>> 0;
        if (s === 0) s = 0x9e3779b9;
      }
    };
  }

  function currentStreamName() {
    return String(_streamStack[_streamStack.length - 1] || DEFAULT_STREAM);
  }

  /** @param {string} name */
  function stream(name) {
    if (!_activeSeed) return null;
    const key = String(name || DEFAULT_STREAM);
    const current = currentStreamName();
    if (current.indexOf('__derived__:' + key + ':') === 0 && _streams[current]) {
      return _streams[current];
    }
    if (!_streams[key]) _streams[key] = createRng(_activeSeed, key);
    return _streams[key];
  }

  /** @param {string} name */
  function makeRandomSeed(name) {
    void name;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 12; i++) {
      if (i === 4 || i === 8) out += '-';
      out += alphabet[Math.floor(Math.random() * alphabet.length)] || 'X';
    }
    return out;
  }

  /** @param {any} seed @param {Record<string, number>} [states] */
  function setSeed(seed, states) {
    _activeSeed = normalizeSeed(seed);
    _activeSeedHash = hashString(_activeSeed);
    _streams = Object.create(null);
    if (states && typeof states === 'object') restoreStates(states);
    return { seed: _activeSeed, hash: _activeSeedHash };
  }

  function clearSeed() {
    _activeSeed = null;
    _activeSeedHash = 0;
    _streams = Object.create(null);
    _streamStack.length = 1;
    _streamStack[0] = DEFAULT_STREAM;
  }

  function getSeed() { return _activeSeed; }
  function getSeedHash() { return _activeSeedHash >>> 0; }

  function snapshotStates() {
    /** @type {Record<string, number>} */
    const out = {};
    for (const key of Object.keys(_streams)) {
      if (key === 'cosmetic') continue;
      out[key] = _streams[key].state();
    }
    return out;
  }

  /** @param {Record<string, number>} states */
  function restoreStates(states) {
    if (!_activeSeed || !states || typeof states !== 'object') return;
    for (const key of Object.keys(states)) {
      _streams[key] = createRng(_activeSeed, key, states[key]);
    }
  }

  /** @param {string} name @param {Function} fn */
  function withRngStream(name, fn) {
    _streamStack.push(String(name || DEFAULT_STREAM));
    try { return fn(); }
    finally { _streamStack.pop(); }
  }

  /** @param {string} name @param {Function} fn */
  function withDerivedRngStream(name, fn) {
    if (!_activeSeed) return withRngStream(name, fn);
    const key = '__derived__:' + String(name || DEFAULT_STREAM) + ':' + _streamStack.length;
    const prev = _streams[key];
    _streams[key] = createRng(_activeSeed, String(name || DEFAULT_STREAM));
    _streamStack.push(key);
    try { return fn(); }
    finally {
      _streamStack.pop();
      if (prev) _streams[key] = prev;
      else delete _streams[key];
    }
  }

  /** @param {string} [streamName] */
  function rand(streamName) {
    const r = stream(streamName || currentStreamName());
    return r ? r.next() : Math.random();
  }

  /** @param {number} min @param {number} max @param {string} [streamName] */
  function rnd(min, max, streamName) { return min + rand(streamName) * (max - min); }

  /** @param {number} min @param {number} max @param {string} [streamName] */
  function rndInt(min, max, streamName) { return Math.floor(rnd(min, max + 1, streamName)); }

  /** @param {number} p @param {string} [streamName] */
  function chance(p, streamName) {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return rand(streamName) < p;
  }

  /** @param {any[]} arr @param {string} [streamName] */
  function pick(arr, streamName) {
    if (!arr || !arr.length) return undefined;
    return arr[rndInt(0, arr.length - 1, streamName)];
  }

  /** @param {any[]} arr @param {string} [streamName] */
  function shuffleInPlace(arr, streamName) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rndInt(0, i, streamName);
      const a = arr[i];
      arr[i] = arr[j];
      arr[j] = a;
    }
    return arr;
  }

  /** @param {number} v @param {number} lo @param {number} hi */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /** @param {number} ax @param {number} ay @param {number} bx @param {number} by */
  function dist(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** @param {number} ax @param {number} ay @param {number} bx @param {number} by */
  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  /** @param {number} dx @param {number} dy @returns {[number, number]} */
  function norm(dx, dy) {
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    return [dx / l, dy / l];
  }

  /** @param {number} a @param {number} b @param {number} t */
  function lerp(a, b, t) { return a + (b - a) * t; }

  return {
    rand, rnd, rndInt, chance, pick, shuffleInPlace,
    normalizeSeed, makeRandomSeed, createRng,
    setSeed, clearSeed, getSeed, getSeedHash, snapshotStates, restoreStates,
    withRngStream, withDerivedRngStream,
    clamp, dist, dist2, norm, lerp
  };
}));
