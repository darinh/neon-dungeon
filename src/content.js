// @ts-check
'use strict';

// Phase 3D batch 4: Proxy-based alias for the cross-file `game` global.
// content.js touches many runtime-added game props (game._minimapDirty,
// game.mapRevealed, etc.) that don't appear on the typed game shape declared
// in src/game.js. The proxy widens access to `any` and defers resolution.
// Mirrors the pattern in src/render.js (_RG) and src/platform.js (_G).
/** @type {any} */
const _CG = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});
const dungeonTopology = /** @type {any} */ (requireNEON('dungeonTopology', 'src/content.js'));
const dungeonReachability = /** @type {any} */ (requireNEON('dungeonReachability', 'src/content.js'));
const DUNGEON_CARDINAL_DIRECTIONS = /** @type {ReadonlyArray<readonly [number, number]>} */ (dungeonTopology.CARDINAL_DIRECTIONS);


// ─── Meta-Progression (persistent across runs) ──────────────────────────────
// Implementation extracted to src/meta/save.js. These wrappers preserve call
// sites across the codebase and inject browser-side globals (DIFFICULTIES for
// difficulty validation, buildWeapon for STARTING_GEAR) that the extracted
// module cannot assume exist in Node tests.
const _save = /** @type {any} */ (requireNEON('save', 'src/content.js'));
const META_UPGRADES     = _save.META_UPGRADES;
const DIFF_UNLOCK_REQS  = _save.DIFF_UNLOCK_REQS;

function loadMeta()                             { return NEON.save.loadMeta(DIFFICULTIES); }
/**
 * @param {any} meta
 */
function saveMeta(meta)                         { return NEON.save.saveMeta(meta); }
/**
 * @param {any} id
 */
function getMetaLevel(id)                       { return NEON.save.getMetaLevel(id, DIFFICULTIES); }
/**
 * @param {any} diffId
 */
function isDiffUnlocked(diffId)                 { return NEON.save.isDiffUnlocked(diffId, DIFFICULTIES); }
/**
 * @param {any} floor
 * @param {any} score
 * @param {any} bc
 * @param {any} vic
 */
function calcRunShards(floor, score, bc, vic)   { return NEON.save.calcRunShards(floor, score, bc, vic, getDiff().shardMul); }
/**
 * @param {any} player
 */
function applyMetaToPlayer(player)              { return NEON.save.applyMetaToPlayer(player, buildWeapon, () => rand('loot')); }
function getMetaXPMultiplier()                  { return NEON.save.getMetaXPMultiplier(); }
function getMetaCreditMultiplier()              { return NEON.save.getMetaCreditMultiplier(); }
// UNCHAINED helpers — thin wrappers so game.js can call them without NEON.save.
function resetMeta()                            { return NEON.save.resetMeta(); }
/**
 * @param {any} n
 */
function addCores(n)                            { return NEON.save.addCores(n); }
/**
 * @param {any} n
 */
function spendCores(n)                          { return NEON.save.spendCores(n); }
/**
 * @param {any} id
 */
function addLogFound(id)                        { return NEON.save.addLogFound(id); }
/**
 * @param {any} id
 */
function markLogRead(id)                        { return NEON.save.markLogRead(id); }
/**
 * @param {any} slot
 * @param {any} moduleId
 */
function installModule(slot, moduleId)          { return NEON.save.installModule(slot, moduleId); }
/**
 * @param {any} moduleId
 * @param {any} refund
 */
function sellModule(moduleId, refund)           { return NEON.save.sellModule(moduleId, refund); }

// ─── Status Effect Indicators ────────────────────────────────────────────────
// Low-HP danger vignette (red pulsing edge glow at ≤25% HP)
/**
 * @param {any} player
 */
function drawDangerVignette(player) {
  const frac = player.hp / player.maxHp;
  if (frac > 0.25 || player.hp <= 0) return;
  // Intensity: 0 at 25% → 1 at 0%. Pulse synced with lowHpTimer (2s cycle).
  // REDUCED MOTION accessibility umbrella: keep the vignette visible (it's a
  // critical safety signal at low HP) but freeze the sin-pulse at its
  // midpoint (0.5). The full-screen red flicker is precisely the photosensitive
  // / vestibular trigger the setting exists to mitigate; the static red border
  // still conveys "you're in danger" at the same average intensity without the
  // throbbing motion. Audio cue (audio.lowHealth() in entities.js) and HP bar
  // remain untouched as redundant signals.
  const severity = 1 - (frac / 0.25);
  const pulse = settings.reducedMotion ? 0.5 : (0.5 + 0.5 * Math.sin(player.lowHpTimer * Math.PI));
  const alpha = severity * (0.12 + 0.14 * pulse);
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, '#ff1a1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = '#ff1a1a';
  ctx.lineWidth = 3;
  ctx.shadowBlur = 15; ctx.shadowColor = '#ff1a1a';
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.restore();
}

// Floor modifier announcement banner (slides down on floor entry)
function drawModBanner() {
  const t = _CG.modBannerTimer;
  if (!t || t <= 0 || !_CG.modifier) return;
  const m = getMod();
  const dur = 3.0;
  const fadeIn = 0.3, fadeOut = 0.3;
  let alpha = 1;
  const elapsed = dur - t;
  if (elapsed < fadeIn) alpha = elapsed / fadeIn;
  else if (t < fadeOut) alpha = t / fadeOut;

  // Slide down from offscreen
  const slideY = elapsed < fadeIn ? -20 * (1 - elapsed / fadeIn) : (t < fadeOut ? -20 * (1 - t / fadeOut) : 0);
  const cy = 50 + safeTop + slideY;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background pill
  const narrow = layout.compact;
  const pillW = narrow ? Math.min(W - 40, 260) : 320;
  const pillH = narrow ? 32 : 40;
  const px = (W - pillW) / 2;
  const py = cy - pillH / 2;
  ctx.fillStyle = 'rgba(10,10,18,0.85)';
  ctx.beginPath();
  const r = 8;
  ctx.moveTo(px + r, py);
  ctx.lineTo(px + pillW - r, py);
  ctx.quadraticCurveTo(px + pillW, py, px + pillW, py + r);
  ctx.lineTo(px + pillW, py + pillH - r);
  ctx.quadraticCurveTo(px + pillW, py + pillH, px + pillW - r, py + pillH);
  ctx.lineTo(px + r, py + pillH);
  ctx.quadraticCurveTo(px, py + pillH, px, py + pillH - r);
  ctx.lineTo(px, py + r);
  ctx.quadraticCurveTo(px, py, px + r, py);
  ctx.fill();

  // Border glow
  ctx.shadowBlur = 12; ctx.shadowColor = m.colour;
  ctx.strokeStyle = m.colour; ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Icon + text
  const fs = narrow ? 11 : 13;
  ctx.font = `bold ${fs}px monospace`;
  ctx.fillStyle = m.colour; ctx.textAlign = 'center';
  const iconText = m.icon + ' ' + m.label;
  ctx.fillText(iconText, W / 2, cy - (narrow ? 1 : 3));

  if (!narrow) {
    ctx.font = '10px monospace';
    ctx.fillStyle = '#aaaacc';
    ctx.fillText(m.desc, W / 2, cy + 12);
  }

  // Dismiss hint — appears after the slide-in completes (per pause-on-level-text
  // behaviour added in PR #106, any new keypress / tap dismisses the banner).
  // Wait until elapsed > fadeIn so it doesn't flicker mid-slide.
  if (elapsed > fadeIn) {
    const hintAlpha = alpha * 0.5;
    if (hintAlpha > 0.01) {
      ctx.globalAlpha = hintAlpha;
      ctx.fillStyle = '#666677';
      ctx.font = `${narrow ? 8 : 9}px monospace`;
      ctx.fillText('press any key to skip', W / 2, py + pillH + (narrow ? 10 : 12));
    }
  }

  ctx.restore();
}

// Status effect badges — compact indicators above HUD bar
/** @type {Record<string, any>} */
const statusFx = {};
/**
 * @param {any} player
 */
