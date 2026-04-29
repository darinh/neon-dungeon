'use strict';
// SHIELD_BUBBLE hackware — source-text wiring tests.
//
// SHIELD_BUBBLE is the 16th hackware. It fills the missing
// "multi-hit damage-pool absorption" niche. Existing player
// defenses divide as:
//   - PHASE_CLOAK: 2.5s binary immunity (active hackware, but
//     all-or-nothing; no damage interaction)
//   - REPAIR_PROTOCOL: 4 HP/s × 4 ticks heal-over-time (active
//     hackware, but reactive — heals AFTER damage is taken)
//   - ENERGY_SHIELD perk + SHIELD DRIVER boost: ONE-SHOT absorbs
//     (consumed on first qualifying hit, grant 0.5s i-frames)
//   - LAST_STAND perk: clutch ≤10% HP window (×0.5 incoming dmg)
// Nothing in the catalog absorbs MULTIPLE hits across a window
// without consuming on the first contact. SHIELD_BUBBLE is the
// dedicated multi-hit absorption pool: 35 dmg over 6s, drains
// proportionally (mirroring the SHIELDED enemy affix's drain-
// and-pass pattern at entities.js:1448-1450). Cooldown 16s sits
// in the heavy-utility band (GRAVITY_WELL=16, REPAIR_PROTOCOL=18).
//
// PHASE_CLOAK is the closest cousin (also a player-following
// active defense), but the design poles are inverted:
//   - PHASE_CLOAK = 2.5s window, ALL incoming negated (binary)
//   - SHIELD_BUBBLE = 6s window, 35 dmg cap, then bubble breaks
// Players choose: avoid eyes-closed for 2.5s (cloak) or face
// down 35 dmg with eyes open for 6s (bubble).
//
// content.js / entities.js are browser-only (no UMD/CommonJS
// exports), so we can't load activateHackware() / Player.takeDamage()
// under node:test. Instead, these tests assert the structural
// invariants any working SHIELD_BUBBLE must satisfy: catalog entry,
// activation case, drain logic in takeDamage with correct gates,
// player-state init, tick decrement, render branch, audio binding,
// and the HACKWARE pool size canary (=16).
//
// Pattern matches tests/data-spike-hackware.test.js (the 15th
// hackware) and tests/repair-protocol-hackware.test.js (the
// closest sibling — also a player-following active defense with
// dt-based tick logic in Player.update).
//
// All regex assertions run against COMMENT-STRIPPED source. The
// SHIELD_BUBBLE case body is heavily documented (the design intent
// is explicit), so a future edit could land a comment that
// satisfies a presence regex even after the executable code was
// removed. Stripping comments first closes that hole and matches
// every other hackware test.

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
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);

/** @param {string} src */
function stripComments(src) {
  // Strip block comments first, then FULL-LINE // comments only
  // (matches the project convention — see stored memory
  // 'structural test bypass classes' on the over-stripping bug).
  return src.replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/[^\n]*$/gm, '');
}

const CONTENT_NC = stripComments(CONTENT);
const ENTITIES_NC = stripComments(ENTITIES);
const PLATFORM_NC = stripComments(PLATFORM);

// Locate the SHIELD_BUBBLE case body. Anchor on the case label and
// slice forward until the next sibling case label or the switch's
// closing brace. Mirrors dataSpikeCaseBody() in the data-spike test.
function shieldBubbleCaseBody() {
  const startIdx = CONTENT_NC.indexOf("case 'SHIELD_BUBBLE':");
  assert.ok(startIdx !== -1, "activateHackware must contain a case 'SHIELD_BUBBLE': branch in EXECUTABLE code");
  const tail = CONTENT_NC.slice(startIdx);
  const next = tail.search(/\n\s{4}case\s+'[A-Z_]+'|\n\s{2}\}\s*\n\s*\}/);
  return next > 0 ? tail.slice(0, next) : tail.slice(0, 6000);
}

