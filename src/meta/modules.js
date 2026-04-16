// src/meta/modules.js — PLACEHOLDER (UNCHAINED epic issue #6 lands here)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.NEON = root.NEON || {}).modules = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {};
}));
