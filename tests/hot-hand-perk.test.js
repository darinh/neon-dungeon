'use strict';
// HOT_HAND perk — wiring + behaviour tests.
//
// HOT_HAND is a focus-fire offensive perk: each consecutive direct hit on
// the SAME enemy adds +5% damage (HOT_HAND_PER_STACK), capped at +30%
// (HOT_HAND_MAX_STACKS = 6 stacks beyond the first). The streak resets
// when the player switches targets (different enemy reference) or stops
// hitting any target for HOT_HAND_WINDOW = 3 seconds.
//
// Implemented as a multiplier in Enemy.takeDamage at the same chokepoint
// as the MARK affix bonus and EXPLOITER perk — applied at the top of
// damage processing, BEFORE SHIELDED/shieldGen/NEXUS DR so the bonus
// follows the same mitigation path as the base hit (no double-counting
// against shields, no rounding drift).
//
// Distinct from sibling offensive sources:
//   - PRISTINE (perk)        : +25% ATK at >=90% HP (player-state gate)
//   - BERSERKER (perk)       : +40% ATK at <=25% HP (player-state gate)
//   - GLASS_CANNON (perk)    : flat +30% ATK trade with +25% incoming dmg
//   - STRIDE (perk)          : +5%/sec movement-built ATK stacks (player gate)
//   - DEADEYE (perk)         : +50% next-shot after 1s stillness (player gate)
//   - OVERDRIVE (perk)       : +3%/level via combo.count (kill streak)
//   - EXPLOITER (perk)       : +25% to ALL hits on status-affected enemies
//   - MARK 'of Marking' affix: +30% to follow-up hits on marked targets
//   - HOT_HAND (perk)        : +5%/stack to consecutive hits on same target
//
// HOT_HAND uses STRICTER attribution gates than EXPLOITER because it
// MUTATES player state (the streak counter / last-target ref / window
// timer). Enemy-on-enemy collateral (Volatile, Neural Feedback) and
// environmental damage (Bomb, Tunneller Eruption) all pass STRING
// hitCtx — those must NOT increment the streak. The gate
// `_hctx.effects` truthy filters them out: player projectile/melee
// always pass effects=[] (truthy empty array) at content.js:3770 and
// entities.js:11050; string ctx becomes _hctx=null and is skipped.
//
// Source-text wiring tests (entities.js / content.js are browser-only —
// no UMD/CommonJS exports — same pattern as bulwark / glass-cannon /
// retribution / mark-affix / exploiter tests).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
const CONTENT  = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content.js'),  'utf8');
const GAME     = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'),     'utf8');

// Strip JS comments before regex assertions so a "// if (this.perks.X)"
// comment can't satisfy a gate-presence check (mark-affix / reverse-polarity
// / bulwark / exploiter precedent — see stored memory "test regex pitfalls").
/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Locate Enemy.takeDamage(dmg, hitCtx) — distinct from Player.takeDamage
// which has a different signature (dmg, source, opts).
const ENEMY_TAKE = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*hitCtx\s*\)\s*\{[\s\S]*?\n\s{2}\}/);

// ─── PERK_POOL entry ──────────────────────────────────────────────────────

