// @ts-check
'use strict';

/**
 * Linked allies get a damage-reduction flag applied outside this function.
 *
 * @this {Enemy}
 */
Enemy.prototype._nxUpdateLinks = function _nxUpdateLinks() {
  if (!this._nxLinks) this._nxLinks = [];
  const oldLinks = this._nxLinks;
  if (this.stunTimer > 0) {
    for (const e of oldLinks) { if (e && !e.dead) e._nxBoosted = false; }
    this._nxLinks = [];
    return;
  }
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
  // 7-tile break range is wider than the 5-tile acquire range so links don't flicker.
  const kept = [];
  for (const linked of oldLinks) {
    if (linked.dead || dist(this.x, this.y, linked.x, linked.y) > 7) continue;
    if (linked._wrPhased || linked._disguised) continue;
    if (linked.type === 'PHANTOM' && !linked.visible) continue;
    if (linked.room !== this.room) continue;
    kept.push(linked);
  }
  const MAX_LINKS = 3;
  for (const c of candidates) {
    if (kept.length >= MAX_LINKS) break;
    if (!kept.includes(c.e)) kept.push(c.e);
  }
  for (const e of oldLinks) {
    if (e && !e.dead && !kept.includes(e)) e._nxBoosted = false;
  }
  this._nxLinks = kept;
  for (const e of this._nxLinks) {
    if (!e._nxBoosted) audio.nexusLink();
    e._nxBoosted = true;
  }
};

/**
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
  this._nxLinkTimer = Math.max(0, (this._nxLinkTimer || 0) - dt);
  if (this._nxLinkTimer <= 0) {
    this._nxUpdateLinks();
    this._nxLinkTimer = 0.5;
  }
  // 2s base, about 1s at 3 links (0.33s off per link, floored at 1s).
  this._nxFireTimer = Math.max(0, (this._nxFireTimer || 0) - dt);
  const linkCount = this._nxLinks ? this._nxLinks.length : 0;
  const fireInterval = Math.max(1.0, 2.0 - linkCount * 0.33) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1) / bm;

  if (los && d < 4) {
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
    if (this._nxFireTimer <= 0) {
      this.fireAt(this._tx, this._ty, 6, this.atk, 12, '#00eedd');
      this._nxFireTimer = fireInterval;
    }
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
