// @ts-check
'use strict';
// engine/viewport.js — pure viewport math + orientation helpers.
//
// Engine layer (🟦): no NEON DUNGEON nouns. All exports are pure functions
// over numbers / DOM-ish inputs the caller supplies. This module owns no
// mutable state — the host (src/platform.js) keeps the W/H/scale/offX/offY/
// safe-area `let`s and uses these helpers to recompute them on resize.
//
// Surface:
//   isLandscape(win, scr)
//     → boolean. Prefers `scr.orientation.type` (modern), falls back to
//     `win.innerWidth > win.innerHeight`. `scr` and `win` are injected so
//     the function stays testable in Node.
//
//   computeScale(vw, vh, target=600, lo=0.7, hi=1.5)
//     → number in [lo, hi]. Maps the smaller viewport dimension to ~`target`
//     logical px, then clamps. This is the per-resize gameScale formula.
//
//   computeLogicalSize(vw, vh, scale)
//     → { W, H } rounded logical dimensions (vw/scale, vh/scale).
//
//   computeLayout(W, H, safeBottom)
//     → { compact, hudH, hudTop, msgBase }. `compact` is true on portrait
//     phones (H>W && W<=600), which bumps HUD height. msgBase is the y for
//     the bottom-of-screen message log.
//
//   parseSafeAreaInsets(getProp, scale)
//     → { top, right, bottom, left } in logical px. `getProp` is a function
//     taking a CSS custom property name ('--sat'/'--sar'/'--sab'/'--sal')
//     and returning the raw computed value (typically a CSS px string from
//     getComputedStyle(documentElement).getPropertyValue). Non-numeric →
//     treated as 0. Each inset is divided by `scale` to convert CSS px →
//     logical px.
//
// Browser: attaches as `window.NEON.viewport`. Pure helpers only — does NOT
// mount bare globals (unlike engine/math.js) because the host owns the
// stateful equivalents (resize/updateLayout/isLandscape) and re-exports
// them as wrappers in src/platform.js.
//
// Node: module.exports = { isLandscape, computeScale, computeLogicalSize,
//                          computeLayout, parseSafeAreaInsets }.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const ns = /** @type {any} */ (r.NEON = r.NEON || {});
  ns.viewport = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * @param {{ innerWidth:number, innerHeight:number } | any} win
   * @param {{ orientation?: { type?: string } } | any} scr
   * @returns {boolean}
   */
  function isLandscape(win, scr) {
    const o = scr && scr.orientation;
    if (o && typeof o.type === 'string') return o.type.startsWith('landscape');
    return (win && win.innerWidth > win.innerHeight);
  }

  /** @param {number} v @param {number} lo @param {number} hi */
  function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /**
   * @param {number} vw @param {number} vh
   * @param {number} [target] @param {number} [lo] @param {number} [hi]
   * @returns {number}
   */
  function computeScale(vw, vh, target, lo, hi) {
    const t = (typeof target === 'number' && target > 0) ? target : 600;
    const _lo = (typeof lo === 'number') ? lo : 0.7;
    const _hi = (typeof hi === 'number') ? hi : 1.5;
    return _clamp(Math.min(vw, vh) / t, _lo, _hi);
  }

  /**
   * @param {number} vw @param {number} vh @param {number} scale
   * @returns {{ W:number, H:number }}
   */
  function computeLogicalSize(vw, vh, scale) {
    const s = scale > 0 ? scale : 1;
    return { W: Math.round(vw / s), H: Math.round(vh / s) };
  }

  /**
   * @param {number} W @param {number} H @param {number} safeBottom
   * @returns {{ compact:boolean, hudH:number, hudTop:number, msgBase:number }}
   */
  function computeLayout(W, H, safeBottom) {
    const compact = H > W && W <= 600;
    const hudH = compact ? 58 : 40;
    const hudTop = H - hudH - safeBottom;
    const msgBase = hudTop - 12;
    return { compact, hudH, hudTop, msgBase };
  }

  /**
   * @param {(name:string) => string | number | null | undefined} getProp
   * @param {number} scale
   * @returns {{ top:number, right:number, bottom:number, left:number }}
   */
  function parseSafeAreaInsets(getProp, scale) {
    const s = scale > 0 ? scale : 1;
    /** @param {string} n */
    const read = (n) => {
      const raw = getProp(n);
      const num = parseFloat(/** @type {any} */ (raw));
      return Number.isFinite(num) ? num / s : 0;
    };
    return {
      top:    read('--sat'),
      right:  read('--sar'),
      bottom: read('--sab'),
      left:   read('--sal'),
    };
  }

  return { isLandscape, computeScale, computeLogicalSize, computeLayout, parseSafeAreaInsets };
}));