function getStatusEffects(player) {
  const fx = [];
  // Floor modifier
  if (_CG.modifier) {
    const m = getMod();
    fx.push({ id: 'mod', icon: m.icon, label: m.label, colour: m.colour });
  }
  // Slow trap debuff
  if (player.speedTimer > 0 && player.speedBoost < 0) {
    fx.push({ id: 'slow', icon: '❄', label: 'SLOW', colour: '#6688cc', timer: player.speedTimer });
  }
  // Burn debuff (from enemy attacks)
  if (player.burnTimer > 0) {
    fx.push({ id: 'burn', icon: '🔥', label: player.burnTimer.toFixed(1)+'s', colour: '#ff6600' });
  }
  // Shock debuff (from enemy attacks). Show countdown so the player can
  // anticipate when input control returns — matches the burn timer pattern.
  if (player.shockTimer > 0) {
    fx.push({ id: 'shocked', icon: '⚡', label: player.shockTimer.toFixed(1)+'s', colour: '#ffee44' });
  }
  // Energy shield recharging
  if (player.perks.ENERGY_SHIELD && !player.energyShield) {
    fx.push({ id: 'shield', icon: '🛡', label: Math.ceil(player.energyShieldTimer) + 's', colour: '#4466aa' });
  }
  // Energy shield active
  if (player.perks.ENERGY_SHIELD && player.energyShield) {
    fx.push({ id: 'shield-up', icon: '🛡', label: 'UP', colour: '#4488ff' });
  }
  // Nano Regen — extended in PR (after PR #282) to also surface the
  // regenerator meta-upgrade's active heal window (player.regenPerSec
  // controlled by metaFlags.regenerator; tickOutOfCombatRegen at
  // meta/behavior.js:85-90 actually heals when _outOfCombatTimer > 3).
  // Both systems heal HP-while-low and feel identical to the player, so
  // a single ♻ REGEN badge unifies them. NANO_REGEN heals always while
  // hp<maxHp; regenerator heals only after the 3s out-of-combat grace
  // period — the badge reflects the actual healing state, not just
  // ownership, so players see when regen is genuinely ticking and not
  // before. The 3s OOC grace itself is intentionally NOT surfaced as a
  // separate "waiting" state in this PR (would be HUD noise across most
  // engagements); could be added in a follow-up if needed.
  const _nanoRegen = (player.upgrades.NANO_REGEN || 0) > 0;
  const _metaRegen = (player.regenPerSec || 0) > 0
    && (player._outOfCombatTimer || 0) > 3;
  if ((_nanoRegen || _metaRegen) && player.hp < player.maxHp) {
    fx.push({ id: 'regen', icon: '♻', label: 'REGEN', colour: '#00ff88' });
  }
  // Dash cooldown
  if (player.dashCooldown > 0) {
    fx.push({ id: 'dash-cd', icon: '⇧', label: player.dashCooldown.toFixed(1) + 's', colour: '#7a6a33' });
  } else {
    fx.push({ id: 'dash', icon: '⇧', label: 'RDY', colour: '#ffb700' });
  }
  // Hackware cooldown
  if (player.hackware) {
    const hw = HACKWARE[player.hackware];
    if (player.hackwareCooldown > 0) {
      fx.push({ id: 'hw-cd', icon: hw.icon, label: player.hackwareCooldown.toFixed(1)+'s', colour: '#665533' });
    } else {
      fx.push({ id: 'hw-rdy', icon: hw.icon, label: 'RDY', colour: hw.colour });
    }
  }
  // Phase cloak active
  if (player.cloakTimer > 0) {
    fx.push({ id: 'cloak', icon: '◇', label: player.cloakTimer.toFixed(1)+'s', colour: '#cc44ff' });
  }
  // Berserker active (below 25% HP)
  if (player.perks.BERSERKER && player.hp > 0 && player.hp / player.maxHp <= 0.25) {
    fx.push({ id: 'berserker', icon: '🔥', label: 'RAGE', colour: '#ff4400' });
  }
  // Pristine active (at/above 90% HP) — high-HP mirror of Berserker.
  if (player.perks.PRISTINE && player.hp > 0 && player.hp / player.maxHp >= 0.90) {
    fx.push({ id: 'pristine', icon: '✧', label: 'PRIME', colour: '#88ffee' });
  }
  // BULWARK active (at/above 75% HP) — defensive counterpart to PRISTINE.
  // While the gate holds, Player.takeDamage() multiplies incoming damage by
  // 0.85 (entities.js:11557 — same maxHp>0 divide-by-zero guard, same >=0.75
  // threshold). Predicate is strict-equal to the multiplier gate (after
  // stripping the defensive `player.perks &&` short-circuit), so a future
  // re-tune to the threshold/multiplier on EITHER side will be caught by
  // the strict-equality alignment test in tests/bulwark-hud.test.js.
  //
  // Defensive `player.perks &&` short-circuit: legacy player shapes (test
  // sandboxes, save migrations) may bypass the ctor and lack a .perks
  // object. The earlier ENERGY_SHIELD branch at content.js:2292 unguarded-
  // derefs player.perks, so a real call without .perks already crashes
  // before reaching this gate — the guard here is defense-in-depth (per
  // PR #300/#302/#304 reviewer convention for new HUD badges).
  //
  // Icon ◈ matches the perk-card glyph at content.js:4669; colour #88ccff
  // matches the perk-card colour exactly (cross-file desync defence per
  // stored memory 'HUD status fx'). Label 'WARD' mirrors the action-word
  // style of PRISTINE 'PRIME' / BERSERKER 'RAGE' (single short noun for
  // the active passive state).
  if (player.perks && player.perks.BULWARK && player.maxHp > 0 && player.hp / player.maxHp >= 0.75) {
    fx.push({ id: 'bulwark', icon: '◈', label: 'WARD', colour: '#88ccff' });
  }
  // STRIDE active (movement-built dmg stacks). Distinct from BERSERKER (HP gate)
  // and PRISTINE (high-HP gate) — STRIDE is purely movement-gated and stacks
  // multiplicatively with both via Player.effectiveAtk() at entities.js:11331.
  //
  // Display: ⇶ RUSH ×1.05 ... ×1.25 — multiplier-readout style mirroring
  // HOT_HAND (PR #280), MOMENTUM (PR #282), OVERDRIVE (PR #302). Pre-PR
  // the label was `RUSH ×N` (a STACK COUNT, 1..5), which collided
  // visually with the multiplier-readout convention (`×N.NN`) used by
  // every other ATK-buff badge — players had to mentally compute the
  // 5%-per-stack multiplier from the count. Replacing the count with the
  // multiplier surfaces the actual ATK boost directly. The action-word
  // "RUSH" prefix is preserved (matches WARD/RAGE/PRIME/AIM single-noun
  // identity style for HP/state-gated buff badges) so the badge remains
  // visually identifiable as STRIDE-the-perk, not just "another ×N".
  //
  // Local alias `ss` mirrors the entities.js:11330 alias of the same
  // name — keeps the badge gate predicate STRUCTURALLY IDENTICAL to the
  // multiplier gate after `this.`/`player.` receiver normalisation, so
  // the cross-file alignment test (tests/stride-hud.test.js) can compare
  // them directly via strict equality (no alias-substitution rule needed).
  //
  // Defensive `player.perks &&` null-check matches the codebase pattern
  // (legacy player shapes that bypass the ctor may lack .perks). Cross-
  // file desync defence (per stored memory 'HUD status fx'): the per-
  // stack rate (0.05) is a literal in BOTH the HUD label here AND the
  // STRIDE_DMG_PER_STACK constant at entities.js:10944. The companion
  // test parses entities.js and asserts the literals match.
  const ss = (player._strideStacks || 0);
  if (player.perks && player.perks.STRIDE && ss > 0) {
    const mul = (1 + 0.05 * ss).toFixed(2);
    fx.push({ id: 'stride', icon: '⇶', label: 'RUSH ×' + mul, colour: '#00ffaa' });
  }
  // DEADEYE charged (stillness latch — next shot gets ×1.5). Stillness
  // counterpart to STRIDE; both can be owned simultaneously, in which
  // case the chip stacks with RUSH ×N (additive perk slots, distinct
  // visual signals so the player can tell which is currently active).
  if (player.perks && player.perks.DEADEYE && player._steadyReady) {
    fx.push({ id: 'deadeye', icon: '◎', label: 'AIM', colour: '#ffee88' });
  }
  // DEADEYE charging — extends the AIM badge above with a countdown of how
  // much stillness remains until the ×1.5 charge latches. Pre-this-PR the
  // charge ramp (0 → DEADEYE_CHARGE_TIME = 1.0s, entities.js:10957) was
  // invisible: players saw the AIM badge appear out of nowhere and could
  // not tell that pausing for 0.7 more seconds would arm the bonus, nor
  // that an incoming hit (shockTimer) silently froze the ramp.
  //
  // Mutual-exclusion strategy — explicit `!_steadyReady` gate, NOT an
  // else-if chain. Per the structural-ancestor lesson from PR #302
  // (gpt-5.5 review), an else-if branch's effective runtime predicate
  // includes the negation of the previous gate, which the alignment
  // tests do NOT capture. Two top-level sibling if-blocks with explicit
  // mutual-exclusion conjuncts let each badge be a structural sibling
  // and align cleanly against its source-of-truth gate.
  //
  // SHARED statusFx ID with the AIM badge above (`id: 'deadeye'`) — NOT
  // a sibling id like 'deadeye-cd'. Per the gpt-5.5 review of this PR:
  // drawStatusBar() at content.js:2680-2693 keeps inactive ids alive
  // while fading them out (~200ms / ~12 frames at 60fps). With separate
  // ids, the ramp→ready transition would render BOTH the fading
  // 'deadeye-cd' badge AND the rising 'deadeye' badge simultaneously
  // for the duration of the crossfade. DEADEYE transitions FAST (latch
  // every 1.0s while still, consumed every shot, re-ramp from 0), so
  // this dual-render artifact would flicker repeatedly in active play.
  // Using the SAME id makes statusFx keep ONE entry whose label and
  // colour mutate instantly on state transition — alpha stays high
  // across the boundary, no crossfade overlap. The icon ◎ is the same
  // in both states (perk identity), so visually the badge "morphs" from
  // countdown to AIM with no flicker.
  //
  // Gate composition:
  //   1. player.perks — defensive null-check (legacy player shapes).
  //   2. player.perks.DEADEYE — perk-ownership.
  //   3. !player._steadyReady — mutually exclusive with the AIM badge
  //      above (when ready=true the entities.js tick sets chargeTime=0,
  //      so this is double-defence: if a future regression decoupled
  //      them, the HUD still shows exactly one badge).
  //   4. player._steadyChargeTime > 0 — only show while actually
  //      charging (between full reset at 0 and ready latch at >=1s).
  //      The cancel-partial-on-move branch at entities.js:12284 zeroes
  //      _steadyChargeTime instantly on movement, so this gate ALSO
  //      hides the badge during shockTimer (which zeroes via the same
  //      else-branch) — matches the runtime invariant that the ramp
  //      can't progress while shocked.
  //
  // Display: ◎ N.Ns countdown (DEADEYE_CHARGE_TIME - elapsed). Same
  // .toFixed(1)+'s' format as dash-cd / hw-cd / cloak (sub-5s timers
  // get one decimal of precision). Icon ◎ matches the AIM badge above
  // and the perk-card glyph at content.js:4594. Colour #887744 is the
  // dimmed half-saturation pair of the active #ffee88 (mirrors
  // LAST_STAND's #886622-vs-#ffaa00 active-vs-cooldown saturation
  // contrast); the shared icon carries the buff identity and the
  // saturation tells the state.
  //
  // Cross-file desync defence (per stored memory 'HUD status fx'): the
  // 1.0s charge time is hard-coded in BOTH the HUD label (literal `1`
  // below) AND the entities.js DEADEYE_CHARGE_TIME constant. The
  // companion test parses entities.js and asserts the content.js
  // literal matches, so a future re-tune (e.g. 0.75s charge) trips the
  // test and forces both sites to be updated in lockstep.
  //
  // NaN defence: although the gate's `(player._steadyChargeTime || 0) > 0`
  // short-circuits when chargeTime is undefined/0, the countdown formula
  // also wraps the input in `(... || 0)` so a future refactor that
  // moved the gate or split the predicate cannot leak NaN into the
  // toFixed call (which would render the literal string "NaNs").
  if (player.perks && player.perks.DEADEYE && !player._steadyReady
      && (player._steadyChargeTime || 0) > 0) {
    const remaining = Math.max(0, 1 - (player._steadyChargeTime || 0));
    fx.push({ id: 'deadeye', icon: '◎', label: remaining.toFixed(1)+'s', colour: '#887744' });
  }
  // Second Wind available — extended in PR (after PR #286) to also
  // surface the META second_wind upgrade (meta/upgrades.js:31, "Revive
  // once per floor at 1 HP when lethally hit"). The PERK version
  // (player.perks.SECOND_WIND, tracked via player.secondWindUsed) and
  // the META version (player.metaFlags.second_wind, tracked via
  // player._metaSecondWindUsed) fire independently per
  // meta/behavior.js:99 ("Parallel to the legacy SECOND_WIND perk —
  // they fire independently."). Both feel identical to the player as
  // an "I have one revive available" indicator. Pre-this-PR the badge
  // ONLY surfaced the perk version — META owners saw NO HUD signal
  // that the safety net was armed. Mirrors the PR #284 regenerator
  // gate extension: OR-compose ownership-and-not-yet-used predicates
  // for each independent system; share a single badge id since the
  // player only cares about "do I have a revive ready or not."
  const _perkSW = player.perks.SECOND_WIND && !player.secondWindUsed;
  const _metaSW = player.metaFlags
    && (player.metaFlags.second_wind | 0) > 0
    && !player._metaSecondWindUsed;
  if (_perkSW || _metaSW) {
    fx.push({ id: 'second-wind', icon: '↺', label: 'LIFE', colour: '#00ddff' });
  }
  // HOT_HAND streak active — perk rewards consecutive hits on the SAME
  // target with +5% damage per stack (capped at +30% / 6 stacks). The
  // streak resets on target-switch or after HOT_HAND_WINDOW (3s) without
  // a hit (entities.js:12017-12023). Without an HUD indicator the buff
  // accumulates invisibly: players see damage numbers tick up but can't
  // tell why or when they're "in the zone." Surfaces the multiplier the
  // NEXT hit will receive (NOT the current stack count) so the readout
  // is actionable without the player needing to mentally compute the
  // formula.
  //
  // Display: ♨ ×1.05 ... ×1.30 (clamped at 6 stacks). The perk's icon ♨
  // matches the perk-card glyph at content.js:4397.
  //
  // Gates: perk owned + active timer (mirrors the LAST_STAND pattern from
  // PRs #276/#278). Defensive `player.perks &&` null-check matches the
  // codebase pattern. Streak gate (> 0) is technically redundant given
  // timer > 0 implies streak > 0 (both set together in takeDamage at
  // entities.js:1898-1900), but defends against a future regression that
  // sets the timer without incrementing the streak.
  if (player.perks && player.perks.HOT_HAND && player._hotHandTimer > 0
      && player._hotHandStreak > 0) {
    const stacks = Math.min(player._hotHandStreak | 0, 6);
    const mul = (1 + stacks * 0.05).toFixed(2);
    fx.push({ id: 'hot-hand', icon: '♨', label: '×' + mul, colour: '#ff5522' });
  }
  // MOMENTUM meta-upgrade — damage-bonus window after any kill. Set to 3s
  // on Enemy.die via NEON.behavior.onKillRefreshMomentum (entities.js
  // ~L2016), ticks down via NEON.behavior.tickMomentum in Player.update
  // (entities.js:12025). Bonus = +15% per level (max level 2 → +30%) and
  // is applied through computeOutgoingDmgMul at meta/behavior.js:42.
  //
  // Without an HUD indicator the buff fires invisibly: players see bigger
  // damage numbers right after a kill but have no signal that the bonus
  // is active, no countdown, and no level readout. Mirrors the LAST_STAND
  // and HOT_HAND patterns (timer-driven, .toFixed(1)+'s' label NOT used
  // here — see below).
  //
  // Display: ▶ ×N.NN where N.NN = (1 + 0.15 * level).toFixed(2). At
  // level 1: ×1.15. At level 2: ×1.30. Same multiplier-readout style as
  // HOT_HAND (PR #280) so the player learns "this badge = damage buff
  // multiplier" once and applies the convention everywhere.
  //
  // Gates (mirror HOT_HAND):
  //   player.metaFlags && metaFlags.momentum > 0 — defensive null-check
  //     on metaFlags (legacy player shapes may lack it) + level-owned
  //     gate (zero-level players don't see the badge).
  //   player._momentumTimer > 0 — the active-window gate.
  //
  // Cross-file desync defence (per stored memory 'HUD status fx', PR
  // #280): the +15% per-level rate (0.15) is defined in
  // meta/behavior.js:42. The HUD label uses a literal 0.15 — a future
  // re-tune in behavior.js would silently desync the readout. The
  // companion test (tests/momentum-hud.test.js) parses behavior.js and
  // asserts the literals match.
  if (player.metaFlags && (player.metaFlags.momentum | 0) > 0
      && (player._momentumTimer || 0) > 0) {
    const lv = player.metaFlags.momentum | 0;
    const mul = (1 + 0.15 * lv).toFixed(2);
    fx.push({ id: 'momentum', icon: '▶', label: '×' + mul, colour: '#ff8844' });
  }
  // OVERDRIVE perk — score-combo-driven damage buff. Perk piggybacks on the
  // existing combo system (combo.count auto-clears via COMBO_WINDOW=3s, so
  // no per-frame accumulator is introduced — see tests/overdrive.test.js
  // 'OVERDRIVE does not introduce a new player accumulator'). Bonus formula
  // at entities.js:11339-11343:
  //   if (c >= 2) bonus = Math.min(0.30, (c - 1) * 0.03)
  //   atk *= 1 + bonus
  // → +3% per combo level above 1, capped at +30% (combo 11+).
  //
  // Pre-PR there was NO HUD signal. The perk-card description ("Score combo
  // buffs damage") tells the player the bonus EXISTS but never reveals its
  // CURRENT magnitude — combo.count is HUD-visible (render.js:1041+1297) but
  // the OVERDRIVE multiplier it implies is invisible. Players learn the
  // formula by inference from damage numbers, which is the same UX gap that
  // PRs #276 (LAST_STAND), #280 (HOT_HAND), #282 (MOMENTUM), #284 (REGEN),
  // and #300 (RETRIBUTION) all closed for their respective buffs.
  //
  // Display: `❯ ×N.NN` — multiplier-readout style (matches HOT_HAND / MOMENTUM
  // PRs #280/#282). Range: combo 2 → ×1.03, combo 11+ → ×1.30 (cap). Icon ❯
  // and colour #ff00c8 match the perk-card glyph at content.js:4540 — so the
  // badge is visually identifiable as "the OVERDRIVE buff" the player picked.
  //
  // Gates:
  //   player.perks &&            — defensive null-check; legacy player shapes
  //                                may lack a .perks object (mirrors HOT_HAND
  //                                / MOMENTUM / RETRIBUTION pattern).
  //   player.perks.OVERDRIVE &&  — perk-ownership; non-owners never see badge.
  //   combo.count >= 2           — same active-bonus gate as the multiplier
  //                                site at entities.js:11340 — the predicate
  //                                MUST match the bonus site (a stale gate
  //                                would surface a phantom badge without a
  //                                live multiplier or vice versa). The
  //                                tests/overdrive-hud.test.js alignment test
  //                                strict-equals the badge gate against the
  //                                multiplier gate after normalisation, so a
  //                                future change on either side that breaks
  //                                the contract fails loudly.
  //
  // No defensive `typeof combo` guard: combo is module-scope const at
  // content.js:2626 (declared in this same file). entities.js needs the
  // `typeof combo !== 'undefined'` guard because it runs in a separate
  // script tag and combo is a cross-file global; here it is local.
  //
  // Cross-file desync defence (per stored memory 'HUD status fx' + PR #280
  // pattern): the per-step rate (0.03) and cap (0.30) are hard-coded in BOTH
  // entities.js (the multiplier) and the HUD label below. The companion test
  // tests/overdrive-hud.test.js extracts both literals from entities.js and
  // asserts the content.js label uses the same numeric values, so a future
  // re-tune (e.g. +5% per level, +50% cap) trips the test and forces both
  // sites to be updated in lockstep.
  if (player.perks && player.perks.OVERDRIVE && combo.count >= 2) {
    const c = combo.count;
    const mul = (1 + Math.min(0.30, (c - 1) * 0.03)).toFixed(2);
    fx.push({ id: 'overdrive', icon: '❯', label: '×' + mul, colour: '#ff00c8' });
  }
  // SURGE meta-upgrade — counter for "every 8th shot deals +100% damage"
  // (meta/upgrades.js:36, maxLevel 1). Counter mutated in
  // consumeSurgeShot at meta/behavior.js:51-59 — increments on EVERY
  // shot (not every hit), fires multiplier (1 + 1.0 * surgeLv) when
  // count % 8 === 0. Pre-PR there was NO HUD signal — players had no
  // way to anticipate the next surge shot, leading to wasted surges
  // on weak/missed shots.
  //
  // Display: ⊙ N/8 where N = _surgeShotCount % 8. Same convention as
  // floor-modifier counter HUD (OVERCHARGE/WINDFALL/SIGNAL_BOOST/REVERB
  // all show N/5). After surge fires the count rolls to 0/8; at 7/8 the
  // next shot will surge.
  //
  // Gates: metaFlags-ownership only. The counter ticks unconditionally
  // (every shot, regardless of ownership), so a level-zero player has
  // _surgeShotCount > 0 but no badge. This means the moment they pick
  // up the surge upgrade mid-run, the badge appears immediately at the
  // current count progress — no "warmup" required to display.
  //
  // Cross-file desync defence (per stored memory 'HUD status fx', PRs
  // #280/#282/#284): the modulo period (8) is hard-coded in BOTH the
  // HUD label (content.js) AND the surge-firing gate (meta/behavior.js
  // :55). The companion test parses behavior.js and asserts the
  // content.js HUD literal matches.
  if (player.metaFlags && (player.metaFlags.surge | 0) > 0) {
    const cnt = (player._surgeShotCount | 0) % 8;
    fx.push({ id: 'surge', icon: '⊙', label: cnt + '/8', colour: '#ffcc44' });
  }
  // Augment count
  const augCount = Object.keys(player.augments || {}).length;
  if (augCount > 0) {
    fx.push({ id: 'augments', icon: '◆', label: augCount + '/' + MAX_AUGMENTS, colour: '#cc44ff' });
  }
  // Adrenaline Injector speed buff active
  if (player.adrenalineTimer > 0) {
    fx.push({ id: 'adr-buff', icon: '💉', label: player.adrenalineTimer.toFixed(1)+'s', colour: '#ff4444' });
  }
  // Reactive Armor cooldown
  if (hasAugment('REACTIVE_ARMOR') && player.reactiveArmorCD > 0) {
    fx.push({ id: 'reactive-cd', icon: '💥', label: Math.ceil(player.reactiveArmorCD)+'s', colour: '#993322' });
  }
  // LAST_STAND clutch window active — perk has a 5s window where the player
  // takes 50% damage AND deals 75% extra damage (entities.js:11326 + :11536).
  // Without an HUD indicator the window fires invisibly: players see their
  // HP survive a hit they expected to die from, then die on the next hit
  // because they didn't know to press the advantage. Mirrors the
  // adrenalineTimer pattern (timer-driven, seconds-remaining label, icon-
  // and-colour signature). Only the ACTIVE window is surfaced in this PR
  // — the 60s post-window cooldown could be added in a follow-up; this PR
  // closes the immediate "invisible buff" UX gap. Defensive `player.perks`
  // null-check matches the codebase pattern for nullable nested fields.
  if (player.perks && player.perks.LAST_STAND && player.lastStandTimer > 0) {
    fx.push({ id: 'last-stand', icon: '✦', label: player.lastStandTimer.toFixed(1)+'s', colour: '#ffaa00' });
  } else if (player.perks && player.perks.LAST_STAND && player.lastStandCD > 0) {
    // LAST_STAND post-window cooldown — perk owned but on the 60s recharge
    // after a clutch trigger. Surfaces tactical info: at low HP, the player
    // needs to know whether the safety-net will fire on the next near-death
    // hit or not. Pre-this-PR (after PR #276) the active window was visible
    // but the recharge was invisible — players couldn't tell "ready vs
    // recharging" without remembering the last trigger time.
    //
    // ELSE-IF (not a second IF): mutually exclusive with the active-window
    // branch above. When the perk just triggered, BOTH lastStandTimer > 0
    // AND lastStandCD > 0 (entities.js:11529-11530 sets both simultaneously).
    // Showing both badges would be HUD noise; the active window takes
    // priority because it's the more actionable state.
    //
    // Math.ceil over toFixed(1): the 60s cooldown is too long for sub-second
    // precision to feel meaningful (matches reactive-cd's pattern at
    // content.js:2358). Players want a coarse "how long until ready"
    // readout, not a 0.1s ticker.
    //
    // Dim amber colour (#886622) distinguishes from the bright #ffaa00
    // active-window colour — same icon ✦ keeps the visual identity, the
    // saturation tells the state.
    fx.push({ id: 'last-stand-cd', icon: '✦', label: Math.ceil(player.lastStandCD)+'s', colour: '#886622' });
  }
  // RETRIBUTION clutch window active — perk gives +50% outgoing damage for
  // 3s after taking damage (entities.js:11349 multiplier; trigger at
  // entities.js:11568 sets retributionTimer = 3 inside takeDamage when actual
  // damage > 0). Without an HUD indicator the buff fires invisibly: players
  // see damage numbers tick up after a hit-trade but have no signal that the
  // window is active and no countdown until expiry. Mirrors the
  // adrenalineTimer / lastStandTimer pattern (timer-driven, .toFixed(1)+'s'
  // label, perk-gated) — RETRIBUTION's 3s window is the same scale as
  // LAST_STAND's 5s clutch window so the same display format applies.
  //
  // Display: ☄ N.Ns — icon ☄ matches the perk-card glyph at content.js:4512;
  // colour #ff2266 matches the perk-card colour exactly so the badge ties
  // visually to the perk it represents (mirrors LAST_STAND's ✦ icon match).
  //
  // Gates: perk owned + active timer. Defensive `player.perks &&` null-check
  // matches the codebase pattern for nullable nested fields. Timer > 0 is
  // the active-window predicate (mirrors entities.js:11349's multiplier
  // gate exactly, so the badge appears iff the bonus is being applied).
  //
  // Cross-file alignment: the perk-card colour at content.js:4512 ('#ff2266')
  // and the multiplier at entities.js:11349 (×1.5) are the source of truth.
  // The badge intentionally does NOT show the multiplier in the label —
  // RETRIBUTION's bonus is fixed at +50% regardless of stacks/state, so
  // showing a static "×1.50" every tick would be informational redundancy.
  // The countdown is the actionable signal; the icon+colour identify the
  // buff type at a glance.
  if (player.perks && player.perks.RETRIBUTION && player.retributionTimer > 0) {
    fx.push({ id: 'retribution', icon: '☄', label: player.retributionTimer.toFixed(1)+'s', colour: '#ff2266' });
  }
  // GLASS_CANNON active — passive +30% ATK / +25% incoming damage trade.
  // Pre-PR there was NO HUD signal of the trade. Players took 25% extra
  // direct damage with no visual cue that GLASS_CANNON was the cause —
  // same "invisible always-on perk" UX gap that PRs #276 (LAST_STAND),
  // #280 (HOT_HAND), #282 (MOMENTUM), #284 (REGEN), #300 (RETRIBUTION),
  // #302 (OVERDRIVE), #304 (DEADEYE charging), and #318 (BULWARK) all
  // closed for their respective buffs/debuffs.
  //
  // Gate predicate is pure perk-ownership: GLASS_CANNON has no state
  // (no timer, no stacks, no HP threshold) — owning the perk IS the
  // active condition. The gate matches the offensive multiplier site
  // at entities.js:11661 EXACTLY (after defensive `player.perks &&`
  // short-circuit + receiver normalisation). The defensive-cost site
  // at entities.js:11838 has an additional `!options.ignoreDefense`
  // conjunct (env-DoT-damage-gate, see that block's comment) — that
  // is intentionally NOT mirrored in the badge gate because the
  // badge represents "you OWN the perk", not "you are CURRENTLY
  // taking direct damage". The cross-file alignment test asserts
  // both: (a) badge ≡ offensive site, (b) defensive-site delta is
  // exactly the env-DoT exemption clause.
  //
  // Defensive `player.perks &&` short-circuit: legacy player shapes
  // (test sandboxes, save migrations) may bypass the ctor and lack
  // a .perks object. The earlier ENERGY_SHIELD branch at
  // content.js:2292 unguarded-derefs player.perks, so a real call
  // without .perks already crashes before reaching this gate — the
  // guard here is defense-in-depth (per PR #300/#302/#304/#318
  // reviewer convention for new HUD badges).
  //
  // Icon ⟁ matches the perk-card glyph at content.js:4718; colour
  // #ff66aa matches the perk-card colour exactly (cross-file desync
  // defence per stored memory 'HUD status fx'). Label 'GLASS' mirrors
  // the action-word style of PRISTINE 'PRIME' / BERSERKER 'RAGE' /
  // BULWARK 'WARD' (single short noun) and echoes the perk name so
  // the badge is visually identifiable as GLASS_CANNON-the-perk.
  if (player.perks && player.perks.GLASS_CANNON) {
    fx.push({ id: 'glass-cannon', icon: '⟁', label: 'GLASS', colour: '#ff66aa' });
  }
  // Disruption field debuff
  if (player.disruptionFieldActive) {
    fx.push({ id: 'disrupted', icon: '⊘', label: 'DISRUPTED', colour: '#ff44aa' });
  }
  // Toxic pool slow debuff — 30% movement penalty while standing in toxic.
  // Mirrors the disruption-field treatment so both ground-hazard slows are
  // visible to the player. Suppressed during dash since the slow is bypassed.
  // Use the exact same predicate as the movement gate (entities.js:8362
  // `dashTimer <= 0`) so the HUD never lies about whether the slow is live —
  // `!(x > 0)` and `x <= 0` diverge for NaN/undefined dashTimer.
  if (player.toxicSlowActive && player.dashTimer <= 0) {
    fx.push({ id: 'toxic-slow', icon: '☣', label: 'TOXIC', colour: '#88ff44' });
  }
  // Holo Decoy active
  if (hackwareEffects.some(f => f.type === 'hologram')) {
    const holo = hackwareEffects.find(f => f.type === 'hologram');
    fx.push({ id: 'holo-active', icon: '⬡', label: (holo.maxAge - holo.age).toFixed(1)+'s', colour: '#ff44ff' });
  }
  return fx;
}

