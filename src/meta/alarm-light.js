// @ts-check
'use strict';
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

  // Opt-in set, keyed by AREAS[i].id in src/data/biomes.js. Adding an id needs no render.js change.
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
