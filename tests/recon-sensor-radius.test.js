'use strict';
// RECON meta upgrade — sensor-radius wiring tests.
//
// BUG FIX: prior to this commit, `sensorRadiusMult` was set by the recon
// meta upgrade handler (src/meta/save.js:291, ×1.20 per level up to L3)
// AND persisted in saveGame / restored in continueGame, but NEVER READ
// to actually widen the player FOV / minimap reveal radius. Players
// paying cores (3+6+9 = 18 for L3) for recon got nothing. The upgrade
// description (src/meta/upgrades.js:38) advertises "+20% sensor radius
// (minimap reveal) per level" — a contract the code was silently breaking.
//
// FIX: src/content.js updateLighting now multiplies the base FOV radius
// (9 normally, 5 under BLACKOUT) by player.sensorRadiusMult and rounds
// to an integer tile count. The same loop writes dungeon.visited[y][x]
// for every tile within `r`, so widening `r` widens both the lit area
// AND the minimap reveal — matching the upgrade contract.
//
// Adds `_fovSensor` to the FOV cache key so any future mid-run mutation
// of sensorRadiusMult triggers a recompute. (sensorRadiusMult is currently
// applied once at run start, but the cache-key add is defensive so a
// future "sensor boost" pickup wouldn't desync.)
//
// Counter-invariant: the dash-distance / dashTimer-style accidental
// extension is NOT possible here — `r` is a local const recomputed each
// call (when the cache misses), so changes scope to the FOV pass only.
//
// content.js is browser-only — these are source-text wiring tests using
// the canonical brace-walked branch extraction pattern (per stored memory
// 'test source-text extraction'), supplemented by a node-runnable
// applyMetaToPlayer behavioural check via src/meta/save.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const SAVE = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'save.js'), 'utf8'
);
const UPGRADES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'upgrades.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const CONTENT_CODE = stripComments(CONTENT);

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

test('recon meta upgrade is registered with the +20% sensor contract', () => {
  // Description anchor: if a future re-tune shifts the percentage without
  // updating save.js's handler OR the content.js read site, this test
  // catches the divergence.
  assert.match(UPGRADES, /id:\s*'recon'/,
    'recon upgrade id must be registered in upgrades.js');
  assert.match(UPGRADES, /effect:\s*'[^']*\+20%[^']*sensor[^']*per level[^']*'/i,
    'recon upgrade must advertise "+20% sensor radius (minimap reveal) per level" — the contract this fix delivers');
});

test('save.js recon handler still writes sensorRadiusMult = ×(1 + 0.20 * level)', () => {
  // The handler was correct before this fix — what was missing was the
  // READ. Pin the write so that a future refactor can't silently drop
  // the field assignment (which would make the bug come back).
  assert.match(SAVE, /case\s*'recon'\s*:[\s\S]*?player\.sensorRadiusMult\s*=\s*\(\s*player\.sensorRadiusMult\s*\|\|\s*1\s*\)\s*\*\s*\(\s*1\s*\+\s*0\.20\s*\*\s*level\s*\)/,
    "save.js recon handler must set player.sensorRadiusMult *= (1 + 0.20 * level)");
});

test('updateLighting reads _CG.player.sensorRadiusMult to widen the FOV radius (the bug-fix wire)', () => {
  // THE bug fix: without this read, sensorRadiusMult is set/persisted
  // but the FOV (and the minimap-reveal piggybacked on it) never widens.
  // Brace-walked extraction anchored on the function header so the
  // assertion is scoped to updateLighting.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+updateLighting\s*\(\s*dungeon\s*,\s*px\s*,\s*py\s*\)\s*\{/
  );
  assert.ok(fnBody, 'updateLighting function body must be locatable');
  // `let sensorMult = ...` (mutable so sanitization can rewrite invalid /
  // out-of-range values in place — see the sanitization test below).
  assert.match(fnBody,
    /let\s+sensorMult\s*=\s*\(\s*_CG\.player\s*&&\s*_CG\.player\.sensorRadiusMult\s*\)\s*\|\|\s*1\s*;/,
    'updateLighting must read let sensorMult = (_CG.player && _CG.player.sensorRadiusMult) || 1;');
  assert.match(fnBody,
    /const\s+r\s*=\s*Math\.max\(\s*1\s*,\s*Math\.round\(\s*baseR\s*\*\s*sensorMult\s*\)\s*\)\s*;/,
    'updateLighting must compute const r = Math.max(1, Math.round(baseR * sensorMult));');
});