test('HOT_HAND is registered in PERK_POOL with name/icon/desc/colour', () => {
  const pool = CONTENT.match(/const\s+PERK_POOL\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable in content.js');
  assert.match(pool[0], /HOT_HAND\s*:\s*\{[^}]*name\s*:\s*['"]Hot Hand['"]/,
    'PERK_POOL.HOT_HAND must declare name "Hot Hand"');
  assert.match(pool[0], /HOT_HAND\s*:\s*\{[^}]*icon\s*:/,
    'PERK_POOL.HOT_HAND must declare an icon');
  assert.match(pool[0], /HOT_HAND\s*:\s*\{[^}]*desc\s*:/,
    'PERK_POOL.HOT_HAND must declare a desc');
  assert.match(pool[0], /HOT_HAND\s*:\s*\{[^}]*colour\s*:/,
    'PERK_POOL.HOT_HAND must declare a colour');
});

// ─── Constants ────────────────────────────────────────────────────────────

test('HOT_HAND constants are declared with documented values', () => {
  const src = stripComments(ENTITIES);
  assert.match(src, /HOT_HAND_PER_STACK\s*=\s*0\.05/,
    'HOT_HAND_PER_STACK must be 0.05 (+5% per stack)');
  assert.match(src, /HOT_HAND_MAX_STACKS\s*=\s*6/,
    'HOT_HAND_MAX_STACKS must be 6 (+30% cap at streak >= 7)');
  assert.match(src, /HOT_HAND_WINDOW\s*=\s*3(\.0)?/,
    'HOT_HAND_WINDOW must be 3.0 seconds');
});

// ─── takeDamage hook ──────────────────────────────────────────────────────

test('Enemy.takeDamage applies HOT_HAND multiplier when perk owned', () => {
  assert.ok(ENEMY_TAKE, 'Enemy.takeDamage(dmg, hitCtx) must be locatable');
  const body = stripComments(ENEMY_TAKE[0]);
  assert.match(body, /_EG\.player[\s\S]*?perks\.HOT_HAND/,
    'Enemy.takeDamage must consult _EG.player.perks.HOT_HAND (executable, not comment)');
  // The damage formula must reference HOT_HAND_PER_STACK and the streak.
  const idx = body.search(/perks\.HOT_HAND/);
  assert.ok(idx >= 0);
  const branchSlice = body.slice(idx, idx + 1200);
  assert.match(branchSlice, /HOT_HAND_PER_STACK/,
    'HOT_HAND branch must use HOT_HAND_PER_STACK in the multiplier formula');
  assert.match(branchSlice, /_hotHandStreak/,
    'HOT_HAND branch must read/write _hotHandStreak on the player');
});

test('HOT_HAND branch updates last-target reference and refreshes window timer', () => {
  assert.ok(ENEMY_TAKE);
  const body = stripComments(ENEMY_TAKE[0]);
  const idx = body.search(/perks\.HOT_HAND/);
  assert.ok(idx >= 0);
  const branchSlice = body.slice(idx, idx + 1200);
  assert.match(branchSlice, /_hotHandLastTarget\s*=\s*this/,
    'HOT_HAND branch must set _hotHandLastTarget to this enemy after the hit');
  assert.match(branchSlice, /_hotHandTimer\s*=\s*HOT_HAND_WINDOW/,
    'HOT_HAND branch must refresh _hotHandTimer to HOT_HAND_WINDOW on each qualifying hit');
});

test('HOT_HAND target-switch reset clears streak BEFORE reading bonus', () => {
  // If the current hit lands on a different enemy than _hotHandLastTarget,
  // the streak must reset to 0 BEFORE we compute the bonus, so the first
  // hit on a new target gets +0% (not the prior target's accumulated bonus).
  assert.ok(ENEMY_TAKE);
  const body = stripComments(ENEMY_TAKE[0]);
  const idx = body.search(/perks\.HOT_HAND/);
  assert.ok(idx >= 0);
  const branchSlice = body.slice(idx, idx + 1200);
  assert.match(branchSlice, /_hotHandLastTarget\s*!==\s*this/,
    'HOT_HAND branch must check _hotHandLastTarget !== this for target-switch reset');
  // The reset must zero _hotHandStreak somewhere inside the branch.
  assert.match(branchSlice, /_hotHandStreak\s*=\s*0/,
    'HOT_HAND branch must zero _hotHandStreak on target switch');
});

test('HOT_HAND gates on !ctx.isProc (no double-dip on chain/ricochet)', () => {
  assert.ok(ENEMY_TAKE);
  const body = stripComments(ENEMY_TAKE[0]);
  const idx = body.search(/perks\.HOT_HAND/);
  assert.ok(idx >= 0);
  // Walk back to capture the gate that guards the HOT_HAND branch.
  const branchSlice = body.slice(Math.max(0, idx - 400), idx + 50);
  assert.match(branchSlice, /isProc/,
    'HOT_HAND branch must reference isProc (procs do not double-dip)');
  assert.ok(/!\s*[A-Za-z_$][\w$]*\.?isProc/.test(branchSlice),
    'HOT_HAND gate must be a NEGATION of isProc (procs are skipped)');
});

test('HOT_HAND gates on hitCtx.fromPlayerShot (filters string ctx + ally turrets + auto-fire)', () => {
  // String hitCtx ('Volatile', 'Bomb', 'Auto-Laser', 'Saw Blade', 'Tunneller
  // Eruption', etc.) must NOT increment the streak — those are enemy
  // collateral or environmental damage, not player-attributable hits.
  // Object procs without an explicit fromPlayerShot flag are also filtered:
  //   - Hacked wall turret + Decoy Turret projectiles (ally turrets that
  //     share the projectile-vs-enemy collision path but spawn outside
  //     Player.shoot — fromPlayerShot stays false / falsy)
  //   - Plasma Orb / Sentry Drone auto-fire (game.js per-frame ticks,
  //     also outside Player.shoot)
  //   - Reflected/parried/reverse-polarity flipped projectiles (the flip
  //     path doesn't set the flag, and the underlying projectile started
  //     as an ENEMY shot with the flag false)
  // Only Player.shoot's intentional ranged + melee paths set the flag.
  assert.ok(ENEMY_TAKE);
  const body = stripComments(ENEMY_TAKE[0]);
  const idx = body.search(/perks\.HOT_HAND/);
  assert.ok(idx >= 0);
  const branchSlice = body.slice(Math.max(0, idx - 600), idx + 50);
  assert.match(branchSlice, /typeof\s+hitCtx\s*===?\s*['"]string['"]/,
    'HOT_HAND must defensively coerce string hitCtx to null (filters Volatile/Bomb/etc.)');
  assert.match(branchSlice, /\.fromPlayerShot\b/,
    'HOT_HAND gate must consult ctx.fromPlayerShot to filter ally turrets / auto-fire / collateral');
});

test('Player.shoot sets fromPlayerShot=true on melee hitCtx and ranged projectiles', () => {
  // Source-text wiring check. The flag MUST be set by Player.shoot for
  // both the melee path's hitCtx AND each ranged Projectile spawned
  // (main shot + MULTI_SHOT bonus shot). Otherwise the HOT_HAND gate
  // would falsely reject legitimate player attacks.
  const shootMatch = ENTITIES.match(/shoot\s*\(\s*aimX[\s\S]*?audio\.shoot\(true,\s*w\)/);
  assert.ok(shootMatch, 'Player.shoot block must be locatable');
  const body = stripComments(shootMatch[0]);
  // Melee hitCtx
  assert.match(body, /const\s+hitCtx\s*=\s*\{[^}]*fromPlayerShot\s*:\s*true/,
    'Player.shoot melee hitCtx must include fromPlayerShot:true');
  // Ranged projectile sites — both must set the flag. Match `proj.fromPlayerShot = true` lines.
  const flagAssignments = body.match(/proj\.fromPlayerShot\s*=\s*true/g);
  assert.ok(flagAssignments && flagAssignments.length >= 2,
    'Player.shoot must set proj.fromPlayerShot=true on BOTH ranged projectiles (main + MULTI_SHOT bonus)');
});

test('Projectile pool resets fromPlayerShot=false in _init (no stale flag leak)', () => {
  // Projectile uses object pooling (content.js _projPool) — any field
  // assigned by callers MUST be reset in _init, otherwise a recycled
  // pool slot could deliver a stale fromPlayerShot=true into a freshly-
  // spawned ENEMY projectile, opening a much worse leak than the one
  // this fix closes.
  const src = stripComments(CONTENT);
  // Locate the _init method body. Signature: `_init(x,y,dx,dy,spd,dmg,range,colour,piercing,fromPlayer,weaponName) {`
  const initIdx = src.search(/_init\s*\(\s*x\s*,\s*y[\s\S]*?\)\s*\{/);
  assert.ok(initIdx >= 0, 'Projectile._init signature must be locatable');
  // Walk forward from the opening brace, tracking depth, to find the matching close.
  const openBraceIdx = src.indexOf('{', initIdx);
  let depth = 1, end = openBraceIdx + 1;
  while (end < src.length && depth > 0) {
    const ch = src[end];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    end++;
  }
  assert.ok(depth === 0, 'Projectile._init body must close cleanly');
  const initBody = src.slice(openBraceIdx, end);
  assert.match(initBody, /this\.fromPlayerShot\s*=\s*false/,
    'Projectile._init must reset this.fromPlayerShot = false to prevent stale-flag leaks via the pool');
});

test('Projectile-vs-enemy collision propagates fromPlayerShot into hitCtx', () => {
  // Source-text wiring: the e.takeDamage call inside the player-projectile
  // collision path at content.js (~line 3770) must include the flag in
  // the spread hitCtx so the projectile's flag actually reaches the
  // HOT_HAND gate downstream.
  const src = stripComments(CONTENT);
  assert.match(src, /e\.takeDamage\(\s*this\.dmg\s*,\s*\{[\s\S]*?fromPlayerShot\s*:\s*this\.fromPlayerShot\s*===\s*true/,
    'Player-projectile e.takeDamage call must propagate fromPlayerShot from the projectile into hitCtx');
});

test('Team-flip paths (REFLECTOR / PARRY / REVERSE_POLARITY) clear fromPlayerShot', () => {
  // A player projectile starts with fromPlayerShot=true, can be reflected
  // by a REFLECTOR enemy (fromPlayer→false), then PARRY'd or REVERSE-
  // POLARITY'd back to fromPlayer=true. Without explicitly clearing
  // fromPlayerShot at each conversion, that twice-flipped projectile
  // would still satisfy the HOT_HAND gate even though it's no longer
  // a direct Player.shoot hit. Round-2 review caught this regression.
  // All three flip paths must zero the flag (defense in depth — the
  // chain only needs ONE break to be safe, but if a future flip path
  // is added without the clear, we lose the guarantee).
  const src = stripComments(CONTENT);

  // REFLECTOR enemy bounces a player projectile back. Locate the block
  // by its hallmark `this.fromPlayer = false` + `ownerType = 'Reflected'`.
  const reflectorMatch = src.match(/this\.fromPlayer\s*=\s*false[\s\S]{0,400}ownerType\s*=\s*['"]Reflected['"]/);
  assert.ok(reflectorMatch, 'REFLECTOR flip block must be locatable');
  assert.match(reflectorMatch[0], /this\.fromPlayerShot\s*=\s*false/,
    'REFLECTOR flip path must clear this.fromPlayerShot');

  // PARRY perk: dashing player reflects an enemy projectile back as their own.
  const parryMatch = src.match(/perks\.PARRY[\s\S]{0,400}ownerType\s*=\s*['"]Parry['"]/);
  assert.ok(parryMatch, 'PARRY flip block must be locatable');
  assert.match(parryMatch[0], /this\.fromPlayerShot\s*=\s*false/,
    'PARRY flip path must clear this.fromPlayerShot');

  // REVERSE_POLARITY hackware: AoE flip enemy projectiles to player-owned.
  const rpMatch = src.match(/p\.fromPlayer\s*=\s*true[\s\S]{0,400}ownerType\s*=\s*['"]Reverse Polarity['"]/);
  assert.ok(rpMatch, 'REVERSE_POLARITY flip block must be locatable');
  assert.match(rpMatch[0], /p\.fromPlayerShot\s*=\s*false/,
    'REVERSE_POLARITY flip path must clear p.fromPlayerShot');
});

test('HOT_HAND placement: AFTER MARK and EXPLOITER, BEFORE SHIELDED', () => {
  // Placement rationale:
  //   - AFTER MARK so a Marking-weapon follow-up benefits from the mark
  //     bonus AND the streak bonus (multiplicative, by design).
  //   - AFTER EXPLOITER so the streak bonus stacks on top of the status
  //     bonus when both apply.
  //   - BEFORE SHIELDED so the bonus is mitigated by shield absorption
  //     like any other damage (no double-counting against shields).
  assert.ok(ENEMY_TAKE);
  const body = stripComments(ENEMY_TAKE[0]);
  const markIdx     = body.search(/_markedTimer\s*>\s*0[\s\S]{0,200}\*\s*1\.30/);
  const exploiterIdx = body.search(/perks\.EXPLOITER/);
  const hotHandIdx  = body.search(/perks\.HOT_HAND/);
  const shieldedIdx = body.search(/eliteAffix\s*===\s*['"]SHIELDED['"][\s\S]{0,200}shieldHp\s*>\s*0/);
  assert.ok(markIdx >= 0,      'MARK affix block must be locatable');
  assert.ok(exploiterIdx >= 0, 'EXPLOITER branch must be locatable');
  assert.ok(hotHandIdx >= 0,   'HOT_HAND branch must be locatable');
  assert.ok(shieldedIdx >= 0,  'SHIELDED elite-affix block must be locatable');
  assert.ok(hotHandIdx > markIdx,
    'HOT_HAND must appear AFTER the MARK affix block');
  assert.ok(hotHandIdx > exploiterIdx,
    'HOT_HAND must appear AFTER the EXPLOITER block');
  assert.ok(hotHandIdx < shieldedIdx,
    'HOT_HAND must appear BEFORE the SHIELDED block (so bonus is mitigated by shields)');
});

// ─── Player constructor init ──────────────────────────────────────────────

test('Player constructor initialises HOT_HAND fields to neutral state', () => {
  const ctor = ENTITIES.match(/class\s+Player[\s\S]*?constructor\s*\([\s\S]*?\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(ctor, 'Player constructor must be locatable');
  const body = stripComments(ctor[0]);
  assert.match(body, /this\._hotHandStreak\s*=\s*0/,
    'Player constructor must init _hotHandStreak = 0');
  assert.match(body, /this\._hotHandLastTarget\s*=\s*null/,
    'Player constructor must init _hotHandLastTarget = null');
  assert.match(body, /this\._hotHandTimer\s*=\s*0/,
    'Player constructor must init _hotHandTimer = 0');
});

// ─── loadFloor reset ──────────────────────────────────────────────────────

test('loadFloor() resets HOT_HAND state on floor transition', () => {
  // Per stored "player movement accumulators" rule: any new accumulator
  // gated on hits / movement / time must be reset in loadFloor() alongside
  // burnTimer/shockTimer. For HOT_HAND specifically, the reset also drops
  // a stale _hotHandLastTarget reference to a now-removed enemy from the
  // previous floor (memory tidiness — the GC can collect once nothing
  // else holds the dead enemy ref).
  const src = stripComments(GAME);
  // The reset block must touch all three fields.
  assert.match(src, /this\.player\._hotHandStreak\s*=\s*0/,
    'loadFloor must reset player._hotHandStreak = 0');
  assert.match(src, /this\.player\._hotHandLastTarget\s*=\s*null/,
    'loadFloor must reset player._hotHandLastTarget = null');
  assert.match(src, /this\.player\._hotHandTimer\s*=\s*0/,
    'loadFloor must reset player._hotHandTimer = 0');
});

// ─── Window-timer decay in Player.update ──────────────────────────────────

test('Player.update decays _hotHandTimer and clears streak on expiry', () => {
  // The takeDamage hook handles the target-switch reset path; the
  // Player.update tick handles ONLY the timeout path. Without this
  // tick, a stale _hotHandLastTarget would survive a long disengagement
  // (e.g. a cross-floor sprint with no enemies in range).
  const src = stripComments(ENTITIES);
  // Find an `if (this._hotHandTimer > 0)` block and check it decrements
  // by dt then zeroes the streak/last-target on expiry.
  const tickMatch = src.match(/if\s*\(\s*this\._hotHandTimer\s*>\s*0\s*\)\s*\{[\s\S]*?\n\s{4}\}/);
  assert.ok(tickMatch, 'Player.update must contain an if (this._hotHandTimer > 0) tick block');
  const tickBody = tickMatch[0];
  assert.match(tickBody, /this\._hotHandTimer\s*=\s*Math\.max\s*\(\s*0\s*,\s*this\._hotHandTimer\s*-\s*dt\s*\)/,
    'Tick must decrement _hotHandTimer by dt with floor at 0');
  assert.match(tickBody, /this\._hotHandStreak\s*=\s*0/,
    'On window expiry, _hotHandStreak must be cleared');
  assert.match(tickBody, /this\._hotHandLastTarget\s*=\s*null/,
    'On window expiry, _hotHandLastTarget must be cleared');
});

// ─── Numerical formula sanity ─────────────────────────────────────────────

test('HOT_HAND formula: +5% per stack capped at 6 stacks (+30%)', () => {
  // Re-derive the HOT_HAND streak progression. The current hit reads the
  // streak from the PREVIOUS hits on the same target, so:
  //   streak before this hit | bonus on this hit | streak after this hit
  //         0 (1st hit)        |        +0%        |        1
  //         1                  |        +5%        |        2
  //         2                  |       +10%        |        3
  //         3                  |       +15%        |        4
  //         4                  |       +20%        |        5
  //         5                  |       +25%        |        6
  //         6                  |       +30%        |        7
  //         7+ (capped)        |       +30%        |        8...
  const HH_PER_STACK = 0.05;
  const HH_MAX_STACKS = 6;
  /**
   * Simulates the takeDamage hook. `state` mutates between calls.
   * @param {{ streak: number, lastTarget: any, timer: number }} state
   * @param {number} dmg
   * @param {any} target  reference identity matters
   * @param {{ isProc?: boolean, isStringCtx?: boolean, fromPlayerShot?: boolean,
   *           hasPerk?: boolean, dt?: number }} [opts]
   */
  function applyHit(state, dmg, target, opts) {
    const o = opts || {};
    // Optional pre-hit window decay (simulates Player.update tick).
    if (o.dt && state.timer > 0) {
      state.timer = Math.max(0, state.timer - o.dt);
      if (state.timer <= 0) { state.streak = 0; state.lastTarget = null; }
    }
    if (o.isProc || o.isStringCtx || !o.fromPlayerShot || !o.hasPerk) return dmg;
    if (state.lastTarget !== target) state.streak = 0;
    const stacks = Math.min(state.streak, HH_MAX_STACKS);
    let out = dmg;
    if (stacks > 0) out = Math.round(dmg * (1 + stacks * HH_PER_STACK));
    state.streak += 1;
    state.lastTarget = target;
    state.timer = 3.0;
    return out;
  }
  const A = { id: 'A' }, B = { id: 'B' };
  const baseOpts = { hasPerk: true, fromPlayerShot: true };

  // No perk → no bonus, no streak update.
  let s = { streak: 0, lastTarget: null, timer: 0 };
  assert.equal(applyHit(s, 20, A, { hasPerk: false, fromPlayerShot: true }), 20);
  assert.equal(s.streak, 0, 'No-perk hit must not increment streak');

  // Ally turret / auto-fire (fromPlayerShot=false) must NOT increment streak
  // even with the perk owned. This is the codex/gpt-5.5-flagged attribution leak.
  s = { streak: 0, lastTarget: null, timer: 0 };
  assert.equal(applyHit(s, 20, A, { hasPerk: true, fromPlayerShot: false }), 20,
    'Ally turret hit (fromPlayerShot=false) must not benefit from streak');
  assert.equal(s.streak, 0, 'Ally turret hit must NOT increment player streak');
  assert.equal(s.lastTarget, null, 'Ally turret hit must NOT reassign lastTarget');

  // Perk owned + intentional player shot, full progression on a single target.
  s = { streak: 0, lastTarget: null, timer: 0 };
  assert.equal(applyHit(s, 20, A, baseOpts), 20, '1st hit: +0%');
  assert.equal(s.streak, 1);
  assert.equal(applyHit(s, 20, A, baseOpts), 21, '2nd hit: 20*1.05 = 21');
  assert.equal(s.streak, 2);
  assert.equal(applyHit(s, 20, A, baseOpts), 22, '3rd hit: 20*1.10 = 22');
  assert.equal(applyHit(s, 20, A, baseOpts), 23, '4th hit: 20*1.15 = 23');
  assert.equal(applyHit(s, 20, A, baseOpts), 24, '5th hit: 20*1.20 = 24');
  assert.equal(applyHit(s, 20, A, baseOpts), 25, '6th hit: 20*1.25 = 25');
  assert.equal(applyHit(s, 20, A, baseOpts), 26, '7th hit: 20*1.30 = 26 (cap)');
  assert.equal(applyHit(s, 20, A, baseOpts), 26, '8th hit: still 26 (capped at +30%)');
  assert.equal(applyHit(s, 20, A, baseOpts), 26, '9th hit: still 26');
  assert.equal(s.streak, 9, 'Streak counter keeps incrementing past cap (cap is on bonus, not streak)');

  // An ally turret hit on the SAME target mid-streak must NOT advance or reset.
  assert.equal(applyHit(s, 20, A, { hasPerk: true, fromPlayerShot: false }), 20,
    'Ally turret hit during active streak: no bonus');
  assert.equal(s.streak, 9, 'Ally turret hit must not modify mid-streak counter');
  // And the next intentional player shot still gets the +30% cap because the
  // streak wasn't disrupted by the turret.
  assert.equal(applyHit(s, 20, A, baseOpts), 26, 'Player shot after turret: still +30%');
  assert.equal(s.streak, 10);

  // Target switch: streak resets to 1 on first hit on B, no bonus.
  assert.equal(applyHit(s, 20, B, baseOpts), 20, 'Switch to B: +0% (streak resets before read)');
  assert.equal(s.streak, 1);
  assert.equal(s.lastTarget, B);
  assert.equal(applyHit(s, 20, B, baseOpts), 21, '2nd hit on B: +5%');

  // Switch back to A: streak resets again — kiting between two targets
  // never accumulates beyond the first hit on each.
  assert.equal(applyHit(s, 20, A, baseOpts), 20, 'Switch back to A: streak resets to 1');
  assert.equal(s.streak, 1);

  // Proc hits do NOT increment, do NOT read bonus, do NOT change last-target.
  s = { streak: 3, lastTarget: A, timer: 3.0 };
  assert.equal(applyHit(s, 20, B, { isProc: true, fromPlayerShot: true, hasPerk: true }), 20,
    'Proc hit on B returns base damage');
  assert.equal(s.streak, 3, 'Proc hit must not modify streak');
  assert.equal(s.lastTarget, A, 'Proc hit must not reassign lastTarget');

  // String ctx (Bomb / Volatile / Auto-Laser) does not increment streak.
  s = { streak: 3, lastTarget: A, timer: 3.0 };
  assert.equal(applyHit(s, 20, A, { isStringCtx: true, fromPlayerShot: false, hasPerk: true }), 20);
  assert.equal(s.streak, 3, 'String ctx must not modify streak');

  // Window expiry: 3.5s gap clears streak; next hit on same target gets +0%.
  s = { streak: 4, lastTarget: A, timer: 3.0 };
  assert.equal(applyHit(s, 20, A, { ...baseOpts, dt: 3.5 }), 20,
    'After 3.5s gap, streak resets to 1 (no bonus on this hit)');
  assert.equal(s.streak, 1);

  // Window NOT expired (2.0s gap): streak survives.
  s = { streak: 4, lastTarget: A, timer: 3.0 };
  assert.equal(applyHit(s, 20, A, { ...baseOpts, dt: 2.0 }), 24,
    '2.0s gap < window: 5th hit still gets +20%');
  assert.equal(s.streak, 5);

  // Rounding sanity: small base damage rounds favorably/unfavorably as expected.
  // 1 * 1.30 = 1.3 → round → 1 (no inflation at the low end).
  // 2 * 1.30 = 2.6 → round → 3.
  // 3 * 1.30 = 3.9 → round → 4.
  s = { streak: 6, lastTarget: A, timer: 3.0 }; // streak=6 → +30% on this hit
  assert.equal(applyHit(s, 1, A, baseOpts), 1);
  s = { streak: 6, lastTarget: A, timer: 3.0 };
  assert.equal(applyHit(s, 2, A, baseOpts), 3);
  s = { streak: 6, lastTarget: A, timer: 3.0 };
  assert.equal(applyHit(s, 3, A, baseOpts), 4);
});

// ─── (sw.js cache-version assertion intentionally omitted — per AGENTS.md
//      service-worker section, new test files MUST NOT introduce floor
//      assertions; CI bumps sw.js automatically on push to develop based
//      on the merged commit's conventional prefix.)