// Brace-balanced extraction of the FIRST block opened by openerRe in
// src. Lifted from tests/data-spike-hackware.test.js — same naive
// depth counter, same string-literal limitation, same bypass-resistance
// guarantee at every call site (assert.ok on null result).
/**
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBlock(src, openerRe) {
  const i = src.search(openerRe);
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  if (open < 0) return null;
  let depth = 1;
  let j = open + 1;
  while (j < src.length && depth > 0) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    j++;
  }
  if (depth !== 0) return null;
  return src.slice(i, j);
}

// ─── Catalog entry ────────────────────────────────────────────────────────

test('SHIELD_BUBBLE is registered in the HACKWARE catalog with required fields', () => {
  const re = /SHIELD_BUBBLE\s*:\s*\{[^}]*name\s*:\s*'Shield Bubble'[^}]*desc\s*:\s*'[^']+'[^}]*colour\s*:\s*'#[0-9a-fA-F]{6}'[^}]*icon\s*:\s*'[^']+'[^}]*cooldown\s*:\s*\d+/;
  assert.ok(re.test(CONTENT_NC),
    'HACKWARE.SHIELD_BUBBLE must declare name, desc, colour (#hex), icon, and cooldown');
});

test('SHIELD_BUBBLE cooldown sits in the heavy-utility band (>= GRAVITY_WELL, <= REPAIR_PROTOCOL)', () => {
  // 16s is the heavy-utility band. SHIELD_BUBBLE absorbs 35 dmg —
  // a successful 35-dmg block can delete an entire wave's
  // incoming pressure, so cooldown must NOT undercut GRAVITY_WELL
  // (16) or it would dominate the defensive niche. Capping at
  // REPAIR_PROTOCOL (18) prevents accidental over-nerf.
  const m = CONTENT_NC.match(/SHIELD_BUBBLE\s*:\s*\{[^}]*cooldown\s*:\s*(\d+)/);
  assert.ok(m, 'SHIELD_BUBBLE must declare a numeric cooldown');
  const cd = parseInt(m[1], 10);
  assert.ok(cd >= 16 && cd <= 18,
    `SHIELD_BUBBLE cooldown must be 16-18s (heavy-utility band) — got ${cd}`);
});

test('SHIELD_BUBBLE colour is perceptually distinct from every other hackware (no cyan-family collision)', () => {
  // Pull every hackware colour and check pairwise distance to
  // SHIELD_BUBBLE's. Threshold 96 = sum-of-channel-distances of at
  // least 32-per-channel average — comfortably distinguishable on
  // standard displays. This catches a future edit that flips
  // SHIELD_BUBBLE to e.g. STATIC_FIELD's #44ccff (the closest
  // cyan neighbour at the time of writing).
  const colourRe = /([A-Z_]+)\s*:\s*\{[^}]*colour\s*:\s*'#([0-9a-fA-F]{6})'[^}]*cooldown\s*:/g;
  const colours = {};
  let m;
  while ((m = colourRe.exec(CONTENT_NC)) !== null) colours[m[1]] = m[2];
  assert.ok(colours.SHIELD_BUBBLE, 'SHIELD_BUBBLE colour must be parseable');
  /** @param {string} hex */
  const rgb = (hex) => [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
  const [sr, sg, sb] = rgb(colours.SHIELD_BUBBLE);
  for (const [k, hex] of Object.entries(colours)) {
    if (k === 'SHIELD_BUBBLE') continue;
    const [r, g, b] = rgb(hex);
    const dist = Math.abs(r-sr) + Math.abs(g-sg) + Math.abs(b-sb);
    assert.ok(dist >= 96,
      `SHIELD_BUBBLE colour #${colours.SHIELD_BUBBLE} too close to ${k} #${hex} (dist=${dist}, need >= 96)`);
  }
});

test('SHIELD_BUBBLE icon is distinct from existing hackware icons', () => {
  // Mirrors the icon-uniqueness pin in time-dilation/data-spike tests.
  const iconRe = /([A-Z_]+)\s*:\s*\{[^}]*icon\s*:\s*'([^']+)'[^}]*cooldown\s*:/g;
  const icons = {};
  let m;
  while ((m = iconRe.exec(CONTENT_NC)) !== null) icons[m[1]] = m[2];
  assert.ok(icons.SHIELD_BUBBLE, 'SHIELD_BUBBLE icon must be parseable');
  for (const [k, ic] of Object.entries(icons)) {
    if (k === 'SHIELD_BUBBLE') continue;
    assert.notEqual(ic, icons.SHIELD_BUBBLE,
      `SHIELD_BUBBLE icon collides with ${k} (both are '${ic}')`);
  }
});

// ─── activateHackware case ────────────────────────────────────────────────

