// @ts-check
'use strict';

// Loaded before src/content.js so script-tag globals keep their names.
// Runtime globals are resolved only when functions run, after every script has loaded.
/** @type {Record<string, any>} */
const HACKWARE = {
  EMP_BURST:    { name:'EMP Burst',    desc:'Stun nearby enemies for 2s',      colour:'#00ddff', icon:'⚡', cooldown:10 },
  PHASE_CLOAK:  { name:'Phase Cloak',  desc:'2.5s invisibility & immunity',    colour:'#cc44ff', icon:'◇', cooldown:14 },
  NANO_SWARM:   { name:'Nano Swarm',   desc:'Homing nanites deal 48 damage',   colour:'#44ff88', icon:'☢', cooldown:10 },
  GRAVITY_WELL: { name:'Gravity Well', desc:'Pull enemies to target for 3s',   colour:'#ff8800', icon:'◎', cooldown:16 },
  STATIC_FIELD: { name:'Static Field', desc:'Electric zone: 10 dps + slow',    colour:'#44ccff', icon:'⌁', cooldown:12 },
  HOLO_DECOY:   { name:'Holo Decoy',   desc:'Hologram taunts enemies for 4s',  colour:'#ff44ff', icon:'⬡', cooldown:12 },
  DECOY_TURRET: { name:'Decoy Turret', desc:'6s allied turret auto-fires',     colour:'#00ffaa', icon:'⊞', cooldown:14 },
  SCRAP_MAGNET: { name:'Scrap Magnet', desc:'Pulls coins & keys (10t) to you', colour:'#ffd700', icon:'◉', cooldown:12 },
  BLINK:        { name:'Blink',        desc:'Teleport 4 tiles in aim direction', colour:'#88ccff', icon:'⌖', cooldown:9 },
  REPAIR_PROTOCOL:{ name:'Repair Protocol', desc:'Heal 4 HP/s for 4s',           colour:'#00ff88', icon:'✚', cooldown:18 },
  REVERSE_POLARITY:{ name:'Reverse Polarity', desc:'Reflect enemy shots in 6t back at owners', colour:'#aaffee', icon:'⇄', cooldown:14 },
  EMP_LINE:     { name:'EMP Line',     desc:'Stun beam: 8t pierce, disables electronics', colour:'#00eecc', icon:'═', cooldown:11 },
  CHRONO_LURE:  { name:'Chrono Lure',  desc:'Marker pulls & stuns enemies after 1s arming', colour:'#ff22aa', icon:'◔', cooldown:13 },
  TIME_DILATION:{ name:'Time Dilation',desc:'4s temporal field: enemies & their bullets crawl', colour:'#6644ff', icon:'⧖', cooldown:14 },
  DATA_SPIKE:   { name:'Data Spike',   desc:'Pierce-beam: 60 dmg (+50% vs elites & bosses)', colour:'#ff4488', icon:'➤', cooldown:12 },
  SHIELD_BUBBLE:{ name:'Shield Bubble',desc:'Energy bubble absorbs 35 dmg for 6s', colour:'#e0e0ff', icon:'⊚', cooldown:16 },
};
const HACKWARE_KEYS = Object.keys(HACKWARE);

/** @type {any[]} */ const hackwareEffects = [];

function canTargetPlayer() {
  const p = _CG.player;
  if (!p || p.hp <= 0) return false;
  if (p.cloakTimer > 0) return false;
  return true;
}

function isPlayerDamageImmune() {
  const p = _CG.player;
  if (!p) return false;
  if (p.dashTimer > 0) return true;
  if (p.cloakTimer > 0) return true;
  // Set by loadFloor() on fresh transitions only, not save-resume. Hazard and mob damage both gate here.
  if ((p._spawnGraceTimer || 0) > 0) return true;
  // Ghostwalk extends i-frames past dashTimer via _dashIFrameTimer. Without this OR the bonus is never read.
  if ((p._dashIFrameTimer || 0) > 0) return true;
  return false;
}

/**
 * @param {any} player
 */
