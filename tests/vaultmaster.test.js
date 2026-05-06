'use strict';
// VAULTMASTER mob — wiring tests.
//
// VAULTMASTER is the economic-INVERSE of MAGPIE: a slow, NON-DAMAGING
// chaser that EJECTS a small VaultCoin pickup on every survived hit
// (ICD-throttled so multi-pellet weapons can't money-print on a
// single attack), and drops a JACKPOT VaultCoin on death. The
// tradeoff is opportunity-cost: kill fast for safety vs milk slowly
// for raw credit upside.
//
// AI / draw / spawn wiring is asserted via source-text regex
// (entities.js + content.js are browser-only — no UMD/CommonJS exports
// — same pattern as magpie.test.js / sapper.test.js / spectre.test.js).

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

test('VAULTMASTER appears in ENEMY_WEIGHTS with floor 4+ gate', () => {
  const m = ENTITIES.match(/VAULTMASTER\s*:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'VAULTMASTER must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 4,
    `VAULTMASTER minFloor should be >= 4 (so the credit upside matters mid-run), got ${m[1]}`);
});

test('VAULTMASTER has a stat row with atk === 0 and modest hp/spd', () => {
  const m = ENTITIES.match(/case\s+'VAULTMASTER':[^\n]*hp\s*=\s*(\d+)[^\n]*atk\s*=\s*(\d+)[^\n]*spd\s*=\s*([\d.]+)[^\n]*xpVal\s*=\s*(\d+)/);
  assert.ok(m, 'VAULTMASTER stat row missing in spawnEnemy switch');
  const hp = parseInt(m[1], 10);
  // hp must be substantial enough to support several "milk" hits
  // before the killing blow — the whole loop is "hit me for coins".
  // Anchor a lower bound so a future shrink doesn't reduce the mob
  // to a single-tap pinata. Upper bound prevents tank regression.
  assert.ok(hp >= 40 && hp <= 120,
    `VAULTMASTER hp should be in [40,120] (must support multi-hit milking), got ${hp}`);
  // MUST be non-damaging — the threat is opportunity cost, not body.
  assert.strictEqual(parseInt(m[2], 10), 0,
    'VAULTMASTER must have atk === 0 (no contact damage — pure economic)');
  // Slow enough that the player can choose to engage on their terms.
  // Slower than the player (~3) so it can't run them down — the
  // player must come to it to milk it.
  const spd = parseFloat(m[3]);
  assert.ok(spd > 0 && spd <= 2.5,
    `VAULTMASTER spd should be in (0,2.5] (slower than player, can't chase), got ${spd}`);
});

test('VAULTMASTER is excluded from elite affix roll', () => {
  // Same first-ship caution as MAGPIE/SAPPER/HARVESTER — easier to
  // add elite affixes later than to reason about SHIELDED/PHASING
  // interactions for an ICD-throttled coin printer.
  // Match VAULTMASTER appearing in the elite-skip exclusion list.
  // Pattern is permissive about following exclusions (a future mob
  // added to the list shouldn't break this test — see magneton.test.js
  // for the same relaxation pattern after SAPPER PR).
  assert.match(ENTITIES,
    /type\s*!==\s*'VAULTMASTER'\s*&&[\s\S]{0,400}floorNum\s*>=\s*3/,
    'elite-skip list must include VAULTMASTER before the floorNum gate');
});

