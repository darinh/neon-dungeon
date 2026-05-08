// @ts-check
'use strict';

// Alarm beacons load after src/entities.js so they can reuse shared actor
// collections and enemy spawn helpers while publishing the legacy globals used
// by generation, projectiles, explosions, game updates, and rendering.

// ─── Alarm Beacons ────────────────────────────────────────────────────────────
const BEACON_COUNTDOWN = 4; // seconds before reinforcements spawn

/**
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floor]
 * @param {any} [room]
 */
function createBeacon(x, y, floor, room) {
  const maxHp = 10 + floor * 3;
  return { x, y, hp: maxHp, maxHp, active: false, timer: 0, dead: false,
           room, floor, bob: rand('cosmetic') * TWO_PI, ringTimer: 0 };
}

/**
 * @param {any} [b]
 * @param {any} [dmg]
 */
function damageBeacon(b, dmg) {
  if (!b || b.dead) return;
  b.hp -= dmg;
  if (b.hp <= 0) destroyBeacon(b);
  else spawnParticles(b.x, b.y, 'SPARK', '#ff4444', 4);
}

/**
 * @param {any} [b]
 */
function destroyBeacon(b) {
  b.dead = true;
  spawnParticles(b.x, b.y, 'EXPLOSION', '#ff3333', 14);
  spawnParticles(b.x, b.y, 'SPARK', '#ff8844', 8);
  audio.beaconDestroy();
  // Credit reward with economy multipliers
  const d = getDiff();
  const amt = Math.round(_EG.floor * 3 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
  _EG.player.credits += amt;
  spawnDmgText(b.x, b.y - 0.3, '+' + amt + '◈', '#ff6644');
  const idx = beacons.indexOf(b);
  if (idx >= 0) beacons.splice(idx, 1);
  // Trigger room-clear re-evaluation (beacon was blocking clear)
  _EG.enemyDiedThisFrame = true;
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageBeaconsInRadius(wx, wy, radius, dmg, map) {
  for (let i = beacons.length - 1; i >= 0; i--) {
    const b = beacons[i];
    if (b.dead) continue;
    if (dist(wx, wy, b.x, b.y) < radius && hasLOS(wx, wy, b.x, b.y, map)) {
      damageBeacon(b, dmg);
    }
  }
}

/**
 * @param {any} [dt]
 */
function updateBeacons(dt) {
  const p = _EG.player;
  for (let i = beacons.length - 1; i >= 0; i--) {
    const b = beacons[i];
    if (b.dead) continue;
    b.bob += dt * 2;
    // Activate when player enters the room
    if (!b.active) {
      const r = b.room;
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
        b.active = true;
        b.timer = BEACON_COUNTDOWN;
        audio.beaconAlarm();
        _EG.msg('⚠ ALARM BEACON ACTIVE', '#ff3333');
      }
    }
    if (b.active) {
      b.timer -= dt;
      b.ringTimer += dt;
      if (b.timer <= 0) {
        // Trigger reinforcements
        b.dead = true;
        audio.beaconTrigger();
        _EG.msg('⚠ REINFORCEMENTS INCOMING', '#ff4444');
        spawnParticles(b.x, b.y, 'EXPLOSION', '#ff2222', 16);
        const count = rndInt(2, 3);
        const map = _EG.dungeon.map;
        for (let j = 0; j < count; j++) {
          const type = pickEnemyType(b.floor);
          let ex, ey, att = 0;
          do {
            ex = b.room.x + rnd(1, b.room.w - 1);
            ey = b.room.y + rnd(1, b.room.h - 1);
            att++;
          } while (att < 20 && (
            !isPassable(map[Math.floor(ey)]?.[Math.floor(ex)]) ||
            dist(ex, ey, p.x, p.y) < 3
          ));
          if (!isPassable(map[Math.floor(ey)]?.[Math.floor(ex)])) continue;
          pendingEnemySpawns.push({ type, x: ex, y: ey, floor: b.floor, room: b.room });
        }
        beacons.splice(i, 1);
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawBeacons(camX, camY) {
  for (const b of beacons) {
    if (b.dead) continue;
    const tx = Math.floor(b.x), ty = Math.floor(b.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = b.x * TILE - camX, sy = b.y * TILE - camY;
    const pulse = 0.5 + 0.3 * Math.sin(b.bob * 2);

    if (b.active) {
      // Rapid flash
      const flash = Math.sin(b.ringTimer * 10) > 0 ? 1.0 : 0.3;
      // Expanding ring
      const ringR = (b.ringTimer % 0.8) / 0.8 * 18;
      const ringA = 1 - ringR / 18;
      ctx.save();
      ctx.globalAlpha = ringA * 0.4;
      ctx.strokeStyle = '#ff2222'; ctx.lineWidth = 1.5;
      NEON.draw.circleStroke(ctx, sx, sy, ringR);
      ctx.restore();
      // Core diamond
      ctx.save();
      ctx.globalAlpha = flash;
      ctx.shadowBlur = 14; ctx.shadowColor = '#ff0000';
      ctx.fillStyle = '#ff2222';
      ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.restore();
      // Countdown text
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff4444'; ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.shadowBlur = 6; ctx.shadowColor = '#ff0000';
      ctx.fillText(String(Math.ceil(b.timer)), sx, sy - 10);
      ctx.restore();
    } else {
      // Idle: subtle red glow diamond
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.shadowBlur = 8; ctx.shadowColor = '#ff2222';
      ctx.fillStyle = '#ff3333';
      ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.restore();
      // Antenna line
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1;
      NEON.draw.line(ctx, sx, sy - 5, sx, sy - 12);
      ctx.fillStyle = '#ff6666';
      NEON.draw.circle(ctx, sx, sy - 12, 1.5);
      ctx.restore();
      // Warning symbol
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.2 * Math.sin(b.bob);
      ctx.fillStyle = '#ff6644'; ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⚠', sx, sy + 10);
      ctx.restore();
    }
  }
}