function activateHackware(player) {
  if (!player.hackware || player.hackwareCooldown > 0 || player.hp <= 0) return;
  // Call isPlayerInNullifierAura directly. player.hackwareJammed is set by
  // updateNullifierJam after player.update, so the cache is one frame stale here.
  // Audio and floater: a silent return reads as input lag.
  if (isPlayerInNullifierAura(player)) {
    audio.hackwareJammed();
    spawnDmgText(player.x, player.y, 'JAMMED', '#cc66dd');
    return;
  }
  const hw = HACKWARE[player.hackware];
  if (!hw) return;
  // Factors multiply. AUTONOMY and JAMMED are mutually exclusive at floor roll.
  // Both read _CG.modifier; a different ref silently drops the scalar.
  player.hackwareCooldown = hw.cooldown
    * (hasAugment('OVERCLOCKER') ? 0.7 : 1)
    * (_CG.modifier === 'AUTONOMY' ? 0.75 : 1)
    * (_CG.modifier === 'JAMMED' ? 1.25 : 1);
  const map = _CG.dungeon ? _CG.dungeon.map : null;

  switch (player.hackware) {
    case 'EMP_BURST': {
      audio.hackwareEMP();
      spawnParticles(player.x, player.y, 'EXPLOSION', '#00ddff', 20);
      triggerShake(5, 0.2);
      const radius = 4;
      for (const e of enemies) {
        if (e.dead) continue;
        if (e._disguised) continue; // don't reveal mimics via stun text
        const d = dist(player.x, player.y, e.x, e.y);
        // Phased WRAITH and TUNNELLER skip LOS so EMP can force them out.
        const losOk = e._wrPhased ? true : (map && hasLOS(player.x, player.y, e.x, e.y, map));
        if (d < radius && losOk) {
          // TUNNELLER is not forced here. Its stun handler does the _tnState transition;
          // writing _wrState would mix the two machines.
          if (e._wrPhased && e.type === 'WRAITH') {
            const emerge = e._wrFindEmergeTile(map, player);
            if (emerge) {
              e.x = emerge.x; e.y = emerge.y;
              e._wrState = 'corporeal'; e._wrTimer = 2.0; e._wrPhased = false;
              audio.wraithPhaseIn();
            }
            // No emerge tile: stay phased rather than pop inside a wall.
          }
          const dur = e.isBoss ? 1 : 2;
          e.stunTimer = Math.max(e.stunTimer || 0, dur);
          spawnParticles(e.x, e.y, 'SPARK', '#00ddff', 4);
          spawnDmgText(e.x, e.y, 'STUN', '#00ddff');
        }
      }
      hackwareEffects.push({ type:'emp_ring', x:player.x, y:player.y, age:0, maxAge:0.4, radius });
      if (map) damageShieldGensInRadius(player.x, player.y, radius, 15, map);
      if (map) damageCamerasInRadius(player.x, player.y, radius, 15, map);
      // Hit-test the beam segment, not just the emitter.
      for (const l of lasers) {
        if (l.dead) continue;
        const ax = l.x1, ay = l.y1, bx = l.x2, by = l.y2;
        const abx = bx - ax, aby = by - ay;
        const apx = player.x - ax, apy = player.y - ay;
        const ab2 = abx * abx + aby * aby;
        const t = ab2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2)) : 0;
        const closestX = ax + t * abx, closestY = ay + t * aby;
        const beamDist = dist(player.x, player.y, closestX, closestY);
        if (beamDist < radius) { l.disabled = true; l.disableTimer = LASER_DISABLE_DUR; audio.laserDisable(); }
      }
      for (const wt of wallTurrets) {
        if (wt.dead || wt.hacked) continue;
        if (dist(player.x, player.y, wt.x, wt.y) < radius && hasLOS(player.x, player.y, wt.x, wt.y, map)) {
          hackWallTurret(wt);
        }
      }
      for (const f of disruptionFields) {
        if (f.dead) continue;
        if (dist(player.x, player.y, f.x, f.y) < radius && map && hasLOS(player.x, player.y, f.x, f.y, map)) {
          f.dead = true;
          spawnParticles(f.x, f.y, 'SPARK', '#ff44aa', 6);
        }
      }
      for (const w of gravityWells) {
        if (w.dead) continue;
        if (dist(player.x, player.y, w.x, w.y) < radius && map && hasLOS(player.x, player.y, w.x, w.y, map)) {
          w.dead = true;
          spawnParticles(w.x, w.y, 'SPARK', '#8833ff', 6);
          audio.gravitonCollapse();
        }
      }
      break;
    }
    case 'PHASE_CLOAK': {
      audio.hackwareCloak();
      player.cloakTimer = 2.5;
      spawnParticles(player.x, player.y, 'EXPLOSION', '#cc44ff', 12);
      _CG.msg('◇ PHASE CLOAK ACTIVE', '#cc44ff');
      break;
    }
    case 'NANO_SWARM': {
      audio.hackwareSwarm();
      spawnParticles(player.x, player.y, 'SPARK', '#44ff88', 8);
      for (let i = 0; i < 6; i++) {
        const angle = (TWO_PI / 6) * i;
        hackwareEffects.push({
          type:'swarm', x:player.x, y:player.y,
          vx:Math.cos(angle)*3, vy:Math.sin(angle)*3,
          age:0, maxAge:4, dmg:8, hitCd:0
        });
      }
      break;
    }
    case 'GRAVITY_WELL': {
      audio.hackwareGravity();
      // mouse.x/y are logical px (post-zoom); platform.js normalises before this.
      const cam = getCamera(player);
      const wx = (mouse.x + cam.x) / TILE;
      const wy = (mouse.y + cam.y) / TILE;
      hackwareEffects.push({
        type:'gravity', x:wx, y:wy, age:0, maxAge:3, radius:5
      });
      spawnParticles(wx, wy, 'EXPLOSION', '#ff8800', 15);
      triggerShake(3, 0.15);
      break;
    }
    case 'STATIC_FIELD': {
      audio.hackwareStaticField();
      const cam2 = getCamera(player);
      const sx = (mouse.x + cam2.x) / TILE;
      const sy = (mouse.y + cam2.y) / TILE;
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'static_field') hackwareEffects.splice(j, 1);
      }
      hackwareEffects.push({
        type:'static_field', x:sx, y:sy, age:0, maxAge:5, radius:3,
        dmg:10, hitMap:new Map()
      });
      spawnParticles(sx, sy, 'EXPLOSION', '#44ccff', 15);
      triggerShake(3, 0.15);
      _CG.msg('⌁ STATIC FIELD DEPLOYED', '#44ccff');
      break;
    }
    case 'HOLO_DECOY': {
      audio.holoDecoyDeploy();
      const cam5 = getCamera(player);
      const hx = (mouse.x + cam5.x) / TILE;
      const hy = (mouse.y + cam5.y) / TILE;
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'hologram') {
          for (const e of enemies) { if (e._tauntTarget === hackwareEffects[j]) e._tauntTarget = null; }
          hackwareEffects.splice(j, 1);
        }
      }
      hackwareEffects.push({ type:'hologram', x:hx, y:hy, age:0, maxAge:4 });
      spawnParticles(hx, hy, 'EXPLOSION', '#ff44ff', 12);
      _CG.msg('⬡ HOLO DECOY DEPLOYED', '#ff44ff');
      break;
    }
    case 'DECOY_TURRET': {
      // Aim inside a wall falls back to the player tile; a shot spawned in a wall dies immediately.
      const cam6 = getCamera(player);
      let dx = (mouse.x + cam6.x) / TILE;
      let dy = (mouse.y + cam6.y) / TILE;
      const txi = Math.floor(dx), tyi = Math.floor(dy);
      const tile = (map && map[tyi] != null) ? map[tyi][txi] : null;
      if (tile !== T.FLOOR && tile !== T.DOOR_OPEN) {
        dx = player.x; dy = player.y;
      }
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'decoy_turret') hackwareEffects.splice(j, 1);
      }
      const fl = _CG.floor || 1;
      hackwareEffects.push({
        type:'decoy_turret', x:dx, y:dy, age:0, maxAge:6,
        shootTimer:0.4, shootCd:0.6,
        dmg: Math.round(6 + fl * 1.5),
        range:8, projSpd:7, projRange:10,
        aimAngle:0, hp:1,
      });
      audio.turretHack();
      spawnParticles(dx, dy, 'EXPLOSION', '#00ffaa', 14);
      triggerShake(2, 0.1);
      _CG.msg('⊞ DECOY TURRET DEPLOYED', '#00ffaa');
      break;
    }
    case 'SCRAP_MAGNET': {
      // Pulls isHoard and isKey only. Upgrades, whispers, harvester drops, and
      // shock pulses are skipped so a cast cannot open UI or fire a pickup.
      audio.hackwareScrapMagnet();
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'scrap_magnet') hackwareEffects.splice(j, 1);
      }
      hackwareEffects.push({
        type:'scrap_magnet', x:player.x, y:player.y, age:0, maxAge:1.2,
        radius:10
      });
      spawnParticles(player.x, player.y, 'EXPLOSION', '#ffd700', 12);
      _CG.msg('◉ SCRAP MAGNET', '#ffd700');
      break;
    }
    case 'BLINK': {
      // norm() of a zero vector is [0,0]; facing covers click-on-self. lockAimToMove ignores the mouse.
      let bdx, bdy;
      if (settings.lockAimToMove) {
        bdx = player.facing.x; bdy = player.facing.y;
      } else {
        const cam7 = getCamera(player);
        const ax = (mouse.x + cam7.x) / TILE - player.x;
        const ay = (mouse.y + cam7.y) / TILE - player.y;
        [bdx, bdy] = norm(ax, ay);
        if (!bdx && !bdy) { bdx = player.facing.x; bdy = player.facing.y; }
      }
      // 0.25-tile steps so a single snap cannot tunnel a wall, locked door, or sealed entrance.
      const RANGE = 4, STEP = 0.25;
      const STEPS = Math.ceil(RANGE / STEP);
      const startBX = player.x, startBY = player.y;
      let curBX = startBX, curBY = startBY;
      if (map) {
        for (let s = 0; s < STEPS; s++) {
          const tryX = curBX + bdx * STEP;
          const tryY = curBY + bdy * STEP;
          const fxK = Math.floor(tryX), fyK = Math.floor(curBY);
          const xfK = Math.floor(curBX), yfK = Math.floor(tryY);
          const xOk = fxK >= 0 && fxK < MAP_W && fyK >= 0 && fyK < MAP_H && isPassable(map[fyK][fxK]);
          const yOk = xfK >= 0 && xfK < MAP_W && yfK >= 0 && yfK < MAP_H && isPassable(map[yfK][xfK]);
          if (!xOk && !yOk) break;
          if (xOk) curBX = tryX;
          if (yOk) curBY = tryY;
        }
        // Axis checks can both pass on a diagonal corner that is itself a wall.
        const finalFx = Math.floor(curBX), finalFy = Math.floor(curBY);
        if (!(finalFx >= 0 && finalFx < MAP_W && finalFy >= 0 && finalFy < MAP_H && isPassable(map[finalFy][finalFx]))) {
          curBX = startBX; curBY = startBY;
        }
      } else {
        // No map: refuse rather than translate unchecked.
        curBX = startBX; curBY = startBY;
      }
      // Blocked blink still spends the cooldown; only the fanfare is suppressed.
      if (Math.abs(curBX - startBX) < 0.01 && Math.abs(curBY - startBY) < 0.01) {
        _CG.msg('⌖ BLINK BLOCKED', '#888888');
        break;
      }
      player.x = curBX; player.y = curBY;
      spawnParticles(startBX, startBY, 'EXPLOSION', '#88ccff', 14);
      spawnParticles(curBX,   curBY,   'EXPLOSION', '#88ccff', 14);
      // Reuse dashTrail so blink does not add a render path. Cap is dashTrail's 8.
      const segs = 5;
      for (let si = 1; si <= segs; si++) {
        if (player.dashTrail.length >= 8) break;
        const t = si / segs;
        player.dashTrail.push({
          x: startBX + (curBX - startBX) * t,
          y: startBY + (curBY - startBY) * t,
          alpha: 0.7 - t * 0.3,
        });
      }
      audio.hackwareBlink();
      triggerShake(2, 0.1);
      _CG.msg('⌖ BLINK', '#88ccff');
      break;
    }
    case 'REPAIR_PROTOCOL': {
      // Ticks live in Player.update next to HP_REGEN so the hot path allocates nothing.
      // Full HP refunds the cooldown; a misclick at full health must not spend it.
      if (player.hp >= player.maxHp) {
        player.hackwareCooldown = 0;
        _CG.msg('✚ REPAIR ABORT — FULL HP', '#888888');
        break;
      }
      // _repairTicksLeft decays to 0 on its own. Player.reset is the only cleanup hook.
      player._repairTicksLeft = 4;
      player._repairTickTimer = 1.0;
      audio.heal();
      spawnParticles(player.x, player.y, 'SPARK', '#00ff88', 10);
      _CG.msg('✚ REPAIR PROTOCOL', '#00ff88');
      break;
    }
    case 'REVERSE_POLARITY': {
      // Flipping fromPlayer must clear every per-team field (siphon owner, shock, DoTs, ricochet, hitEnemies).
      const RANGE = 6;
      const RANGE_SQ = RANGE * RANGE;
      let reflected = 0;
      for (const p of projectiles) {
        if (!p || p.dead) continue;
        if (p.fromPlayer) continue;
        // Ally turret shots aim at enemies. Reflecting them would turn them back at the player.
        if (p.isAllyTurret) continue;
        const dx = p.x - player.x;
        const dy = p.y - player.y;
        if (dx*dx + dy*dy > RANGE_SQ) continue;
        p.dx = -p.dx;
        p.dy = -p.dy;
        p.fromPlayer = true;
        p.fromPlayerShot = false;
        p.isAllyTurret = false;
        p.ownerType = 'Reverse Polarity';
        p._owner = null;
        p.weaponName = 'Reverse Polarity';
        p.hitEnemies = new Set();
        p.maxPierces = 0;
        p.piercing = false;
        p.homing = null;
        p.bouncesLeft = 0;
        p._hasRicochet = false;
        p.travelled = 0;
        p._effects = /** @type {any[]} */ ([]);
        p._affixes = /** @type {any[]} */ ([]);
        p.isCrit = false;
        p.colour = '#aaffee';
        // A time_field slow sticks at 0.5 once fromPlayer flips, because the field loop then skips the shot.
        p._timeMul = 1;
        spawnParticles(p.x, p.y, 'SPARK', '#aaffee', 4);
        reflected++;
      }
      audio.reflect();
      spawnParticles(player.x, player.y, 'EXPLOSION', '#aaffee', 16);
      triggerShake(3, 0.15);
      if (reflected > 0) {
        _CG.msg('⇄ REVERSE POLARITY ×' + reflected, '#aaffee');
      } else {
        _CG.msg('⇄ REVERSE POLARITY', '#aaffee');
      }
      break;
    }
    case 'EMP_LINE': {
      audio.hackwareEMPLine();
      // norm() of a zero vector is [0,0]; facing covers click-on-self. lockAimToMove ignores the mouse.
      let edx, edy;
      if (settings.lockAimToMove) {
        edx = player.facing.x; edy = player.facing.y;
      } else {
        const camE = getCamera(player);
        const ax = (mouse.x + camE.x) / TILE - player.x;
        const ay = (mouse.y + camE.y) / TILE - player.y;
        [edx, edy] = norm(ax, ay);
        if (!edx && !edy) { edx = player.facing.x; edy = player.facing.y; }
      }
      // 0.25-tile steps. Without the wall stop the beam clips through walls and stuns past them.
      const MAX_LEN = 8, STEP_E = 0.25;
      const STEPS_E = Math.ceil(MAX_LEN / STEP_E);
      let endX = player.x, endY = player.y;
      if (map) {
        for (let s = 1; s <= STEPS_E; s++) {
          const tx = player.x + edx * s * STEP_E;
          const ty = player.y + edy * s * STEP_E;
          const fx = Math.floor(tx), fy = Math.floor(ty);
          if (fx < 0 || fy < 0 || fx >= MAP_W || fy >= MAP_H) break;
          if (!isPassable(map[fy][fx])) break;
          endX = tx; endY = ty;
        }
      }
      // Inlined so the per-enemy loop allocates nothing.
      // Infinity behind the player: clamping t to 0 would stun a WIDTH bubble backwards.
      const ex = endX - player.x, ey = endY - player.y;
      const segLen2 = ex * ex + ey * ey;
      /** @param {number} px @param {number} py */
      const segDist2 = (px, py) => {
        if (segLen2 < 1e-6) {
          const ddx = px - player.x, ddy = py - player.y;
          return ddx * ddx + ddy * ddy;
        }
        const apx = px - player.x, apy = py - player.y;
        const tRaw = (apx * ex + apy * ey) / segLen2;
        if (tRaw < 0) return Infinity;
        const t = Math.min(1, tRaw);
        const cx = player.x + ex * t, cy = player.y + ey * t;
        const ddx = px - cx, ddy = py - cy;
        return ddx * ddx + ddy * ddy;
      };
      // Endpoint samples miss a laser that crosses the beam between samples.
      /**
       * @param {number} ax @param {number} ay
       * @param {number} bx @param {number} by
       * @param {number} cx @param {number} cy
       * @param {number} dx @param {number} dy
       */
      const segSegDist2 = (ax, ay, bx, by, cx, cy, dx, dy) => {
        const ux = bx - ax, uy = by - ay;
        const vx = dx - cx, vy = dy - cy;
        const a = ux * ux + uy * uy;
        const c = vx * vx + vy * vy;
        // A zero-length segment makes the parametric solve 0/0. Facing a wall is that case.
        if (a < 1e-9 && c < 1e-9) {
          const ddx = ax - cx, ddy = ay - cy;
          return ddx * ddx + ddy * ddy;
        }
        if (c < 1e-9) {
          const t = Math.max(0, Math.min(1, (ux * (cx - ax) + uy * (cy - ay)) / a));
          const closeX = ax + ux * t, closeY = ay + uy * t;
          const ddx = closeX - cx, ddy = closeY - cy;
          return ddx * ddx + ddy * ddy;
        }
        if (a < 1e-9) {
          const t = Math.max(0, Math.min(1, (vx * (ax - cx) + vy * (ay - cy)) / c));
          const closeX = cx + vx * t, closeY = cy + vy * t;
          const ddx = closeX - ax, ddy = closeY - ay;
          return ddx * ddx + ddy * ddy;
        }
        const wx = ax - cx, wy = ay - cy;
        const b = ux * vx + uy * vy;
        const d = ux * wx + uy * wy;
        const eDot = vx * wx + vy * wy;
        const D = a * c - b * b;
        let sN, sD = D, tN, tD = D;
        if (D < 1e-9) {
          sN = 0; sD = 1;
          tN = eDot; tD = c;
        } else {
          sN = b * eDot - c * d;
          tN = a * eDot - b * d;
          if (sN < 0)      { sN = 0;  tN = eDot;     tD = c; }
          else if (sN > sD){ sN = sD; tN = eDot + b; tD = c; }
        }
        if (tN < 0) {
          tN = 0;
          if (-d < 0) sN = 0;
          else if (-d > a) sN = sD;
          else { sN = -d; sD = a; }
        } else if (tN > tD) {
          tN = tD;
          if (-d + b < 0) sN = 0;
          else if (-d + b > a) sN = sD;
          else { sN = -d + b; sD = a; }
        }
        const sc = Math.abs(sN) < 1e-9 ? 0 : sN / sD;
        const tc = Math.abs(tN) < 1e-9 ? 0 : tN / tD;
        const px = wx + sc * ux - tc * vx;
        const py = wy + sc * uy - tc * vy;
        return px * px + py * py;
      };
      const WIDTH = 0.7;
      const WIDTH_SQ = WIDTH * WIDTH;
      // segDist2 alone hits enemies behind a thin wall the beam missed. Phased mobs skip LOS.
      // TUNNELLER is not forced here; its stun handler owns the _tnState transition.
      for (const e of enemies) {
        if (e.dead) continue;
        if (e._disguised) continue;
        if (segDist2(e.x, e.y) > WIDTH_SQ) continue;
        const losOk = e._wrPhased ? true : (map && hasLOS(player.x, player.y, e.x, e.y, map));
        if (!losOk) continue;
        if (e._wrPhased && e.type === 'WRAITH') {
          const emerge = e._wrFindEmergeTile(map, player);
          if (emerge) {
            e.x = emerge.x; e.y = emerge.y;
            e._wrState = 'corporeal'; e._wrTimer = 2.0; e._wrPhased = false;
            audio.wraithPhaseIn();
          }
        }
        e.stunTimer = Math.max(e.stunTimer || 0, e.isBoss ? 0.75 : 1.5);
        spawnParticles(e.x, e.y, 'SPARK', '#00eecc', 4);
        spawnDmgText(e.x, e.y, 'STUN', '#00eecc');
      }
      if (map) {
        for (const l of lasers) {
          if (l.dead) continue;
          if (segSegDist2(player.x, player.y, endX, endY, l.x1, l.y1, l.x2, l.y2) < WIDTH_SQ) {
            l.disabled = true; l.disableTimer = LASER_DISABLE_DUR; audio.laserDisable();
          }
        }
        for (const wt of wallTurrets) {
          if (wt.dead || wt.hacked) continue;
          if (segDist2(wt.x, wt.y) < WIDTH_SQ && hasLOS(player.x, player.y, wt.x, wt.y, map)) {
            hackWallTurret(wt);
          }
        }
        for (const g of shieldGens) {
          if (g.dead) continue;
          if (segDist2(g.x, g.y) < WIDTH_SQ && hasLOS(player.x, player.y, g.x, g.y, map)) {
            damageShieldGen(g, 15);
          }
        }
        for (const cam of cameras) {
          if (cam.dead) continue;
          if (segDist2(cam.x, cam.y) < WIDTH_SQ && hasLOS(player.x, player.y, cam.x, cam.y, map)) {
            damageCamera(cam, 15);
          }
        }
        for (const f of disruptionFields) {
          if (f.dead) continue;
          if (segDist2(f.x, f.y) < WIDTH_SQ && hasLOS(player.x, player.y, f.x, f.y, map)) {
            f.dead = true;
            spawnParticles(f.x, f.y, 'SPARK', '#ff44aa', 6);
          }
        }
        for (const w of gravityWells) {
          if (w.dead) continue;
          if (segDist2(w.x, w.y) < WIDTH_SQ && hasLOS(player.x, player.y, w.x, w.y, map)) {
            w.dead = true;
            spawnParticles(w.x, w.y, 'SPARK', '#8833ff', 6);
            audio.gravitonCollapse();
          }
        }
      }
      // Draw-only. Endpoints are frozen at cast.
      hackwareEffects.push({ type:'emp_line', x1:player.x, y1:player.y, x2:endX, y2:endY, age:0, maxAge:0.45 });
      spawnParticles(player.x, player.y, 'EXPLOSION', '#00eecc', 12);
      spawnParticles(endX, endY, 'SPARK', '#00eecc', 8);
      triggerShake(3, 0.15);
      _CG.msg('═ EMP LINE', '#00eecc');
      break;
    }
    case 'CHRONO_LURE': {
      audio.hackwareChronoLure();
      // A marker inside a wall is unreachable, so aim falls back to the player tile.
      const camCL = getCamera(player);
      let lx = (mouse.x + camCL.x) / TILE;
      let ly = (mouse.y + camCL.y) / TILE;
      const ltxi = Math.floor(lx), ltyi = Math.floor(ly);
      const ltile = (map && map[ltyi] != null) ? map[ltyi][ltxi] : null;
      if (ltile !== T.FLOOR && ltile !== T.DOOR_OPEN) {
        lx = player.x; ly = player.y;
      }
      // One active lure. A second cast would chain detonations.
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'chrono_lure') hackwareEffects.splice(j, 1);
      }
      hackwareEffects.push({
        type:'chrono_lure', x:lx, y:ly, age:0, maxAge:1.6,
        armDuration:1.0, radius:5, detonated:false
      });
      spawnParticles(lx, ly, 'SPARK', '#ff22aa', 8);
      _CG.msg('◔ CHRONO LURE ARMED', '#ff22aa');
      break;
    }
    case 'TIME_DILATION': {
      audio.hackwareTimeDilation();
      // Replacing a field must restore leftover _timeMul or those shots crawl forever.
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'time_field') {
          for (const p of projectiles) {
            if (p && p._timeMul !== undefined && p._timeMul !== 1) p._timeMul = 1;
          }
          hackwareEffects.splice(j, 1);
        }
      }
      hackwareEffects.push({
        type:'time_field', x:player.x, y:player.y, age:0, maxAge:4, radius:4
      });
      spawnParticles(player.x, player.y, 'EXPLOSION', '#6644ff', 16);
      triggerShake(2, 0.12);
      _CG.msg('⧖ TIME DILATION ENGAGED', '#6644ff');
      break;
    }
    case 'DATA_SPIKE': {
      audio.hackwareDataSpike();
      // norm() of a zero vector is [0,0]; facing covers click-on-self. lockAimToMove ignores the mouse.
      let ddx, ddy;
      if (settings.lockAimToMove) {
        ddx = player.facing.x; ddy = player.facing.y;
      } else {
        const camD = getCamera(player);
        const ax = (mouse.x + camD.x) / TILE - player.x;
        const ay = (mouse.y + camD.y) / TILE - player.y;
        [ddx, ddy] = norm(ax, ay);
        if (!ddx && !ddy) { ddx = player.facing.x; ddy = player.facing.y; }
      }
      // 0.25-tile steps. Locked doors, sealed entrances, and voids stop the beam.
      const MAX_LEN = 10, STEP_D = 0.25;
      const STEPS_D = Math.ceil(MAX_LEN / STEP_D);
      let endX = player.x, endY = player.y;
      if (map) {
        for (let s = 1; s <= STEPS_D; s++) {
          const tx = player.x + ddx * s * STEP_D;
          const ty = player.y + ddy * s * STEP_D;
          const fxK = Math.floor(tx), fyK = Math.floor(ty);
          if (fxK < 0 || fyK < 0 || fxK >= MAP_W || fyK >= MAP_H) break;
          if (!isPassable(map[fyK][fxK])) break;
          endX = tx; endY = ty;
        }
      }
      // Inlined so the per-enemy loop allocates nothing. Infinity behind the player avoids a backwards hit bubble.
      const ex = endX - player.x, ey = endY - player.y;
      const segLen2 = ex * ex + ey * ey;
      /** @param {number} px @param {number} py */
      const segDist2 = (px, py) => {
        if (segLen2 < 1e-6) {
          const ddx2 = px - player.x, ddy2 = py - player.y;
          return ddx2 * ddx2 + ddy2 * ddy2;
        }
        const apx = px - player.x, apy = py - player.y;
        const tRaw = (apx * ex + apy * ey) / segLen2;
        if (tRaw < 0) return Infinity;
        const t = Math.min(1, tRaw);
        const cx = player.x + ex * t, cy = player.y + ey * t;
        const ddx2 = px - cx, ddy2 = py - cy;
        return ddx2 * ddx2 + ddy2 * ddy2;
      };
      const WIDTH = 0.5;
      const WIDTH_SQ = WIDTH * WIDTH;
      // Does not bypass phase: EMP is the hard counter, this is kinetic damage.
      // Does not skip disguised mimics: takeDamage reveals them, same as a projectile.
      // segDist2 alone hits enemies behind a thin wall the beam missed.
      const BASE_DMG = 60;
      const ELITE_BOSS_MUL = 1.5;
      let hits = 0;
      for (const e of enemies) {
        if (e.dead) continue;
        if (segDist2(e.x, e.y) > WIDTH_SQ) continue;
        if (!map || !hasLOS(player.x, player.y, e.x, e.y, map)) continue;
        const dmg = Math.round(BASE_DMG * ((e.isBoss || e.elite) ? ELITE_BOSS_MUL : 1));
        const dealt = e.takeDamage(dmg, { name: 'Data Spike', isProc: false });
        if (dealt > 0) hits++;
        spawnParticles(e.x, e.y, 'SPARK', '#ff4488', 4);
      }
      // Damage only. Electronics disable stays on the EMP family.
      hackwareEffects.push({ type:'data_spike', x1:player.x, y1:player.y, x2:endX, y2:endY, age:0, maxAge:0.4 });
      spawnParticles(player.x, player.y, 'EXPLOSION', '#ff4488', 12);
      spawnParticles(endX, endY, 'SPARK', '#ff4488', 8);
      triggerShake(3, 0.15);
      if (hits > 0) {
        _CG.msg('➤ DATA SPIKE ×' + hits, '#ff4488');
      } else {
        _CG.msg('➤ DATA SPIKE', '#ff4488');
      }
      break;
    }
    case 'SHIELD_BUBBLE': {
      // takeDamage drains this pool before one-shot shields. Inverting that makes the bubble useless beside a ready one-shot.
      // Recast while a bubble is up refunds the cooldown so a misclick cannot refresh a partial pool.
      if (player.bubbleHp > 0 && player.bubbleTimer > 0) {
        player.hackwareCooldown = 0;
        _CG.msg('⊚ BUBBLE ALREADY ACTIVE', '#888888');
        break;
      }
      audio.hackwareShieldBubble();
      player.bubbleHp = 35;
      player.bubbleTimer = 6;
      spawnParticles(player.x, player.y, 'SPARK', '#e0e0ff', 14);
      _CG.msg('⊚ SHIELD BUBBLE', '#e0e0ff');
      break;
    }
  }
}

