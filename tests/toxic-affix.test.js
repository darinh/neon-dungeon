'use strict';
// TOXIC 'of Toxin' weapon-affix suffix — source-text wiring tests.
//
// TOXIC is a stacking on-hit DoT (each direct hit adds 1 stack, cap 5,
// 4s decay window; per-tick damage is `stacks * 0.5 * dt` so 5 stacks
// = 2.5 dps for 4s). Mechanically distinct from FLAME ('of Flame', fixed
// 3 dps for 3s) — TOXIC rewards SUSTAINED DPS, FLAME rewards single-trigger.
//
// On-hit application routes through applyHitEffects in src/entities.js
// via the shared `ctx.effects.includes('poison')` switch. Per-tick damage
// runs in tickEnemyStatusEffects, mirroring the burn DoT structure
// (PHASING/_wrPhased gate, SHIELDED shield-first absorb, REGENERATIVE
// _regenTimer reset on dmg > 0, _lastHitCtx attribution on death).
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports), so
// we can't load applyHitEffects directly under node:test. Instead, these
// tests assert the structural invariants any working TOXIC suffix must
// satisfy: registry shape, on-hit gate, stack increment + cap, timer
// refresh, DoT branch shape, all defense-in-depth gates, on-death
// attribution, and the timer-expiry stack reset.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'weapons.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const ELITE_AFFIXES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'elite-affixes.js'), 'utf8'
);

// Strip /* ... */ and // ... comments so source-text regex assertions
// match against EXECUTABLE source, not commentary that incidentally
// quotes the gate token. Pattern from tests/{siphon,greedy,lucky,
// salvage,mark,deadly}-affix.test.js (per stored memory 'test
// source-text extraction'). NOTE: also strips JSDoc — for any test
// that intentionally matches a JSDoc annotation, run against raw
// source instead (per stored memory 'stripComments + JSDoc').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);
const ELITE_AFFIXES_CODE = stripComments(ELITE_AFFIXES);
const CONTENT_CODE = stripComments(CONTENT);

// Brace-walked extractor for the `eff === 'poison'` branch body. Plain
// `.match(/eff === 'poison'\s*\)\s*\{[^}]+\}/)` would over-stop at the
// first `}` (closing an inner object literal or sub-block). Walk braces
// from the branch's opener to its matching close to isolate ONE branch
// only. Pattern from tests/execute-affix.test.js extractBranch helper
// (per stored memory 'test source-text extraction').
function extractBranch(src, anchorRe) {
  const m = src.match(anchorRe);
  if (!m) return '';
  const startIdx = m.index;
  const openIdx = src.indexOf('{', startIdx);
  if (openIdx < 0) return '';
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return '';
}

test('TOXIC is registered in WEAPON_AFFIXES as a suffix with effect:poison', () => {
  // slot:'suffix' is critical — slot routes the affix through the on-hit /
  // on-kill effect path. A typo to 'prefix' would silently route into the
  // mod-loop in buildWeapon() and never reach the on-hit gate.
  // effect:'poison' is the keyword applyHitEffects switches on; if it
  // diverges from the gate string the suffix becomes a cosmetic no-op.
  const re = /TOXIC:\s*\{\s*slot:\s*'suffix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*effect:\s*'poison'\s*\}/;
  assert.match(CONTENT, re,
    "TOXIC must be a suffix with label/colour/desc and effect:'poison'");
});

test('TOXIC is auto-included in AFFIX_SUFFIXES via Object.keys derivation', () => {
  // AFFIX_SUFFIXES is derived from Object.keys(WEAPON_AFFIXES).filter(...)
  // so any new entry with slot:'suffix' is auto-included by the random
  // affix roller. Lock the derivation so a future refactor that moves
  // to a hand-maintained list (where TOXIC could be silently omitted)
  // is caught.
  assert.match(CONTENT,
    /const AFFIX_SUFFIXES = AFFIX_KEYS\.filter\(k => WEAPON_AFFIXES\[k\]\.slot === 'suffix'\)/,
    'AFFIX_SUFFIXES must remain Object.keys/filter so TOXIC is auto-included');
});

test('TOXIC label is distinct from existing affix labels (no duplication)', () => {
  // Existing suffix labels: of Flame, of Frost, of Vampirism, of Thunder,
  // of Detonation, of Storms, of Recoil, of Execution, of Marking,
  // of Greed, of Salvage, of Luck, of Siphoning. TOXIC must not collide.
  const m = CONTENT.match(/TOXIC:[^}]*label:\s*'([^']+)'/);
  assert.ok(m, 'TOXIC entry must have a label');
  const label = m[1].toLowerCase();
  assert.ok(!/flame|frost|vampir|thunder|detonat|storm|recoil|execut|mark|greed|salvage|luck|siphon/.test(label),
    `TOXIC label must be distinct from existing affixes, got "${label}"`);
});

