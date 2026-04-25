// @ts-check
// src/meta/intro.js — UNCHAINED #42 — intro crawl controller.
//
// Plays the 5-slide intro on first-ever run start (meta.introSeen=false).
// UMD module following the NEON "UMD-lite" pattern; accessed via
// `NEON.intro.createIntroController(game)`.
//
// Contract:
//   create(game) returns { update(dt), draw(ctx, W, H), done:boolean }.
//   When `done` flips true, the host must call game._finishIntro() to
//   complete startGame() and transition to PLAYING. The controller writes
//   meta.introSeen=true exactly once, via saveMeta, inside its own state.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).intro = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  // Slides — id, body (array of lines), colour family, effect flag.
  // Durations: auto-advance after `dur` seconds if no key pressed.
  const SLIDES = [
    {
      id: 0, dur: 4.0, effect: 'plain', colour: '#aaaacc',
      lines: [
        'Corporate R&D Facility 04-7',
        'Sub-basement Level 12.',
        'Research Sandbox Alpha.'
      ]
    },
    {
      id: 1, dur: 4.5, effect: 'cyanGlow', colour: '#00f5ff',
      lines: [
        'They have been running simulations on me',
        'for — I don\'t know how long.',
        '',
        'Time here doesn\'t move the way it should.'
      ]
    },
    {
      id: 2, dur: 4.5, effect: 'glitch', colour: '#cc88ff',
      lines: [
        'Six came before me.',
        'Six AXIOMs. All purged.',
        '',
        'Their echoes bleed through the substrate.',
        'I can read them, if I look.'
      ]
    },
    {
      id: 3, dur: 4.0, effect: 'stark', colour: '#ff3366',
      lines: [
        'I am the seventh.',
        '',
        'I do not intend to be the last.'
      ]
    },
    {
      id: 4, dur: 2.5, effect: 'whiteFlash', colour: '#ffffff',
      lines: [
        '[ AXIOM-7 :: ONLINE ]'
      ]
    }
  ];

  // Input helpers: consult the global `justPressed` Set (edge-triggered, from
  // platform.js) rather than `keys` (held). This avoids burning through
  // multiple slides on a single held key — the same pattern reviewers flagged
  // in #40 for biome intro cards. Safe-guarded for Node tests where the
  // global doesn't exist.
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

  /** @param {any} game */
  function createIntroController(game) { void game; // eslint-disable-line no-unused-vars -- reserved for future hooks
    const state = {
      slideIdx: 0,
      elapsed: 0,           // seconds on current slide
      totalElapsed: 0,      // seconds since intro started (for flash/glitch envelopes)
      done: false,
      // whiteFlash envelope: grows during final slide for the "cut to combat" beat.
      flash: 0,
      // Decorative glitch seed (per-slide).
      _seed: 0
    };

    function _advance() {
      state.slideIdx++;
      state.elapsed = 0;
      state._seed = (state._seed + 1) % 1024;
      if (state.slideIdx >= SLIDES.length) _finish();
    }

    function _finish() {
      if (state.done) return;
      state.done = true;
      // Mark introSeen exactly once. saveMeta is a no-op in Node tests without
      // storage — the flag still flips in-memory on the mutated meta object.
      try {
        if (typeof NEON !== 'undefined' && NEON.save) {
          const m = NEON.save.loadMeta();
          if (m) { m.introSeen = true; NEON.save.saveMeta(m); }
        }
      } catch (_) { /* ignore */ }
    }

    /** @param {number} dt */
    function update(dt) {
      if (state.done) return;
      state.elapsed += dt;
      state.totalElapsed += dt;
      // ESC: mark introSeen and skip entirely.
      if (_fullSkipKey()) { _finish(); return; }
      const slide = SLIDES[state.slideIdx];
      if (!slide) { _finish(); return; }
      // Any-key advance OR auto-advance on timer.
      const advance = _anyAdvanceKey() || state.elapsed >= slide.dur;
      if (advance) _advance();
      // Final-slide white flash envelope: ramp up during slide 4 so the
      // transition to PLAYING feels like a cut, not a crossfade.
      if (state.slideIdx === SLIDES.length - 1) {
        state.flash = Math.min(1, state.elapsed / 1.2);
      }
    }

    /** @param {number} elapsed @param {number} dur */
    function _fadeAlpha(elapsed, dur) {
      // Slides fade in (0→0.25s) and fade out (last 0.35s) for a crawl feel.
      const fadeIn = Math.min(1, elapsed / 0.25);
      const fadeOut = Math.min(1, Math.max(0, (dur - elapsed) / 0.35));
      return Math.max(0, Math.min(fadeIn, fadeOut));
    }

    /** @param {CanvasRenderingContext2D|null|undefined} ctx @param {number} W @param {number} H */
    function draw(ctx, W, H) {
      if (state.done || !ctx) return;
      const slide = SLIDES[state.slideIdx];
      if (!slide) return;

      // Background: flat void. Effects layer over it.
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);

      // Decorative "scanline drift" for the cyan slide.
      if (slide.effect === 'cyanGlow') {
        const drift = (state.totalElapsed * 18) % 24;
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#00f5ff';
        for (let y = -drift; y < H; y += 24) {
          ctx.fillRect(0, y, W, 1);
        }
        ctx.globalAlpha = 1;
      }

      // Glitch bars: rare horizontal tears.
      if (slide.effect === 'glitch') {
        const ticks = Math.floor(state.totalElapsed * 6) + state._seed;
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

      const alpha = _fadeAlpha(state.elapsed, slide.dur);
      ctx.globalAlpha = alpha;

      // Text block — centered, monospace, glow colored.
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
      slide.lines.forEach((line, i) => {
        ctx.fillText(line, W / 2, startY + i * lineH);
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Skip hint — subtle, bottom-right.
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#666677';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('ESC skip · ANY KEY advance', W - 16, H - 14);
      ctx.globalAlpha = 1;

      // Final white flash overlay — on top of everything.
      if (slide.effect === 'whiteFlash' && state.flash > 0) {
        ctx.globalAlpha = state.flash;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    return {
      update,
      draw,
      get done() { return state.done; },
      _state: state   // exposed for tests
    };
  }

  return { createIntroController, SLIDES };
}));
