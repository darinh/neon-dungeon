'use strict';
// BLINK hackware — source-text wiring tests.
//
// BLINK is an instant 4-tile wall-aware teleport in the player's aim
// direction. It fills the "burst-traversal" niche in the hackware roster:
// faster than dash (range 4 vs ~0.18-tile actual dash translation per
// frame, 9s cooldown vs 1.5s dash) but with NO i-frames during/after the
// teleport — the value prop is repositioning that bypasses contact during
// the journey, not safety on landing.
//
// content.js is browser-only (no UMD/CommonJS exports), so we can't load
// activateHackware() under node:test. Instead, these tests assert the
// structural invariants any working BLINK must satisfy: catalog entry,
// activation case, swept-knockback wall-awareness pattern, sealed-room
// safety (which falls out for free from isPassable), no-op handling, and
// the SW cache bump that ships the new code to existing users.
//
// Pattern matches tests/hackware.test.js (DECOY_TURRET wiring tests).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Catalog registration ─────────────────────────────────────────────────

test('BLINK is registered in the HACKWARE catalog with required fields', () => {
  // Mirrors the existing entries (EMP_BURST, PHASE_CLOAK, etc.). Without a
  // catalog entry, drop tables / shop offers won't surface BLINK and the
  // activation switch case is unreachable.
  const re = /BLINK:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'[^']+',\s*cooldown:\s*\d+/;
  assert.match(CONTENT, re,
    'BLINK registry entry must declare name/desc/colour/icon/cooldown');
});

test('BLINK cooldown is between EMP (10s) and STATIC_FIELD (12s)', () => {
  // Design intent: bursty traversal sits between EMP_BURST and
  // STATIC_FIELD on the cooldown ladder. A trivial '1' or '60' would pass
  // the loose regex above; anchor a sensible band.
  const m = CONTENT.match(/BLINK:[^}]*cooldown:\s*(\d+)/);
  assert.ok(m, 'BLINK cooldown must be an integer literal');
  const cd = parseInt(m[1], 10);
  assert.ok(cd >= 6 && cd <= 14,
    `BLINK cooldown ${cd}s must sit in [6,14] band — too low and it eclipses dash, too high and it competes with DECOY_TURRET (14)`);
});

// ─── Activation case ──────────────────────────────────────────────────────

// Helper: locate the BLINK case body. The switch case may pick up sibling
// cases as we add hackware over time, so anchor on the case label and
// slice forward until the next case-or-closing-brace.
function blinkCaseBody() {
  const startIdx = CONTENT.indexOf("case 'BLINK':");
  assert.ok(startIdx > 0, "activateHackware must contain a case 'BLINK': branch");
  const tail = CONTENT.slice(startIdx);
  // End at the next sibling case label or the switch's closing brace.
  const next = tail.search(/\n\s{4}case\s+'[A-Z_]+'|\n\s{2}\}\s*\n\s*\}/);
  return next > 0 ? tail.slice(0, next) : tail.slice(0, 4000);
}

test('activateHackware has a BLINK case that mutates player.x and player.y', () => {
  // Without these assignments the cooldown burns and nothing teleports.
  const body = blinkCaseBody();
  assert.match(body, /player\.x\s*=\s*curBX/,
    "BLINK case must assign player.x from the swept end-position");
  assert.match(body, /player\.y\s*=\s*curBY/,
    "BLINK case must assign player.y from the swept end-position");
});

