'use strict';
// REVERSE_POLARITY hackware — source-text wiring tests.
//
// REVERSE_POLARITY fills the "AoE active projectile defense" archetype
// that was missing from the hackware roster. PHASE_CLOAK gives passive
// invulnerability for 2.5s; PARRY perk reflects per-touch but only
// during dash. REVERSE_POLARITY bursts every enemy projectile within
// 6 tiles back at its source on a single press, no skill timing
// required, on a 14s cooldown.
//
// Reuses the PARRY perk reflect block (src/content.js ~3690) almost
// verbatim — see the stored memory `player projectile parry`: any
// fromPlayer flip MUST clear ALL per-team state (_owner, ownerType,
// hitEnemies, _effects, _affixes, isCrit, bouncesLeft, _hasRicochet,
// homing, maxPierces, piercing, travelled). Otherwise SIPHON owner-
// back-references heal dead enemies, SNIPER shock retags fire on
// player-owned shots, weapon affix DoTs leak across teams, etc.
//
// content.js / entities.js are browser-only (UMD globals), so we
// assert structural invariants by source-text inspection — same
// pattern as tests/blink-hackware.test.js, repair-protocol-hackware,
// last-stand, overdrive-perk, mark-affix, etc.
//
// Per the new "test regex pitfalls" rule (PR #171): for assertions on
// EXECUTABLE GATES (e.g. `if (!p.fromPlayer)`), we anchor on the
// statement line and strip line/block comments from the surrounding
// span BEFORE matching, so a future refactor that drops the gate but
// keeps the explanatory comment cannot pass these tests.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// Strip // line comments and /* ... */ block comments. Used to defend
// regex-on-source assertions from comment-only matches (per the
// `test regex pitfalls` stored rule).
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

// ─── Catalog registration ────────────────────────────────────────────────

test('REVERSE_POLARITY registered in HACKWARE catalog with required fields', () => {
  const re = /REVERSE_POLARITY\s*:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'[^']+',\s*cooldown:\s*\d+/;
  assert.match(CONTENT, re,
    'REVERSE_POLARITY must declare name/desc/colour/icon/cooldown like sibling hackware');
});

test('REVERSE_POLARITY cooldown in defensive band [12,18]', () => {
  // Reflecting an entire screen of incoming projectiles is strong but
  // bursty (single press, no duration). Cooldown should sit between
  // STATIC_FIELD (12, sustained) and PHASE_CLOAK (14, immune-burst).
  // 14 is the design target. Loose [12,18] band tolerates retuning.
  const m = CONTENT.match(/REVERSE_POLARITY[^}]*cooldown:\s*(\d+)/);
  assert.ok(m, 'REVERSE_POLARITY cooldown must be an integer literal');
  const cd = parseInt(m[1], 10);
  assert.ok(cd >= 12 && cd <= 18,
    `REVERSE_POLARITY cooldown ${cd}s must sit in [12,18] — too low and it trivialises ranged threats, too high and it loses identity vs PHASE_CLOAK`);
});

test('REVERSE_POLARITY catalog entry appears exactly once', () => {
  const occ = CONTENT.match(/REVERSE_POLARITY\s*:/g);
  assert.equal(occ && occ.length, 1,
    'REVERSE_POLARITY catalog entry must appear exactly once in content.js');
});

// ─── Activation case extraction ──────────────────────────────────────────

function reverseCaseBody() {
  // Slice from the case label to the next case label OR the closing
  // brace of the switch. Mirrors the helper in repair-protocol-hackware
  // and blink-hackware tests.
  const start = CONTENT.indexOf("case 'REVERSE_POLARITY':");
  assert.ok(start >= 0, 'activateHackware switch must contain a REVERSE_POLARITY case');
  const after = CONTENT.indexOf("case '", start + 5);
  const closeBrace = CONTENT.indexOf('\n  }\n}', start);
  const end = (after >= 0 && after < closeBrace) ? after : closeBrace;
  return CONTENT.slice(start, end);
}

test('REVERSE_POLARITY activation case exists', () => {
  const body = reverseCaseBody();
  assert.ok(body.includes("case 'REVERSE_POLARITY':"), 'case label present');
  assert.ok(body.length > 200, 'case body should have substance, not be a stub');
});

