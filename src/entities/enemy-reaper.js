// @ts-check
'use strict';

// ─── REAPER AI — Aggression-Punishing Chaser ────────────────────────────
// Floor 7+. Melee chaser whose threat scales with PLAYER aggression
// (player.killsInCurrentRoom) instead of with floor number. Reward
// careful pacing, punish spam-clearing.
//
// States:
//   idle:      chase player at base spd; melee on contact (d<1.2). Each
//              frame, if player is in this REAPER's room AND
//              killsInCurrentRoom >= REAPER_FRENZY_THRESHOLD AND we
//              haven't already frenzied this room visit, enter telegraph.
//   telegraph: _reTele ticks down (REAPER_TELEGRAPH s) ONLY while player
//              is in our room. Visible red ring drawn ON THE PLAYER.
//              Chase continues. On 0, enter frenzy and set _reHasFrenzied
//              so we don't re-trigger this room visit. Stun cancels (see
//              update() stun branch).
//   frenzy:    _reFrenzy ticks down (REAPER_FRENZY_DURATION s) ONLY while
//              player is in our room. Chase speed = base * 1.6.
//              Stun-immune (handled in update() stun branch).
//
// Reset: player room change clears killsInCurrentRoom AND _reHasFrenzied
// for every REAPER in the new room (handled in game.js updatePlaying).
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiReaper = function aiReaper(dt, player, map, d, los) {
  void los; // chase doesn't gate on LoS — the reaper hunts by sound
  // Player-in-room test using THIS reaper's room (not player._currentRoom)
  // because reapers in rooms the player is leaving still need to know to
  // PAUSE rather than continue ticking off-screen.
  const playerInRoom = !!(this.room &&
    player.x >= this.room.x && player.x < this.room.x + this.room.w &&
    player.y >= this.room.y && player.y < this.room.y + this.room.h);

  // Telegraph: pause while player is out of our room (fairness rule).
  if (this._reState === 'telegraph') {
    if (playerInRoom) {
      this._reTele -= dt;
      if (this._reTele <= 0) {
        this._reState = 'frenzy';
        this._reFrenzy = REAPER_FRENZY_DURATION;
        this._reFrenzied = true;
        // _reHasFrenzied was already latched on telegraph entry — leave it.
        this._reTele = 0;
        if (audio.reaperFrenzy) audio.reaperFrenzy();
        spawnParticles(this.x, this.y, 'EXPLOSION', '#cc1144', 8);
      }
    }
    // Continue chasing during telegraph (no movement freeze).
  } else if (this._reState === 'frenzy') {
    if (playerInRoom) {
      this._reFrenzy -= dt;
      if (this._reFrenzy <= 0) {
        this._reState = 'idle';
        this._reFrenzy = 0;
        this._reFrenzied = false;
      }
    }
  } else {
    // idle: arm telegraph if conditions met
    const kills = (player && player.killsInCurrentRoom) || 0;
    if (playerInRoom && !this._reHasFrenzied && kills >= REAPER_FRENZY_THRESHOLD &&
        this._canTarget()) {
      this._reState = 'telegraph';
      this._reTele = REAPER_TELEGRAPH;
      // Consume the per-room latch IMMEDIATELY on telegraph entry (not
      // on frenzy entry). That way a stun-cancel during telegraph still
      // counts as the player's "one-shot defuse for this room visit"
      // — re-arm only happens on player room change.
      this._reHasFrenzied = true;
      if (audio.reaperTelegraph) audio.reaperTelegraph();
    }
  }

  // Chase logic — read frenzy via local multiplier (NEVER mutate this.spd
  // or the buff leaks into save/restore and difficulty scaling).
  if (d < REAPER_DETECT_RANGE && this._canTarget()) {
    const chaseSpd = this.spd * (this._reFrenzied ? REAPER_FRENZY_SPD_MUL : 1);
    this.moveToward(this._tx, this._ty, chaseSpd, dt, map);
    if (d < 1.2) this.meleeAttack(player);
  } else {
    this.patrol(dt, map);
  }
};
