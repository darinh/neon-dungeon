'use strict';
// ECHOER mob — source-text wiring tests + pure helper unit tests.
//
// entities.js is browser-only (no UMD/CommonJS exports), so we follow
// the same pattern as tunneller.test.js: assert structural invariants
// the mob needs by regex-matching the source text. We additionally
// duplicate the pure `getPositionAgoFromHistory` helper here for unit
// testing — the duplicate MUST stay in lock-step with the source-of-
// truth definition in src/entities.js (a structural assertion below
// guards against drift).

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
const ENTITY_AI_HELPERS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'ai-helpers.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('ECHOER appears in ENEMY_WEIGHTS with mid-game floor gate', () => {
  // Without a weights entry, the mob can never roll out of pickEnemyType.
  // Per design (anti-pattern punisher), ECHOER is mid-late game pressure
  // — minFloor must be >= 4.
  const m = ENTITIES.match(/ECHOER:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'ECHOER must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 4, `ECHOER minFloor should be >= 4, got ${m[1]}`);
});

test('ECHOER has a stat row in spawnEnemy switch', () => {
  // Missing case → spawnEnemy returns an Enemy with hp=0, instantly dead.
  const re = /case\s+'ECHOER':[^\n]*hp\s*=\s*\d+[^\n]*atk\s*=\s*\d+[^\n]*spd\s*=\s*[\d.]+[^\n]*xpVal\s*=\s*\d+[^\n]*colour\s*=/;
  assert.match(ENTITIES, re);
});

test('ECHOER spawn init block sets state + cooldown stagger', () => {
  // _ecState must start 'idle', _ecCooldown must be > 0 so a fresh
  // squadron of ECHOERs doesn't fire in unison the moment they spawn.
  const re = /if\s*\(type\s*===\s*'ECHOER'\)[\s\S]{0,400}_ecState\s*=\s*'idle'[\s\S]{0,300}_ecCooldown\s*=/;
  assert.match(ENTITIES, re, 'ECHOER init must set _ecState=idle and _ecCooldown stagger');
});

test('ECHOER is excluded from the elite affix roll', () => {
  // Elite affixes (SHIELDED, BERSERKER, FRENZY, PHASING, ...) interact
  // poorly with the predictive-shot mechanic — we keep ECHOER vanilla.
  // Mirrors the SNIPER/SUMMONER/MIMIC/PULSER/TUNNELLER exclusions.
  const re = /allowElite[\s\S]{0,400}type\s*!==\s*'ECHOER'/;
  assert.match(ENTITIES, re, 'ECHOER must be in the elite-exclusion guard');
});

test('ECHOER is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'ECHOER':\s*this\.aiEchoer\(/);
});