test('updateLighting sanitizes sensorMult against NaN / Infinity / negative / non-numeric (corrupted save defence)', () => {
  // localStorage is user-writable; tampered/corrupted save data could
  // deliver _CG.player.sensorRadiusMult = NaN ("foo"), Infinity, 0, or
  // a negative number. Without sanitization:
  //   - "foo" -> Math.round(9 * NaN) = NaN -> Math.max(1, NaN) = NaN
  //     -> dy<=NaN is false, FOV blanks, player can see nothing.
  //   - 1e309 (Infinity) -> Math.round(9*Inf) = Infinity, the per-tile
  //     loop would attempt to iterate ~Infinity times — frame freeze.
  //   - 0 / negative -> r <= 0 -> Math.max(1, ...) saves us, but a
  //     defensive caller wants the canonical 1.0 fallback so the cache
  //     key (_fovSensor) is stable.
  // Pin the three guards: isFinite, > 0, and the upper-bound clamp.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+updateLighting\s*\(\s*dungeon\s*,\s*px\s*,\s*py\s*\)\s*\{/
  );
  assert.ok(fnBody, 'updateLighting body must be locatable');
  assert.match(fnBody,
    /if\s*\(\s*!Number\.isFinite\(\s*sensorMult\s*\)\s*\|\|\s*sensorMult\s*<=\s*0\s*\)\s*sensorMult\s*=\s*1\s*;/,
    'updateLighting must reset sensorMult to 1 when !isFinite or <= 0');
  assert.match(fnBody,
    /if\s*\(\s*sensorMult\s*>\s*8\s*\)\s*sensorMult\s*=\s*8\s*;/,
    'updateLighting must clamp sensorMult to <= 8 (defends against Infinity / pathological save tampering)');
});

test('updateLighting baseR retains BLACKOUT=5 / default=9 ternary', () => {
  // The pre-fix expression `r = mod === 'BLACKOUT' ? 5 : 9` becomes
  // `baseR = mod === 'BLACKOUT' ? 5 : 9` (rename only; semantics preserved).
  // If a future refactor accidentally dropped the BLACKOUT clamp (or the
  // 9-tile default), runs would silently regress to 1 tile or unbounded.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+updateLighting\s*\(\s*dungeon\s*,\s*px\s*,\s*py\s*\)\s*\{/
  );
  assert.ok(fnBody, 'updateLighting body must be locatable');
  assert.match(fnBody,
    /const\s+baseR\s*=\s*mod\s*===\s*'BLACKOUT'\s*\?\s*5\s*:\s*9\s*;/,
    "updateLighting must preserve baseR = mod === 'BLACKOUT' ? 5 : 9 (BLACKOUT clamp must survive the wire)");
});

test('updateLighting FOV cache key includes _fovSensor (defensive — recomputes on sensorMult change)', () => {
  // sensorRadiusMult is currently set once at run start and constant for
  // the run. But the cache key (_fovTx, _fovTy, _fovMod) didn't reference
  // it, so a future "in-run sensor boost" mechanic would silently desync
  // the cached FOV with the current radius. Pin the key extension so this
  // class of bug can't sneak in later.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+updateLighting\s*\(\s*dungeon\s*,\s*px\s*,\s*py\s*\)\s*\{/
  );
  assert.ok(fnBody, 'updateLighting body must be locatable');
  assert.match(fnBody, /dungeon\._fovSensor\s*===\s*sensorMult/,
    'updateLighting cache check must include `dungeon._fovSensor === sensorMult`');
  assert.match(fnBody, /dungeon\._fovSensor\s*=\s*sensorMult\s*;/,
    'updateLighting must store dungeon._fovSensor = sensorMult; after a recompute');
});

