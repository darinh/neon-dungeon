// @ts-check
'use strict';

// Runtime pickup classes and pickup-specific tunables. Loaded before
// src/content.js so content, entity, render, and game coordinators keep sharing
// the same script-tag globals while pickup visuals live in their own module.

// HARVESTER drop — pulses, decays after 5s if uncollected. Picking it up
// applies HARVEST_SURGE (+50% damage for 8s — see src/meta/boosts.js). Shape
// is a diamond core wrapped in a pulsing surge ring so it's distinguishable
// at a glance from a plain Item or KeyItem; orange-amber palette matches the
// HARVESTER mob's body colour for source attribution.
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
    // Decays after 5s if uncollected. Tracks remaining time so the draw
    // branch can flash + alpha-fade in the last second to telegraph imminent
    // expiry — the player decides whether the dash is worth it.
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
    // Last-second urgency: rapid alpha flicker once ttl < 1.0.
    const urgent = this.ttl < 1.0;
    const flick = urgent ? (0.3 + 0.7 * Math.abs(Math.sin(this.bob * 14))) : 1;
    ctx.save();
    ctx.shadowBlur = 10 + 12 * pulse;
    ctx.shadowColor = '#ff9933';
    ctx.globalAlpha = (0.7 + 0.3 * pulse) * flick;
    // Outer surge ring — clearly different from Item's static diamond.
    ctx.strokeStyle = '#ffcc66';
    ctx.lineWidth = 1.5;
    NEON.draw.circleStroke(ctx, sx, sy, 7 + 1.5 * pulse);
    // Inner diamond core
    ctx.fillStyle = '#ff9933';
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  }
}

// MagpieHoard — hoard pickup dropped by MAGPIE on death. Grants the
// total credit value the thief banked across all the items it consumed
// during its life. Hand-rolled (instead of reusing CREDIT_CACHE)
// because CREDIT_CACHE.fn() recomputes the amount from current floor +
// meta multipliers — which would be wrong here: we want to refund the
// EXACT value the thief banked. Auto-collected via an `isHoard` branch
// in game.js's pickup loop (mirrors the isHarvest pattern). The pickup
// sits on the floor visibly so the player has to actually walk to the
// thief's death spot — a small "go fetch" beat that makes the kill
// feel earned. No TTL: hoard pickups persist for the rest of the
// floor (so a long detour to clear other enemies first doesn't lose
// the recovery).
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
    // Outer ring — pale silver-blue (MAGPIE colour) so the player
    // recognises it as "the thief's hoard" at a glance.
    ctx.strokeStyle = '#cceeff';
    ctx.lineWidth = 1.5;
    NEON.draw.circleStroke(ctx, sx, sy, 7 + 1.5 * pulse);
    // Inner gold square — currency glyph.
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(sx - 3, sy - 3, 6, 6);
    ctx.restore();
  }
}

// VaultCoin — credit pickup ejected by VAULTMASTER. Two flavours, both
// constructed via `new VaultCoin(x, y, amt)`:
//   - per-hit ejection (small): amt = VAULTMASTER_COIN_AMT (5)
//   - on-death jackpot (large): amt = VAULTMASTER_JACKPOT_AMT (25)
// Visual scales with amt so the player reads "small drop" vs "fat
// jackpot" at a glance. Auto-collected via the `isHoard` branch in
// game.js's pickup loop (mirrors MagpieHoard); also flagged isHoard so
// MAGPIE's loot-scan filter excludes it (`if (it.isHoard) continue;`
// at entities.js aiMagpie ~2315) — otherwise a passing thief could
// vacuum the vault drops mid-fight, which would feel like a bug
// rather than counterplay. Hand-rolled (instead of reusing CREDIT_CACHE
// or the Item-with-CREDIT-type approach) for the same reason as
// MagpieHoard: we want a fixed, exact amount granted on collection,
// not a floor-recomputed value. No TTL — coins persist for the rest
// of the floor so milking-then-clearing-the-room-first is a valid
// economic play (matches MagpieHoard's no-TTL choice for the same
// "earn the recovery" beat). Distinct visual from MagpieHoard:
// pure gold ring + inner gold core (no MAGPIE silver-blue), so the
// player reads vault-drops as a different economic source.
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
    // Visual size hint — used to scale the ring radius. Coin (5cr) reads
    // as small + abundant; jackpot (25cr) reads as fat + singular.
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
    // Outer ring — pure gold (distinct from MagpieHoard's silver-blue
    // ring, so the player reads "vault loot" not "thief loot").
    ctx.strokeStyle = '#ffe680';
    ctx.lineWidth = 1.5;
    NEON.draw.circleStroke(ctx, sx, sy, ringR);
    // Inner gold core.
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(sx - coreSz / 2, sy - coreSz / 2, coreSz, coreSz);
    ctx.restore();
  }
}

