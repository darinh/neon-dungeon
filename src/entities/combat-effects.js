// @ts-check
'use strict';

// Loads after the entity support modules that provide AoE damage helpers, and before gameplay runs.
/**
 * Used by takeDamage's phaseImmune / _wrPhased early-return so stun-only
 * effects still land when damage is absorbed. Mirrors applyHitEffects' shock
 * branch (ICD, duration, particles, audio) — update both together.
 *
 * @private
 * @param {any} enemy
 * @param {any} hitCtx  string (legacy) or { effects, isProc } object
 */
function _applyStunOnlyEffects(enemy, hitCtx) {
  if (!hitCtx || typeof hitCtx === 'string') return;
  if (hitCtx.isProc) return;
  const effects = hitCtx.effects;
  if (!effects || !effects.length) return;
  if (effects.indexOf('shock') === -1) return;
  const icd = enemy._shockICD || 0;
  if (icd > 0) return;
  const dur = enemy.isBoss ? 0.3 : 0.6;
  enemy.stunTimer = Math.max(enemy.stunTimer || 0, dur);
  enemy._shockICD = 2.0;
  spawnParticles(enemy.x, enemy.y, 'SPARK', '#ffee44', 6);
  audio.voltaicHit();
}

/**
 * @param {any} [enemy]
 * @param {any} [actualDmg]
 * @param {any} [hitCtx]
 */
function applyHitEffects(enemy, actualDmg, hitCtx) {
  const effects = hitCtx.effects || [];
  if (!effects.length) return;
  for (const eff of effects) {
    if (eff === 'burn') {
      enemy.burnTimer = 3; enemy.burnDps = 3;
      spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff6600', 3);
    } else if (eff === 'slow') {
      enemy.slowTimer = 2; enemy.slowFactor = 0.7;
      spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#66ccff', 3);
    } else if (eff === 'leech') {
      const heal = Math.max(1, Math.round(actualDmg * 0.08));
      if (_EG.player) {
        _EG.player.hp = Math.min(_EG.player.maxHp, _EG.player.hp + heal);
        spawnDmgText(_EG.player.x, _EG.player.y, '+' + heal, '#ff0066');
      }
    } else if (eff === 'chain') {
      if (rand('combat') < 0.20) {
        let best = null, bestD = 3;
        for (const e of enemies) {
          if (e === enemy || e.dead) continue;
          if (e._wrPhased) continue;
          const d = dist(enemy.x, enemy.y, e.x, e.y);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const chainDmg = Math.round(actualDmg * 0.5);
          best.takeDamage(chainDmg, { name: hitCtx.name, isProc: true });
          if (!_EG._chainBolts) _EG._chainBolts = [];
          _EG._chainBolts.push({ x1:enemy.x, y1:enemy.y, x2:best.x, y2:best.y, timer:0.15, colour:'#ffff44' });
          audio.hit(false, 'Railgun');
        }
      }
    }
    else if (eff === 'shock') {
      // Per-enemy ICD so rapid hits cannot perma-stun.
      const icd = enemy._shockICD || 0;
      if (icd <= 0) {
        const dur = enemy.isBoss ? 0.3 : 0.6;
        enemy.stunTimer = Math.max(enemy.stunTimer || 0, dur);
        enemy._shockICD = 2.0;
        spawnParticles(enemy.x, enemy.y, 'SPARK', '#ffee44', 6);
        audio.voltaicHit();
      }
    }
    else if (eff === 'recoil') {
      // Per-enemy ICD so rapid fire cannot perma-shove. Skip bosses to keep
      // arena positions pinned (triggerShockPulse makes the same boss carve-out),
      // disguised mimics because displacement leaks the ambush, and phased mobs
      // if a damage path skipped its normal prefilters.
      if (enemy.isBoss) continue;
      if (enemy._disguised) continue;
      if (enemy._wrPhased) continue;
      const icd = enemy._recoilICD || 0;
      if (icd > 0) continue;
      const player = _EG.player;
      const map = _EG.dungeon && _EG.dungeon.map;
      if (!player || !map) continue;
      const dx0 = enemy.x - player.x, dy0 = enemy.y - player.y;
      const d0 = Math.hypot(dx0, dy0);
      let nxv, nyv;
      if (d0 > 0.0001) { nxv = dx0 / d0; nyv = dy0 / d0; }
      else { nxv = 1; nyv = 0; }
      // Move in 0.1-tile steps so the enemy can slide along an unblocked axis; this mirrors triggerShockPulse's wall handling.
      const KNOCK = 0.4;
      const STEP = 0.1;
      const steps = Math.ceil(KNOCK / STEP);
      let curX = enemy.x, curY = enemy.y;
      for (let s = 0; s < steps; s++) {
        const tryX = curX + nxv * STEP;
        const tryY = curY + nyv * STEP;
        const fxK = Math.floor(tryX), fyK = Math.floor(curY);
        const xfK = Math.floor(curX), yfK = Math.floor(tryY);
        const xOk = fxK >= 0 && fxK < MAP_W && fyK >= 0 && fyK < MAP_H && isPassable(map[fyK][fxK]);
        const yOk = xfK >= 0 && xfK < MAP_W && yfK >= 0 && yfK < MAP_H && isPassable(map[yfK][xfK]);
        if (!xOk && !yOk) break;
        if (xOk) curX = tryX;
        if (yOk) curY = tryY;
      }
      const finalFx = Math.floor(curX), finalFy = Math.floor(curY);
      if (finalFx >= 0 && finalFx < MAP_W && finalFy >= 0 && finalFy < MAP_H && isPassable(map[finalFy][finalFx])) {
        enemy.x = curX;
        enemy.y = curY;
      }
      enemy._recoilICD = 0.35;
      spawnParticles(enemy.x, enemy.y, 'SPARK', '#ffaa66', 4);
    }
    else if (eff === 'stagger') {
      // Unlike FROST (flat refresh, no ICD), this is a short burst whose ICD ticks in tickEnemyStatusEffects before Enemy.update. Skip phased mobs so a damage path that skips prefilters cannot stutter an intangible mob.
      if (enemy._wrPhased) continue;
      const icd = enemy._staggerICD || 0;
      if (icd > 0) continue;
      // Stronger-wins, same as STATIC_FIELD in src/content/hackware.js: never shorten a longer slow, but take the stronger factor. Bosses are not skipped; the ICD already rate-limits them.
      enemy.slowTimer = Math.max(enemy.slowTimer || 0, 0.4);
      enemy.slowFactor = Math.min(enemy.slowFactor || 1, 0.5);
      enemy._staggerICD = 0.5;
      spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#88aaff', 3);
    }
    else if (eff === 'execute') {
      if (enemy.isBoss) continue;
      if (enemy._disguised) continue;
      if (enemy._wrPhased) continue;
      if (enemy.dead || enemy.hp <= 0) continue;
      if (!(enemy.maxHp > 0)) continue;
      if ((enemy.hp / enemy.maxHp) > 0.20) continue;
      spawnDmgText(enemy.x, enemy.y, 'EXECUTE', '#aa44ff');
      spawnParticles(enemy.x, enemy.y, 'EXPLOSION', '#aa44ff', 12);
      enemy.hp = 0;
      enemy.die();
    }
    else if (eff === 'mark') {
      // The +30% is applied in takeDamage (mark effect and _markedTimer), so this hit only opens the window. Skip disguised (the particle would leak the ambush) and phased mobs (survives a damage path that skips prefilters). Bosses are not skipped.
      if (enemy._disguised) continue;
      if (enemy._wrPhased) continue;
      if (enemy.dead) continue;
      enemy._markedTimer = 3;
      spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff44aa', 3);
    }
    else if (eff === 'siphon') {
      // Counter is on the player so it accumulates across enemies, weapons, and floors in a run. Not saved — 0-2 hits of loss keeps it out of the save schema. Procs and burn DoT never reach this function.
      const _splr = _EG.player;
      if (!_splr) continue;
      _splr._siphonHits = (_splr._siphonHits || 0) + 1;
      if (_splr._siphonHits >= 3) {
        _splr._siphonHits = 0;
        _splr.credits += 1;
        spawnDmgText(_splr.x, _splr.y - 0.4, '+1 CR', '#88ff88');
      }
    }
    else if (eff === 'poison') {
      // Tick damage is poisonStacks * 0.5 * dt in tickEnemyStatusEffects; stacks reset when that timer expires. The tick re-checks phaseImmune and _wrPhased, so phased mobs lose stacks without taking damage. Procs and DoT never reach this function.
      enemy.poisonStacks = Math.min(5, (enemy.poisonStacks || 0) + 1);
      enemy.poisonTimer = 4;
      spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#88dd44', 2);
    }
    // 'explode' is handled in applyOnKill
  }
}

