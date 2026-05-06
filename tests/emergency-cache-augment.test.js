'use strict';
// EMERGENCY_CACHE augment — wiring tests.
//
// EMERGENCY_CACHE is an anti-snowball lifeline. On a FRESH floor entry
// (savedModifier === undefined — same gate as spawn grace, keys, boosts,
// SHIELD_CAPACITOR), if the player arrives below 30% HP, top them up to
// 50%. Once-per-floor by construction (only triggers at fresh entry).
//
// Same wiring-test shape as hunter-modifier / fragile-modifier / harvester:
// grep the runtime source rather than simulate the full game loop.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = fs.readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8');
const GAME = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('EMERGENCY_CACHE registered in AUGMENTS with name/icon/colour/desc', () => {
  // Single source of truth for the augment-choice modal, the implant shrine,
  // and the shop offer (makeAugmentShopOption derives from this entry).
  const m = CONTENT.match(/EMERGENCY_CACHE:\s*\{\s*name:\s*'([^']+)'[^}]*icon:\s*'([^']+)'[^}]*colour:\s*'(#[0-9a-fA-F]+)'[^}]*desc:\s*'([^']+)'/);
  assert.ok(m, 'EMERGENCY_CACHE must be registered in AUGMENTS with name/icon/colour/desc');
  assert.ok(m[1].length > 0, 'EMERGENCY_CACHE name must be non-empty');
  assert.ok(m[2].length > 0, 'EMERGENCY_CACHE icon must be non-empty');
  assert.ok(m[3].length === 7, `EMERGENCY_CACHE colour must be #rrggbb, got ${m[3]}`);
  assert.ok(m[4].length > 0, 'EMERGENCY_CACHE desc must be non-empty');
});

test('EMERGENCY_CACHE auto-included in AUGMENT_KEYS for rolls', () => {
  // AUGMENT_KEYS = Object.keys(AUGMENTS) — drives both rollAugmentChoices
  // (implant shrine) and makeAugmentShopOption. Lock the derivation so a
  // future refactor cannot silently de-list this augment.
  assert.ok(/const AUGMENT_KEYS = Object\.keys\(AUGMENTS\);/.test(CONTENT),
    'AUGMENT_KEYS must remain Object.keys(AUGMENTS) so EMERGENCY_CACHE is auto-included');
});

test('loadFloor heal hookpoint references EMERGENCY_CACHE via hasAugment', () => {
  // The heal lives in game.js loadFloor() and must check hasAugment with
  // the canonical id string. A typo (e.g. EMERGENCY_KIT) would silently
  // never trigger.
  assert.ok(/hasAugment\(\s*['"]EMERGENCY_CACHE['"]\s*\)/.test(GAME),
    'loadFloor must call hasAugment("EMERGENCY_CACHE")');
});

test('EMERGENCY_CACHE heal is gated on FRESH floor entry (savedModifier === undefined)', () => {
  // Save-resume gate: same pattern used by spawn grace (line ~217), keys
  // reset (~175), boosts clear (~178), SHIELD_CAPACITOR (~230). Without
  // this gate, reloading a save mid-floor would re-trigger the heal —
  // turning a once-per-floor lifeline into a free top-up on every reload.
  // Match the full conditional including hasAugment to ensure both gates
  // are co-located on the same branch.
  const m = GAME.match(/if\s*\(\s*savedModifier\s*===\s*undefined\s*&&\s*hasAugment\(\s*['"]EMERGENCY_CACHE['"]\s*\)/);
  assert.ok(m, 'EMERGENCY_CACHE branch must gate on savedModifier === undefined && hasAugment(...)');
});

test('EMERGENCY_CACHE heal guards player.hp > 0 (no resurrect)', () => {
  // The augment must not resurrect a dead player. loadFloor IS called by
  // death respawn (startGame → new Player() → loadFloor) — but that path
  // wipes augments via new Player(), so EMERGENCY_CACHE wouldn't be set
  // anyway. The hp > 0 guard is defense-in-depth: any future code path
  // that calls loadFloor on a 0-HP player will not silently revive them.
  const idx = GAME.indexOf('EMERGENCY_CACHE');
  assert.ok(idx !== -1, 'EMERGENCY_CACHE must appear in game.js');
  const window = GAME.slice(idx, idx + 1200);
  assert.ok(/this\.player\.hp\s*>\s*0/.test(window),
    'EMERGENCY_CACHE branch must guard on this.player.hp > 0');
});

test('EMERGENCY_CACHE triggers below 30% HP threshold', () => {
  // The trigger fraction defines the "anti-snowball" boundary. Lock the
  // 0.30 literal so a future tweak that drops it (e.g. to 0.15) doesn't
  // happen silently — that would make the augment near-useless.
  const idx = GAME.indexOf('EMERGENCY_CACHE');
  const window = GAME.slice(idx, idx + 1200);
  assert.ok(/<\s*0\.30\b/.test(window),
    'EMERGENCY_CACHE branch must compare hp/maxHp against 0.30');
});

test('EMERGENCY_CACHE heals to 50% of maxHp', () => {
  // Top-up target. ceil(maxHp * 0.50) is documented as the recovery
  // target. Lock the literal so a tuning change is intentional.
  const idx = GAME.indexOf('EMERGENCY_CACHE');
  const window = GAME.slice(idx, idx + 1200);
  assert.ok(/Math\.ceil\(\s*max\s*\*\s*0\.50\s*\)/.test(window),
    'EMERGENCY_CACHE branch must heal to Math.ceil(max * 0.50)');
});

test('EMERGENCY_CACHE branch shows player feedback via deferred this.msg', () => {
  // The augment is silent without a toast — players need to see that the
  // augment fired. EMERGENCY CACHE label is part of the user-visible
  // contract. The toast MUST be deferred via setTimeout because loadFloor
  // calls `messages.length=0` later in the same function (~line 305) to
  // clear the previous floor's queued messages — an immediate this.msg
  // would be wiped before the player ever sees it. Same deferral pattern
  // used by applyPerk / makeAugmentShopOption install toasts (250ms).
  const idx = GAME.indexOf('EMERGENCY_CACHE');
  const window = GAME.slice(idx, idx + 1500);
  assert.ok(/setTimeout\(\s*\(\s*\)\s*=>\s*this\.msg\(\s*['"][^'"]*EMERGENCY CACHE/.test(window),
    'EMERGENCY_CACHE branch must call this.msg via setTimeout to survive loadFloor messages.length=0 wipe');
});

test('sw.js uses network-first freshness instead of numeric cache bumps', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)\.catch\(\(\) => caches\.match\(e\.request\)\)/);
});

test('EMERGENCY_CACHE branch uses bitwise|0 for maxHp normalisation', () => {
  // Defensive: maxHp is set in Player constructor but a corrupted save or
  // future code path could leave it non-numeric. `max | 0` coerces to a
  // safe int; the `max > 0` guard then short-circuits the heal entirely
  // for invalid values rather than NaN-ing the threshold check.
  const idx = GAME.indexOf('EMERGENCY_CACHE');
  const window = GAME.slice(idx, idx + 1200);
  assert.ok(/this\.player\.maxHp\s*\|\s*0/.test(window),
    'EMERGENCY_CACHE branch must normalise maxHp via |0');
  assert.ok(/max\s*>\s*0/.test(window),
    'EMERGENCY_CACHE branch must guard on max > 0 to short-circuit invalid maxHp');
});
