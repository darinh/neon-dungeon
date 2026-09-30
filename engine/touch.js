// @ts-check
'use strict';
// toCanvas maps CSS client px to canvas buffer px. hitBtn's 22/scale floor
// is a 44 CSS-px touch target; scale is CSS px per logical px.

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