test('REVERSE_POLARITY iterates the global projectiles array', () => {
  const body = stripComments(reverseCaseBody());
  assert.match(body, /for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+projectiles\s*\)/,
    'REVERSE_POLARITY must iterate the global projectiles[] array (single source of truth for in-flight shots)');
});

// ─── Critical gates: comment-stripped assertions per `test regex pitfalls` rule ─

test('REVERSE_POLARITY skips player-owned projectiles (fromPlayer gate)', () => {
  // Comment-stripped: a future refactor that drops `if (p.fromPlayer) continue;`
  // but leaves an explanatory comment cannot accidentally pass this test.
  // Without this gate, the hackware would flip the player's own shots into
  // enemy ones — guaranteed self-grief.
  const body = stripComments(reverseCaseBody());
  assert.match(body, /if\s*\(\s*\w+\.fromPlayer\s*\)\s*continue\s*;?/,
    'REVERSE_POLARITY must skip projectiles where fromPlayer is truthy (do not flip own shots)');
});

test('REVERSE_POLARITY skips dead projectiles', () => {
  // Reflecting a dead/pooled projectile would resurrect it as a player
  // shot via the fromPlayer flip — UB on next pool reuse. Comment-stripped.
  const body = stripComments(reverseCaseBody());
  assert.match(body, /if\s*\(\s*!\w+\s*\|\|\s*\w+\.dead\s*\)\s*continue\s*;?/,
    'REVERSE_POLARITY must skip null/dead projectiles before the flip');
});

test('REVERSE_POLARITY enforces a finite range gate', () => {
  // Without a range gate, this becomes "reflect every enemy shot in the
  // dungeon" — trivialises ranged enemies on every floor. Range design
  // target is 6 tiles. We assert via dx*dx+dy*dy comparison so the test
  // is robust to either dist() or sqrt-free implementations. Comment-
  // stripped to defend against the gate being deleted with the comment
  // remaining.
  const body = stripComments(reverseCaseBody());
  // Look for either dx*dx+dy*dy > RANGE_SQ continue, OR dist > RANGE
  const sqGate = /dx\s*\*\s*dx\s*\+\s*dy\s*\*\s*dy\s*>\s*\w*RANGE\w*\s*\)\s*continue/;
  const distGate = /dist\([^)]+\)\s*>\s*\w*RANGE\w*/;
  assert.ok(sqGate.test(body) || distGate.test(body),
    'REVERSE_POLARITY must gate the flip on a finite range check (dx²+dy² > RANGE² or dist() > RANGE)');
  // And the range constant must be exactly 6 tiles per design.
  const rangeM = body.match(/RANGE\s*=\s*(\d+(?:\.\d+)?)/);
  assert.ok(rangeM, 'RANGE constant must be defined inline in the case body');
  assert.equal(parseFloat(rangeM[1]), 6, 'REVERSE_POLARITY range design target is 6 tiles');
});

// ─── Parry-pattern state cleanup (per `player projectile parry` stored rule) ─

test('REVERSE_POLARITY flips velocity components', () => {
  const body = stripComments(reverseCaseBody());
  assert.match(body, /\w+\.dx\s*=\s*-\s*\w+\.dx/, 'must flip p.dx');
  assert.match(body, /\w+\.dy\s*=\s*-\s*\w+\.dy/, 'must flip p.dy');
});

test('REVERSE_POLARITY converts projectile to player-owned', () => {
  const body = stripComments(reverseCaseBody());
  assert.match(body, /\w+\.fromPlayer\s*=\s*true/,
    'must set fromPlayer = true (mirror PARRY perk @ src/content.js ~3693)');
});

