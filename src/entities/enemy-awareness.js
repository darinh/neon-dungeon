// @ts-check
'use strict';

// Loaded before src/entities.js; Enemy update reads these as script globals.
const ENEMY_TARGET_MEMORY_SECONDS = 3;
const ENEMY_SIGHT_RANGE = 15;
const ENEMY_ROOM_LEASH_TILES = 8;
const ENEMY_LEASH_DEFEND_RANGE = 2.5;
