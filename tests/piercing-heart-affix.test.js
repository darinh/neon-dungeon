'use strict';
// PIERCING_HEART 'of Piercing Heart' weapon-affix suffix — source-text
// wiring tests.
//
// PIERCING_HEART is an on-kill suffix: each qualifying kill grants +1
// Max HP and a +1 heal, hard-capped at +20 stacks per run. The cap is
// the entire balance lever — without it, a long bounty-rich floor would
// scale player HP indefinitely and trivialise late-floor encounters.
// The 20-stack cap = +25% effective HP for an 80-HP base, on par with
// a META_UPGRADE max-hp tier.
//
// content.js / entities.js / game.js are browser-only (no UMD/CommonJS
// exports), so we can't load die() / saveGame / continueGame directly
// under node:test. Instead, these tests assert the structural invariants
// any working PIERCING_HEART suffix must satisfy:
//   - Registry shape (slot/effect keyword) so AFFIX_SUFFIXES picks it up.
//   - The on-kill gates (!isProc / effects.includes('pierceheart') /
//     !isShard / !isSummon) so procs and summons don't bypass the cap.
//   - The 20-stack cap arithmetic and the +1 maxHp / +1 heal effects.
//   - Persistence: _piercingHearts saved in saveGame's explicit field
//     enumeration AND restored in continueGame, so save/resume preserves
//     the cap (a missed restore would let the player re-earn +20 from
//     scratch on every continue).
//
// Each check fails loudly the moment a refactor drops a wire — same
// silent-removal failure mode that bit RECOIL/SHOCK_PULSE/HUNTER reviews
// and motivated the brace-walked extractBranch helper.

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
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);

// Strip /* ... */ and // ... comments so source-text regex assertions
// match against EXECUTABLE source, not commentary that incidentally
// quotes the gate token. Pattern from tests/{siphon,greedy,lucky,
// salvage,mark,deadly,staggering}-affix.test.js (per stored memory
// 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);
const GAME_CODE = stripComments(GAME);

// Brace-walked branch extraction: find the opener regex, then walk
// braces to the matching close. Used to scope absence-checks INSIDE a
// specific if-branch so a regression in one branch isn't masked by
// similar text in a neighbouring branch. Pattern from
// tests/{execute,recoil,mark,staggering}-affix.test.js (per stored memory
// 'test source-text extraction').
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

