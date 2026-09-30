// @ts-check
'use strict';
// Allocation-free so drawWorld per-tile loops can call these. They do not
// touch fillStyle or shadow; setShadow/clearShadow exist so glow state is
// explicit. Leaving shadowBlur set bleeds onto later draws.

(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const ns = /** @type {any} */ (r.NEON = r.NEON || {});
  ns.draw = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  // Module-local constant — avoids depending on any global TWO_PI definition
  // so this file is self-contained for Node tests.
  const TAU = Math.PI * 2;

  /**
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} r
   */
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /**
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} r
   */
  function circleStroke(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
  }

  /**
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} r
   * @param {number} a1
   * @param {number} a2
   */
  function arcStroke(ctx, x, y, r, a1, a2) {
    ctx.beginPath();
    ctx.arc(x, y, r, a1, a2);
    ctx.stroke();
  }

  /**
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   */
  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /**
   * Native ctx.roundRect, no polyfill. Canvas2D support is broad since 2023.
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r
   */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  /**
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r
   */
  function roundRectStroke(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  }

  /**
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r
   */
  function roundRectFillStroke(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  function rectFillStroke(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {string} color
   * @param {number} blur
   */
  function setShadow(ctx, color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  /**
   * @param {CanvasRenderingContext2D | any} ctx
   */
  function clearShadow(ctx) {
    ctx.shadowBlur = 0;
  }

  return {
    circle, circleStroke, arcStroke, line,
    roundRect, roundRectStroke, roundRectFillStroke,
    rectFillStroke,
    setShadow, clearShadow,
  };
}));