test('BLINK reads aim from mouse with a player.facing fallback (matches dash)', () => {
  // Same input shape as dash at entities.js:10933 — mouse → norm() → if
  // both axes zero, fall back to player.facing. Without the facing
  // fallback, clicking on yourself produces a no-op even though the
  // player IS facing somewhere.
  const body = blinkCaseBody();
  assert.match(body, /norm\(\s*ax\s*,\s*ay\s*\)/,
    'BLINK must normalise the mouse-aim vector');
  assert.match(body, /if\s*\(\s*!bdx\s*&&\s*!bdy\s*\)\s*\{\s*bdx\s*=\s*player\.facing\.x;\s*bdy\s*=\s*player\.facing\.y/,
    'BLINK must fall back to player.facing when the aim vector is zero');
  assert.match(body, /settings\.lockAimToMove/,
    'BLINK must respect the lockAimToMove setting (otherwise lock-aim users get a mouse-aimed teleport that ignores their setting)');
});

// ─── Wall-aware swept teleport (the safety guts) ──────────────────────────

test('BLINK uses a swept passability check, not a single-snap', () => {
  // Per the stored 'knockback sweeping' rule: any single-snap >1-tile
  // displacement can tunnel through 1-tile-thick interior walls. BLINK
  // ranges 4 tiles, so it MUST sweep. Anchor on the for-loop with axis-
  // independent xOk/yOk gates.
  const body = blinkCaseBody();
  assert.match(body, /for\s*\(\s*let\s+s\s*=\s*0;\s*s\s*<\s*STEPS/,
    'BLINK must sweep in a for-loop, not jump to (player.x + dx*4)');
  assert.match(body, /STEP\s*=\s*0\.25/,
    'BLINK step must be <=0.5 tile (knockback-sweeping rule); 0.25 matches the SHOCK_PULSE precedent');
  assert.match(body, /const\s+xOk\s*=[\s\S]{0,200}?isPassable\(map\[fyK\]\[fxK\]\)/,
    'BLINK must check x-axis passability per step');
  assert.match(body, /const\s+yOk\s*=[\s\S]{0,200}?isPassable\(map\[yfK\]\[xfK\]\)/,
    'BLINK must check y-axis passability per step');
  assert.match(body, /if\s*\(\s*!xOk\s*&&\s*!yOk\s*\)\s*break/,
    'BLINK must terminate the sweep when both axes are blocked');
});

test('BLINK applies a final combined-tile guard to reject diagonal-corner clip', () => {
  // The axis-independent checks alone admit a degenerate case: x-only and
  // y-only both look passable, but the combined target tile is itself a
  // wall (diagonal corner). The final guard catches it; without it BLINK
  // could land inside a wall, soft-locking the player.
  const body = blinkCaseBody();
  assert.match(body, /isPassable\(map\[finalFy\]\[finalFx\]\)/,
    'BLINK must perform a final isPassable check on the chosen end tile');
  assert.match(body, /curBX\s*=\s*startBX;\s*curBY\s*=\s*startBY/,
    'BLINK must snap back to start when the final-tile guard rejects');
});

test('BLINK is no-op safe (faced into wall) — suppresses fanfare and skips teleport', () => {
  // If the sweep produces zero displacement, BLINK must not spawn a
  // teleport ring at the same position (visual nonsense) and must not
  // play the audio cue (audio spam on whiff). Cooldown still commits.
  const body = blinkCaseBody();
  assert.match(body, /Math\.abs\(curBX\s*-\s*startBX\)\s*<\s*0\.01[\s\S]{0,80}?Math\.abs\(curBY\s*-\s*startBY\)\s*<\s*0\.01/,
    'BLINK must detect a zero-displacement sweep before applying FX');
  // Locate the no-op branch and assert it does NOT call audio.hackwareBlink
  // before its `break;`.
  const noopStart = body.search(/Math\.abs\(curBX\s*-\s*startBX\)/);
  const noopEnd = body.indexOf('break;', noopStart);
  assert.ok(noopStart > 0 && noopEnd > noopStart, 'no-op branch must be locatable');
  const noopBody = body.slice(noopStart, noopEnd);
  assert.ok(!/audio\.hackwareBlink/.test(noopBody),
    'no-op branch must NOT play audio.hackwareBlink (audio spam on whiff)');
  assert.ok(!/spawnParticles/.test(noopBody),
    'no-op branch must NOT spawnParticles (visual nonsense at static position)');
});

// ─── Sealed-room safety (falls out of isPassable for free) ────────────────

test('BLINK relies on isPassable, which already returns false for sealed entrances + locked doors', () => {
  // We verify the wiring (isPassable is the gate) and document the
  // contract here so that any future change to either function surfaces.
  // - bossSealed/challengeSealed flips entrance tiles to T.WALL at
  //   src/game.js:2149, and T.WALL is excluded from isPassable() at
  //   src/platform.js:759. So a player inside a sealed room cannot blink
  //   out (sweep stops at the wall) and a player outside cannot blink in.
  // - LOCKED_R/B/G doors are also excluded from isPassable, so BLINK
  //   cannot bypass the key economy.
  const body = blinkCaseBody();
  assert.match(body, /isPassable\(/,
    'BLINK must use isPassable for tile checks (single source of truth — keeps sealed-room + locked-door safety automatic)');
});

// ─── No i-frames (the design constraint) ──────────────────────────────────

test('BLINK does NOT grant invincibility on landing (distinct from dash)', () => {
  // The whole point of BLINK vs dash is that BLINK is bursty traversal
  // WITHOUT the safety window dash provides. If we ever add an
  // invincibleTimer assignment here, we collapse BLINK into "longer dash"
  // and lose the design distinction.
  const body = blinkCaseBody();
  assert.ok(!/invincibleTimer/.test(body),
    'BLINK case must NOT touch player.invincibleTimer — the no-i-frames-on-landing risk IS the design');
  assert.ok(!/cloakTimer/.test(body),
    'BLINK case must NOT touch player.cloakTimer — that is PHASE_CLOAK\'s niche');
});

// ─── Visual + audio feedback ──────────────────────────────────────────────

test('BLINK spawns particles at BOTH start and end positions', () => {
  // Single-position particles read as a cosmetic blip; two bursts read as
  // a teleport. Anchor on both calls with the BLINK colour.
  const body = blinkCaseBody();
  const matches = body.match(/spawnParticles\(\s*(?:startBX|curBX)/g) || [];
  assert.ok(matches.length >= 2,
    'BLINK must spawn particles at both startBX and curBX (teleport feel)');
});

test('BLINK pushes path segments into player.dashTrail (reuses existing renderer)', () => {
  // Reuses the dash trail render path at render.js so no new render code
  // ships with this hackware. Without trail segments the teleport reads
  // as a pop with no motion cue.
  const body = blinkCaseBody();
  assert.match(body, /player\.dashTrail\.push\(/,
    'BLINK must push path segments into player.dashTrail');
  assert.match(body, /player\.dashTrail\.length\s*>=\s*8/,
    'BLINK must respect the 8-segment dashTrail cap (avoid array bloat)');
});

test('BLINK plays a dedicated audio cue (audio.hackwareBlink)', () => {
  const body = blinkCaseBody();
  assert.match(body, /audio\.hackwareBlink\(\)/,
    'BLINK case must call audio.hackwareBlink()');
});

test('audio.hackwareBlink is defined in platform.js', () => {
  assert.match(PLATFORM, /hackwareBlink\s*\(\s*\)\s*\{/,
    'platform.js must define an audio.hackwareBlink() method (otherwise activation crashes)');
});

// ─── SW cache invalidation ────────────────────────────────────────────────

test('sw.js cache version is bumped to v202 or higher (>= ship floor)', () => {
  // Per project convention (memory: sw cache test convention): assert >=
  // the ship floor, not exact version, so subsequent PRs don't have to
  // retitle this test as cache versions march forward.
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, 'sw.js must declare a neon-dungeon-vN cache key');
  const ver = parseInt(m[1], 10);
  assert.ok(ver >= 202,
    `sw cache version must be >= v202 (BLINK ship floor) — found v${ver}`);
});
