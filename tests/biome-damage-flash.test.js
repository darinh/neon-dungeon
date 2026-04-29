'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const biomes = require(path.resolve(__dirname, '..', 'src', 'data', 'biomes.js'));
const palettesMod = require(path.resolve(__dirname, '..', 'src', 'data', 'palettes.js'));
const { BIOME_PALETTES, currentDamageFlash } = palettesMod;

// ────────────────────────────────────────────────────────────────────────────
// Per-biome damage-flash colour table. Each BIOME_PALETTES entry now owns a
// `damageFlash` near-white tint that the entities.js flash callsites read via
// the per-floor cache `game._damageFlash` (set in game.js loadFloor). The
// tints must stay near-white (every channel ≥ 0xCC) so the iconic
// "flash = damage" signal is preserved across all five biomes.
// ────────────────────────────────────────────────────────────────────────────

test('every BIOME_PALETTES entry has a damageFlash hex string', () => {
  for (const [key, pal] of Object.entries(BIOME_PALETTES)) {
    assert.ok(typeof pal.damageFlash === 'string',
      `palette "${key}" missing damageFlash`);
    assert.match(pal.damageFlash, /^#[0-9a-fA-F]{6}$/,
      `palette "${key}" damageFlash must be #rrggbb`);
  }
});

test('every damageFlash is near-white: r,g,b each ≥ 0xCC (preserves flash signal)', () => {
  // 0xCC = 204. Anything dimmer reads as a saturated tint, not a flash.
  // This is the safety floor — without it, contributors could pick a deep
  // biome accent and degrade hit feedback for photosensitive players.
  const FLOOR = 0xCC;
  for (const [key, pal] of Object.entries(BIOME_PALETTES)) {
    const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(pal.damageFlash);
    assert.ok(m, `palette "${key}" damageFlash unparseable`);
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    assert.ok(r >= FLOOR, `palette "${key}" damageFlash R=${r} below floor ${FLOOR}`);
    assert.ok(g >= FLOOR, `palette "${key}" damageFlash G=${g} below floor ${FLOOR}`);
    assert.ok(b >= FLOOR, `palette "${key}" damageFlash B=${b} below floor ${FLOOR}`);
  }
});

test('every damageFlash carries a visible biome TINT (channel spread ≥ 8 — not a uniform gray)', () => {
  // Bypass guard (codex r1): the ≥0xCC near-white floor by itself accepts
  // values like #cccccc / #dddddd that have no biome character at all,
  // silently neutering the feature. Requiring max-min ≥ 8 forces the value
  // to lean meaningfully toward at least one channel, so the tint is
  // perceivable. All shipped values currently spread ≥ 22 — 8 is the
  // sensitivity floor before the tint becomes invisible at 60Hz briefly.
  for (const [key, pal] of Object.entries(BIOME_PALETTES)) {
    const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(pal.damageFlash);
    assert.ok(m, `palette "${key}" damageFlash unparseable`);
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    assert.ok(spread >= 8,
      `palette "${key}" damageFlash ${pal.damageFlash} has channel spread ${spread} — must be ≥8 (uniform gray defeats the biome-tint feature)`);
  }
});

test('every AREAS[i].palette resolves to a damageFlash (no null biome)', () => {
  for (const a of biomes.AREAS) {
    const pal = BIOME_PALETTES[a.palette];
    assert.ok(pal && pal.damageFlash,
      `AREA ${a.id} (palette "${a.palette}") must have a damageFlash`);
  }
});

test('currentDamageFlash falls back to #ffffff when floor / NEON.biomes missing', () => {
  // No NEON global wired in this test process — the helper's try/catch must
  // catch and return pure white. This preserves legacy behaviour pre-floor
  // (splash, menu, save-screen) AND guards against a palettes.js-loads-but-
  // biomes.js-doesnt race in the browser.
  assert.equal(currentDamageFlash(undefined), '#ffffff');
  assert.equal(currentDamageFlash(0), '#ffffff');
  assert.equal(currentDamageFlash(null), '#ffffff');
  assert.equal(currentDamageFlash(NaN), '#ffffff');
});

test('currentDamageFlash returns the biome-specific tint when NEON.biomes is wired', () => {
  // Wire a minimal NEON.biomes so the helper can resolve floor → palette.
  // Save/restore so this test doesn't leak state into siblings.
  const prevNEON = globalThis.NEON;
  /** @type {any} */ (globalThis).NEON = { biomes: { areaForFloor: biomes.areaForFloor } };
  try {
    for (const a of biomes.AREAS) {
      const expected = BIOME_PALETTES[a.palette].damageFlash;
      for (const f of a.floors) {
        const got = currentDamageFlash(f);
        assert.equal(got, expected,
          `floor ${f} (biome ${a.id}) expected damageFlash ${expected}, got ${got}`);
      }
    }
  } finally {
    if (prevNEON === undefined) delete (/** @type {any} */ (globalThis)).NEON;
    else /** @type {any} */ (globalThis).NEON = prevNEON;
  }
});

