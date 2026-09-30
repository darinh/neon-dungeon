// @ts-check
'use strict';

// Loaded before src/content.js so pickup classes stay script globals.

/**
 * @param {number} sx
 * @param {number} sy
 * @param {string} colour
 * @param {number} pulse
 * @param {number} radius
 */
function drawPickupHalo(sx, sy, colour, pulse, radius) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  NEON.draw.circleStroke(ctx, sx, sy, radius + 1.5 * pulse);
}

// Pickup applies HARVEST_SURGE (src/meta/boosts.js). ttl is seconds.
class HarvestPickup {
  /**
   * @param {any} x
   * @param {any} y
   */
  constructor(x, y) {
    this.x = x; this.y = y;
    this.dead = false;
    this.bob = rand('cosmetic') * TWO_PI;
    this.isHarvest = true;
    // Seconds. Draw flickers once ttl < 1 so expiry is visible before deletion.
    this.ttl = 5;
  }
  /** @param {any} dt */
  update(dt) {
    this.bob += dt * 3.5;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    if (this.dead) return;
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 3;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.6 + 0.4 * Math.sin(this.bob * 1.6);
    const urgent = this.ttl < 1.0;
    const flick = urgent ? (0.3 + 0.7 * Math.abs(Math.sin(this.bob * 14))) : 1;
    ctx.save();
    ctx.shadowBlur = 10 + 12 * pulse;
    ctx.shadowColor = '#ff9933';
    ctx.globalAlpha = (0.7 + 0.3 * pulse) * flick;
    drawPickupHalo(sx, sy, '#ffcc66', pulse, 7);
    ctx.fillStyle = '#ff9933';
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  }
}

// Not CREDIT_CACHE: that recomputes from floor and meta. amt is the exact
// banked value. isHoard is the game.js auto-collect branch. No TTL.
class MagpieHoard {
  /**
   * @param {any} x
   * @param {any} y
   * @param {number} amt   credit value to grant on pickup
   */
  constructor(x, y, amt) {
    this.x = x; this.y = y;
    this.dead = false;
    this.bob = rand('cosmetic') * TWO_PI;
    this.isHoard = true;
    this.amt = Math.max(0, Math.round(amt || 0));
  }
  /** @param {any} dt */
  update(dt) { this.bob += dt * 3; }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    if (this.dead) return;
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 3;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.6 + 0.4 * Math.sin(this.bob * 1.5);
    ctx.save();
    ctx.shadowBlur = 10 + 12 * pulse;
    ctx.shadowColor = '#ffd700';
    ctx.globalAlpha = 0.75 + 0.25 * pulse;
    // Silver-blue is MAGPIE's body colour, not the gold of a vault coin.
    drawPickupHalo(sx, sy, '#cceeff', pulse, 7);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(sx - 3, sy - 3, 6, 6);
    ctx.restore();
  }
}

// isHoard so MAGPIE's loot scan skips it; otherwise a thief vacuums vault
// drops mid-fight. amt is exact, not floor-recomputed. No TTL. _big splits
// the 5cr coin from the 25cr jackpot visually.
class VaultCoin {
  /**
   * @param {any} x
   * @param {any} y
   * @param {number} amt   credit value to grant on pickup
   */
  constructor(x, y, amt) {
    this.x = x; this.y = y;
    this.dead = false;
    this.bob = rand('cosmetic') * TWO_PI;
    this.isHoard = true;
    this.amt = Math.max(0, Math.round(amt || 0));
    // 15 sits between the 5cr coin and the 25cr jackpot.
    this._big = this.amt >= 15;
  }
  /** @param {any} dt */
  update(dt) { this.bob += dt * 3; }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    if (this.dead) return;
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 3;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.6 + 0.4 * Math.sin(this.bob * 1.5);
    const ringR = (this._big ? 7 : 4.5) + (this._big ? 1.5 : 1) * pulse;
    const coreSz = this._big ? 6 : 4;
    ctx.save();
    ctx.shadowBlur = (this._big ? 12 : 7) + 10 * pulse;
    ctx.shadowColor = '#ffd700';
    ctx.globalAlpha = 0.75 + 0.25 * pulse;
    drawPickupHalo(sx, sy, '#ffe680', 0, ringR);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(sx - coreSz / 2, sy - coreSz / 2, coreSz, coreSz);
    ctx.restore();
  }
}

