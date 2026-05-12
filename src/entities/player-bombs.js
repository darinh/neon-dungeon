// @ts-check
'use strict';

// Player tap-bomb bridge. The FuseShard runtime owns bomb construction,
// detonation, ticking, rendering, and clearing; Player only owns the input
// action that either panic-detonates active fuses or drops a new shard.

Player.prototype.tapBombKey = function tapBombKey() {
  // Panic mode: any unfused bomb? Detonate them all.
  let detonatedAny = false;
  for (const fs of fuseShards) {
    if (!fs.dead) { fs.detonate(); detonatedAny = true; }
  }
  if (detonatedAny) return;
  // Drop mode: gated by cooldown (prevents tap-spam carpet bombing).
  if (this.bombCooldown > 0) return;
  fuseShards.push(new FuseShard(this.x, this.y));
  this.bombCooldown = BOMB_DROP_COOLDOWN;
};
