// @ts-check
'use strict';
// parseSafeAreaInsets divides CSS px by scale to get logical px.
// W/H from computeLogicalSize are logical px before worldZoom; platform.js divides them by worldZoom before
// computeLayout, so compact (H > W && W <= 600) is judged on the zoomed size.
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
