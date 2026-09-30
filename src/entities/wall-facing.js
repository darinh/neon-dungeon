// @ts-check
'use strict';

// Facing points into the room, not along the wall.
/** @type {Record<string, number>} */
const WALL_FACING = { N: Math.PI / 2, S: -Math.PI / 2, E: Math.PI, W: 0 };