/**
 * @param {any} player
 */
function drawStatusBar(player) {
  const effects = getStatusEffects(player);

  // Update statusFx state: fade in active, fade out inactive, cache render data
  const activeIds = new Set(effects.map(f => f.id));
  for (const fx of effects) {
    if (!statusFx[fx.id]) statusFx[fx.id] = { alpha: 0 };
    statusFx[fx.id].alpha = Math.min(1, statusFx[fx.id].alpha + 0.08);
    statusFx[fx.id].icon = fx.icon;
    statusFx[fx.id].label = fx.label;
    statusFx[fx.id].colour = fx.colour;
  }
  for (const id in statusFx) {
    if (!activeIds.has(id)) {
      statusFx[id].alpha = Math.max(0, statusFx[id].alpha - 0.08);
      if (statusFx[id].alpha <= 0) { delete statusFx[id]; continue; }
    }
  }

  const ids = Object.keys(statusFx);
  if (ids.length === 0) return;

  const hasKeys = player.keys.red + player.keys.blue + player.keys.gold > 0;
  // Vertical anchor for the badge row, sitting ABOVE the HUD bar.
  // The hasKeys offset (32) and no-keys offset (16) both scale with
  // `settings.textScale` so this row tracks the corresponding key
  // indicator row in render.js drawHUD (which scales its font 12 +
  // gap-above-HUD 18 + stride 55 by the same setting). Without this
  // proportional scaling, at textScale 1.3× the larger key text
  // baseline rises into the badge bottom edge — caught by gpt-5.3-codex
  // adversarial review of this PR.
  // Floors keep the no-keys case from collapsing into the HUD at 0.85×
  // (12) and the hasKeys case from collapsing into the keys row (24).
  const badgeYOffset = hasKeys
    ? Math.max(24, Math.round(32 * settings.textScale))
    : Math.max(12, Math.round(16 * settings.textScale));
  const y = layout.hudTop - badgeYOffset;
  // Settings-scaled font size. `settings.textScale` is one of
  // TEXT_SCALE_STEPS (0.85 / 1.0 / 1.15 / 1.3); the badge height/width
  // both derive from `fs` (height = fs+6, width = measureText+8) so
  // scaling the font naturally rescales the whole badge box.
  const fs = Math.max(6, Math.round((layout.compact ? 8 : 9) * settings.textScale));
  // Reserve room for the corner minimap. The minimap is also
  // settings-scaled (`settings.minimapScale`); `Math.round(120 * scale)`
  // matches the MW formula in render.js drawMinimap so the badge strip
  // never overlaps the bigger minimap when the player scales it up.
  const minimapReserve = Math.round(120 * settings.minimapScale) + 10;
  const maxX = W - minimapReserve - safeRight; // stop before minimap area
  let x = 14 + safeLeft;

  ctx.save();
  ctx.font = `${fs}px monospace`;

  for (const id of ids) {
    const s = statusFx[id];
    if (s.alpha <= 0) continue;
    const text = s.icon + (s.label ? ' ' + s.label : '');
    const tw = ctx.measureText(text).width;
    const badgeW = tw + 8;
    const badgeH = fs + 6;

    if (x + badgeW > maxX) break; // prevent overflow into minimap

    ctx.globalAlpha = s.alpha * 0.7;
    ctx.fillStyle = 'rgba(10,10,18,0.7)';
    ctx.fillRect(x, y - badgeH + 2, badgeW, badgeH);

    ctx.globalAlpha = s.alpha;
    ctx.shadowBlur = 4; ctx.shadowColor = s.colour;
    ctx.fillStyle = s.colour;
    ctx.fillText(text, x + 4, y);
    ctx.shadowBlur = 0;

    x += badgeW + 4;
  }

  ctx.restore();
}

// ─── Combo / Kill-Streak ─────────────────────────────────────────────────────
const combo = { count: 0, timer: 0, best: 0, flashTimer: 0 };
const COMBO_WINDOW    = 3;     // seconds between kills to maintain streak
const COMBO_STEP      = 0.25;  // multiplier increment per kill beyond first
const COMBO_MAX_MULT  = 4;     // hard cap on multiplier
const COMBO_BOSS_CAP  = 2;     // separate lower cap for boss kills
function comboMultiplier() {
  return combo.count < 2 ? 1 : Math.min(COMBO_MAX_MULT, 1 + (combo.count - 1) * COMBO_STEP);
}
function comboBossMultiplier() {
  return Math.min(COMBO_BOSS_CAP, comboMultiplier());
}
function comboColour() {
  const c = combo.count;
  if (c >= 11) return '#ff00c8';  // magenta
  if (c >= 8)  return '#ff6622';  // orange
  if (c >= 5)  return '#ffb700';  // yellow
  return '#00f5ff';               // cyan
}
/**
 * @param {any} isBoss
 */
function registerKill(isBoss) {
  combo.count++;
  combo.timer = COMBO_WINDOW;
  combo.flashTimer = 0.3;
  if (combo.count > combo.best) combo.best = combo.count;
  if (combo.count >= 2) audio.comboTick(combo.count);
  // milestone floating text at kill position
  if (combo.count === 5 || combo.count === 10 || combo.count === 15 || combo.count === 20) {
    const p = _CG.player;
    spawnDmgText(p.x, p.y - 0.5, `×${combo.count} COMBO!`, comboColour());
  }
}
/**
 * @param {any} dt
 */
function updateCombo(dt) {
  if (combo.count < 1) return;
  combo.timer -= dt;
  combo.flashTimer = Math.max(0, combo.flashTimer - dt);
  if (combo.timer <= 0) { combo.count = 0; combo.timer = 0; }
}

// ─── Dungeon Generator ───────────────────────────────────────────────────────
/** @returns {any} */
function createMap() {
  return dungeonTopology.createMap(MAP_W, MAP_H, T.WALL);
}

/**
 * @param {any} map
 * @param {any} x
 * @param {any} y
 * @param {any} w
 * @param {any} h
 * @param {any} tile
 */
function carveRect(map, x, y, w, h, tile) {
  dungeonTopology.carveRect(map, x, y, w, h, tile);
}

/**
 * @param {any} map
 * @param {any} x1
 * @param {any} y1
 * @param {any} x2
 * @param {any} y2
 */
function carveCorridor(map, x1, y1, x2, y2) {
  dungeonTopology.carveCorridor(map, x1, y1, x2, y2, T.FLOOR);
}

/**
 * @param {any} rooms
 * @param {any} startRoom
 * @param {any} map
 */
function bfsRooms(rooms, startRoom, map) {
  return dungeonTopology.bfsRooms(rooms, startRoom, (/** @type {any} */ cur, /** @type {any} */ other) =>
    hasLOS(cur.cx, cur.cy, other.cx, other.cy, map) ||
    dist2(cur.cx, cur.cy, other.cx, other.cy) < 400
  );
}

/**
 * @param {number[][]} map
 * @param {any[]} rooms
 * @param {{x:number,y:number}|null|undefined} preferred
 * @returns {{pos:{x:number,y:number}, room:any}|null}
 */
