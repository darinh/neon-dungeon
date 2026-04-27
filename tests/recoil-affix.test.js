'use strict';
// "of Recoil" weapon suffix — wiring tests.
//
// RECOIL fills the suffix-gap noted in v2 backlog (stagger/knockback).
// Per-hit, away-from-player swept knockback ~0.4 tile with per-enemy
// 0.35s ICD. Skips bosses (designed-arena protection — same precedent
// as SHOCK_PULSE / KNOCK_PULSE), disguised mimics (would leak ambush
// before reveal), and phased WRAITH/TUNNELLER (defensive).
//
// Same wiring-test shape as recent ship tests (fragile-modifier,
// shock-pulse, parry) — grep the runtime source rather than simulate
// the full game loop.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = fs.readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8');
const ENTITIES = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('RECOIL registered in WEAPON_AFFIXES with slot/label/colour/desc/effect', () => {
  // The single source of truth for the affix table — drives display
  // name composition (content.js:1338), effect routing
  // (content.js:1342 → w._effects), and AFFIX_SUFFIXES filter.
  const m = CONTENT.match(/RECOIL:\s*\{\s*slot:\s*'suffix'[^}]*label:\s*'of Recoil'[^}]*colour:\s*'(#[0-9a-f]+)'[^}]*desc:\s*'([^']+)'[^}]*effect:\s*'recoil'/);
  assert.ok(m, "RECOIL must be registered in WEAPON_AFFIXES with slot:'suffix' / label:'of Recoil' / effect:'recoil'");
  assert.equal(m[1].length, 7, 'RECOIL colour must be #rrggbb');
  assert.ok(m[2].length > 0, 'RECOIL desc must be non-empty');
});

test('RECOIL is a suffix (so it stacks with a prefix and obeys the 1-suffix-per-weapon rule)', () => {
  // AFFIX_SUFFIXES is derived from the table; mixing prefix+suffix in
  // the same slot would break content.js:1335-1336 prefix/suffix find.
  assert.ok(/const AFFIX_SUFFIXES = AFFIX_KEYS\.filter\(k => WEAPON_AFFIXES\[k\]\.slot === 'suffix'\);/.test(CONTENT),
    'AFFIX_SUFFIXES derivation must remain Object.keys-style so RECOIL is auto-included');
});

test('recoil branch wired in applyHitEffects', () => {
  // Lives in the per-effect for-loop alongside burn/slow/leech/chain/
  // shock so it processes through the same hitCtx path. The non-proc
  // gate is on the caller side (entities.js ~1529: `if (!ctx.isProc)
  // applyHitEffects(...)`) so chain procs don't recoil — same as the
  // other suffixes.
  assert.ok(/else if \(eff === 'recoil'\)/.test(ENTITIES),
    'applyHitEffects must contain an `eff === \'recoil\'` branch');
});

test('RECOIL skips bosses (designed-arena protection)', () => {
  // Mirrors SHOCK_PULSE (entities.js:8748) and KNOCK_PULSE — bosses
  // are stationary by design (SENTINEL Phase 2 stand, OMEGA platform)
  // and their phase tuning assumes positional invariants.
  const block = ENTITIES.match(/else if \(eff === 'recoil'\)[\s\S]*?\/\/ 'explode' is handled in applyOnKill/);
  assert.ok(block, 'recoil branch must be parseable');
  assert.ok(/if \(enemy\.isBoss\)\s*continue;/.test(block[0]),
    'recoil branch must skip bosses with `if (enemy.isBoss) continue;`');
});

test('RECOIL skips disguised mimics (no ambush leak)', () => {
  // Same precedent as EMP (content.js _disguised skip), shield-gen EMP
  // (entities.js ~8584), and SHOCK_PULSE (entities.js ~8742). Visible
  // displacement of a disguised mimic would betray its position before
  // the proximity-reveal trigger fires.
  const block = ENTITIES.match(/else if \(eff === 'recoil'\)[\s\S]*?\/\/ 'explode' is handled in applyOnKill/);
  assert.ok(block, 'recoil branch must be parseable');
  assert.ok(/if \(enemy\._disguised\)\s*continue;/.test(block[0]),
    'recoil branch must skip _disguised mimics');
});

test('RECOIL skips phased WRAITH/TUNNELLER (intangible mob defensive guard)', () => {
  // Player projectile prefilters at content.js:3411 + melee prefilter
  // at entities.js:9588 already block damage to _wrPhased mobs, so in
  // practice applyHitEffects never sees them. But a future damage
  // path could bypass those filters; recoil must independently
  // defend against displacing an intangible mob.
  const block = ENTITIES.match(/else if \(eff === 'recoil'\)[\s\S]*?\/\/ 'explode' is handled in applyOnKill/);
  assert.ok(block, 'recoil branch must be parseable');
  assert.ok(/if \(enemy\._wrPhased\)\s*continue;/.test(block[0]),
    'recoil branch must skip _wrPhased mobs');
});

