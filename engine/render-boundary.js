// @ts-check
// engine/render-boundary.js — render error boundary (post-v116 hardening)
//
// The main loop in src/game.js wraps update() and render() in try/finally
// (no catch), so any uncaught exception in those phases aborts the frame
// mid-draw but the loop reschedules. Symptom: input keeps working (player
// moves, audio sustains) while the world vanishes and the user has no idea
// the game has crashed. v116 fixed one such bug (undefined TS in
// renderPlaying); this module ensures the next one surfaces visibly instead
// of silently bricking the frame.
//
// Two pure helpers:
//   trackRenderError(prev, phase, err)     -> new error-state record
//   drawErrorOverlay(ctx, W, H, errorState) -> draws a fallback overlay
//
// UMD-lite so Node tests can exercise trackRenderError without a canvas.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).renderBoundary = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  // Build a fresh error-state record or bump the count if the same error is
  // firing every frame. Identity = message only (phase-agnostic) so the same
  // ReferenceError firing in alternating update/render frames still throttles
  // correctly. The latest phase is preserved on the record for display.
  /**
   * @param {any} prev
   * @param {string} phase
   * @param {any} err
   */
  function trackRenderError(prev, phase, err) {
    const message = (err && err.message) ? String(err.message) : String(err);
    const stack = (err && err.stack) ? String(err.stack) : '';
    if (prev && prev.message === message) {
      return {
        phase: phase, // surface the most recent phase
        message: prev.message,
        stack: prev.stack,
        count: prev.count + 1,
        firstTs: prev.firstTs,
      };
    }
    return {
      phase: phase,
      message: message,
      stack: stack,
      count: 1,
      firstTs: Date.now(),
    };
  }

  // Should we log this occurrence to console? First time always, then every
  // 60th to avoid spamming devtools when the error fires every frame.
  /** @param {any} state */
  function shouldLog(state) {
    return state.count === 1 || (state.count % 60) === 0;
  }

  // Draw a high-contrast, dependency-free overlay. Uses only raw ctx
  // primitives so it can render even when game state is corrupt. Wrapped in
  // try/catch by the caller; if even this throws there's nothing we can do.
  /**
   * @param {any} ctx
   * @param {number} W
   * @param {number} H
   * @param {any} state
   */
  function drawErrorOverlay(ctx, W, H, state) {
    if (!ctx || !state) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#ff3377';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('\u26A0  RENDER ERROR', W / 2, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    const headline = (state.phase + '(): ' + state.message).slice(0, 120);
    ctx.fillText(headline, W / 2, 105);

    ctx.fillStyle = '#9aa';
    ctx.font = '11px monospace';
    const stackLines = (state.stack || '')
      .split('\n')
      .map(function (/** @type {string} */ s) { return s.trim(); })
      .filter(function (/** @type {string} */ s) { return s.length > 0 && s !== state.message; })
      .slice(0, 8);
    let y = 135;
    for (let i = 0; i < stackLines.length; i++) {
      ctx.fillText(stackLines[i].slice(0, 110), W / 2, y);
      y += 14;
    }

    ctx.fillStyle = '#ffaa44';
    ctx.font = '12px monospace';
    ctx.fillText(
      'occurred ' + state.count + '\u00D7  \u2014  reload page (F5) to recover',
      W / 2,
      y + 18
    );

    ctx.restore();
  }

  return {
    trackRenderError: trackRenderError,
    shouldLog: shouldLog,
    drawErrorOverlay: drawErrorOverlay,
  };
}));
