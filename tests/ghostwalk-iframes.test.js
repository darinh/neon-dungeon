'use strict';
// GHOSTWALK meta upgrade — dash i-frame extension wiring tests.
//
// BUG FIX: prior to this commit, `dashIFrameBonus` was set by the
// ghostwalk meta upgrade handler (src/meta/save.js:297, +0.2 per level
// up to L2) AND persisted in saveGame / restored in continueGame, but
// NEVER READ to actually extend dash invulnerability frames. Players
// paying shards for ghostwalk got nothing. The upgrade description
// (src/meta/upgrades.js:40) advertises "Dash has 0.2s extra i-frames
// (per level)" — a contract the code was silently breaking.
//
// FIX: introduce `_dashIFrameTimer` that decouples the dash MOVEMENT
// duration (still 0.12s via dashTimer) from the dash IMMUNITY window
// (0.12 + dashIFrameBonus via _dashIFrameTimer). The new timer is:
//   - SET at dash start to 0.12 + (dashIFrameBonus || 0).
//   - TICKED down each frame in Player.update.
//   - READ in isPlayerDamageImmune so env hazards (toxic/plasma/arc/
//     frost patches) AND mob damage paths (via takeDamage's
//     options.ignoreImmunity → isPlayerDamageImmune call) both honour
//     the extension uniformly.
//
// Crucially: dash MOVEMENT is unchanged — Player.update's dash-active
// block (`if (this.dashTimer > 0)`) still ends movement at 0.12s. Only
// the immunity window extends. This is the design intent the upgrade
// description implies and avoids the side effect of "ghostwalk also
// makes you dash 3x further" (which would be a broken balance).
//
// content.js / entities.js are browser-only — these tests are
// source-text wiring tests using brace-walked branch extraction
// (per stored memory 'test source-text extraction').

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const SAVE = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'save.js'), 'utf8'
);
const UPGRADES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'upgrades.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const CONTENT_CODE = stripComments(CONTENT);
const ENTITIES_CODE = stripComments(ENTITIES);