// Non-damaging. Knockback is LOS-gated and bosses get stun only — shoving a
// boss breaks the arena. Applied directly, so the takeDamage stun cap does
// not apply; use SHOCK_PULSE_BOSS_STUN. No TTL.
const SHOCK_PULSE_RADIUS = 5.0;       // tiles
const SHOCK_PULSE_STUN   = 1.0;       // seconds
const SHOCK_PULSE_BOSS_STUN = 0.3;    // seconds
const SHOCK_PULSE_KNOCK  = 2.5;       // tiles
class ShockPulsePickup {
  /**
   * @param {any} x
   * @param {any} y
   */
  constructor(x, y) {
    this.x = x; this.y = y;
    this.dead = false;
    this.bob = rand('cosmetic') * TWO_PI;
    this.isShockPulse = true;
  }
  /** @param {any} dt */
  update(dt) { this.bob += dt * 4; }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    if (this.dead) return;
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 3;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.5 + 0.5 * Math.sin(this.bob * 1.4);
    ctx.save();
    ctx.shadowBlur = 10 + 14 * pulse;
    ctx.shadowColor = '#66e0ff';
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    drawPickupHalo(sx, sy, '#aaf0ff', pulse, 7);
    ctx.strokeStyle = '#66e0ff';
    ctx.lineWidth = 1;
    NEON.draw.circleStroke(ctx, sx, sy, 3.5 + 0.8 * pulse);
    ctx.fillStyle = '#e8faff';
    ctx.fillRect(sx - 1, sy - 1, 2, 2);
    ctx.restore();
  }
}

// Ground items still key colour off a non-persistent upgrade type.
const ITEM_TYPES = UPGRADES.filter(u => !u.persistent).slice(0, 3);
function pickItemType() { return ITEM_TYPES[rndInt(0, ITEM_TYPES.length - 1)]; }

class Item {
  /**
   * @param {any} x
   * @param {any} y
   * @param {any} [type]
   */
  constructor(x,y,type) {
    this.x=x; this.y=y; this.type=type||pickItemType();
    this.dead=false; this.bob=rand('cosmetic')*TWO_PI; this.isKey=false;
  }
  /**
   * @param {any} dt
   */
  update(dt) { this.bob+=dt*2.5; }
  /**
   * @param {any} camX
   * @param {any} camY
   */
  draw(camX,camY) {
    const tx=Math.floor(this.x), ty=Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 3;
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY+bobY;
    const pulse = 0.65 + 0.35 * Math.sin(this.bob * 1.3);
    ctx.save();
    ctx.shadowBlur = 8 + 10 * pulse;
    ctx.shadowColor = this.type.colour;
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    drawPickupHalo(sx, sy, this.type.colour, pulse, 7);
    ctx.fillStyle = this.type.colour;
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4.5, -4.5, 9, 9);
    ctx.restore();
  }
}

class KeyItem {
  /**
   * @param {any} x
   * @param {any} y
   * @param {any} colour
   * @param {any} tileColour
   */
  constructor(x,y,colour,tileColour) {
    this.x=x; this.y=y;
    this.colour=colour; // 'red','blue','gold'
    this.tileColour=tileColour;
    this.dead=false; this.bob=rand('cosmetic')*TWO_PI; this.isKey=true;
  }
  /**
   * @param {any} dt
   */
  update(dt) { this.bob+=dt*2; }
  /**
   * @param {any} camX
   * @param {any} camY
   */
  draw(camX,camY) {
    const tx=Math.floor(this.x), ty=Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY+Math.sin(this.bob)*3;
    const pulse = 0.65 + 0.35 * Math.sin(this.bob * 1.25);
    ctx.save();
    ctx.shadowBlur=15; ctx.shadowColor=this.tileColour;
    ctx.globalAlpha = 0.72 + 0.28 * pulse;
    drawPickupHalo(sx, sy, this.tileColour, pulse, 8);
    ctx.fillStyle=this.tileColour;
    NEON.draw.circle(ctx, sx, sy-3, 5);
    ctx.fillRect(sx-1.5, sy, 3, 8);
    ctx.fillRect(sx, sy+3, 4, 2);
    ctx.fillRect(sx, sy+6, 3, 2);
    ctx.restore();
  }
}

