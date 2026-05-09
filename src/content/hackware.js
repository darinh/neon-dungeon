// @ts-check
'use strict';

// Active hackware catalog, activation effects, persistent world-space hackware
// effects, and their draw pass. Loaded before src/content.js so the legacy
// script-tag globals keep their original names while the active-ability surface
// has a smaller owner. Functions intentionally resolve runtime globals only
// when invoked after all browser scripts have loaded.

// ─── Hackware — Collectible Active Abilities ──────────────────────────────────
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

/** @type {any[]} */ const hackwareEffects = []; // active world-space hackware effects (gravity wells, swarm particles)

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
  // SPAWN GRACE: floor-entry invulnerability window. Set by loadFloor() in
  // src/game.js on fresh transitions only (not save-resume). All env hazard
  // checks (PLASMA/ARC/TOXIC/frost patches) and mob damage paths gate on
  // this function, so a single OR here covers the whole damage surface.
  if ((p._spawnGraceTimer || 0) > 0) return true;
  // GHOSTWALK meta upgrade: extends dash i-frames past the dash MOVEMENT
  // window. Player.shoot's dash block sets dashTimer to 0.12s (movement
  // duration) AND _dashIFrameTimer to 0.12 + dashIFrameBonus (0.2 per
  // ghostwalk level, max +0.4). This gate keeps the player invulnerable
  // for the bonus-extended window AFTER dashTimer hits 0 — without it
  // the meta upgrade was wired through save/load but never read, so
  // players paying shards for ghostwalk got nothing. Mirrors the
  // dashTimer gate above (same single-OR pattern across env hazards
  // and mob damage paths via takeDamage's options.ignoreImmunity gate).
  if ((p._dashIFrameTimer || 0) > 0) return true;
  return false;
}

/**
 * @param {any} player
 */