/**
 * @param {any} [enemy]
 */
function applyOnKill(enemy) {
  const ctx = enemy._lastHitCtx;
  if (!ctx || ctx.isProc) return;
  const effects = ctx.effects || [];
  if (!effects.includes('explode')) return;
  const aoeR = 2, aoeDmg = 25;
  spawnParticles(enemy.x, enemy.y, 'EXPLOSION', '#ff4400', 18);
  triggerShake(5, 0.18);
  for (const e of enemies) {
    if (e === enemy || e.dead) continue;
    if (dist(e.x, e.y, enemy.x, enemy.y) < aoeR && hasLOS(enemy.x, enemy.y, e.x, e.y, _EG.dungeon.map)) {
      e.takeDamage(aoeDmg, { name: 'Detonation', isProc: true });
    }
  }
  const p = _EG.player;
  if (p && dist(p.x, p.y, enemy.x, enemy.y) < aoeR && hasLOS(enemy.x, enemy.y, p.x, p.y, _EG.dungeon.map)) {
    p.takeDamage(Math.round(aoeDmg * 0.5), 'Detonation');
  }
  damageCratesInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  damageBeaconsInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  damageShieldGensInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  damageCamerasInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  damageLasersInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  damageWallTurretsInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  triggerMinesInRadius(enemy.x, enemy.y, aoeR, _EG.dungeon.map);
}