function resolvePreferredSpawnRoom(map, rooms, preferred) {
  if (!preferred || !map || !rooms || !rooms.length) return null;
  const h = map.length;
  const w = map[0] ? map[0].length : 0;
  if (!h || !w) return null;
  const sx = Math.max(0, Math.min(w - 1, Math.floor(preferred.x)));
  const sy = Math.max(0, Math.min(h - 1, Math.floor(preferred.y)));
  const visited = new Set();
  /** @type {{x:number,y:number,d:number}[]} */
  const q = [{ x: sx, y: sy, d: 0 }];
  visited.add(sy * w + sx);
  while (q.length) {
    const cur = q.shift();
    if (!cur || cur.d > 12) continue;
    const tile = map[cur.y]?.[cur.x];
    if (isPassable(tile)) {
      const pos = { x: cur.x + 0.5, y: cur.y + 0.5 };
      const room = rooms.find((/** @type {any} */ r) =>
        pos.x >= r.x && pos.x < r.x + r.w && pos.y >= r.y && pos.y < r.y + r.h
      );
      if (room) return { pos, room };
    }
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      if (!dir) continue;
      const nx = cur.x + (dir[0] || 0), ny = cur.y + (dir[1] || 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const key = ny * w + nx;
      if (visited.has(key)) continue;
      visited.add(key);
      q.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }
  return null;
}

/**
 * @param {any} floorNum
 * @param {{previousExitPos?: {x:number,y:number}|null}} [opts]
 */
function generateFloor(floorNum, opts) {
  const bsp = dungeonTopology.createBspDungeon({
    width: MAP_W,
    height: MAP_H,
    depth: 5,
    wallTile: T.WALL,
    floorTile: T.FLOOR,
    rand: () => rand('world'),
    rndInt,
  });
  const map = bsp.map;
  const rooms = bsp.rooms;

  // Pick spawn room — try several candidates and pick the one that maximizes
  // BFS distance to the farthest room (ensures exit is far from spawn).
  let spawnRoom = rooms[0];
  if (rooms.length > 3) {
    const candidates = [];
    for (let ci = 0; ci < Math.min(rooms.length, 6); ci++) candidates.push(rooms[ci]);
    // Also try a random room for variety
    candidates.push(rooms[rndInt(0, rooms.length - 1)]);
    let bestMaxD = 0;
    for (const c of candidates) {
      const cd = bfsRooms(rooms, c, map);
      let cMax = 0;
      for (const [,dd] of cd) { if (dd > cMax) cMax = dd; }
      if (cMax > bestMaxD) { bestMaxD = cMax; spawnRoom = c; }
    }
  }
  const defaultSpawnRoom = spawnRoom;
  let playerPos = { x: spawnRoom.cx + 0.5, y: spawnRoom.cy + 0.5 };
  const preferredSpawn = resolvePreferredSpawnRoom(map, rooms, opts && opts.previousExitPos);
  if (preferredSpawn) {
    spawnRoom = preferredSpawn.room;
    playerPos = preferredSpawn.pos;
  }

  // Furthest room from spawn for stairs
  let dist = bfsRooms(rooms, spawnRoom, map);
  let farthest = spawnRoom, farthestD = 0;
  for (const [r,d] of dist) {
    if (preferredSpawn && r === defaultSpawnRoom) continue;
    if (preferredSpawn && r === spawnRoom) continue;
    if (d>farthestD) { farthestD=d; farthest=r; }
  }
  if (preferredSpawn && farthest === spawnRoom) {
    let bestRoom = null;
    let bestScore = -1;
    for (const r of rooms) {
      if (!r || r === spawnRoom || r === defaultSpawnRoom || r.roomType) continue;
      const score = Math.abs(r.cx - spawnRoom.cx) + Math.abs(r.cy - spawnRoom.cy);
      if (score > bestScore) { bestScore = score; bestRoom = r; }
    }
    if (bestRoom) farthest = bestRoom;
  }
  const _finalFloor = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.finalFloor) ? NEON.biomes.finalFloor() : 15;
  const _isBossFloor = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.isBiomeBossFloor) ? NEON.biomes.isBiomeBossFloor(floorNum) : (floorNum===3||floorNum===6||floorNum===10);

  /** @type {any} */
  let mainframeRoom = null;
  if (floorNum >= _finalFloor) {
    const MAINFRAME_MIN_W = 18;
    const MAINFRAME_MIN_H = 10;
    const originalFarthest = farthest;
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {any} ignoredRoom
     */
    const overlapsOtherRoom = (x, y, w, h, ignoredRoom) => {
      const ox1 = x - 1, oy1 = y - 1, ox2 = x + w + 1, oy2 = y + h + 1;
      for (const r of rooms) {
        if (r === ignoredRoom) continue;
        const rx1 = r.x, ry1 = r.y, rx2 = r.x + r.w, ry2 = r.y + r.h;
        if (ox1 < rx2 && ox2 > rx1 && oy1 < ry2 && oy2 > ry1) return true;
      }
      return false;
    };
    /**
     * @param {any} room
     */
    const findMainframeRectForRoom = (room) => {
      const w = Math.max(room.w, MAINFRAME_MIN_W);
      const h = Math.max(room.h, MAINFRAME_MIN_H);
      const desiredX = Math.max(1, Math.min(MAP_W - w - 1, room.cx - Math.floor(w / 2)));
      const desiredY = Math.max(1, Math.min(MAP_H - h - 1, room.cy - Math.floor(h / 2)));
      const xMin = Math.max(1, room.cx - w + 1);
      const xMax = Math.min(room.cx, MAP_W - w - 1);
      const yMin = Math.max(1, room.cy - h + 1);
      const yMax = Math.min(room.cy, MAP_H - h - 1);
      let best = null;
      let bestScore = Infinity;
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          if (overlapsOtherRoom(x, y, w, h, room)) continue;
          const score = Math.abs(x - desiredX) + Math.abs(y - desiredY);
          if (score < bestScore) { bestScore = score; best = { x, y, w, h }; }
        }
      }
      return best;
    };
    const mainframeCandidates = [...rooms]
      .filter((/** @type {any} */ r) => r !== spawnRoom)
      .sort((/** @type {any} */ a, /** @type {any} */ b) => (dist.get(b) || 0) - (dist.get(a) || 0));
    let rect = null;
    for (const r of mainframeCandidates) {
      rect = findMainframeRectForRoom(r);
      if (rect) { mainframeRoom = r; break; }
    }
    if (!rect) {
      /** @type {{x:number,y:number,w:number,h:number}|null} */
      let best = null;
      let bestScore = Infinity;
      for (let x = 1; x <= MAP_W - MAINFRAME_MIN_W - 1; x++) {
        for (let y = 1; y <= MAP_H - MAINFRAME_MIN_H - 1; y++) {
          if (overlapsOtherRoom(x, y, MAINFRAME_MIN_W, MAINFRAME_MIN_H, null)) continue;
          const cx = Math.floor(x + MAINFRAME_MIN_W / 2);
          const cy = Math.floor(y + MAINFRAME_MIN_H / 2);
          const score = Math.abs(cx - originalFarthest.cx) + Math.abs(cy - originalFarthest.cy);
          if (score < bestScore) { bestScore = score; best = { x, y, w: MAINFRAME_MIN_W, h: MAINFRAME_MIN_H }; }
        }
      }
      if (!best) {
        for (let x = 1; x <= MAP_W - MAINFRAME_MIN_W - 1; x++) {
          for (let y = 1; y <= MAP_H - MAINFRAME_MIN_H - 1; y++) {
            const sx1 = spawnRoom.x - 1, sy1 = spawnRoom.y - 1, sx2 = spawnRoom.x + spawnRoom.w + 1, sy2 = spawnRoom.y + spawnRoom.h + 1;
            if (x < sx2 && x + MAINFRAME_MIN_W > sx1 && y < sy2 && y + MAINFRAME_MIN_H > sy1) continue;
            const cx = Math.floor(x + MAINFRAME_MIN_W / 2);
            const cy = Math.floor(y + MAINFRAME_MIN_H / 2);
            let overlapPenalty = 0;
            for (const r of rooms) {
              if (r === spawnRoom) continue;
              const ox = Math.max(0, Math.min(x + MAINFRAME_MIN_W + 1, r.x + r.w) - Math.max(x - 1, r.x));
              const oy = Math.max(0, Math.min(y + MAINFRAME_MIN_H + 1, r.y + r.h) - Math.max(y - 1, r.y));
              overlapPenalty += ox * oy;
            }
            const score = overlapPenalty * 1000 + Math.abs(cx - originalFarthest.cx) + Math.abs(cy - originalFarthest.cy);
            if (score < bestScore) { bestScore = score; best = { x, y, w: MAINFRAME_MIN_W, h: MAINFRAME_MIN_H }; }
          }
        }
        if (best) {
          for (let i = rooms.length - 1; i >= 0; i--) {
            const r = rooms[i];
            if (r === spawnRoom) continue;
            const ox = Math.max(0, Math.min(best.x + best.w + 1, r.x + r.w) - Math.max(best.x - 1, r.x));
            const oy = Math.max(0, Math.min(best.y + best.h + 1, r.y + r.h) - Math.max(best.y - 1, r.y));
            if (ox * oy > 0) rooms.splice(i, 1);
          }
        }
      }
      rect = best || { x: 1, y: 1, w: MAINFRAME_MIN_W, h: MAINFRAME_MIN_H };
      mainframeRoom = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, cx: Math.floor(rect.x + rect.w / 2), cy: Math.floor(rect.y + rect.h / 2), roomType: 'mainframe' };
      rooms.push(mainframeRoom);
      carveCorridor(map, originalFarthest.cx, originalFarthest.cy, mainframeRoom.cx, mainframeRoom.cy);
    }
    farthest = mainframeRoom;
    mainframeRoom.roomType = 'mainframe';
    mainframeRoom.x = rect.x; mainframeRoom.y = rect.y; mainframeRoom.w = rect.w; mainframeRoom.h = rect.h;
    mainframeRoom.cx = Math.floor(rect.x + rect.w / 2); mainframeRoom.cy = Math.floor(rect.y + rect.h / 2);
    carveRect(map, rect.x, rect.y, rect.w, rect.h, T.FLOOR);
    const cy = mainframeRoom.cy;
    const reader = { x: mainframeRoom.x + 3, y: cy };
    const portal = { x: mainframeRoom.cx, y: cy };
    const consoleTile = { x: mainframeRoom.x + mainframeRoom.w - 4, y: cy };
    const core = { x: mainframeRoom.cx, y: Math.min(mainframeRoom.y + mainframeRoom.h - 3, cy + 3) };
    map[reader.y][reader.x] = T.MAINFRAME_READER;
    map[portal.y][portal.x] = T.NETWORK_PORTAL;
    map[consoleTile.y][consoleTile.x] = T.MESSAGE_CONSOLE;
    map[core.y][core.x] = T.TERMINAL;
    mainframeRoom.interactables = { reader, portal, console: consoleTile, core };
    dist = bfsRooms(rooms, spawnRoom, map);
  } else {
    map[farthest.cy][farthest.cx] = T.STAIRS;
  }

  // boss room on biome-final floors (3,6,9,12,15 for the 5-biome arc)
  /** @type {any} */ let bossRoom = null;
  /** @type {any[]} */ let bossEntrances = [];
  if (_isBossFloor) {
    // use the room furthest from spawn that isn't the stair room
    let br = null, bd = 0;
    for (const [r,d] of dist) {
      if (r===farthest) continue;
      if (d>bd) { bd=d; br=r; }
    }
    bossRoom = br || rooms[Math.floor(rooms.length/2)];

    // Enforce minimum boss room size (15×15) by expanding if needed
    const MIN_BOSS = 15;
    if (bossRoom.w < MIN_BOSS || bossRoom.h < MIN_BOSS) {
      const nw = Math.max(bossRoom.w, MIN_BOSS);
      const nh = Math.max(bossRoom.h, MIN_BOSS);
      const desiredX = Math.max(1, Math.min(MAP_W - nw - 1, bossRoom.cx - Math.floor(nw/2)));
      const desiredY = Math.max(1, Math.min(MAP_H - nh - 1, bossRoom.cy - Math.floor(nh/2)));
      const xMin = Math.max(1, bossRoom.cx - nw + 1);
      const xMax = Math.min(bossRoom.cx, MAP_W - nw - 1);
      const yMin = Math.max(1, bossRoom.cy - nh + 1);
      const yMax = Math.min(bossRoom.cy, MAP_H - nh - 1);
      /** @type {{x:number,y:number}|null} */
      let bossRect = null;
      let bestScore = Infinity;
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          const ox1 = x - 1, oy1 = y - 1, ox2 = x + nw + 1, oy2 = y + nh + 1;
          let blocked = false;
          for (const r of rooms) {
            if (r === bossRoom) continue;
            const rx1 = r.x, ry1 = r.y, rx2 = r.x + r.w, ry2 = r.y + r.h;
            if (ox1 < rx2 && ox2 > rx1 && oy1 < ry2 && oy2 > ry1) { blocked = true; break; }
          }
          if (blocked) continue;
          const score = Math.abs(x - desiredX) + Math.abs(y - desiredY);
          if (score < bestScore) { bestScore = score; bossRect = { x, y }; }
        }
      }
      if (bossRect) {
        const nx = bossRect.x;
        const ny = bossRect.y;
        bossRoom.x = nx; bossRoom.y = ny; bossRoom.w = nw; bossRoom.h = nh;
        bossRoom.cx = Math.floor(nx + nw/2); bossRoom.cy = Math.floor(ny + nh/2);
        carveRect(map, nx, ny, nw, nh, T.FLOOR);
        // re-carve corridors to this room from neighbours, never through the mainframe.
        for (const r of rooms) {
          if (r === bossRoom || r.roomType === 'mainframe') continue;
          const dx = Math.abs(r.cx - bossRoom.cx), dy = Math.abs(r.cy - bossRoom.cy);
          if (dx < 20 && dy < 20) carveCorridor(map, r.cx, r.cy, bossRoom.cx, bossRoom.cy);
        }
      }
      // Re-place stairs/terminal in case expansion overwrote it.
      if (floorNum >= _finalFloor && farthest.interactables && farthest.interactables.core) {
        const core = farthest.interactables.core;
        map[core.y][core.x] = T.TERMINAL;
      } else {
        map[farthest.cy][farthest.cx] = T.STAIRS;
      }
    }

    // Record entrance tiles: floor tiles on the boss room boundary that
    // connect to a CORRIDOR tile (not the interior of another adjacent
    // room). Without the corridor check, when the boss room shares a
    // boundary with another room (no carved-corridor gap between them),
    // every shared boundary tile would be sealed to WALL on boss-spawn —
    // putting walls INSIDE the neighbouring room and trapping the player
    // against them (reported by user 2026-04-20 b95c0573: 'the fence that
    // surrounds a boss should not leave a room's boundary. It went into
    // another room and trapped me against a wall').
    //
    // Both the boundary tile AND its outside neighbour must NOT be inside
    // another room — boundary check catches overlapping-rect gen edge
    // cases (where the boundary tile itself is shared); outside check
    // catches abutting-rooms (most common case).
    const rx=bossRoom.x, ry=bossRoom.y, rw=bossRoom.w, rh=bossRoom.h;
    /** @param {number} px @param {number} py */
    const isInsideAnotherRoom = (px, py) => {
      for (const r of rooms) {
        if (r === bossRoom) continue;
        if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return true;
      }
      return false;
    };
    /** Filtered + safe scan — both edge tile and outside tile must be
     *  outside any other room. */
    const _scanFiltered = () => {
      /** @type {Array<{x:number,y:number}>} */
      const out = [];
      for (let tx=rx; tx<rx+rw; tx++) {
        if (ry>0 && map[ry][tx]===T.FLOOR && map[ry-1][tx]===T.FLOOR
            && !isInsideAnotherRoom(tx, ry) && !isInsideAnotherRoom(tx, ry-1))
          out.push({x:tx, y:ry});
        const by=ry+rh-1;
        if (by<MAP_H-1 && map[by][tx]===T.FLOOR && map[by+1][tx]===T.FLOOR
            && !isInsideAnotherRoom(tx, by) && !isInsideAnotherRoom(tx, by+1))
          out.push({x:tx, y:by});
      }
      for (let ty=ry; ty<ry+rh; ty++) {
        if (rx>0 && map[ty][rx]===T.FLOOR && map[ty][rx-1]===T.FLOOR
            && !isInsideAnotherRoom(rx, ty) && !isInsideAnotherRoom(rx-1, ty))
          out.push({x:rx, y:ty});
        const bx=rx+rw-1;
        if (bx<MAP_W-1 && map[ty][bx]===T.FLOOR && map[ty][bx+1]===T.FLOOR
            && !isInsideAnotherRoom(bx, ty) && !isInsideAnotherRoom(bx+1, ty))
          out.push({x:bx, y:ty});
      }
      return out;
    };
    /** Unfiltered fallback — original logic, keeps lock-arena mechanic
     *  working even in the degenerate case where the boss room only
     *  shares boundaries with other rooms (no corridor entrance). The
     *  re-carve loop at L2198-2202 makes this near-impossible in
     *  practice but the fallback is here for safety: the lesser evil
     *  is the original cosmetic bug (wall poking into neighbour) vs
     *  losing boss arena lockout entirely. */
    const _scanUnfiltered = () => {
      /** @type {Array<{x:number,y:number}>} */
      const out = [];
      for (let tx=rx; tx<rx+rw; tx++) {
        if (ry>0 && map[ry][tx]===T.FLOOR && map[ry-1][tx]===T.FLOOR) out.push({x:tx, y:ry});
        const by=ry+rh-1;
        if (by<MAP_H-1 && map[by][tx]===T.FLOOR && map[by+1][tx]===T.FLOOR) out.push({x:tx, y:by});
      }
      for (let ty=ry; ty<ry+rh; ty++) {
        if (rx>0 && map[ty][rx]===T.FLOOR && map[ty][rx-1]===T.FLOOR) out.push({x:rx, y:ty});
        const bx=rx+rw-1;
        if (bx<MAP_W-1 && map[ty][bx]===T.FLOOR && map[ty][bx+1]===T.FLOOR) out.push({x:bx, y:ty});
      }
      return out;
    };
    const filtered = _scanFiltered();
    const chosen = filtered.length > 0 ? filtered : _scanUnfiltered();
    for (const e of chosen) bossEntrances.push(e);
    // Deduplicate — corners scanned by both edge loops cause permanent seal bug
    const seen = new Set();
    bossEntrances = bossEntrances.filter(e => {
      const k = e.x + ',' + e.y;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  if (mainframeRoom && mainframeRoom.interactables) {
    const { reader, portal, console: consoleTile, core } = mainframeRoom.interactables;
    carveRect(map, mainframeRoom.x, mainframeRoom.y, mainframeRoom.w, mainframeRoom.h, T.FLOOR);
    map[reader.y][reader.x] = T.MAINFRAME_READER;
    map[portal.y][portal.x] = T.NETWORK_PORTAL;
    map[consoleTile.y][consoleTile.x] = T.MESSAGE_CONSOLE;
    map[core.y][core.x] = T.TERMINAL;
  }

  // lights
  const lights = [];
  for (const r of rooms) {
    lights.push({x:r.x+1,y:r.y+1});
    lights.push({x:r.x+r.w-2,y:r.y+r.h-2});
  }

  // fog of war
  /** @type {any} */ const visited = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));
  /** @type {any} */ const light   = Array.from({length:MAP_H},()=>new Float32Array(MAP_W));
  /** @type {any} */ const visible = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));

  // ── Room types: assign special purposes ──────────────────────────────────
  // Types: null (normal), 'armory', 'medbay', 'shrine', 'vault'
  const ROOM_TYPES = ['armory','medbay','shrine','vault'];
  /** @type {Record<string, any>} */ const ROOM_COLOURS = {armory:'#2a1a10',medbay:'#0a1a15',shrine:'#1a0a20',vault:'#1a1a05',vendor:'#0a1a0f',secret:'#1a1005',challenge:'#1a0a0a',implant:'#0f0a1a',event:'#0a1a1a',mainframe:'#081828'};
  /** @type {any[]} */ const specialRooms = [];
  const eligible = rooms.filter((/** @type {any} */ r) => r!==spawnRoom && r!==farthest && r!==bossRoom && r.w*r.h>=20);

  // ── Vendor room (floor 2+, one per non-boss floor) — reserved first ─────
  /** @type {any} */ let vendorRoom = null;
  if (floorNum >= 2 && !bossRoom) {
    const vendorEligible = eligible.filter((/** @type {any} */ r) => r.w >= 5 && r.h >= 5);
    if (vendorEligible.length > 0) {
      vendorRoom = vendorEligible[rndInt(0, vendorEligible.length - 1)];
      vendorRoom.roomType = 'vendor';
      specialRooms.push(vendorRoom);
      map[vendorRoom.cy][vendorRoom.cx] = T.VENDOR;
    }
  }

  // ── Special room rotation (excluding vendor room) ───────────────────────
  const specialEligible = eligible.filter((/** @type {any} */ r) => r !== vendorRoom);
  const numSpecial = Math.min(specialEligible.length, Math.floor(floorNum/2)+1);
  const picked = shuffleInPlace(specialEligible.slice(), 'world').slice(0,numSpecial);
  for (let i=0; i<picked.length; i++) {
    const r = picked[i];
    r.roomType = ROOM_TYPES[i % ROOM_TYPES.length];
    specialRooms.push(r);
  }

  // ── Doors: place at room-corridor junctions (chokepoints only) ──────────
  // Helper: find entrance clusters for a room (groups of adjacent boundary
  // tiles on the room wall line). Returns array of arrays.
  /**
   * @param {any} room
   * @returns {{x:number,y:number}[][]}
   */
  function getEntranceClusters(room) {
    const isOpenEntranceTile = (/** @type {any} */ t) => t === T.FLOOR || t === T.DOOR;
    return dungeonTopology.findBoundaryEntranceClusters(map, room, isOpenEntranceTile);
  }

  /**
   * @param {any[]} cluster
   * @returns {any}
   */
  function keepSingleEntranceTile(cluster) {
    const sorted = cluster.slice().sort((/** @type {any} */ a, /** @type {any} */ b) => (a.y - b.y) || (a.x - b.x));
    const keep = sorted[Math.floor(sorted.length / 2)];
    for (const e of sorted) {
      if (e !== keep) map[e.y][e.x] = T.WALL;
    }
    return keep;
  }

  /** @param {any} tile */
  function isDoorLikeEntranceTile(tile) {
    return tile === T.DOOR || tile === T.LOCKED_R || tile === T.LOCKED_B ||
      tile === T.LOCKED_G || tile === T.CHALLENGE_GATE || tile === T.CRACKED;
  }

  /** @param {number} x @param {number} y */
  function tileInsideAnyRoom(x, y) {
    return rooms.some((/** @type {any} */ r) => dungeonTopology.roomContainsPoint(r, x, y));
  }

  /** @param {number} x @param {number} y */
  function tileOnRoomCorner(x, y) {
    return rooms.some((/** @type {any} */ r) => dungeonTopology.roomHasCorner(r, x, y));
  }

  /**
   * @param {any} room
   * @param {number} x
   * @param {number} y
   */
  function outsideFaceForBoundaryTile(room, x, y) {
    return dungeonTopology.outsideFaceForBoundaryTile(room, x, y);
  }

  /**
   * @param {any} room
   * @param {number} x
   * @param {number} y
   * @param {number} dx
   * @param {number} dy
   */
  function repairFormerEntranceSidePadding(room, x, y, dx, dy) {
    const px = dy === 0 ? 0 : 1;
    const py = dx === 0 ? 0 : 1;
    for (const sign of [-1, 1]) {
      const sx = x + px * sign;
      const sy = y + py * sign;
      if (sx < room.x || sx >= room.x + room.w || sy < room.y || sy >= room.y + room.h) continue;
      if ((sx === room.x || sx === room.x + room.w - 1) && (sy === room.y || sy === room.y + room.h - 1)) continue;
      if (map[sy]?.[sx] === T.WALL || map[sy]?.[sx] === T.VOID) map[sy][sx] = T.FLOOR;
    }
  }

  function normalizeEntranceTilesOutsideRooms() {
    /** @type {{fromX:number,fromY:number,toX:number,toY:number,tile:any}[]} */
    const moved = [];
    for (const room of rooms) {
      for (let tx = room.x + 1; tx < room.x + room.w - 1; tx++) {
        normalizeBoundaryEntrance(room, tx, room.y, moved);
        normalizeBoundaryEntrance(room, tx, room.y + room.h - 1, moved);
      }
      for (let ty = room.y + 1; ty < room.y + room.h - 1; ty++) {
        normalizeBoundaryEntrance(room, room.x, ty, moved);
        normalizeBoundaryEntrance(room, room.x + room.w - 1, ty, moved);
      }
    }
    return moved;
  }

  function repairOutsideEntranceRoomEdges() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        for (const room of rooms) {
          const neighbors = /** @type {{bx:number,by:number,dx:number,dy:number}[]} */ ([
            { bx: x, by: y - 1, dx: 0, dy: 1 },
            { bx: x, by: y + 1, dx: 0, dy: -1 },
            { bx: x - 1, by: y, dx: 1, dy: 0 },
            { bx: x + 1, by: y, dx: -1, dy: 0 },
          ]);
          for (const n of neighbors) {
            const outside = outsideFaceForBoundaryTile(room, n.bx, n.by);
            if (!outside || outside.x !== x || outside.y !== y) continue;
            repairFormerEntranceSidePadding(room, n.bx, n.by, n.dx, n.dy);
          }
        }
      }
    }
  }

  /** @param {number} x @param {number} y */
  function outsidePassageDegree(x, y) {
    let degree = 0;
    for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (tileInsideAnyRoom(nx, ny)) continue;
      const t = map[ny]?.[nx];
      if (t !== T.WALL && t !== T.VOID) degree++;
    }
    return degree;
  }

  /** @param {number} x @param {number} y */
  function adjacentDoorLikeEntranceCount(x, y) {
    let count = 0;
    for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
      if (isDoorLikeEntranceTile(map[y + dy]?.[x + dx])) count++;
    }
    return count;
  }

  /** @param {any} tile */
  function isReplaceableDoorEntranceTile(tile) {
    return tile === T.DOOR || tile === T.LOCKED_R || tile === T.LOCKED_B || tile === T.LOCKED_G;
  }

  /** @param {number} x @param {number} y */
  function outsideEntranceRoomSides(x, y) {
    /** @type {{dx:number,dy:number,bx:number,by:number}[]} */
    const roomSides = [];
    for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
      const bx = x + dx;
      const by = y + dy;
      if (tileOnRoomCorner(bx, by)) continue;
      if (rooms.some((/** @type {any} */ r) => {
        const outside = outsideFaceForBoundaryTile(r, bx, by);
        return outside?.x === x && outside?.y === y;
      })) roomSides.push({ dx, dy, bx, by });
    }
    return roomSides;
  }

  /** @param {number} x @param {number} y */
  function isOutsidePassageTile(x, y) {
    if (x <= 0 || y <= 0 || x >= MAP_W - 1 || y >= MAP_H - 1) return false;
    const t = map[y]?.[x];
    return !tileInsideAnyRoom(x, y) && t !== undefined && t !== null && t !== T.WALL && t !== T.VOID;
  }

  /** @param {number} x @param {number} y */
  function canCarveOutsidePassageTile(x, y) {
    if (x <= 0 || y <= 0 || x >= MAP_W - 1 || y >= MAP_H - 1 || tileInsideAnyRoom(x, y)) return false;
    return map[y]?.[x] === T.WALL || map[y]?.[x] === T.VOID;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} exceptX
   * @param {number} exceptY
   */
  function outsidePassageConnectionCount(x, y, exceptX, exceptY) {
    let degree = 0;
    for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx === exceptX && ny === exceptY) continue;
      if (isOutsidePassageTile(nx, ny)) degree++;
    }
    return degree;
  }

  /** @param {number} x @param {number} y @param {{dx:number,dy:number}} side */
  function hasConnectedPassageOppositeRoomSide(x, y, side) {
    const px = x - side.dx;
    const py = y - side.dy;
    return isOutsidePassageTile(px, py) && outsidePassageConnectionCount(px, py, x, y) > 0;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {{dx:number,dy:number}} side
   */
  function findAlignedOutsidePassageRepair(x, y, side) {
    const px = x - side.dx;
    const py = y - side.dy;
    if (outsidePassageConnectionCount(px, py, x, y) > 0) return { px, py, cx: -1, cy: -1 };
    if (!isOutsidePassageTile(px, py) && !canCarveOutsidePassageTile(px, py)) return null;
    for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
      if (dx * side.dx + dy * side.dy !== 0) continue;
      if (!isOutsidePassageTile(x + dx, y + dy)) continue;
      const cx = px + dx;
      const cy = py + dy;
      if (isOutsidePassageTile(cx, cy) || canCarveOutsidePassageTile(cx, cy)) return { px, py, cx, cy };
    }
    return null;
  }

  /** @param {number} x @param {number} y @param {{dx:number,dy:number}} side */
  function repairAlignedOutsideEntrancePassage(x, y, side) {
    const repair = findAlignedOutsidePassageRepair(x, y, side);
    if (!repair) return false;
    if (map[repair.py]?.[repair.px] === T.WALL || map[repair.py]?.[repair.px] === T.VOID) map[repair.py][repair.px] = T.FLOOR;
    if (repair.cx >= 0 && repair.cy >= 0 && (map[repair.cy]?.[repair.cx] === T.WALL || map[repair.cy]?.[repair.cx] === T.VOID)) {
      map[repair.cy][repair.cx] = T.FLOOR;
    }
    return outsidePassageConnectionCount(repair.px, repair.py, x, y) > 0;
  }

  /** @param {number} x @param {number} y */
  function hasAlignedOutsideEntrancePassage(x, y) {
    const roomSides = outsideEntranceRoomSides(x, y);
    if (roomSides.length === 2) {
      const a = roomSides[0];
      const b = roomSides[1];
      if (!a || !b) return false;
      return a.dx + b.dx === 0 && a.dy + b.dy === 0;
    }
    if (roomSides.length !== 1) return false;
    const side = roomSides[0];
    return !!side && hasConnectedPassageOppositeRoomSide(x, y, side);
  }

  function repairMisalignedOutsideEntrancePassages() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        const roomSides = outsideEntranceRoomSides(x, y);
        const side = roomSides[0];
        if (roomSides.length !== 1 || !side || hasConnectedPassageOppositeRoomSide(x, y, side)) continue;
        repairAlignedOutsideEntrancePassage(x, y, side);
      }
    }
  }

  function collapseAdjacentOutsideEntranceTilesToFloor() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        const adjacentBlocker = DUNGEON_CARDINAL_DIRECTIONS
          .some(([dx, dy]) => {
            const t = map[y + dy]?.[x + dx];
            return isDoorLikeEntranceTile(t) && t !== T.DOOR;
          });
        if (adjacentBlocker) map[y][x] = T.FLOOR;
      }
    }
    /** @type {Set<string>} */
    const visitedDoorTiles = new Set();
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        const key = x + ',' + y;
        if (visitedDoorTiles.has(key)) continue;
        const cluster = [{ x, y }];
        visitedDoorTiles.add(key);
        for (let qi = 0; qi < cluster.length; qi++) {
          const c = /** @type {any} */ (cluster[qi]);
          for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
            const nx = c.x + dx, ny = c.y + dy;
            const nk = nx + ',' + ny;
            if (visitedDoorTiles.has(nk) || !isDoorLikeEntranceTile(map[ny]?.[nx]) || tileInsideAnyRoom(nx, ny)) continue;
            visitedDoorTiles.add(nk);
            cluster.push({ x: nx, y: ny });
          }
        }
        if (cluster.length <= 1) continue;
        const sorted = cluster.slice().sort((/** @type {any} */ a, /** @type {any} */ b) => (a.y - b.y) || (a.x - b.x));
        const keep = sorted.find((/** @type {any} */ e) => map[e.y]?.[e.x] !== T.DOOR) || sorted[Math.floor(sorted.length / 2)];
        for (const e of cluster) {
          if (e === keep) continue;
          map[e.y][e.x] = T.FLOOR;
        }
      }
    }
  }

  function clearDeadOutsideEntranceTiles() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        const roomSides = outsideEntranceRoomSides(x, y);
        const side = roomSides[0];
        if (roomSides.length === 1 && side && !hasConnectedPassageOppositeRoomSide(x, y, side)) map[y][x] = T.FLOOR;
      }
    }
  }

  /** @param {any} room @param {any} tile */
  function roomHasRingTile(room, tile) {
    return !!findRingTile(room, tile);
  }

  /** @param {any} room @param {any} tile */
  function findRingTile(room, tile) {
    for (let y = Math.max(0, room.y - 1); y <= Math.min(MAP_H - 1, room.y + room.h); y++) {
      for (let x = Math.max(0, room.x - 1); x <= Math.min(MAP_W - 1, room.x + room.w); x++) {
        if (map[y]?.[x] === tile) return { x, y };
      }
    }
    return null;
  }

  /** @param {any} room @param {any} tile */
  function placeOutsideEntranceForRoom(room, tile) {
    /** @type {{bx:number,by:number,ox:number,oy:number,dx:number,dy:number,score:number}[]} */
    const candidates = [];
    /**
     * @param {number} bx
     * @param {number} by
     */
    const addCandidate = (bx, by) => {
      const outside = outsideFaceForBoundaryTile(room, bx, by);
      if (!outside || outside.x <= 0 || outside.y <= 0 || outside.x >= MAP_W - 1 || outside.y >= MAP_H - 1) return;
      if (tileInsideAnyRoom(outside.x, outside.y)) return;
      const outsideTile = map[outside.y]?.[outside.x];
      const replacingDoor = isReplaceableDoorEntranceTile(outsideTile);
      if (isDoorLikeEntranceTile(outsideTile) && !replacingDoor) return;
      if (adjacentDoorLikeEntranceCount(outside.x, outside.y) > 0) return;
      const roomSides = outsideEntranceRoomSides(outside.x, outside.y);
      const roomSideCount = roomSides.length;
      const passageDegree = outsidePassageDegree(outside.x, outside.y);
      let alignmentScore = 0;
      if (roomSideCount < 2) {
        const side = roomSides[0];
        const hasAlignedPassage = !!side && hasConnectedPassageOppositeRoomSide(outside.x, outside.y, side);
        const canRepairAlignedPassage = !!side && !!findAlignedOutsidePassageRepair(outside.x, outside.y, side);
        if (!hasAlignedPassage && !canRepairAlignedPassage) return;
        alignmentScore = hasAlignedPassage ? 20 : 5;
      }
      const score = alignmentScore + (outsideTile !== T.WALL && outsideTile !== T.VOID ? 10 : 0) + passageDegree + roomSideCount;
      candidates.push({ bx, by, ox: outside.x, oy: outside.y, dx: outside.dx, dy: outside.dy, score });
    };
    for (let tx = room.x + 1; tx < room.x + room.w - 1; tx++) {
      addCandidate(tx, room.y);
      addCandidate(tx, room.y + room.h - 1);
    }
    for (let ty = room.y + 1; ty < room.y + room.h - 1; ty++) {
      addCandidate(room.x, ty);
      addCandidate(room.x + room.w - 1, ty);
    }
    candidates.sort((a, b) => b.score - a.score);
    const picked = candidates[0];
    if (!picked) return null;
    map[picked.by][picked.bx] = T.FLOOR;
    map[picked.oy][picked.ox] = tile;
    const roomSides = outsideEntranceRoomSides(picked.ox, picked.oy);
    const side = roomSides[0];
    if (roomSides.length === 1 && side) repairAlignedOutsideEntrancePassage(picked.ox, picked.oy, side);
    repairFormerEntranceSidePadding(room, picked.bx, picked.by, picked.dx, picked.dy);
    return { x: picked.ox, y: picked.oy };
  }

  function ensureSpecialRoomEntrances() {
    if (challengeRoom) {
      for (let i = challengeEntrances.length - 1; i >= 0; i--) {
        const entry = challengeEntrances[i];
        if (!entry || map[entry.y]?.[entry.x] === T.CHALLENGE_GATE) continue;
        challengeEntrances.splice(i, 1);
      }
      if (challengeEntrances.length === 0) {
        const gate = findRingTile(challengeRoom, T.CHALLENGE_GATE) || placeOutsideEntranceForRoom(challengeRoom, T.CHALLENGE_GATE);
        if (gate) challengeEntrances.push(gate);
      }
    }
    for (const secret of secretRooms) {
      if (roomHasRingTile(secret, T.CRACKED)) continue;
      placeOutsideEntranceForRoom(secret, T.CRACKED);
    }
  }

  function removeKeysWithoutLiveLocks() {
    const hasLock = {
      red: false,
      blue: false,
      gold: false,
    };
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = map[y][x];
        if (tile === T.LOCKED_R) hasLock.red = true;
        else if (tile === T.LOCKED_B) hasLock.blue = true;
        else if (tile === T.LOCKED_G) hasLock.gold = true;
      }
    }
    for (let i = keyItems.length - 1; i >= 0; i--) {
      const key = keyItems[i];
      if (!key || hasLock[/** @type {'red'|'blue'|'gold'} */ (key.colour)]) continue;
      keyItems.splice(i, 1);
    }
  }

  const passable = (/** @type {any} */ t) =>
    t === T.FLOOR || t === T.DOOR || t === T.DOOR_OPEN ||
      t === T.STAIRS || t === T.TERMINAL ||
      t === T.TRAP_SPIKE || t === T.TRAP_SLOW || t === T.TOXIC ||
      t === T.PLASMA || t === T.ARC || t === T.SHOCK_TILE || t === T.REPULSOR ||
      t === T.CRACKED ||
      t === T.VENDOR || t === T.LORE || t === T.TELEPORT_PAD ||
      t === T.MAINFRAME_READER || t === T.NETWORK_PORTAL || t === T.MESSAGE_CONSOLE ||
      t === T.IMPLANT_SHRINE || t === T.EVENT_TERMINAL ||
      t === T.CHALLENGE_GATE;

  /** @param {any} t */
  function lockColourForTile(t) {
    return t === T.LOCKED_R ? 'red' : t === T.LOCKED_B ? 'blue' : t === T.LOCKED_G ? 'gold' : null;
  }

  /** @param {any} t */
  function keyPlacementOpenTile(t) {
    // Key-placement reach keeps cracked walls blocked; crates remain open as in the legacy BFS.
    return Number.isFinite(t) && t !== T.WALL && t !== T.VOID && t !== T.CRACKED && !lockColourForTile(t);
  }

  /**
   * @param {any[]} requiredRooms
   */
  function solveProgressionReachability(requiredRooms) {
    return dungeonReachability.solveKeyLockReachability({
      map,
      start: { x: spawnRoom.cx, y: spawnRoom.cy },
      keys: keyItems,
      requiredRooms,
      isOpenTile: passable,
      lockColourForTile,
    });
  }

  /** @param {Set<string>} haveColours */
  function computeKeyPlacementReach(haveColours) {
    const solved = dungeonReachability.solveKeyLockReachability({
      map,
      start: { x: spawnRoom.cx, y: spawnRoom.cy },
      keys: keyItems,
      isOpenTile: keyPlacementOpenTile,
      lockColourForTile,
    });
    return solved.computeReach(haveColours);
  }

  function repairPostRelocationLockReachability() {
    const lockTileForColour = { red: T.LOCKED_R, blue: T.LOCKED_B, gold: T.LOCKED_G };
    const solvedReach = solveProgressionReachability(rooms);
    if (solvedReach.unreachableRooms.length === 0) return;
    for (const colour of solvedReach.missingColours) {
      const lockTile = lockTileForColour[/** @type {'red'|'blue'|'gold'} */ (colour)];
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          if (map[y][x] === lockTile) map[y][x] = T.DOOR;
        }
      }
    }
  }

  /**
   * @param {any} room
   * @param {number} x
   * @param {number} y
   * @param {{fromX:number,fromY:number,toX:number,toY:number,tile:any}[]} moved
   */
  function normalizeBoundaryEntrance(room, x, y, moved) {
    const tile = map[y]?.[x];
    if (!isDoorLikeEntranceTile(tile)) return;
    const outside = outsideFaceForBoundaryTile(room, x, y);
    if (!outside || outside.x <= 0 || outside.y <= 0 || outside.x >= MAP_W - 1 || outside.y >= MAP_H - 1 || tileInsideAnyRoom(outside.x, outside.y)) {
      map[y][x] = T.FLOOR;
      repairFormerEntranceSidePadding(room, x, y, 0, 0);
      return;
    }
    map[y][x] = T.FLOOR;
    map[outside.y][outside.x] = tile;
    repairFormerEntranceSidePadding(room, x, y, outside.dx, outside.dy);
    moved.push({ fromX: x, fromY: y, toX: outside.x, toY: outside.y, tile });
  }

  /**
   * @param {number} tx
   * @param {number} ty
   */
  function carveProtectedRescueCorridorTo(tx, ty) {
    const sx = spawnRoom.cx;
    const sy = spawnRoom.cy;
    /** @type {{x:number,y:number}[]} */
    const q = [{ x: sx, y: sy }];
    /** @type {Int16Array[]} */
    const prev = Array.from({ length: MAP_H }, () => new Int16Array(MAP_W).fill(-1));
    const startRow = prev[sy];
    if (!startRow) return;
    startRow[sx] = sy * MAP_W + sx;
    for (let qi = 0; qi < q.length; qi++) {
      const current = q[qi];
      if (!current) continue;
      const { x, y } = current;
      if (x === tx && y === ty) break;
      const dirs = /** @type {const} */ ([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      for (const dir of dirs) {
        const dx = dir[0];
        const dy = dir[1];
        const nx = x + dx;
        const ny = y + dy;
        const prevRow = prev[ny];
        if (nx <= 0 || ny <= 0 || nx >= MAP_W - 1 || ny >= MAP_H - 1 || !prevRow) continue;
        const seen = prevRow[nx];
        if (seen === undefined || seen >= 0) continue;
        prevRow[nx] = y * MAP_W + x;
        q.push({ x: nx, y: ny });
      }
    }
    const targetRow = prev[ty];
    const targetSeen = targetRow?.[tx];
    if (targetSeen === undefined || targetSeen < 0) {
      let cx = sx, cy = sy;
      while (cx !== tx) {
        if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR;
        cx += cx < tx ? 1 : -1;
      }
      while (cy !== ty) {
        if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR;
        cy += cy < ty ? 1 : -1;
      }
      if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR;
      return;
    }
    let cx = tx;
    let cy = ty;
    while (!(cx === sx && cy === sy)) {
      if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR;
      const pathRow = prev[cy];
      if (!pathRow) break;
      const p = pathRow[cx];
      if (p === undefined || p < 0) break;
      cy = Math.floor(p / MAP_W);
      cx = p % MAP_W;
    }
  }

  function clearOrphanEntranceTiles() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (isDoorLikeEntranceTile(map[y][x]) && (tileOnRoomCorner(x, y) || !hasAlignedOutsideEntrancePassage(x, y))) map[y][x] = T.FLOOR;
      }
    }
  }

  function collapseAdjacentEntranceTiles() {
    /** @type {Set<string>} */
    const visitedDoorTiles = new Set();
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x])) continue;
        const key = x + ',' + y;
        if (visitedDoorTiles.has(key)) continue;
        const cluster = [{ x, y }];
        visitedDoorTiles.add(key);
        for (let qi = 0; qi < cluster.length; qi++) {
          const c = /** @type {any} */ (cluster[qi]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = c.x + dx, ny = c.y + dy;
            const nk = nx + ',' + ny;
            if (visitedDoorTiles.has(nk) || !isDoorLikeEntranceTile(map[ny]?.[nx])) continue;
            visitedDoorTiles.add(nk);
            cluster.push({ x: nx, y: ny });
          }
        }
        if (cluster.length > 1) keepSingleEntranceTile(cluster);
      }
    }
  }

  function thinWideCorridors() {
    /** @type {any} */
    const inRoom = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
    for (const r of rooms) {
      for (let ty = r.y; ty < r.y + r.h; ty++) {
        for (let tx = r.x; tx < r.x + r.w; tx++) {
          if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) inRoom[ty][tx] = 1;
        }
      }
    }
    /** @param {number} x @param {number} y */
    const isCorridor = (x, y) => {
      const t = map[y]?.[x];
      return !inRoom[y]?.[x] && t !== T.WALL && t !== T.VOID;
    };
    const allRoomsReachable = () => {
      const solvedReach = solveProgressionReachability(rooms);
      return solvedReach.unreachableRooms.length === 0;
    };
    let changed = true;
    while (changed) {
      changed = false;
      for (let y = 1; y < MAP_H - 2; y++) {
        for (let x = 1; x < MAP_W - 2; x++) {
          if (isCorridor(x, y) && isCorridor(x + 1, y) &&
              isCorridor(x, y + 1) && isCorridor(x + 1, y + 1)) {
            const candidates = [
              { x: x + 1, y: y + 1 },
              { x: x + 1, y },
              { x, y: y + 1 },
              { x, y },
            ];
            for (const c of candidates) {
              if (isDoorLikeEntranceTile(map[c.y][c.x])) continue;
              const snapshot = map.map((/** @type {any} */ row) => row.slice());
              map[c.y][c.x] = T.WALL;
              if (allRoomsReachable()) {
                changed = true;
                break;
              }
              for (let ry = 0; ry < MAP_H; ry++) map[ry] = snapshot[ry];
            }
          }
        }
      }
    }
  }

  for (const r of rooms) {
    if (r === bossRoom) continue;
    const clusters = getEntranceClusters(r);
    for (const cl of clusters) {
      if (cl.length > 1) keepSingleEntranceTile(cl);
    }
  }

  for (const r of rooms) {
    if (r === bossRoom) continue;
    const clusters = getEntranceClusters(r);
    // Single room-boundary entrance tiles become optional doors.
    for (const cl of clusters) {
      if (cl.length === 1 && rand('world') < 0.5) {
        for (const e of cl) map[e.y][e.x] = T.DOOR;
      }
    }
  }

  // ── Locked doors + keys (floor 2+) ──────────────────────────────────────
  // Lock meaningful targets: stair room first, then special rooms, then random.
  // All narrow entrance clusters of the target room are locked so the room
  // is truly gated (no walking around a single locked tile).
  /** @type {{x:number,y:number,colour:string,tileColour:string}[]} */
  const keyItems = [];
  if (floorNum >= 2) {
    // Build priority list: stair room > special rooms > eligible randoms
    const lockPriority = [];
    if (farthest !== spawnRoom && farthest !== bossRoom && farthest.roomType !== 'mainframe') lockPriority.push(farthest);
    for (const r of specialRooms) {
      if (!lockPriority.includes(r) && r.roomType !== 'vendor' && r.roomType !== 'secret') lockPriority.push(r);
    }
    const fallback = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && r !== bossRoom &&
      !specialRooms.includes(r) && r.w * r.h >= 20
    );
    lockPriority.push(...shuffleInPlace(fallback.slice(), 'world'));

    const numLocked = floorNum >= 7 ? 3 : floorNum >= 4 ? 2 : 1;
    const colours = ['red','blue','gold'];
    const lockTiles = [T.LOCKED_R, T.LOCKED_B, T.LOCKED_G];
    const lockColours = ['#ff3333','#3388ff','#ffcc00'];
    let placed = 0;

    for (const lr of lockPriority) {
      if (placed >= numLocked) break;
      const ci = Math.min(placed, 2);
      // Entrance clusters were already narrowed to one room-boundary tile;
      // lock every current entrance so the room cannot be bypassed.
      const cls = getEntranceClusters(lr);
      const narrowClusters = cls.filter(cl => cl.length <= 2);
      if (!narrowClusters.length) continue; // can't meaningfully gate this room

      // Convert every tile in every entrance cluster to a locked door.
      const lockedTiles = [];
      for (const cl of narrowClusters) {
        for (const e of cl) {
          map[e.y][e.x] = lockTiles[ci];
          lockedTiles.push(e);
        }
      }

      /** @type {Set<string>} */
      const placedColours = new Set();
      let vis2 = computeKeyPlacementReach(placedColours);
      let expanded = true;
      let keySafety = 6;
      while (expanded && keySafety-- > 0) {
        expanded = false;
        for (const ki of keyItems) {
          if (!placedColours.has(ki.colour) && vis2[ki.y]?.[ki.x]) {
            placedColours.add(ki.colour);
            expanded = true;
          }
        }
        if (expanded) vis2 = computeKeyPlacementReach(placedColours);
      }
      const keyOccupied = (/** @type {any} */ r) => keyItems.some((/** @type {any} */ ki) => ki.x === r.cx && ki.y === r.cy);
      const keyEligible = rooms.filter((/** @type {any} */ r) =>
        r !== lr && r !== spawnRoom && r !== bossRoom && r.roomType !== 'secret' &&
        !keyOccupied(r) && vis2[r.cy][r.cx]
      );
      const preferredKeyRooms = keyEligible.filter((/** @type {any} */ r) =>
        r !== farthest && r.roomType !== 'vendor'
      );
      // Find a reachable, already-explorable room to place the key. Never put
      // progression keys in the spawn room: that creates "locked start room"
      // layouts that are technically solvable but read as broken generation.
      const keyRoom = preferredKeyRooms.length ? preferredKeyRooms : keyEligible;
      if (keyRoom.length) {
        const kr = keyRoom[rndInt(0, keyRoom.length-1)];
        keyItems.push({
          x: kr.cx,
          y: kr.cy,
          colour: /** @type {string} */ (colours[ci]),
          tileColour: /** @type {string} */ (lockColours[ci])
        });
        lr.hasLoot = true;
        placed++;
      } else {
        // Can't safely place key — revert locks to floor.
        for (const e of lockedTiles) map[e.y][e.x] = T.FLOOR;
      }
    }
  }

  // ── Secret room (every floor, one per floor) ─────────────────────────────
  /** @type {any[]} */ const secretRooms = [];
  /** @type {any[]} */ const whisperItems = [];
  {
    // Candidates: not spawn, not stair, not boss, not already special, decent size
    const secretEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && r !== bossRoom && !r.roomType && r.w * r.h >= 20
    );
    // Shuffle and try to find one with a normalized single-tile entrance.
    const shuffled = shuffleInPlace(secretEligible.slice(), 'world');
    for (const r of shuffled) {
      const cls = getEntranceClusters(r);
      const narrow = cls.filter(cl => cl.length <= 2);
      if (!narrow.length) continue; // no entrance to convert into a cracked wall

      r.roomType = 'secret';
      r.secretRevealed = false;
      specialRooms.push(r);
      secretRooms.push(r);

      // Wall off ALL entrances
      for (const cl of cls) {
        for (const e of cl) map[e.y][e.x] = T.WALL;
      }
      // Place T.CRACKED at one narrow cluster (the "hidden entrance")
      const crackedCluster = /** @type {any} */ (narrow[rndInt(0, narrow.length - 1)]);
      for (const e of crackedCluster) map[e.y][e.x] = T.CRACKED;

      // Whispers subplot — narrative fragments found in secret rooms.
      // Try to spawn one whisper item at the secret room's center. NEON.whispers
      // returns null if no eligible unread whisper for this floor's biome, in
      // which case the secret room still rewards the player with normal loot
      // (the per-room loot pass at render.js handles that). Try/catch keeps
      // gen resilient if the meta module isn't loaded yet (e.g. early Node
      // tests of generateFloor).
      try {
        if (typeof NEON !== 'undefined' && NEON.whispers && NEON.whispers.pickWhisperForFloor) {
          const w = NEON.whispers.pickWhisperForFloor(floorNum, () => rand('event'));
          if (w && w.id) {
            whisperItems.push({ x: r.cx + 0.5, y: r.cy + 0.5, whisperId: w.id });
          }
        }
      } catch (_) { /* gen-time meta unavailable; skip whisper this floor */ }

      break; // only one secret room per floor
    }
  }

  // ── Challenge Room (floor 2+, non-boss): optional wave-based arena ─────
  /** @type {any} */ let challengeRoom = null;
  /** @type {any[]} */ const challengeEntrances = [];
  if (floorNum >= 2 && !bossRoom) {
    const challengeEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 30
    );
    const shuffledCh = shuffleInPlace(challengeEligible.slice(), 'world');
    for (const r of shuffledCh) {
      const cls = getEntranceClusters(r);
      // Only pick rooms where ALL entrance clusters are narrow (≤2 tiles)
      if (cls.length === 0) continue;
      if (cls.some(cl => cl.length > 2)) continue;
      r.roomType = 'challenge';
      challengeRoom = r;
      specialRooms.push(r);
      // Replace entrance tiles with challenge gates
      for (const cl of cls) {
        for (const e of cl) {
          map[e.y][e.x] = T.CHALLENGE_GATE;
          challengeEntrances.push({ x: e.x, y: e.y });
        }
      }
      break; // one per floor
    }
  }

  // ── Implant Room (floor 2+, non-boss, ~50% chance): augment shrine ─────
  /** @type {any} */ let implantRoom = null;
  if (floorNum >= 2 && !bossRoom && rand('world') < 0.5) {
    const implantEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 16
    );
    if (implantEligible.length > 0) {
      implantRoom = implantEligible[rndInt(0, implantEligible.length - 1)];
      implantRoom.roomType = 'implant';
      specialRooms.push(implantRoom);
      map[implantRoom.cy][implantRoom.cx] = T.IMPLANT_SHRINE;
    }
  }

  // ── Event Room (floor 2+, non-boss): risk/reward encounter terminal ───
  /** @type {any} */ let eventRoom = null;
  if (floorNum >= 2 && !bossRoom) {
    const eventEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 16
    );
    if (eventEligible.length > 0) {
      eventRoom = eventEligible[rndInt(0, eventEligible.length - 1)];
      eventRoom.roomType = 'event';
      specialRooms.push(eventRoom);
      map[eventRoom.cy][eventRoom.cx] = T.EVENT_TERMINAL;
    }
  }

  collapseAdjacentEntranceTiles();
  // ── Prune dead-end corridor tiles ─────────────────────────────────────
  // After secret rooms, locked doors, and challenge rooms wall off entrances,
  // some corridor segments become dead ends (floor tile with only 1 passable
  // neighbour that isn't inside any room). Iteratively fill them so players
  // never walk down a tunnel to nowhere.
  {
    // Build room membership lookup
    /** @type {any} */ const inRoom = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
    for (const r of rooms) {
      for (let ty = r.y; ty < r.y + r.h; ty++)
        for (let tx = r.x; tx < r.x + r.w; tx++)
          if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) inRoom[ty][tx] = 1;
    }
    let pruned = true;
    const connects = (/** @type {any} */ t) => t !== T.WALL && t !== T.VOID; // doors/locks/cracked all count
    while (pruned) {
      pruned = false;
      for (let y = 1; y < MAP_H - 1; y++) {
        for (let x = 1; x < MAP_W - 1; x++) {
          if (map[y][x] !== T.FLOOR || inRoom[y][x]) continue;
          let adj = 0;
          if (connects(map[y-1][x])) adj++;
          if (connects(map[y+1][x])) adj++;
          if (connects(map[y][x-1])) adj++;
          if (connects(map[y][x+1])) adj++;
          if (adj <= 1) { map[y][x] = T.WALL; pruned = true; }
        }
      }
    }
  }

  thinWideCorridors();
  repairMisalignedOutsideEntrancePassages();
  clearOrphanEntranceTiles();

  // ── All-rooms reachability gate (key-cascade BFS) ──────────────────────
  // Goal: from spawn, the player must be able to reach EVERY room — not just
  // the stairs. Special rooms (vendor / lore / event terminal / shrine /
  // challenge) host gameplay-critical interactions; if any becomes unreachable
  // due to lock placement + later passes (secret rooms, dead-end pruning), the
  // floor feels broken even when technically completable.
  //
  // User reports on floor 3 (twice on 2026-04-25 / 6bc2e985):
  //   "spawned into a room with the exit and a red key door, but no red key,
  //    so I can't explore the floor or fight the miniboss"
  //
  // The previous fix only checked KEY-item reachability and missed the case
  // where a key is reachable but the rooms it would unlock are still gated
  // behind ANOTHER unreachable lock (multi-color cascades) or the key is
  // simply absent for a placed lock (lockPriority/keyRoom empty edge cases).
  //
  // Algorithm:
  //   1. BFS from spawn through `passable` tiles + locks of any colour for
  //      which a reachable key exists. Iterate until fixed point (each pass
  //      may discover new keys, which open new locks, exposing more keys).
  //   2. If any room has zero reachable tiles after fixed point, downgrade
  //      every locked door whose colour the player COULDN'T pick up. The
  //      floor loses some gating gameplay but every room becomes reachable.
  //   3. If rooms are still unreachable (e.g. structurally walled by gen),
  //      the rescue-corridor pass below carves spawn→stairs as a last resort.
  //
  // Tile vocabulary kept in sync with src/platform.js isPassable() so this
  // gen-time reachability matches what the player actually experiences. The
  // notable additions over the prior fix are T.PLASMA, T.ARC (walkable
  // hazards — runtime isPassable allows them, the prior gen-time check did
  // not) and T.CRACKED (interact-breakable per game.js:663,1691 — secret
  // rooms ARE reachable to the player without keys/upgrades, so they should
  // count as reachable here too). T.DOOR (closed) stays passable because the
  // player can open closed doors via interact; that diverges from runtime
  // isPassable but is intentional (matches dungeon-gen connectivity intent).
  {
    const solvedReach = solveProgressionReachability(rooms);
    const computeReach = solvedReach.computeReach;
    /** @type {any} */ let reach = solvedReach.reachable;
    // After fixed point, `reach` reflects max possible exploration with all
    // collectible keys. Check every room for at least one reachable tile.
    /** @param {{x:number,y:number,w:number,h:number,cx:number,cy:number}} room */
    const roomTouchesReach = (room) => dungeonReachability.roomTouchesReach(room, reach);
    const unreachableWithKeys = solvedReach.unreachableRooms;
    if (unreachableWithKeys.length > 0) {
      // Downgrade every locked door whose colour the player couldn't pick up.
      // This includes colours with no key item placed at all (the
      // lockPriority/keyRoom empty-fallback edge case in the lock-placement
      // loop above).
      const lockTileForColour = { red: T.LOCKED_R, blue: T.LOCKED_B, gold: T.LOCKED_G };
      for (const colour of solvedReach.missingColours) {
        const lt = lockTileForColour[/** @type {'red'|'blue'|'gold'} */ (colour)];
        for (let y = 0; y < MAP_H; y++) {
          for (let x = 0; x < MAP_W; x++) {
            if (map[y][x] === lt) map[y][x] = T.FLOOR;
          }
        }
      }
      // After downgrading, recompute reach (no longer gated by missing keys).
      reach = computeReach(new Set(['red', 'blue', 'gold']));
    }

    /**
     * @param {any} room
     * @returns {{x:number,y:number,ox:number,oy:number}[]}
     */
    const roomBoundaryGates = (room) => {
      /** @type {{x:number,y:number,ox:number,oy:number}[]} */
      const gates = [];
      for (let tx = room.x; tx < room.x + room.w; tx++) {
        const top = map[room.y]?.[tx];
        if (top === T.LOCKED_R || top === T.LOCKED_B || top === T.LOCKED_G || top === T.CRACKED || top === T.CHALLENGE_GATE) {
          gates.push({ x: tx, y: room.y, ox: tx, oy: room.y - 1 });
        }
        const by = room.y + room.h - 1;
        const bottom = map[by]?.[tx];
        if (bottom === T.LOCKED_R || bottom === T.LOCKED_B || bottom === T.LOCKED_G || bottom === T.CRACKED || bottom === T.CHALLENGE_GATE) {
          gates.push({ x: tx, y: by, ox: tx, oy: by + 1 });
        }
      }
      for (let ty = room.y; ty < room.y + room.h; ty++) {
        const left = map[ty]?.[room.x];
        if (left === T.LOCKED_R || left === T.LOCKED_B || left === T.LOCKED_G || left === T.CRACKED || left === T.CHALLENGE_GATE) {
          gates.push({ x: room.x, y: ty, ox: room.x - 1, oy: ty });
        }
        const bx = room.x + room.w - 1;
        const right = map[ty]?.[bx];
        if (right === T.LOCKED_R || right === T.LOCKED_B || right === T.LOCKED_G || right === T.CRACKED || right === T.CHALLENGE_GATE) {
          gates.push({ x: bx, y: ty, ox: bx + 1, oy: ty });
        }
      }
      return gates;
    };

    // Final repair pass: validate with ALL locks open using the same 4-way
    // movement the player has. If a gated room is unreachable, carve to the
    // OUTSIDE face of its gate so the lock still matters; only ungated rooms
    // get a direct rescue corridor to their centre.
    for (let repair = 0; repair < rooms.length; repair++) {
      reach = computeReach(new Set(['red', 'blue', 'gold']));
      const blocked = rooms.find((/** @type {any} */ r) => !roomTouchesReach(r));
      if (!blocked) break;
      const gates = roomBoundaryGates(blocked);
      if (gates.length > 0) {
        const gate = gates.find((/** @type {any} */ g) =>
          g.ox >= 0 && g.oy >= 0 && g.ox < MAP_W && g.oy < MAP_H && !reach[g.oy]?.[g.ox]
        ) || gates[0];
        if (gate) {
          const outsideInBounds = gate.ox >= 0 && gate.oy >= 0 && gate.ox < MAP_W && gate.oy < MAP_H;
          carveProtectedRescueCorridorTo(outsideInBounds ? gate.ox : gate.x, outsideInBounds ? gate.oy : gate.y);
        }
      } else {
        carveProtectedRescueCorridorTo(blocked.cx, blocked.cy);
      }
    }
  }

  // ── Reachability guarantee: spawn → stairs must always be connected ────
  // BFS from spawn across all non-wall/void tiles (doors + locked doors
  // count as passable since the player will acquire keys). If stairs are
  // unreachable, carve a rescue corridor. Structured as a reusable helper
  // so it can later double as a player power-up (path visualisation).
  {
    const sx = spawnRoom.cx, sy = spawnRoom.cy;
    const stairTile = floorNum >= _finalFloor ? T.TERMINAL : T.STAIRS;
    /** @type {any} */ const vis = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
    /** @type {any} */ const prev = Array.from({length: MAP_H}, () => new Int16Array(MAP_W).fill(-1));
    const q = [{x: sx, y: sy}];
    vis[sy][sx] = 1;
    let stairX = -1, stairY = -1;
    // Find stairs position
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (map[y][x] === stairTile) { stairX = x; stairY = y; }

    while (q.length) {
      const {x, y} = /** @type {{x:any,y:any}} */ (q.shift());
      if (x === stairX && y === stairY) break;
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        if (vis[ny][nx]) continue;
        const t = map[ny][nx];
        if (t === T.WALL || t === T.VOID) continue;
        vis[ny][nx] = 1;
        prev[ny][nx] = y * MAP_W + x;
        q.push({x: nx, y: ny});
      }
    }

    if (!vis[stairY][stairX]) {
      // Stairs unreachable — carve rescue corridor, only overwriting WALL/VOID
      let cx = sx, cy = sy;
      while (cx !== stairX) { if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR; cx += cx < stairX ? 1 : -1; }
      while (cy !== stairY) { if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR; cy += cy < stairY ? 1 : -1; }
    }
  }

  thinWideCorridors();
  clearOrphanEntranceTiles();

  {
    /** @param {any} room */
    const roomBoundaryGates = (room) => {
      /** @type {{x:number,y:number,ox:number,oy:number}[]} */
      const gates = [];
      for (let tx = room.x; tx < room.x + room.w; tx++) {
        const top = map[room.y]?.[tx];
        if (top === T.LOCKED_R || top === T.LOCKED_B || top === T.LOCKED_G || top === T.CRACKED || top === T.CHALLENGE_GATE) gates.push({ x: tx, y: room.y, ox: tx, oy: room.y - 1 });
        const by = room.y + room.h - 1;
        const bottom = map[by]?.[tx];
        if (bottom === T.LOCKED_R || bottom === T.LOCKED_B || bottom === T.LOCKED_G || bottom === T.CRACKED || bottom === T.CHALLENGE_GATE) gates.push({ x: tx, y: by, ox: tx, oy: by + 1 });
      }
      for (let ty = room.y; ty < room.y + room.h; ty++) {
        const left = map[ty]?.[room.x];
        if (left === T.LOCKED_R || left === T.LOCKED_B || left === T.LOCKED_G || left === T.CRACKED || left === T.CHALLENGE_GATE) gates.push({ x: room.x, y: ty, ox: room.x - 1, oy: ty });
        const bx = room.x + room.w - 1;
        const right = map[ty]?.[bx];
        if (right === T.LOCKED_R || right === T.LOCKED_B || right === T.LOCKED_G || right === T.CRACKED || right === T.CHALLENGE_GATE) gates.push({ x: bx, y: ty, ox: bx + 1, oy: ty });
      }
      return gates;
    };
    for (let repair = 0; repair < rooms.length; repair++) {
      const solvedReach = solveProgressionReachability(rooms);
      const blocked = solvedReach.unreachableRooms[0];
      if (!blocked) break;
      const gates = roomBoundaryGates(blocked);
      const gate = gates.find((/** @type {any} */ g) =>
        g.ox >= 0 && g.oy >= 0 && g.ox < MAP_W && g.oy < MAP_H && !solvedReach.reachable[g.oy]?.[g.ox]
      ) || gates[0];
      if (gate) {
        const outsideInBounds = gate.ox >= 0 && gate.oy >= 0 && gate.ox < MAP_W && gate.oy < MAP_H;
        carveProtectedRescueCorridorTo(outsideInBounds ? gate.ox : gate.x, outsideInBounds ? gate.oy : gate.y);
      } else {
        carveProtectedRescueCorridorTo(blocked.cx, blocked.cy);
      }
    }
  }

  thinWideCorridors();
  const relocatedEntrances = normalizeEntranceTilesOutsideRooms();
  collapseAdjacentOutsideEntranceTilesToFloor();
  repairOutsideEntranceRoomEdges();
  repairMisalignedOutsideEntrancePassages();
  clearDeadOutsideEntranceTiles();
  ensureSpecialRoomEntrances();
  repairMisalignedOutsideEntrancePassages();
  collapseAdjacentOutsideEntranceTilesToFloor();
  repairOutsideEntranceRoomEdges();
  ensureSpecialRoomEntrances();
  repairMisalignedOutsideEntrancePassages();
  clearDeadOutsideEntranceTiles();
  repairPostRelocationLockReachability();
  removeKeysWithoutLiveLocks();
  for (const move of relocatedEntrances) {
    if (move.tile !== T.CHALLENGE_GATE) continue;
    const entry = challengeEntrances.find((/** @type {any} */ e) => e.x === move.fromX && e.y === move.fromY);
    if (entry) { entry.x = move.toX; entry.y = move.toY; }
  }
  for (let i = challengeEntrances.length - 1; i >= 0; i--) {
    const entry = challengeEntrances[i];
    if (!entry || map[entry.y]?.[entry.x] === T.CHALLENGE_GATE) continue;
    challengeEntrances.splice(i, 1);
  }

  // ── Traps (floor 3+) ────────────────────────────────────────────────────
  if (floorNum >= 3) {
    for (const r of rooms) {
      // Skip spawn (player needs safe arrival), boss (boss room is its own
      // hazard), and special rooms — secret rooms in particular, because the
      // whisper item spawns at the room center (see secret-room placement
      // above) and a trap landing on that exact tile would visually replace
      // the whisper. Special rooms (vendor/lore/event/shrine/challenge) host
      // gameplay-critical interactions that traps would clutter.
      if (r === spawnRoom || r === bossRoom || r.roomType) continue;
      const trapCount = rndInt(0, Math.min(3, Math.floor(floorNum/3)));
      for (let t=0; t<trapCount; t++) {
        const tx = r.x + rndInt(1, r.w-2);
        const ty = r.y + rndInt(1, r.h-2);
        if (map[ty][tx] === T.FLOOR) {
          // Trap mix: 55% spike (damage), 22% slow (impede), 13% shock
          // (movement-suppress), 10% repulsor (positional knockback).
          // Status hazards (shock, repulsor) stay rare because they commit
          // the player in place / displace them — over-spawning trivialises
          // rooms. Repulsor is the rarest because adjacent repulsors can
          // chain a forced detour that's hard to plan around.
          const roll = rand('world');
          map[ty][tx] = roll < 0.55 ? T.TRAP_SPIKE
                      : roll < 0.77 ? T.TRAP_SLOW
                      : roll < 0.90 ? T.SHOCK_TILE
                      : T.REPULSOR;
        }
      }
    }
  }

  // ── Toxic Pools (floor 3+): corrosive pools that damage player AND enemies ──
  if (floorNum >= 3) {
    for (const r of rooms) {
      if (r === spawnRoom || r === bossRoom || r.roomType) continue;
      if (rand('world') > 0.30) continue; // ~30% of eligible rooms
      const sx = r.x + rndInt(2, r.w-3);
      const sy = r.y + rndInt(2, r.h-3);
      if (map[sy][sx] !== T.FLOOR) continue;
      map[sy][sx] = T.TOXIC;
      const poolSize = rndInt(2, 4);
      let cx = sx, cy = sy;
      for (let p = 1; p < poolSize; p++) {
        const dirs = /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]]);
        const [ddx, ddy] = /** @type {[number,number]} */ (dirs[rndInt(0, 3)]);
        const nx = cx + ddx, ny = cy + ddy;
        if (nx > r.x && nx < r.x+r.w-1 && ny > r.y && ny < r.y+r.h-1 && map[ny][nx] === T.FLOOR) {
          map[ny][nx] = T.TOXIC;
          cx = nx; cy = ny;
        }
      }
    }
  }

  // ── Plasma Vents (floor 4+): clustered pools in normal rooms ─────────
  if (floorNum >= 4) {
    for (const r of rooms) {
      if (r === spawnRoom || r === bossRoom || r.roomType) continue;
      if (rand('world') > 0.35) continue; // ~35% of eligible rooms
      // Seed tile for the pool
      const sx = r.x + rndInt(2, r.w-3);
      const sy = r.y + rndInt(2, r.h-3);
      if (map[sy][sx] !== T.FLOOR) continue;
      map[sy][sx] = T.PLASMA;
      // Grow pool via random-walk from seed (2-4 total tiles)
      const poolSize = rndInt(2, 4);
      let cx = sx, cy = sy;
      for (let p = 1; p < poolSize; p++) {
        const dirs = /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]]);
        const [ddx, ddy] = /** @type {[number,number]} */ (dirs[rndInt(0, 3)]);
        const nx = cx + ddx, ny = cy + ddy;
        if (nx > r.x && nx < r.x+r.w-1 && ny > r.y && ny < r.y+r.h-1 && map[ny][nx] === T.FLOOR) {
          map[ny][nx] = T.PLASMA;
          cx = nx; cy = ny;
        }
      }
    }
  }

  // ── Lore Terminals (floor 1+, non-boss): guaranteed opening frame + floor-scaled extras ────
  /** @type {{x:number,y:number}[]} */
  const loreTerminals = [];
  /** @param {any} r */
  function placeLoreTerminalInRoom(r) {
    for (let attempt = 0; attempt < 16; attempt++) {
      const tx = r.x + rndInt(1, r.w - 2);
      const ty = r.y + rndInt(1, r.h - 2);
      if (tx === r.cx && ty === r.cy) continue;
      if (map[ty][tx] === T.FLOOR) {
        map[ty][tx] = T.LORE;
        loreTerminals.push({ x: tx, y: ty });
        return true;
      }
    }
    for (let ty = r.y + 1; ty < r.y + r.h - 1; ty++) {
      for (let tx = r.x + 1; tx < r.x + r.w - 1; tx++) {
        if (tx === r.cx && ty === r.cy) continue;
        if (map[ty][tx] === T.FLOOR) {
          map[ty][tx] = T.LORE;
          loreTerminals.push({ x: tx, y: ty });
          return true;
        }
      }
    }
    return false;
  }
  if (floorNum >= 1 && !bossRoom) {
    if (floorNum === 1) placeLoreTerminalInRoom(spawnRoom);
    const loreEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && r.roomType !== 'vendor' &&
      r.roomType !== 'secret' && r.roomType !== 'event' && r.w * r.h >= 12
    );
    const numLore = Math.min(loreEligible.length, floorNum >= 5 ? 2 : floorNum >= 2 ? 1 : 0);
    const loreRooms = shuffleInPlace(loreEligible.slice(), 'world').slice(0, numLore);
    for (const r of loreRooms) {
      placeLoreTerminalInRoom(r);
    }
  }

  // ── Arc Grids (floor 5+): pulsing hazards in corridors ───────────────
  if (floorNum >= 5) {
    // Build room mask to identify corridor tiles
    /** @type {any} */ const roomMask = Array.from({length:MAP_H}, ()=>new Uint8Array(MAP_W));
    for (const r of rooms) {
      for (let ty = r.y; ty < r.y + r.h; ty++)
        for (let tx = r.x; tx < r.x + r.w; tx++)
          roomMask[ty][tx] = 1;
    }
    // Collect corridor floor tiles (not adjacent to doors/stairs/terminals)
    const corridorTiles = [];
    for (let ty = 1; ty < MAP_H-1; ty++) {
      for (let tx = 1; tx < MAP_W-1; tx++) {
        if (map[ty][tx] !== T.FLOOR || roomMask[ty][tx]) continue;
        // Skip if adjacent to door, stairs, terminal, or locked door
        let nearSpecial = false;
        for (const [ddx, ddy] of /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]])) {
          const nt = map[ty+ddy]?.[tx+ddx];
          if (nt===T.STAIRS||nt===T.TERMINAL||nt===T.VENDOR||nt===T.LORE||nt===T.IMPLANT_SHRINE||nt===T.EVENT_TERMINAL||nt===T.MAINFRAME_READER||nt===T.NETWORK_PORTAL||nt===T.MESSAGE_CONSOLE||isDoor(nt)||nt===T.DOOR_OPEN) { nearSpecial = true; break; }
        }
        if (!nearSpecial) corridorTiles.push({x:tx, y:ty});
      }
    }
    // Place arc grids: ~1 per 12 corridor tiles, capped
    const arcCount = Math.min(Math.floor(corridorTiles.length / 12) + 1, 6 + floorNum);
    const shuffled = shuffleInPlace(corridorTiles.slice(), 'world');
    let placed = 0;
    for (const ct of shuffled) {
      if (placed >= arcCount) break;
      // Don't place adjacent to another arc
      let adjArc = false;
      for (const [ddx, ddy] of /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]])) {
        if (map[ct.y+ddy]?.[ct.x+ddx] === T.ARC) { adjArc = true; break; }
      }
      if (adjArc) continue;
      map[ct.y][ct.x] = T.ARC;
      placed++;
    }
  }

  // ── Teleport Pads (floor 3+, non-boss): linked pairs for fast travel ───
  const teleportPads = [];
  if (floorNum >= 3 && !bossRoom) {
    const padEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 16 &&
      map[r.cy][r.cx] === T.FLOOR
    );
    // Want pairs of rooms far apart — sort by BFS distance from spawn and pair extremes
    const pairCount = floorNum >= 6 ? 2 : 1;
    const shuffled = shuffleInPlace(padEligible.slice(), 'world');
    const used = new Set();
    for (let p = 0; p < pairCount && shuffled.length - used.size >= 2; p++) {
      let bestA = null, bestB = null, bestDist = 0;
      for (let i = 0; i < shuffled.length; i++) {
        if (used.has(i)) continue;
        for (let j = i + 1; j < shuffled.length; j++) {
          if (used.has(j)) continue;
          const d = Math.abs(shuffled[i].cx - shuffled[j].cx) + Math.abs(shuffled[i].cy - shuffled[j].cy);
          if (d > bestDist) { bestDist = d; bestA = i; bestB = j; }
        }
      }
      if (bestA !== null && bestDist >= 15) {
        const rA = shuffled[/** @type {number} */ (bestA)], rB = shuffled[/** @type {number} */ (bestB)];
        map[rA.cy][rA.cx] = T.TELEPORT_PAD;
        map[rB.cy][rB.cx] = T.TELEPORT_PAD;
        teleportPads.push({ x1: rA.cx, y1: rA.cy, x2: rB.cx, y2: rB.cy, pairIndex: p });
        used.add(bestA);
        used.add(bestB);
      }
    }
  }

  // Room colour map (floor tile → tint)
  /** @type {any} */ const roomColour = Array.from({length:MAP_H},()=>new Array(MAP_W).fill(null));
  for (const r of rooms) {
    if (!r.roomType) continue;
    const col = ROOM_COLOURS[r.roomType];
    for (let ty=r.y; ty<r.y+r.h; ty++)
      for (let tx=r.x; tx<r.x+r.w; tx++)
        if (map[ty][tx]===T.FLOOR) roomColour[ty][tx]=col;
  }

  // Secret room mask — tiles inside unrevealed secret rooms are hidden from lighting/rendering
  // Cracked entrance tiles are excluded so they can receive light and render crack visuals
  /** @type {any} */ const secretMask = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));
  for (const r of secretRooms) {
    for (let ty=r.y; ty<r.y+r.h; ty++)
      for (let tx=r.x; tx<r.x+r.w; tx++)
        if (map[ty][tx] !== T.CRACKED) secretMask[ty][tx] = 1;
  }

  return { map, rooms, spawnRoom, defaultSpawnRoom, preferredSpawnResolved: !!preferredSpawn, stairRoom:farthest, bossRoom, bossEntrances, mainframeRoom, playerPos, lights, visited, light, visible, keyItems, whisperItems, roomColour, specialRooms, vendorRoom, secretRooms, secretMask, loreTerminals, challengeRoom, challengeEntrances, eventRoom, teleportPads };
}

