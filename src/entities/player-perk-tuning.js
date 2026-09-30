// @ts-check
'use strict';

// tiles/sec via moved/dt, not tiles/frame, so the gate matches at 30/60/120 fps.
const STRIDE_MOVE_RATE = 0.5;     // tiles/sec
const STRIDE_PER_STACK = 1.0;     // seconds of movement per stack
const STRIDE_MAX_STACKS = 5;
const STRIDE_DMG_PER_STACK = 0.05;
const STRIDE_RESET_GRACE = 0.3;   // seconds of stillness before stacks drop

// Full charge survives movement until one shot consumes it. Partial charge
// cancels on movement; see the split in Player.update.
const DEADEYE_MOVE_RATE = 0.5;    // tiles/sec
const DEADEYE_CHARGE_TIME = 1.0;  // seconds of stillness to fully charge
const DEADEYE_DMG_MUL = 1.5;

// Reset on a new enemy ref or after HOT_HAND_WINDOW idle — a teleport with
// no combat must not keep the streak. Applied in Enemy.takeDamage before
// shield/DR/NEXUS, and multiplicative with EXPLOITER and MARK.
const HOT_HAND_PER_STACK = 0.05;
const HOT_HAND_MAX_STACKS = 6;     // streak-1 cap; streak >= 7 stays at +30%
const HOT_HAND_WINDOW    = 3.0;    // seconds since last hit before streak resets