test('RECOIL has per-enemy ICD with positive duration (prevents perma-shove from rapid-fire)', () => {
  // Without ICD a high-rate weapon (RAPID prefix + MG/SMG) would
  // perma-shove a single enemy across the room. Pattern mirrors
  // _shockICD (entities.js ~1192). ICD should be ≥ 0.2s (2-3 hits/sec
  // ceiling on per-target recoil) to avoid trivializing kiting.
  const block = ENTITIES.match(/else if \(eff === 'recoil'\)[\s\S]*?\/\/ 'explode' is handled in applyOnKill/);
  assert.ok(block, 'recoil branch must be parseable');
  const icdRead = /const icd = enemy\._recoilICD \|\| 0;/.test(block[0]);
  const icdGate = /if \(icd > 0\)\s*continue;/.test(block[0]);
  const icdSet = block[0].match(/enemy\._recoilICD = (\d*\.?\d+);/);
  assert.ok(icdRead, 'recoil must read enemy._recoilICD');
  assert.ok(icdGate, 'recoil must early-return when ICD > 0');
  assert.ok(icdSet, 'recoil must SET enemy._recoilICD after applying');
  const dur = parseFloat(icdSet[1]);
  assert.ok(dur >= 0.2, `recoil ICD must be >= 0.2s to prevent perma-shove (got ${dur}s)`);
  assert.ok(dur <= 1.0, `recoil ICD should stay <= 1.0s to feel responsive (got ${dur}s)`);
});

test('RECOIL ICD ticks down per frame in tickStatusEffects', () => {
  // Without a tick-down the ICD would never decay and a single hit
  // would lock the enemy out of recoil forever. Same pattern as the
  // adjacent _shockICD decay.
  assert.ok(/if \(enemy\._recoilICD > 0\) enemy\._recoilICD -= dt;/.test(ENTITIES),
    'enemy._recoilICD must decay per frame alongside _shockICD');
});

test('RECOIL knockback uses wall-aware swept-step pattern (not single-snap)', () => {
  // Per stored memory `knockback sweeping`: any displacement >1 tile
  // single-snap can tunnel through interior walls. RECOIL is only
  // ~0.4 tile so single-snap would technically be safe — but we use
  // the swept pattern anyway for consistency with SHOCK_PULSE and to
  // get free wall-sliding (axis-independent isPassable per step).
  const block = ENTITIES.match(/else if \(eff === 'recoil'\)[\s\S]*?\/\/ 'explode' is handled in applyOnKill/);
  assert.ok(block, 'recoil branch must be parseable');
  // Look for the swept-step signature: STEP loop with two axis flags
  // and per-axis isPassable checks.
  assert.ok(/const STEP = 0\.\d+;/.test(block[0]),
    'recoil must define a STEP increment (swept-step pattern)');
  assert.ok(/for \(let s = 0; s < steps; s\+\+\)/.test(block[0]),
    'recoil must loop in steps for the sweep');
  assert.ok(/isPassable\(map\[fyK\]\[fxK\]\)/.test(block[0]) && /isPassable\(map\[yfK\]\[xfK\]\)/.test(block[0]),
    'recoil must check x and y axes independently against isPassable');
  assert.ok(/if \(!xOk && !yOk\) break;/.test(block[0]),
    'recoil must break when both axes are blocked');
});

test('RECOIL knockback distance is small (≤ 1 tile per hit)', () => {
  // Recoil is a per-hit effect, not an AoE pulse. A large per-hit
  // push would chain-shove enemies off-screen on rapid weapons. Keep
  // it cosmetic/utility — useful for canceling a melee swing, not
  // for trivializing positioning.
  const block = ENTITIES.match(/else if \(eff === 'recoil'\)[\s\S]*?\/\/ 'explode' is handled in applyOnKill/);
  assert.ok(block, 'recoil branch must be parseable');
  const m = block[0].match(/const KNOCK = (\d*\.?\d+);/);
  assert.ok(m, 'recoil must define a KNOCK distance constant');
  const knock = parseFloat(m[1]);
  assert.ok(knock > 0, `recoil KNOCK must be > 0 (got ${knock})`);
  assert.ok(knock <= 1.0, `recoil KNOCK must be <= 1.0 tile per hit to avoid trivializing positioning (got ${knock})`);
});

test('RECOIL has a final combined-tile guard (anti-corner-tunnel)', () => {
  // Per stored memory `knockback sweeping`: even with axis-independent
  // checks, a diagonal-corner case can land in a wall tile. The final
  // combined-tile guard re-verifies the resting tile.
  const block = ENTITIES.match(/else if \(eff === 'recoil'\)[\s\S]*?\/\/ 'explode' is handled in applyOnKill/);
  assert.ok(block, 'recoil branch must be parseable');
  assert.ok(/const finalFx = Math\.floor\(curX\), finalFy = Math\.floor\(curY\);/.test(block[0]),
    'recoil must compute final tile floor coords');
  assert.ok(/isPassable\(map\[finalFy\]\[finalFx\]\)/.test(block[0]),
    'recoil must verify final tile is passable before committing the displacement');
});

test('RECOIL is non-proc-gated by caller (chain/explode procs do not stack-shove)', () => {
  // The applyHitEffects entry point is gated by the caller at
  // entities.js ~1529 (`if (!ctx.isProc) applyHitEffects(this, actual,
  // ctx);`). Chain lightning and detonate explosions call back into
  // takeDamage with isProc:true so the recoil branch is never reached
  // for procs — preventing chain-shove cascades.
  assert.ok(/if \(!ctx\.isProc\) applyHitEffects\(this, actual, ctx\);/.test(ENTITIES),
    'applyHitEffects must remain gated on !ctx.isProc at the call site');
});

test('sw.js cache version >= v201 (RECOIL adds runtime behavior)', () => {
  // Per project convention (conduit / sapper / harvester / fragile
  // pattern): cache version assertion is a floor (>=), not exact-match,
  // so sibling PRs can leapfrog without retroactive test edits. v201
  // leapfrogs PRs #154 (v198), #155 (v199), #156 (v200) which were
  // open at ship time.
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, 'sw.js must declare a neon-dungeon-vNNN cache version');
  const v = parseInt(m[1], 10);
  assert.ok(v >= 201,
    `sw.js cache version must be >= 201 (RECOIL ships runtime behavior in src/content.js + src/entities.js), got v${v}`);
});
