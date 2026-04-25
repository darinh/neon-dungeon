// @ts-check
'use strict';
// engine/audio.js — Web Audio synth engine (context, busses, voices).
//
// Engine layer (🟦): no NEON DUNGEON nouns. Provides the lazy AudioContext,
// master/reverb/music busses, a cached noise buffer, and three voice helpers
// (osc / noise / wetDry) plus a stereo pan helper. All synth-DEFINING content
// (named SFX like "shoot", "death", "menuSelect", etc.) stays in the host as
// a content layer that calls into the engine.
//
// Surface (factory):
//   createEngine({ getSfxVolume, getMusicVolume, win })
//     → engine. `getSfxVolume`/`getMusicVolume` are zero-arg functions the
//     engine calls when first mounting the master / music bus to seed initial
//     gain values. `win` is optional (defaults to globalThis) and exists so
//     tests can inject a stub window with a faux AudioContext.
//
// Engine surface:
//   getCtx()                  → AudioContext (lazy, also mounts master+reverb+noiseBuf)
//   resume()                  → tries actx.resume(); swallows errors
//   isRunning()               → boolean
//   setSfxVolume(v)           → ramps master gain to 0.7*v over 20ms
//   setMusicVolume(v)         → ramps music bus gain to 0.20*v over 20ms
//   getMusicBus()             → { bus, ctx } — lazy-mounts a music compressor + bus
//   getNoiseBuffer()          → the cached white-noise AudioBuffer (or null
//                               before getCtx() has run)
//   panOut(target, pan, life) → routes signal through a StereoPannerNode and
//                               schedules disconnect; returns the connected node
//                               (or `target||master` if pan is too small)
//   osc(type, f1, f2, vol, start, dur, target?, opt?)
//                             → schedules an oscillator voice with optional
//                               filter + pan; auto-cleans on release
//   noise(vol, start, dur, filterFreq, target?, opt?)
//                             → schedules a noise burst from the cached buffer
//   wetDry(vol, wetAmt, lifetime)
//                             → returns a split gain that fans into dry +
//                               reverb-wet busses; auto-cleans after lifetime+2s
//
// Browser: attaches as `window.NEON.audio` with `{ createEngine }`.
// Node: module.exports = { createEngine } (for tests).
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const ns = /** @type {any} */ (r.NEON = r.NEON || {});
  ns.audio = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * @param {{
   *   getSfxVolume?: () => number,
   *   getMusicVolume?: () => number,
   *   win?: any,
   * }} [opts]
   */
  function createEngine(opts) {
    const o = opts || {};
    const getSfxVol = typeof o.getSfxVolume === 'function' ? o.getSfxVolume : () => 1;
    const getMusicVol = typeof o.getMusicVolume === 'function' ? o.getMusicVolume : () => 1;
    /** @type {any} */
    const win = o.win || (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {}));

    /** @type {any} */ let actx = null;
    /** @type {any} */ let master = null;
    /** @type {any} */ let compressor = null;
    /** @type {any} */ let reverbNode = null;
    /** @type {any} */ let reverbGain = null;
    /** @type {any} */ let noiseBuf = null;
    /** @type {any} */ let musicBus = null;

    function getCtx() {
      if (!actx) {
        const Ctor = win.AudioContext || win.webkitAudioContext;
        actx = new Ctor();
        // Master bus: compressor → destination
        compressor = actx.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.ratio.value = 4;
        compressor.connect(actx.destination);
        master = actx.createGain();
        master.gain.value = 0.7 * getSfxVol();
        master.connect(compressor);
        // Reverb bus: ConvolverNode with procedural impulse response
        reverbNode = actx.createConvolver();
        const irLen = actx.sampleRate * 1.6;
        const irBuf = actx.createBuffer(2, irLen, actx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const d = irBuf.getChannelData(ch);
          for (let i = 0; i < irLen; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
          }
        }
        reverbNode.buffer = irBuf;
        reverbGain = actx.createGain();
        reverbGain.gain.value = 0.35;
        reverbNode.connect(reverbGain);
        reverbGain.connect(master);
        // Cached noise buffer (2 seconds, reused by all noise calls)
        const nLen = actx.sampleRate * 2;
        noiseBuf = actx.createBuffer(1, nLen, actx.sampleRate);
        const nd = noiseBuf.getChannelData(0);
        for (let i = 0; i < nLen; i++) nd[i] = Math.random() * 2 - 1;
      }
      return actx;
    }

    function resume() {
      const c = getCtx();
      if (c.state !== 'running') {
        try { c.resume().catch(() => {}); } catch (_) {}
      }
    }

    function isRunning() { return !!(actx && actx.state === 'running'); }

    /** @param {number} v */
    function setSfxVolume(v) {
      if (master) {
        const t = actx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.linearRampToValueAtTime(0.7 * v, t + 0.02);
      }
    }

    /** @param {number} v */
    function setMusicVolume(v) {
      if (musicBus) {
        const t = actx.currentTime;
        musicBus.gain.cancelScheduledValues(t);
        musicBus.gain.linearRampToValueAtTime(0.20 * v, t + 0.02);
      }
    }

    function getMusicBus() {
      const c = getCtx();
      if (!musicBus) {
        const mc = c.createDynamicsCompressor();
        mc.threshold.value = -18; mc.ratio.value = 2; mc.attack.value = 0.05;
        mc.connect(c.destination);
        musicBus = c.createGain();
        musicBus.gain.value = 0.20 * getMusicVol();
        musicBus.connect(mc);
      }
      return { bus: musicBus, ctx: c };
    }

    function getNoiseBuffer() { return noiseBuf; }

    /** @param {number} v @param {number} lo @param {number} hi */
    function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    /** @param {any} target @param {number} pan @param {number} lifetime */
    function panOut(target, pan, lifetime) {
      const c = getCtx();
      const out = target || master;
      if (!c.createStereoPanner || Math.abs(pan || 0) < 0.01) return out;
      const p = c.createStereoPanner();
      p.pan.value = _clamp(pan, -1, 1);
      p.connect(out);
      setTimeout(() => { try { p.disconnect(); } catch (_e) {} }, Math.max(80, (lifetime || 0.2) * 1000));
      return p;
    }

    // Core voice: oscillator → gain/filter → optional pan → target node
    /** @param {OscillatorType} type @param {number} freq1 @param {number} freq2 @param {number} vol @param {number} start @param {number} dur @param {any} [target] @param {any} [opt] */
    function osc(type, freq1, freq2, vol, start, dur, target, opt) {
      const c = getCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      const opts = opt || {};
      const attack = opts.attack == null ? 0.002 : opts.attack;
      const releaseAt = start + (opts.release == null ? dur : opts.release);
      o.type = type;
      if (opts.detune) o.detune.value = opts.detune;
      o.frequency.setValueAtTime(Math.max(1, freq1), start);
      if (freq2 !== freq1) o.frequency.exponentialRampToValueAtTime(Math.max(freq2, 1), start + dur);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(Math.max(0.001, vol), start + attack);
      g.gain.exponentialRampToValueAtTime(0.001, releaseAt);

      let tail = g;
      if (opts.filterType) {
        const flt = c.createBiquadFilter();
        flt.type = opts.filterType;
        const ff = Math.max(40, opts.filterFreq || Math.max(freq1, freq2, 300));
        flt.frequency.setValueAtTime(ff, start);
        if (opts.filterFreq2 && opts.filterFreq2 !== ff) flt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.filterFreq2), start + dur);
        if (opts.q != null) flt.Q.value = opts.q;
        g.connect(flt);
        tail = flt;
      }
      o.connect(g);
      tail.connect(panOut(target || master, opts.pan || 0, dur + 0.35));
      o.start(start);
      o.stop(releaseAt + 0.04);
    }

    // Noise burst from cached buffer
    /** @param {number} vol @param {number} start @param {number} dur @param {number} filterFreq @param {any} [target] @param {any} [opt] */
    function noise(vol, start, dur, filterFreq, target, opt) {
      const c = getCtx();
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      const flt = c.createBiquadFilter();
      const opts = opt || {};
      flt.type = opts.filterType || 'lowpass';
      const ff = Math.max(40, filterFreq || 800);
      flt.frequency.setValueAtTime(ff, start);
      if (opts.filterFreq2 && opts.filterFreq2 !== ff) flt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.filterFreq2), start + dur);
      if (opts.q != null) flt.Q.value = opts.q;
      const g = c.createGain();
      const attack = opts.attack == null ? 0.001 : opts.attack;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(Math.max(0.001, vol), start + attack);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      src.connect(flt); flt.connect(g); g.connect(panOut(target || master, opts.pan || 0, dur + 0.35));
      src.start(start); src.stop(start + dur + 0.03);
    }

    // Reverb send helper — routes signal to both dry and wet busses
    // lifetime: seconds until all voices through this bus have finished (excludes reverb tail)
    /** @param {number} vol @param {number} wetAmt @param {number} lifetime */
    function wetDry(vol, wetAmt, lifetime) {
      const c = getCtx();
      const split = c.createGain();
      split.gain.value = vol;
      const dry = c.createGain();
      dry.gain.value = 1;
      const wet = c.createGain();
      wet.gain.value = wetAmt;
      split.connect(dry); dry.connect(master);
      split.connect(wet); wet.connect(reverbNode);
      const cleanup = () => { split.disconnect(); dry.disconnect(); wet.disconnect(); };
      setTimeout(cleanup, (lifetime + 2.0) * 1000);
      return split;
    }

    return {
      getCtx, resume, isRunning,
      setSfxVolume, setMusicVolume, getMusicBus, getNoiseBuffer,
      panOut, osc, noise, wetDry,
    };
  }

  return { createEngine };
}));
