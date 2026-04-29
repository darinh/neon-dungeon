'use strict';
// MIRROR mob — source-text wiring tests + pure kinematics-helper unit tests.
//
// entities.js is browser-only (no UMD/CommonJS exports), so we follow the
// same pattern as resonator.test.js / echoer.test.js / tunneller.test.js:
// assert structural invariants the mob needs by regex-matching the source
// text. We also extract the pure `pickMirrorKinematics` helper via node:vm
// (NOT new Function — eslint flags it as no-new-func) so unit tests
// exercise the REAL implementation, not a duplicate that could drift.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('MIRROR appears in ENEMY_WEIGHTS with floor 8+ gate', () => {
  // Per design (deep-floor mimic, more dangerous than RESONATOR), minFloor must be >= 8.
  const m = ENTITIES.match(/MIRROR:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'MIRROR must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 8, `MIRROR minFloor should be >= 8, got ${m[1]}`);
});

test('MIRROR has a stat row in spawnEnemy switch and is stationary', () => {
  // Missing case → spawnEnemy returns an Enemy with hp=0, instantly dead.
  // The mob is stationary by design — spd MUST be 0 (matches RESONATOR).
  const m = ENTITIES.match(/case\s+'MIRROR':[^\n]*hp\s*=\s*(\d+)[^\n]*atk\s*=\s*(\d+)[^\n]*spd\s*=\s*([\d.]+)[^\n]*xpVal\s*=\s*(\d+)/);
  assert.ok(m, 'MIRROR stat row missing');
  assert.strictEqual(parseFloat(m[3]), 0, 'MIRROR must be stationary (spd=0)');
  assert.ok(parseInt(m[1], 10) >= 40, 'MIRROR HP feels too low');
  assert.ok(parseInt(m[2], 10) >= 8,  'MIRROR atk feels too low');
});

test('MIRROR spawn init block sets state + charge stagger', () => {
  // _miState must start 'idle', _miCharge must be > 0 (and ideally
  // randomised) so a clustered spawn doesn't telegraph in unison.
  const re = /if\s*\(type\s*===\s*'MIRROR'\)[\s\S]{0,800}_miState\s*=\s*'idle'[\s\S]{0,400}_miCharge\s*=/;
  assert.match(ENTITIES, re, 'MIRROR init must set _miState=idle and seed _miCharge');
  // Stagger = some Math.random() involvement — otherwise a pack fires together
  const init = ENTITIES.match(/if\s*\(type\s*===\s*'MIRROR'\)[\s\S]{0,800}\}/);
  assert.ok(init && /Math\.random\(\)/.test(init[0]), 'MIRROR init must stagger _miCharge');
});

test('MIRROR is excluded from the elite affix roll', () => {
  // Elite affixes (SHIELDED, BERSERKER, FRENZY, PHASING, ...) interact
  // poorly with the stationary mimic mechanic and would push damage way
  // out of balance. Mirrors RESONATOR/ECHOER/TUNNELLER exclusions.
  const re = /allowElite[\s\S]{0,500}type\s*!==\s*'MIRROR'/;
  assert.match(ENTITIES, re, 'MIRROR must be in the elite-exclusion guard');
});

test('MIRROR is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'MIRROR':\s*this\.aiMirror\(/);
});