// SHOCK_PULSE pickup — defensive panic-button consumable. Auto-collected on
// player contact (mirrors HealthPack-style pickup feedback). Discharges an
// AoE knockback + brief stun centred on the player. NON-DAMAGING — the
// payoff is positional / tempo (panic-eject a swarm, regain footing) rather
// than DPS. Distinct from MAGPIE/VAULTMASTER pickups (currency) and
// HARVESTER pickup (timed buff): this one has an immediate spatial/control
// effect and no lingering boost.
//
// Design notes:
//  - Floor-gated to floor 3+ via populateFloor placement (matches mines).
//  - Spawn rate ~30% per floor with a once-per-floor cap (rare panic
//    button, not a stack-and-spam consumable).
//  - LOS-gated knockback so enemies behind walls aren't shoved around the
//    geometry. Same gate other AoE helpers use (LEAPER shockwave, mine
//    explode), keeps "what you can see is what you affect" parity.
//  - Bosses: brief stun (boss stunTimer cap = 0.3s already enforced
//    elsewhere) but NO knockback — boss positioning is a designed
//    encounter constraint and shoving them breaks arena flow.
//  - No TTL — sits on the floor until claimed (matches MagpieHoard /
//    VaultCoin choice; the player decides when to use it).
const SHOCK_PULSE_RADIUS = 5.0;       // tiles
const SHOCK_PULSE_STUN   = 1.0;       // seconds (capped to 0.3 for bosses by takeDamage path; we apply directly)
const SHOCK_PULSE_BOSS_STUN = 0.3;    // explicit shorter cap for bosses
const SHOCK_PULSE_KNOCK  = 2.5;       // tiles of impulse displacement
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
    // Two concentric arc rings — "stored shockwave" silhouette, distinct
    // from VaultCoin's solid gold ring + core and HarvestPickup's diamond.
    ctx.strokeStyle = '#aaf0ff';
    ctx.lineWidth = 1.5;
    NEON.draw.circleStroke(ctx, sx, sy, 7 + 1.5 * pulse);
    ctx.strokeStyle = '#66e0ff';
    ctx.lineWidth = 1;
    NEON.draw.circleStroke(ctx, sx, sy, 3.5 + 0.8 * pulse);
    // Central spark — small bright dot.
    ctx.fillStyle = '#e8faff';
    ctx.fillRect(sx - 1, sy - 1, 2, 2);
    ctx.restore();
  }
}

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
    ctx.fillStyle = this.type.colour;
    // Diamond shape (rotated square) — visually distinct from enemy squares.
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
    ctx.save();
    ctx.shadowBlur=15; ctx.shadowColor=this.tileColour;
    ctx.fillStyle=this.tileColour;
    // Key shape: circle + teeth
    NEON.draw.circle(ctx, sx, sy-3, 5);
    ctx.fillRect(sx-1.5, sy, 3, 8);
    ctx.fillRect(sx, sy+3, 4, 2);
    ctx.fillRect(sx, sy+6, 3, 2);
    ctx.restore();
  }
}

// Whispers subplot — pickup that triggers the narrative fragment in the
// ARCHIVE (src/data/whispers.js + src/meta/whispers.js). Visually distinct
// from KeyItem: pulsing violet glyph (the cryptic-fragment colour echoes the
// 'WHISPERS: N/M' counter in hub.js Archive). isWhisper flag drives the
// pickup branch in src/game.js.
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
    ctx.fillStyle = '#cc99ee';
    // Hexagonal/diamond glyph — clearly NOT a key (no teeth) and NOT a
    // generic Item diamond (slightly larger, vertical orientation).
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
    ctx.strokeStyle = '#ffb700';
    ctx.lineWidth = 1.5;
    NEON.draw.circleStroke(ctx, sx, sy, 8 + 1.5 * pulse);
    ctx.fillStyle = colour;
    ctx.fillRect(sx - 7, sy - 1.5, 14, 3);
    ctx.fillRect(sx - 2, sy - 5, 4, 10);
    ctx.restore();
  }
}
