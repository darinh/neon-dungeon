// @ts-check
'use strict';
// preventDefault stops browser defaults (space-scroll, arrow-scroll, slash-quickfind).
// justPressed records only the first keydown of a hold; browser key-repeat is suppressed.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const ns = /** @type {any} */ (r.NEON = r.NEON || {});
  ns.input = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * @param {{
   *   win?: any,
   *   onKeyDown?: (e:any) => void,
   *   onKeyUp?: (e:any) => void,
   * }} [opts]
   */
  function createEngine(opts) {
    const o = opts || {};
    /** @type {any} */
    const win = o.win || (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));
    const onKeyDown = typeof o.onKeyDown === 'function' ? o.onKeyDown : null;
    const onKeyUp = typeof o.onKeyUp === 'function' ? o.onKeyUp : null;

    /** @type {Set<string>} */
    const keys = new Set();
    /** @type {Set<string>} */
    const justPressed = new Set();
    /** @type {Set<string>} */
    const justReleased = new Set();

    let attached = false;

    /** @param {any} e */
    function _handleKeyDown(e) {
      if (!keys.has(e.code)) justPressed.add(e.code);
      keys.add(e.code);
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (onKeyDown) onKeyDown(e);
    }

    /** @param {any} e */
    function _handleKeyUp(e) {
      keys.delete(e.code);
      justReleased.add(e.code);
      if (onKeyUp) onKeyUp(e);
    }

    function attach() {
      if (attached) return;
      attached = true;
      win.addEventListener('keydown', _handleKeyDown);
      win.addEventListener('keyup', _handleKeyUp);
    }

    function detach() {
      if (!attached) return;
      attached = false;
      win.removeEventListener('keydown', _handleKeyDown);
      win.removeEventListener('keyup', _handleKeyUp);
      // Clear all state on detach. Without this, any key held at detach time
      // never sees its keyup (the listener is gone), so re-attach inherits
      // a permanently-"held" phantom key. Hosts that detach on blur/pause
      // and reattach on focus rely on this.
      keys.clear();
      justPressed.clear();
      justReleased.clear();
    }

    /** @param {string} code */
    function jp(code) { return justPressed.has(code); }

    function clearJust() {
      justPressed.clear();
      justReleased.clear();
    }

    return {
      keys,
      justPressed,
      justReleased,
      jp,
      clearJust,
      attach,
      detach,
    };
  }

  return { createEngine };
}));
