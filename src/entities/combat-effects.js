// @ts-check
'use strict';

// Weapon affix effect application helpers. This file loads after the entity
// support modules that provide AoE damage helpers, and before gameplay runs.

// Called on every weapon hit (projectile or melee). hitCtx = {name, affixes, effects, isProc}
/**
 * Apply stun-only weapon effects to a phase-immune enemy. Used by
 * takeDamage's phaseImmune / _wrPhased early-return path so that
 * Voltaic 'shock' (and any future stun-only effect) still reaches
 * SPECTRE/WRAITH/PHASING-affix mobs even though their damage is
 * absorbed. Mirrors the shock branch of applyHitEffects exactly
 * (same ICD, same dur, same particles/audio) so behaviour stays in
 * lock-step - if applyHitEffects' shock tuning changes, update both.
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
        // Find nearest alive enemy within 3 tiles
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
          // Visual: lightning bolt stored for rendering
          if (!_EG._chainBolts) _EG._chainBolts = [];
          _EG._chainBolts.push({ x1:enemy.x, y1:enemy.y, x2:best.x, y2:best.y, timer:0.15, colour:'#ffff44' });
          audio.hit(false, 'Railgun'); // zap sound
        }
      }
    }
    else if (eff === 'shock') {
      // Voltaic: brief stun with per-enemy ICD to prevent perma-stun
      const icd = enemy._shockICD || 0;
      if (icd <= 0) {
        const dur = enemy.isBoss ? 0.3 : 0.6;
        enemy.stunTimer = Math.max(enemy.stunTimer || 0, dur);
        enemy._shockICD = 2.0; // can't re-shock same enemy for 2s
        spawnParticles(enemy.x, enemy.y, 'SPARK', '#ffee44', 6);
        audio.voltaicHit();
      }
    }
    else if (eff === 'recoil') {
      // "of Recoil" suffix: small wall-aware knockback away from the
      // player, per-enemy ICD so rapid-fire weapons can't perma-shove
      // a single target. Skip bosses (no knockback - same precedent as
      // SHOCK_PULSE / KNOCK_PULSE - boss arenas are designed around
      // pinned positions); skip disguised mimics (would leak the
      // ambush via visible displacement before reveal trigger); skip
      // phased WRAITH/TUNNELLER (defensive - projectile/melee prefilters
      // already block them, but if a future damage path skips those filters the
      // recoil shouldn't displace an intangible mob).
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
      // Wall-aware swept knockback. Mirrors triggerShockPulse's pattern:
      // step 0.1 tile, axis-independent isPassable per step, final combined-tile guard. Single-snap is
      // unsafe for any displacement >1 tile, but even at 0.4 we sweep
      // for consistency and to slide along walls instead of stopping
      // dead at the first obstruction.
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
      // STAGGER 'of Staggering' affix: brief slow on hit gated by a
      // per-enemy ICD. Distinct from FROST: FROST is one strong slow
      // pulse (factor 0.7, duration 2s, no ICD) so rapid-fire weapons
      // keep refreshing the same flat slow. STAGGER is short bursts
      // (factor 0.5, duration 0.4s) gated by a 0.5s ICD so the effective
      // speed ceiling under sustained DPS is ~80% (0.4s @ 0.5x + 0.1s @
      // 1.0x per cycle) - a different rhythm: more responsive micro-
      // stutter on every successful hit, less raw uptime than FROST.
      // Per-enemy _staggerICD prevents single-enemy perma-slow from
      // chain-fire weapons; the ICD ticks down in Enemy.update.
      // Skip phased mobs (defensive - projectile/melee prefilters already
      // block them, but if a future damage path skips those filters the stagger
      // shouldn't visibly stutter an intangible mob).
      if (enemy._wrPhased) continue;
      const icd = enemy._staggerICD || 0;
      if (icd > 0) continue;
      // Stronger-wins overlap (matches the STATIC_FIELD pattern in
      // src/content/hackware.js): never truncate a longer/stronger existing
      // slow, but apply STAGGER's stronger factor if it beats the
      // current one. Bosses get the full effect - bosses have no
      // movement-based defensive design that 0.5x speed bypasses, and
      // the ICD already rate-limits the impact.
      enemy.slowTimer = Math.max(enemy.slowTimer || 0, 0.4);
      enemy.slowFactor = Math.min(enemy.slowFactor || 1, 0.5);
      enemy._staggerICD = 0.5;
      spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#88aaff', 3);
    }
    else if (eff === 'execute') {
      // EXECUTE 'of Execution' suffix - finisher: any hit that leaves a
      // non-boss enemy at or below 20% HP kills outright.
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
      // MARK 'of Marking' suffix - applies a 3s mark on every hit (refresh
      // on re-hit). While marked, *follow-up* hits from a Marking weapon
      // deal +30% damage (the bonus is applied at the top of takeDamage,
      // gated on ctx.effects.includes('mark') AND enemy._markedTimer > 0,
      // so the bonus only triggers from this affix's own subsequent hits
      // - first hit gets no bonus, procs (THUNDER chain, RICOCHET) don't
      // re-apply marks, and a non-Marking weapon never benefits from a
      // mark left by a different weapon).
      //
      // Gates (defense in depth):
      //   _disguised - per disguised-mimic-AoE rule. An on-apply particle
      //     would leak the ambush before the reveal trigger; the per-hit
      //     bonus is moot here because takeDamage's wasDisguised reveal
      //     happens before applyHitEffects, but skipping keeps the contract
      //     uniform with RECOIL/SHOCK_PULSE/EXECUTE.
      //   _wrPhased - per weapon-affix-knockback-gates rule. Projectile and
      //     melee prefilters should drop intangible mobs before they reach
      //     takeDamage, but the local re-check survives any future damage path
      //     that bypasses those filters.
      //   isBoss - NOT skipped. Damage-multiplier suffixes (FLAME/FROST/
      //     CHAIN/THUNDER/VOLTAIC) all work on bosses; the design value
      //     of MARK is precisely the focus-fire reward against tanks.
      if (enemy._disguised) continue;
      if (enemy._wrPhased) continue;
      if (enemy.dead) continue;
      enemy._markedTimer = 3;
      spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff44aa', 3);
    }
    else if (eff === 'siphon') {
      // SIPHON 'of Siphoning' suffix - drip economy: every 3rd direct
      // hit awards +1 credit to the player. Counter lives on the player
      // (`_siphonHits`) so it accumulates across enemies, weapon swaps,
      // and floor transitions within a run. Not persisted across
      // save/load - losing 0-2 hits of accumulation is acceptable
      // (saves complexity in src/game.js's save schema).
      //
      // Why this is on-hit rather than on-kill: complements GREEDY
      // (on-kill, scales with floor) by rewarding sustained DPS instead
      // of finishers - strong early-game when 1 CR matters, falls off
      // late-game by design (no floor multiplier).
      //
      // Routing: applyHitEffects is only called from takeDamage behind
      // `if (!ctx.isProc)`, so procs (THUNDER
      // chain, RICOCHET) DO NOT tick the counter. Burn DoT bypasses
      // takeDamage entirely (direct hp subtraction in status-effects.js) so DoT
      // ticks DO NOT tick the counter either - only the player's
      // direct weapon hits drip credits, which is the design intent.
      //
      // Gates (defense in depth - mirrors LEECH which fires on every
      // enemy type without further filtering):
      //   No isShard / isSummon gate - hitting a shard or summoned
      //     ghost is still a real player attack action; consistent
      //     with LEECH healing on hits to those mob classes. The
      //     economic ceiling on summon farming is bounded by the
      //     summoner's spawn rate (PROJECTOR caps at ~1 ghost/2.5s).
      //   No isBoss gate - bosses ARE the high-DPS-target use case.
      //     Comparable to MARK, which also has no boss gate (the
      //     focus-fire reward against tanks is the design point).
      //   No _disguised gate needed - applyHitEffects fires only
      //     after takeDamage's reveal, but adding noise here would
      //     require an extra check; LEECH/FLAME/FROST all skip the
      //     gate too without leaking the ambush.
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
      // TOXIC 'of Toxin' suffix - stacking DoT: each direct hit adds
      // 1 stack (cap 5) and refreshes the 4s decay window. While
      // poisonTimer > 0, the per-tick damage in tickEnemyStatusEffects
      // is `poisonStacks * 0.5 * dt` (so 5 stacks = 2.5 dps). When the
      // timer expires, stacks reset to 0.
      //
      // Why stacks instead of a fixed DoT (FLAME = 3dps for 3s):
      // rewards SUSTAINED DPS - single-shot weapons benefit minimally
      // (1 stack = 0.5 dps) but rapid-fire / multi-projectile weapons
      // ramp quickly to the cap (5 stacks = 2.5 dps for 4s = 10 dmg
      // ceiling). Mechanically distinct from FLAME's burst-and-leave
      // model.
      //
      // Routing: applyHitEffects is gated behind `if (!ctx.isProc)` in
      // takeDamage, so procs (THUNDER chain, RICOCHET) DO NOT
      // add stacks. Burn DoT bypasses takeDamage entirely (this very
      // function isn't called from the DoT path) so DoT ticks of any
      // kind never stack poison either - only direct player weapon
      // hits stack.
      //
      // No isShard / isSummon / isBoss / _disguised / _wrPhased gates
      // here - mirror burn/leech/slow which apply to all mob classes.
      // The DoT tick itself (tickEnemyStatusEffects poison branch)
      // re-checks phaseImmune + _wrPhased so phased mobs lose stacks
      // to the timer without taking damage during the immune window.
      enemy.poisonStacks = Math.min(5, (enemy.poisonStacks || 0) + 1);
      enemy.poisonTimer = 4;
      spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#88dd44', 2);
    }
    // 'explode' is handled in applyOnKill
  }
}

// Called when an enemy dies - checks for on-kill affix effects
/**
 * @param {any} [enemy]
 */