// ─── Lighting ────────────────────────────────────────────────────────────────
/**
 * @param {any} dungeon
 * @param {any} px
 * @param {any} py
 */
function updateLighting(dungeon, px, py) {
  const map = dungeon.map;
  const mod = _CG.modifier;
  const baseR = mod === 'BLACKOUT' ? 5 : 9;
  // RECON meta upgrade (src/meta/save.js applyMetaToPlayer): sensorRadiusMult
  // scales the player FOV radius. Same loop also writes dungeon.visited (line
  // ~3468) so this widens both the lit area AND the minimap reveal — matching
  // the upgrade contract '+20% sensor radius (minimap reveal) per level'.
  // Set once at run start; constant for the run; included in the cache key
  // (_fovSensor) defensively in case any future mechanic mutates it mid-run.
  // Sanitize aggressively: corrupted/tampered save data can deliver NaN /
  // Infinity / strings via _CG.player.sensorRadiusMult (the field flows through
  // saveGame's explicit enum but localStorage is user-writable); without the
  // isFinite + bounds check, NaN would blank the FOV and Infinity would hang
  // the per-tile loop.
  let sensorMult = (_CG.player && _CG.player.sensorRadiusMult) || 1;
  if (!Number.isFinite(sensorMult) || sensorMult <= 0) sensorMult = 1;
  if (sensorMult > 8) sensorMult = 8;
  const r = Math.max(1, Math.round(baseR * sensorMult));
  const tx = Math.floor(px), ty = Math.floor(py);
  // Incremental FOV (Phase 2b): if the player is still on the same floor tile
  // and the modifier hasn't changed and no map mutation flagged dirty, the
  // previous frame's light/visible grids are still correct. Skip recompute.
  if (!dungeon._fovDirty &&
      dungeon._fovTx === tx && dungeon._fovTy === ty &&
      dungeon._fovMod === mod &&
      dungeon._fovSensor === sensorMult) {
    return;
  }
  dungeon._fovDirty = false;
  dungeon._fovTx = tx; dungeon._fovTy = ty; dungeon._fovMod = mod;
  dungeon._fovSensor = sensorMult;
  // Clear light and visible each frame (per-row typed-array fill)
  for (let y = 0; y < MAP_H; y++) {
    dungeon.light[y].fill(0);
    dungeon.visible[y].fill(0);
  }
  // Player FOV — LOS-based
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      if (dungeon.secretMask[y][x]) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      if (!tileHasLOS(px, py, x, y, map)) continue;
      const l = Math.max(0, 1 - d / r);
      dungeon.light[y][x] = l;
      dungeon.visible[y][x] = 1;
      if (!dungeon.visited[y][x]) { dungeon.visited[y][x] = 1; _CG._minimapDirty = true; }
    }
  // Sconce ambient — only brightens already-visited tiles, no visibility grant.
  // Add deterministic flicker so floors read like unstable lab lighting.
  for (const sc of dungeon.lights) {
    const sdx = sc.x - tx, sdy = sc.y - ty;
    if (Math.abs(sdx) > 6 || Math.abs(sdy) > 6) continue;
    const flickerBase = 0.82 + 0.18 * Math.sin((_CG.floorTime || 0) * 7 + sc.x * 0.73 + sc.y * 1.11);
    const flickerDrop = Math.sin((_CG.floorTime || 0) * 19 + sc.x * 1.7 + sc.y * 2.3) > 0.94 ? 0.55 : 1;
    const sconceMul = flickerBase * flickerDrop;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = sc.x + dx, y = sc.y + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (dungeon.secretMask[y][x]) continue;
        if (!dungeon.visited[y][x]) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 4) dungeon.light[y][x] = Math.max(dungeon.light[y][x], 0.4 * sconceMul * (1 - d / 4));
      }
  }
}

