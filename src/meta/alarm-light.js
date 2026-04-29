// @ts-check
'use strict';
// src/meta/alarm-light.js — game-side wiring of the engine alarm-light.
//
// Configures the NEON DUNGEON-specific biome allowlist (cache, firewall,
// uplink)
// against the engine factory at engine/alarm-light.js, and exposes the
// wired-up surface on NEON.alarmLight for render.js consumers.
//
// Other biomes can opt in by adding their id to ALARM_BIOMES below — no
// render.js change required.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else (/** @type {any} */ (root.NEON = root.NEON || {})).alarmLight = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /** @type {{ isAlarmSlot:(h:number)=>boolean, intensity:(t:unknown,h:number)=>number, createAlarmLight:(opts:{allowedBiomes?:Set<string>|string[]|null})=>{allowedBiomes:Set<string>,isAlarmSlot:(h:number)=>boolean,intensity:(t:unknown,h:number)=>number,shouldDraw:(b:unknown,h:number)=>boolean} }} */
  const engine = (typeof module === 'object' && module.exports)
    ? require('../../engine/alarm-light')
    : /** @type {any} */ ((typeof self !== 'undefined' ? self : globalThis)).NEON.alarmLightEngine;

  // Biomes that opt in to alarm lights. Keyed by AREAS[i].id from
  // src/data/biomes.js.
  const ALARM_BIOMES = new Set(['cache', 'firewall', 'uplink']);

  const wired = engine.createAlarmLight({ allowedBiomes: ALARM_BIOMES });

  return {
    ALARM_BIOMES,
    allowedBiomes: wired.allowedBiomes,
    isAlarmSlot: wired.isAlarmSlot,
    intensity: wired.intensity,
    shouldDraw: wired.shouldDraw,
  };
}));
