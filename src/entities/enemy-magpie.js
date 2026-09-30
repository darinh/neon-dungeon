// @ts-check
'use strict';

/**
 * Banks stolen credits on _mgStolenCr; die() drops a MagpieHoard for that total.
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
  // Drop targets another MAGPIE or the player already marked dead.
  if (isMagpieTargetStale(this._mgTarget, items)) {
    this._mgTarget = null;
  }
  if (!this._mgTarget || this._mgScanT <= 0) {
    this._mgScanT = MAGPIE_SCAN_PERIOD;
    const best = pickMagpieTarget(items, this.x, this.y, MAGPIE_SCAN_RANGE);
    if (best) this._mgTarget = best;
  }
  if (this._mgTarget) {
    this.moveToward(this._mgTarget.x, this._mgTarget.y, this.spd, dt, map);
    if (isMagpieTargetInGrabRange(this._mgTarget, this.x, this.y, MAGPIE_GRAB_RANGE)) {
      // Mark dead for game.js to prune after enemy updates. Do not splice; other MAGPIEs are still walking items[].
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
  // Flee uses real player distance, not taunt-aware d (_tx/_ty can be a hologram).
  const pd = dist(this.x, this.y, player.x, player.y);
  if (shouldMagpieFlee(this._mgStolenCr, pd, MAGPIE_FLEE_RANGE)) {
    const { x: fx, y: fy } = pickMagpieFleeTarget(this.x, this.y, player.x, player.y, MAGPIE_FLEE_RANGE);
    this.moveToward(fx, fy, this.spd, dt, map);
    return;
  }
  this.patrol(dt, map);
};