test('VAULTMASTER has an AI dispatch case calling aiVaultmaster', () => {
  assert.match(ENTITIES,
    /case\s+'VAULTMASTER'\s*:\s*this\.aiVaultmaster\s*\(/,
    'aiDispatch switch must route VAULTMASTER to aiVaultmaster');
});

test('aiVaultmaster method exists, chases on los/range, otherwise patrols', () => {
  assert.match(ENTITIES, /aiVaultmaster\s*\([^\)]*\)\s*\{/, 'aiVaultmaster method must exist');
  const fn = ENTITIES.match(/aiVaultmaster\s*\([^\)]*\)\s*\{[\s\S]*?^\s\s\}/m);
  assert.ok(fn, 'aiVaultmaster body must be extractable');
  // Body should call moveToward (chase) and patrol (idle), and gate
  // chase on either LOS or VAULTMASTER_ENGAGE_RANGE.
  assert.match(fn[0], /this\.moveToward\s*\(/, 'aiVaultmaster must call moveToward');
  assert.match(fn[0], /this\.patrol\s*\(/, 'aiVaultmaster must fall back to patrol');
  assert.match(fn[0], /VAULTMASTER_ENGAGE_RANGE/,
    'aiVaultmaster must gate chase on VAULTMASTER_ENGAGE_RANGE');
});

test('VAULTMASTER tuning constants are declared at module scope', () => {
  assert.match(ENTITIES, /const\s+VAULTMASTER_HIT_ICD\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+VAULTMASTER_COIN_AMT\s*=\s*\d+/);
  assert.match(ENTITIES, /const\s+VAULTMASTER_JACKPOT_AMT\s*=\s*\d+/);
  assert.match(ENTITIES, /const\s+VAULTMASTER_EJECT_DIST\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+VAULTMASTER_ENGAGE_RANGE\s*=\s*\d+/);
});

test('jackpot amount is meaningfully larger than per-hit coin amount', () => {
  const coinM = ENTITIES.match(/const\s+VAULTMASTER_COIN_AMT\s*=\s*(\d+)/);
  const jackM = ENTITIES.match(/const\s+VAULTMASTER_JACKPOT_AMT\s*=\s*(\d+)/);
  assert.ok(coinM && jackM, 'tuning constants must be present');
  const coin = parseInt(coinM[1], 10);
  const jack = parseInt(jackM[1], 10);
  assert.ok(jack >= coin * 3,
    `jackpot (${jack}) must be at least 3x per-hit coin (${coin}) — the death drop must be a real reward, not a rounding error`);
});

// ─── takeDamage hook (per-hit coin ejection) ───────────────────────────

test('takeDamage ejects a VaultCoin per hit, ICD-throttled', () => {
  // The ejection lives in takeDamage (not in aiVaultmaster) because
  // that's the only place we have post-DR / post-shield damage and
  // the isProc filter. Class of bug if the ICD is missing: a 5-pellet
  // shotgun ejects 5 coins per pull → instant money-print exploit.
  const re = /this\.type\s*===\s*'VAULTMASTER'[\s\S]{0,400}?_vmHitICD[\s\S]{0,400}?items\.push\s*\(\s*new\s+VaultCoin/;
  assert.match(ENTITIES, re,
    'takeDamage must check VAULTMASTER + _vmHitICD then push a VaultCoin');
});

test('coin-ejection hook gates on actual > 0 and !this.dead', () => {
  // Without `actual > 0`: 0-damage cosmetic hits print coins.
  // Without `!this.dead`: the killing blow ejects an extra coin
  // PLUS the jackpot — wrong; killing blow should be jackpot only.
  const re = /this\.type\s*===\s*'VAULTMASTER'\s*&&\s*actual\s*>\s*0\s*&&\s*!this\.dead/;
  assert.match(ENTITIES, re,
    'takeDamage VAULTMASTER branch must gate on actual > 0 AND !this.dead');
});

test('hit-ICD timer is decremented in Enemy.update', () => {
  // Without the per-frame decrement the ICD never expires after the
  // first hit → only one coin per VAULTMASTER ever ejects. Class of
  // bug: same shape as the original SAPPER ICD timer.
  assert.match(ENTITIES,
    /this\._vmHitICD\s*=\s*Math\.max\s*\(\s*0\s*,\s*this\._vmHitICD\s*-\s*dt/,
    'Enemy.update must decrement _vmHitICD each frame');
});

test('createEnemy initialises _vmHitICD = 0 on VAULTMASTER spawn', () => {
  // Without explicit init the field is undefined; the takeDamage
  // gate uses `(this._vmHitICD || 0) <= 0` so undefined is fine
  // for the FIRST hit, but after a hit the field is set, and a
  // subsequent VAULTMASTER spawn could share the symbol if any
  // future code path branches on truthy/falsy. Defensive init.
  assert.match(ENTITIES,
    /type\s*===\s*'VAULTMASTER'[\s\S]{0,400}?e\._vmHitICD\s*=\s*0/,
    'createEnemy VAULTMASTER block must seed _vmHitICD = 0');
});

// ─── die() jackpot drop ────────────────────────────────────────────────

test('die() drops a VaultCoin jackpot on VAULTMASTER death', () => {
  // Excludes summons / shards (defensive — no current code path
  // summons VAULTMASTER and it never splits, but the gate stays in
  // sync with MAGPIE/HARVESTER drop rules).
  const re = /this\.type\s*===\s*'VAULTMASTER'\s*&&\s*!isSummon\s*&&\s*!this\.isShard[\s\S]{0,200}?items\.push\s*\(\s*new\s+VaultCoin\s*\(\s*this\.x\s*,\s*this\.y\s*,\s*VAULTMASTER_JACKPOT_AMT/;
  assert.match(ENTITIES, re,
    'die() must drop a jackpot VaultCoin for non-summon non-shard VAULTMASTER deaths');
});

// ─── VaultCoin pickup wiring ───────────────────────────────────────────

test('VaultCoin class exists in src/content.js with isHoard flag', () => {
  // The pickup loop in game.js distinguishes pickup types by
  // boolean flags (.isKey / .isHarvest / .isWhisper / .isHoard).
  // Without isHoard the coin would fall through to the generic
  // upgrade-roll path which ignores .amt and rolls a new option.
  assert.match(CONTENT, /class\s+VaultCoin\s*\{/, 'VaultCoin class must exist');
  const cls = CONTENT.match(/class\s+VaultCoin\s*\{[\s\S]*?\n\}/);
  assert.ok(cls, 'VaultCoin class block not extractable');
  assert.match(cls[0], /this\.isHoard\s*=\s*true/,
    'VaultCoin must set isHoard = true (auto-collect via game.js pickup branch)');
  assert.match(cls[0], /this\.amt\s*=/,
    'VaultCoin must persist amt for the pickup branch to read');
  assert.match(cls[0], /this\.dead\s*=\s*false/,
    'VaultCoin must initialise dead = false');
});

test('VaultCoin.amt is sanitised against negative / NaN inputs', () => {
  const cls = CONTENT.match(/class\s+VaultCoin\s*\{[\s\S]*?\n\}/);
  assert.ok(cls);
  assert.match(cls[0], /Math\.max\s*\(\s*0\s*,\s*Math\.round/,
    'VaultCoin constructor must clamp amt >= 0 and round');
});

test('isHoard branch in game.js handles VaultCoin (same path as MagpieHoard)', () => {
  // VaultCoin reuses the existing `it.isHoard` branch in the pickup
  // loop. The branch must (a) read .amt, (b) credit player.credits,
  // (c) splice the pickup out of items[] so it doesn't double-collect.
  // This test pins those three properties without re-asserting the
  // exact code shape (already covered by magpie.test.js). The class-
  // of-bug here is "VaultCoin gets added but the branch silently
  // grants 0 credits because the branch doesn't read amt".
  // Window widened to 800 chars (anvil/scavenger-credit-bonus PR) to
  // accommodate the SCAVENGER bonusCreditPerPickup sanitization.
  assert.match(GAME, /it\.isHoard[\s\S]{0,800}player\.credits\s*[+]?=/,
    'game.js pickup loop must credit player.credits from .amt on isHoard');
  assert.match(GAME, /it\.isHoard[\s\S]{0,800}items\.splice/,
    'isHoard branch must splice the pickup out of items[]');
});

test('MAGPIE thief-scan filter excludes isHoard items (so thieves do not steal vault drops)', () => {
  // Class of bug: a passing MAGPIE could vacuum freshly-ejected
  // VaultCoins mid-fight, which would feel like a bug rather than
  // counterplay. The existing filter at aiMagpie already excludes
  // isHoard — anchor it so a future refactor can't drop the gate.
  const aiMagpie = ENTITIES.match(/aiMagpie\s*\([^\)]*\)\s*\{[\s\S]*?^\s\s\}/m);
  assert.ok(aiMagpie, 'aiMagpie body must be extractable');
  assert.match(aiMagpie[0], /it\.isHoard/,
    'aiMagpie scan filter must skip isHoard items (protects VaultCoin + MagpieHoard)');
});

// ─── sw cache + CREDIT_VALUES ──────────────────────────────────────────

test('CREDIT_VALUES has a low VAULTMASTER baseline (most reward is in coins)', () => {
  // The base CREDIT_VALUES kill reward should be small — the design
  // promise is "milking pays more than killing". If the base reward
  // is larger than VAULTMASTER_JACKPOT_AMT, the milking design
  // collapses. Anchor base <= jackpot.
  const cvM = ENTITIES.match(/CREDIT_VALUES\s*=\s*\{[^}]*?VAULTMASTER\s*:\s*(\d+)/);
  assert.ok(cvM, 'CREDIT_VALUES must include a VAULTMASTER entry');
  const baseCv = parseInt(cvM[1], 10);
  const jackM = ENTITIES.match(/const\s+VAULTMASTER_JACKPOT_AMT\s*=\s*(\d+)/);
  const jack = parseInt(jackM[1], 10);
  assert.ok(baseCv < jack,
    `CREDIT_VALUES.VAULTMASTER (${baseCv}) must be < jackpot (${jack}) so coins are the dominant reward source`);
});

test('sw.js cache freshness does not use a numeric cache key', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});
