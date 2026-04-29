'use strict';
// SCRAP_MAGNET hackware — source-text wiring tests.
//
// content.js is browser-only (no UMD/CommonJS exports), so we can't load
// activateHackware/updateHackwareEffects directly under node:test. These
// tests assert the structural invariants any working SCRAP_MAGNET must
// satisfy: registry entry, activation case (with dedup), per-frame update
// branch (with deliberate exclusions), draw branch, audio function, and
// the SW cache version bump.
//
// Each check fails loudly the moment a refactor drops a wire — the same
// regression-shape that bit past hackware additions.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT  = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content.js'),  'utf8');
const PLATFORM = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8');
const SW       = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'),              'utf8');

test('SCRAP_MAGNET is registered in the HACKWARE catalog with required fields', () => {
  const re = /SCRAP_MAGNET:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'[^']+',\s*cooldown:\s*\d+/;
  assert.match(CONTENT, re, 'SCRAP_MAGNET registry entry must declare name/desc/colour/icon/cooldown');
});

test('activateHackware has a SCRAP_MAGNET case that pushes a scrap_magnet effect', () => {
  // Without the case the cooldown burns but no effect spawns — silent fail.
  const caseRe = /case\s+'SCRAP_MAGNET':[\s\S]{0,2000}?hackwareEffects\.push\(\s*\{[\s\S]{0,400}?type:\s*'scrap_magnet'/;
  assert.match(CONTENT, caseRe, "activateHackware must push a {type:'scrap_magnet'} effect");
});

test('SCRAP_MAGNET activation enforces max-1-active by splicing existing magnets', () => {
  // Mirrors STATIC_FIELD/HOLO_DECOY/DECOY_TURRET pattern. Without this,
  // recasting stacks magnets and produces overlapping rings + redundant
  // ambient particles.
  const dedupRe = /case\s+'SCRAP_MAGNET':[\s\S]{0,2000}?hackwareEffects\[j\]\.type\s*===\s*'scrap_magnet'[\s\S]{0,100}?hackwareEffects\.splice\(j,\s*1\)/;
  assert.match(CONTENT, dedupRe, 'SCRAP_MAGNET must splice any existing scrap_magnet on recast');
});

test('SCRAP_MAGNET activation invokes audio and posts a status toast', () => {
  // Audio + toast are the cast feedback the player needs to read the cast.
  // Toast colour matches gold (#ffd700) for visual continuity with VaultCoin.
  const caseStart = CONTENT.indexOf("case 'SCRAP_MAGNET':");
  assert.ok(caseStart !== -1, "SCRAP_MAGNET case must exist in activateHackware");
  const caseSlice = CONTENT.slice(caseStart, caseStart + 2000);
  assert.match(caseSlice, /audio\.hackwareScrapMagnet\s*\(/, 'must call audio.hackwareScrapMagnet()');
  assert.match(caseSlice, /_CG\.msg\(\s*'[^']*SCRAP MAGNET[^']*',\s*'#ffd700'/, 'must post a SCRAP MAGNET toast in gold (#ffd700)');
});

// Helper: locate the per-frame UPDATE branch (not the activation case nor
// the draw branch). The per-frame branch is inside updateHackwareEffects()
// and references `items` (the activation case doesn't, the draw branch
// doesn't). Anchor on the branch guard, then slice forward until the next
// sibling type guard so we capture the whole branch body.
function magnetUpdateBody() {
  // Find ALL occurrences of the magnet branch guard, then pick the one
  // whose body iterates `items` (that's the per-frame update; activation
  // pushes-to-hackwareEffects without iterating items).
  const guard = "if (fx.type === 'scrap_magnet')";
  let idx = -1, found = -1;
  while ((idx = CONTENT.indexOf(guard, idx + 1)) !== -1) {
    const slice = CONTENT.slice(idx, idx + 4000);
    if (/for\s*\(\s*const\s+it\s+of\s+items\s*\)/.test(slice)) { found = idx; break; }
    if (found < 0) found = idx; // fall back if structure changes
  }
  assert.ok(found > 0, 'updateHackwareEffects must contain a scrap_magnet branch');
  const tail = CONTENT.slice(found + guard.length);
  const next = tail.search(/\n\s*if\s*\(\s*fx\.type\s*===/);
  const len = next > 0 ? (guard.length + next) : 4000;
  return CONTENT.slice(found, found + len);
}

test('updateHackwareEffects has a scrap_magnet per-frame branch that lerps items toward player', () => {
  const body = magnetUpdateBody();
  // Centre tracks player so coins chase a moving target (sprint/dash/teleport).
  assert.match(body, /fx\.x\s*=\s*p\.x/, 'magnet centre must track player.x each frame');
  assert.match(body, /fx\.y\s*=\s*p\.y/, 'magnet centre must track player.y each frame');
  // Iterate items and lerp positions toward the centre.
  assert.match(body, /for\s*\(\s*const\s+it\s+of\s+items\s*\)/, 'must iterate the global items array');
  assert.match(body, /it\.x\s*\+=\s*\(fx\.x\s*-\s*it\.x\)/, 'must fraction-lerp it.x toward centre');
  assert.match(body, /it\.y\s*\+=\s*\(fx\.y\s*-\s*it\.y\)/, 'must fraction-lerp it.y toward centre');
});

test('SCRAP_MAGNET pull respects secretMask — keys in unrevealed secret rooms stay put', () => {
  // Sequence-break gate: keys are gen-time placed in vis2-reachable rooms,
  // but a key-room can subsequently be designated a secret room (the
  // secretEligible filter doesn't exclude rooms-with-keys). Without the
  // gate the magnet would pull keys out of unrevealed secret rooms and
  // bypass the cracked-tile discovery the secret is designed around.
  // dungeon.secretMask[ty][tx] is cleared in revealSecretRoom() so revealed
  // secrets pull normally.
  const body = magnetUpdateBody();
  assert.match(body, /_CG\.dungeon\?\.secretMask/, 'must read dungeon.secretMask via optional-chain (transition-safe)');
  assert.match(body, /sMask\s*&&\s*sMask\[ity\]\?\.\[itx\]/, 'must skip items whose tile is in an unrevealed secret area');
});

test('SCRAP_MAGNET pull respects the deliberate include/exclude list', () => {
  // Whitelist: isHoard (VaultCoin + MagpieHoard) + isKey (KeyItem). Anything
  // else must be skipped — pulling a Whisper forces READING overlay mid-fight,
  // pulling a ShockPulse auto-discharges the panic-button at the player when
  // no enemies are near (wasted cast), pulling a HARVESTER drop auto-triggers
  // the surge buff at an arbitrary moment, and pulling a plain upgrade Item
  // queues a perk-choice UI mid-combat. The single conditional `it.isHoard
  // || it.isKey` continues past anything else.
  const body = magnetUpdateBody();
  assert.match(body, /!\s*\(\s*it\.isHoard\s*\|\|\s*it\.isKey\s*\)/,
    'must skip items whose flag is neither isHoard nor isKey');
});

test('SCRAP_MAGNET pull is gated on a living player', () => {
  // If the player dies during the pull, items lerping into the corpse become
  // unreachable for any post-death recovery flow. Skip the branch when
  // _CG.player is missing or hp<=0.
  const body = magnetUpdateBody();
  assert.match(body, /_CG\.player/,        'must read the canonical player ref via _CG.player');
  assert.match(body, /p\.hp\s*<=\s*0/,     'must early-continue when player.hp <= 0');
});

test('SCRAP_MAGNET pull is bounded by the cast radius', () => {
  // Without a radius gate the magnet would yank items from the entire map
  // — including loot rooms the player hasn't entered, breaking the implicit
  // "pull only what you can probably see / what's near you" contract that
  // every other AoE hackware (gravity, static_field, holo_decoy) honours.
  const body = magnetUpdateBody();
  assert.match(body, /d\s*>\s*fx\.radius/, 'must skip items outside fx.radius');
});

test('drawHackwareEffects has a scrap_magnet draw branch with a gold ring', () => {
  // Without a draw branch the cast would have audio + toast but no visible
  // tell — players couldn't read where the magnet ends or that it's still
  // active. Gold (#ffd700) matches VaultCoin's signature so the player
  // associates the visual with loot (not damage / not stun).
  // Locate the draw branch specifically: it sits inside drawHackwareEffects
  // and references camX/camY (activation+update don't).
  const drawIdx = CONTENT.indexOf('function drawHackwareEffects');
  assert.ok(drawIdx !== -1, 'drawHackwareEffects must exist');
  const drawSlice = CONTENT.slice(drawIdx, drawIdx + 8000);
  const branchRe = /if\s*\(\s*fx\.type\s*===\s*'scrap_magnet'\s*\)\s*\{[\s\S]{0,2500}?#ffd700/;
  assert.match(drawSlice, branchRe, 'draw branch must paint a #ffd700 (gold) element');
  assert.match(drawSlice, /scrap_magnet[\s\S]{0,2500}?circleStroke/, 'draw branch must stroke the ring boundary');
});

test('SCRAP_MAGNET cooldown is positive and finite', () => {
  // Zero/negative cooldown lets the player chain-cast (visual stacking +
  // particle spam + zero opportunity cost). Mirror the 10-16s band of the
  // other utility hackware.
  const re = /SCRAP_MAGNET:\s*\{[\s\S]{0,200}?cooldown:\s*(\d+)/;
  const m = CONTENT.match(re);
  assert.ok(m, 'SCRAP_MAGNET cooldown must be present');
  const cd = parseInt(m[1], 10);
  assert.ok(cd >= 8 && cd <= 30, `cooldown ${cd} must be within the 8-30s utility-hackware band`);
});

test('platform.js exposes audio.hackwareScrapMagnet()', () => {
  // Without the audio method the activation case throws TypeError on cast,
  // burning the cooldown AND killing all subsequent same-frame work.
  assert.match(PLATFORM, /hackwareScrapMagnet\s*\(\)\s*\{/, 'audio.hackwareScrapMagnet must be defined');
});

test('sw.js cache version is at least v198 (SCRAP_MAGNET ship floor)', () => {
  // Bumping the SW cache forces clients to fetch the new content.js + sw.js
  // bundle. Without the bump, returning users get the old bundle and never
  // see the new hackware.
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, 'sw.js must declare a neon-dungeon-vNNN cache version');
  const v = parseInt(m[1], 10);
  assert.ok(v >= 198, `sw cache version v${v} must be >= 198 (SCRAP_MAGNET ship floor)`);
});
