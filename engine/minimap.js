// @ts-check
'use strict';
// engine/minimap.js — generic minimap canvas + layout helpers.
//
// Engine layer (🟦): no NEON DUNGEON nouns, no tile-type knowledge, no
// palette assumptions. The HOST (e.g. src/render.js) keeps all
// game-specific concerns (tile → colour mapping, ECHO_MAPPER perk,
// ARC modifier overlay, sealed-entrance tinting, player blip, etc.)
// and calls into THIS module only for the canvas plumbing + layout
// math that any minimap-having game needs.
//
// Per the engine-extraction plan in issue #87 sub-task C2d. This is
// the THIN extraction: only generic helpers are moved. The FULL
// extraction (palette adapter abstraction over tile-type → colour
// mapping) is deferred — the issue's stop criterion is "stop after C
// unless concrete second game in mind", and no second game is in mind.
//
// Surface:
//   createOffscreenMinimap(width, height)
//     → returns a fresh HTMLCanvasElement (via document.createElement)
//       sized to (width, height). Intended for cached/blitted minimap
//       layers — the host paints into this canvas once, then drawImage()s
//       it to the live ctx every frame, only repainting when a dirty
//       flag is set.
//
//   fitExpandedMinimap(viewportW, viewportH, mapW, mapH, safeInsets, pad)
//     → returns { mw, mh, mx, my, sx, sy } for the expanded full-screen
//       minimap layout. Fits the map's aspect ratio (mapW/mapH) into
//       the viewport less safe insets, capping at 85% of the inset
//       area. Caller passes safeInsets as { left, right, top, bottom }
//       so the engine doesn't need to know about the safe-area
//       singletons. Returns mw/mh as integer pixels (rounded), mx/my
//       as integer pixels (centered), sx/sy as float scale factors
//       (cells-per-pixel).
//
//   drawMinimapFrame(ctx, mx, my, mw, mh, opts)
//     → draws the 2-px border + background rect that surrounds a
//       minimap render area. opts = { borderColor, borderWidth,
//       borderInset, backgroundColor }. Defaults match the NEON
//       conventions but the host can override to fit its own palette.
//
// Hot-path safety: createOffscreenMinimap is a one-shot allocator
// (called only on first paint or when cached canvas is missing —
// gated by the host's dirty flag). fitExpandedMinimap allocates one
// small object per call; the expanded minimap is only rendered while
// the player holds the toggle key, not per-frame in steady-state
// gameplay. drawMinimapFrame is allocation-free.
//
// Mounted as `NEON.minimap.{createOffscreenMinimap, fitExpandedMinimap,
// drawMinimapFrame}` via the same UMD pattern as engine/draw.js.
// Node: module.exports = { ... } for unit tests.

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
   * Create a fresh offscreen canvas sized to (width, height). Intended
   * for cached minimap layers that the host paints into once and
   * blits each frame.
   *
   * In Node test environments without a DOM, returns null — callers
   * must check before using. (The minimap is a render-only feature so
   * the host's render path will never actually call this without a
   * real document.)
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
   * Compute the layout for an expanded full-screen minimap that fits
   * inside the viewport less safe insets, capping at 85% of the inset
   * area. Centers in the available space.
   *
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
   * Draw the border + background frame surrounding a minimap render
   * area. Two modes via `fillInner` opt:
   *
   *   - fillInner: false (default) — fills + strokes the SAME outer rect
   *     (mx-borderInset, my-borderInset, mw+2*borderInset, mh+2*borderInset).
   *     The fill extends INTO the border zone. Use for the corner
   *     minimap where the backing colour matches the player HUD.
   *
   *   - fillInner: true — strokes the OUTER rect (the visible border) but
   *     fills only the INNER rect (mx, my, mw, mh). The border zone shows
   *     whatever is behind it (typically a dim backdrop). Use for the
   *     expanded full-screen minimap where the backdrop and the map fill
   *     are different colours and the border should sit between them.
   *     This matches the pre-extraction inline behaviour at
   *     drawExpandedMinimap (per gpt-5.5 r1 visual-equivalence finding).
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
      // Stroke OUTER, fill INNER — matches pre-extraction expanded view.
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(mx - borderInset, my - borderInset, mw + borderInset * 2, mh + borderInset * 2);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(mx, my, mw, mh);
    } else {
      // Fill + stroke OUTER — matches pre-extraction corner minimap.
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
