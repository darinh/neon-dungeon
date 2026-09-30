// @ts-check
'use strict';
// No tile types or palette here — the host owns colour. The host caches the
// offscreen canvas per floor (loadFloor drops it) and recreates it when its size changes; fitExpandedMinimap
// returns a fresh layout on expanded-map frames. sx/sy are pixels per cell, not cells per pixel.

(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const ns = /** @type {any} */ (r.NEON = r.NEON || {});
  ns.minimap = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * Returns null without a DOM; non-browser callers must handle it, while the browser runtime assumes document exists.
   *
   * @param {number} width
   * @param {number} height
   * @returns {HTMLCanvasElement | null}
   */
  function createOffscreenMinimap(width, height) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }

  /**
   * @param {number} viewportW   live canvas width
   * @param {number} viewportH   live canvas height
   * @param {number} mapW        cells across (e.g. MAP_W)
   * @param {number} mapH        cells down (e.g. MAP_H)
   * @param {{left:number, right:number, top:number, bottom:number}} safeInsets
   * @param {number} pad         outer padding in pixels (e.g. 20)
   * @returns {{mw:number, mh:number, mx:number, my:number, sx:number, sy:number}}
   */
  function fitExpandedMinimap(viewportW, viewportH, mapW, mapH, safeInsets, pad) {
    const ratio = mapW / mapH;
    const maxW = (viewportW - 2 * pad - safeInsets.left - safeInsets.right) * 0.85;
    const maxH = (viewportH - 2 * pad - safeInsets.top - safeInsets.bottom) * 0.85;
    let mw, mh;
    if (maxW / ratio <= maxH) { mw = maxW; mh = maxW / ratio; }
    else { mh = maxH; mw = maxH * ratio; }
    mw = Math.round(mw); mh = Math.round(mh);
    const mx = Math.round((viewportW - mw) / 2);
    const my = Math.round((viewportH - mh) / 2);
    const sx = mw / mapW;
    const sy = mh / mapH;
    return { mw, mh, mx, my, sx, sy };
  }

  /**
   * fillInner false fills into the border zone (corner HUD backing).
   * fillInner true leaves the border zone transparent so the expanded
   * backdrop shows between the stroke and the map fill.
   *
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {number} mx
   * @param {number} my
   * @param {number} mw
   * @param {number} mh
   * @param {{borderColor?:string, borderWidth?:number, borderInset?:number, backgroundColor?:string, fillInner?:boolean}} [opts]
   */
  function drawMinimapFrame(ctx, mx, my, mw, mh, opts) {
    const o = opts || {};
    const borderColor = o.borderColor || '#2d2d5e';
    const borderWidth = o.borderWidth != null ? o.borderWidth : 1;
    const borderInset = o.borderInset != null ? o.borderInset : 2;
    const backgroundColor = o.backgroundColor || 'rgba(0,0,0,0.75)';
    const fillInner = !!o.fillInner;

    if (fillInner) {
      // Border zone stays unfilled so the backdrop shows through.
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(mx - borderInset, my - borderInset, mw + borderInset * 2, mh + borderInset * 2);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(mx, my, mw, mh);
    } else {
      // Fill extends into the border zone so the corner backing matches the HUD.
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(mx - borderInset, my - borderInset, mw + borderInset * 2, mh + borderInset * 2);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(mx - borderInset, my - borderInset, mw + borderInset * 2, mh + borderInset * 2);
    }
  }

  return {
    createOffscreenMinimap,
    fitExpandedMinimap,
    drawMinimapFrame,
  };
}));
