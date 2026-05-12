// @ts-check
'use strict';

/**
 * MAGPIE — loot-thief (floor 4+, hp=28, atk=0, spd=3.4).
 *
 * Non-damaging fast mob whose only mechanic is racing to dropped
 * Items and "consuming" them. Each consumed item banks
 * `MAGPIE_STOLEN_BASE + floor * MAGPIE_STOLEN_PERFL` credits onto
 * `this._mgStolenCr`. On death, die() drops a MagpieHoard pickup
 * worth the banked total — so the player can fully recover what
 * was stolen by killing the thief.
 *
 * State machine:
 *   1. No target + items in scan range → re-target nearest valid Item
 *   2. Valid target → moveToward(target.x, target.y); on grab,
 *      mark target.dead = true, increment _mgStolenCr, clear target
 *   3. Carrying (_mgStolenCr > 0) AND no fresh target → flee from
 *      player (move along the player→thief vector, away from
 *      player), trying to keep at least MAGPIE_FLEE_RANGE distance.
 *   4. Idle (no items, no carry) → low-key patrol so it isn't
 *      a static blob.
 *
 * Targeting filter: only generic `Item` instances qualify. Keys
 * (.isKey), HarvestPickup (.isHarvest), WhisperItem (.isWhisper)
 * are explicitly excluded — stealing those would feel like a bug,
 * not a mechanic. This list is exhaustive for the current items[]
 * array (KeyItem / HarvestPickup / WhisperItem / Item / MagpieHoard);
 * MagpieHoard pickups are also skipped (`.isHoard`) so a second
 * MAGPIE can't infinite-loop a hoard from a dead sibling.
 *
 * Re-scan throttle: scanning items[] every frame would be wasteful
 * (most frames items[] is unchanged). MAGPIE_SCAN_PERIOD = 0.4s
 * gives ~2.5 scans/sec which is faster than a player's pickup
 * cadence — the thief reads as "alert" without burning the loop.
 * Re-scan also fires immediately after a successful grab and on
 * any frame where the current target is gone (covers the case
 * where the player pickups the targeted item between scans).
 *
 * Excluded from the elite affix roll: same first-ship caution as
 * recently-introduced mobs (HARVESTER / MAGNETON / SPECTRE /
 * SAPPER) — easier to add elite affixes later than to reason
 * about SHIELDED / PHASING / FRENZY interactions for a brand-new
 * non-damaging mechanic.
 *
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiMagpie = function aiMagpie(dt, player, map, d, los) {
  void los; // LOS is irrelevant — MAGPIE pursues items, not the player
  this._mgScanT = (this._mgScanT || 0) - dt;
  // Drop stale targets early so the dispatch logic below doesn't
  // chase a freshly-collected pickup. Item.dead is set by the player
  // pickup path AND by a previous MAGPIE's grab.
  if (isMagpieTargetStale(this._mgTarget, items)) {
    this._mgTarget = null;
  }
  // Re-scan when throttle expired OR when we have no current target.
  if (!this._mgTarget || this._mgScanT <= 0) {
    this._mgScanT = MAGPIE_SCAN_PERIOD;
    const best = pickMagpieTarget(items, this.x, this.y, MAGPIE_SCAN_RANGE);
    if (best) this._mgTarget = best;
  }
  // 1) Have a target — race for it.
  if (this._mgTarget) {
    this.moveToward(this._mgTarget.x, this._mgTarget.y, this.spd, dt, map);
    if (isMagpieTargetInGrabRange(this._mgTarget, this.x, this.y, MAGPIE_GRAB_RANGE)) {
      // Consume the item. Mark dead so game.js's prune (after enemy
      // updates) splices it from items[]. Cannot splice here
      // because we're iterating items[] indirectly across multiple
      // MAGPIEs in the same enemy update loop.
      this._mgTarget.dead = true;
      const floorNum = (_EG && _EG.floor) || 1;
      const banked = magpieStolenCreditsForFloor(floorNum, MAGPIE_STOLEN_BASE, MAGPIE_STOLEN_PERFL);
      this._mgStolenCr = (this._mgStolenCr || 0) + banked;
      spawnDmgText(this.x, this.y, '+' + banked + ' CR', '#cceeff');
      spawnParticles(this.x, this.y, 'SPARK', '#cceeff', 8);
      try { audio.pickup(); } catch (_) { /* audio optional */ }
      this._mgTarget = null;
      this._mgScanT = 0; // re-scan next frame in case more loot is in range
    }
    return;
  }
  // 2) Carrying — flee from the player. Aim at a point along the
  //    player→thief vector, projected outward by MAGPIE_FLEE_RANGE,
  //    so moveToward routes through the map walker (respecting walls).
  //    If LOS is blocked the thief naturally seeks corners — fine.
  //    Use the REAL player distance (pd), not the taunt-aware `d`
  //    passed in by update() — `d` is computed from `_tx/_ty` which
  //    can point at a hologram, so a carrying MAGPIE next to the
  //    player would fail this gate during a DECOY taunt and fall
  //    through to patrol. Flee always tracks the actual player.
  const pd = dist(this.x, this.y, player.x, player.y);
  if (shouldMagpieFlee(this._mgStolenCr, pd, MAGPIE_FLEE_RANGE)) {
    const { x: fx, y: fy } = pickMagpieFleeTarget(this.x, this.y, player.x, player.y, MAGPIE_FLEE_RANGE);
    this.moveToward(fx, fy, this.spd, dt, map);
    return;
  }
  // 3) Idle / patrol. Slow drift so a thief without targets reads
  //    as alive, not a placeholder turret.
  this.patrol(dt, map);
};
