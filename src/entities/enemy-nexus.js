// @ts-check
'use strict';

/**
 * Refresh NEXUS ally links and apply/remove the linked damage-reduction flag.
 *
 * @this {Enemy}
 */
Enemy.prototype._nxUpdateLinks = function _nxUpdateLinks() {
  if (!this._nxLinks) this._nxLinks = [];
  const oldLinks = this._nxLinks;
  // If stunned, all links break
  if (this.stunTimer > 0) {
    for (const e of oldLinks) { if (e && !e.dead) e._nxBoosted = false; }
    this._nxLinks = [];
    return;
  }
  // Find up to 3 closest valid allies within 5 tiles (scoped to room)
  const candidates = [];
  for (const e of enemiesInRoomIter(this.room)) {
    if (e === this || e.dead || e.isBoss) continue;
    if (e.type === 'NEXUS') continue;
    if (e._wrPhased) continue;
    if (e._disguised) continue;
    if (e.type === 'PHANTOM' && !e.visible) continue;
    const ed = dist(this.x, this.y, e.x, e.y);
    if (ed > 5) continue;
    candidates.push({ e, d: ed });
  }
  candidates.sort((a, b) => a.d - b.d);
  // Keep existing links if still valid (within 7-tile break range), fill up to 3
  const kept = [];
  for (const linked of oldLinks) {
    if (linked.dead || dist(this.x, this.y, linked.x, linked.y) > 7) continue;
    if (linked._wrPhased || linked._disguised) continue;
    if (linked.type === 'PHANTOM' && !linked.visible) continue;
    if (linked.room !== this.room) continue;
    kept.push(linked);
  }
  // Add new links from candidates
  const MAX_LINKS = 3;
  for (const c of candidates) {
    if (kept.length >= MAX_LINKS) break;
    if (!kept.includes(c.e)) kept.push(c.e);
  }
  // Clear boost on enemies no longer linked
  for (const e of oldLinks) {
    if (e && !e.dead && !kept.includes(e)) e._nxBoosted = false;
  }
  this._nxLinks = kept;
  // Apply boost flag; audio only on newly formed links
  for (const e of this._nxLinks) {
    if (!e._nxBoosted) audio.nexusLink();
    e._nxBoosted = true;
  }
};

/**
 * Find an ally near the densest local cluster for NEXUS retreat/drift movement.
 *
 * @this {Enemy}
 * @returns {any}
 */
Enemy.prototype._nxFindAllyCluster = function _nxFindAllyCluster() {
  let best = null, bestCount = 0;
  const roomEnemies = enemiesInRoomIter(this.room);
  for (const e of roomEnemies) {
    if (e === this || e.dead) continue;
    if (e.isBoss || e._wrPhased || e._disguised) continue;
    let nearby = 0;
    for (const o of roomEnemies) {
      if (o === e || o === this || o.dead) continue;
      if (dist(e.x, e.y, o.x, o.y) < 4) nearby++;
    }
    if (nearby > bestCount) { bestCount = nearby; best = e; }
  }
  return best;
};

/**
 * NEXUS: Neural Command Node — links to nearby allies, buffing with DR.
 * Maintains ally links, retreats toward clusters, and fires linked shots.
 *
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiNexus = function aiNexus(dt, player, map, d, los) {
  void player;
  const bm = this.berserkerMul();
  // Update links every 0.5s
  this._nxLinkTimer = Math.max(0, (this._nxLinkTimer || 0) - dt);
  if (this._nxLinkTimer <= 0) {
    this._nxUpdateLinks();
    this._nxLinkTimer = 0.5;
  }
  // Fire rate scales with link count: 2.0s base → 1.0s with 3 links
  this._nxFireTimer = Math.max(0, (this._nxFireTimer || 0) - dt);
  const linkCount = this._nxLinks ? this._nxLinks.length : 0;
  const fireInterval = Math.max(1.0, 2.0 - linkCount * 0.33) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1) / bm;

  if (los && d < 4) {
    // Too close — retreat toward nearest ally cluster
    const ally = this._nxFindAllyCluster();
    let tx, ty;
    if (ally) {
      tx = ally.x; ty = ally.y;
    } else {
      tx = this.x + (this.x - this._tx);
      ty = this.y + (this.y - this._ty);
    }
    this.moveToward(tx, ty, this.spd, dt, map);
  } else if (los && d <= 10) {
    // In range — fire at player
    if (this._nxFireTimer <= 0) {
      this.fireAt(this._tx, this._ty, 6, this.atk, 12, '#00eedd');
      this._nxFireTimer = fireInterval;
    }
    // Drift toward ally cluster to maintain links
    const ally = this._nxFindAllyCluster();
    if (ally && dist(this.x, this.y, ally.x, ally.y) > 3) {
      this.moveToward(ally.x, ally.y, this.spd * 0.4, dt, map);
    }
  } else if (d > 10 && los) {
    this.moveToward(this._tx, this._ty, this.spd * 0.5, dt, map);
  } else {
    this.patrol(dt, map);
  }
};
