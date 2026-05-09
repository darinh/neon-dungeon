// @ts-check
'use strict';

// Enemy status-effect ticking loads after src/entities.js so the game loop can
// call it at runtime while the body reuses entity combat globals.

// Tick enemy status effects (called in update loop per enemy)
/**
 * @param {any} [enemy]
 * @param {any} [dt]
 */
function tickEnemyStatusEffects(enemy, dt) {
  // Burn
  if (enemy.burnTimer > 0) {
    enemy.burnTimer -= dt;
    // PHASING: burn timer ticks but deals no damage during immune window
    if (!enemy.phaseImmune && !enemy._wrPhased) {
      let dmg = enemy.burnDps * dt;
      // SHIELDED: burn resets regen delay and damages shield first.
      // Gated on the SHIELDED affix specifically — SHIELDER's directional
      // shield (which also uses shieldHp) must NOT be drained from
      // omnidirectional DoT (would bypass the front-arc-only design AND
      // would leave shieldBrokenTimer unset → permanent shield-down bug).
      if (enemy.eliteAffix === 'SHIELDED') {
        enemy.shieldRegenDelay = 0;
        if (enemy.shieldHp > 0) {
          const absorbed = Math.min(enemy.shieldHp, dmg);
          enemy.shieldHp -= absorbed;
          dmg -= absorbed;
        }
      }
      if (dmg > 0) enemy.hp -= dmg;
      // REGENERATIVE floor modifier: burn DoT bypasses takeDamage by
      // direct hp subtraction, so it must reset _regenTimer here too —
      // otherwise burn-and-retreat keeps the regen clock counting up
      // while the enemy is actively losing HP. Gated on dmg > 0 (post-
      // shield-absorb) to mirror the takeDamage `actual > 0` reset, and
      // on the modifier so non-REGENERATIVE floors don't pay the
      // hidden-class transition cost. Caught by gpt-5.3-codex review
      // 2026-04-27.
      if (dmg > 0 && _EG.modifier === 'REGENERATIVE') enemy._regenTimer = 0;
      if (rand('cosmetic') < dt * 4) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff6600', 1);
      if (enemy.hp <= 0 && !enemy.dead) {
        enemy.hp = 0;
        if (!enemy._lastHitCtx) enemy._lastHitCtx = { name:'Burn', isProc:true };
        else enemy._lastHitCtx.isProc = false;
        enemy.die();
      }
    }
    if (enemy.burnTimer <= 0) { enemy.burnTimer = 0; enemy.burnDps = 0; }
  }
  // Poison (TOXIC 'of Toxin' suffix) — stacking DoT, mirrors burn
  // structure with the per-stack damage scale and a stacks-reset on
  // timer expiry.
  if (enemy.poisonTimer > 0) {
    enemy.poisonTimer -= dt;
    // PHASING / WRAITH-phase: poison timer ticks but deals no damage
    // during the immune window. Mirrors burn's gate so a phasing mob
    // can't be burst-killed mid-phase by accumulated poison ticks.
    if (!enemy.phaseImmune && !enemy._wrPhased) {
      let dmg = (enemy.poisonStacks || 0) * 0.5 * dt;
      // SHIELDED elite affix: poison resets shield regen delay and
      // damages the shield first, mirroring burn's handling. Gated
      // on the SHIELDED affix specifically so SHIELDER's directional
      // shield (also uses shieldHp) is NOT drained from omnidirectional
      // DoT — same defense-in-depth rationale as burn.
      if (enemy.eliteAffix === 'SHIELDED') {
        enemy.shieldRegenDelay = 0;
        if (enemy.shieldHp > 0) {
          const absorbed = Math.min(enemy.shieldHp, dmg);
          enemy.shieldHp -= absorbed;
          dmg -= absorbed;
        }
      }
      if (dmg > 0) enemy.hp -= dmg;
      // REGENERATIVE floor modifier: poison DoT bypasses takeDamage
      // by direct hp subtraction, so it must reset _regenTimer here
      // too — otherwise poison-and-retreat keeps the regen clock
      // counting up while the enemy actively loses HP. Mirrors the
      // burn-DoT reset above. Gated on dmg > 0 (post-shield-
      // absorb) and on the modifier so non-REGENERATIVE floors don't
      // pay the hidden-class transition cost.
      if (dmg > 0 && _EG.modifier === 'REGENERATIVE') enemy._regenTimer = 0;
      if (rand('cosmetic') < dt * 3) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#88dd44', 1);
      if (enemy.hp <= 0 && !enemy.dead) {
        enemy.hp = 0;
        // _lastHitCtx attribution: mirror burn — if no prior ctx, set
        // a Toxin-named proc; if a prior ctx exists (the player's
        // direct hit that applied the poison), unmark isProc so on-
        // kill affixes (GREEDY/LUCKY/SALVAGE/DETONATE) credit the
        // poison-finished kill to the weapon that landed the last
        // direct hit. Same path burn relies on.
        if (!enemy._lastHitCtx) enemy._lastHitCtx = { name:'Toxin', isProc:true };
        else enemy._lastHitCtx.isProc = false;
        enemy.die();
      }
    }
    if (enemy.poisonTimer <= 0) { enemy.poisonTimer = 0; enemy.poisonStacks = 0; }
  }
  // Slow decay
  if (enemy.slowTimer > 0) {
    enemy.slowTimer -= dt;
    if (enemy.slowTimer <= 0) { enemy.slowTimer = 0; enemy.slowFactor = 1; }
  }
  // Voltaic shock ICD decay
  if (enemy._shockICD > 0) enemy._shockICD -= dt;
  // Recoil-affix knockback ICD decay (per-enemy, prevents perma-shove)
  if (enemy._recoilICD > 0) enemy._recoilICD -= dt;
  // STAGGER 'of Staggering' affix: per-enemy hit cooldown decay (prevents
  // rapid-fire weapons from chaining 0.4s slows into a permanent 0.5x
  // cripple — the 0.5s ICD ensures a sustained ~80% effective speed
  // ceiling under uninterrupted DPS, vs FROST's flat 0.7x for 2s).
  if (enemy._staggerICD > 0) enemy._staggerICD -= dt;
  // MARK 'of Marking' affix: per-enemy mark window decay (3s on apply).
  // Unlike burn/slow, no per-tick effect — the timer is read at takeDamage
  // entry. Self-clearing (no per-floor reset needed).
  if (enemy._markedTimer > 0) {
    enemy._markedTimer -= dt;
    if (enemy._markedTimer <= 0) enemy._markedTimer = 0;
  }
}
