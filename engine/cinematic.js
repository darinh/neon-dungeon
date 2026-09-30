// @ts-check
'use strict';
// Engine layer: no game nouns. Rendering is entirely the drawSlide callback.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else (/** @type {any} */ (root.NEON = root.NEON || {})).cinematic = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * @param {{
   *   slides: Array<any>,
   *   onFinish?: () => void,
   *   isAdvanceKey?: () => boolean,
   *   isSkipKey?: () => boolean,
   *   drawSlide?: (ctx: any, payload: any) => void,
   *   fadeIn?: number,
   *   fadeOut?: number,
   *   flashSlideIndex?: number,
   *   flashRampSeconds?: number,
   * }} opts
   */
  function createCinematicController(opts) {
    const slides = (opts && Array.isArray(opts.slides)) ? opts.slides : [];
    const onFinish = (opts && typeof opts.onFinish === 'function') ? opts.onFinish : null;
    const isAdvanceKey = (opts && typeof opts.isAdvanceKey === 'function') ? opts.isAdvanceKey : null;
    const isSkipKey = (opts && typeof opts.isSkipKey === 'function') ? opts.isSkipKey : null;
    const drawSlide = (opts && typeof opts.drawSlide === 'function') ? opts.drawSlide : null;
    const fadeIn = (opts && typeof opts.fadeIn === 'number' && opts.fadeIn >= 0) ? opts.fadeIn : 0.25;
    const fadeOut = (opts && typeof opts.fadeOut === 'number' && opts.fadeOut >= 0) ? opts.fadeOut : 0.35;
    const flashRampSeconds = (opts && typeof opts.flashRampSeconds === 'number' && opts.flashRampSeconds > 0)
      ? opts.flashRampSeconds : 1.2;
    const flashSlideIndex = (opts && typeof opts.flashSlideIndex === 'number')
      ? opts.flashSlideIndex
      : Math.max(0, slides.length - 1);

    const state = {
      slideIdx: 0,
      elapsed: 0,         // seconds on current slide
      totalElapsed: 0,    // seconds since cinematic started
      done: false,
      flash: 0,
      _seed: 0,
    };

    function _finish() {
      if (state.done) return;
      state.done = true;
      if (onFinish) {
        try { onFinish(); } catch (_) { /* swallow — never let host throw kill the loop */ }
      }
    }

    function _advance() {
      state.slideIdx++;
      state.elapsed = 0;
      state._seed = (state._seed + 1) % 1024;
      if (state.slideIdx >= slides.length) _finish();
    }

    /** @param {number} dt */
    function update(dt) {
      if (state.done) return;
      const step = (typeof dt === 'number' && isFinite(dt) && dt > 0) ? dt : 0;
      state.elapsed += step;
      state.totalElapsed += step;
      if (isSkipKey && isSkipKey()) { _finish(); return; }
      const slide = slides[state.slideIdx];
      if (!slide) { _finish(); return; }
      // dur <= 0 advances on the first update. A non-numeric dur disables the timer and waits for input.
      const dur = (typeof slide.dur === 'number' && isFinite(slide.dur)) ? slide.dur : NaN;
      const timerAdvance = isFinite(dur) && state.elapsed >= dur;
      const advance = (isAdvanceKey && isAdvanceKey()) || timerAdvance;
      if (advance) _advance();
      if (state.slideIdx === flashSlideIndex && !state.done) {
        const ramp = flashRampSeconds > 0 ? flashRampSeconds : 1;
        state.flash = Math.min(1, state.elapsed / ramp);
      }
    }

    /** @param {number} elapsed @param {number} dur */
    function _fadeAlpha(elapsed, dur) {
      if (!(typeof dur === 'number' && isFinite(dur)) || dur <= 0) return 1;
      const _in = (fadeIn > 0) ? Math.min(1, elapsed / fadeIn) : 1;
      const _out = (fadeOut > 0) ? Math.min(1, Math.max(0, (dur - elapsed) / fadeOut)) : 1;
      return Math.max(0, Math.min(_in, _out));
    }

    /** @param {any} ctx @param {number} W @param {number} H */
    function draw(ctx, W, H) {
      if (state.done || !ctx || !drawSlide) return;
      const slide = slides[state.slideIdx];
      if (!slide) return;
      const dur = (typeof slide.dur === 'number' && isFinite(slide.dur)) ? slide.dur : NaN;
      const alpha = _fadeAlpha(state.elapsed, dur);
      // No try/catch here — render exceptions must propagate to the host's
      // render boundary (engine/render-boundary.js via game.render) so they
      // get logged/overlayed instead of silently swallowed.
      drawSlide(ctx, {
        slide,
        slideIdx: state.slideIdx,
        elapsed: state.elapsed,
        totalElapsed: state.totalElapsed,
        flash: state.flash,
        alpha,
        W,
        H,
        isFinalSlide: state.slideIdx === flashSlideIndex,
        _seed: state._seed,
      });
    }

    return {
      update,
      draw,
      get done() { return state.done; },
      _state: state,
    };
  }

  return { createCinematicController };
}));
