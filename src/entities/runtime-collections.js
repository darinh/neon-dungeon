// @ts-check
'use strict';

// These arrays keep their identities for the page session. Floor transitions
// clear contents in render.js populateFloor(), and placedWalls in game.js loadFloor().
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
// ARCHITECT walls: { tx, ty, origTile, decayTimer, owner }. origTile is restored
// on decay; owner lets each ARCHITECT replace its own wall without stacking.
/** @type {any[]} */ const placedWalls = [];
