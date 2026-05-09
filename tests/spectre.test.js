'use strict';
// SPECTRE mob — source-text wiring tests.
//
// entities.js is browser-only (no UMD/CommonJS exports), so we follow the
// same pattern as magneton.test.js / harvester.test.js: assert structural
// invariants the mob needs by regex-matching the source text.
//
// SPECTRE is a phase/manifest cycler — invulnerable & harmless during
// 'phase', vulnerable & dangerous during 'manifest'. The state machine
// is small and stateful (no pure helper to vm-extract), so we exercise
// the wiring contracts here and let runtime/CI cover the dynamics.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const SOURCE_METADATA = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'source-metadata.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('SPECTRE appears in ENEMY_WEIGHTS with floor 7+ gate', () => {
  const m = ENTITIES.match(/SPECTRE:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'SPECTRE must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 7, `SPECTRE minFloor should be >= 7, got ${m[1]}`);
});

test('SPECTRE has a stat row in spawnEnemy switch', () => {
  // Missing case → spawnEnemy returns an Enemy with hp=0, instantly dead.
  const m = ENTITIES.match(/case\s+'SPECTRE':[^\n]*hp\s*=\s*(\d+)[^\n]*atk\s*=\s*(\d+)[^\n]*spd\s*=\s*([\d.]+)[^\n]*xpVal\s*=\s*(\d+)/);
  assert.ok(m, 'SPECTRE stat row missing');
  // HP must be tunable for "killable in 1-2 manifest windows" — too high
  // and the mob feels like a wall, too low and it dies in one shot.
  // Anchor a sane band the design requires.
  const hp = parseInt(m[1], 10);
  assert.ok(hp >= 18 && hp <= 50, `SPECTRE hp should be in [18,50], got ${hp}`);
  // Must do contact damage during manifest — atk > 0.
  assert.ok(parseInt(m[2], 10) > 0, 'SPECTRE must have non-zero atk (contact damage in manifest)');
  // Must move during phase — spd > 0.
  assert.ok(parseFloat(m[3]) > 0, 'SPECTRE must be mobile (spd > 0) — phase chase is the threat');
});

test('SPECTRE spawn init block sets _spState and _spTimer', () => {
  // Without these the AI dispatch reads undefined, NaN math breaks the
  // state machine, and the mob is permanently stuck.
  const block = ENTITIES.match(/if\s*\(type\s*===\s*'SPECTRE'\)[\s\S]{0,500}\}/);
  assert.ok(block, 'SPECTRE init block missing');
  assert.match(block[0], /_spState\s*=\s*'phase'/, 'SPECTRE must start in phase');
  assert.match(block[0], /_spTimer\s*=/, 'SPECTRE must initialise _spTimer');
  // Stagger the timer with seeded spawn RNG so a clustered spawn doesn't
  // manifest in unison — the player should be able to pick off one per
  // window even when grouped.
  assert.match(block[0], /rand\('spawn'\)/, 'SPECTRE init must stagger _spTimer with the seeded spawn RNG');
  // Must also set phaseImmune so the FIRST frame after spawn (before AI
  // ticks) is correctly invulnerable. Otherwise a hit on the spawn frame
  // bypasses the phase contract.
  assert.match(block[0], /phaseImmune\s*=\s*true/, 'SPECTRE init must set phaseImmune=true');
});

test('SPECTRE is excluded from the elite affix roll', () => {
  // PHASING affix manages phaseImmune via its tick logic. SPECTRE's AI
  // also drives phaseImmune via its state machine. Allowing PHASING on
  // SPECTRE would create two writers for the same flag and produce
  // unreadable behaviour (immunity windows that don't match the
  // phase/manifest visual). Mirror the existing exclusion pattern.
  const re = /allowElite[\s\S]{0,1000}type\s*!==\s*'SPECTRE'/;
  assert.match(ENTITIES, re, 'SPECTRE must be in the elite-exclusion guard');
});

