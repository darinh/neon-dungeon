// @ts-check
'use strict';

// Loaded after src/entities.js so the game loop can call this while it reuses entity combat globals.
/**
 * @param {any} [enemy]
 * @param {any} [dt]
 */
function tickEnemyStatusEffects(enemy, dt) {
  if (enemy.burnTimer > 0) {
    enemy.burnTimer -= dt;
    // phaseImmune and _wrPhased tick the timer but deal no damage.
    if (!enemy.phaseImmune && !enemy._wrPhased) {
      let dmg = enemy.burnDps * dt;
      // SHIELDED affix only. SHIELDER also uses shieldHp; draining it here would skip shieldBrokenTimer and leave the shield down.
      if (enemy.eliteAffix === 'SHIELDED') {
        enemy.shieldRegenDelay = 0;
        if (enemy.shieldHp > 0) {
          const absorbed = Math.min(enemy.shieldHp, dmg);
          enemy.shieldHp -= absorbed;
          dmg -= absorbed;
        }
      }
      if (dmg > 0) enemy.hp -= dmg;
      // Direct hp loss bypasses takeDamage, so reset _regenTimer or regen keeps counting during the DoT.
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
  if (enemy.poisonTimer > 0) {
    enemy.poisonTimer -= dt;
    // Same immune window as burn: timer ticks, no damage.
    if (!enemy.phaseImmune && !enemy._wrPhased) {
      let dmg = (enemy.poisonStacks || 0) * 0.5 * dt;
      // Same SHIELDER shieldHp exclusion as burn.
      if (enemy.eliteAffix === 'SHIELDED') {
        enemy.shieldRegenDelay = 0;
        if (enemy.shieldHp > 0) {
          const absorbed = Math.min(enemy.shieldHp, dmg);
          enemy.shieldHp -= absorbed;
          dmg -= absorbed;
        }
      }
      if (dmg > 0) enemy.hp -= dmg;
      // Same takeDamage bypass as burn: reset _regenTimer on actual hp loss.
      if (dmg > 0 && _EG.modifier === 'REGENERATIVE') enemy._regenTimer = 0;
      if (rand('cosmetic') < dt * 3) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#88dd44', 1);
      if (enemy.hp <= 0 && !enemy.dead) {
        enemy.hp = 0;
        // Clear isProc when a prior hit exists so on-kill affixes credit that weapon, not this DoT.
        if (!enemy._lastHitCtx) enemy._lastHitCtx = { name:'Toxin', isProc:true };
        else enemy._lastHitCtx.isProc = false;
        enemy.die();
      }
    }
    if (enemy.poisonTimer <= 0) { enemy.poisonTimer = 0; enemy.poisonStacks = 0; }
  }
  if (enemy.slowTimer > 0) {
    enemy.slowTimer -= dt;
    if (enemy.slowTimer <= 0) { enemy.slowTimer = 0; enemy.slowFactor = 1; }
  }
  if (enemy._shockICD > 0) enemy._shockICD -= dt;
  // Per-enemy ICD so knockback cannot chain into a permanent shove.
  if (enemy._recoilICD > 0) enemy._recoilICD -= dt;
  // ICD so rapid fire cannot chain the stagger slow into a permanent cripple.
  if (enemy._staggerICD > 0) enemy._staggerICD -= dt;
  // Read at takeDamage; no per-tick effect and no per-floor reset.
  if (enemy._markedTimer > 0) {
    enemy._markedTimer -= dt;
    if (enemy._markedTimer <= 0) enemy._markedTimer = 0;
  }
}
