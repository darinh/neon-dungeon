// @ts-check
'use strict';

(function (root, factory) {
  const requireNEON = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = { requireNEON };
    return;
  }
  const r = /** @type {any} */ (root);
  const neon = /** @type {any} */ (r.NEON = r.NEON || {});
  neon.require = requireNEON;
  r.requireNEON = requireNEON;
}(/** @type {any} */ (typeof globalThis !== 'undefined'
  ? globalThis
  : (typeof self !== 'undefined' ? self : this)), /** @param {any} root */ function (root) {
  'use strict';

  /**
   * Resolve a required NEON module and fail with a named load-order error.
   * @param {string} name
   * @param {string} requiringFile
   * @returns {any}
   */
  function requireNEON(name, requiringFile) {
    const neon = /** @type {any} */ (root).NEON;
    const value = neon && neon[name];
    if (value == null) {
      throw new Error('Missing NEON dependency "' + name + '" required by ' + requiringFile);
    }
    return value;
  }

  return requireNEON;
}));