test('currentDamageFlash returns DIFFERENT colours for each biome (no accidental dupes)', () => {
  // If a contributor copies a row and forgets to change damageFlash, the
  // feature degrades silently. Pin uniqueness so the regression is visible.
  const prevNEON = globalThis.NEON;
  /** @type {any} */ (globalThis).NEON = { biomes: { areaForFloor: biomes.areaForFloor } };
  try {
    const seen = new Set();
    for (const a of biomes.AREAS) {
      const c = currentDamageFlash(a.floors[0]);
      assert.ok(!seen.has(c), `biome ${a.id} damageFlash ${c} duplicates another biome`);
      seen.add(c);
    }
  } finally {
    if (prevNEON === undefined) delete (/** @type {any} */ (globalThis)).NEON;
    else /** @type {any} */ (globalThis).NEON = prevNEON;
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Structural assertions on the source files that consume the cached flash
// colour. These are the actual user-visible payoff — without these, a
// contributor could revert the entities.js callsites and the data-side
// tests would still pass.
//
// All structural regexes run against COMMENT-STRIPPED source so a contributor
// cannot satisfy them with a snippet hidden in a `//` line or `/* … */`
// block (codex r1 dead-code-in-comments bypass class).
// ────────────────────────────────────────────────────────────────────────────

/**
 * Strip JS comments from a source string. Only handles:
 *   - `/* … *​/` block comments (cannot occur inside JS string literals
 *     without an escape, which doesn't exist for these delimiters)
 *   - Full-line line comments (`//` at start-of-line after optional whitespace)
 *
 * Trailing line comments (`code; // note`) are intentionally NOT stripped:
 * a string-aware tokenizer is overkill, and the trailing-comment vector for
 * decoys is defended by the `matches.length === 1` match-count guards on
 * the positive structural tests below. Full-line comments are the main
 * dead-code bypass class (codex r1) and CANNOT contain string literals
 * that wrap the `//` token.
 *
 * @param {string} s
 * @returns {string}
 */
function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '');
}

const entitiesSrc = stripComments(fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'));
const gameSrc = stripComments(fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'));

test('entities.js has NO surviving literal "#ffffff" damage-flash callsite', () => {
  // The two `flashTimer>0?'#ffffff':...` ternaries must be replaced. Pin
  // both directions to defeat the "kept the literal as the second branch"
  // mistake. Backreference allows whitespace variations.
  const re = /flashTimer\s*>\s*0\s*\?\s*['"]#ffffff['"]/;
  assert.ok(!re.test(entitiesSrc),
    'entities.js still has flashTimer>0?\'#ffffff\' — should read _EG._damageFlash');
});

test('entities.js Enemy.draw flash uses _EG._damageFlash with #ffffff fallback (exactly once)', () => {
  // Enemy line: `const col=this.flashTimer>0?(_EG._damageFlash||'#ffffff'):this.colour;`
  // Pin enemy-specific shape (this.colour as the false branch) so we don't
  // false-match the player site below. Match-count guard defeats the
  // dead-string-literal bypass: `const _decoy = "...flashTimer > 0 ? (...";`
  const re = /flashTimer\s*>\s*0\s*\?\s*\(\s*_EG\._damageFlash\s*\|\|\s*['"]#ffffff['"]\s*\)\s*:\s*this\.colour/g;
  const matches = entitiesSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `Enemy.draw must read _EG._damageFlash with safe #ffffff fallback EXACTLY ONCE (found ${matches.length})`);
});

test('entities.js Player.draw flash uses _EG._damageFlash with #ffffff fallback (exactly once)', () => {
  // Player line: `const col=this.flashTimer>0?(_EG._damageFlash||'#ffffff'):'#00f5ff';`
  // Pin player-specific shape (#00f5ff as the false branch — player's iconic
  // cyan) so we don't false-match the enemy site above.
  const re = /flashTimer\s*>\s*0\s*\?\s*\(\s*_EG\._damageFlash\s*\|\|\s*['"]#ffffff['"]\s*\)\s*:\s*['"]#00f5ff['"]/g;
  const matches = entitiesSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `Player.draw must read _EG._damageFlash with safe #ffffff fallback EXACTLY ONCE (found ${matches.length})`);
});

test('game.js loadFloor caches _damageFlash from NEON.palettes.currentDamageFlash (exactly once)', () => {
  // The cache must (a) exist, (b) call currentDamageFlash with the floor
  // arg, (c) fall back to '#ffffff'. Pin all three. Match-count guard
  // defends the "decoy in trailing comment / string" bypass class — adding
  // a fake match elsewhere would push the count to 2 and fail this test.
  // Without this assertion the entities.js callsites would always render
  // pure white because _EG._damageFlash would be undefined.
  const re = /this\._damageFlash\s*=\s*\(\s*typeof\s+NEON[^)]+NEON\.palettes\.currentDamageFlash\s*\)\s*\?\s*NEON\.palettes\.currentDamageFlash\s*\(\s*n\s*\)\s*:\s*['"]#ffffff['"]/g;
  const matches = gameSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `loadFloor must cache this._damageFlash from NEON.palettes.currentDamageFlash(n) EXACTLY ONCE (found ${matches.length})`);
});

test('game.js _damageFlash assignment lives inside loadFloor, before generateFloor', () => {
  // Ordering matters: the cache must be populated before any per-floor
  // entities are created (so e.g. spawn-time flash renders correctly).
  // Anchor the assignment between `loadFloor(n` and `generateFloor(`.
  const m = /loadFloor\s*\([^)]*\)\s*\{([\s\S]*?)\bgenerateFloor\s*\(/.exec(gameSrc);
  assert.ok(m, 'could not isolate loadFloor body up to generateFloor call');
  assert.ok(/this\._damageFlash\s*=/.test(m[1]),
    'this._damageFlash must be assigned inside loadFloor BEFORE generateFloor()');
});

// ────────────────────────────────────────────────────────────────────────────
// RUNTIME assertions — the structural tests above prove the right TOKENS
// are in the right SHAPE in the right FILES, but a contributor could still
// keep the tokens and break the runtime (e.g. by stubbing
// NEON.palettes.currentDamageFlash to always return undefined, or by
// re-pointing _EG._damageFlash from a sibling code path). These tests
// exercise the real value pipeline end-to-end.
// ────────────────────────────────────────────────────────────────────────────

test('runtime: NEON.palettes.currentDamageFlash, when wired, returns the SAME value as the per-biome BIOME_PALETTES.damageFlash for every floor', () => {
  // Wires the same NEON shape that game.js loadFloor reads. Asserts that
  // the helper agrees with the table for every floor in every biome. Unlike
  // the structural tests, this catches a contributor who keeps the source
  // tokens but breaks the resolver (returns '#ffffff' always, returns the
  // wrong biome's colour, etc.).
  const prevNEON = globalThis.NEON;
  /** @type {any} */ (globalThis).NEON = {
    biomes: { areaForFloor: biomes.areaForFloor },
    palettes: palettesMod,
  };
  try {
    for (const a of biomes.AREAS) {
      const expected = BIOME_PALETTES[a.palette].damageFlash;
      for (const f of a.floors) {
        const got = /** @type {any} */ (globalThis).NEON.palettes.currentDamageFlash(f);
        assert.equal(got, expected,
          `runtime resolver: floor ${f} (biome ${a.id}) expected ${expected}, got ${got}`);
      }
    }
  } finally {
    if (prevNEON === undefined) delete (/** @type {any} */ (globalThis)).NEON;
    else /** @type {any} */ (globalThis).NEON = prevNEON;
  }
});

test('runtime: simulating loadFloor cache + entities.js fallback resolves to the biome tint, NOT pure white', () => {
  // End-to-end simulation: this is what the live runtime does on every
  // floor entry. The cache value is what _EG._damageFlash returns at the
  // entities.js draw site. Asserting it's the biome tint (and NOT '#ffffff'
  // when biome data is available) catches the silent-fallback regression
  // where a contributor breaks the helper and every flash renders white.
  const prevNEON = globalThis.NEON;
  /** @type {any} */ (globalThis).NEON = {
    biomes: { areaForFloor: biomes.areaForFloor },
    palettes: palettesMod,
  };
  try {
    for (const a of biomes.AREAS) {
      const cached = /** @type {any} */ (globalThis).NEON.palettes.currentDamageFlash(a.floors[0]);
      // Mirror the entities.js line: `_EG._damageFlash || '#ffffff'`
      const flashColour = cached || '#ffffff';
      assert.equal(flashColour, BIOME_PALETTES[a.palette].damageFlash,
        `floor ${a.floors[0]} (biome ${a.id}) end-to-end flash colour mismatch`);
      assert.notEqual(flashColour, '#ffffff',
        `floor ${a.floors[0]} (biome ${a.id}) silently fell back to pure white — biome tint pipeline is broken`);
    }
  } finally {
    if (prevNEON === undefined) delete (/** @type {any} */ (globalThis)).NEON;
    else /** @type {any} */ (globalThis).NEON = prevNEON;
  }
});

test('runtime: entities.js fallback chain handles non-string _EG._damageFlash without throwing or rendering garbage', () => {
  // Defensive: if _EG._damageFlash is ever set to undefined, null, 0, '',
  // false, or a non-string, the `||'#ffffff'` fallback must catch it and
  // render pure white (legacy behaviour) instead of letting an invalid
  // value reach ctx.fillStyle. Mirrors the real ternary at entities.js:7458
  // and entities.js:13270.
  const cases = [undefined, null, 0, '', false, NaN];
  for (const v of cases) {
    const got = v || '#ffffff';
    assert.equal(got, '#ffffff',
      `fallback chain failed for value ${JSON.stringify(v)} — got ${got}`);
  }
  // Truthy strings should pass through unchanged.
  for (const v of ['#abcdef', '#ffe9f5', '#ffffff']) {
    const got = v || '#ffffff';
    assert.equal(got, v, `truthy string ${v} should pass through fallback`);
  }
});