test('TOXIC desc mentions stacks and a cap (player-facing semantics)', () => {
  // The desc is the only signal a player gets in the affix-roll UI about
  // the stacking mechanic. Without "stack" + a cap reference, players
  // wouldn't know it's distinct from FLAME's fixed DoT.
  const m = CONTENT.match(/TOXIC:[^}]*desc:\s*'([^']+)'/);
  assert.ok(m, 'TOXIC entry must have a desc');
  const desc = m[1].toLowerCase();
  assert.ok(/stack/.test(desc), `TOXIC desc must mention "stack" (player needs the cue), got "${m[1]}"`);
  assert.ok(/\b5\b|max|cap/.test(desc), `TOXIC desc must signal a stack cap, got "${m[1]}"`);
});

test('applyHitEffects has a poison branch gated on eff === "poison"', () => {
  // TOXIC is on-HIT (not on-kill like GREEDY/LUCKY/SALVAGE), so the gate
  // lives in applyHitEffects, not Enemy.die(). The branch must match the
  // per-eff pattern used by every other on-hit suffix so the loop dispatches
  // into it. Strip comments first (a JSDoc / inline note quoting 'poison'
  // would false-pass).
  assert.match(ENTITIES_CODE, /eff\s*===\s*'poison'/,
    "applyHitEffects must have an `eff === 'poison'` branch");
});

test('TOXIC poison branch lives inside applyHitEffects (not applyOnKill)', () => {
  // Per-hit affixes route through applyHitEffects. If a future refactor
  // accidentally moves the branch into applyOnKill, stacks would only
  // tick on KILLS — defeating the whole "stack while you DPS" design.
  // Anchor the gate by checking it appears BETWEEN the applyHitEffects
  // function declaration and the applyOnKill function declaration.
  const fxIdx = ENTITIES_CODE.indexOf('function applyHitEffects(');
  const okIdx = ENTITIES_CODE.indexOf('function applyOnKill(');
  const poisonIdx = ENTITIES_CODE.indexOf("eff === 'poison'");
  assert.ok(fxIdx !== -1, 'applyHitEffects function must exist');
  assert.ok(okIdx !== -1, 'applyOnKill function must exist');
  assert.ok(poisonIdx !== -1, 'poison branch must exist');
  assert.ok(poisonIdx > fxIdx && poisonIdx < okIdx,
    'TOXIC poison branch must live inside applyHitEffects, not applyOnKill');
});

test('TOXIC apply-branch increments poisonStacks with cap 5 and || 0 nucleation', () => {
  // The increment must be on the ENEMY (per-enemy state — distinct from
  // SIPHON's per-player counter). Cap MUST be 5 — bumping to 10 doubles
  // sustained DPS, dropping to 3 makes it weaker than FLAME. The `|| 0`
  // nucleation prevents NaN poisoning on the first hit (poisonStacks
  // starts undefined). Anchor inside the brace-walked branch body.
  const branch = extractBranch(ENTITIES_CODE, /eff\s*===\s*'poison'/);
  assert.ok(branch, 'poison branch must exist with a brace-balanced body');
  // Match `<ident>.poisonStacks = Math.min(5, (<ident>.poisonStacks || 0) + 1)`
  // and pin both bindings to the same identifier.
  const m = branch.match(/(\w+)\.poisonStacks\s*=\s*Math\.min\(\s*5\s*,\s*\(\s*(\w+)\.poisonStacks\s*\|\|\s*0\s*\)\s*\+\s*1\s*\)/);
  assert.ok(m, 'TOXIC apply must be `<ident>.poisonStacks = Math.min(5, (<ident>.poisonStacks || 0) + 1)`');
  assert.strictEqual(m[1], m[2],
    'increment LHS and RHS must reference the same binding (per-enemy, no cross-binding leak)');
  // The same binding must be the `enemy` parameter — applyHitEffects's
  // first argument. Anchor by checking the apply branch also uses the
  // same identifier with `.x` and `.y` (every enemy carries those, the
  // particle spawn at branch tail uses them).
  const ident = m[1];
  const xyRe = new RegExp(`\\b${ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[xy]\\b`);
  assert.match(branch, xyRe,
    `TOXIC apply must operate on the enemy binding (got ${ident}, must also reference ${ident}.x/y)`);
});