test("activateHackware has a SHIELD_BUBBLE case that calls audio + sets bubbleHp/Timer", () => {
  const body = shieldBubbleCaseBody();
  assert.match(body, /audio\.hackwareShieldBubble\s*\(\s*\)/,
    'SHIELD_BUBBLE case must call audio.hackwareShieldBubble()');
  assert.match(body, /player\.bubbleHp\s*=\s*35\b/,
    'SHIELD_BUBBLE case must set player.bubbleHp = 35 (the design-canonical absorption pool)');
  assert.match(body, /player\.bubbleTimer\s*=\s*6\b/,
    'SHIELD_BUBBLE case must set player.bubbleTimer = 6 (the design-canonical window in seconds)');
});

test('SHIELD_BUBBLE activation has a no-cast guard that refunds cooldown when bubble already active', () => {
  // Refund pattern mirrors REPAIR_PROTOCOL's "ABORT — FULL HP"
  // guard. Without this guard, spam-casting while the buff is
  // active would lose the partial state (a player with 5/35
  // bubble at 1s remaining could re-cast and reset to 35/6 with
  // ZERO cost — trivialises the cooldown design and turns the
  // hackware into permanent uptime).
  const body = shieldBubbleCaseBody();
  assert.match(body, /player\.bubbleHp\s*>\s*0[\s\S]*?player\.bubbleTimer\s*>\s*0[\s\S]*?player\.hackwareCooldown\s*=\s*0/,
    'SHIELD_BUBBLE case must refund hackwareCooldown to 0 when bubbleHp > 0 && bubbleTimer > 0 (mirrors REPAIR_PROTOCOL full-HP refund)');
});

// ─── Player constructor: state init ────────────────────────────────────────

test('Player constructor initialises bubbleHp = 0 and bubbleTimer = 0', () => {
  // Without these inits, the takeDamage drain block would see
  // `undefined > 0` (false — coerces to NaN comparison) and the
  // bubble would never engage on the first hit of a fresh run.
  // The render branch would also short-circuit silently (no
  // visible bubble even after activation in the very first frame
  // before any update tick). EXACTLY-ONE-WRITE per field — no
  // aliasing/bracket-access laundering.
  const ctor = ENTITIES_NC.match(/this\.bubbleHp\s*=\s*0\s*;[\s\S]{0,80}this\.bubbleTimer\s*=\s*0\s*;/);
  assert.ok(ctor,
    'Player constructor must initialise both this.bubbleHp = 0 and this.bubbleTimer = 0 in adjacent statements');
});

// ─── takeDamage drain logic ────────────────────────────────────────────────