test('aiMirror method is defined', () => {
  assert.match(ENTITIES, /aiMirror\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

test('MIRROR stun-cancel path drops telegraph to recovery', () => {
  // Stun must cancel the telegraph BEFORE it fires — otherwise the mirror
  // still discharges after the stun ends and the player cannot punish.
  // We drop straight to recovery (not idle) so the rhythm beats stay
  // honest — a stunned mirror still sits idle for MIRROR_RECOVERY.
  const re = /_miState\s*===\s*'telegraph'[\s\S]{0,200}_miState\s*=\s*'recovery'[\s\S]{0,200}_miRec\s*=/;
  assert.match(ENTITIES, re, 'stun handler must downgrade _miState to recovery');
});

test('MIRROR aim source is _tx/_ty so taunt redirection works', () => {
  // MIRROR aims via this._tx/_ty (the canonical taunt-aware target)
  // rather than reading player.x/y directly, so hologram decoys redirect
  // the shot with no special branch (unlike ECHOER which needed one).
  const sigRe = /^\s*aiMirror\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch, 'aiMirror method definition not found');
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  // The lock-and-aim block must norm() over (this._tx - this.x, this._ty - this.y).
  assert.match(aiBody,
    /norm\(\s*this\._tx\s*-\s*this\.x\s*,\s*this\._ty\s*-\s*this\.y\s*\)/,
    'aiMirror must aim via _tx/_ty for taunt-decoy compatibility');
});

test('MIRROR range gate uses dLock > 0.1 && dLock <= MIRROR_RANGE (zero-aim guard + inclusive bound)', () => {
  const sigRe = /^\s*aiMirror\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  // Both clauses must be present: the zero-aim guard (>0.1) and the
  // inclusive upper bound (<=MIRROR_RANGE). Lessons from RESONATOR PR #133.
  assert.match(aiBody,
    /dLock\s*>\s*[\d.]+\s*&&\s*dLock\s*<=?\s*MIRROR_RANGE/,
    'aiMirror lock gate must guard zero-aim and use MIRROR_RANGE inclusive');
});

test('MIRROR fires a vanilla Projectile (no piercing, no homing)', () => {
  // The replayed projectile must NEVER be piercing or homing — otherwise
  // late-game player perks (PIERCING_ROUNDS, RICOCHET) leak into enemy
  // projectiles. Projectile ctor signature ends with (..., piercing, friendly).
  const sigRe = /^\s*aiMirror\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  // new Projectile(... ax, ay, spd, dmg, MIRROR_PROJ_RANGE, colour, false, false)
  assert.match(aiBody, /new Projectile\([\s\S]*?MIRROR_PROJ_RANGE[\s\S]*?,\s*false\s*,\s*false\s*\)/,
    'aiMirror must spawn a non-piercing, non-friendly Projectile');
});

test('MIRROR damage is mob-scaled (atk * MIRROR_DMG_MUL), not player-scaled', () => {
  // The player's damage roll must NEVER be replayed — late-game crits +
  // perks could yield 200+ dmg returns. Damage MUST come from this.atk.
  const sigRe = /^\s*aiMirror\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  assert.match(aiBody, /this\.atk\s*\*\s*MIRROR_DMG_MUL/,
    'aiMirror damage must scale from this.atk * MIRROR_DMG_MUL');
});

test('MIRROR draw branch tints aim line/ring with the shot colour', () => {
  // The draw branch must guard on _miState === 'telegraph' and draw an
  // aim line (NEON.draw.line) plus a body ring (circleStroke) using
  // _miShotColour so the player can SEE which weapon is coming back.
  const draw = ENTITIES.match(/this\.type\s*===\s*'MIRROR'[\s\S]{0,2500}/);
  assert.ok(draw, 'MIRROR draw branch missing');
  const blob = draw[0];
  assert.ok(/_miState\s*===\s*'telegraph'/.test(blob),
    'draw branch must gate the aim line on telegraph state');
  assert.ok(/_miShotColour/.test(blob),
    'draw branch must read _miShotColour (the cached player-shot tint)');
  assert.ok(/NEON\.draw\.line/.test(blob), 'draw branch must use NEON.draw.line');
});

test('MIRROR constants are defined with sane values', () => {
  const ch = ENTITIES.match(/MIRROR_CHARGE\s*=\s*([\d.]+)/);
  const tg = ENTITIES.match(/MIRROR_TELEGRAPH\s*=\s*([\d.]+)/);
  const rc = ENTITIES.match(/MIRROR_RECOVERY\s*=\s*([\d.]+)/);
  const rg = ENTITIES.match(/MIRROR_RANGE\s*=\s*([\d.]+)/);
  const dm = ENTITIES.match(/MIRROR_DMG_MUL\s*=\s*([\d.]+)/);
  const sd = ENTITIES.match(/MIRROR_PROJ_SPD_DEF\s*=\s*([\d.]+)/);
  const smin = ENTITIES.match(/MIRROR_PROJ_SPD_MIN\s*=\s*([\d.]+)/);
  const smax = ENTITIES.match(/MIRROR_PROJ_SPD_MAX\s*=\s*([\d.]+)/);
  const sl = ENTITIES.match(/SHOT_HISTORY_LEN\s*=\s*([\d.]+)/);
  assert.ok(ch && tg && rc && rg && dm && sd && smin && smax && sl,
    'all nine MIRROR_* / SHOT_HISTORY_LEN constants must be defined');
  assert.ok(parseFloat(tg[1]) >= 0.5,
    `telegraph ${tg[1]} too short to be fair — at least 0.5s required`);
  assert.ok(parseFloat(rc[1]) >= 0.5,
    `recovery ${rc[1]} too short — gives no punish window`);
  const mul = parseFloat(dm[1]);
  assert.ok(mul > 0 && mul <= 1.5, `dmg mul ${mul} outside sane range`);
  const minS = parseFloat(smin[1]);
  const maxS = parseFloat(smax[1]);
  assert.ok(minS > 0 && maxS > minS && maxS <= 20,
    `speed clamp [${minS}..${maxS}] outside sane range`);
  assert.ok(parseInt(sl[1], 10) >= 1 && parseInt(sl[1], 10) <= 16,
    `SHOT_HISTORY_LEN ${sl[1]} outside sane range`);
});

test('MIRROR appears in CREDIT_VALUES, SOURCE_LABELS, SOURCE_COLOURS', () => {
  assert.match(ENTITIES, /MIRROR:\s*\d+/);                // CREDIT_VALUES row
  assert.match(ENTITIES, /MIRROR:\s*'Mirror'/);           // SOURCE_LABELS
  assert.match(ENTITIES, /MIRROR:\s*'#88ff44'/);          // SOURCE_COLOURS
  assert.match(ENTITIES, /'Mirror Shot':\s*'Mirror Shot'/); // damage source label
});

test('Player.shoot records ranged kinematics into _shotHistory', () => {
  // Recording must happen ONLY in the ranged (else) branch — never for
  // melee (no projectile to mimic). And the ring must be bounded by
  // SHOT_HISTORY_LEN to prevent unbounded growth across long runs.
  const shootRe = /shoot\s*\(\s*aimX\s*,\s*aimY\s*,\s*map\s*\)\s*\{[\s\S]*?\n  \}/;
  const m = ENTITIES.match(shootRe);
  assert.ok(m, 'Player.shoot method not found');
  const body = m[0];
  assert.ok(/this\._shotHistory/.test(body),
    'Player.shoot must reference _shotHistory');
  assert.ok(/this\._shotHistory\.push\(\s*\{[^}]*spd\s*:[^}]*colour\s*:[^}]*\}\s*\)/.test(body),
    'Player.shoot must push {spd, colour} into _shotHistory');
  assert.ok(/SHOT_HISTORY_LEN[\s\S]{0,40}shift\(\)/.test(body),
    'Player.shoot must trim _shotHistory to SHOT_HISTORY_LEN entries');
});