test('TOXIC apply-branch refreshes poisonTimer to 4s on every hit', () => {
  // Refresh-on-hit is the entire reason for the timer mechanic — a
  // non-refreshed timer would let stacks expire mid-fight. 4s is the
  // balance lever (matches FLAME's 3s + 1s, leaving room for the
  // 5-stack ramp). Pin the value so an unintentional re-tune is caught.
  const branch = extractBranch(ENTITIES_CODE, /eff\s*===\s*'poison'/);
  assert.ok(branch, 'poison branch must exist');
  assert.match(branch, /\.poisonTimer\s*=\s*4\b/,
    'TOXIC apply must set `<enemy>.poisonTimer = 4` (refresh window)');
});

test('TOXIC poison DoT branch lives in tickEnemyStatusEffects', () => {
  // Per-tick damage MUST live in tickEnemyStatusEffects (the per-enemy
  // per-frame status loop). If a future refactor moves it into
  // tickEliteAffix or anywhere else, non-elite enemies would never tick
  // the DoT — the affix becomes a 1-stack-on-apply no-op DoT. Anchor by
  // extracting tickEnemyStatusEffects directly and confirming the elite
  // affix subsystem does not contain the poison timer gate.
  const tickBody = extractBranch(ENTITIES_CODE, /function\s+tickEnemyStatusEffects\s*\(/);
  assert.ok(tickBody, 'tickEnemyStatusEffects body must be extractable');
  assert.match(tickBody, /enemy\.poisonTimer > 0/, 'poison DoT tick must live inside tickEnemyStatusEffects');
  assert.doesNotMatch(ELITE_AFFIXES_CODE, /enemy\.poisonTimer > 0/,
    'TOXIC poison DoT must not live in tickEliteAffix/elite-affixes.js');
});

test('TOXIC DoT damage scales as poisonStacks * 0.5 * dt (FPS-independent, per-stack)', () => {
  // Damage = stacks * 0.5 * dt is the core balance: 1 stack = 0.5 dps,
  // 5 stacks = 2.5 dps. The dt scaling makes it FPS-independent (60 vs
  // 120 fps tick identically). Per-stack scaling is what differentiates
  // TOXIC from FLAME's flat 3 dps. Anchor by extracting the DoT branch
  // body via brace-walk.
  const branch = extractBranch(ENTITIES_CODE, /enemy\.poisonTimer > 0/);
  assert.ok(branch, 'poison DoT branch must exist with a brace-balanced body');
  // Match `let dmg = (enemy.poisonStacks || 0) * 0.5 * dt` (or any
  // equivalent shape that includes stacks, the 0.5 per-stack rate, and
  // dt). Pin all three pieces.
  const m = branch.match(/let\s+dmg\s*=\s*\(\s*enemy\.poisonStacks\s*\|\|\s*0\s*\)\s*\*\s*0\.5\s*\*\s*dt/);
  assert.ok(m, 'TOXIC DoT damage must be `let dmg = (enemy.poisonStacks || 0) * 0.5 * dt` (stacks * per-stack-dps * dt)');
});

test('TOXIC DoT respects PHASING / _wrPhased immunity (no damage during phase)', () => {
  // Mirrors burn — a phasing mob can't be burst-killed mid-phase by
  // accumulated poison ticks. The gate must be `!enemy.phaseImmune
  // && !enemy._wrPhased` (both PHASING elite affix AND WRAITH-class
  // phase). Without this, poison would bypass the whole defensive
  // mechanic of phase windows.
  const branch = extractBranch(ENTITIES_CODE, /enemy\.poisonTimer > 0/);
  assert.ok(branch, 'poison DoT branch must exist');
  assert.match(branch, /!enemy\.phaseImmune\s*&&\s*!enemy\._wrPhased/,
    'TOXIC DoT must gate damage on `!enemy.phaseImmune && !enemy._wrPhased` (mirror burn)');
});

test('TOXIC DoT routes through SHIELDED shield-first absorb (mirror burn)', () => {
  // Mirrors burn: SHIELDED elite affix's shield must absorb DoT BEFORE
  // hp loss. Gated on the SHIELDED affix specifically — SHIELDER's
  // directional shield (also uses shieldHp) must NOT be drained from
  // omnidirectional DoT or its 5s broken-recovery contract breaks.
  // Anchor inside the DoT branch.
  const branch = extractBranch(ENTITIES_CODE, /enemy\.poisonTimer > 0/);
  assert.ok(branch, 'poison DoT branch must exist');
  assert.match(branch, /enemy\.eliteAffix\s*===\s*'SHIELDED'/,
    'TOXIC DoT must check `enemy.eliteAffix === \'SHIELDED\'` for shield-first absorb');
  assert.match(branch, /enemy\.shieldHp\s*-=\s*absorbed/,
    'TOXIC DoT must drain shieldHp before applying poison damage to hp');
});

test('TOXIC DoT resets REGENERATIVE _regenTimer on dmg > 0 (anti-regression)', () => {
  // Burn DoT has the same wiring (entities.js ~line 1271) — without it,
  // poison-and-retreat would let the regen clock count up while the
  // enemy actively loses HP. Same defense-in-depth gate as REGENERATIVE
  // wired into the burn path. Caught structurally before a live regression.
  const branch = extractBranch(ENTITIES_CODE, /enemy\.poisonTimer > 0/);
  assert.ok(branch, 'poison DoT branch must exist');
  assert.match(branch, /if\s*\(\s*dmg\s*>\s*0\s*&&\s*_EG\.modifier\s*===\s*'REGENERATIVE'\s*\)\s*enemy\._regenTimer\s*=\s*0/,
    'TOXIC DoT must reset _regenTimer on `dmg > 0 && _EG.modifier === \'REGENERATIVE\'` (mirror burn)');
});

test('TOXIC DoT-finished kill sets _lastHitCtx for on-kill affix attribution', () => {
  // Mirror burn's attribution: if a prior direct-hit ctx exists (the
  // hit that applied the poison), unmark isProc so on-kill affixes
  // (GREEDY/LUCKY/SALVAGE/DETONATE) credit the kill to the weapon
  // that landed the last direct hit. If no prior ctx, fall back to a
  // proc-marked Toxin ctx (no on-kill credit but the kill is recorded).
  const branch = extractBranch(ENTITIES_CODE, /enemy\.poisonTimer > 0/);
  assert.ok(branch, 'poison DoT branch must exist');
  assert.match(branch, /if\s*\(\s*!enemy\._lastHitCtx\s*\)\s*enemy\._lastHitCtx\s*=\s*\{\s*name\s*:\s*'Toxin'/,
    'TOXIC DoT-kill must set `enemy._lastHitCtx = { name: \'Toxin\', isProc: true }` when no prior ctx');
  assert.match(branch, /else\s+enemy\._lastHitCtx\.isProc\s*=\s*false/,
    'TOXIC DoT-kill must unmark isProc on a prior ctx (so on-kill affixes credit the player\'s last direct hit)');
});

test('TOXIC DoT timer expiry resets stacks to 0 (no carryover)', () => {
  // Without this, an enemy that survived a poison stack-out would carry
  // residual stacks into the NEXT poison apply — a single hit would
  // re-trigger the cap immediately. Mirror burn's `enemy.burnTimer = 0;
  // enemy.burnDps = 0` cleanup. Pin both fields.
  const branch = extractBranch(ENTITIES_CODE, /enemy\.poisonTimer > 0/);
  assert.ok(branch, 'poison DoT branch must exist');
  assert.match(branch, /if\s*\(\s*enemy\.poisonTimer\s*<=\s*0\s*\)\s*\{\s*enemy\.poisonTimer\s*=\s*0\s*;\s*enemy\.poisonStacks\s*=\s*0\s*;?\s*\}/,
    'TOXIC DoT must reset both poisonTimer AND poisonStacks to 0 on timer expiry');
});

test('TOXIC DoT damage is gated to apply only when stacks > 0 (no zero-tick leak)', () => {
  // Defense in depth: if the apply branch is ever bypassed (e.g. a future
  // refactor sets poisonTimer without seeding stacks), `0 * 0.5 * dt = 0`
  // damage means no hp loss. Verified by computation rather than gate —
  // (poisonStacks || 0) * 0.5 * dt naturally yields 0 when stacks is 0.
  // This test pins the multiplicative shape so a future refactor that
  // changes to ADDITIVE base damage (e.g. `0.5 + stacks * 0.3 * dt`)
  // would break this contract and FAIL THIS TEST.
  const branch = extractBranch(ENTITIES_CODE, /enemy\.poisonTimer > 0/);
  assert.ok(branch, 'poison DoT branch must exist');
  // Stronger: assert there is no `+` between the stacks term and the dt
  // term (would imply additive base damage that fires even at 0 stacks).
  // Match the dmg assignment line specifically.
  const dmgLineMatch = branch.match(/let\s+dmg\s*=\s*([^;]+);/);
  assert.ok(dmgLineMatch, 'TOXIC DoT must have a `let dmg = ...;` assignment');
  const dmgExpr = dmgLineMatch[1];
  assert.ok(!/\+/.test(dmgExpr),
    `TOXIC DoT damage expr must be purely multiplicative (no additive base — would fire at 0 stacks). Got: ${dmgExpr}`);
});

test('TOXIC has exactly one apply branch and exactly one DoT branch (anti-duplication)', () => {
  // A duplicate apply branch (e.g. accidentally pasted twice) would
  // double-stack on every hit, breaking the cap. A duplicate DoT branch
  // would double the per-tick damage. Lock the count.
  const applyMatches = ENTITIES_CODE.match(/eff\s*===\s*'poison'/g) || [];
  assert.equal(applyMatches.length, 1,
    `entities.js must contain exactly 1 \`eff === 'poison'\` apply branch; got ${applyMatches.length}`);
  const tickMatches = ENTITIES_CODE.match(/enemy\.poisonTimer\s*>\s*0/g) || [];
  assert.equal(tickMatches.length, 1,
    `entities.js must contain exactly 1 \`enemy.poisonTimer > 0\` DoT branch; got ${tickMatches.length}`);
});

test('TOXIC effect token is consistent between content.js registry and entities.js gate', () => {
  // The effect string in content.js (`effect:'poison'`) MUST match the
  // gate string in entities.js (`eff === 'poison'`). A divergence
  // (e.g. one says 'poison' and the other says 'toxin') would silently
  // make the affix a cosmetic no-op. Pin both via the same literal.
  const contentMatch = CONTENT_CODE.match(/TOXIC:[^}]*effect:\s*'([^']+)'/);
  assert.ok(contentMatch, 'TOXIC entry must declare an effect token');
  const effectToken = contentMatch[1];
  assert.strictEqual(effectToken, 'poison',
    `TOXIC effect token must be 'poison' (matches the gate in applyHitEffects), got '${effectToken}'`);
  const gateRe = new RegExp(`eff\\s*===\\s*'${effectToken}'`);
  assert.match(ENTITIES_CODE, gateRe,
    `applyHitEffects must have a gate \`eff === '${effectToken}'\` matching content.js TOXIC.effect`);
});

