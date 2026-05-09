'use strict';
// VENGEANCE mob — source-text wiring + behavioural assertions.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const SPAWN_INITIALIZERS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'spawn-initializers.js'), 'utf8'
);
const ENEMY_SPAWN_TABLE = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'spawn-table.js'), 'utf8'
);
const ENEMY_STATS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'enemy-stats.js'), 'utf8'
);
const ENEMY_CLASSIFICATION = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'enemy-classification.js'), 'utf8'
);
const SOURCE_METADATA = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'source-metadata.js'), 'utf8'
);
const ENTITY_DEATH_HOOKS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'death-hooks.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('VENGEANCE appears in ENEMY_WEIGHTS with late-game floor gate', () => {
  const m = ENEMY_SPAWN_TABLE.match(/VENGEANCE:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'VENGEANCE must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 6, `VENGEANCE minFloor should be >= 6, got ${m[1]}`);
});

test('VENGEANCE has a stat row in ENEMY_BASE_STATS', () => {
  const re = /VENGEANCE:\s*\{[^\n]*hp:\s*\d+,[^\n]*atk:\s*\d+,[^\n]*spd:\s*\d/;
  assert.match(ENEMY_STATS, re);
});

test('VENGEANCE base spd is 0 (stationary turret)', () => {
  // The whole niche depends on stationary base — the rush is the ONLY
  // movement. If base spd > 0 the mob becomes a CHARGER variant.
  const m = ENEMY_STATS.match(/VENGEANCE:\s*\{[^\n]*hp:\s*\d+,[^\n]*atk:\s*\d+,[^\n]*spd:\s*([\d.]+)/);
  assert.ok(m, 'VENGEANCE stat row must be locatable');
  assert.equal(parseFloat(m[1]), 0, `VENGEANCE base spd must be 0 (stationary), got ${m[1]}`);
});

test('VENGEANCE spawn init zeros state + charges + rush timer', () => {
  const re = /if\s*\(type\s*===\s*'VENGEANCE'\)[\s\S]{0,500}_vgState\s*=\s*'idle'[\s\S]{0,300}_vgCharges\s*=\s*0[\s\S]{0,200}_vgRushTimer\s*=\s*0/;
  assert.match(SPAWN_INITIALIZERS, re, 'VENGEANCE init must zero all per-instance state');
});

test('VENGEANCE is excluded from the elite affix roll', () => {
  assert.match(ENEMY_CLASSIFICATION, /ELITE_EXCLUDED_TYPES[\s\S]*'VENGEANCE'[\s\S]*\]\s*\)/,
    'VENGEANCE must be in the elite-exclusion guard');
});

test('VENGEANCE is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'VENGEANCE':\s*this\.aiVengeance\(/);
});

