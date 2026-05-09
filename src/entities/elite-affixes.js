// @ts-check
'use strict';

// Elite-affix runtime hooks load after src/entities.js so Enemy methods can
// resolve them at gameplay time without keeping the subsystem in the core file.

// Tick elite affix behaviours (called per enemy per frame)
/**
 * @param {any} [enemy]
 * @param {any} [dt]
 */
function tickEliteAffix(enemy, dt) {
  if (!enemy.elite || !enemy.eliteAffix) return;
  const aff = enemy.eliteAffix;
  // SHIELDED: regenerate shield after 2s of not being hit
  if (aff === 'SHIELDED' && enemy.shieldHp < enemy.shieldMax) {
    enemy.shieldRegenDelay += dt;
    if (enemy.shieldRegenDelay >= 2) {
      enemy.shieldHp = Math.min(enemy.shieldMax, enemy.shieldHp + 8 * dt);
      if (rand('cosmetic') < dt * 3) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#4488ff', 1);
    }
  }
  // BERSERKER: speed/attack multiplier scales with missing HP (up to +50%)
  // (Applied dynamically in moveToward and meleeAttack via berserkerMul())
  // REGENERATING: heal 2.5% maxHp per second
  if (aff === 'REGENERATING' && enemy.hp < enemy.maxHp) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.025 * dt);
    if (rand('cosmetic') < dt * 2) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#22ff44', 1);
  }
  // PHASING: cycle 0->4s, immune during 3->4
  if (aff === 'PHASING') {
    enemy.phaseTimer += dt;
    if (enemy.phaseTimer >= 4) enemy.phaseTimer -= 4;
    const wasImmune = enemy.phaseImmune;
    enemy.phaseImmune = enemy.phaseTimer >= 3;
    if (enemy.phaseImmune && !wasImmune) audio.phaseShift();
  }
  // VOLATILE: pulsing orange particles (visual warning)
  if (aff === 'VOLATILE' && rand('cosmetic') < dt * 1.5) {
    spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff6600', 1);
  }
  // FRENZY: speed/attack boost from stacks (applied dynamically via frenzyMul())
  // Stacks granted by notifyFrenzyElites() on nearby ally death
  // PREDATOR: decay the lock-on buff timer; while >0 the elite gets a
  // +30% speed/CD bonus via berserkerMul(). Refresh-only -- re-triggering
  // resets the timer rather than stacking. Distinct from FRENZY (stacks
  // on ALLY death) and BERSERKER (own missing HP) -- PREDATOR is event-
  // driven by the PLAYER taking real HP damage. Pulsing red lock-on
  // particles while active so the player can identify the threatened
  // elite at a glance (mirrors VOLATILE's per-frame visual warning).
  if (aff === 'PREDATOR' && enemy.predatorBuffTimer > 0) {
    enemy.predatorBuffTimer = Math.max(0, enemy.predatorBuffTimer - dt);
    if (rand('cosmetic') < dt * 4) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff0099', 1);
  }
}

// Notify FRENZY-affix elites within 4 tiles of a death -- grant a frenzy stack
/**
 * @param {any} [deathX]
 * @param {any} [deathY]
 */
function notifyFrenzyElites(deathX, deathY) {
  for (const e of enemies) {
    if (e.dead || e.eliteAffix !== 'FRENZY') continue;
    if (e.frenzyStacks >= 2) continue; // max 2 stacks
    if (dist(e.x, e.y, deathX, deathY) <= 4) {
      e.frenzyStacks++;
      spawnParticles(e.x, e.y, 'EXPLOSION', '#ff4466', 8);
      audio.eliteFrenzy();
      _EG.msg('⚡ FRENZY!', '#ff4466');
    }
  }
}

// Notify PREDATOR-affix elites within 8 tiles of the player -- grant the
// 3-second lock-on buff. Called from Player.takeDamage on every event
// where REAL HP damage lands (`actual > 0`), gated AFTER the absorb
// short-circuits so bubble/SHIELD DRIVER/ENERGY_SHIELD full-absorbs
// don't trigger lock-on. Refresh-only (max one cue per elite per damage
// event): the audio + glow burst fires on the LEADING edge -- i.e. only
// when the timer was at 0. Re-triggering during an active window silently
// extends the timer, so DoT ticks (burn/toxic/arc/disruption) keep the
// buff alive without spamming cues. Range check is positional only (no
// LOS) -- matches FRENZY's 4-tile death radius pattern; PREDATOR's 8t
// range is doubled because the trigger fires at most once per real-
// damage event (vs FRENZY's once per kill) and the elite needs enough
// reach to be a meaningful threat at the moment the player took the hit.
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
