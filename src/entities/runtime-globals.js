// @ts-check
'use strict';

// Must load before src/entities.js and any later src/entities/*.js consumer.
// The proxy widens access to runtime-added game props and defers resolution.
// Mirrors src/render.js (_RG), src/platform.js (_G), and legacy content helpers.
/** @type {any} */
const _EG = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});