// isWhisper selects the game.js pickup branch. Its #aa66cc shadow matches the
// Archive WHISPERS counter (hub.js); whisper body copy lives in src/data/whispers.js.
class WhisperItem {
  /**
   * @param {any} x
   * @param {any} y
   * @param {string} whisperId
   */
  constructor(x, y, whisperId) {
    this.x = x; this.y = y;
    this.whisperId = whisperId;
    this.dead = false;
    this.bob = rand('cosmetic') * TWO_PI;
    this.isWhisper = true;
  }
  /** @param {any} dt */
  update(dt) { this.bob += dt * 1.6; }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 2.5;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.55 + 0.45 * Math.sin(this.bob * 1.4);
    ctx.save();
    ctx.shadowBlur = 6 + 12 * pulse;
    ctx.shadowColor = '#aa66cc';
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    drawPickupHalo(sx, sy, '#ff77ff', pulse, 7);
    ctx.fillStyle = '#cc99ee';
    NEON.draw.circle(ctx, sx, sy, 4 + 1.2 * pulse);
    ctx.fillStyle = '#552277';
    ctx.fillRect(sx - 0.8, sy - 5, 1.6, 10);
    ctx.fillRect(sx - 5, sy - 0.8, 10, 1.6);
    ctx.restore();
  }
}

class WeaponCacheItem {
  /**
   * @param {any} x
   * @param {any} y
   * @param {any} weapon
   */
  constructor(x, y, weapon) {
    this.x = x; this.y = y;
    this.weapon = weapon || buildWeapon('PULSE_PISTOL', []);
    this.dead = false;
    this.bob = rand('cosmetic') * TWO_PI;
    this.isWeaponCache = true;
  }
  /** @param {any} dt */
  update(dt) { this.bob += dt * 2.0; }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const colour = (this.weapon && this.weapon.colour) || '#ffb700';
    const bobY = Math.sin(this.bob) * 2.5;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.55 + 0.45 * Math.sin(this.bob * 1.5);
    ctx.save();
    ctx.shadowBlur = 10 + 12 * pulse;
    ctx.shadowColor = colour;
    ctx.globalAlpha = 0.72 + 0.28 * pulse;
    drawPickupHalo(sx, sy, '#ff8833', pulse, 8);
    ctx.fillStyle = colour;
    ctx.fillRect(sx - 7, sy - 1.5, 14, 3);
    ctx.fillRect(sx - 2, sy - 5, 4, 10);
    ctx.restore();
  }
}

/**
 * @param {any} player
 * @param {number} floor
 */
function rollSecretWeaponCacheWeapon(player, floor) {
  const belt = player && Array.isArray(player.weapons) ? player.weapons : [];
  const owned = new Set(belt.map((/** @type {any} */ w) => w && w._base).filter(Boolean));
  let bases = WEAPON_KEYS.filter(k => !owned.has(k));
  if (bases.length === 0 && player && player.weapon && player.weapon._base) {
    bases = WEAPON_KEYS.filter(k => k !== player.weapon._base);
  }
  if (bases.length === 0) bases = WEAPON_KEYS.slice();
  const baseKey = /** @type {string} */ (bases[rndInt(0, bases.length - 1, 'loot')]);
  return rollWeapon(baseKey, Math.min(10, (floor | 0) + 2));
}