function applyOnKill(enemy) {
  const ctx = enemy._lastHitCtx;
  if (!ctx || ctx.isProc) return;
  const effects = ctx.effects || [];
  if (!effects.includes('explode')) return;
  // AoE explosion (similar to VOLATILE but from weapon affix)
  const aoeR = 2, aoeDmg = 25;
  spawnParticles(enemy.x, enemy.y, 'EXPLOSION', '#ff4400', 18);
  triggerShake(5, 0.18);
  for (const e of enemies) {
    if (e === enemy || e.dead) continue;
    if (dist(e.x, e.y, enemy.x, enemy.y) < aoeR && hasLOS(enemy.x, enemy.y, e.x, e.y, _EG.dungeon.map)) {
      e.takeDamage(aoeDmg, { name: 'Detonation', isProc: true });
    }
  }
  // Also damage player if in range
  const p = _EG.player;
  if (p && dist(p.x, p.y, enemy.x, enemy.y) < aoeR && hasLOS(enemy.x, enemy.y, p.x, p.y, _EG.dungeon.map)) {
    p.takeDamage(Math.round(aoeDmg * 0.5), 'Detonation');
  }
  // Destroy nearby crates
  damageCratesInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Damage nearby beacons
  damageBeaconsInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Damage nearby shield generators
  damageShieldGensInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Damage nearby cameras
  damageCamerasInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Damage nearby laser tripwire emitters
  damageLasersInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Damage nearby wall turrets
  damageWallTurretsInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Trigger nearby mines
  triggerMinesInRadius(enemy.x, enemy.y, aoeR, _EG.dungeon.map);
}