test('Player.shoot does NOT record damage in _shotHistory (mob-scaled return only)', () => {
  // The recorded entry must NOT carry `dmg` or `damage` — otherwise a
  // future MIRROR refactor could read it and replay player crit damage.
  const shootRe = /shoot\s*\(\s*aimX\s*,\s*aimY\s*,\s*map\s*\)\s*\{[\s\S]*?\n  \}/;
  const m = ENTITIES.match(shootRe);
  assert.ok(m, 'Player.shoot method not found');
  const body = m[0];
  // Find the push payload object literal
  const push = body.match(/this\._shotHistory\.push\(\s*(\{[^}]*\})\s*\)/);
  assert.ok(push, 'Player.shoot _shotHistory.push call not found');
  assert.ok(!/\bdmg\b|\bdamage\b/.test(push[1]),
    `_shotHistory entry must NOT carry damage; got ${push[1]}`);
  assert.ok(!/\bpiercing\b|\bbouncesLeft\b|\bhoming\b/.test(push[1]),
    `_shotHistory entry must NOT carry perk-driven flags; got ${push[1]}`);
});

test('Player.shoot records the actual post-_init projectile speed (not hardcoded 12)', () => {
  // Regression: codex/gpt-5.5 review caught a hardcoded `spd: 12` that
  // didn't account for KINETIC_AMPLIFIER (player aug, *1.2) or CHARGED
  // floor modifier (*1.4). MIRROR's mimicry contract is "the player's
  // last fired ranged shot" — recording the base speed instead of the
  // post-modifier value violates that contract. Fix: capture proj.spd
  // from the actual constructed Projectile in the burst loop.
  const shootRe = /shoot\s*\(\s*aimX\s*,\s*aimY\s*,\s*map\s*\)\s*\{[\s\S]*?\n  \}/;
  const m = ENTITIES.match(shootRe);
  assert.ok(m, 'Player.shoot method not found');
  const body = m[0];
  const push = body.match(/this\._shotHistory\.push\(\s*(\{[^}]*\})\s*\)/);
  assert.ok(push, '_shotHistory.push call not found');
  // Must NOT be a hardcoded literal — must reference a captured variable.
  assert.ok(!/\bspd\s*:\s*12\b/.test(push[1]),
    `_shotHistory entry must NOT hardcode spd: 12 — capture proj.spd; got ${push[1]}`);
  assert.ok(/\bspd\s*:\s*\w+/.test(push[1]),
    `_shotHistory entry must reference a variable for spd; got ${push[1]}`);
});