// Brace-walked entry extraction for registry entries (KEY: { ... }).
// The naive /KEY:\s*\{[^}]*\}/ regex over-stops at any inner `{...}`
// close-brace (e.g., a `mods:{}` in a prefix entry), so any field
// inserted AFTER the inner brace would false-pass an absence check.
// Pattern from tests/deadly-affix.test.js (per stored memory
// 'test source-text extraction').
/**
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractEntry(src, openerRe) {
  const m = src.match(openerRe);
  if (!m) return null;
  const openIdx = src.indexOf('{', m.index);
  if (openIdx < 0) return null;
  let depth = 1;
  for (let i = openIdx + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

test('PIERCING_HEART is registered in WEAPON_AFFIXES as a suffix with effect:pierceheart', () => {
  // slot:'suffix' is critical — slot routes the affix through the on-hit
  // / on-kill effect path. A typo to 'prefix' would silently route into
  // the mod-loop in buildWeapon() and never reach the on-kill gate
  // (the player would equip "of Piercing Heart" weapons that do nothing).
  // effect:'pierceheart' is the keyword die() switches on; if it diverges
  // from the gate string the suffix becomes a cosmetic no-op.
  const re = /PIERCING_HEART:\s*\{\s*slot:\s*'suffix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*effect:\s*'pierceheart'\s*\}/;
  assert.match(CONTENT, re,
    "PIERCING_HEART must be a suffix with label/colour/desc and effect:'pierceheart'");
});

test('PIERCING_HEART label is exactly "of Piercing Heart"', () => {
  // Lock the user-facing string so a refactor can't silently rename the
  // affix without test coverage — tooltips, weapon names, and any future
  // datamining queries depend on this exact label.
  const entry = extractEntry(CONTENT, /PIERCING_HEART:/);
  assert.ok(entry, 'PIERCING_HEART entry must be locatable');
  assert.match(entry, /label:\s*'of Piercing Heart'/,
    "PIERCING_HEART must keep the exact label 'of Piercing Heart'");
});

test('PIERCING_HEART entry does NOT carry a mods key (it is an effect-suffix, not a stat-mod)', () => {
  // Stat-mod prefixes (KEEN/VOLATILE/DEADLY) carry mods:{}; effect-
  // suffixes (FLAME/FROST/SIPHON/PIERCING_HEART) carry only effect:.
  // A stray mods:{} on PIERCING_HEART would route through the mod-loop
  // in buildWeapon() in addition to the on-kill block, which is a
  // double-application bug class. Brace-walked extraction is mandatory
  // here per stored memory 'test source-text extraction' — naive regex
  // over-stops at the inner } of any mods:{}.
  const entry = extractEntry(CONTENT, /PIERCING_HEART:/);
  assert.ok(entry, 'PIERCING_HEART entry must be locatable');
  assert.doesNotMatch(entry, /\bmods\s*:/,
    'PIERCING_HEART must NOT carry a mods key (it is an effect-suffix)');
});

test('PIERCING_HEART suffix is registered in WEAPON_AFFIXES (drop pool eligibility)', () => {
  // AFFIX_SUFFIXES is derived from AFFIX_KEYS filtered by slot==='suffix'.
  // Verify PIERCING_HEART appears in the registry between the start of
  // WEAPON_AFFIXES and its closing brace, so the derived AFFIX_SUFFIXES
  // picks it up. Without this, the suffix would be defined but never
  // rolled by the affix-drop system.
  const startIdx = CONTENT.indexOf('const WEAPON_AFFIXES');
  assert.ok(startIdx > 0, 'WEAPON_AFFIXES registry must exist');
  const endIdx = CONTENT.indexOf('};', startIdx);
  assert.ok(endIdx > startIdx, 'WEAPON_AFFIXES registry must terminate');
  const registryBody = CONTENT.slice(startIdx, endIdx);
  assert.ok(/^\s*PIERCING_HEART:/m.test(registryBody),
    'PIERCING_HEART must be a top-level key inside WEAPON_AFFIXES so AFFIX_SUFFIXES includes it');
});

test('Enemy.die() reads _lastHitCtx and gates the bonus on effects.includes("pierceheart")', () => {
  // The bonus must be wired through the existing _lastHitCtx pipe so the
  // ctx propagates from Player.shoot → Projectile → enemy.takeDamage →
  // _lastHitCtx (set unconditionally at takeDamage entry). A literal
  // string match for the gate token would pass on a comment that quotes
  // 'pierceheart' — strip comments first.
  assert.match(ENTITIES_CODE, /effects\.includes\(\s*'pierceheart'\s*\)/,
    "die() must gate on _lastHitCtx.effects.includes('pierceheart')");
});

test('PIERCING_HEART on-kill gates on !isProc (proc finishers do not credit the buff)', () => {
  // If a non-PIERCING_HEART proc (THUNDER chain, EXPLOSIVE_KILLS, RICOCHET
  // hit) finishes the enemy, _lastHitCtx will be that proc's context —
  // {isProc:true}. Without the !isProc gate, those procs would credit
  // a +1 maxHp the player didn't earn with the suffix. Mirrors
  // applyOnKill at entities.js:1262 and the SALVAGE/GREEDY/LUCKY blocks.
  const idx = ENTITIES_CODE.indexOf("effects.includes('pierceheart')");
  assert.ok(idx > 0, 'pierceheart gate must exist');
  // Search the preceding ~400 chars for !ctx.isProc / !_phctx.isProc style.
  const head = ENTITIES_CODE.slice(Math.max(0, idx - 400), idx);
  assert.match(head, /!\s*[\w.]*isProc/,
    'on-kill PIERCING_HEART block must gate on !isProc to skip proc finishers');
});

test('PIERCING_HEART skips summons and shards (defense in depth — bounds the cap rate)', () => {
  // Without these gates, a phantom-summon farm or a SPLITTER's shard
  // chain would let _piercingHearts cap (+20) within seconds of the
  // first kill. The summons/shards exclusion mirrors the elite/boss
  // core drop, the base Item drop at line 1859, and the
  // SALVAGE/GREEDY/LUCKY on-kill gates. Brace-walked extraction
  // anchored on the controlling if-header keeps the assertion scoped
  // to the PIERCING_HEART branch only.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_phctx\s*&&\s*!_phctx\.isProc\s*&&\s*_phctx\.effects\s*&&\s*_phctx\.effects\.includes\('pierceheart'\)[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'PIERCING_HEART if-branch must be locatable by its controlling if-header');
  assert.match(branch, /!\s*this\.isShard/,
    'PIERCING_HEART block must skip this.isShard');
  assert.match(branch, /!\s*isSummon/,
    'PIERCING_HEART block must skip isSummon');
});

test('PIERCING_HEART caps at 20 stacks per run (hard ceiling on +Max HP)', () => {
  // The cap is the entire balance lever — without it, a long bounty-rich
  // floor would scale player HP indefinitely. 20 stacks = +25% effective
  // HP for an 80-HP base, on par with a META_UPGRADE max-hp tier. The
  // arithmetic must compare the current stack count against 20 (not
  // <= 20, not < 21 — both off-by-one risks). Pin the literal so a
  // re-tune is caught in review.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_phctx\s*&&\s*!_phctx\.isProc\s*&&\s*_phctx\.effects\s*&&\s*_phctx\.effects\.includes\('pierceheart'\)[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'PIERCING_HEART branch must be locatable');
  assert.match(branch, /<\s*20\b/,
    'PIERCING_HEART must cap stacks at 20 (look for `< 20` against the current count)');
});

test('PIERCING_HEART increments _piercingHearts and bumps maxHp by 1 (the actual reward)', () => {
  // The two state mutations are the entire point — without them the
  // suffix is a cosmetic no-op. Pin both so a refactor that drops one
  // (e.g. forgets to bump maxHp but still increments the counter, or
  // vice-versa) fails loudly.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_phctx\s*&&\s*!_phctx\.isProc\s*&&\s*_phctx\.effects\s*&&\s*_phctx\.effects\.includes\('pierceheart'\)[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'PIERCING_HEART branch must be locatable');
  assert.match(branch, /_piercingHearts\s*=\s*[\w.]+\s*\+\s*1/,
    'PIERCING_HEART must increment _piercingHearts by 1');
  assert.match(branch, /\.maxHp\s*\+=\s*1\b/,
    'PIERCING_HEART must bump player.maxHp by 1');
});

test('PIERCING_HEART heals +1 immediately so the gain is visible (Math.min clamp keeps hp <= maxHp)', () => {
  // Bumping maxHp without healing leaves the player at the same HP, a
  // non-feedback that obscures the proc and feels worse than VAMPIRIC's
  // flat heal. The Math.min(maxHp, hp+1) clamp is defensive — should
  // never matter since maxHp was just bumped, but it keeps the
  // invariant tight.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_phctx\s*&&\s*!_phctx\.isProc\s*&&\s*_phctx\.effects\s*&&\s*_phctx\.effects\.includes\('pierceheart'\)[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'PIERCING_HEART branch must be locatable');
  assert.match(branch, /Math\.min\(\s*[\w.]+\.maxHp\s*,\s*[\w.]+\.hp\s*\+\s*1\s*\)/,
    'PIERCING_HEART must heal +1 clamped to maxHp via Math.min(maxHp, hp+1)');
});

test('PIERCING_HEART emits pink "+1 HP" damage text and pink particles as feedback', () => {
  // Visual feedback is required for the proc to feel like a proc. The
  // colour matches the suffix label (#ff4488). spawnDmgText surfaces
  // the "+1 HP" string near the player so it's read as a heal/buff,
  // not a damage number.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_phctx\s*&&\s*!_phctx\.isProc\s*&&\s*_phctx\.effects\s*&&\s*_phctx\.effects\.includes\('pierceheart'\)[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'PIERCING_HEART branch must be locatable');
  assert.match(branch, /spawnDmgText\([^)]*'\+1 HP'/,
    'PIERCING_HEART must spawn a "+1 HP" dmg text on trigger');
  assert.match(branch, /spawnParticles\([^)]*'#ff4488'/,
    'PIERCING_HEART must emit #ff4488 particles as a tell');
});

test('PIERCING_HEART block runs AFTER the elite/boss core drop (so it stacks, not replaces)', () => {
  // The buff must be additive on top of the existing drop logic. If the
  // block ran before the elite/boss core drop, an elite-killing
  // PIERCING_HEART shot might double-process or interleave HUD pulses.
  // Anchor on positions: the elite/boss core drop must precede the
  // pierceheart gate. Same defensive ordering as LUCKY at line 2248.
  const eliteDropIdx = ENTITIES_CODE.indexOf('NEON.cores.spawnCoreDrop(game, this.x, this.y, coreVal)');
  const phGateIdx = ENTITIES_CODE.indexOf("effects.includes('pierceheart')");
  assert.ok(eliteDropIdx > 0, 'elite/boss core drop line must exist');
  assert.ok(phGateIdx > eliteDropIdx,
    'PIERCING_HEART block must come AFTER the elite/boss core drop so it stacks');
});

test('saveGame() persists _piercingHearts in the explicit field enumeration', () => {
  // Per stored memory 'on-hit weapon affixes': saveGame uses an
  // explicit field enumeration (NOT Object.keys) so any new player
  // field that needs to survive save/resume MUST be added here. Without
  // this line, a quit-and-resume mid-run would lose the counter (maxHp
  // would persist but the cap counter would reset to 0), letting the
  // player re-earn the +20 from scratch — uncapping the design ceiling
  // through the save/load loop.
  assert.match(GAME_CODE, /_piercingHearts\s*:\s*[\w.]+\._piercingHearts\s*\|\|\s*0/,
    "saveGame must persist _piercingHearts via the `field: p._piercingHearts || 0` pattern");
});

test('continueGame() restores _piercingHearts from save (defaults to 0 for older saves)', () => {
  // Mirror to saveGame: continueGame must read the field back. The
  // `||0` defaults older saves (which predate the field) to 0 — they
  // start the resumed run with no stacks accumulated, which is the
  // correct behaviour (we have no way to infer stack count from
  // persisted maxHp alone since maxHp also reflects level-ups, perks,
  // and meta upgrades).
  assert.match(GAME_CODE, /[\w.]+\._piercingHearts\s*=\s*[\w.]+\._piercingHearts\s*\|\|\s*0/,
    'continueGame must restore _piercingHearts via the `p.X = s.X || 0` pattern');
});