/**
 * @param {any} dt
 */
function updateHackwareEffects(dt) {
  const map = _CG.dungeon ? _CG.dungeon.map : null;
  for (let i = hackwareEffects.length - 1; i >= 0; i--) {
    const fx = hackwareEffects[i];
    fx.age += dt;
    if (fx.age >= fx.maxAge) {
      if (fx.type === 'hologram') {
        for (const e of enemies) {
          if (!e.dead && !e.isBoss && dist(e.x, e.y, fx.x, fx.y) < 2) {
            e.stunTimer = Math.max(e.stunTimer || 0, 0.5);
            spawnParticles(e.x, e.y, 'SPARK', '#ff44ff', 3);
            spawnDmgText(e.x, e.y, 'STUN', '#ff44ff');
          }
          if (e._tauntTarget === fx) e._tauntTarget = null;
        }
        audio.holoDecoyExpire();
        spawnParticles(fx.x, fx.y, 'EXPLOSION', '#ff44ff', 15);
      }
      if (fx.type === 'decoy_turret') {
        audio.turretDestroy();
        spawnParticles(fx.x, fx.y, 'EXPLOSION', '#00ffaa', 12);
        spawnParticles(fx.x, fx.y, 'SPARK', '#66ffcc', 6);
      }
      if (fx.type === 'time_field') {
        // Restore every projectile, including ones reflected mid-field, or a stuck _timeMul crawls forever.
        for (const p of projectiles) {
          if (p && p._timeMul !== undefined && p._timeMul !== 1) p._timeMul = 1;
        }
      }
      hackwareEffects.splice(i, 1); continue;
    }

    if (fx.type === 'swarm') {
      let best = null, bestD = 8;
      for (const e of enemies) {
        if (e.dead) continue;
        if (e._disguised) continue; // don't home toward disguised mimics
        if (e._wrPhased) continue; // can't target phased WRAITHs
        const d = dist(fx.x, fx.y, e.x, e.y);
        if (d < bestD && map && hasLOS(fx.x, fx.y, e.x, e.y, map)) { best = e; bestD = d; }
      }
      if (best) {
        const [dx, dy] = norm(best.x - fx.x, best.y - fx.y);
        const spd = 6;
        fx.vx += dx * spd * dt * 4;
        fx.vy += dy * spd * dt * 4;
        const mag = Math.sqrt(fx.vx * fx.vx + fx.vy * fx.vy);
        if (mag > spd) { fx.vx = (fx.vx / mag) * spd; fx.vy = (fx.vy / mag) * spd; }
      }
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.hitCd = Math.max(0, fx.hitCd - dt);
      if (fx.hitCd <= 0) {
        for (const e of enemies) {
          if (e.dead) continue;
          if (e._wrPhased) continue;
          if (dist(fx.x, fx.y, e.x, e.y) < 0.6) {
            e.takeDamage(fx.dmg, { name:'Nano Swarm', isProc:true });
            fx.hitCd = 0.5;
            spawnParticles(fx.x, fx.y, 'SPARK', '#44ff88', 3);
            break;
          }
        }
      }
      if (rand('cosmetic') < dt * 10) spawnParticles(fx.x, fx.y, 'MUZZLE', '#44ff88', 1);
    }

    if (fx.type === 'scrap_magnet') {
      // Skip a dead player so loot does not lerp into a corpse and become unreachable.
      const p = _CG.player;
      if (!p || p.hp <= 0) continue;
      fx.x = p.x; fx.y = p.y;
      // Close enough items fall through the pickup-radius branch in game.js; this does not collect.
      const pullStr = 5;
      const pct = Math.min(1, pullStr * dt);
      // secretMask blocks unrevealed secret rooms. revealSecretRoom() clears it, so found loot still pulls.
      const sMask = _CG.dungeon?.secretMask;
      for (const it of items) {
        if (it.dead) continue;
        if (!(it.isHoard || it.isKey)) continue;
        const itx = Math.floor(it.x), ity = Math.floor(it.y);
        if (sMask && sMask[ity]?.[itx]) continue;
        const d = dist(it.x, it.y, fx.x, fx.y);
        if (d > fx.radius) continue;
        it.x += (fx.x - it.x) * pct;
        it.y += (fx.y - it.y) * pct;
      }
      if (rand('cosmetic') < dt * 14) {
        const a = rand('cosmetic') * TWO_PI;
        const r = fx.radius * 0.4 + rand('cosmetic') * fx.radius * 0.5;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'MUZZLE', '#ffd700', 1);
      }
    }

    if (fx.type === 'gravity') {
      const pullStr = 4;
      for (const e of enemies) {
        if (e.dead || e.isBoss) continue;
        if (e._disguised) continue; // don't pull disguised mimics
        if (e._wrPhased) continue; // can't pull phased WRAITHs
        const d = dist(e.x, e.y, fx.x, fx.y);
        if (d < fx.radius && d > 0.3 && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          e.moveToward(fx.x, fx.y, pullStr, dt, map);
        }
      }
      if (rand('cosmetic') < dt * 8) {
        const a = rand('cosmetic') * TWO_PI;
        const r = fx.radius * 0.5 + rand('cosmetic') * fx.radius * 0.5;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'MUZZLE', '#ff8800', 1);
      }
    }
    if (fx.type === 'static_field') {
      const now = fx.age;
      for (const e of enemies) {
        if (e.dead) continue;
        if (e._wrPhased) continue;
        const d = dist(e.x, e.y, fx.x, fx.y);
        if (d < fx.radius && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          // Stronger-wins: do not replace a longer or stronger slow.
          const factor = e.isBoss ? 0.85 : 0.6;
          e.slowTimer = Math.max(e.slowTimer || 0, 0.3);
          e.slowFactor = Math.min(e.slowFactor || 1, factor);
          const lastHit = fx.hitMap.get(e) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(e, now);
            e.takeDamage(fx.dmg, { name:'Static Field', isProc:true });
            spawnParticles(e.x, e.y, 'SPARK', '#44ccff', 3);
          }
        }
      }
      if (rand('cosmetic') < dt * 6) {
        const a = rand('cosmetic') * TWO_PI;
        const r = rand('cosmetic') * fx.radius;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'SPARK', '#44ccff', 1);
      }
      for (const g of shieldGens) {
        if (g.dead) continue;
        if (dist(g.x, g.y, fx.x, fx.y) < fx.radius && map && hasLOS(g.x, g.y, fx.x, fx.y, map)) {
          const lastHit = fx.hitMap.get(g) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(g, now);
            damageShieldGen(g, fx.dmg);
          }
        }
      }
      for (const cam of cameras) {
        if (cam.dead) continue;
        if (dist(cam.x, cam.y, fx.x, fx.y) < fx.radius && map && hasLOS(cam.x, cam.y, fx.x, fx.y, map)) {
          const lastHit = fx.hitMap.get(cam) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(cam, now);
            damageCamera(cam, fx.dmg);
          }
        }
      }
      for (const l of lasers) {
        if (l.dead) continue;
        if (!l.deadA && dist(l.x1, l.y1, fx.x, fx.y) < fx.radius && map && hasLOS(l.x1, l.y1, fx.x, fx.y, map)) {
          const lastHit = fx.hitMap.get(l) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(l, now);
            damageLaserEmitter(l, 'A', fx.dmg);
          }
        }
        if (l.dead) continue;
        if (!l.deadB && dist(l.x2, l.y2, fx.x, fx.y) < fx.radius && map && hasLOS(l.x2, l.y2, fx.x, fx.y, map)) {
          const lastHit = fx.hitMap.get(l._emitB) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(l._emitB, now);
            damageLaserEmitter(l, 'B', fx.dmg);
          }
        }
      }
      for (const wt of wallTurrets) {
        if (wt.dead || wt.hacked) continue;
        if (dist(wt.x, wt.y, fx.x, fx.y) < fx.radius && map && hasLOS(wt.x, wt.y, fx.x, fx.y, map)) {
          const lastHit = fx.hitMap.get(wt) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(wt, now);
            damageWallTurret(wt, fx.dmg);
          }
        }
      }
    }
    if (fx.type === 'chrono_lure') {
      // detonated latches the stun to one frame. Without it the pull window re-stuns bosses every frame.
      if (!fx.detonated && fx.age >= fx.armDuration) {
        fx.detonated = true;
        audio.hackwareChronoLureBoom();
        spawnParticles(fx.x, fx.y, 'EXPLOSION', '#ff22aa', 18);
        triggerShake(4, 0.18);
        // Skip disguised mimics (a stun text reveals them) and phased units (not targetable).
        for (const e of enemies) {
          if (e.dead) continue;
          if (e._disguised) continue;
          if (e._wrPhased) continue;
          const d = dist(e.x, e.y, fx.x, fx.y);
          if (d < fx.radius && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
            e.stunTimer = Math.max(e.stunTimer || 0, e.isBoss ? 0.5 : 1.0);
            spawnParticles(e.x, e.y, 'SPARK', '#ff22aa', 3);
            spawnDmgText(e.x, e.y, 'STUN', '#ff22aa');
          }
        }
      }
      // Pull 6 over a 0.6s window. Gravity well uses 4 because it has 3s.
      if (fx.detonated) {
        const pullStr = 6;
        for (const e of enemies) {
          if (e.dead || e.isBoss) continue;
          if (e._disguised) continue;
          if (e._wrPhased) continue;
          const d = dist(e.x, e.y, fx.x, fx.y);
          if (d < fx.radius && d > 0.3 && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
            e.moveToward(fx.x, fx.y, pullStr, dt, map);
          }
        }
      }
      const sparkRate = fx.detonated ? 12 : 6;
      if (rand('cosmetic') < dt * sparkRate) {
        const a = rand('cosmetic') * TWO_PI;
        const r = fx.radius * 0.45 + rand('cosmetic') * fx.radius * 0.4;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'MUZZLE', '#ff22aa', 1);
      }
    }
    // emp_ring is visual only, handled in draw

    if (fx.type === 'time_field') {
      for (const e of enemies) {
        if (e.dead) continue;
        // A slow with no damage would reveal a disguised mimic. Static field does not need this skip because it also damages.
        if (e._disguised) continue;
        if (e._wrPhased) continue;
        const d = dist(e.x, e.y, fx.x, fx.y);
        if (d < fx.radius && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          // 0.3s refresh so the slow lingers past the edge. Boss factor is weaker so stacked fields cannot lock a boss.
          e.slowTimer = Math.max(e.slowTimer || 0, 0.3);
          e.slowFactor = Math.min(e.slowFactor || 1, e.isBoss ? 0.6 : 0.35);
        }
      }
      // Reset then set each frame so leaving the field restores speed. No LOS: a wall to the centre must not whip bullet speed.
      for (const p of projectiles) {
        if (!p || p.dead) continue;
        if (p.fromPlayer || p.fromPlayerShot || p.isAllyTurret) continue;
        const dpx = p.x - fx.x, dpy = p.y - fx.y;
        const inside = (dpx * dpx + dpy * dpy) < (fx.radius * fx.radius);
        p._timeMul = inside ? 0.5 : 1;
      }
      if (rand('cosmetic') < dt * 5) {
        const a = rand('cosmetic') * TWO_PI;
        const r = fx.radius * 0.4 + rand('cosmetic') * fx.radius * 0.5;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'MUZZLE', '#aa88ff', 1);
      }
    }

    if (fx.type === 'hologram') {
      for (const e of enemies) {
        if (e.dead || e.isBoss) continue;
        const ed = dist(e.x, e.y, fx.x, fx.y);
        // Already taunted: check break range (even if phased)
        if (e._tauntTarget === fx) {
          if (ed > 7) e._tauntTarget = null;
          continue;
        }
        if (e._disguised || e._wrPhased) continue;
        if (ed < 5 && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          e._tauntTarget = fx;
        }
      }
      if (rand('cosmetic') < dt * 4) {
        const a = rand('cosmetic') * TWO_PI;
        spawnParticles(fx.x + Math.cos(a) * 0.3, fx.y + Math.sin(a) * 0.3, 'MUZZLE', '#ff44ff', 1);
      }
    }
    if (fx.type === 'decoy_turret') {
      // Skip disguised mimics and phased units. WRAITH and TUNNELLER share _wrPhased.
      fx.shootTimer = Math.max(0, fx.shootTimer - dt);
      let best = null, bestD = fx.range;
      for (const e of enemies) {
        if (e.dead || e.isBoss || e._disguised) continue;
        if (e._wrPhased) continue;
        const d = dist(fx.x, fx.y, e.x, e.y);
        if (d < bestD && map && hasLOS(fx.x, fx.y, e.x, e.y, map)) {
          best = e; bestD = d;
        }
      }
      if (best) {
        fx.aimAngle = Math.atan2(best.y - fx.y, best.x - fx.x);
        if (fx.shootTimer <= 0) {
          const [ndx, ndy] = norm(best.x - fx.x, best.y - fx.y);
          const proj = new Projectile(fx.x, fx.y, ndx, ndy, fx.projSpd, fx.dmg, fx.projRange, '#00ffaa', false, false);
          proj.isAllyTurret = true;
          proj.ownerType = 'Decoy Turret';
          projectiles.push(proj);
          audio.turretFire();
          spawnParticles(fx.x + Math.cos(fx.aimAngle) * 0.4, fx.y + Math.sin(fx.aimAngle) * 0.4, 'MUZZLE', '#00ffaa', 3);
          fx.shootTimer = fx.shootCd;
        }
      } else {
        fx.aimAngle += dt * 1.2;
      }
      if (rand('cosmetic') < dt * 3) {
        spawnParticles(fx.x, fx.y - 0.2, 'MUZZLE', '#00ffaa', 1);
      }
    }
  }
}

