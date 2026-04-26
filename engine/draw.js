// @ts-check
'use strict';
// engine/draw.js — pure 2D canvas drawing primitives.
//
// Engine layer (🟦): no NEON DUNGEON nouns. All exports are pure functions
// over numbers / strings / a CanvasRenderingContext2D-shaped object. No
// module state, no globals consulted, no allocations per call.
//
// Hot-path safe: every helper is allocation-free in the steady state. The
// host can call these from inside drawWorld per-tile loops without GC churn
// (per the `render hot path` memory). Helpers do mutate ctx state
// (fillStyle/strokeStyle/shadowBlur/shadowColor are NOT touched here — the
// caller sets those before invoking; only beginPath / arc / moveTo / lineTo
// / fill / stroke calls happen). The two exceptions, `setShadow` and
// `clearShadow`, exist precisely to make the shadow-state churn explicit.
//
// Surface:
//   circle(ctx, x, y, r)
//     → fills a closed circle at (x, y) radius r using current fillStyle.
//
//   circleStroke(ctx, x, y, r)
//     → strokes a closed circle at (x, y) radius r using current strokeStyle
//       and lineWidth.
//
//   arcStroke(ctx, x, y, r, a1, a2)
//     → strokes a partial arc from angle a1 to a2 (radians, like ctx.arc).
//
//   line(ctx, x1, y1, x2, y2)
//     → strokes a single line segment.
//
//   setShadow(ctx, color, blur)
//     → sets ctx.shadowColor + ctx.shadowBlur. Use to enable a neon-style
//       glow before a fill/stroke call.
//
//   clearShadow(ctx)
//     → ctx.shadowBlur = 0. Cheaper than setShadow for the common reset.
//
// Browser: attaches as `window.NEON.draw`. Pure helpers only — does NOT
// own state (mirrors engine/touch.js + engine/viewport.js pure-helpers UMD
// pattern, not the engine/input.js / engine/audio.js createEngine factory
// pattern).
//
// Node: module.exports = { circle, circleStroke, arcStroke, line,
//                          setShadow, clearShadow }.

/* eslint-disable no-undef -- UMD root resolution: `module` ref */
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
   * Fill a closed circle. Uses the ctx's current fillStyle.
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
   * Stroke a closed circle. Uses the ctx's current strokeStyle + lineWidth.
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
   * Stroke a partial arc from angle a1 to a2 (radians, see ctx.arc).
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
   * Stroke a single line segment.
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
   * Enable a neon-style glow. Caller is responsible for clearing it
   * afterward (typically with clearShadow) — leaving shadowBlur set is a
   * common cause of bleed onto unrelated draws.
   * @param {CanvasRenderingContext2D | any} ctx
   * @param {string} color
   * @param {number} blur
   */
  function setShadow(ctx, color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  /**
   * Reset shadow blur to 0. Does not touch shadowColor — callers who
   * setShadow again will overwrite it anyway.
   * @param {CanvasRenderingContext2D | any} ctx
   */
  function clearShadow(ctx) {
    ctx.shadowBlur = 0;
  }

  return { circle, circleStroke, arcStroke, line, setShadow, clearShadow };
}));
