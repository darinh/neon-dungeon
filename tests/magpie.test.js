'use strict';
// MAGPIE mob — wiring tests.
//
// MAGPIE is a fast, fragile, NON-DAMAGING loot-thief that races to
// dropped Items, banks their credit value, and tries to flee while
// carrying. On death it drops a MagpieHoard pickup that refunds the
// banked value as credits.
//
// AI / draw / spawn wiring is asserted via source-text regex
// (entities.js + content.js are browser-only — no UMD/CommonJS exports
// — same pattern as sapper.test.js / spectre.test.js etc).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('MAGPIE appears in ENEMY_WEIGHTS with floor 4+ gate', () => {
  // Floor 4 matches HARVESTER's introduction — the first floor where
  // dropped supplies are abundant enough that a thief feels like a
  // mid-floor pressure rather than a placeholder mob.
  const m = ENTITIES.match(/MAGPIE:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'MAGPIE must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 4,
    `MAGPIE minFloor should be >= 4 (after item drops are abundant), got ${m[1]}`);
});

test('MAGPIE has a stat row in spawnEnemy switch', () => {
  // Missing case → spawnEnemy returns an Enemy with hp=0, instantly dead.
  const m = ENTITIES.match(/case\s+'MAGPIE':[^\n]*hp\s*=\s*(\d+)[^\n]*atk\s*=\s*(\d+)[^\n]*spd\s*=\s*([\d.]+)[^\n]*xpVal\s*=\s*(\d+)/);
  assert.ok(m, 'MAGPIE stat row missing');
  // Fragile: must die in ~1 burst from a mid-floor weapon. Anchor an
  // upper bound so the design intent ("kill before grab") can't
  // silently regress to a tank.
  const hp = parseInt(m[1], 10);
  assert.ok(hp > 0 && hp <= 40, `MAGPIE hp should be in (0,40], got ${hp}`);
  // MUST be non-damaging — atk === 0. The thief identity collapses if
  // it can also hurt the player on contact.
  assert.strictEqual(parseInt(m[2], 10), 0,
    'MAGPIE must have atk === 0 (no contact damage — pure thief)');
  // Must be fast. Slower than CRAWLER (4) but faster than the player
  // base (~3). Anchor a lower bound so the mob can plausibly beat the
  // player to a nearby drop.
  assert.ok(parseFloat(m[3]) >= 3.0, `MAGPIE spd should be >= 3.0, got ${m[3]}`);
});