/**
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBranch(src, openerRe) {
  const m = src.match(openerRe);
  if (!m) return null;
  const startIdx = m.index + m[0].length;
  let depth = 1;
  for (let i = startIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

test('ghostwalk meta upgrade is registered with the +0.2 i-frame contract', () => {
  // The bug-fix anchor: the upgrade description must continue to advertise
  // exactly what the code now delivers. If a future re-tune changes the
  // description (e.g., to 0.3 per level) without updating save.js's handler
  // OR the dash code, this test catches the divergence.
  assert.match(UPGRADES, /id:\s*'ghostwalk'/,
    'ghostwalk upgrade id must be registered in upgrades.js');
  assert.match(UPGRADES, /effect:\s*'[^']*0\.2s[^']*i-frames[^']*per level[^']*'/i,
    'ghostwalk upgrade must advertise "0.2s extra i-frames (per level)" — the contract this fix delivers');
});

test('save.js ghostwalk handler still writes dashIFrameBonus = 0.2 * level', () => {
  // The handler was correct before this fix — what was missing was the
  // READ. Pin the write so that a future refactor can't silently drop
  // the field assignment (which would make the bug come back).
  assert.match(SAVE, /case\s*'ghostwalk'\s*:[\s\S]*?player\.dashIFrameBonus\s*=\s*\(\s*player\.dashIFrameBonus\s*\|\|\s*0\s*\)\s*\+\s*0\.2\s*\*\s*level/,
    'save.js ghostwalk handler must set player.dashIFrameBonus += 0.2 * level');
});

test('isPlayerDamageImmune reads _dashIFrameTimer (the bug-fix wire)', () => {
  // THE bug fix: without this gate, dashIFrameBonus is set but the
  // immunity window never extends past dashTimer's 0.12s. Brace-walked
  // extraction anchored on the function header so the assertion is
  // scoped to isPlayerDamageImmune and not a similarly-named field
  // elsewhere in the file.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+isPlayerDamageImmune\s*\(\s*\)\s*\{/
  );
  assert.ok(fnBody, 'isPlayerDamageImmune function body must be locatable');
  assert.match(fnBody, /\(\s*p\._dashIFrameTimer\s*\|\|\s*0\s*\)\s*>\s*0/,
    'isPlayerDamageImmune must gate on (p._dashIFrameTimer || 0) > 0');
  assert.match(fnBody, /return\s+true\s*;/,
    'isPlayerDamageImmune _dashIFrameTimer branch must return true (immune)');
});

test('Player.shoot dash block sets _dashIFrameTimer = 0.12 + dashIFrameBonus', () => {
  // The set must happen at dash start, alongside the dashTimer = 0.12
  // assignment. Brace-walked extraction anchored on `this.dashTimer=0.12;`
  // followed by the dashCooldown line so we capture only the dash-start
  // block, not unrelated dashTimer references elsewhere in the file.
  // Pin the literal `0.12 + (this.dashIFrameBonus || 0)` so a refactor
  // that drops the additive cannot silently regress the bug fix.
  assert.match(ENTITIES_CODE,
    /this\.dashTimer\s*=\s*0\.12\s*;[\s\S]{0,400}?this\._dashIFrameTimer\s*=\s*0\.12\s*\+\s*\(\s*this\.dashIFrameBonus\s*\|\|\s*0\s*\)/,
    'Player.shoot dash start must set this._dashIFrameTimer = 0.12 + (this.dashIFrameBonus || 0) immediately after this.dashTimer = 0.12');
});

test('Player.update ticks _dashIFrameTimer down with dt (so the immunity expires)', () => {
  // Without the tick, _dashIFrameTimer would set on first dash and stay
  // > 0 forever — permanent invulnerability. The Math.max(0, x - dt)
  // pattern matches the surrounding adrenalineTimer / reactiveArmorCD /
  // dashCooldown ticks (canonical dt-based timer decay).
  assert.match(ENTITIES_CODE,
    /this\._dashIFrameTimer\s*=\s*Math\.max\(\s*0\s*,\s*\(\s*this\._dashIFrameTimer\s*\|\|\s*0\s*\)\s*-\s*dt\s*\)/,
    'Player.update must tick this._dashIFrameTimer = Math.max(0, (this._dashIFrameTimer || 0) - dt)');
});

test('_dashIFrameTimer is declared as a typed Player field (// @ts-check compliance)', () => {
  // src/entities.js has `// @ts-check` enabled — every field used on
  // the class must be declared so tsc's no-implicit-any-properties
  // gate stays clean. PIERCING_HEART / OVERCHARGE pattern.
  assert.match(ENTITIES,
    /\/\*\*\s*@type\s*\{any\}\s*\*\/\s*_dashIFrameTimer\s*;/,
    'Player class must declare /** @type {any} */ _dashIFrameTimer; for // @ts-check');
});

test('dashTimer and _dashIFrameTimer are SET in the same dash block (so the immunity always covers movement)', () => {
  // The two timers must be siblings: every dash that sets dashTimer
  // MUST also set _dashIFrameTimer. If a future refactor split the
  // dash into multiple entry points and only updated one, the immunity
  // gate would be inconsistent (dash with no immunity is the original
  // bug recurrence). Verify both assignments live within ~400 chars
  // of each other (the actual gap is ~10 chars; the slack catches
  // intentional decoupling without flagging cosmetic re-orderings).
  const dashTimerIdx = ENTITIES_CODE.indexOf('this.dashTimer=0.12');
  const iframeIdx = ENTITIES_CODE.indexOf('this._dashIFrameTimer = 0.12 + (this.dashIFrameBonus');
  assert.ok(dashTimerIdx !== -1, 'this.dashTimer=0.12 must be locatable in source');
  assert.ok(iframeIdx !== -1, 'this._dashIFrameTimer set must be locatable in source');
  assert.ok(Math.abs(iframeIdx - dashTimerIdx) < 400,
    'this._dashIFrameTimer SET must live within ~400 chars of this.dashTimer=0.12 (i.e. same dash entry block)');
});