test('REVERSE_POLARITY clears ALL per-team state per parry rule', () => {
  // Per the stored "player projectile parry" memory: every fromPlayer
  // flip site MUST clear ALL of these fields, otherwise SIPHON heals
  // dead owners, SNIPER shock retags, weapon affix DoTs leak teams,
  // ricochet keeps wall counts, and hitEnemies starts pre-populated.
  // Comment-stripped to defend against a future refactor dropping any
  // of these clears but leaving an explanatory comment.
  const body = stripComments(reverseCaseBody());
  const required = [
    [/\w+\._owner\s*=\s*null/,                       '_owner = null'],
    [/\w+\.ownerType\s*=\s*'[^']+'/,                  "ownerType = '<label>'"],
    [/\w+\.hitEnemies\s*=\s*new\s+Set\(\s*\)/,        'hitEnemies = new Set()'],
    [/\w+\.maxPierces\s*=\s*0/,                       'maxPierces = 0'],
    [/\w+\.piercing\s*=\s*false/,                     'piercing = false'],
    [/\w+\.homing\s*=\s*null/,                        'homing = null'],
    [/\w+\.bouncesLeft\s*=\s*0/,                      'bouncesLeft = 0'],
    [/\w+\._hasRicochet\s*=\s*false/,                 '_hasRicochet = false'],
    [/\w+\.travelled\s*=\s*0/,                        'travelled = 0'],
    [/\w+\._effects\s*=[^;]*\[\s*\]/,                 '_effects = []'],
    [/\w+\._affixes\s*=[^;]*\[\s*\]/,                 '_affixes = []'],
    [/\w+\.isCrit\s*=\s*false/,                       'isCrit = false'],
    [/\w+\.weaponName\s*=\s*'[^']+'/,                 "weaponName = '<label>'"],
  ];
  for (const [re, name] of required) {
    assert.match(body, re,
      `REVERSE_POLARITY must clear ${name} on flip — per stored 'player projectile parry' rule`);
  }
});

test('REVERSE_POLARITY recolours reflected shots so the player can SEE them', () => {
  // Without recolour, reflected shots stay enemy-coloured and a panicked
  // player will dodge their own deflection. PARRY perk uses #aaffee.
  const body = stripComments(reverseCaseBody());
  assert.match(body, /\w+\.colour\s*=\s*'#[0-9a-fA-F]+'/,
    'reflected projectile must get a player-side colour (mirror PARRY @ src/content.js ~3707)');
});

// ─── Feedback ────────────────────────────────────────────────────────────

test('REVERSE_POLARITY plays reflect audio + msg fanfare', () => {
  const body = reverseCaseBody();
  assert.match(body, /audio\.reflect\s*\(\s*\)/,
    'REVERSE_POLARITY must play audio.reflect() — reuses the PARRY/REFLECTOR shim');
  assert.match(body, /_CG\.msg\(\s*'⇄/,
    'REVERSE_POLARITY must surface a HUD message with the ⇄ icon (matches catalog icon)');
});

// ─── Player-projectile guard regression check ────────────────────────────

test('REVERSE_POLARITY does NOT bypass dead/owned guards (negative regression)', () => {
  // Defensive: this fails if someone "simplifies" by removing both gates.
  // Both must remain — per design and per the parry-rule stored memory.
  const body = stripComments(reverseCaseBody());
  assert.ok(/fromPlayer\s*\)\s*continue/.test(body),
    'fromPlayer-skip continue still present');
  assert.ok(/\.dead\s*\)\s*continue/.test(body),
    'dead-skip continue still present');
});

test('REVERSE_POLARITY skips ally-turret shots (friendly-fire regression)', () => {
  // Ally turrets (Decoy Turret hackware, hacked wall turrets) spawn with
  // fromPlayer=false but isAllyTurret=true. Reflecting them would spin
  // friendly fire 180° back toward the player. Caught by gpt-5.3-codex
  // review during PR. Comment-stripped per the `test regex pitfalls` rule.
  const body = stripComments(reverseCaseBody());
  assert.match(body, /if\s*\(\s*\w+\.isAllyTurret\s*\)\s*continue\s*;?/,
    'REVERSE_POLARITY must skip ally-turret projectiles before the flip');
  // And on the flip path, defensively normalise isAllyTurret = false so
  // any future code paths that branch on it don't see a hybrid shot.
  assert.match(body, /\w+\.isAllyTurret\s*=\s*false/,
    'reflected projectile must clear isAllyTurret on convert');
});

// ─── Service worker cache bump ───────────────────────────────────────────

test('SW cache version bumped (REVERSE_POLARITY ships fresh code)', () => {
  // Per project convention: any change to a file listed in ASSETS
  // requires a CACHE bump. Without it, existing PWA users keep the
  // stale entities.js / content.js and never see the new hackware.
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, 'SW must declare a versioned cache key');
  const v = parseInt(m[1], 10);
  assert.ok(v >= 214, `SW cache version must be >= 214 (was v213 before this change), got v${v}`);
});
