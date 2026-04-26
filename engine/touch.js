// @ts-check
'use strict';
// engine/touch.js — pure touch input math helpers.
//
// Engine layer (🟦): no NEON DUNGEON nouns. All exports are pure functions
// over numbers / DOM-ish inputs the caller supplies. This module owns no
// mutable state — the host (src/platform.js) keeps the canvas reference,
// gameScale, the touch/mouse state objects, and uses these helpers.
//
// Surface:
//   toCanvas(clientX, clientY, canvas)
//     → [cx, cy]. Maps a CSS-pixel client coordinate (e.g. from a Touch
//     or MouseEvent) to canvas-internal coordinates using the canvas's
//     getBoundingClientRect(). `canvas` must expose width/height and
//     getBoundingClientRect().
//
//   hitBtn(cx, cy, btn, scale)
//     → boolean. Circular hit-test for a {x,y,r} button. Hit radius is
//     `max(btn.r, 22 / scale)` to enforce a minimum 44 CSS-px touch
//     target on small screens. `scale` is the host's gameScale (CSS px
//     per logical px); pass <=0 and it falls back to 1.
//
//   resetTouch(touch, mouse)
//     → void. Zeroes out the host's touch state object (joystick + aim
//     gestures, button-touch IDs) and clears mouse.down. The shapes
//     mutated are documented by the JSDoc typedefs below — anything
//     extra on the objects is left alone.
//
// Browser: attaches as `window.NEON.touch`. Pure helpers only — does NOT
// own state (unlike engine/input.js's createEngine factory).

/* eslint-disable no-undef -- UMD root resolution */
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const ns = /** @type {any} */ (r.NEON = r.NEON || {});
  ns.touch = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @param {{ width:number, height:number, getBoundingClientRect:() => { left:number, top:number, width:number, height:number } } | any} canvas
   * @returns {[number, number]}
   */
  function toCanvas(clientX, clientY, canvas) {
    const r = canvas.getBoundingClientRect();
    const rw = r.width  > 0 ? r.width  : 1;
    const rh = r.height > 0 ? r.height : 1;
    return [(clientX - r.left) * canvas.width  / rw,
            (clientY - r.top)  * canvas.height / rh];
  }

  /**
   * @param {number} cx
   * @param {number} cy
   * @param {{ x:number, y:number, r:number } | any} btn
   * @param {number} scale
   * @returns {boolean}
   */
  function hitBtn(cx, cy, btn, scale) {
    const s = scale > 0 ? scale : 1;
    const dx = cx - btn.x, dy = cy - btn.y;
    const hitR = Math.max(btn.r, 22 / s);
    return dx * dx + dy * dy <= hitR * hitR;
  }

  /**
   * @typedef {{
   *   joystick: { active:boolean, id:any, baseX:number, baseY:number, dx:number, dy:number },
   *   aim:      { active:boolean, id:any, baseX:number, baseY:number, dx:number, dy:number, shooting:boolean },
   *   btnE:any, btnV:any, btnF:any, btnDash:any, btnPause:any
   * }} TouchState
   *
   * @typedef {{ down:boolean }} MouseState
   *
   * @param {TouchState | any} touch
   * @param {MouseState | any} mouse
   */
  function resetTouch(touch, mouse) {
    if (touch) {
      if (touch.joystick) {
        touch.joystick.active = false;
        touch.joystick.id = null;
        touch.joystick.dx = 0;
        touch.joystick.dy = 0;
      }
      if (touch.aim) {
        touch.aim.active = false;
        touch.aim.id = null;
        touch.aim.dx = 0;
        touch.aim.dy = 0;
        touch.aim.shooting = false;
      }
      touch.btnE = null;
      touch.btnF = null;
      touch.btnV = null;
      touch.btnDash = null;
      touch.btnPause = null;
    }
    if (mouse) mouse.down = false;
  }

  return { toCanvas, hitBtn, resetTouch };
}));
