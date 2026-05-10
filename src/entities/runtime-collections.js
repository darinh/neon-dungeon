// @ts-check
'use strict';

// Shared entity/runtime collections. These arrays keep their identities for the
// full page session; floor transitions clear contents in render.js populateFloor()
// for most arrays and game.js loadFloor() for placedWalls.
/** @type {any[]} */ const enemies = [];
/** @type {any[]} */ const items   = [];
/** @type {any[]} */ const hazardZones = [];
/** @type {any[]} */ const vcores  = [];
/** @type {any[]} */ const crates  = [];
/** @type {any[]} */ const beacons = [];
/** @type {any[]} */ const mines   = [];
/** @type {any[]} */ const shieldGens = [];
/** @type {any[]} */ const cameras = [];
/** @type {any[]} */ const lasers  = [];
/** @type {any[]} */ const wallTurrets = [];
// ARCHITECT-placed walls (PR ARCHITECT). Each entry tracks a tile that the
// ARCHITECT mob has converted from FLOOR/etc. to T.WALL — preserves the
// origTile so the wall can decay back to its original state, and the
// owner reference so each ARCHITECT can replace its own wall without
// stacking. Each entry: { tx, ty, origTile, decayTimer, owner }.
// Cleared on floor transition (game.js loadFloor — same place
// placedWalls.length=0 alongside other transient arrays).
/** @type {any[]} */ const placedWalls = [];