test('MAGPIE init block sets _mgScanT, _mgTarget, _mgStolenCr', () => {
  // Without these fields aiMagpie hits `undefined` on first frame and
  // either no-ops silently (best case) or throws (worst case).
  const block = ENTITIES.match(/if\s*\(type\s*===\s*'MAGPIE'\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(block, 'MAGPIE init block missing');
  assert.match(block[0], /_mgScanT\s*=/, 'MAGPIE must initialise _mgScanT');
  assert.match(block[0], /_mgTarget\s*=\s*null/, 'MAGPIE must initialise _mgTarget = null');
  assert.match(block[0], /_mgStolenCr\s*=\s*0/, 'MAGPIE must initialise _mgStolenCr = 0');
  // Stagger initial scan so a clustered spawn doesn't all scan in
  // lock-step (cosmetic + perf — same pattern as _saPulse / _mgPulse).
  assert.match(block[0], /rand\('spawn'\)/,
    'MAGPIE init must stagger _mgScanT with the seeded spawn RNG');
});

test('MAGPIE is excluded from the elite affix roll', () => {
  // First-ship caution: keeps the new non-damaging mechanic off the
  // elite surface area. Mirror the existing exclusion pattern for
  // recently-introduced mobs.
  const re = /allowElite[\s\S]{0,1300}type\s*!==\s*'MAGPIE'/;
  assert.match(ENTITIES, re, 'MAGPIE must be in the elite-exclusion guard');
});

test('MAGPIE has CREDIT_VALUES entry', () => {
  // Without an entry, die() falls back to 5 credits — explicit entry
  // keeps reward tuning intentional. MAGPIE itself awards little
  // (4) since the real reward is the recovered hoard.
  const m = ENTITIES.match(/MAGPIE\s*:\s*(\d+)/);
  assert.ok(m, 'MAGPIE must have CREDIT_VALUES entry');
  assert.ok(parseInt(m[1], 10) <= 8,
    `MAGPIE should give modest base credits (<=8) since the hoard is the real reward, got ${m[1]}`);
});

test('MAGPIE has SOURCE_LABELS entry', () => {
  assert.match(ENTITIES, /MAGPIE\s*:\s*'Magpie'/);
});

test('MAGPIE has SOURCE_COLOURS entry', () => {
  assert.match(ENTITIES, /MAGPIE\s*:\s*'#[0-9a-fA-F]{3,6}'/);
});

test('MAGPIE has AI dispatch case', () => {
  assert.match(ENTITIES, /case\s+'MAGPIE'\s*:\s*this\.aiMagpie\(/);
});

test('MAGPIE aiMagpie method exists with correct contract', () => {
  // Anchor on the method definition (no `this.` prefix and starts at
  // column 2) so we don't accidentally match the dispatch switch case.
  const fn = ENTITIES.match(/\n  aiMagpie\s*\([\s\S]*?\n  \}\n/);
  assert.ok(fn, 'aiMagpie method must exist');
  // Must use moveToward with raw this.spd so the modSpeed / berserker
  // / slowFactor modifiers apply internally — never pre-multiply.
  // Class-of-bug caught on the VENGEANCE PR (moveToward modifiers).
  assert.match(fn[0], /moveToward\s*\([\s\S]*?,\s*this\.spd/,
    'aiMagpie chase must call moveToward with raw this.spd');
  // Must filter out keys, harvest, and whisper pickups so it doesn't
  // steal progression-critical or story content. Hoards too — to
  // prevent a second MAGPIE infinite-looping a sibling's drop.
  assert.match(fn[0], /isKey/,    'aiMagpie scan must filter out keys');
  assert.match(fn[0], /isHarvest/,'aiMagpie scan must filter out harvest pickups');
  assert.match(fn[0], /isWhisper/,'aiMagpie scan must filter out whisper pickups');
  assert.match(fn[0], /isHoard/,  'aiMagpie scan must filter out existing hoards');
  // Must mark the consumed item as dead so game.js's items prune
  // splices it out — splicing here would corrupt iteration if
  // multiple MAGPIEs target items in the same frame.
  assert.match(fn[0], /\.dead\s*=\s*true/,
    'aiMagpie grab must set target.dead = true (so prune splices it)');
  // Must increment banked value when grabbing.
  assert.match(fn[0], /_mgStolenCr/,
    'aiMagpie grab must update _mgStolenCr');
});

test('MAGPIE die() drop branch pushes MagpieHoard with banked value', () => {
  // The thief's whole identity is "kill it to get your stuff back" —
  // without the hoard drop the player has no way to recover stolen
  // value, which would feel like the mob is just punitive.
  const dieFn = ENTITIES.match(/\n  die\(\)\s*\{[\s\S]*?\n  \}\n/);
  assert.ok(dieFn, 'die() method not found');
  assert.match(dieFn[0],
    /this\.type\s*===\s*'MAGPIE'[\s\S]{0,300}MagpieHoard/,
    'die() must spawn a MagpieHoard for MAGPIE when _mgStolenCr > 0');
  assert.match(dieFn[0],
    /_mgStolenCr/,
    'MAGPIE die() branch must read _mgStolenCr before dropping the hoard');
});

test('MAGPIE draw branch exists and consumes _mgStolenCr', () => {
  // The carry pip overlay (gold square inside the diamond) is the
  // player's only at-a-glance signal that a specific MAGPIE is
  // carrying loot vs idle — without it the player can't prioritise
  // which thief to kill first when multiple are on screen.
  const re = /t\s*===\s*'MAGPIE'[\s\S]{0,1200}_mgStolenCr/;
  assert.match(ENTITIES, re,
    'MAGPIE draw branch must consume _mgStolenCr to render the carry-pip overlay');
});

test('MAGPIE tuning constants are defined', () => {
  assert.match(ENTITIES, /const\s+MAGPIE_SCAN_RANGE\s*=\s*\d+/);
  assert.match(ENTITIES, /const\s+MAGPIE_SCAN_PERIOD\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+MAGPIE_GRAB_RANGE\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+MAGPIE_FLEE_RANGE\s*=\s*\d+/);
  assert.match(ENTITIES, /const\s+MAGPIE_STOLEN_BASE\s*=\s*\d+/);
  assert.match(ENTITIES, /const\s+MAGPIE_STOLEN_PERFL\s*=\s*\d+/);
});

// ─── MagpieHoard pickup wiring ─────────────────────────────────────────

test('MagpieHoard class exists in src/content.js with isHoard flag', () => {
  // The pickup loop in game.js distinguishes pickup types by
  // boolean flags (.isKey / .isHarvest / .isWhisper / .isHoard).
  // Without isHoard the hoard would fall through to the generic
  // upgrade-roll path which ignores .amt and rolls a new option —
  // so the player would never get the banked credits back.
  assert.match(CONTENT, /class\s+MagpieHoard\s*\{/, 'MagpieHoard class must exist');
  const cls = CONTENT.match(/class\s+MagpieHoard\s*\{[\s\S]*?\n\}/);
  assert.ok(cls, 'MagpieHoard class block not extractable');
  assert.match(cls[0], /this\.isHoard\s*=\s*true/,
    'MagpieHoard must set isHoard = true');
  assert.match(cls[0], /this\.amt\s*=/,
    'MagpieHoard must persist amt for the pickup branch to read');
  assert.match(cls[0], /this\.dead\s*=\s*false/,
    'MagpieHoard must initialise dead = false');
});

test('MagpieHoard.amt is sanitised against negative / NaN inputs', () => {
  // Defensive: die() reads _mgStolenCr which is always >= 0 today,
  // but the constructor should not propagate garbage if a future
  // caller passes Math.round(NaN) or a negative number.
  const cls = CONTENT.match(/class\s+MagpieHoard\s*\{[\s\S]*?\n\}/);
  assert.ok(cls);
  // Math.max(0, Math.round(amt || 0)) is the expected shape.
  assert.match(cls[0], /Math\.max\s*\(\s*0\s*,/,
    'MagpieHoard constructor must clamp amt >= 0');
});

test('game.js pickup loop has an isHoard branch that grants credits', () => {
  // Without this branch a MagpieHoard would either fall through to
  // the upgrade-roll path (wrong outcome — random new option instead
  // of the banked value) or sit in items[] forever (dead never set).
  // Window widened to 800 chars (anvil/scavenger-credit-bonus PR) to
  // accommodate the SCAVENGER bonusCreditPerPickup sanitization +
  // additive bonus inserted between `it.isHoard` and `player.credits`.
  const re = /it\.isHoard[\s\S]{0,800}player\.credits/;
  assert.match(GAME, re,
    'game.js pickup loop must handle isHoard and grant player.credits');
  // Must splice out so it doesn't double-collect on subsequent frames.
  assert.match(GAME,
    /it\.isHoard[\s\S]{0,800}items\.splice/,
    'isHoard branch must splice the hoard out of items[]');
});

test('sw.js cache key bumped (MAGPIE touches src/entities.js + content.js + game.js)', () => {
  // Class-of-bug: forgetting to bump the cache key serves stale code
  // to returning users. Lock that v191 (or higher) shipped with this
  // change.
  const m = SW.match(/CACHE\s*=\s*'neon-dungeon-v(\d+)'/);
  assert.ok(m, 'sw.js cache key not found');
  assert.ok(parseInt(m[1], 10) >= 191,
    `sw cache must be >= v191 after MAGPIE ship, got v${m[1]}`);
});
