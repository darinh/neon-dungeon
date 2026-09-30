// @ts-check
'use strict';

// FuseShard owns construction, detonation, ticking, and rendering.
// This only panic-detonates live fuses or drops a new shard.

Player.prototype.tapBombKey = function tapBombKey() {
  let detonatedAny = false;
  for (const fs of fuseShards) {
    if (!fs.dead) { fs.detonate(); detonatedAny = true; }
  }
  if (detonatedAny) return;
  if (this.bombCooldown > 0) return;
  fuseShards.push(new FuseShard(this.x, this.y));
  this.bombCooldown = BOMB_DROP_COOLDOWN;
};
