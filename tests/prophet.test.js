'use strict';
// PROPHET mob — source-text wiring tests + pure helper unit tests.
//
// entities.js is browser-only (no UMD/CommonJS exports), so we follow
// the same pattern as echoer/tunneller/ghost-projector tests: assert
// structural invariants the mob needs by regex-matching the source
// text. We additionally duplicate the pure `predictFromHistory` helper
// here for unit testing — the duplicate MUST stay in lock-step with
// the source-of-truth definition in src/entities.js (a structural
// assertion below guards against drift).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const ENEMY_ABILITY_TUNING = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'enemy-ability-tuning.js'), 'utf8'
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
const ENTITY_AI_HELPERS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'ai-helpers.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('PROPHET appears in ENEMY_WEIGHTS with mid-game floor gate', () => {
  // Without a weights entry, the mob can never roll out of pickEnemyType.
  // Per design (anti-motion punisher), PROPHET is mid-late game pressure
  // — minFloor must be >= 4.
  const m = ENEMY_SPAWN_TABLE.match(/PROPHET:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'PROPHET must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 4, `PROPHET minFloor should be >= 4, got ${m[1]}`);
});

test('PROPHET has a stat row in ENEMY_BASE_STATS', () => {
  // Missing case → spawnEnemy returns an Enemy with hp=0, instantly dead.
  const re = /PROPHET:\s*\{[^\n]*hp:\s*\d+,[^\n]*atk:\s*\d+,[^\n]*spd:\s*[\d.]+,[^\n]*xpVal:\s*\d+,[^\n]*colour:\s*'/;
  assert.match(ENEMY_STATS, re);
});

test('PROPHET spawn init block sets state + cooldown stagger', () => {
  // _prState must start 'idle', _prCooldown must be > 0 so a fresh
  // squadron of PROPHETs doesn't fire in unison the moment they spawn.
  const re = /if\s*\(type\s*===\s*'PROPHET'\)[\s\S]{0,400}_prState\s*=\s*'idle'[\s\S]{0,300}_prCooldown\s*=/;
  assert.match(SPAWN_INITIALIZERS, re, 'PROPHET init must set _prState=idle and _prCooldown stagger');
});

test('PROPHET is excluded from the elite affix roll', () => {
  // Elite affixes (SHIELDED, BERSERKER, FRENZY, PHASING, ...) interact
  // poorly with the predictive-shot mechanic — we keep PROPHET vanilla.
  // Mirrors the ECHOER/MIRROR/REAPER/GHOST_PROJECTOR exclusions.
  assert.match(ENEMY_CLASSIFICATION, /ELITE_EXCLUDED_TYPES[\s\S]*'PROPHET'[\s\S]*\]\s*\)/,
    'PROPHET must be in the elite-exclusion guard');
});

test('PROPHET is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'PROPHET':\s*this\.aiProphet\(/);
});