test('isPlayerDamageImmune retains all four invulnerability gates (dashTimer / cloak / spawnGrace / _dashIFrameTimer)', () => {
  // Defense in depth — adding the new gate must not have inadvertently
  // dropped one of the existing gates (dashTimer for active dash,
  // cloakTimer for hackware cloak, _spawnGraceTimer for floor entry).
  // Brace-walked function-body extraction keeps the assertion scoped.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+isPlayerDamageImmune\s*\(\s*\)\s*\{/
  );
  assert.ok(fnBody, 'isPlayerDamageImmune body must be locatable');
  assert.match(fnBody, /p\.dashTimer\s*>\s*0/,
    'isPlayerDamageImmune must retain the p.dashTimer > 0 gate');
  assert.match(fnBody, /p\.cloakTimer\s*>\s*0/,
    'isPlayerDamageImmune must retain the p.cloakTimer > 0 gate');
  assert.match(fnBody, /\(\s*p\._spawnGraceTimer\s*\|\|\s*0\s*\)\s*>\s*0/,
    'isPlayerDamageImmune must retain the (p._spawnGraceTimer || 0) > 0 gate');
  assert.match(fnBody, /\(\s*p\._dashIFrameTimer\s*\|\|\s*0\s*\)\s*>\s*0/,
    'isPlayerDamageImmune must include the new (p._dashIFrameTimer || 0) > 0 gate');
});

test('dash MOVEMENT block is still gated on dashTimer (NOT _dashIFrameTimer) — distance is unchanged', () => {
  // Critical design invariant: ghostwalk extends IMMUNITY but NOT dash
  // distance. The active-dash movement block (entities.js:11740 area)
  // must continue to gate on `this.dashTimer > 0`, not on
  // `_dashIFrameTimer > 0`. If a future refactor swapped the gate,
  // ghostwalk L2 would push the dash distance from 0.12 * 18 = 2.16
  // tiles to 0.52 * 18 = 9.36 tiles — a 4.3x reach extension that
  // would shatter every encounter design.
  // Anchor on the executable signature of the block (dashTimer-=dt
  // followed by const dashSpd=18) rather than the "Active dash
  // movement" comment, which stripComments would discard.
  assert.match(ENTITIES_CODE,
    /if\s*\(\s*this\.dashTimer\s*>\s*0\s*\)\s*\{[\s\S]{0,200}?this\.dashTimer\s*-=\s*dt\s*;[\s\S]{0,200}?const\s+dashSpd\s*=\s*18/,
    'Active dash movement block must still gate on this.dashTimer > 0 (not _dashIFrameTimer) so ghostwalk does NOT extend dash distance');
});

test('_dashIFrameTimer set is unconditional on bonus value (base dash flows through new gate)', () => {
  // Players WITHOUT ghostwalk get _dashIFrameTimer = 0.12 + 0 = 0.12,
  // which matches dashTimer's lifetime — no behaviour change. Gating
  // the SET on `dashIFrameBonus > 0` would create an asymmetric code
  // path (with-bonus uses _dashIFrameTimer; without-bonus only uses
  // dashTimer) and complicate isPlayerDamageImmune reasoning. Pin the
  // unconditional set: the literal does NOT live inside an
  // `if (...dashIFrameBonus...)` guard.
  // Look for the SET line — the closest enclosing `if (` line should
  // NOT mention dashIFrameBonus.
  const setIdx = ENTITIES_CODE.indexOf('this._dashIFrameTimer = 0.12 + (this.dashIFrameBonus');
  assert.ok(setIdx !== -1, '_dashIFrameTimer SET must be locatable');
  // Walk backwards 200 chars and check there's no `if (` containing dashIFrameBonus
  const slice = ENTITIES_CODE.slice(Math.max(0, setIdx - 200), setIdx);
  assert.ok(!/if\s*\([^)]*dashIFrameBonus[^)]*\)\s*\{[^{}]*$/.test(slice),
    '_dashIFrameTimer SET must NOT be guarded by `if (...dashIFrameBonus...)` — base dash also flows through this gate');
});