function activateHackware(player) {
  if (!player.hackware || player.hackwareCooldown > 0 || player.hp <= 0) return;
  // NULLIFIER jam aura blocks activation entirely. Calls
  // isPlayerInNullifierAura DIRECTLY (rather than reading the cached
  // player.hackwareJammed flag) for a FRESH same-frame check — the
  // cached flag is set by updateNullifierJam which runs AFTER
  // player.update in the main game loop, so reading the flag here would
  // be one frame stale. A player stepping into an aura on the same
  // frame as the activation key-press could otherwise sneak past the
  // gate (boundary exploit; called out by gpt-5.3-codex r1 + gpt-5.5 r1).
  // The fresh-check eliminates the 1-frame window entirely.
  //
  // The cached flag (player.hackwareJammed) is still used by the
  // cooldown-tick gate at the player.update site — staleness on
  // cooldown ticking is invisible (1/60s out of a 10s cooldown is 0.17%).
  // The helper itself respects isPlayerDamageImmune() (dash i-frames
  // and PHASE_CLOAK pass through, matching DISRUPTOR precedent — claude-
  // opus-4.7 r1 callout). Note: PHASE_CLOAK is itself a hackware so the
  // gate fires BEFORE you can pop cloak inside an aura; pre-cloaking
  // outside is the intended counterplay vector.
  //
  // Audio + floater give immediate tactile feedback so the player
  // understands WHY the hackware fizzled (without this, a silent
  // return would feel like an input lag bug).
  if (isPlayerInNullifierAura(player)) {
    audio.hackwareJammed();
    spawnDmgText(player.x, player.y, 'JAMMED', '#cc66dd');
    return;
  }
  const hw = HACKWARE[player.hackware];
  if (!hw) return;
  // Hackware cooldown set on activation. Stacks multiplicatively with
  // OVERCLOCKER augment AND two opposing floor modifiers:
  //   - AUTONOMY (positive)  — ×0.75 (hackware cooldowns reduced 25%)
  //   - JAMMED   (negative)  — ×1.25 (hackware cooldowns increased 25%)
  // All factors are passive multiplicative scalars so an AUTONOMY floor
  // with OVERCLOCKER yields cooldown × 0.7 × 0.75 = 0.525 — a strong
  // synergy that rewards augment-first builds without being run-defining
  // (the augment itself is rare). A JAMMED floor with OVERCLOCKER yields
  // ×0.7 × 1.25 = ×0.875 — OVERCLOCKER still helps but the floor's
  // jamming bites first. AUTONOMY and JAMMED are mutually exclusive at
  // floor-roll time (only one modifier rolls per floor) so the two
  // ternaries can never both fire — the structure leaves room to relax
  // that mutex later (the literal product would be ×0.9375, a no-op
  // wash). Both gates use _CG.modifier (the canonical content.js
  // floor-modifier ref) — a typo would silently disable the effect on
  // every cooldown.
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
        // WRAITH: EMP bypasses LOS to force materialization (hard counter).
        // Also true for TUNNELLER (uses the same `_wrPhased` intangible flag)
        // so EMP can stun-flush a burrowed Tunneller exactly like a Wraith.
        const losOk = e._wrPhased ? true : (map && hasLOS(player.x, player.y, e.x, e.y, map));
        if (d < radius && losOk) {
          // Force WRAITH out of phased state before applying stun.
          // TUNNELLER intentionally NOT handled here — its own stun handler
          // in entities.js (gated on type==='TUNNELLER') runs next frame and
          // performs the proper _tnState→'surfaced' transition. Writing
          // _wrState here would contaminate two state machines.
          if (e._wrPhased && e.type === 'WRAITH') {
            const emerge = e._wrFindEmergeTile(map, player);
            if (emerge) {
              e.x = emerge.x; e.y = emerge.y;
              e._wrState = 'corporeal'; e._wrTimer = 2.0; e._wrPhased = false;
              audio.wraithPhaseIn();
            }
            // If no valid tile, WRAITH stays phased (extremely rare edge case)
          }
          const dur = e.isBoss ? 1 : 2; // bosses get reduced stun
          e.stunTimer = Math.max(e.stunTimer || 0, dur);
          spawnParticles(e.x, e.y, 'SPARK', '#00ddff', 4);
          spawnDmgText(e.x, e.y, 'STUN', '#00ddff');
        }
      }
      // Visual: expanding ring effect
      hackwareEffects.push({ type:'emp_ring', x:player.x, y:player.y, age:0, maxAge:0.4, radius });
      // EMP damages shield generators
      if (map) damageShieldGensInRadius(player.x, player.y, radius, 15, map);
      // EMP damages security cameras
      if (map) damageCamerasInRadius(player.x, player.y, radius, 15, map);
      // EMP disables laser tripwires in radius (check emitters AND beam segment)
      for (const l of lasers) {
        if (l.dead) continue;
        // Point-to-segment distance from EMP center to beam line
        const ax = l.x1, ay = l.y1, bx = l.x2, by = l.y2;
        const abx = bx - ax, aby = by - ay;
        const apx = player.x - ax, apy = player.y - ay;
        const ab2 = abx * abx + aby * aby;
        const t = ab2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2)) : 0;
        const closestX = ax + t * abx, closestY = ay + t * aby;
        const beamDist = dist(player.x, player.y, closestX, closestY);
        if (beamDist < radius) { l.disabled = true; l.disableTimer = LASER_DISABLE_DUR; audio.laserDisable(); }
      }
      // EMP hacks wall turrets in radius (converts hostile → allied)
      for (const wt of wallTurrets) {
        if (wt.dead || wt.hacked) continue;
        if (dist(player.x, player.y, wt.x, wt.y) < radius && hasLOS(player.x, player.y, wt.x, wt.y, map)) {
          hackWallTurret(wt);
        }
      }
      // EMP destroys disruption fields in radius
      for (const f of disruptionFields) {
        if (f.dead) continue;
        if (dist(player.x, player.y, f.x, f.y) < radius && map && hasLOS(player.x, player.y, f.x, f.y, map)) {
          f.dead = true;
          spawnParticles(f.x, f.y, 'SPARK', '#ff44aa', 6);
        }
      }
      // EMP collapses gravity wells in radius
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
      // Place at aim position. mouse.x/y already in logical (post-zoom)
      // coordinates — see host-side normalisation in src/platform.js.
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
      // Place at aim position (same pattern as Gravity Well)
      const cam2 = getCamera(player);
      const sx = (mouse.x + cam2.x) / TILE;
      const sy = (mouse.y + cam2.y) / TILE;
      // Remove any existing static field (max 1 active)
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
      // Remove existing hologram + clear taunt refs
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
      // Aim-place (matches GRAVITY_WELL/STATIC_FIELD/HOLO_DECOY UX).
      // Fall back to player tile if aim lands in a wall — projectiles spawning
      // inside walls would just collide instantly.
      const cam6 = getCamera(player);
      let dx = (mouse.x + cam6.x) / TILE;
      let dy = (mouse.y + cam6.y) / TILE;
      const txi = Math.floor(dx), tyi = Math.floor(dy);
      const tile = (map && map[tyi] != null) ? map[tyi][txi] : null;
      if (tile !== T.FLOOR && tile !== T.DOOR_OPEN) {
        dx = player.x; dy = player.y;
      }
      // Max 1 active — replace existing decoy turret on recast.
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'decoy_turret') hackwareEffects.splice(j, 1);
      }
      const fl = _CG.floor || 1;
      hackwareEffects.push({
        type:'decoy_turret', x:dx, y:dy, age:0, maxAge:6,
        shootTimer:0.4, shootCd:0.6,
        dmg: Math.round(6 + fl * 1.5),
        range:8, projSpd:7, projRange:10,
        aimAngle:0, hp:1, // hp reserved for future damage interactions
      });
      audio.turretHack();
      spawnParticles(dx, dy, 'EXPLOSION', '#00ffaa', 14);
      triggerShake(2, 0.1);
      _CG.msg('⊞ DECOY TURRET DEPLOYED', '#00ffaa');
      break;
    }
    case 'SCRAP_MAGNET': {
      // Loot-suction utility hackware. Pulls all currency-class items
      // (VaultCoin + MagpieHoard, both flagged isHoard) and KeyItems
      // (isKey) toward the player over ~1.2s. Skips upgrades (would force
      // a perk-choice UI mid-cast), Whispers (would force READING overlay
      // mid-fight), HARVESTER drops (TTL is generous + auto-trigger surge
      // mid-pull is awkward), and ShockPulse pickups (would auto-discharge
      // the panic-button at the player with no enemies near, wasting it).
      // Centre tracks player each frame in updateHackwareEffects so the
      // pull follows a sprinting/dashing/teleporting player. Cap 1 active
      // — recasting refreshes (mirrors STATIC_FIELD/HOLO_DECOY/DECOY_TURRET
      // dedup pattern).
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
      // Direction: mirror dash logic at entities.js:10933 — mouse aim with
      // facing fallback, and respect lockAimToMove. norm() returns [0,0]
      // for a zero vector, so the facing fallback covers click-on-self.
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
      // Wall-aware swept teleport, 4-tile range, 0.25-tile increments.
      // Pattern lifted verbatim from triggerShockPulse() in entities/shock-pulse.js
      // (~line 8762): per-step axis-independent isPassable with the final
      // combined-tile guard. This honours every existing impassable tile —
      // sealed boss/challenge entrances become T.WALL on seal, locked
      // doors are LOCKED_R/B/G, voids and cracked walls all read as
      // !isPassable — so BLINK never bypasses the key economy nor the
      // boss-room seal. The 0.25-tile step (16 sub-checks for a 4-tile
      // range) prevents the single-snap tunneling failure mode the
      // 'knockback sweeping' rule was written for.
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
        // Final combined-tile guard: rejects the diagonal-corner case
        // where both axis-only checks pass but map[finalFy][finalFx] is
        // itself a wall. On reject, snap back to the start (no teleport).
        const finalFx = Math.floor(curBX), finalFy = Math.floor(curBY);
        if (!(finalFx >= 0 && finalFx < MAP_W && finalFy >= 0 && finalFy < MAP_H && isPassable(map[finalFy][finalFx]))) {
          curBX = startBX; curBY = startBY;
        }
      } else {
        // No dungeon map (defensive): refuse the teleport rather than
        // applying an unchecked translation that could land out-of-bounds.
        curBX = startBX; curBY = startBY;
      }
      // No-op (faced into wall): suppress fanfare, but commit cooldown
      // (matches HOLO_DECOY/STATIC_FIELD/DECOY_TURRET semantics — pressing
      // the activation key spends the cycle regardless of placement).
      if (Math.abs(curBX - startBX) < 0.01 && Math.abs(curBY - startBY) < 0.01) {
        _CG.msg('⌖ BLINK BLOCKED', '#888888');
        break;
      }
      player.x = curBX; player.y = curBY;
      spawnParticles(startBX, startBY, 'EXPLOSION', '#88ccff', 14);
      spawnParticles(curBX,   curBY,   'EXPLOSION', '#88ccff', 14);
      // Path afterimage via the existing player.dashTrail array (already
      // rendered by render.js for dash). Capped by dashTrail's natural
      // 8-segment limit + per-frame alpha decay; reusing it avoids a new
      // render path. Push from start→end so the trail reads as motion.
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
      // Heal-over-time: 4 HP every 1.0s for 4 ticks (16 HP total over 4s).
      // Tick logic lives next to the HP_REGEN perk block in entities.js
      // Player.update — reuses the same accumulator-vs-period pattern so
      // there is no per-frame allocation in the hot tick path. Activation
      // is idempotent under spam: gated by hackwareCooldown above.
      // No-heal short-circuit: if already at full HP, refund cooldown so
      // the player isn't punished for a misclick at full health.
      if (player.hp >= player.maxHp) {
        player.hackwareCooldown = 0;
        _CG.msg('✚ REPAIR ABORT — FULL HP', '#888888');
        break;
      }
      // Self-clearing state: _repairTicksLeft naturally decays to 0 each
      // tick, mirroring the OVERDRIVE/combo "reuse self-clearing state"
      // pattern. No loadFloor/death cleanup hook needed beyond Player.reset.
      player._repairTicksLeft = 4;
      player._repairTickTimer = 1.0;
      audio.heal();
      spawnParticles(player.x, player.y, 'SPARK', '#00ff88', 10);
      _CG.msg('✚ REPAIR PROTOCOL', '#00ff88');
      break;
    }
    case 'REVERSE_POLARITY': {
      // Active AoE projectile reflector. Single-shot burst at activation:
      // every enemy projectile within RANGE tiles of the player gets its
      // velocity flipped and is converted to a player-owned shot. Fills
      // the gap between PHASE_CLOAK (passive immunity) and the PARRY perk
      // (per-touch dash-tied) with an area-burst defense that costs no
      // skill timing but fires on a long cooldown.
      //
      // Per the stored "player projectile parry" rule (PARRY perk @ ~3690
      // and REFLECTOR enemy-side @ ~3418), flipping fromPlayer MUST clear
      // ALL per-team state — otherwise SIPHON owner-back-references heal
      // dead enemies, SNIPER shock retags, weapon affix DoTs leak onto
      // player-owned shots, ricochet state carries over wall counts, and
      // hitEnemies starts pre-populated. Mirror the PARRY block exactly.
      const RANGE = 6;
      const RANGE_SQ = RANGE * RANGE;
      let reflected = 0;
      for (const p of projectiles) {
        if (!p || p.dead) continue;
        if (p.fromPlayer) continue;
        // Ally-turret shots (Decoy Turret hackware @ ~1366, hacked wall
        // turrets @ entities.js ~9915) spawn with fromPlayer=false +
        // isAllyTurret=true. They are aimed AT enemies — reflecting them
        // would spin them 180° back toward the player. Caught by gpt-
        // 5.3-codex review on PR. The PARRY perk reflect block does not
        // need this skip because friendly turret shots cannot collide
        // with the player anyway, but a 6-tile AoE sweep can.
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
        // TIME_DILATION ownership-flip cleanup: an enemy bullet
        // slowed by a time_field has _timeMul=0.5; once flipped to
        // fromPlayer=true the per-frame field loop skips it and the
        // 0.5 sticks until field expiry. Snap it back here so the
        // reflected shot flies at full speed immediately. Mirrors the
        // hitEnemies/maxPierces/piercing/etc. ownership cleanup
        // above — anything that "promotes to player-owned" must
        // touch _timeMul too. Same fix lives on the PARRY reflect at
        // ~L4895.
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
      // Directional piercing stun beam — the LINE counterpart to
      // EMP_BURST's RADIUS. Trades EMP_BURST's 4-tile radius (~50 tile
      // area, all-around) for an 8-tile reach in one direction (~8 tile
      // area, narrow). Niche: long-range crowd control + electronics
      // disable on a clean lane (corridor sweeps, distant-shooter
      // suppression). Cooldown 11s sits between EMP_BURST (10s) and
      // STATIC_FIELD (12s) — slightly slower than the burst so the
      // burst stays the panic-button.
      audio.hackwareEMPLine();
      // Aim direction: mirror BLINK pattern. Mouse aim → norm() →
      // player.facing fallback → respect lockAimToMove. Without the
      // facing fallback, click-on-self produces a no-op even when the
      // player is clearly facing somewhere; without the setting gate,
      // lock-aim users get a mouse-aimed beam that ignores their
      // explicit "use movement direction" preference.
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
      // Sweep to find the TRUE endpoint. The beam stops at the first
      // non-isPassable tile (T.WALL, LOCKED_R/B/G, sealed boss/challenge
      // entrances which flip to T.WALL on seal). Step 0.25 matches the
      // BLINK / SHOCK_PULSE precedent — fine enough that a 1-tile-thick
      // wall can't be tunneled by the sweep granularity. Without the
      // wall-stop the beam would clip through interior walls and
      // produce wraparound stuns.
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
      // Point-to-segment squared distance from (px,py) to segment
      // (player.{x,y}) → (endX,endY). Inlined so the hot path stays
      // allocation-free (no temp vector objects per enemy / per laser).
      // Returns Infinity for "behind the player" — the unclamped t is
      // negative there, and clamping it to 0 alone would create a
      // backwards stun bubble equal to WIDTH at the start endpoint
      // (enemies 0.5t behind the player → segDist = 0.5 < WIDTH 0.7 →
      // stun). EMP_LINE is documented as directional; the bubble
      // contradicts that intent and would let players "stun behind me
      // for free". The Infinity return here closes that hole.
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
      // Minimum squared distance between two segments (P1→P2) and
      // (P3→P4). Replaces an earlier 3-sample heuristic that missed
      // 53–83% of laser-beam crossings (a long laser can cross our
      // beam at an interior point while both endpoints AND the laser
      // midpoint sit far from our segment). Standard
      // closest-distance-between-two-segments formula — clamped
      // parametric solve in O(1). Used only for laser handling below;
      // enemies/turrets/cameras are points and use segDist2 directly.
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
        // Degenerate-segment short-circuits. The canonical
        // closest-distance-between-two-segments algorithm divides by
        // segment lengths and produces wrong answers when either
        // segment is a point (sN/tN ratios collapse to 0/0). For our
        // call site the beam is degenerate when the player faces a
        // wall directly (sweep didn't advance) — we still need a
        // sensible answer so the laser-disable logic doesn't silently
        // misfire. Smoke-tested: a horizontal 8t beam from (0,0) and
        // a degenerate "laser" at (4,0.6) returns 0.36 (correct
        // point-to-segment squared distance), not 16.36 (the
        // canonical algorithm's wrong default).
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
      // Stun every enemy whose centre is within WIDTH of the beam segment.
      // LOS gate is mandatory because segDist2 alone admits enemies on
      // the far side of a thin wall the beam BARELY missed (e.g. enemy
      // at 0.6 perpendicular dist, but a wall sits between player and
      // enemy). _wrPhased mobs (WRAITH/TUNNELLER while burrowed) bypass
      // LOS to match EMP_BURST's hard-counter contract — phase doesn't
      // protect from EMP. WRAITH-emerge logic mirrors the BURST handler
      // exactly so phase-stun sequencing is identical between the two
      // EMP variants. TUNNELLER intentionally NOT handled here — its
      // own stun handler runs next frame and performs the proper
      // _tnState→'surfaced' transition (writing _wrState here would
      // contaminate two state machines, same caveat as EMP_BURST).
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
        // Stun durations slightly shorter than EMP_BURST (2s/1s) — the
        // tradeoff for the line's longer reach. Bosses still get the
        // halved duration as in BURST. Inlined into Math.max so the
        // boss ternary IS the duration arg — without the inline, a
        // contributor can declare `const dur = e.isBoss ? 0.75 : 1.5;`
        // as a decoy and use a flat `dur = 1.5` for the actual stun
        // (opus-4.7 r1 finding 5).
        e.stunTimer = Math.max(e.stunTimer || 0, e.isBoss ? 0.75 : 1.5);
        spawnParticles(e.x, e.y, 'SPARK', '#00eecc', 4);
        spawnDmgText(e.x, e.y, 'STUN', '#00eecc');
      }
      // Electronics along the beam. Same target list as EMP_BURST so
      // the LINE reads as a true EMP — a player who memorised "EMP
      // disables turrets/lasers" doesn't have to remember a second
      // exception list for the LINE variant. Only the geometry
      // changes (segment-distance vs radius).
      if (map) {
        for (const l of lasers) {
          if (l.dead) continue;
          // Proper segment-to-segment minimum distance. The earlier
          // 3-sample heuristic (endpoints + midpoint) missed any laser
          // crossing the EMP beam at an interior position — a 6-tile
          // laser at perpendicular y=4 could cross our vertical beam
          // at (0,4) with all three samples landing 1.5+ tiles away.
          // Reviewers measured ~53–83% miss rate on typical lasers.
          // segSegDist2 catches every crossing in O(1) and matches
          // the precision EMP_BURST achieves via point-to-segment
          // math against each laser beam.
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
      // Visual: emp_line is purely a draw-side effect (no per-frame
      // logic in updateHackwareEffects beyond the age tick + maxAge
      // splice — same shape as emp_ring). Endpoints frozen at cast.
      hackwareEffects.push({ type:'emp_line', x1:player.x, y1:player.y, x2:endX, y2:endY, age:0, maxAge:0.45 });
      // Muzzle bursts at the player AND the impact point — gives the
      // beam a clear start/end read even at low alpha.
      spawnParticles(player.x, player.y, 'EXPLOSION', '#00eecc', 12);
      spawnParticles(endX, endY, 'SPARK', '#00eecc', 8);
      triggerShake(3, 0.15);
      _CG.msg('═ EMP LINE', '#00eecc');
      break;
    }
    case 'CHRONO_LURE': {
      // Delayed-trigger pull marker — the timing-based counterpart to
      // GRAVITY_WELL's continuous pull. Players drop the marker AHEAD
      // of an enemy push, then 1.0s later the lure fires: enemies are
      // pulled inward AND stunned. The arming delay is the trade — you
      // give up immediate effect for a heavy CC payoff that rewards
      // positional anticipation. Cooldown 13s reflects the stronger
      // payoff (instant stun + pull) vs GRAVITY_WELL's pull-only at 16s.
      // Niche distinct from EMP_BURST (instant radius stun, no pull) and
      // GRAVITY_WELL (continuous 3s pull, no stun).
      audio.hackwareChronoLure();
      // Aim-place at cursor; fall back to player tile if aim lands in a
      // wall (matches DECOY_TURRET — a marker spawned inside a wall is
      // unreachable for enemies and wastes the cast).
      const camCL = getCamera(player);
      let lx = (mouse.x + camCL.x) / TILE;
      let ly = (mouse.y + camCL.y) / TILE;
      const ltxi = Math.floor(lx), ltyi = Math.floor(ly);
      const ltile = (map && map[ltyi] != null) ? map[ltyi][ltxi] : null;
      if (ltile !== T.FLOOR && ltile !== T.DOOR_OPEN) {
        lx = player.x; ly = player.y;
      }
      // Max 1 active — recasting replaces the existing marker (mirrors
      // STATIC_FIELD/HOLO_DECOY/DECOY_TURRET dedup pattern). Without
      // dedup, spam-casting would chain detonations and trivialize CC.
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
      // Temporal field — first hackware to slow enemy projectiles
      // (the novel mechanic). Distinct from STATIC_FIELD which slows
      // enemies (×0.6) AND damages them: TIME_DILATION's slow is
      // STRONGER on enemies (×0.35 grunt / ×0.6 boss), does no damage,
      // and ALSO halves enemy projectile velocity inside the zone.
      // Combined effect: bullets become readable, enemies barely move
      // — a brief breathing window for repositioning or precision
      // shots. Niche distinct from EMP_BURST (full disable, instant)
      // and CHRONO_LURE (delayed pull+stun): time_field is a
      // continuous battlefield-control layer, not a CC spike.
      audio.hackwareTimeDilation();
      // Self-centred placement (mirrors REPAIR_PROTOCOL — no aim).
      // The field follows the cast point, not the player; this keeps
      // the temporal anchor stationary so retreat-then-engage tactics
      // (lay it ahead, dash through) work intuitively.
      // Max 1 active — recasting replaces the existing field (mirrors
      // STATIC_FIELD/HOLO_DECOY/DECOY_TURRET dedup pattern). Without
      // dedup, stacked fields would silently leak _timeMul state on
      // overlapping projectiles AND multiply per-tick enemy slow
      // application costs. Pre-expiry restore: any leftover slowed
      // projectiles from the displaced field have their _timeMul
      // cleared so they don't crawl forever after the new field
      // ignores them. Caught proactively (mirrors the projectile
      // restore in updateHackwareEffects' expiry branch).
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
      // Single-target burst-damage pierce beam — fills the missing
      // anti-priority-target niche. Existing damage hackware spread
      // damage across many enemies (NANO_SWARM = 6 nanites homing,
      // STATIC_FIELD = zone DoT, DECOY_TURRET = sustained turret).
      // Nothing in the catalog deletes a single elite/boss. DATA_SPIKE
      // is the dedicated precision option: 60 dmg base, +50% vs
      // elite/boss (=90), pierces all enemies in a 10t lane. The
      // pierce keeps it useful in waves; the elite/boss bonus is the
      // intended payoff. Cooldown 12s sits above EMP_LINE (11s) and
      // matches STATIC_FIELD (12s) — slower than the panic-button
      // EMP family because it's damage, not CC.
      //
      // EMP_LINE is the closest sibling (also a directional beam) but
      // the design poles are inverted: EMP_LINE = 8t reach, 0.7 width,
      // pure stun + electronics-disable, no damage. DATA_SPIKE = 10t
      // reach, 0.5 width (precision), pure damage + elite/boss bonus,
      // no stun, no electronics-disable. Players choose: lock down a
      // crowd (EMP_LINE) or delete the priority threat (DATA_SPIKE).
      audio.hackwareDataSpike();
      // Aim direction: mirror EMP_LINE / BLINK pattern. Mouse aim →
      // norm() → player.facing fallback → respect lockAimToMove. The
      // fallback covers click-on-self (norm of zero vector returns
      // [0,0]); without it the beam silently no-ops at point-blank.
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
      // Wall-stop sweep — same pattern as EMP_LINE / BLINK / shock pulse.
      // Step 0.25 prevents 1-tile-wall tunneling at this granularity
      // (40 sub-checks across a 10t reach). The beam halts at the first
      // non-isPassable tile so locked doors, sealed boss entrances
      // (which flip to T.WALL on seal), and voids all stop the spike.
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
      // Point-to-segment squared distance — inlined so the per-enemy
      // hot loop stays allocation-free. Identical structure to EMP_LINE
      // (returns Infinity for "behind the player" so the directional
      // beam can't hit enemies BEHIND the firing position via the
      // unclamped-t-clamped-to-0 backwards-bubble class).
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
      // WIDTH 0.5 (vs EMP_LINE's 0.7) — the spike reads as a precision
      // tool, narrower hitbox than the EMP sweep. Squared for the loop.
      const WIDTH = 0.5;
      const WIDTH_SQ = WIDTH * WIDTH;
      // Damage application loop. Mirror EMP_LINE's loop shape (LOS gate,
      // _wrPhased exception path) but apply takeDamage instead of stun.
      // Phase semantics:
      //   - WRAITH/TUNNELLER while _wrPhased: takeDamage() at
      //     entities.js:1893 returns 0 with 'PHASED' floater. We do NOT
      //     bypass phase here (unlike EMP_BURST/EMP_LINE which DO
      //     bypass to force materialise). DATA_SPIKE is kinetic damage,
      //     not a system disruption — the EMP family is the explicit
      //     hard counter to phase. Reaching phased mobs is a deliberate
      //     EMP-only privilege; if DATA_SPIKE shared it the EMP niche
      //     would erode.
      //   - MIMIC: do NOT skip _disguised (unlike EMP variants which
      //     skip to avoid revealing). takeDamage's revealMimic() call
      //     at entities.js:1913 fires the standard reveal — players
      //     SHOULD be able to surface a disguised mimic with damage,
      //     and DATA_SPIKE is damage. Consistent with how player
      //     projectiles already reveal mimics.
      // LOS gate (mandatory): segDist2 alone admits enemies on the far
      // side of a thin wall the beam BARELY missed. hasLOS is the
      // canonical guard used by EMP_LINE and the wider damage surface.
      const BASE_DMG = 60;
      const ELITE_BOSS_MUL = 1.5;
      let hits = 0;
      for (const e of enemies) {
        if (e.dead) continue;
        if (segDist2(e.x, e.y) > WIDTH_SQ) continue;
        if (!map || !hasLOS(player.x, player.y, e.x, e.y, map)) continue;
        // Inline the bonus into the takeDamage arg so a contributor
        // can't decoy the multiplier with a flat const elsewhere
        // (mirrors the inlined ternary pattern EMP_LINE uses for stun
        // duration — opus-4.7 r1 finding 5 on PR #209).
        const dmg = Math.round(BASE_DMG * ((e.isBoss || e.elite) ? ELITE_BOSS_MUL : 1));
        const dealt = e.takeDamage(dmg, { name: 'Data Spike', isProc: false });
        if (dealt > 0) hits++;
        spawnParticles(e.x, e.y, 'SPARK', '#ff4488', 4);
      }
      // No electronics-disable surface — DATA_SPIKE is damage, not EMP.
      // Players who memorised "EMP family disables turrets/lasers" get a
      // clean separation: damage tool != system disruptor. Keeping the
      // surface narrow also means the catalog has clear axis coverage:
      // EMP_LINE for electronics, DATA_SPIKE for raw damage.
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
      // Multi-hit damage-pool absorption — fills the missing flat-
      // damage-absorption niche. Existing player defenses divide as:
      //   - PHASE_CLOAK — 2.5s binary immunity (active hackware, but
      //     all-or-nothing; no damage interaction)
      //   - REPAIR_PROTOCOL — 4 HP/s × 4 ticks heal-over-time (active
      //     hackware, but reactive — heals AFTER damage is taken)
      //   - ENERGY_SHIELD perk + SHIELD DRIVER boost — ONE-SHOT absorbs
      //     (consumed on first qualifying hit, grant 0.5s i-frames)
      //   - LAST_STAND perk — clutch ≤10% HP window (×0.5 incoming dmg)
      // Nothing in the catalog absorbs MULTIPLE hits across a window
      // without consuming on the first contact. SHIELD_BUBBLE is the
      // dedicated multi-hit absorption pool: 35 dmg over 6s, drains
      // proportionally (mirroring the SHIELDED enemy affix's drain-
      // and-pass pattern at entities.js:1448-1450). Cooldown 16s sits
      // between GRAVITY_WELL (16s) and REPAIR_PROTOCOL (18s) — the
      // heavy-utility band — because a successful 35-dmg block can
      // delete an entire wave's incoming pressure.
      //
      // PHASE_CLOAK is the closest cousin (also a player-following
      // active defense), but the design poles are inverted:
      //   - PHASE_CLOAK = 2.5s window, ALL incoming negated (binary)
      //   - SHIELD_BUBBLE = 6s window, 35 dmg cap, then bubble breaks
      // Players choose: avoid eyes-closed for 2.5s (cloak) or face
      // down 35 dmg with eyes open for 6s (bubble). The longer window
      // and partial-damage interaction make SHIELD_BUBBLE the better
      // pick for sustained fights; PHASE_CLOAK still wins for short
      // burst panic windows (e.g. crossing a fully-armed turret room
      // without engaging).
      //
      // Drain ordering (entities.js takeDamage @ ~12385): bubble
      // drains BEFORE the one-shot SHIELD DRIVER boost and
      // ENERGY_SHIELD perk. Rationale — bubble is an active resource
      // the player just spent a 16s cooldown on; the perk/boost are
      // emergency last-line defenses with their own long
      // cooldowns/scarcity. Draining bubble first means a player
      // who pops bubble PROACTIVELY before a known damage spike
      // preserves their one-shot reserves for a future surprise.
      // Inverting the order would make bubble effectively useless
      // when the player already had a one-shot ready (the one-shot
      // would always trigger first and grant i-frames, leaving
      // bubble's pool untouched and its timer ticking down for
      // nothing).
      //
      // No-cast guard: refund the cooldown if the player already has
      // an active bubble (don't let spam re-set hp+timer to full
      // values while losing the partial state). Mirrors REPAIR_PROTOCOL's
      // full-HP refund pattern — protects against accidental misclick
      // while a buff is already running. Without this guard, a player
      // who pops bubble at 1s remaining and re-casts immediately would
      // lose nothing (full refresh), trivialising the cooldown design.
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
      // Hologram expiry: mini-stun nearby enemies + clear taunt refs
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
        // Restore any projectiles still inside the zone — without
        // this, enemy bullets last seen inside the field would
        // crawl forever after expiry (the per-frame "default to 1
        // then maybe 0.5" reset stops running once fx is spliced).
        // Loop walks ALL projectiles (not just enemy-owned) so a
        // mid-field reflect (REVERSE_POLARITY flips fromPlayer mid-
        // flight) doesn't leave a player-owned shot stuck slow.
        for (const p of projectiles) {
          if (p && p._timeMul !== undefined && p._timeMul !== 1) p._timeMul = 1;
        }
      }
      hackwareEffects.splice(i, 1); continue;
    }

    if (fx.type === 'swarm') {
      // Home toward nearest visible enemy
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
      // Hit detection
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
      // Trail particle
      if (rand('cosmetic') < dt * 10) spawnParticles(fx.x, fx.y, 'MUZZLE', '#44ff88', 1);
    }

    if (fx.type === 'scrap_magnet') {
      // Centre tracks player so coins chase a moving target. Skip if
      // player is gone (death) — items shouldn't lerp into a corpse and
      // become unreachable for the post-death loot-recovery flow.
      const p = _CG.player;
      if (!p || p.hp <= 0) continue;
      fx.x = p.x; fx.y = p.y;
      // Per-frame fraction-lerp; pullStr=5 over 1.2s converges items to
      // ~99.8% of distance covered. Items close enough trip the existing
      // pickup-radius branch in game.js naturally — no manual collect.
      const pullStr = 5;
      const pct = Math.min(1, pullStr * dt);
      // Secret-room sequence-break gate: keys are placed in vis2-reachable
      // rooms at gen time (line ~2661 BFS-excluding-locks), but a keyRoom
      // can subsequently be designated a secret room (the secretEligible
      // filter at ~2684 doesn't exclude rooms-with-keys). Without this gate
      // the magnet would yank keys out of unrevealed secret rooms,
      // bypassing the cracked-tile discovery the secret is designed around.
      // dungeon.secretMask[ty][tx] is cleared in game.js revealSecretRoom()
      // when the player breaks in, so revealed-secret loot pulls normally.
      const sMask = _CG.dungeon?.secretMask;
      for (const it of items) {
        if (it.dead) continue;
        // Currency (isHoard: VaultCoin + MagpieHoard) and keys (isKey)
        // only. See activation comment for the deliberate exclusion list.
        if (!(it.isHoard || it.isKey)) continue;
        const itx = Math.floor(it.x), ity = Math.floor(it.y);
        if (sMask && sMask[ity]?.[itx]) continue;
        const d = dist(it.x, it.y, fx.x, fx.y);
        if (d > fx.radius) continue;
        it.x += (fx.x - it.x) * pct;
        it.y += (fx.y - it.y) * pct;
      }
      // Ambient gold sparkle in the pull radius.
      if (rand('cosmetic') < dt * 14) {
        const a = rand('cosmetic') * TWO_PI;
        const r = fx.radius * 0.4 + rand('cosmetic') * fx.radius * 0.5;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'MUZZLE', '#ffd700', 1);
      }
    }

    if (fx.type === 'gravity') {
      // Pull enemies toward center (collision-aware)
      const pullStr = 4;
      for (const e of enemies) {
        if (e.dead || e.isBoss) continue; // bosses immune to pull
        if (e._disguised) continue; // don't pull disguised mimics
        if (e._wrPhased) continue; // can't pull phased WRAITHs
        const d = dist(e.x, e.y, fx.x, fx.y);
        if (d < fx.radius && d > 0.3 && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          e.moveToward(fx.x, fx.y, pullStr, dt, map);
        }
      }
      // Ambient vortex particles
      if (rand('cosmetic') < dt * 8) {
        const a = rand('cosmetic') * TWO_PI;
        const r = fx.radius * 0.5 + rand('cosmetic') * fx.radius * 0.5;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'MUZZLE', '#ff8800', 1);
      }
    }
    if (fx.type === 'static_field') {
      // Damage and slow enemies inside the field (LOS required)
      const now = fx.age;
      for (const e of enemies) {
        if (e.dead) continue;
        if (e._wrPhased) continue;
        const d = dist(e.x, e.y, fx.x, fx.y);
        if (d < fx.radius && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          // Apply slow (stronger-wins: don't truncate existing longer/stronger slows)
          const factor = e.isBoss ? 0.85 : 0.6;
          e.slowTimer = Math.max(e.slowTimer || 0, 0.3);
          e.slowFactor = Math.min(e.slowFactor || 1, factor);
          // Damage on 1-second interval per enemy
          const lastHit = fx.hitMap.get(e) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(e, now);
            e.takeDamage(fx.dmg, { name:'Static Field', isProc:true });
            spawnParticles(e.x, e.y, 'SPARK', '#44ccff', 3);
          }
        }
      }
      // Ambient crackling particles
      if (rand('cosmetic') < dt * 6) {
        const a = rand('cosmetic') * TWO_PI;
        const r = rand('cosmetic') * fx.radius;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'SPARK', '#44ccff', 1);
      }
      // Static field damages shield generators (1s interval, reuse hitMap with string key)
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
      // Static field damages security cameras (1s interval, reuse hitMap)
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
      // Static field damages laser tripwire emitters (1s interval)
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
      // Static field damages hostile wall turrets (1s interval)
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
      // Two-phase: arming (no effect, visible blinking ring) → detonation
      // (single stun-application + continuous pull until maxAge). The
      // `detonated` latch ensures the stun loop fires EXACTLY ONCE at the
      // arm-end transition; without it, every frame in the pull window
      // would re-stun and bosses would get permanent CC.
      if (!fx.detonated && fx.age >= fx.armDuration) {
        fx.detonated = true;
        audio.hackwareChronoLureBoom();
        spawnParticles(fx.x, fx.y, 'EXPLOSION', '#ff22aa', 18);
        triggerShake(4, 0.18);
        // One-shot stun on detonation. Mirrors EMP_BURST's bossHalf
        // pattern (`isBoss ? halved : full`). Disguised mimics + phased
        // wraiths skipped — same exclusions as gravity well's pull, for
        // the same reasons (no mid-fight identity reveal; phased units
        // are non-targetable).
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
      // Continuous pull during detonation phase only. Bosses skip the
      // pull (matches GRAVITY_WELL precedent — bosses are immune to
      // forced movement). Pull strength 6 (vs GRAVITY_WELL's 4) is
      // tuned for the SHORTER pull window: 0.6s × 6 ≈ 3.6 tiles of
      // budget brings radius-edge enemies (5 tiles) to ~1.4 tiles —
      // well inside follow-up melee range. GRAVITY_WELL's gentler 4
      // works because it has 3.0s × 4 = 12 tiles of budget.
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
      // Ambient particles in arm + detonation (gentler during arming).
      const sparkRate = fx.detonated ? 12 : 6;
      if (rand('cosmetic') < dt * sparkRate) {
        const a = rand('cosmetic') * TWO_PI;
        const r = fx.radius * 0.45 + rand('cosmetic') * fx.radius * 0.4;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'MUZZLE', '#ff22aa', 1);
      }
    }
    // emp_ring is visual only, handled in draw

    if (fx.type === 'time_field') {
      // Continuous battlefield-control field. Two layered effects each
      // tick: (a) enemy slow inside the radius (LOS-gated, stronger
      // than STATIC_FIELD's slow + halved on bosses); (b) enemy
      // projectile slow — first hackware to touch projectile velocity.
      // No damage layer (distinct from STATIC_FIELD).
      // ---- (a) Enemy slow ----
      for (const e of enemies) {
        if (e.dead) continue;
        // Disguised mimics skipped: applying a visible slow without
        // dealing damage (TIME_DILATION is control-only) would
        // silently reveal a disguised crate's true identity (the
        // player sees a "crate" creeping forward). STATIC_FIELD
        // doesn't need this skip because it ALSO damages, so the
        // identity reveal happens via takeDamage anyway — there's
        // no information leak unique to the slow.
        if (e._disguised) continue;
        if (e._wrPhased) continue;
        const d = dist(e.x, e.y, fx.x, fx.y);
        if (d < fx.radius && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          // Stronger-wins: only deepen existing slows. The 0.3s timer
          // refreshes each frame an enemy stays inside, so the slow
          // lingers ~0.3s after exit (smooths zone-edge dance). Boss
          // factor halved (0.6 vs grunt 0.35) per EMP_BURST/EMP_LINE
          // precedent — stops boss perma-control via field stacking.
          e.slowTimer = Math.max(e.slowTimer || 0, 0.3);
          e.slowFactor = Math.min(e.slowFactor || 1, e.isBoss ? 0.6 : 0.35);
        }
      }
      // ---- (b) Enemy projectile slow (NOVEL) ----
      // Per-frame reset-then-set: every enemy projectile defaults
      // back to _timeMul=1, then those inside the radius drop to 0.5.
      // This implicitly handles the "exit while field alive" case
      // (next frame the projectile is outside → reset to 1). The
      // expiry branch above handles "field expires while inside".
      // Skip: player shots, ally turret shots (DECOY_TURRET), dead
      // projectiles. Position-based gate (no LOS) — bullets flying
      // in straight lines through the zone get slowed regardless of
      // wall geometry; LOS would create unintuitive "bullet whips
      // back to fast speed when wall blocks line to centre" jitter.
      for (const p of projectiles) {
        if (!p || p.dead) continue;
        if (p.fromPlayer || p.fromPlayerShot || p.isAllyTurret) continue;
        const dpx = p.x - fx.x, dpy = p.y - fx.y;
        const inside = (dpx * dpx + dpy * dpy) < (fx.radius * fx.radius);
        p._timeMul = inside ? 0.5 : 1;
      }
      // Ambient temporal sparkles — slower spawn than static_field
      // (the visual language is "time slowed" not "energetic").
      if (rand('cosmetic') < dt * 5) {
        const a = rand('cosmetic') * TWO_PI;
        const r = fx.radius * 0.4 + rand('cosmetic') * fx.radius * 0.5;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'MUZZLE', '#aa88ff', 1);
      }
    }

    if (fx.type === 'hologram') {
      // Taunt nearby enemies toward the hologram
      for (const e of enemies) {
        if (e.dead || e.isBoss) continue;
        const ed = dist(e.x, e.y, fx.x, fx.y);
        // Already taunted: check break range (even if phased)
        if (e._tauntTarget === fx) {
          if (ed > 7) e._tauntTarget = null;
          continue;
        }
        // New taunt: skip disguised mimics and phased wraiths
        if (e._disguised || e._wrPhased) continue;
        if (ed < 5 && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          e._tauntTarget = fx;
        }
      }
      // Ambient holographic particles
      if (rand('cosmetic') < dt * 4) {
        const a = rand('cosmetic') * TWO_PI;
        spawnParticles(fx.x + Math.cos(a) * 0.3, fx.y + Math.sin(a) * 0.3, 'MUZZLE', '#ff44ff', 1);
      }
    }
    if (fx.type === 'decoy_turret') {
      // Find nearest visible enemy within range (LOS-gated, mirrors hacked
      // wall-turret targeting). Skip disguised mimics + phased intangibles
      // (WRAITH/TUNNELLER share `_wrPhased`).
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
        // No target: idle slow-spin barrel
        fx.aimAngle += dt * 1.2;
      }
      // Ambient ready-LED blink
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
      // Twin-stroke beam: bright inner + soft outer halo. Both fade
      // together so the beam reads as a single energy lance, not two
      // overlapping primitives. Mirrors the RESONATOR/MIRROR enemy beam
      // visual language so players who already learned "teal/cyan beam =
      // EMP/electric" don't have to re-decode this one. The post-flash
      // particles spawned at cast handle the impact-point pop; the beam
      // itself is just the in-flight lance.
      const fade = 1 - (fx.age / fx.maxAge);
      const x1 = fx.x1 * TILE - camX, y1 = fx.y1 * TILE - camY;
      const x2 = fx.x2 * TILE - camX, y2 = fx.y2 * TILE - camY;
      ctx.save();
      // Outer halo (wide, low alpha)
      ctx.globalAlpha = fade * 0.35;
      ctx.strokeStyle = '#00eecc';
      ctx.shadowBlur = 20; ctx.shadowColor = '#00eecc';
      ctx.lineWidth = 8 * fade;
      NEON.draw.line(ctx, x1, y1, x2, y2);
      // Inner core (narrow, bright)
      ctx.globalAlpha = fade * 0.95;
      ctx.strokeStyle = '#ccfff0';
      ctx.lineWidth = 2.5 * fade + 0.5;
      NEON.draw.line(ctx, x1, y1, x2, y2);
      ctx.restore();
    }
    if (fx.type === 'data_spike') {
      // Twin-stroke beam — same visual grammar as emp_line but recoloured
      // hot-pink (#ff4488) so it reads as DAMAGE, not EMP. Inner core
      // brightens to near-white (#ffd0e0) on the pink axis to match
      // the "energy lance" silhouette. Slightly tighter line widths
      // than emp_line (inner 2.0 vs 2.5, outer 6 vs 8) — the spike is
      // a precision tool, the line is an area sweep.
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
      // Outer pulsing gold boundary ring.
      const pulse = 0.55 + Math.sin(fx.age * 12) * 0.25;
      ctx.globalAlpha = fade * 0.32 * pulse;
      ctx.strokeStyle = '#ffd700';
      ctx.shadowBlur = 18; ctx.shadowColor = '#ffd700';
      ctx.lineWidth = 2;
      NEON.draw.circleStroke(ctx, sx, sy, r);
      // Counter-rotating spiral arms — read as "suction".
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = fade * 0.55;
      ctx.strokeStyle = '#ffe680';
      for (let arm = 0; arm < 3; arm++) {
        const a = -fx.age * 6 + (TWO_PI / 3) * arm;
        NEON.draw.line(ctx,
          sx + Math.cos(a) * 6, sy + Math.sin(a) * 6,
          sx + Math.cos(a) * r * 0.4, sy + Math.sin(a) * r * 0.4);
      }
      // Bright core spark.
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
      // Pulsing ring
      const pulse = 0.5 + Math.sin(fx.age * 8) * 0.2;
      ctx.globalAlpha = fade * 0.25 * pulse;
      ctx.fillStyle = '#ff8800';
      ctx.shadowBlur = 20; ctx.shadowColor = '#ff8800';
      NEON.draw.circle(ctx, sx, sy, r);
      // Core
      ctx.globalAlpha = fade * 0.7;
      NEON.draw.circle(ctx, sx, sy, 6);
      // Rotating arms
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
      // Pulsing electric ring
      const pulse = 0.6 + Math.sin(fx.age * 10) * 0.2;
      ctx.globalAlpha = fade * 0.15 * pulse;
      ctx.fillStyle = '#44ccff';
      ctx.shadowBlur = 25; ctx.shadowColor = '#44ccff';
      NEON.draw.circle(ctx, sx, sy, r);
      // Outer ring stroke
      ctx.globalAlpha = fade * 0.5;
      ctx.strokeStyle = '#44ccff'; ctx.lineWidth = 2;
      NEON.draw.circleStroke(ctx, sx, sy, r);
      // Rotating arc segments (3 arcs, 60° each)
      ctx.lineWidth = 3;
      ctx.globalAlpha = fade * 0.6;
      for (let seg = 0; seg < 3; seg++) {
        const a = fx.age * 3 + (TWO_PI / 3) * seg;
        NEON.draw.arcStroke(ctx, sx, sy, r * 0.7, a, a + Math.PI / 3);
      }
      // Core spark
      ctx.globalAlpha = fade * 0.8;
      ctx.fillStyle = '#ffffff';
      NEON.draw.circle(ctx, sx, sy, 3 + Math.sin(fx.age * 15) * 1.5);
      ctx.restore();
    }
    if (fx.type === 'chrono_lure') {
      // Two-phase visual: arming = countdown clock (subtle, sweep arm
      // shows time-to-fire), detonation = bright pull vortex. Distinct
      // visual language from gravity well (orange/no countdown) so
      // players can read the state at a glance.
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const r = fx.radius * TILE;
      ctx.save();
      if (!fx.detonated) {
        const armProg = Math.min(1, fx.age / fx.armDuration);
        const pulse = 0.5 + Math.sin(fx.age * 14) * 0.3;
        // Outer boundary ring — telegraphs the eventual blast radius.
        ctx.globalAlpha = 0.18 * pulse;
        ctx.strokeStyle = '#ff22aa';
        ctx.shadowBlur = 10; ctx.shadowColor = '#ff22aa';
        ctx.lineWidth = 1.5;
        NEON.draw.circleStroke(ctx, sx, sy, r);
        // Inner core grows as arming progresses (visual countdown).
        ctx.globalAlpha = 0.6 + 0.3 * armProg;
        ctx.fillStyle = '#ff22aa';
        NEON.draw.circle(ctx, sx, sy, 4 + armProg * 6);
        // Sweep arm (clock hand) — sweeps once during arming.
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
        // Counter-rotating pull arms — read as "suction inward".
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
      // Temporal field — purple zone with slow-rotating clock arms.
      // Visual language: "time slowed" — gentle pulse, sweep arms
      // rotate at 1/3 normal hackware-arm speed (CHRONO_LURE uses
      // ×8, here ×2.5) so the eye reads "stretched time". Distinct
      // from STATIC_FIELD (cyan, energetic 3-arc pulse) and
      // CHRONO_LURE (pink, fast vortex on detonation).
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const r = fx.radius * TILE;
      // Fade IN over 0.2s + fade OUT over the last 0.5s — eases the
      // boundary so enemies don't appear to slow then snap back to
      // full speed without warning.
      const fadeIn = Math.min(1, fx.age / 0.2);
      const fadeOut = Math.min(1, (fx.maxAge - fx.age) / 0.5);
      const fade = Math.max(0, Math.min(fadeIn, fadeOut));
      ctx.save();
      // Outer boundary glow.
      const pulse = 0.5 + Math.sin(fx.age * 4) * 0.2;
      ctx.globalAlpha = fade * 0.18 * pulse;
      ctx.fillStyle = '#6644ff';
      ctx.shadowBlur = 22; ctx.shadowColor = '#6644ff';
      NEON.draw.circle(ctx, sx, sy, r);
      // Boundary stroke ring.
      ctx.globalAlpha = fade * 0.5;
      ctx.strokeStyle = '#aa88ff'; ctx.lineWidth = 1.5;
      NEON.draw.circleStroke(ctx, sx, sy, r);
      // Slow-rotating clock arms — three hands at 120° spacing.
      ctx.strokeStyle = '#cca0ff'; ctx.lineWidth = 2;
      ctx.globalAlpha = fade * 0.55;
      for (let arm = 0; arm < 3; arm++) {
        const aa = fx.age * 2.5 + (TWO_PI / 3) * arm;
        NEON.draw.line(ctx,
          sx + Math.cos(aa) * 6, sy + Math.sin(aa) * 6,
          sx + Math.cos(aa) * r * 0.65, sy + Math.sin(aa) * r * 0.65);
      }
      // Centre core — soft pulsing dot, marks the anchor point.
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
      // Hexagon body
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
      // Inner glow
      ctx.globalAlpha = fade * 0.15 * flicker;
      ctx.fillStyle = '#ff44ff';
      ctx.fill();
      // Scanline
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
      // Base plate (square footprint)
      const bs = TILE * 0.3;
      ctx.globalAlpha = fade * 0.85;
      ctx.fillStyle = '#003322';
      ctx.fillRect(sx - bs, sy - bs, bs * 2, bs * 2);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#00ffaa'; ctx.lineWidth = 2;
      ctx.strokeRect(sx - bs, sy - bs, bs * 2, bs * 2);
      // Rotating barrel
      const bl = TILE * 0.45;
      ctx.lineWidth = 3;
      NEON.draw.line(ctx, sx, sy,
        sx + Math.cos(fx.aimAngle) * bl,
        sy + Math.sin(fx.aimAngle) * bl);
      // Core ready-LED (pulses faster as expiry nears)
      const pulseSpd = flashing ? 18 : 6;
      const corePulse = 0.7 + Math.sin(fx.age * pulseSpd) * 0.3;
      ctx.globalAlpha = fade * corePulse;
      ctx.fillStyle = '#aaffdd';
      NEON.draw.circle(ctx, sx, sy, 3);
      ctx.restore();
    }
  }
}
