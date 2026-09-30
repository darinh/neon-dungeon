// @ts-check
'use strict';

// Loaded before src/content.js so these HUD globals keep their names.
// Runtime globals resolve only when the functions run.

/** @type {any} */
const _SG = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});

/**
 * @param {any} player
 */
function drawDangerVignette(player) {
  const frac = player.hp / player.maxHp;
  if (frac > 0.25 || player.hp <= 0) return;
  // REDUCED MOTION freezes the pulse at 0.5: the vignette stays, the flicker is the photosensitive trigger.
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

  const slideY = elapsed < fadeIn ? -20 * (1 - elapsed / fadeIn) : (t < fadeOut ? -20 * (1 - t / fadeOut) : 0);
  const cy = 50 + safeTop + slideY;

  ctx.save();
  ctx.globalAlpha = alpha;

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

  ctx.shadowBlur = 12; ctx.shadowColor = m.colour;
  ctx.strokeStyle = m.colour; ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

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

  // After slide-in only, so the hint doesn't flicker mid-slide. Key/tap dismissal is outside this draw.
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

/** @type {Record<string, any>} */
const statusFx = {};
let statusBadgeReservedHeight = 0;
/**
 * @param {any} player
 */
function getStatusEffects(player) {
  const fx = [];
  if (_SG.modifier) {
    const m = getMod();
    fx.push({ id: 'mod', icon: m.icon, label: m.label, colour: m.colour });
  }
  if (player.speedTimer > 0 && player.speedBoost < 0) {
    fx.push({ id: 'slow', icon: '❄', label: 'SLOW', colour: '#6688cc', timer: player.speedTimer });
  }
  if (player.burnTimer > 0) {
    fx.push({ id: 'burn', icon: '🔥', label: player.burnTimer.toFixed(1)+'s', colour: '#ff6600' });
  }
  // Shock locks input; the countdown is when control returns.
  if (player.shockTimer > 0) {
    fx.push({ id: 'shocked', icon: '⚡', label: player.shockTimer.toFixed(1)+'s', colour: '#ffee44' });
  }
  if (player.perks.ENERGY_SHIELD && !player.energyShield) {
    fx.push({ id: 'shield', icon: '🛡', label: Math.ceil(player.energyShieldTimer) + 's', colour: '#4466aa' });
  }
  if (player.perks.ENERGY_SHIELD && player.energyShield) {
    fx.push({ id: 'shield-up', icon: '🛡', label: 'UP', colour: '#4488ff' });
  }
  // NANO_REGEN heals whenever hp < maxHp; regenerator only after 3s out of combat.
  // One badge for both. The 3s grace is intentionally not its own waiting state.
  const _nanoRegen = (player.upgrades.NANO_REGEN || 0) > 0;
  const _metaRegen = (player.regenPerSec || 0) > 0
    && (player._outOfCombatTimer || 0) > 3;
  if ((_nanoRegen || _metaRegen) && player.hp < player.maxHp) {
    fx.push({ id: 'regen', icon: '♻', label: 'REGEN', colour: '#00ff88' });
  }
  if (player.dashCooldown > 0) {
    fx.push({ id: 'dash-cd', icon: '⇧', label: player.dashCooldown.toFixed(1) + 's', colour: '#7a6a33' });
  } else {
    fx.push({ id: 'dash', icon: '⇧', label: 'RDY', colour: '#ffb700' });
  }
  if (player.hackware) {
    const hw = HACKWARE[player.hackware];
    if (player.hackwareCooldown > 0) {
      fx.push({ id: 'hw-cd', icon: hw.icon, label: player.hackwareCooldown.toFixed(1)+'s', colour: '#665533' });
    } else {
      fx.push({ id: 'hw-rdy', icon: hw.icon, label: 'RDY', colour: hw.colour });
    }
  }
  if (player.cloakTimer > 0) {
    fx.push({ id: 'cloak', icon: '◇', label: player.cloakTimer.toFixed(1)+'s', colour: '#cc44ff' });
  }
  if (player.perks.BERSERKER && player.hp > 0 && player.hp / player.maxHp <= 0.25) {
    fx.push({ id: 'berserker', icon: '🔥', label: 'RAGE', colour: '#ff4400' });
  }
  if (player.perks.PRISTINE && player.hp > 0 && player.hp / player.maxHp >= 0.90) {
    fx.push({ id: 'pristine', icon: '✧', label: 'PRIME', colour: '#88ffee' });
  }
  // Gate must match Player.takeDamage's 0.85 multiplier (tests/bulwark-hud.test.js).
  // Icon and #88ccff must match the perk card.
  if (player.perks && player.perks.BULWARK && player.maxHp > 0 && player.hp / player.maxHp >= 0.75) {
    fx.push({ id: 'bulwark', icon: '◈', label: 'WARD', colour: '#88ccff' });
  }
  // `ss` must match the player-damage.js alias so tests/stride-hud.test.js can strict-equal the gates.
  // 0.05 must match STRIDE_DMG_PER_STACK in player-perk-tuning.js.
  const ss = (player._strideStacks || 0);
  if (player.perks && player.perks.STRIDE && ss > 0) {
    const mul = (1 + 0.05 * ss).toFixed(2);
    fx.push({ id: 'stride', icon: '⇶', label: 'RUSH ×' + mul, colour: '#00ffaa' });
  }
  // Stillness latch: next shot is ×1.5. Separate badge from STRIDE so both can show.
  if (player.perks && player.perks.DEADEYE && player._steadyReady) {
    fx.push({ id: 'deadeye', icon: '◎', label: 'AIM', colour: '#ffee88' });
  }
  // Same id as the AIM badge: drawStatusBar crossfades distinct ids for ~200ms,
  // and this latch flips often enough that two ids would flicker.
  // Sibling if, not else-if: alignment tests do not see an else-if's implicit negation.
  // Literal 1 must match DEADEYE_CHARGE_TIME. `|| 0` keeps NaN out of toFixed.
  if (player.perks && player.perks.DEADEYE && !player._steadyReady
      && (player._steadyChargeTime || 0) > 0) {
    const remaining = Math.max(0, 1 - (player._steadyChargeTime || 0));
    fx.push({ id: 'deadeye', icon: '◎', label: remaining.toFixed(1)+'s', colour: '#887744' });
  }
  // Perk and meta second_wind fire independently; one badge if either revive is unused.
  const _perkSW = player.perks.SECOND_WIND && !player.secondWindUsed;
  const _metaSW = player.metaFlags
    && (player.metaFlags.second_wind | 0) > 0
    && !player._metaSecondWindUsed;
  if (_perkSW || _metaSW) {
    fx.push({ id: 'second-wind', icon: '↺', label: 'LIFE', colour: '#00ddff' });
  }
  // Label is the next-hit multiplier, not the stack count. Streak > 0 guards a timer set without a streak.
  // 0.05 and the cap of 6 must match the damage site.
  if (player.perks && player.perks.HOT_HAND && player._hotHandTimer > 0
      && player._hotHandStreak > 0) {
    const stacks = Math.min(player._hotHandStreak | 0, 6);
    const mul = (1 + stacks * 0.05).toFixed(2);
    fx.push({ id: 'hot-hand', icon: '♨', label: '×' + mul, colour: '#ff5522' });
  }
  // 0.15 per level must match meta/behavior.js (tests/momentum-hud.test.js).
  if (player.metaFlags && (player.metaFlags.momentum | 0) > 0
      && (player._momentumTimer || 0) > 0) {
    const lv = player.metaFlags.momentum | 0;
    const mul = (1 + 0.15 * lv).toFixed(2);
    fx.push({ id: 'momentum', icon: '▶', label: '×' + mul, colour: '#ff8844' });
  }
  // `combo` is declared later in src/content.js; the typeof guard keeps isolated harnesses from throwing.
  // Gate, 0.03, and 0.30 must match the damage site (tests/overdrive-hud.test.js).
  const overdriveCombo = (typeof combo !== 'undefined' && combo) ? combo.count : 0;
  if (player.perks && player.perks.OVERDRIVE && overdriveCombo >= 2) {
    const c = overdriveCombo;
    const mul = (1 + Math.min(0.30, (c - 1) * 0.03)).toFixed(2);
    fx.push({ id: 'overdrive', icon: '❯', label: '×' + mul, colour: '#ff00c8' });
  }
  // Count advances on every shot, even before the upgrade is owned, so the badge can appear mid-count.
  // The 8 must match consumeSurgeShot in meta/behavior.js.
  if (player.metaFlags && (player.metaFlags.surge | 0) > 0) {
    const cnt = (player._surgeShotCount | 0) % 8;
    fx.push({ id: 'surge', icon: '⊙', label: cnt + '/8', colour: '#ffcc44' });
  }
  const augCount = Object.keys(player.augments || {}).length;
  if (augCount > 0) {
    fx.push({ id: 'augments', icon: '◆', label: augCount + '/' + MAX_AUGMENTS, colour: '#cc44ff' });
  }
  if (player.adrenalineTimer > 0) {
    fx.push({ id: 'adr-buff', icon: '💉', label: player.adrenalineTimer.toFixed(1)+'s', colour: '#ff4444' });
  }
  if (hasAugment('REACTIVE_ARMOR') && player.reactiveArmorCD > 0) {
    fx.push({ id: 'reactive-cd', icon: '💥', label: Math.ceil(player.reactiveArmorCD)+'s', colour: '#993322' });
  }
  if (player.perks && player.perks.LAST_STAND && player.lastStandTimer > 0) {
    fx.push({ id: 'last-stand', icon: '✦', label: player.lastStandTimer.toFixed(1)+'s', colour: '#ffaa00' });
  } else if (player.perks && player.perks.LAST_STAND && player.lastStandCD > 0) {
    // else-if: trigger sets lastStandTimer and lastStandCD together, so both badges would show.
    // ceil, not tenths: the recharge is ~60s.
    fx.push({ id: 'last-stand-cd', icon: '✦', label: Math.ceil(player.lastStandCD)+'s', colour: '#886622' });
  }
  // Countdown only: the bonus is a fixed +50%, so a ×1.50 label would be static noise.
  if (player.perks && player.perks.RETRIBUTION && player.retributionTimer > 0) {
    fx.push({ id: 'retribution', icon: '☄', label: player.retributionTimer.toFixed(1)+'s', colour: '#ff2266' });
  }
  // Ownership gate matches the offensive multiplier, not the defensive site
  // (that one also exempts env DoT via ignoreDefense).
  if (player.perks && player.perks.GLASS_CANNON) {
    fx.push({ id: 'glass-cannon', icon: '⟁', label: 'GLASS', colour: '#ff66aa' });
  }
  if (player.disruptionFieldActive) {
    fx.push({ id: 'disrupted', icon: '⊘', label: 'DISRUPTED', colour: '#ff44aa' });
  }
  // Dash bypasses the slow. Use `dashTimer <= 0`, not `!(dashTimer > 0)`: they diverge for NaN.
  if (player.toxicSlowActive && player.dashTimer <= 0) {
    fx.push({ id: 'toxic-slow', icon: '☣', label: 'TOXIC', colour: '#88ff44' });
  }
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
  if (ids.length === 0) { statusBadgeReservedHeight = 0; return; }

  const hasKeys = player.keys.red + player.keys.blue + player.keys.gold > 0;
  // Offsets scale with settings.textScale to track the key row in render.js drawHUD.
  // Floors stop the row collapsing into the HUD (0.85×) or the keys (hasKeys).
  const badgeYOffset = hasKeys
    ? Math.max(24, Math.round(32 * settings.textScale))
    : Math.max(12, Math.round(16 * settings.textScale));
  const y = layout.hudTop - badgeYOffset;
  const fs = Math.max(6, Math.round((layout.compact ? 8 : 9) * settings.textScale));
  const badgeH = fs + 6;
  statusBadgeReservedHeight = badgeYOffset + badgeH - 2;
  // 120 matches drawMinimap's MW so a scaled minimap is not overlapped.
  const minimapReserve = Math.round(120 * settings.minimapScale) + 10;
  const maxX = W - minimapReserve - safeRight;
  let x = 14 + safeLeft;

  ctx.save();
  ctx.font = `${fs}px monospace`;

  for (const id of ids) {
    const s = statusFx[id];
    if (s.alpha <= 0) continue;
    const text = s.icon + (s.label ? ' ' + s.label : '');
    const tw = ctx.measureText(text).width;
    const badgeW = tw + 8;

    if (x + badgeW > maxX) break;

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

/**
 * @param {any} player
 * @returns {number}
 */
function getStatusBadgeReservedHeight(player) {
  void player;
  return statusBadgeReservedHeight;
}
