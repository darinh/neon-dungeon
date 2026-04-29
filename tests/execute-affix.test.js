'use strict';
// EXECUTE 'of Execution' weapon-affix suffix — source-text wiring tests.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports), so
// we can't load applyHitEffects directly under node:test. Instead, these
// tests assert the structural invariants any working EXECUTE suffix must
// satisfy: registry shape, the on-hit branch wiring, the four required
// safety gates (isBoss / _disguised / _wrPhased / dead-or-zero-hp), the
// 20% threshold itself, and the sw.js cache bump.
//
// Each check fails loudly the moment a refactor drops a wire — the same
// silent-removal failure mode that bit RECOIL/SHOCK_PULSE/HUNTER reviews.

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
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// Strip JS comments before regex assertions so a `// if (enemy.isBoss) continue;`
// commented-out guard can't satisfy a gate-presence check (mark-affix /
// reverse-polarity / bulwark / hot-hand / glass-cannon precedent).
/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Brace-balanced extraction of a block opened by `openerRe`. Returns the
// substring from the opener through its matching `}`. Critical for the
// execute branch tests: the previous regex-only extraction over-captured
// into the MARK branch that follows (and the trailing `// 'explode'`
// boundary comment), so a refactor that removed a gate from execute but
// kept it in mark would silently pass. The brace walker isolates only
// the execute branch.
//
// LIMITATION: this is a naive depth counter — it does NOT understand string
// literals, template literals, or regex literals. A future addition like
// `spawnDmgText(x, y, '{KO}', '#fff')` inside the execute branch would drift
// the brace count and `extractBranch` would return null. That failure is
// caught loudly by the `assert.ok(executeBranch, ...)` guard at every call
// site — it fails fast with a clear message rather than silently passing.
// If the source ever needs braces inside string literals here, upgrade this
// helper to a real lexer.
/**
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBranch(src, openerRe) {
  const i = src.search(openerRe);
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return null;
}

test('EXECUTE is registered in WEAPON_AFFIXES as a suffix with effect:execute', () => {
  // slot:'suffix' is critical — slot routes the affix through the on-hit
  // effect path. A typo to 'prefix' would silently route into the
  // mod-loop in buildWeapon() and never reach applyHitEffects.
  // effect:'execute' is the keyword applyHitEffects switches on; if it
  // diverges from the branch label the suffix becomes a cosmetic no-op.
  const re = /EXECUTE:\s*\{\s*slot:\s*'suffix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*effect:\s*'execute'\s*\}/;
  assert.match(stripComments(CONTENT), re,
    "EXECUTE must be a suffix with label/colour/desc and effect:'execute' in EXECUTABLE code");
});

test("applyHitEffects handles eff === 'execute'", () => {
  // Without a branch in the per-effect for-loop the registry entry is
  // dead data — same failure shape as a missing case in a switch.
  // Strip comments first so a `// else if (eff === 'execute') {` line
  // commented out can't satisfy the gate.
  const re = /else\s+if\s*\(\s*eff\s*===\s*'execute'\s*\)\s*\{/;
  assert.match(stripComments(ENTITIES), re,
    "applyHitEffects must contain an `else if (eff === 'execute')` branch in EXECUTABLE code");
});

test('execute branch gates on enemy.isBoss (designed-arena protection)', () => {
  // Per the weapon-affix-knockback-gates / boss-immune rules: bosses
  // must be exempt from instakill mechanics. Without this gate a boss
  // taking a chip-shot below 20% HP would die outright, deleting their
  // designed encounter.
  const executeBranch = extractBranch(ENTITIES, /else\s+if\s*\(\s*eff\s*===\s*'execute'\s*\)\s*\{/);
  assert.ok(executeBranch, 'execute branch must be parseable (brace-balanced extraction)');
  const body = stripComments(executeBranch);
  assert.match(body, /if\s*\(\s*enemy\.isBoss\s*\)\s*continue/,
    'execute branch must skip enemy.isBoss in EXECUTABLE code (not a comment)');
});

test('execute branch gates on _disguised and _wrPhased (defense in depth)', () => {
  // _disguised: per disguised-mimic-AoE rule, no AoE/finisher may leak
  // mimic presence. takeDamage already reveals before applyHitEffects
  // runs, but the gate documents intent and survives call-order changes.
  // _wrPhased: per weapon-affix-knockback-gates rule, intangible mobs
  // (WRAITH/TUNNELLER) must be re-checked locally even though projectile
  // prefilters drop them upstream.
  const executeBranch = extractBranch(ENTITIES, /else\s+if\s*\(\s*eff\s*===\s*'execute'\s*\)\s*\{/);
  assert.ok(executeBranch, 'execute branch must be parseable (brace-balanced extraction)');
  const body = stripComments(executeBranch);
  assert.match(body, /if\s*\(\s*enemy\._disguised\s*\)\s*continue/,
    'execute branch must skip enemy._disguised (mimic protection) in EXECUTABLE code');
  assert.match(body, /if\s*\(\s*enemy\._wrPhased\s*\)\s*continue/,
    'execute branch must skip enemy._wrPhased (intangible protection) in EXECUTABLE code');
});

test('execute branch threshold is exactly 20% HP (post-hit)', () => {
  // The number itself is the design — looser (e.g. 50%) trivializes
  // mid-game enemies into one-shots, tighter (e.g. 5%) makes the suffix
  // never proc. Pin it so an unintentional re-tune is caught in review.
  // Also pin the >0 maxHp guard so corrupted state doesn't divide-by-zero.
  const executeBranch = extractBranch(ENTITIES, /else\s+if\s*\(\s*eff\s*===\s*'execute'\s*\)\s*\{/);
  assert.ok(executeBranch, 'execute branch must be parseable (brace-balanced extraction)');
  const body = stripComments(executeBranch);
  assert.match(body, /if\s*\(\s*!\(\s*enemy\.maxHp\s*>\s*0\s*\)\s*\)\s*continue/,
    'execute branch must guard maxHp>0 against div-by-zero in EXECUTABLE code');
  assert.match(body, /if\s*\(\s*\(\s*enemy\.hp\s*\/\s*enemy\.maxHp\s*\)\s*>\s*0\.20\s*\)\s*continue/,
    'execute branch must use 20% post-hit HP threshold in EXECUTABLE code');
});

test('execute branch sets hp=0 and calls die() (terminal kill, not damage)', () => {
  // The semantic is "finisher" not "burst damage" — must end with
  // enemy.hp = 0 followed by enemy.die(). die() is idempotent (entities
  // .js dead-flag guard) so the outer takeDamage's redundant
  // `if (this.hp<=0) this.die()` is a safe no-op.
  const executeBranch = extractBranch(ENTITIES, /else\s+if\s*\(\s*eff\s*===\s*'execute'\s*\)\s*\{/);
  assert.ok(executeBranch, 'execute branch must be parseable (brace-balanced extraction)');
  const body = stripComments(executeBranch);
  assert.match(body, /enemy\.hp\s*=\s*0/, 'execute must set enemy.hp = 0 in EXECUTABLE code');
  assert.match(body, /enemy\.die\(\)/, 'execute must call enemy.die() in EXECUTABLE code');
});

test('sw.js cache version bumped to v208 or later (EXECUTE adds new code)', () => {
  // Per repo convention (per sw-cache-test-convention rule): assert >=
  // ship floor, not exact match — every PR after this one will only
  // bump higher. Without bumping the cache, returning users get stale
  // content.js / entities.js that don't know about the affix.
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, "sw.js must declare a 'neon-dungeon-v###' cache key");
  const ver = parseInt(m[1], 10);
  assert.ok(ver >= 208, `sw cache must be >= v208, got v${ver}`);
});