test('aiMirror overrides p.spd after construction so CHARGED modifier cannot bypass clamp', () => {
  // Regression: codex/gpt-5.5 review caught that Projectile._init applies
  // CHARGED *1.4 unconditionally, escaping MIRROR_PROJ_SPD_MAX. Fix:
  // MIRROR overwrites p.spd after `new Projectile(...)` with the clamped
  // value so the fair band stays authoritative.
  const sigRe = /^\s*aiMirror\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  // Must assign p.spd = spd (or equivalent) AFTER `new Projectile(...)`.
  assert.match(aiBody, /new Projectile\([\s\S]*?\)[\s\S]{0,300}\bp\.spd\s*=\s*spd\b/,
    'aiMirror must overwrite p.spd after construction to enforce the clamp');
});

test('aiMirror sets p.ownerType for damage attribution', () => {
  // Regression: gpt-5.5 review caught that without ownerType the hit path
  // logs damage as generic "Projectile", making MIRROR / Mirror Shot
  // labels and colours useless for death recap and damage logs. Compare
  // to ECHOER and PULSER which both set ownerType after construction.
  const sigRe = /^\s*aiMirror\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  assert.match(aiBody, /\bp\.ownerType\s*=\s*['"]Mirror Shot['"]/,
    'aiMirror must tag the projectile with ownerType="Mirror Shot"');
});

test('loadFloor clears _shotHistory alongside _posHistory (no cross-floor mimic leak)', () => {
  // Regression: codex/gpt-5.5 review caught that _shotHistory was not
  // cleared on floor transition, so a MIRROR on a new floor could mimic a
  // shot the player fired on the previous floor before they fired anything
  // on the current floor. Fix: clear _shotHistory in loadFloor right after
  // the existing _posHistory clear.
  const GAME = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
  );
  // Both clears should be in close proximity in loadFloor.
  assert.match(GAME,
    /_posHistory[\s\S]{0,400}_shotHistory[\s\S]{0,80}length\s*=\s*0/,
    'loadFloor must clear _shotHistory next to _posHistory');
});

