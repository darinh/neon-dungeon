// @ts-check
'use strict';

// Wall direction -> base facing angle (into room) for wall-mounted devices.
/** @type {Record<string, number>} */
const WALL_FACING = { N: Math.PI / 2, S: -Math.PI / 2, E: Math.PI, W: 0 };