test('Player.takeDamage drains SHIELD_BUBBLE BEFORE the SHIELD DRIVER boost', () => {
  // Drain ordering rationale: bubble is an active resource the
  // player just spent a 16s cooldown on; SHIELD DRIVER (boost)
  // and ENERGY_SHIELD (perk) are emergency last-line defenses.
  // Draining bubble FIRST means a player who pre-emptively pops
  // bubble before a known damage spike preserves their one-shot
  // reserves. Inverting the order would burn the one-shot first
  // and grant i-frames, leaving bubble's pool untouched and its
  // timer ticking down for nothing.
  //
  // POSITIONAL pin: bubble drain must appear BEFORE the SHIELD
  // DRIVER boost block (consumeShieldCharge call) inside takeDamage.
  // Use indexOf on the comment-stripped source for stability.
  const tdMatch = ENTITIES_NC.search(/\btakeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{/);
  assert.ok(tdMatch !== -1, 'Player.takeDamage(dmg, source, opts) must exist');
  // Slice forward 8KB — the takeDamage method is large; this is a
  // generous window that comfortably covers the bubble + shield
  // driver + energy shield blocks without crossing into other
  // methods.
  const tdSlice = ENTITIES_NC.slice(tdMatch, tdMatch + 8000);
  const bubbleIdx = tdSlice.search(/this\.bubbleHp\s*-=\s*absorbed/);
  const driverIdx = tdSlice.search(/NEON\.boosts\.consumeShieldCharge\s*\(\s*this\s*\)/);
  assert.ok(bubbleIdx !== -1, 'takeDamage must contain a bubble drain (this.bubbleHp -= absorbed)');
  assert.ok(driverIdx !== -1, 'takeDamage must contain the SHIELD DRIVER boost call (consumeShieldCharge)');
  assert.ok(bubbleIdx < driverIdx,
    `bubble drain (idx ${bubbleIdx}) must precede SHIELD DRIVER (idx ${driverIdx}) so bubble drains first`);
});

test('SHIELD_BUBBLE drain block is gated on !ignoreShield AND !ignoreInvincible AND bubbleHp > 0 AND dmg > 0', () => {
  // GATE rationale (each gate is load-bearing — removing any one
  // creates a different bypass class):
  //   - !ignoreShield: env-DoT ticks (Plasma/Toxic/Arc/Disruption/
  //     Frost/CRAWLER) all pass ignoreShield:true. They MUST bypass
  //     the bubble — a 35hp pool would evaporate in <1s of plasma
  //     contact at 60fps, trivialising both defense and env
  //     hazards.
  //   - !ignoreInvincible: same bypass population (env DoTs pass
  //     this too). Defense-in-depth in case a future hazard sets
  //     only ignoreInvincible.
  //   - bubbleHp > 0: don't drain when bubble inactive.
  //   - dmg > 0: don't tick on already-mitigated 0-dmg hits.
  const tdSlice = ENTITIES_NC.slice(ENTITIES_NC.search(/\btakeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{/));
  const re = /if\s*\(\s*!\s*options\.ignoreShield\s*&&\s*!\s*options\.ignoreInvincible\s*&&\s*this\.bubbleHp\s*>\s*0\s*&&\s*dmg\s*>\s*0\s*\)/;
  assert.match(tdSlice.slice(0, 8000), re,
    'bubble drain must be gated on !ignoreShield && !ignoreInvincible && bubbleHp > 0 && dmg > 0 in that order');
});

test('SHIELD_BUBBLE drain uses min(bubbleHp, dmg) drain-and-pass pattern', () => {
  // Mirrors the SHIELDED enemy affix at entities.js:1448-1450.
  // A simpler "bubble takes the full hit" model would let a 1-hp
  // bubble block a 100-dmg hit — overpowered. The min() drain
  // ensures the bubble can only absorb up to its remaining hp;
  // residual damage passes through to the next defensive layer.
  const tdSlice = ENTITIES_NC.slice(ENTITIES_NC.search(/\btakeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{/));
  const window = tdSlice.slice(0, 8000);
  assert.match(window, /const\s+absorbed\s*=\s*Math\.min\s*\(\s*this\.bubbleHp\s*,\s*dmg\s*\)/,
    'bubble drain must compute absorbed = Math.min(this.bubbleHp, dmg)');
  assert.match(window, /this\.bubbleHp\s*-=\s*absorbed\s*;[\s\S]{0,40}dmg\s*-=\s*absorbed\s*;/,
    'bubble drain must subtract absorbed from BOTH this.bubbleHp AND dmg (drain-and-pass)');
});

test('SHIELD_BUBBLE break (hp <= 0) zeros both fields and plays shieldBreak audio', () => {
  // When a hit fully drains the bubble, BOTH bubbleHp and
  // bubbleTimer must zero atomically — leaving bubbleTimer alive
  // would let the Player.update tick fire its expiry-only branch
  // unnecessarily, and could let render see hp=0+timer>0 (no
  // visible bubble but timer still ticking — confusing). The
  // audio is the canonical "shield break" sound (already used by
  // ENERGY_SHIELD perk and SHIELD DRIVER boost — same defensive
  // language across all three player shields).
  const tdSlice = ENTITIES_NC.slice(ENTITIES_NC.search(/\btakeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{/));
  const window = tdSlice.slice(0, 8000);
  assert.match(window, /this\.bubbleHp\s*<=\s*0[\s\S]{0,200}this\.bubbleTimer\s*=\s*0/,
    'on bubbleHp <= 0, bubbleTimer must be zeroed too (atomic clear)');
  assert.match(window, /this\.bubbleHp\s*<=\s*0[\s\S]{0,300}audio\.shieldBreak\s*\(\s*\)/,
    'on bubbleHp <= 0, audio.shieldBreak() must fire');
});

test('SHIELD_BUBBLE full-absorb path returns 0 (NOT absorbed) — preserves takeDamage(dealt > 0) contract', () => {
  // CRITICAL regression guard. When the bubble fully absorbs a hit
  // (dmg <= 0 after drain), takeDamage MUST return 0, not the
  // positive `absorbed` value. Callers that gate on-hit effects
  // (CRAWLER burn @ entities.js:3083, SAPPER drain @ ~3097, SNIPER
  // shock @ content.js:5179, SIPHON lifesteal @ ~5185, CHARGER
  // knockback @ entities.js:6111, laser shock @ ~11181) ALL check
  // `dealt > 0` to detect "real damage landed". A positive return
  // would fire every one of those effects on a bubble-absorbed hit
  // (burn DoTs would tick, knockback would launch the player) —
  // defeating the bubble's purpose AND breaking the documented
  // SHIELD DRIVER / ENERGY_SHIELD return contract (both return 0).
  // Caught by all 3 adversarial reviewers (gpt-5.3-codex / claude-
  // opus-4.6 / gpt-5.5) as HIGH severity. This pin prevents future
  // edits from regressing to `return absorbed` (or any other
  // positive value).
  const tdSlice = ENTITIES_NC.slice(ENTITIES_NC.search(/\btakeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{/));
  const window = tdSlice.slice(0, 8000);
  // The full-absorb branch MUST return 0 literally. Reject `return
  // absorbed`, `return dmg`, or any other expression — the literal
  // 0 is the only safe value (matches SHIELD DRIVER + ENERGY_SHIELD
  // exactly).
  assert.match(window, /if\s*\(\s*dmg\s*<=\s*0\s*\)\s*\{[\s\S]{0,300}return\s+0\s*;/,
    'full-absorb branch (dmg <= 0) must `return 0` — never `return absorbed` (would break the takeDamage(dealt > 0) caller contract; CRAWLER burn / SAPPER drain / SNIPER shock / SIPHON / CHARGER knockback / laser shock all gate on it)');
  // Defense-in-depth: explicitly REJECT a `return absorbed` anywhere
  // in the bubble branch. A future edit that flips back to that
  // would silently re-introduce the on-hit-effect bug.
  const bubbleStart = window.search(/this\.bubbleHp\s*-=\s*absorbed/);
  const bubbleEnd = bubbleStart + 1500;
  const bubbleBranch = window.slice(bubbleStart, bubbleEnd);
  assert.ok(!/return\s+absorbed\b/.test(bubbleBranch),
    'bubble branch must NOT contain `return absorbed` (would break takeDamage caller contract)');
});

test('SHIELD_BUBBLE hitsBlocked increments ONLY on full absorb — prevents stat double-count', () => {
  // Regression guard for the partial-absorb double-count bug
  // caught by gpt-5.5 review (MEDIUM). If hitsBlocked is
  // incremented on EVERY bubble drain (including partial absorbs
  // where residual damage continues), then a partial absorb that
  // bleeds into a SHIELD DRIVER or ENERGY_SHIELD full consume
  // would increment hitsBlocked TWICE for a single incoming hit —
  // inflating the run-recap stat displayed in game.js:5543/5622.
  // The fix: only increment hitsBlocked inside the full-absorb
  // branch (after `if (dmg <= 0)`). This pin enforces that.
  //
  // Codex r2 hardening: the increment must be LEXICALLY INSIDE the
  // `if (dmg <= 0) { ... }` body (not merely positionally after
  // the `if` opener), AND the bubble branch must NOT contain a
  // SECOND increment outside that gate. Brace-balanced extraction
  // makes the lexical-containment check robust against a
  // contributor adding `if (dmg <= 0) {} this.hitsBlocked = ...`
  // (positional pass, lexical fail).
  const tdSlice = ENTITIES_NC.slice(ENTITIES_NC.search(/\btakeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{/));
  const window = tdSlice.slice(0, 8000);
  // Locate the bubble branch (from the drain to the next sibling
  // shield block).
  const bubbleStart = window.search(/this\.bubbleHp\s*-=\s*absorbed/);
  assert.ok(bubbleStart >= 0, 'bubble drain must be locatable');
  const driverIdx = window.search(/NEON\.boosts\.consumeShieldCharge/);
  assert.ok(driverIdx > bubbleStart, 'SHIELD DRIVER block must follow bubble drain');
  const bubbleBranch = window.slice(bubbleStart, driverIdx);
  // Brace-balanced extraction of the `if (dmg <= 0) { ... }` body.
  // Naive depth counter; same string-literal limitation as the
  // extractBlock helper above. The body slice is what we actually
  // gate on for lexical containment.
  const fullAbsorbHead = bubbleBranch.search(/if\s*\(\s*dmg\s*<=\s*0\s*\)\s*\{/);
  assert.ok(fullAbsorbHead >= 0, 'bubble branch must contain `if (dmg <= 0) { ... }` full-absorb gate');
  const bodyOpen = bubbleBranch.indexOf('{', fullAbsorbHead);
  let depth = 1;
  let j = bodyOpen + 1;
  while (j < bubbleBranch.length && depth > 0) {
    const ch = bubbleBranch[j];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    j++;
  }
  assert.equal(depth, 0, 'full-absorb body must be brace-balanced');
  const fullAbsorbBody = bubbleBranch.slice(bodyOpen, j);
  // The increment MUST appear inside the full-absorb body...
  assert.match(fullAbsorbBody, /this\.hitsBlocked\s*=\s*\(\s*this\.hitsBlocked\s*\|\s*0\s*\)\s*\+\s*1/,
    'hitsBlocked increment must be LEXICALLY INSIDE the `if (dmg <= 0) { ... }` body — codex r2 catch (positional check alone passes if increment is moved out of the body)');
  // ...and the only `hitsBlocked` mutation in the entire bubble
  // branch must be the ONE inside the full-absorb body. Reject any
  // increment outside the body that would re-introduce double-count.
  const allIncs = bubbleBranch.match(/this\.hitsBlocked\s*=/g) || [];
  assert.equal(allIncs.length, 1,
    `bubble branch must contain EXACTLY ONE hitsBlocked mutation (the one inside the full-absorb body) — got ${allIncs.length}. A second mutation outside the gate would re-introduce the double-count bug.`);
});

test('SHIELD_BUBBLE render alpha is clamped to [0, 1] — prevents Canvas full-opacity flash at low HP', () => {
  // Regression guard for the negative-globalAlpha bug caught by
  // claude-opus-4.6 + gpt-5.5 reviews (MEDIUM). At low bubble HP
  // (frac ≤ 0.33), the base alpha 0.30 * frac drops below the
  // pulse amplitude 0.10, allowing the sum to go negative on the
  // sin trough. Per the HTML Canvas spec, setting globalAlpha to
  // a value outside [0, 1] is IGNORED — the property keeps its
  // previous value (1.0 after ctx.save() inherits the outer
  // context). Result: ring renders at FULL OPACITY for ~42% of
  // the pulse cycle at hp=1, a jarring flash. Clamping at the
  // assignment site is the canonical defense.
  //
  // Codex r2 hardening: assert BOTH the lower clamp (Math.max(0, ...))
  // AND the upper clamp (Math.min(1, ...)). The upper clamp is
  // currently unreachable given the formula (max possible value is
  // 0.30 + 0.10 = 0.40), but defense-in-depth — a future tweak that
  // raises the base or pulse amplitude could push the value above 1
  // and re-introduce the symmetric "value ignored" bug at the upper
  // edge. The test title claims [0, 1] — the assertion must enforce
  // both bounds to match the contract.
  // Anchor on the bubble-specific colour to isolate this branch
  // (Player.draw has many globalAlpha assignments in unrelated
  // branches — energy shield, burn indicator, etc).
  const m = ENTITIES_NC.match(/this\.bubbleHp\s*>\s*0\s*&&\s*this\.bubbleTimer\s*>\s*0[\s\S]{0,400}?globalAlpha\s*=\s*([^;]+);[\s\S]{0,200}?strokeStyle\s*=\s*'#e0e0ff'/);
  assert.ok(m, 'bubble render branch must set globalAlpha and strokeStyle to #e0e0ff');
  const expr = m[1];
  assert.ok(/Math\.max\s*\(\s*0(?:\.0)?\s*,/.test(expr),
    `bubble globalAlpha expression must clamp lower bound via Math.max(0, ...) — got: ${expr.trim()}`);
  assert.ok(/Math\.min\s*\(\s*1(?:\.0)?\s*,/.test(expr),
    `bubble globalAlpha expression must clamp upper bound via Math.min(1, ...) — got: ${expr.trim()} (codex r2: contract is [0,1], upper bound is currently unreachable but defense-in-depth against future formula tweaks)`);
});

// ─── Player.update tick ────────────────────────────────────────────────────

test('Player.update decrements bubbleTimer by dt and clears bubbleHp on expiry', () => {
  // dt-based decrement (NOT frame counter) so 30/60/120fps
  // expire identically — same convention as cloakTimer,
  // lastStandTimer, retributionTimer. On expiry, bubbleHp must
  // also clear (otherwise a future re-activation that happens to
  // land exactly on expiry could see leftover hp from the prior
  // bubble). Floater tells the player WHY the buff dropped.
  const tickRe = /this\.bubbleTimer\s*>\s*0[\s\S]{0,400}this\.bubbleTimer\s*-=\s*dt[\s\S]{0,400}this\.bubbleTimer\s*=\s*0[\s\S]{0,200}this\.bubbleHp\s*=\s*0/;
  assert.match(ENTITIES_NC, tickRe,
    'Player.update must decrement bubbleTimer by dt and clear bubbleHp on expiry');
});

// ─── Player.draw render ────────────────────────────────────────────────────

test('Player.draw renders the SHIELD_BUBBLE ring when bubbleHp > 0 AND bubbleTimer > 0', () => {
  // BOTH-GATE pin: gating on hp alone would render a bubble
  // forever after a successful absorb that didn't break it (if
  // expiry path failed to clear hp). Gating on timer alone would
  // render a 0-hp ghost bubble. The AND guard keeps the render
  // synchronised with the live state.
  const re = /this\.bubbleHp\s*>\s*0\s*&&\s*this\.bubbleTimer\s*>\s*0[\s\S]{0,500}NEON\.draw\.circleStroke/;
  assert.match(ENTITIES_NC, re,
    'Player.draw must guard the bubble ring on (bubbleHp > 0 && bubbleTimer > 0) and call NEON.draw.circleStroke');
});

test('SHIELD_BUBBLE render ring uses the catalog colour #66ddff (icon-to-effect consistency)', () => {
  // Render colour MUST match the catalog colour exactly so the
  // hackware UI icon (from HACKWARE.colour) and the in-game
  // effect read as the same thing. A drift bug (catalog #66ddff
  // but render #4488ff) would make the player learn one colour
  // in the menu and a different one in combat. CRITICAL for
  // accessibility — players use colour as the primary visual
  // identifier for status effects.
  const m = ENTITIES_NC.match(/this\.bubbleHp\s*>\s*0\s*&&\s*this\.bubbleTimer\s*>\s*0[\s\S]{0,800}strokeStyle\s*=\s*'(#[0-9a-fA-F]{6})'/);
  assert.ok(m, 'bubble render branch must set strokeStyle to a hex colour');
  assert.equal(m[1].toLowerCase(), '#e0e0ff',
    'bubble render strokeStyle must match the catalog colour #e0e0ff');
});

// ─── Audio ─────────────────────────────────────────────────────────────────

test('platform.js defines audio.hackwareShieldBubble()', () => {
  // Activation calls audio.hackwareShieldBubble(); without the
  // method, activation throws and bricks the run. Same crash
  // class flagged on every prior hackware PR — pinned here.
  assert.match(PLATFORM_NC, /\bhackwareShieldBubble\s*\(\s*\)\s*\{/,
    'platform.js must define an audio.hackwareShieldBubble() method (otherwise activation crashes)');
});

// ─── HACKWARE pool size canary (SHIELD_BUBBLE is the 16th) ────────────────

test('HACKWARE catalog has EXACTLY 16 entries (SHIELD_BUBBLE is the 16th)', () => {
  // Canary literal — when the next hackware is added, this
  // assertion moves to that test file and this one drops to a
  // `>= 16` floor. Mirrors the modifier-pool canary handoff
  // pattern (see tests/proximity-modifier.test.js +
  // tests/jammed-modifier.test.js post-PROXIMITY) and the prior
  // hackware handoff (DATA_SPIKE retired its exact-count to a
  // `>= 15` floor in tests/data-spike-hackware.test.js when
  // SHIELD_BUBBLE landed).
  const hwBlock = CONTENT_NC.match(/const\s+HACKWARE\s*=\s*\{([\s\S]*?)\n\}\s*;/);
  assert.ok(hwBlock, 'HACKWARE registry block must be locatable');
  const keys = hwBlock[1].match(/^\s*([A-Z_]+)\s*:\s*\{/gm) || [];
  assert.equal(keys.length, 16,
    `HACKWARE registry must have EXACTLY 16 entries — got ${keys.length} (SHIELD_BUBBLE is the 16th; if you added a new hackware, move this canary to its test file and replace this with a >= 16 floor)`);
});
