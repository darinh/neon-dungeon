// @ts-check
'use strict';

// Shared enemy perception/leash tuning. Loaded before src/entities.js so the
// Enemy update path can use these classic-script lexical globals directly.
const ENEMY_TARGET_MEMORY_SECONDS = 3;
const ENEMY_SIGHT_RANGE = 15;
const ENEMY_ROOM_LEASH_TILES = 8;
const ENEMY_LEASH_DEFEND_RANGE = 2.5;