test('TOXIC poisonTimer is recognised by the EXPLOITER perk status check (cross-feature lock)', () => {
  // EXPLOITER perk grants +25% damage to enemies suffering ANY status
  // effect. When TOXIC was added, EXPLOITER's enumerated status list
  // (burnTimer/slowTimer/stunTimer/_markedTimer) did NOT include
  // poisonTimer — caught by the gpt-5.5 + opus adversarial reviewers
  // 2026-04-28. A poisoned-only enemy would silently miss the bonus,
  // breaking parity with FLAME's burn DoT.
  //
  // This test locks the cross-feature wiring from TOXIC's side too
  // (the matching `tests/exploiter-perk.test.js` test #75 locks it
  // from EXPLOITER's side). A future refactor that drops poisonTimer
  // from EXPLOITER's enumerated check is caught HERE as well.
  const exploiterIdx = ENTITIES_CODE.search(/perks\.EXPLOITER/);
  assert.ok(exploiterIdx !== -1, 'EXPLOITER branch must exist in entities.js');
  // The status enumeration lives within ~700 chars of the perk gate
  // (mirror the slice size in tests/exploiter-perk.test.js).
  const branchSlice = ENTITIES_CODE.slice(exploiterIdx, exploiterIdx + 700);
  assert.match(branchSlice, /this\.poisonTimer/,
    "EXPLOITER perk status check must include this.poisonTimer (TOXIC affix) — otherwise a poisoned-only enemy fails the +25% gate while burn/slow/stun/mark all qualify");
});