test('updateLighting visited-tile flip remains inside the r-bounded loop (so widening r widens minimap reveal)', () => {
  // The dungeon.visited[y][x] = 1 write at line ~3468 is the SOLE
  // mechanism by which the minimap learns about a tile (modulo
  // ECHO_MAPPER / RECON_PING). It MUST stay inside the loop bounded
  // by `r` (the same `r` we just made sensor-aware) for the upgrade's
  // "minimap reveal" half of its contract to hold. Lift it out of
  // the loop or move it to a fixed-radius scan and you've broken
  // the wire on the visited side without touching the visible side.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+updateLighting\s*\(\s*dungeon\s*,\s*px\s*,\s*py\s*\)\s*\{/
  );
  assert.ok(fnBody, 'updateLighting body must be locatable');
  // The visited flip is structurally inside the dy-bounded inner loop;
  // pin both the loop opener (using r) and the flip in the same body.
  assert.match(fnBody, /for\s*\(\s*let\s+dy\s*=\s*-r\s*;\s*dy\s*<=\s*r\s*;\s*dy\+\+\s*\)/,
    'FOV pass must iterate dy in [-r, r] (using sensor-scaled r)');
  assert.match(fnBody, /for\s*\(\s*let\s+dx\s*=\s*-r\s*;\s*dx\s*<=\s*r\s*;\s*dx\+\+\s*\)/,
    'FOV pass must iterate dx in [-r, r] (using sensor-scaled r)');
  assert.match(fnBody, /if\s*\(\s*!dungeon\.visited\[y\]\[x\]\s*\)\s*\{\s*dungeon\.visited\[y\]\[x\]\s*=\s*1\s*;/,
    'FOV pass must still set dungeon.visited[y][x] = 1 inside the r-bounded loop');
});

test('updateLighting circular distance cutoff `if (d > r) continue` uses sensor-scaled r (not baseR)', () => {
  // Catches a subtle mutation that keeps the dy/dx loop bounded by the
  // new (widened) r BUT clamps the circular cutoff to the old baseR —
  // which would silently regress the recon effect to baseline 9-tile
  // reach, because tiles in the [baseR, r] annulus would all be skipped
  // by `if (d > baseR) continue;`. The dy/dx assertions above can't
  // catch this because both still iterate -r..r. Pin the radial gate.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+updateLighting\s*\(\s*dungeon\s*,\s*px\s*,\s*py\s*\)\s*\{/
  );
  assert.ok(fnBody, 'updateLighting body must be locatable');
  assert.match(fnBody, /if\s*\(\s*d\s*>\s*r\s*\)\s*continue\s*;/,
    'FOV circular cutoff must be `if (d > r) continue;` — using the sensor-scaled r');
  assert.ok(!/if\s*\(\s*d\s*>\s*baseR\s*\)\s*continue\s*;/.test(fnBody),
    'FOV circular cutoff must NOT use baseR — that would regress recon to baseline reach');
});

test('updateLighting r is integer-rounded and clamped to >= 1 (no fractional / zero radius)', () => {
  // Math.round protects the dy/dx <= r comparison (no fractional skips).
  // Math.max(1, ...) protects against pathological multipliers (e.g. the
  // never-set / zeroed-out edge case where sensorRadiusMult somehow
  // becomes 0 — would blank the player's vision entirely). Both clamps
  // are surgical and cheap; pin them so a refactor can't drop them.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+updateLighting\s*\(\s*dungeon\s*,\s*px\s*,\s*py\s*\)\s*\{/
  );
  assert.ok(fnBody, 'updateLighting body must be locatable');
  assert.match(fnBody,
    /Math\.max\(\s*1\s*,\s*Math\.round\([^)]*\)\s*\)/,
    'updateLighting r must be Math.max(1, Math.round(...)) — integer + non-zero clamp');
});

test('saveGame still persists sensorRadiusMult and continueGame restores it (run-state contract preserved)', () => {
  // The persistence path was already correct pre-fix. Pin it so the
  // wire's effect survives save → reload (the bug-fix value flows
  // through reloads, not just first-run).
  assert.match(GAME, /sensorRadiusMult:\s*p\.sensorRadiusMult\s*\|\|\s*1/,
    'saveGame snapshot must include sensorRadiusMult: p.sensorRadiusMult || 1');
  assert.match(GAME, /if\s*\(\s*s\.sensorRadiusMult\s*!==\s*undefined\s*\)\s*p\.sensorRadiusMult\s*=\s*s\.sensorRadiusMult\s*;/,
    'continueGame must restore p.sensorRadiusMult from snapshot');
});

