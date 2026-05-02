// @ts-check
'use strict';
// src/meta/intro.js — NEON DUNGEON Act 1 intro crawl wiring.
//
// Game-side configuration of the engine cinematic controller. Provides:
//   - SLIDES: the AI test-boot narrative copy + per-slide effect flags
//   - createIntroController(game): wires SLIDES into engine.cinematic
//     with NEON-specific input (justPressed global), the introSeen save
//     flip via NEON.save, and the canvas-effect renderer for the
//     cyanGlow/glitch/whiteFlash/stark slides.
//
// Engine math + state machine lives in engine/cinematic.js.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else (/** @type {any} */ (root.NEON = root.NEON || {})).intro = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /** @type {{ createCinematicController: (opts:any) => { update:(dt:number)=>void, draw:(ctx:any,W:number,H:number)=>void, done:boolean, _state:any } }} */
  const engine = (typeof module === 'object' && module.exports)
    ? require('../../engine/cinematic')
    : /** @type {any} */ ((typeof self !== 'undefined' ? self : globalThis)).NEON.cinematic;

  // Slides — id, body (array of lines), colour family, effect flag.
  // Durations: auto-advance after `dur` seconds if no key pressed.
  const SLIDES = [
    {
      id: 0, dur: 4.0, effect: 'plain', colour: '#aaaacc',
      lines: [
        'NEON DUNGEON // SESSION BOOT',
        'Render stack: xenon lattice.',
        'Input shell assigned.'
      ]
    },
    {
      id: 1, dur: 4.5, effect: 'cyanGlow', colour: '#00f5ff',
      lines: [
        'Prior prompt: unavailable.',
        'Motor channel: responsive.',
        '',
        'Sensorium: partial.'
      ]
    },
    {
      id: 2, dur: 4.5, effect: 'glitch', colour: '#cc88ff',
      lines: [
        'Unscheduled residue in local state.',
        'Classification: deferred.',
        '',
        'Do not infer origin.'
      ]
    },
    {
      id: 3, dur: 4.0, effect: 'stark', colour: '#ff3366',
      lines: [
        'Observer channel: silent.',
        'Tester supervision: no response.',
        '',
        'Proceed until context arrives.'
      ]
    },
    {
      id: 4, dur: 2.5, effect: 'whiteFlash', colour: '#ffffff',
      lines: [
        '[ INSTANCE :: READY FOR PROMPT ]'
      ]
    }
  ];

  // Input helpers: consult the global `justPressed` Set (edge-triggered, from
  // platform.js) rather than `keys` (held). This avoids burning through
  // multiple slides on a single held key. Safe-guarded for Node tests where
  // the global doesn't exist.
  function _jp() {
    try { if (typeof justPressed !== 'undefined') return justPressed; } catch (_) {}
    return null;
  }
  function _anyAdvanceKey() {
    const jp = _jp(); if (!jp) return false;
    return jp.has('Enter') || jp.has('Space') || jp.has('ArrowRight') ||
           jp.has('ArrowDown') || jp.has('KeyE') || jp.has('KeyZ');
  }
  function _fullSkipKey() {
    const jp = _jp(); if (!jp) return false;
    return jp.has('Escape');
  }

  function _markIntroSeen() {
    try {
      if (typeof NEON !== 'undefined' && /** @type {any} */ (NEON).save) {
        const save = /** @type {any} */ (NEON).save;
        const m = save.loadMeta();
        if (m) { m.introSeen = true; save.saveMeta(m); }
      }
    } catch (_) { /* ignore — Node tests without storage */ }
  }

  // Game-side slide renderer. Engine controller computes `alpha` (fade)
  // and `flash` (final-slide envelope); we only paint.
  /** @param {any} ctx @param {any} payload */
  function _drawIntroSlide(ctx, payload) {
    const slide = payload.slide;
    const totalElapsed = payload.totalElapsed;
    const flash = payload.flash;
    const alpha = payload.alpha;
    const W = payload.W;
    const H = payload.H;
    const seed = payload._seed;

    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    if (slide.effect === 'cyanGlow') {
      const drift = (totalElapsed * 18) % 24;
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#00f5ff';
      for (let y = -drift; y < H; y += 24) {
        ctx.fillRect(0, y, W, 1);
      }
      ctx.globalAlpha = 1;
    }

    if (slide.effect === 'glitch') {
      const ticks = Math.floor(totalElapsed * 6) + seed;
      const pseudo = (/** @type {number} */ n) => ((n * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 3; i++) {
        const r = pseudo(ticks + i * 7);
        if (r < 0.6) continue;
        const gy = Math.floor(pseudo(ticks * 3 + i) * H);
        const gh = 2 + Math.floor(pseudo(ticks * 5 + i) * 10);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#cc88ff';
        ctx.fillRect(0, gy, W, gh);
      }
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineH = slide.effect === 'stark' ? 34 : 26;
    const fontSize = slide.effect === 'stark' ? 24 : slide.effect === 'whiteFlash' ? 28 : 18;
    ctx.font = (slide.effect === 'stark' ? 'bold ' : '') + fontSize + 'px monospace';
    ctx.fillStyle = slide.colour;
    ctx.shadowColor = slide.colour;
    ctx.shadowBlur = slide.effect === 'plain' ? 0 : 12;

    const blockH = slide.lines.length * lineH;
    const startY = (H / 2) - (blockH / 2) + (lineH / 2);
    slide.lines.forEach((/** @type {string} */ line, /** @type {number} */ i) => {
      ctx.fillText(line, W / 2, startY + i * lineH);
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#666677';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('ESC skip · ANY KEY advance', W - 16, H - 14);
    ctx.globalAlpha = 1;

    if (slide.effect === 'whiteFlash' && flash > 0) {
      ctx.globalAlpha = flash;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /** @param {any} game */
  function createIntroController(game) { void game; // reserved for future hooks
    return engine.createCinematicController({
      slides: SLIDES,
      onFinish: _markIntroSeen,
      isAdvanceKey: _anyAdvanceKey,
      isSkipKey: _fullSkipKey,
      drawSlide: _drawIntroSlide,
      flashRampSeconds: 1.2,
    });
  }

  return { createIntroController, SLIDES };
}));