// LOS check for FOV: like hasLOS but uses isSeeThrough and blocks diagonal corner-cuts
/**
 * @param {any} x1
 * @param {any} y1
 * @param {any} tx
 * @param {any} ty
 * @param {any} map
 */
function tileHasLOS(x1, y1, tx, ty, map) {
  let cx = Math.floor(x1), cy = Math.floor(y1);
  if (cx === tx && cy === ty) return true;
  const dx = Math.abs(tx - cx), dy = Math.abs(ty - cy);
  const sx = cx < tx ? 1 : -1, sy = cy < ty ? 1 : -1;
  let err = dx - dy;
  for (let i = 0; i < 100; i++) {
    const e2 = 2 * err;
    let nx = cx, ny = cy;
    if (e2 > -dy) { err -= dy; nx += sx; }
    if (e2 < dx)  { err += dx; ny += sy; }
    // Diagonal corner-cut block: both intermediate tiles must be see-through
    if (nx !== cx && ny !== cy) {
      if (!isSeeThrough(map[cy]?.[nx]) && !isSeeThrough(map[ny]?.[cx])) return false;
    }
    cx = nx; cy = ny;
    if (cx === tx && cy === ty) return true;
    if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return false;
    if (!isSeeThrough(map[cy][cx])) return false;
  }
  return true;
}

/**
 * @param {any} player
 * @param {number} floor
 */
function rollSecretWeaponCacheWeapon(player, floor) {
  const belt = player && Array.isArray(player.weapons) ? player.weapons : [];
  const owned = new Set(belt.map((/** @type {any} */ w) => w && w._base).filter(Boolean));
  let bases = WEAPON_KEYS.filter(k => !owned.has(k));
  if (bases.length === 0 && player && player.weapon && player.weapon._base) {
    bases = WEAPON_KEYS.filter(k => k !== player.weapon._base);
  }
  if (bases.length === 0) bases = WEAPON_KEYS.slice();
  const baseKey = /** @type {string} */ (bases[rndInt(0, bases.length - 1, 'loot')]);
  return rollWeapon(baseKey, Math.min(10, (floor | 0) + 2));
}

// Legacy compatibility: items on the ground still use a type for colour/visual
const ITEM_TYPES = UPGRADES.filter(u => !u.persistent).slice(0, 3);
function pickItemType() { return ITEM_TYPES[rndInt(0, ITEM_TYPES.length-1)]; }
