// @ts-check
'use strict';

// HUD status indicators: low-HP vignette, floor-modifier banner, and status
// badges. Loaded before src/content.js so legacy script-tag globals keep their
// names while HUD status logic has a smaller owner. Functions intentionally
// resolve runtime globals only when invoked after all browser scripts load.

/** @type {any} */
const _SG = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});

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
  const t = _SG.modBannerTimer;
  if (!t || t <= 0 || !_SG.modifier) return;
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
  if (_SG.modifier) {
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
  // multiplicatively with both via Player.effectiveAtk() in player-damage.js.
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
  // Local alias `ss` mirrors the player-damage.js alias of the same
  // name — keeps the badge gate predicate STRUCTURALLY IDENTICAL to the
  // multiplier gate after `this.`/`player.` receiver normalisation, so
  // the cross-file alignment test (tests/stride-hud.test.js) can compare
  // them directly via strict equality (no alias-substitution rule needed).
  //
  // Defensive `player.perks &&` null-check matches the codebase pattern
  // (legacy player shapes that bypass the ctor may lack .perks). Cross-
  // file desync defence (per stored memory 'HUD status fx'): the per-
  // stack rate (0.05) is a literal in BOTH the HUD label here AND the
  // STRIDE_DMG_PER_STACK constant in player-perk-tuning.js. The companion
  // test parses the tuning source and asserts the literals match.
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
  // below) AND the player-perk-tuning.js DEADEYE_CHARGE_TIME constant. The
  // companion test parses player-perk-tuning.js and asserts the content.js
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
  // `combo` is declared later in src/content.js, so status.js treats it as a
  // cross-file global exactly like entities.js does. Runtime calls happen after
  // all scripts load, but the guard keeps early VM/source harnesses from
  // throwing if they exercise this function in isolation.
  //
  // Cross-file desync defence (per stored memory 'HUD status fx' + PR #280
  // pattern): the per-step rate (0.03) and cap (0.30) are hard-coded in BOTH
  // entities.js (the multiplier) and the HUD label below. The companion test
  // tests/overdrive-hud.test.js extracts both literals from entities.js and
  // asserts the content.js label uses the same numeric values, so a future
  // re-tune (e.g. +5% per level, +50% cap) trips the test and forces both
  // sites to be updated in lockstep.
  const overdriveCombo = (typeof combo !== 'undefined' && combo) ? combo.count : 0;
  if (player.perks && player.perks.OVERDRIVE && overdriveCombo >= 2) {
    const c = overdriveCombo;
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