/**
 * @param {any} camX
 * @param {any} camY
 */
function drawHackwareEffects(camX, camY) {
  for (const fx of hackwareEffects) {
    if (fx.type === 'emp_ring') {
      const progress = fx.age / fx.maxAge;
      const r = fx.radius * TILE * progress;
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      ctx.save();
      ctx.globalAlpha = 0.6 * (1 - progress);
      ctx.strokeStyle = '#00ddff';
      ctx.shadowBlur = 15; ctx.shadowColor = '#00ddff';
      ctx.lineWidth = 3 * (1 - progress);
      NEON.draw.circleStroke(ctx, sx, sy, r);
      ctx.restore();
    }
    if (fx.type === 'emp_line') {
      const fade = 1 - (fx.age / fx.maxAge);
      const x1 = fx.x1 * TILE - camX, y1 = fx.y1 * TILE - camY;
      const x2 = fx.x2 * TILE - camX, y2 = fx.y2 * TILE - camY;
      ctx.save();
      ctx.globalAlpha = fade * 0.35;
      ctx.strokeStyle = '#00eecc';
      ctx.shadowBlur = 20; ctx.shadowColor = '#00eecc';
      ctx.lineWidth = 8 * fade;
      NEON.draw.line(ctx, x1, y1, x2, y2);
      ctx.globalAlpha = fade * 0.95;
      ctx.strokeStyle = '#ccfff0';
      ctx.lineWidth = 2.5 * fade + 0.5;
      NEON.draw.line(ctx, x1, y1, x2, y2);
      ctx.restore();
    }
    if (fx.type === 'data_spike') {
      const fade = 1 - (fx.age / fx.maxAge);
      const x1 = fx.x1 * TILE - camX, y1 = fx.y1 * TILE - camY;
      const x2 = fx.x2 * TILE - camX, y2 = fx.y2 * TILE - camY;
      ctx.save();
      ctx.globalAlpha = fade * 0.35;
      ctx.strokeStyle = '#ff4488';
      ctx.shadowBlur = 18; ctx.shadowColor = '#ff4488';
      ctx.lineWidth = 6 * fade;
      NEON.draw.line(ctx, x1, y1, x2, y2);
      ctx.globalAlpha = fade * 0.95;
      ctx.strokeStyle = '#ffd0e0';
      ctx.lineWidth = 2.0 * fade + 0.5;
      NEON.draw.line(ctx, x1, y1, x2, y2);
      ctx.restore();
    }
    if (fx.type === 'swarm') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.shadowBlur = 8; ctx.shadowColor = '#44ff88';
      ctx.fillStyle = '#44ff88';
      NEON.draw.circle(ctx, sx, sy, 3);
      ctx.restore();
    }
    if (fx.type === 'scrap_magnet') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const fade = 1 - (fx.age / fx.maxAge);
      const r = fx.radius * TILE;
      ctx.save();
      const pulse = 0.55 + Math.sin(fx.age * 12) * 0.25;
      ctx.globalAlpha = fade * 0.32 * pulse;
      ctx.strokeStyle = '#ffd700';
      ctx.shadowBlur = 18; ctx.shadowColor = '#ffd700';
      ctx.lineWidth = 2;
      NEON.draw.circleStroke(ctx, sx, sy, r);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = fade * 0.55;
      ctx.strokeStyle = '#ffe680';
      for (let arm = 0; arm < 3; arm++) {
        const a = -fx.age * 6 + (TWO_PI / 3) * arm;
        NEON.draw.line(ctx,
          sx + Math.cos(a) * 6, sy + Math.sin(a) * 6,
          sx + Math.cos(a) * r * 0.4, sy + Math.sin(a) * r * 0.4);
      }
      ctx.globalAlpha = fade * 0.9;
      ctx.fillStyle = '#fff5cc';
      NEON.draw.circle(ctx, sx, sy, 3 + Math.sin(fx.age * 14) * 1.2);
      ctx.restore();
    }

    if (fx.type === 'gravity') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const fade = 1 - (fx.age / fx.maxAge);
      const r = fx.radius * TILE;
      ctx.save();
      const pulse = 0.5 + Math.sin(fx.age * 8) * 0.2;
      ctx.globalAlpha = fade * 0.25 * pulse;
      ctx.fillStyle = '#ff8800';
      ctx.shadowBlur = 20; ctx.shadowColor = '#ff8800';
      NEON.draw.circle(ctx, sx, sy, r);
      ctx.globalAlpha = fade * 0.7;
      NEON.draw.circle(ctx, sx, sy, 6);
      ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 2;
      ctx.globalAlpha = fade * 0.4;
      for (let arm = 0; arm < 3; arm++) {
        const a = fx.age * 4 + (TWO_PI / 3) * arm;
        NEON.draw.line(ctx,
          sx + Math.cos(a) * 8, sy + Math.sin(a) * 8,
          sx + Math.cos(a) * r * 0.6, sy + Math.sin(a) * r * 0.6);
      }
      ctx.restore();
    }
    if (fx.type === 'static_field') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const fade = 1 - (fx.age / fx.maxAge) * 0.3; // slow fade, stays visible
      const r = fx.radius * TILE;
      ctx.save();
      const pulse = 0.6 + Math.sin(fx.age * 10) * 0.2;
      ctx.globalAlpha = fade * 0.15 * pulse;
      ctx.fillStyle = '#44ccff';
      ctx.shadowBlur = 25; ctx.shadowColor = '#44ccff';
      NEON.draw.circle(ctx, sx, sy, r);
      ctx.globalAlpha = fade * 0.5;
      ctx.strokeStyle = '#44ccff'; ctx.lineWidth = 2;
      NEON.draw.circleStroke(ctx, sx, sy, r);
      ctx.lineWidth = 3;
      ctx.globalAlpha = fade * 0.6;
      for (let seg = 0; seg < 3; seg++) {
        const a = fx.age * 3 + (TWO_PI / 3) * seg;
        NEON.draw.arcStroke(ctx, sx, sy, r * 0.7, a, a + Math.PI / 3);
      }
      ctx.globalAlpha = fade * 0.8;
      ctx.fillStyle = '#ffffff';
      NEON.draw.circle(ctx, sx, sy, 3 + Math.sin(fx.age * 15) * 1.5);
      ctx.restore();
    }
    if (fx.type === 'chrono_lure') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const r = fx.radius * TILE;
      ctx.save();
      if (!fx.detonated) {
        const armProg = Math.min(1, fx.age / fx.armDuration);
        const pulse = 0.5 + Math.sin(fx.age * 14) * 0.3;
        ctx.globalAlpha = 0.18 * pulse;
        ctx.strokeStyle = '#ff22aa';
        ctx.shadowBlur = 10; ctx.shadowColor = '#ff22aa';
        ctx.lineWidth = 1.5;
        NEON.draw.circleStroke(ctx, sx, sy, r);
        ctx.globalAlpha = 0.6 + 0.3 * armProg;
        ctx.fillStyle = '#ff22aa';
        NEON.draw.circle(ctx, sx, sy, 4 + armProg * 6);
        ctx.strokeStyle = '#ffaaff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.85;
        const a = -Math.PI / 2 + armProg * TWO_PI;
        NEON.draw.line(ctx, sx, sy, sx + Math.cos(a) * 12, sy + Math.sin(a) * 12);
      } else {
        const detProg = (fx.age - fx.armDuration) / (fx.maxAge - fx.armDuration);
        const fade = 1 - detProg;
        ctx.globalAlpha = fade * 0.3;
        ctx.fillStyle = '#ff22aa';
        ctx.shadowBlur = 25; ctx.shadowColor = '#ff22aa';
        NEON.draw.circle(ctx, sx, sy, r);
        ctx.globalAlpha = fade * 0.7;
        NEON.draw.circle(ctx, sx, sy, 8);
        ctx.strokeStyle = '#ffaaff'; ctx.lineWidth = 2;
        ctx.globalAlpha = fade * 0.5;
        for (let arm = 0; arm < 4; arm++) {
          const aa = -fx.age * 8 + (TWO_PI / 4) * arm;
          NEON.draw.line(ctx,
            sx + Math.cos(aa) * 10, sy + Math.sin(aa) * 10,
            sx + Math.cos(aa) * r * 0.7, sy + Math.sin(aa) * r * 0.7);
        }
      }
      ctx.restore();
    }
    if (fx.type === 'time_field') {
      // Arms rotate slower than other hackware rings so the field reads as stretched time, not a pulse.
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const r = fx.radius * TILE;
      // Fade in and out so enemies do not snap from slowed to full speed at the boundary.
      const fadeIn = Math.min(1, fx.age / 0.2);
      const fadeOut = Math.min(1, (fx.maxAge - fx.age) / 0.5);
      const fade = Math.max(0, Math.min(fadeIn, fadeOut));
      ctx.save();
      const pulse = 0.5 + Math.sin(fx.age * 4) * 0.2;
      ctx.globalAlpha = fade * 0.18 * pulse;
      ctx.fillStyle = '#6644ff';
      ctx.shadowBlur = 22; ctx.shadowColor = '#6644ff';
      NEON.draw.circle(ctx, sx, sy, r);
      ctx.globalAlpha = fade * 0.5;
      ctx.strokeStyle = '#aa88ff'; ctx.lineWidth = 1.5;
      NEON.draw.circleStroke(ctx, sx, sy, r);
      ctx.strokeStyle = '#cca0ff'; ctx.lineWidth = 2;
      ctx.globalAlpha = fade * 0.55;
      for (let arm = 0; arm < 3; arm++) {
        const aa = fx.age * 2.5 + (TWO_PI / 3) * arm;
        NEON.draw.line(ctx,
          sx + Math.cos(aa) * 6, sy + Math.sin(aa) * 6,
          sx + Math.cos(aa) * r * 0.65, sy + Math.sin(aa) * r * 0.65);
      }
      ctx.globalAlpha = fade * 0.85;
      ctx.fillStyle = '#e0c8ff';
      NEON.draw.circle(ctx, sx, sy, 3 + Math.sin(fx.age * 6) * 1);
      ctx.restore();
    }
    if (fx.type === 'hologram') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const fade = 1 - (fx.age / fx.maxAge) * 0.3;
      const flicker = rand('cosmetic') > 0.05 ? 1 : 0.3;
      const pulse = 0.6 + Math.sin(fx.age * 8) * 0.15;
      ctx.save();
      const hs = TILE * 0.4;
      ctx.globalAlpha = fade * pulse * flicker;
      ctx.strokeStyle = '#ff44ff';
      ctx.shadowBlur = 15; ctx.shadowColor = '#ff44ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let v = 0; v < 6; v++) {
        const a = (TWO_PI / 6) * v - Math.PI / 6;
        const px = sx + Math.cos(a) * hs, py = sy + Math.sin(a) * hs;
        if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = fade * 0.15 * flicker;
      ctx.fillStyle = '#ff44ff';
      ctx.fill();
      ctx.globalAlpha = fade * 0.25 * flicker;
      ctx.strokeStyle = '#ff88ff'; ctx.lineWidth = 1;
      const scan = (fx.age * 30) % (hs * 2);
      ctx.beginPath();
      ctx.moveTo(sx - hs, sy - hs + scan);
      ctx.lineTo(sx + hs, sy - hs + scan);
      ctx.stroke();
      ctx.restore();
    }
    if (fx.type === 'decoy_turret') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const remaining = fx.maxAge - fx.age;
      // Final 1.5s — flash to telegraph expiry.
      const flashing = remaining < 1.5;
      const flashOn = flashing ? (Math.sin(fx.age * 22) > 0) : true;
      const fade = flashing ? (flashOn ? 1 : 0.35) : 1;
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = '#00ffaa';
      const bs = TILE * 0.3;
      ctx.globalAlpha = fade * 0.85;
      ctx.fillStyle = '#003322';
      ctx.fillRect(sx - bs, sy - bs, bs * 2, bs * 2);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#00ffaa'; ctx.lineWidth = 2;
      ctx.strokeRect(sx - bs, sy - bs, bs * 2, bs * 2);
      const bl = TILE * 0.45;
      ctx.lineWidth = 3;
      NEON.draw.line(ctx, sx, sy,
        sx + Math.cos(fx.aimAngle) * bl,
        sy + Math.sin(fx.aimAngle) * bl);
      const pulseSpd = flashing ? 18 : 6;
      const corePulse = 0.7 + Math.sin(fx.age * pulseSpd) * 0.3;
      ctx.globalAlpha = fade * corePulse;
      ctx.fillStyle = '#aaffdd';
      NEON.draw.circle(ctx, sx, sy, 3);
      ctx.restore();
    }
  }
}
