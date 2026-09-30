// @ts-check
'use strict';

// Loaded before src/content.js so these names stay script globals.

/** @type {any} */
const _CC = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});

const combo = { count: 0, timer: 0, best: 0, flashTimer: 0 };
const COMBO_WINDOW    = 3;     // seconds between kills
const COMBO_STEP      = 0.25;
const COMBO_MAX_MULT  = 4;
const COMBO_BOSS_CAP  = 2;
function comboMultiplier() {
  return combo.count < 2 ? 1 : Math.min(COMBO_MAX_MULT, 1 + (combo.count - 1) * COMBO_STEP);
}
function comboBossMultiplier() {
  return Math.min(COMBO_BOSS_CAP, comboMultiplier());
}
function comboColour() {
  const c = combo.count;
  if (c >= 11) return '#ff00c8';  // magenta
  if (c >= 8)  return '#ff6622';  // orange
  if (c >= 5)  return '#ffb700';  // yellow
  return '#00f5ff';               // cyan
}
/**
 * @param {any} isBoss
 */
function registerKill(isBoss) {
  combo.count++;
  combo.timer = COMBO_WINDOW;
  combo.flashTimer = 0.3;
  if (combo.count > combo.best) combo.best = combo.count;
  if (combo.count >= 2) audio.comboTick(combo.count);
  if (combo.count === 5 || combo.count === 10 || combo.count === 15 || combo.count === 20) {
    const p = _CC.player;
    spawnDmgText(p.x, p.y - 0.5, `×${combo.count} COMBO!`, comboColour());
  }
}
/**
 * @param {any} dt
 */
function updateCombo(dt) {
  if (combo.count < 1) return;
  combo.timer -= dt;
  combo.flashTimer = Math.max(0, combo.flashTimer - dt);
  if (combo.timer <= 0) { combo.count = 0; combo.timer = 0; }
}