test('platform.js exposes audio.mirrorCharge and audio.mirrorFire', () => {
  assert.match(PLATFORM, /mirrorCharge\s*\(\s*\)\s*\{/);
  assert.match(PLATFORM, /mirrorFire\s*\(\s*\)\s*\{/);
});

test('sw.js cache version was bumped (>= v178)', () => {
  // Service worker cache must be bumped any time src/* assets change,
  // otherwise users get stale code. MIRROR added → bump from v177 to v178.
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, 'CACHE constant not found');
  assert.ok(parseInt(m[1], 10) >= 178, `cache must be >= v178, got v${m[1]}`);
});

test('pickMirrorKinematics pure helper is defined in entities.js', () => {
  // Structural source-of-truth check. We extract & vm-eval below.
  assert.match(ENTITIES,
    /function\s+pickMirrorKinematics\s*\(\s*shotHistory\s*\)/);
});

// ─── Pure helper unit tests (vm-extracted, no duplication) ─────────────

const fnMatch = ENTITIES.match(
  /function\s+pickMirrorKinematics\s*\([\s\S]*?\n\}\n/
);
if (!fnMatch) throw new Error('pickMirrorKinematics definition not found in entities.js');

const vm = require('node:vm');
// pickMirrorKinematics references three module-level constants — extract
// them too and inject into the vm sandbox so the helper executes verbatim.
const constMatch = ENTITIES.match(
  /const\s+MIRROR_PROJ_SPD_DEF\s*=\s*\d+[\s\S]*?const\s+MIRROR_PROJ_SPD_MAX\s*=\s*\d+;/
);
if (!constMatch) throw new Error('MIRROR_PROJ_SPD_* constants not found');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  `${constMatch[0]}\n${fnMatch[0]}\nthis.pickMirrorKinematics = pickMirrorKinematics;\nthis.MIRROR_PROJ_SPD_DEF = MIRROR_PROJ_SPD_DEF;\nthis.MIRROR_PROJ_SPD_MIN = MIRROR_PROJ_SPD_MIN;\nthis.MIRROR_PROJ_SPD_MAX = MIRROR_PROJ_SPD_MAX;`,
  sandbox
);
const pickMirrorKinematics = sandbox.pickMirrorKinematics;
const SPD_DEF = sandbox.MIRROR_PROJ_SPD_DEF;
const SPD_MIN = sandbox.MIRROR_PROJ_SPD_MIN;
const SPD_MAX = sandbox.MIRROR_PROJ_SPD_MAX;

test('pickMirrorKinematics returns defaults for null history', () => {
  const k = pickMirrorKinematics(null);
  assert.strictEqual(k.spd, SPD_DEF);
  assert.strictEqual(k.colour, '#88ff44');
});

test('pickMirrorKinematics returns defaults for empty history', () => {
  const k = pickMirrorKinematics([]);
  assert.strictEqual(k.spd, SPD_DEF);
  assert.strictEqual(k.colour, '#88ff44');
});

test('pickMirrorKinematics returns most recent entry', () => {
  const hist = [
    { spd: 8, colour: '#aaa' },
    { spd: 11, colour: '#fff' },
  ];
  const k = pickMirrorKinematics(hist);
  assert.strictEqual(k.spd, 11);
  assert.strictEqual(k.colour, '#fff');
});

test('pickMirrorKinematics clamps speed below MIN', () => {
  const k = pickMirrorKinematics([{ spd: 1, colour: '#fff' }]);
  assert.strictEqual(k.spd, SPD_MIN, `1 should clamp up to ${SPD_MIN}`);
});

test('pickMirrorKinematics clamps speed above MAX', () => {
  const k = pickMirrorKinematics([{ spd: 999, colour: '#fff' }]);
  assert.strictEqual(k.spd, SPD_MAX, `999 should clamp down to ${SPD_MAX}`);
});

test('pickMirrorKinematics handles missing/non-numeric spd', () => {
  const k1 = pickMirrorKinematics([{ colour: '#fff' }]);
  assert.strictEqual(k1.spd, SPD_DEF, 'missing spd → default');
  const k2 = pickMirrorKinematics([{ spd: NaN, colour: '#fff' }]);
  assert.strictEqual(k2.spd, SPD_DEF, 'NaN spd → default');
  const k3 = pickMirrorKinematics([{ spd: Infinity, colour: '#fff' }]);
  assert.strictEqual(k3.spd, SPD_DEF, 'Infinity spd → default');
  const k4 = pickMirrorKinematics([{ spd: 'fast', colour: '#fff' }]);
  assert.strictEqual(k4.spd, SPD_DEF, 'string spd → default');
});

test('pickMirrorKinematics handles missing/empty colour', () => {
  const k1 = pickMirrorKinematics([{ spd: 10 }]);
  assert.strictEqual(k1.colour, '#88ff44', 'missing colour → default');
  const k2 = pickMirrorKinematics([{ spd: 10, colour: '' }]);
  assert.strictEqual(k2.colour, '#88ff44', 'empty colour → default');
});

test('pickMirrorKinematics is null-safe on garbage entries', () => {
  // Last entry being null/undefined must not throw — return defaults.
  const k1 = pickMirrorKinematics([null]);
  assert.strictEqual(k1.spd, SPD_DEF);
  assert.strictEqual(k1.colour, '#88ff44');
  const k2 = pickMirrorKinematics([undefined]);
  assert.strictEqual(k2.spd, SPD_DEF);
});