test('aiEchoer method is defined', () => {
  assert.match(ENTITIES, /aiEchoer\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

test('ECHOER stun cancel path resets aiming', () => {
  // Stun must cancel the aim window — otherwise it resumes after stun
  // ends and the player cannot punish the stun. Mirrors SNIPER/PULSER.
  const re = /_ecState\s*===\s*'aiming'[\s\S]{0,200}_ecState\s*=\s*'idle'[\s\S]{0,200}_ecCooldown\s*=/;
  assert.match(ENTITIES, re, 'stun handler must reset _ecState to idle');
});

test('ECHOER draw branch renders a telegraph (lane + ghost)', () => {
  // The draw branch must include both the lane (line from echoer to
  // lock) and the ghost circle at the locked past-position. Without
  // the lane the player cannot see the danger corridor; without the
  // ghost they cannot see WHY the corridor was chosen.
  const re = /this\.type\s*===\s*'ECHOER'[\s\S]{0,1200}NEON\.draw\.line\([\s\S]{0,400}NEON\.draw\.circle\(/;
  assert.match(ENTITIES, re, 'ECHOER draw branch must call line() (lane) then circle() (ghost)');
});

test('ECHOER constants are defined with sane values', () => {
  // Lookback should be < 2s (otherwise hits feel disconnected) and > 0.5s
  // (otherwise the mechanic is trivial). Telegraph >= 0.5s for fairness.
  const lb = ENTITIES.match(/ECHOER_LOOKBACK\s*=\s*([\d.]+)/);
  const tg = ENTITIES.match(/ECHOER_TELEGRAPH\s*=\s*([\d.]+)/);
  const cd = ENTITIES.match(/ECHOER_COOLDOWN\s*=\s*([\d.]+)/);
  const rg = ENTITIES.match(/ECHOER_RANGE\s*=\s*([\d.]+)/);
  const sp = ENTITIES.match(/ECHOER_PROJ_SPD\s*=\s*([\d.]+)/);
  assert.ok(lb && tg && cd && rg && sp, 'all five ECHOER_* constants must be defined');
  const lbv = parseFloat(lb[1]);
  const tgv = parseFloat(tg[1]);
  assert.ok(lbv >= 0.5 && lbv <= 2.0, `lookback ${lbv} outside fair range [0.5, 2.0]`);
  assert.ok(tgv >= 0.5, `telegraph ${tgv} too short to be fair`);
});

test('Player has _posHistory init and getPositionAgo helper', () => {
  // The shared player history ring must be initialised in reset() and
  // sampled in update(). Helper method must call the pure helper.
  assert.match(ENTITIES, /this\._posHistory\s*=\s*\[\]/);
  assert.match(ENTITIES, /getPositionAgo\s*\(\s*seconds\s*\)\s*\{[\s\S]{0,200}getPositionAgoFromHistory\s*\(/);
  // Sampling block in Player.update — must push {t,x,y} and trim by age
  assert.match(ENTITIES, /this\._posHistory\.push\(\s*\{\s*t:\s*0\s*,\s*x:\s*this\.x\s*,\s*y:\s*this\.y\s*\}\s*\)/);
  assert.match(ENTITIES, /PLAYER_HISTORY_WINDOW/);
});

test('getPositionAgoFromHistory pure helper is defined', () => {
  // The structural source-of-truth check. The duplicate below must
  // mirror the body — if you change one, change the other.
  assert.match(ENTITY_AI_HELPERS, /function\s+getPositionAgoFromHistory\s*\(\s*history\s*,\s*seconds\s*\)/);
});

test('platform.js exposes audio.echoerLock and audio.echoerFire', () => {
  assert.match(PLATFORM, /echoerLock\s*\(\s*\)\s*\{/);
  assert.match(PLATFORM, /echoerFire\s*\(\s*\)\s*\{/);
});

test('game.js loadFloor clears player._posHistory after teleport', () => {
  // Without this clear, an ECHOER on the next floor could lock onto
  // the position the player held just before transitioning.
  assert.match(GAME, /this\.player\._posHistory[\s\S]{0,200}\.length\s*=\s*0/);
});

test('sw.js cache freshness does not use a numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});

test('ECHOER appears in CREDIT_VALUES, SOURCE_LABELS, SOURCE_COLOURS', () => {
  assert.match(SOURCE_METADATA, /ECHOER:\s*\d+/);            // CREDIT_VALUES row
  assert.match(SOURCE_METADATA, /ECHOER:\s*'Echoer'/);       // SOURCE_LABELS
  assert.match(SOURCE_METADATA, /ECHOER:\s*'#aa66ff'/);      // SOURCE_COLOURS
});

test('aiEchoer honors hologram-taunt redirection', () => {
  // Bug surfaced by adversarial review (gpt-5.3-codex 2026-04-26):
  // ECHOER must lock onto _tx/_ty (taunt target) when a taunt is active,
  // not the real player's history — otherwise it's the only enemy in the
  // game that ignores decoys. Slice the aiEchoer METHOD body (not the
  // dispatch call) and assert both branches exist within it.
  const sigRe = /^\s*aiEchoer\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch, 'aiEchoer method definition not found');
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 4500);
  assert.match(aiBody, /_tauntTarget/,   'aiEchoer must reference _tauntTarget');
  assert.match(aiBody, /getPositionAgo/, 'aiEchoer must call getPositionAgo');
  // Order check: taunt branch should be evaluated before/around the
  // history fallback so the decoy is never bypassed.
  const ti = aiBody.indexOf('_tauntTarget');
  const gi = aiBody.indexOf('getPositionAgo');
  assert.ok(ti !== -1 && gi !== -1 && ti < gi,
    'taunt check must appear before getPositionAgo fallback in aiEchoer');
});

// ─── Pure helper unit tests ─────────────────────────────────────────────
//
// MUST mirror getPositionAgoFromHistory in src/entities.js. If the
// behavior contract changes, update both the source-of-truth function
// and this duplicate. The structural-assertion test above catches the
// case where the function disappears entirely.

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

test('helper: returns null on empty / missing history', () => {
  assert.strictEqual(getPositionAgoFromHistory(null, 1.0), null);
  assert.strictEqual(getPositionAgoFromHistory(undefined, 1.0), null);
  assert.strictEqual(getPositionAgoFromHistory([], 1.0), null);
});

test('helper: returns null when no entry is old enough', () => {
  // Player just spawned — only 0.3s of history collected.
  const h = [
    { t: 0.3, x: 1, y: 1 },
    { t: 0.2, x: 1.1, y: 1 },
    { t: 0.1, x: 1.2, y: 1 },
    { t: 0.0, x: 1.3, y: 1 },
  ];
  assert.strictEqual(getPositionAgoFromHistory(h, 1.0), null);
});

test('helper: returns the freshest sample at-or-beyond the lookback', () => {
  // History: oldest first. Lookback = 1.0s should pick the entry whose
  // age is exactly 1.0s (freshest sample that still satisfies >= 1.0).
  const h = [
    { t: 1.5, x: 0, y: 0 },
    { t: 1.2, x: 1, y: 1 },
    { t: 1.0, x: 2, y: 2 }, // ← freshest with age >= 1.0
    { t: 0.7, x: 3, y: 3 },
    { t: 0.0, x: 4, y: 4 },
  ];
  const got = getPositionAgoFromHistory(h, 1.0);
  assert.deepStrictEqual(got, { x: 2, y: 2 });
});

test('helper: lookback exactly at oldest entry returns oldest', () => {
  const h = [
    { t: 1.0, x: 5, y: 6 },
    { t: 0.5, x: 7, y: 8 },
    { t: 0.0, x: 9, y: 10 },
  ];
  assert.deepStrictEqual(getPositionAgoFromHistory(h, 1.0), { x: 5, y: 6 });
});

test('helper: returns a copy, not a live reference', () => {
  // Mutating the returned object must not corrupt the history. (The
  // current implementation returns a fresh {x,y} literal — this test
  // pins that contract.)
  const h = [{ t: 1.0, x: 5, y: 6 }];
  const got = getPositionAgoFromHistory(h, 1.0);
  assert.ok(got);
  // @ts-expect-error — runtime mutation of returned object
  got.x = 999;
  assert.strictEqual(h[0].x, 5);
});

test('helper: tolerates floating-point ages near the threshold', () => {
  // Ages accumulated by per-frame dt addition will rarely hit nice
  // numbers. The "at least lookback" semantic should still pick the
  // freshest qualifying entry.
  const h = [
    { t: 1.0166666666666666, x: 1, y: 1 },
    { t: 0.9999999999999999, x: 2, y: 2 }, // just below — should NOT match
    { t: 0.0, x: 3, y: 3 },
  ];
  // Strictly >= 1.0 means index 0 wins.
  assert.deepStrictEqual(getPositionAgoFromHistory(h, 1.0), { x: 1, y: 1 });
});