test('SPECTRE has CREDIT_VALUES entry', () => {
  // Without an entry, die() falls back to 5 credits — explicit entry
  // keeps reward tuning intentional.
  assert.match(SOURCE_METADATA, /SPECTRE\s*:\s*\d+/);
});

test('SPECTRE has SOURCE_LABELS entry', () => {
  // Required for damage recap / death log to show the friendly name
  // instead of the uppercase enum.
  assert.match(SOURCE_METADATA, /SPECTRE\s*:\s*'Spectre'/);
});

test('SPECTRE has SOURCE_COLOURS entry', () => {
  // Required so the damage recap log renders source-coloured rows.
  assert.match(SOURCE_METADATA, /SPECTRE\s*:\s*'#[0-9a-fA-F]{3,6}'/);
});

test('SPECTRE has AI dispatch case', () => {
  assert.match(ENTITIES, /case\s+'SPECTRE'\s*:\s*this\.aiSpectre\(/);
});

test('SPECTRE aiSpectre method exists with correct contract', () => {
  // Anchor on the method definition (no `this.` prefix and starts at
  // column 2) so we don't accidentally match the dispatch switch case.
  const fn = ENTITIES.match(/\n  aiSpectre\s*\([\s\S]*?\n  \}\n/);
  assert.ok(fn, 'aiSpectre method must exist');
  // Must distinguish phase vs manifest — both states are required.
  assert.match(fn[0], /'phase'/, 'aiSpectre must reference the phase state');
  assert.match(fn[0], /'manifest'/, 'aiSpectre must reference the manifest state');
  // Phase branch must set phaseImmune=true (drives the takeDamage
  // PHASE absorb path). Without this the "invulnerable chase" contract
  // is broken every frame.
  assert.match(fn[0], /phaseImmune\s*=\s*true/, 'aiSpectre phase branch must set phaseImmune=true');
  // Manifest branch must clear it (vulnerable window).
  assert.match(fn[0], /phaseImmune\s*=\s*false/, 'aiSpectre manifest branch must clear phaseImmune');
  // Phase branch must NOT call meleeAttack (no contact damage during
  // phase — that's the player skill axis: walk through safely). Only
  // the manifest branch should.
  const meleeMatches = fn[0].match(/this\.meleeAttack\(/g) || [];
  assert.strictEqual(meleeMatches.length, 1, 'aiSpectre must call this.meleeAttack exactly once (manifest branch only)');
  // Phase chase must use moveToward (with spd, dt, map) so the modSpeed
  // / berserker / slowFactor modifiers apply internally — never
  // pre-multiply.
  assert.match(fn[0], /moveToward\s*\(\s*this\._tx,\s*this\._ty,\s*this\.spd/,
    'aiSpectre phase chase must call moveToward with raw this.spd (modifiers apply internally)');
});

test('SPECTRE tuning constants are defined', () => {
  assert.match(ENTITIES, /const\s+SPECTRE_PHASE_DUR\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+SPECTRE_MANIFEST_DUR\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+SPECTRE_TELEGRAPH_DUR\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+SPECTRE_MELEE_RANGE\s*=\s*[\d.]+/);
});

test('SPECTRE phase window is longer than manifest window', () => {
  // Design contract: phase (the player can't damage you, you can't
  // damage them) must be the dominant state, with manifest as a brief
  // vulnerable window. If manifest >= phase, the player can spam DPS
  // most of the time and the timing skill axis collapses.
  const ph = ENTITIES.match(/const\s+SPECTRE_PHASE_DUR\s*=\s*([\d.]+)/);
  const mn = ENTITIES.match(/const\s+SPECTRE_MANIFEST_DUR\s*=\s*([\d.]+)/);
  assert.ok(ph && mn);
  assert.ok(parseFloat(ph[1]) > parseFloat(mn[1]),
    `phase (${ph[1]}) must be > manifest (${mn[1]}) — manifest is the brief vulnerable window`);
});

test('SPECTRE telegraph duration fits inside the phase window', () => {
  // The "solidify" alpha ramp lives in the last SPECTRE_TELEGRAPH_DUR
  // of the phase. If telegraph >= phase, the spectre is ALWAYS in
  // telegraph and the visual loses its meaning.
  const ph = ENTITIES.match(/const\s+SPECTRE_PHASE_DUR\s*=\s*([\d.]+)/);
  const tg = ENTITIES.match(/const\s+SPECTRE_TELEGRAPH_DUR\s*=\s*([\d.]+)/);
  assert.ok(ph && tg);
  assert.ok(parseFloat(tg[1]) < parseFloat(ph[1]),
    `telegraph (${tg[1]}) must be < phase (${ph[1]}) — telegraph is a sub-window`);
  // And telegraph must be > 0 — otherwise no warning frame at all.
  assert.ok(parseFloat(tg[1]) > 0, 'telegraph duration must be > 0');
});

test('SPECTRE stun handling forces immediate manifest', () => {
  // Without this, an EMP/Shock landing during phase freezes an
  // INVULNERABLE chaser in place — stun would be counter-productive.
  // Force-manifest clears phaseImmune so the player can punish the stun.
  // The fix lives inside the existing `if (this.stunTimer > 0)` block;
  // anchor on the SPECTRE-typed branch.
  const re = /this\.type\s*===\s*'SPECTRE'[\s\S]{0,300}_spState\s*=\s*'manifest'[\s\S]{0,200}phaseImmune\s*=\s*false/;
  assert.match(ENTITIES, re,
    'SPECTRE stun branch must force _spState=manifest and clear phaseImmune');
});

test('takeDamage already absorbs damage when phaseImmune is set', () => {
  // SPECTRE relies on the existing PHASING-affix damage absorb path —
  // takeDamage returns 0 when this.phaseImmune is truthy. If this
  // contract regresses, phase invulnerability breaks SILENTLY (the
  // mob takes damage despite the visual saying "phase"). Lock it.
  // Anchor on the actual code structure (early-return shape).
  const td = ENTITIES.match(/takeDamage\(dmg, hitCtx\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(td, 'takeDamage method not found');
  assert.match(td[0],
    /if\s*\(\s*this\.phaseImmune\s*\|\|\s*this\._wrPhased\s*\)\s*\{[\s\S]*?return\s+0\s*;/,
    'takeDamage must short-circuit to return 0 when phaseImmune or _wrPhased is true');
});

test('takeDamage routes stun-only weapon effects through phase immunity', () => {
  // Without this, Voltaic 'shock' shots at a phased SPECTRE only show
  // 'PHASE' and never set stunTimer — the "stun forces manifest"
  // counterplay can't trigger from shock weapons. Same latent bug
  // applies to WRAITH (_wrPhased). The fix lives in takeDamage's
  // phase-immune early return: call the stun-only effect helper
  // BEFORE returning 0.
  assert.match(ENTITIES, /function\s+_applyStunOnlyEffects\s*\(/,
    '_applyStunOnlyEffects helper must exist');
  // Helper must guard isProc (procs shouldn't re-stun) and check the
  // 'shock' effect specifically (not all weapon effects bypass).
  const helper = ENTITIES.match(/function\s+_applyStunOnlyEffects\s*\([\s\S]*?\n\}/);
  assert.ok(helper);
  assert.match(helper[0], /isProc/, 'stun-only helper must skip procs');
  assert.match(helper[0], /'shock'/, 'stun-only helper must check shock effect');
  assert.match(helper[0], /stunTimer/, 'stun-only helper must set stunTimer');
  assert.match(helper[0], /_shockICD/, 'stun-only helper must respect shock ICD');
  // The phase-immune early return must invoke the helper BEFORE returning.
  assert.match(ENTITIES,
    /if\s*\(\s*this\.phaseImmune\s*\|\|\s*this\._wrPhased\s*\)\s*\{[\s\S]{0,200}_applyStunOnlyEffects\s*\(\s*this\s*,/,
    'phase-immune early return must call _applyStunOnlyEffects');
});

test('SPECTRE draw branch consumes _spState for body alpha', () => {
  // The phase/manifest visual delta is THE telegraph for this mob.
  // If the draw branch doesn't read _spState, both states render
  // identically and the player can't time the vulnerability window.
  // Anchor on the alpha-modulation block where SPECTRE is handled.
  const re = /this\.type\s*===\s*'SPECTRE'[\s\S]{0,800}_spState[\s\S]{0,400}alpha/;
  assert.match(ENTITIES, re, 'draw branch must modulate alpha based on _spState');
});

test('SPECTRE draw branch renders manifest vulnerability ring', () => {
  // The bright pulsing ring is the "shoot now" signal for the manifest
  // window. Without it, the player has to read alpha changes alone,
  // which is harder under FOV dim/blackout modifiers.
  const re = /this\.type\s*===\s*'SPECTRE'\s*&&\s*this\._spState\s*===\s*'manifest'/;
  assert.match(ENTITIES, re, 'draw branch must have a manifest-only ring branch');
});

// ─── Behavioural test: vm-extract aiSpectre + constants and drive the
// state machine across a real timeline. Catches regressions where the
// timer math, state transitions, or phaseImmune flag drift from the
// design contract.

const vm = require('node:vm');

function loadSpectreSandbox() {
  const constMatches = ENTITIES.match(
    /const\s+SPECTRE_PHASE_DUR\s*=[\s\S]*?const\s+SPECTRE_STUN_MANIFEST\s*=\s*[\d.]+;/
  );
  if (!constMatches) throw new Error('SPECTRE constants block not found');
  const fnMatch = ENTITIES.match(/\n  aiSpectre\s*\([\s\S]*?\n  \}\n/);
  if (!fnMatch) throw new Error('aiSpectre method body not found');
  // Wrap as a free function (drop the leading whitespace + method name
  // notation, prepend `function aiSpectre`).
  const body = fnMatch[0].replace(/^\n  aiSpectre/, 'function aiSpectre');
  const sandbox = {
    spawnParticles: () => {},
    moveToward(_tx, _ty, _spd, _dt, _map) { this._moveCalls = (this._moveCalls || 0) + 1; },
    patrol(_dt, _map) { this._patrolCalls = (this._patrolCalls || 0) + 1; },
    meleeAttack(_p) { this._meleeCalls = (this._meleeCalls || 0) + 1; },
    _canTarget() { return true; },
  };
  vm.createContext(sandbox);
  vm.runInContext(`${constMatches[0]}\n${body}\nthis.aiSpectre = aiSpectre;\nthis.SPECTRE_PHASE_DUR = SPECTRE_PHASE_DUR;\nthis.SPECTRE_MANIFEST_DUR = SPECTRE_MANIFEST_DUR;`, sandbox);
  return sandbox;
}

function makeEnemy(sandbox) {
  // Bind the helper methods so `this.moveToward(...)` etc work inside
  // aiSpectre (which is invoked with .call(enemy, ...)).
  return {
    x: 5, y: 5,
    _tx: 6, _ty: 5,
    spd: 2.4,
    _spState: 'phase',
    _spTimer: sandbox.SPECTRE_PHASE_DUR,
    phaseImmune: true,
    _moveCalls: 0, _patrolCalls: 0, _meleeCalls: 0,
    moveToward: sandbox.moveToward,
    patrol: sandbox.patrol,
    meleeAttack: sandbox.meleeAttack,
    _canTarget: sandbox._canTarget,
  };
}

test('aiSpectre: phase → manifest transition flips phaseImmune false and resets timer', () => {
  const sb = loadSpectreSandbox();
  const e = makeEnemy(sb);
  // Tick just past the phase duration. Use one big-ish dt so we cross
  // the boundary in a single call (the implementation must handle this
  // — fixed-frame games can have long dt under hitch).
  sb.aiSpectre.call(e, sb.SPECTRE_PHASE_DUR + 0.01, {}, [], 1, true);
  assert.strictEqual(e._spState, 'manifest', 'state must transition to manifest');
  assert.strictEqual(e.phaseImmune, false, 'phaseImmune must clear on manifest');
  assert.ok(e._spTimer > 0 && e._spTimer <= sb.SPECTRE_MANIFEST_DUR + 0.01,
    `_spTimer must be reset to manifest window, got ${e._spTimer}`);
});

test('aiSpectre: manifest → phase transition restores phaseImmune true', () => {
  const sb = loadSpectreSandbox();
  const e = makeEnemy(sb);
  e._spState = 'manifest'; e._spTimer = 0.01; e.phaseImmune = false;
  sb.aiSpectre.call(e, 0.05, {}, [], 5, false);
  assert.strictEqual(e._spState, 'phase');
  assert.strictEqual(e.phaseImmune, true, 'phaseImmune must re-arm on phase');
  assert.ok(Math.abs(e._spTimer - sb.SPECTRE_PHASE_DUR) < 1e-9);
});

test('aiSpectre: phase chases (calls moveToward) and does NOT melee', () => {
  const sb = loadSpectreSandbox();
  const e = makeEnemy(sb);
  // Player adjacent — would melee if this were manifest.
  sb.aiSpectre.call(e, 0.05, {}, [], 0.5, true);
  assert.ok(e._moveCalls >= 1, 'phase must call moveToward');
  assert.strictEqual(e._meleeCalls, 0, 'phase must NEVER call meleeAttack (no contact damage)');
});

test('aiSpectre: manifest is stationary (no moveToward) and melees on adjacency', () => {
  const sb = loadSpectreSandbox();
  const e = makeEnemy(sb);
  e._spState = 'manifest'; e._spTimer = sb.SPECTRE_MANIFEST_DUR; e.phaseImmune = false;
  sb.aiSpectre.call(e, 0.05, {}, [], 0.5, true);
  assert.strictEqual(e._moveCalls, 0, 'manifest must NOT chase (stationary vulnerability window)');
  assert.strictEqual(e._meleeCalls, 1, 'manifest must call meleeAttack when adjacent');
});

test('aiSpectre: manifest does NOT melee when out of range', () => {
  const sb = loadSpectreSandbox();
  const e = makeEnemy(sb);
  e._spState = 'manifest'; e._spTimer = sb.SPECTRE_MANIFEST_DUR; e.phaseImmune = false;
  // d well outside SPECTRE_MELEE_RANGE.
  sb.aiSpectre.call(e, 0.05, {}, [], 5, true);
  assert.strictEqual(e._meleeCalls, 0, 'manifest must NOT melee at distance');
});

test('aiSpectre: full cycle (phase → manifest → phase) completes timer math without NaN', () => {
  const sb = loadSpectreSandbox();
  const e = makeEnemy(sb);
  let t = 0; const dt = 0.05;
  const transitions = [];
  let last = e._spState;
  while (t < 5.0) {
    sb.aiSpectre.call(e, dt, {}, [], 1, true);
    if (e._spState !== last) { transitions.push(e._spState); last = e._spState; }
    assert.ok(Number.isFinite(e._spTimer), `_spTimer must stay finite, got ${e._spTimer}`);
    t += dt;
  }
  // Must have cycled at least once: phase → manifest → phase → manifest.
  assert.ok(transitions.length >= 2, `expected >=2 transitions in 5s, got ${transitions.length} (${transitions})`);
  assert.strictEqual(transitions[0], 'manifest', 'first transition must be → manifest');
  assert.strictEqual(transitions[1], 'phase', 'second transition must be → phase');
});
