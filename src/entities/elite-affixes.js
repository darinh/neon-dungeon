// @ts-check
'use strict';

// Elite-affix runtime hooks load after src/entities.js so Enemy methods can
// resolve them at gameplay time without keeping the subsystem in the core file.

/**
 * @param {any} [enemy]
 * @param {any} [dt]
 */
function tickEliteAffix(enemy, dt) {
  if (!enemy.elite || !enemy.eliteAffix) return;
  const aff = enemy.eliteAffix;
  // shieldRegenDelay is reset on hit in entities.js and status-effects.js.
  if (aff === 'SHIELDED' && enemy.shieldHp < enemy.shieldMax) {
    enemy.shieldRegenDelay += dt;
    if (enemy.shieldRegenDelay >= 2) {
      enemy.shieldHp = Math.min(enemy.shieldMax, enemy.shieldHp + 8 * dt);
      if (rand('cosmetic') < dt * 3) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#4488ff', 1);
    }
  }
  // BERSERKER tempo (up to +50% missing HP) is berserkerMul() in enemy-tempo.js, not this tick.
  if (aff === 'REGENERATING' && enemy.hp < enemy.maxHp) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.025 * dt);
    if (rand('cosmetic') < dt * 2) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#22ff44', 1);
  }
  if (aff === 'PHASING') {
    enemy.phaseTimer += dt;
    if (enemy.phaseTimer >= 4) enemy.phaseTimer -= 4;
    const wasImmune = enemy.phaseImmune;
    enemy.phaseImmune = enemy.phaseTimer >= 3;
    if (enemy.phaseImmune && !wasImmune) audio.phaseShift();
  }
  if (aff === 'VOLATILE' && rand('cosmetic') < dt * 1.5) {
    spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff6600', 1);
  }
  // FRENZY stacks come from notifyFrenzyElites; tempo is berserkerMul(), not this tick.
  // PREDATOR +30% is also berserkerMul() while predatorBuffTimer > 0. Refresh replaces, it does not stack.
  if (aff === 'PREDATOR' && enemy.predatorBuffTimer > 0) {
    enemy.predatorBuffTimer = Math.max(0, enemy.predatorBuffTimer - dt);
    if (rand('cosmetic') < dt * 4) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff0099', 1);
  }
}

/**
 * @param {any} [deathX]
 * @param {any} [deathY]
 */
function notifyFrenzyElites(deathX, deathY) {
  for (const e of enemies) {
    if (e.dead || e.eliteAffix !== 'FRENZY') continue;
    if (e.frenzyStacks >= 2) continue;
    if (dist(e.x, e.y, deathX, deathY) <= 4) {
      e.frenzyStacks++;
      spawnParticles(e.x, e.y, 'EXPLOSION', '#ff4466', 8);
      audio.eliteFrenzy();
      _EG.msg('⚡ FRENZY!', '#ff4466');
    }
  }
}

// Called from Player.takeDamage only after real HP damage (actual > 0), not full absorbs.
// Cue fires only when the timer was 0, so DoT ticks refresh without retriggering audio.
// No LOS. 8 tiles vs FRENZY's 4 because this fires once per damage event, not per kill.
/**
 * @param {any} [px]
 * @param {any} [py]
 */
function notifyPredatorElites(px, py) {
  for (const e of enemies) {
    if (e.dead || e.eliteAffix !== 'PREDATOR') continue;
    if (dist(e.x, e.y, px, py) <= 8) {
      const wasInactive = e.predatorBuffTimer <= 0;
      e.predatorBuffTimer = 3;
      if (wasInactive) {
        spawnParticles(e.x, e.y, 'EXPLOSION', '#ff0099', 8);
        audio.elitePredator();
        _EG.msg('🎯 PREDATOR!', '#ff0099');
      }
    }
  }
}