test('applyMetaToPlayer (node-runnable): recon L1/L3 produce sensorRadiusMult of 1.20 / 1.60 (additive)', () => {
  // Behavioural sanity check using the actual save.js applyMetaToPlayer
  // path (loads from storage; mirrors the upgrades.test.js idiom). This
  // is the value the new updateLighting wire reads. The handler is
  // ADDITIVE per node-level (save.js:291: *= (1 + 0.20 * level)), called
  // once per node with level=N — NOT compound. So sensorRadiusMult goes
  // 1.00 (L0) → 1.20 (L1) → 1.40 (L2) → 1.60 (L3).
  // With baseR=9, the resulting integer radii are:
  //   L0: r = round(9 * 1.00) = 9       (baseline)
  //   L1: r = round(9 * 1.20) = 11
  //   L2: r = round(9 * 1.40) = 13
  //   L3: r = round(9 * 1.60) = 14
  // Under BLACKOUT (baseR=5):
  //   L0: 5  L1: 6  L2: 7  L3: round(5*1.60)=8 (close to baseline 9 vision)
  // — recon at L3 lets you nearly recover baseline vision under BLACKOUT,
  // a clear quality-of-life justification for the 18-core investment.
  const save = require('../src/meta/save.js');

  function makeFakeStorage(initial) {
    const map = new Map(Object.entries(initial || {}));
    return {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: k => { map.delete(k); },
    };
  }

  // L3
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ version: 2, upgradeNodes: { recon: 3 } })
  }));
  const player = { metaFlags: {} };
  save.applyMetaToPlayer(player);
  // 1.20 * 1.20 * 1.20 = 1.728 (compound — the handler uses *= (1 + 0.20*level)
  // applied once per node level via _applyNode's level argument).
  // Note: _applyNode is called once per node with level=N, so the formula is
  // (1 + 0.20 * 3) = 1.60, NOT compound. Pin whichever the implementation does.
  // (See save.js:291: player.sensorRadiusMult = (... || 1) * (1 + 0.20 * level).)
  assert.ok(Math.abs(player.sensorRadiusMult - 1.60) < 1e-9,
    'recon L3 must produce sensorRadiusMult = 1.60 (additive: 1 + 0.20*3); got ' + player.sensorRadiusMult);
  save._setStorageForTests(null);

  // L1
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ version: 2, upgradeNodes: { recon: 1 } })
  }));
  const player2 = { metaFlags: {} };
  save.applyMetaToPlayer(player2);
  assert.ok(Math.abs(player2.sensorRadiusMult - 1.20) < 1e-9,
    'recon L1 must produce sensorRadiusMult = 1.20; got ' + player2.sensorRadiusMult);
  save._setStorageForTests(null);

  // Round computation must match what the FOV reads — pin it here too
  // so a future refactor that swaps Math.round for Math.floor / Math.ceil
  // breaks loudly.
  const baseR = 9;
  assert.equal(Math.max(1, Math.round(baseR * player.sensorRadiusMult)), 14,
    'baseR=9 with sensorRadiusMult=1.60 must round to r=14');
  assert.equal(Math.max(1, Math.round(baseR * player2.sensorRadiusMult)), 11,
    'baseR=9 with sensorRadiusMult=1.20 must round to r=11');

  const blackoutR = 5;
  assert.equal(Math.max(1, Math.round(blackoutR * player.sensorRadiusMult)), 8,
    'BLACKOUT baseR=5 with sensorRadiusMult=1.60 must round to r=8 (close to baseline 9)');
});

test('updateLighting still uses _CG (the cross-file game proxy), not a fresh global', () => {
  // content.js's _CG proxy is the canonical bridge to the runtime game
  // object. The recon read MUST go through _CG.player to pick up the
  // live player (post applyMetaToPlayer / post save restore). A common
  // failure mode would be `globalThis.game.player.sensorRadiusMult` or
  // a literal `game.player...` reference — both would bypass the proxy
  // and break in any context where `_CG` is the sanctioned access path.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+updateLighting\s*\(\s*dungeon\s*,\s*px\s*,\s*py\s*\)\s*\{/
  );
  assert.ok(fnBody, 'updateLighting body must be locatable');
  // The read must be exactly _CG.player.sensorRadiusMult — no other
  // accessor variant should sneak in.
  assert.ok(!/\bgame\.player\.sensorRadiusMult\b/.test(fnBody),
    'updateLighting must NOT read game.player.sensorRadiusMult directly — use the _CG proxy');
  assert.ok(!/globalThis\.[A-Za-z_]*sensorRadiusMult/.test(fnBody),
    'updateLighting must NOT read sensorRadiusMult via globalThis — use the _CG proxy');
});