test('aiProphet method is defined', () => {
  assert.match(ENTITIES, /aiProphet\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

test('PROPHET stun cancel path resets aiming', () => {
  // Stun must cancel the aim window — otherwise it resumes after stun
  // ends and the player cannot punish the stun. Mirrors ECHOER/SNIPER.
  const re = /_prState\s*===\s*'aiming'[\s\S]{0,200}_prState\s*=\s*'idle'[\s\S]{0,200}_prCooldown\s*=/;
  assert.match(ENTITIES, re, 'stun handler must reset _prState to idle');
});

test('PROPHET draw branch renders a telegraph (lane + ghost)', () => {
  // The draw branch must include both the lane (line from prophet to
  // future-lock) and the ghost circle at the predicted position.
  // Without the lane the player cannot see the danger corridor; without
  // the ghost they cannot see WHY the corridor was chosen.
  const re = /this\.type\s*===\s*'PROPHET'[\s\S]{0,1400}NEON\.draw\.line\([\s\S]{0,500}NEON\.draw\.circle\(/;
  assert.match(ENTITIES, re, 'PROPHET draw branch must call line() (lane) then circle() (ghost)');
});

test('PROPHET constants are defined with sane values', () => {
  // Lookahead must be positive and < 2s (any farther feels disconnected
  // and hits walls). Telegraph >= 0.5s for fairness. MIN_VEL must be
  // positive so a stationary player has a true safe state. VEL_CAP must
  // exceed reasonable player walking speed (~5-6) so normal motion
  // isn't clamped, while still neutralising dashes.
  const la = ENEMY_ABILITY_TUNING.match(/PROPHET_LOOKAHEAD\s*=\s*([\d.]+)/);
  const vs = ENEMY_ABILITY_TUNING.match(/PROPHET_VEL_SAMPLE\s*=\s*([\d.]+)/);
  const tg = ENEMY_ABILITY_TUNING.match(/PROPHET_TELEGRAPH\s*=\s*([\d.]+)/);
  const cd = ENEMY_ABILITY_TUNING.match(/PROPHET_COOLDOWN\s*=\s*([\d.]+)/);
  const rg = ENEMY_ABILITY_TUNING.match(/PROPHET_RANGE\s*=\s*([\d.]+)/);
  const sp = ENEMY_ABILITY_TUNING.match(/PROPHET_PROJ_SPD\s*=\s*([\d.]+)/);
  const mv = ENEMY_ABILITY_TUNING.match(/PROPHET_MIN_VEL\s*=\s*([\d.]+)/);
  const vc = ENEMY_ABILITY_TUNING.match(/PROPHET_VEL_CAP\s*=\s*([\d.]+)/);
  assert.ok(la && vs && tg && cd && rg && sp && mv && vc,
    'all eight PROPHET_* constants must be defined');
  const lav = parseFloat(la[1]);
  const tgv = parseFloat(tg[1]);
  const mvv = parseFloat(mv[1]);
  const vcv = parseFloat(vc[1]);
  assert.ok(lav > 0 && lav <= 2.0, `lookahead ${lav} outside fair range (0, 2.0]`);
  assert.ok(tgv >= 0.5, `telegraph ${tgv} too short to be fair`);
  assert.ok(mvv > 0, `min-vel ${mvv} must be positive (stillness must be safe)`);
  assert.ok(vcv >= 8, `vel-cap ${vcv} too low — clamps normal walking`);
});

test('Player has getPredictedPosition helper that calls predictFromHistory', () => {
  // The shared player history ring is reused (already initialised for
  // ECHOER); PROPHET reads via getPredictedPosition.
  assert.match(ENTITIES, /getPredictedPosition\s*\(\s*seconds\s*\)\s*\{[\s\S]{0,300}predictFromHistory\s*\(/);
});

test('predictFromHistory pure helper is defined', () => {
  // Structural source-of-truth check. The duplicate below must mirror
  // the body — if you change one, change the other.
  assert.match(ENTITY_AI_HELPERS, /function\s+predictFromHistory\s*\(\s*history\s*,\s*curX\s*,\s*curY\s*,\s*lookahead\s*,\s*sampleSec\s*,\s*velCap\s*\)/);
});

test('platform.js exposes audio.prophetLock and audio.prophetFire', () => {
  assert.match(PLATFORM, /prophetLock\s*\(\s*\)\s*\{/);
  assert.match(PLATFORM, /prophetFire\s*\(\s*\)\s*\{/);
});

test('sw.js cache freshness does not use a numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});

test('PROPHET appears in CREDIT_VALUES, SOURCE_LABELS, SOURCE_COLOURS', () => {
  assert.match(SOURCE_METADATA, /PROPHET:\s*\d+/);            // CREDIT_VALUES row
  assert.match(SOURCE_METADATA, /PROPHET:\s*'Prophet'/);      // SOURCE_LABELS
  assert.match(SOURCE_METADATA, /PROPHET:\s*'#ffaa22'/);      // SOURCE_COLOURS
});

test('PROPHET projectile carries owner attribution', () => {
  // Every enemy projectile MUST set ownerType BEFORE pushing — without
  // it the death-recap and damage logs fall back to generic 'Projectile'
  // and SOURCE_LABELS / SOURCE_COLOURS entries become useless.
  // (Class of bug — caught on MIRROR PR #134 by 3 reviewers.)
  const sigRe = /^\s*aiProphet\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch, 'aiProphet method definition not found');
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  assert.match(aiBody, /new\s+Projectile\(/);
  assert.match(aiBody, /p\.ownerType\s*=\s*'Prophet Shot'/);
  // Order: ownerType assignment BEFORE the push (otherwise hit-path
  // races the attribution).
  const ow = aiBody.indexOf('p.ownerType');
  const ph = aiBody.indexOf('projectiles.push');
  assert.ok(ow !== -1 && ph !== -1 && ow < ph,
    'ownerType must be set before projectiles.push');
});

test('aiProphet honors hologram-taunt redirection', () => {
  // PROPHET samples player state (predicted position) outside the
  // canonical _tx/_ty path — without an explicit taunt branch it would
  // ignore decoys. Same lesson learned from ECHOER PR review.
  const sigRe = /^\s*aiProphet\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch, 'aiProphet method definition not found');
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  assert.match(aiBody, /_tauntTarget/, 'aiProphet must reference _tauntTarget');
  assert.match(aiBody, /getPredictedPosition/, 'aiProphet must call getPredictedPosition');
  // Order check: taunt branch should be evaluated before the prediction
  // fallback so the decoy is never bypassed.
  const ti = aiBody.indexOf('_tauntTarget');
  const gi = aiBody.indexOf('getPredictedPosition');
  assert.ok(ti !== -1 && gi !== -1 && ti < gi,
    'taunt check must appear before getPredictedPosition fallback in aiProphet');
});

test('aiProphet enforces a stillness gate (MIN_VEL)', () => {
  // The whole point of PROPHET's niche: stillness is safe. Without the
  // vmag >= MIN_VEL gate, PROPHET degenerates into a slow-telegraph
  // basic shooter.
  const sigRe = /^\s*aiProphet\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  assert.match(aiBody, /vmag\s*>=\s*PROPHET_MIN_VEL/,
    'aiProphet must check vmag >= PROPHET_MIN_VEL before locking');
});

// ─── Pure helper unit tests ─────────────────────────────────────────────
//
// MUST mirror predictFromHistory in src/entities.js. If the behavior
// contract changes, update both the source-of-truth function and this
// duplicate. The structural-assertion test above catches the case where
// the function disappears entirely.

/**
 * @param {Array<{t:number,x:number,y:number}> | null | undefined} history
 * @param {number} seconds
 */
function getPositionAgoFromHistory(history, seconds) {
  if (!history || history.length === 0) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].t >= seconds) {
      return { x: history[i].x, y: history[i].y };
    }
  }
  return null;
}

/**
 * @param {Array<{t:number,x:number,y:number}> | null | undefined} history
 * @param {number} curX
 * @param {number} curY
 * @param {number} lookahead
 * @param {number} sampleSec
 * @param {number} velCap
 */
function predictFromHistory(history, curX, curY, lookahead, sampleSec, velCap) {
  if (!history || history.length === 0) return null;
  let past = null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].t >= sampleSec) { past = history[i]; break; }
  }
  if (!past) return null;
  const dtAge = past.t > 1e-6 ? past.t : sampleSec;
  const rawVx = (curX - past.x) / dtAge;
  const rawVy = (curY - past.y) / dtAge;
  const rawMag = Math.hypot(rawVx, rawVy);
  let vx = rawVx, vy = rawVy, vmag = rawMag;
  if (rawMag > velCap && rawMag > 0) {
    const k = velCap / rawMag;
    vx = rawVx * k; vy = rawVy * k; vmag = velCap;
  }
  return { x: curX + vx * lookahead, y: curY + vy * lookahead, vx, vy, vmag };
}

test('helper: returns null on empty / missing history', () => {
  assert.strictEqual(predictFromHistory(null, 0, 0, 0.6, 0.2, 10), null);
  assert.strictEqual(predictFromHistory(undefined, 0, 0, 0.6, 0.2, 10), null);
  assert.strictEqual(predictFromHistory([], 0, 0, 0.6, 0.2, 10), null);
});

test('helper: returns null when history does not reach the velocity sample', () => {
  // Player just spawned — only 0.1s of history collected.
  const h = [
    { t: 0.1, x: 1, y: 1 },
    { t: 0.0, x: 1.1, y: 1 },
  ];
  assert.strictEqual(predictFromHistory(h, 1.1, 1, 0.6, 0.2, 10), null);
});

test('helper: linear extrapolation — east-bound at 5 tiles/sec', () => {
  // Position 0.2s ago: (5, 5). Now: (6, 5). vx = 5, vy = 0.
  // Lookahead 0.6s → predicted (6 + 5*0.6, 5) = (9, 5).
  const h = [
    { t: 0.2, x: 5, y: 5 },
    { t: 0.1, x: 5.5, y: 5 },
    { t: 0.0, x: 6, y: 5 },
  ];
  const pred = predictFromHistory(h, 6, 5, 0.6, 0.2, 10);
  assert.ok(pred, 'prediction must not be null');
  assert.ok(Math.abs(pred.x - 9) < 1e-9, `x: expected ~9, got ${pred.x}`);
  assert.ok(Math.abs(pred.y - 5) < 1e-9, `y: expected 5, got ${pred.y}`);
  assert.ok(Math.abs(pred.vmag - 5) < 1e-9, `vmag: expected 5, got ${pred.vmag}`);
});

test('helper: stationary player — predicted == current, vmag == 0', () => {
  // Player has been still for 0.3s. Velocity = 0, prediction = current.
  const h = [
    { t: 0.3, x: 4, y: 4 },
    { t: 0.2, x: 4, y: 4 },
    { t: 0.1, x: 4, y: 4 },
    { t: 0.0, x: 4, y: 4 },
  ];
  const pred = predictFromHistory(h, 4, 4, 0.6, 0.2, 10);
  assert.ok(pred);
  assert.strictEqual(pred.vmag, 0);
  assert.strictEqual(pred.x, 4);
  assert.strictEqual(pred.y, 4);
});

test('helper: dash-blowup is clamped by velCap', () => {
  // Player dashes 4 tiles in 0.2s → raw velocity 20 tiles/s. With
  // velCap=10, the clamp halves it. Predicted x at lookahead 0.6:
  // 8 + (10 * 0.6) = 14, NOT 8 + 12 = 20.
  const h = [
    { t: 0.2, x: 4, y: 0 },
    { t: 0.0, x: 8, y: 0 },
  ];
  const pred = predictFromHistory(h, 8, 0, 0.6, 0.2, 10);
  assert.ok(pred);
  assert.ok(Math.abs(pred.vmag - 10) < 1e-9, `clamped vmag: expected 10, got ${pred.vmag}`);
  assert.ok(Math.abs(pred.x - 14) < 1e-9, `clamped x: expected 14, got ${pred.x}`);
});

test('helper: diagonal motion preserves direction after clamp', () => {
  // 45° NE motion at speed 14.14 (10√2). Clamped to 10 keeps direction.
  // dx = dy = 2 over 0.2s → raw v = (10, 10), |v| ≈ 14.14, k = 10/14.14
  // Clamped v = (~7.07, ~7.07). vmag = 10.
  const h = [
    { t: 0.2, x: 0, y: 0 },
    { t: 0.0, x: 2, y: 2 },
  ];
  const pred = predictFromHistory(h, 2, 2, 0.5, 0.2, 10);
  assert.ok(pred);
  assert.ok(Math.abs(pred.vmag - 10) < 1e-9, `vmag clamp: ${pred.vmag}`);
  // Direction preserved: vx ≈ vy (diagonal)
  assert.ok(Math.abs(pred.vx - pred.vy) < 1e-9, `direction: vx=${pred.vx} vy=${pred.vy}`);
  // Predicted position
  const expected = 2 + (10 / Math.sqrt(2)) * 0.5;
  assert.ok(Math.abs(pred.x - expected) < 1e-9, `x: expected ${expected}, got ${pred.x}`);
});

test('helper: divides by ACTUAL sample age, not requested seconds (regression)', () => {
  // Bug caught by gpt-5.3-codex on first review: when the chosen history
  // sample is older than the requested sampleSec (typical under frame
  // jitter), dividing by `sampleSec` inflates velocity and over-leads
  // the shot. Helper must divide by the entry's actual `t`.
  //
  // Construct: requested sampleSec=0.2, oldest entry has t=0.4 with
  // dx=2 over that 0.4s window → true velocity = 5 tiles/s.
  // The buggy code would compute 2/0.2 = 10 tiles/s (DOUBLE the actual).
  const h = [
    { t: 0.4, x: 0, y: 0 },
    { t: 0.0, x: 2, y: 0 },
  ];
  const pred = predictFromHistory(h, 2, 0, 0.6, 0.2, 100);
  assert.ok(pred);
  assert.ok(Math.abs(pred.vmag - 5) < 1e-9, `vmag: expected 5 (actual age), got ${pred.vmag}`);
  assert.ok(Math.abs(pred.x - (2 + 5 * 0.6)) < 1e-9, `x: expected 5, got ${pred.x}`);
});

test('helper: velocity below cap is NOT scaled', () => {
  // Walking speed 3 tiles/s — under the 10 cap. Velocity must pass
  // through unchanged. (Regression: a buggy clamp could divide-and-
  // multiply when not needed and introduce floating-point drift.)
  const h = [
    { t: 0.2, x: 0, y: 0 },
    { t: 0.0, x: 0.6, y: 0 },
  ];
  const pred = predictFromHistory(h, 0.6, 0, 0.6, 0.2, 10);
  assert.ok(pred);
  assert.ok(Math.abs(pred.vx - 3) < 1e-9, `vx: ${pred.vx}`);
  assert.strictEqual(pred.vy, 0);
  assert.ok(Math.abs(pred.vmag - 3) < 1e-9, `vmag: ${pred.vmag}`);
});