test('aiVengeance method is defined', () => {
  assert.match(ENTITIES, /aiVengeance\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

test('VENGEANCE stun cancel resets rush state (preserves charges)', () => {
  // Stun mid-rush must drop the swing — otherwise the player can't
  // punish the stun. Mirrors REAPER's _reHasFrenzied semantics: the
  // CHARGES survive (commitment to retaliate), only the swing resets.
  const re = /_vgState\s*===\s*'rush'[\s\S]{0,200}_vgState\s*=\s*'idle'[\s\S]{0,200}_vgRushTimer\s*=\s*0/;
  assert.match(ENTITIES, re, 'stun handler must reset _vgState (but NOT _vgCharges)');
});

// ─── Notification hook (the kill-listener) ──────────────────────────────

test('notifyVengeance hook is defined and called from die()', () => {
  // Without the hook, charges never accumulate and the mob is inert.
  assert.match(ENTITY_DEATH_HOOKS, /function\s+notifyVengeance\s*\(/);
  // Must be wired into die() right next to notifyGhostProjectors.
  assert.match(ENTITIES, /notifyGhostProjectors\(this\);\s*\n\s*notifyVengeance\(this\)/);
});

test('notifyVengeance excludes shards / summons / ghosts / bosses / VENGEANCE itself', () => {
  // PACIFIST / fairness invariant: only volitional kills count toward
  // retaliation. Otherwise a SUMMONER's drone dying to incidental fire
  // would charge VENGEANCEs, which is unfair.
  const fn = ENTITY_DEATH_HOOKS.match(/function\s+notifyVengeance[\s\S]{0,1500}\n\}/);
  assert.ok(fn, 'notifyVengeance function body must be locatable');
  assert.match(fn[0], /deadEnemy\.type\s*===\s*'VENGEANCE'/, 'must skip VENGEANCE-on-VENGEANCE charge');
  assert.match(fn[0], /deadEnemy\._ghIsGhost/, 'must skip ghost replays');
  assert.match(fn[0], /deadEnemy\.isShard/, 'must skip shards');
  assert.match(fn[0], /deadEnemy\._summoned/, 'must skip summons');
  assert.match(fn[0], /deadEnemy\.isBoss/, 'must skip bosses');
});

test('notifyVengeance is room-scoped (uses enemiesByRoom)', () => {
  // A VENGEANCE in a different room shouldn't charge from a kill it
  // can't see. enemiesByRoom is the per-room indexed structure already
  // used by notifyGhostProjectors.
  const fn = ENTITY_DEATH_HOOKS.match(/function\s+notifyVengeance[\s\S]{0,1500}\n\}/);
  assert.ok(fn, 'notifyVengeance function body must be locatable');
  assert.match(fn[0], /enemiesByRoom\.get\(deadEnemy\.room\)/, 'must scope by room via enemiesByRoom');
});

// ─── AI behaviour invariants ────────────────────────────────────────────

test('aiVengeance rush uses _tx/_ty (taunt-aware)', () => {
  // Same lesson from ECHOER/PROPHET: any mob that samples player outside
  // _tx/_ty fails the hologram-decoy contract.
  // Anchor on the method DEFINITION (` aiVengeance` with leading space —
  // the dispatch case is `this.aiVengeance`).
  const block = ENTITIES.match(/\n  aiVengeance\s*\(\s*dt[\s\S]{0,3500}\}\s*\n\s*\n\s*\/\/\s*─+\s*RESONATOR/);
  assert.ok(block, 'aiVengeance method definition must be locatable');
  // Must reference _tx and _ty for both the rush move target AND the
  // rush-arm range/LoS check.
  assert.match(block[0], /this\._tx/, 'rush must use this._tx (taunt-aware)');
  assert.match(block[0], /this\._ty/, 'rush must use this._ty (taunt-aware)');
});

test('aiVengeance rush calls meleeAttack(player) on contact (atk lives here)', () => {
  // VENGEANCE has no projectile — atk=18 is delivered via melee on the
  // strike sub-phase. Without this call the rush is a harmless dance.
  // Lesson from WARDLING PR — atk wired without melee call dealt zero damage.
  const block = ENTITIES.match(/\n  aiVengeance\s*\(\s*dt[\s\S]{0,3500}\}\s*\n\s*\n\s*\/\/\s*─+\s*RESONATOR/);
  assert.ok(block, 'aiVengeance method definition must be locatable');
  const meleeCalls = (block[0].match(/this\.meleeAttack\s*\(\s*player\s*\)/g) || []).length;
  assert.ok(meleeCalls >= 1, `aiVengeance must call meleeAttack(player) at least once (strike phase), found ${meleeCalls}`);
});

test('aiVengeance rush has both telegraph + strike sub-phases (combined timer)', () => {
  // _vgRushTimer counts down from VENGEANCE_TELEGRAPH+VENGEANCE_RUSH_DURATION.
  // While > VENGEANCE_RUSH_DURATION → telegraph (no movement). After →
  // strike (rush move). Both sub-phases are critical for fairness:
  // missing the telegraph = no warning; missing the strike = no threat.
  const block = ENTITIES.match(/\n  aiVengeance\s*\(\s*dt[\s\S]{0,3500}\}\s*\n\s*\n\s*\/\/\s*─+\s*RESONATOR/);
  assert.ok(block, 'aiVengeance method definition must be locatable');
  // Combined-timer assertion: when armed, _vgRushTimer set to TELEGRAPH+DURATION
  assert.match(block[0], /VENGEANCE_TELEGRAPH\s*\+\s*VENGEANCE_RUSH_DURATION/,
    'rush-arm must set timer to TELEGRAPH + RUSH_DURATION (combined)');
  // Sub-phase split: strike when timer <= RUSH_DURATION
  assert.match(block[0], /this\._vgRushTimer\s*<=\s*VENGEANCE_RUSH_DURATION/,
    'strike sub-phase must be detected via timer <= RUSH_DURATION');
});

test('aiVengeance threshold check uses VENGEANCE_THRESHOLD constant (no magic number)', () => {
  // If the AI compared `_vgCharges >= 3` directly the threshold could
  // diverge from the comment / future tuning. Constant must be the
  // single source of truth.
  const block = ENTITIES.match(/\n  aiVengeance\s*\(\s*dt[\s\S]{0,3500}\}\s*\n\s*\n\s*\/\/\s*─+\s*RESONATOR/);
  assert.ok(block, 'aiVengeance method definition must be locatable');
  assert.match(block[0], /this\._vgCharges\s*>=\s*VENGEANCE_THRESHOLD/,
    'threshold check must use VENGEANCE_THRESHOLD (not magic 3)');
});

test('aiVengeance does NOT pre-multiply rush speed (avoids double-applying OVERCLOCK + berserker)', () => {
  // Caught by gpt-5.5 review: pre-multiplying VENGEANCE_RUSH_SPD by
  // ocMul + berserkerMul() before passing to moveToward() doubles
  // both modifiers (moveToward applies modSpeed + berserkerMul
  // internally at entities.js:1556). The fix is to pass the raw
  // constant. Negative assertion: the rush-strike moveToward call
  // MUST NOT contain `* ocMul` or `* bm`.
  const block = ENTITIES.match(/\n  aiVengeance\s*\(\s*dt[\s\S]{0,3500}\}\s*\n\s*\n\s*\/\/\s*─+\s*RESONATOR/);
  assert.ok(block, 'aiVengeance method definition must be locatable');
  // The rush-speed line must use VENGEANCE_RUSH_SPD directly (no `* `
  // multiplication inside the moveToward call's spd argument).
  assert.match(block[0], /this\.moveToward\(this\._tx,\s*this\._ty,\s*VENGEANCE_RUSH_SPD,/,
    'rush moveToward must pass VENGEANCE_RUSH_SPD directly (no pre-multiplication)');
  // Negative assertion against the known-bad pattern
  const badPattern = /VENGEANCE_RUSH_SPD\s*\*\s*(ocMul|bm)/;
  assert.ok(!badPattern.test(block[0]),
    'aiVengeance must NOT pre-multiply VENGEANCE_RUSH_SPD by ocMul or bm (double-applies modifiers)');
});

test('notifyVengeance excludes _volatileKill incidental chain deaths', () => {
  // Caught by gpt-5.3-codex review: VOLATILE modifier explosions and
  // EXPLOSIVE_KILLS perk cascades mark victims with _volatileKill = true
  // before applying damage (entities.js:1256, 1334). The combo counter
  // already excludes these (entities.js:1167) on the same fairness
  // principle: the player intended to kill the trigger, not every
  // adjacent mob. notifyVengeance must do the same — otherwise an
  // EXPLOSIVE_KILLS player triggers retaliations from cascade kills
  // they did not consciously commit.
  const fn = ENTITY_DEATH_HOOKS.match(/function\s+notifyVengeance[\s\S]{0,1800}\n\}/);
  assert.ok(fn, 'notifyVengeance function body must be locatable');
  assert.match(fn[0], /deadEnemy\._volatileKill/,
    'notifyVengeance must skip _volatileKill incidental chain deaths');
});

// ─── Attribution ────────────────────────────────────────────────────────

test('VENGEANCE attribution rows present', () => {
  assert.match(SOURCE_METADATA, /SOURCE_LABELS[\s\S]{0,2200}VENGEANCE\s*:\s*'Vengeance'/);
  assert.match(SOURCE_METADATA, /SOURCE_COLOURS[\s\S]{0,2200}VENGEANCE\s*:\s*'#[0-9a-f]{6}'/i);
  assert.match(SOURCE_METADATA, /CREDIT_VALUES\s*=\s*\{[^}]*VENGEANCE\s*:\s*\d+/);
});

test('VENGEANCE draw branch renders a rush telegraph + charge pips', () => {
  // Pips show charge progress (player can SEE retaliation building);
  // rush telegraph gives the fairness window. Both visual signals MUST
  // exist or the mob's contract is invisible to the player.
  const drawBlock = ENTITIES.match(/this\.type\s*===\s*'VENGEANCE'[\s\S]{0,3500}ctx\.restore\(\);\s*\n\s*\}/);
  assert.ok(drawBlock, 'VENGEANCE draw block must be locatable');
  // Pips: at least one circle drawn during idle when charges > 0
  assert.match(drawBlock[0], /charges\s*>\s*0[\s\S]{0,1500}NEON\.draw\.circle\(/,
    'idle draw must render charge pips when charges > 0');
  // Telegraph: lock line via NEON.draw.line during the rush state
  assert.match(drawBlock[0], /this\._vgState\s*===\s*'rush'[\s\S]{0,2500}NEON\.draw\.line\(/,
    'rush draw must render a lock line via NEON.draw.line');
});

// ─── Service worker cache freshness ─────────────────────────────────────

test('sw.js cache freshness is not a numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
