// @ts-check
'use strict';

// Phase 3D batch 4: Proxy-based alias for the cross-file `game` global.
// content.js touches many runtime-added game props (game._minimapDirty,
// game.mapRevealed, etc.) that don't appear on the typed game shape declared
// in src/game.js. The proxy widens access to `any` and defers resolution.
// Mirrors the pattern in src/render.js (_RG) and src/platform.js (_G).
/** @type {any} */
const _CG = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});

// ─── Procedural Music ────────────────────────────────────────────────────────
const music = (() => {
  /** @type {any} */ let bus = null;
  /** @type {any} */ let ctx = null;
  let state = 'idle';
  let floor = 1;
  let nextStep = 0, step = 0;
  let paused = false;
  /** @type {any} */ let hatBuf = null;
  /** @type {any} */ let airBuf = null;
  let droneGen = 0;
  let motifCursor = 0;

  // Layer gain nodes
  /** @type {any} */ let droneG = null;
  /** @type {any} */ let pulseG = null;
  /** @type {any} */ let arpG = null;
  /** @type {any} */ let bassG = null;
  // Persistent drone synth parts
  /** @type {any} */ let droneOscA = null;
  /** @type {any} */ let droneOscB = null;
  /** @type {any} */ let droneSub = null;
  /** @type {any} */ let droneFilter = null;
  /** @type {any} */ let droneLFO = null;
  /** @type {any} */ let droneLfoDepth = null;

  /**
   * @param {any} n
   */
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  /**
   * @param {any} v
   * @param {any} lo
   * @param {any} hi
   */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  const TIERS = [
    { root: 36, bpm: 112, scale: [0, 2, 3, 5, 7, 8, 10] }, // C minor
    { root: 34, bpm: 120, scale: [0, 2, 3, 5, 7, 8, 10] }, // Bb minor
    { root: 32, bpm: 128, scale: [0, 2, 3, 5, 7, 8, 10] }, // Ab minor
    { root: 29, bpm: 136, scale: [0, 1, 3, 5, 7, 8, 10] }, // F phrygian tint
  ];

  /** @type {Record<string, any>} */

  const STATE_SPEED = { idle: 0.85, explore: 1.0, tension: 1.10, combat: 1.22, boss: 1.32 };
  /** @type {Record<string, any>} */
  const SWING = { idle: 0, explore: 0.02, tension: 0.04, combat: 0.06, boss: 0.08 };

  // Target gains per music state [drone, pulse, arp, bass]
  /** @type {Record<string, any>} */
  const TARGETS = {
    idle:    [0, 0, 0, 0],
    explore: [0.50, 0.50, 0.88, 0.55],
    tension: [0.45, 0.68, 0.75, 0.72],
    combat:  [0.38, 1.0, 0.82, 1.0],
    boss:    [0.55, 1.0, 0.72, 1.0],
  };

  /** @type {Record<string, any>} */

  const PROGRESSIONS = {
    idle:    [0, 5, 3, 4],
    explore: [0, 3, 5, 4],
    tension: [0, 2, 5, 4],
    combat:  [0, 6, 5, 3],
    boss:    [0, 6, 1, 5],
  };

  /** @type {Record<string, any>} */

  const RHYTHM = {
    explore: { kick: [0, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14], open: [15] },
    tension: { kick: [0, 6, 8, 11, 14], snare: [4, 12], hat: [2, 4, 6, 8, 10, 12, 14], open: [15] },
    combat:  { kick: [0, 3, 6, 8, 11, 14], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], open: [6, 14] },
    boss:    { kick: [0, 2, 5, 8, 10, 13], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], open: [7, 15] },
  };

  /** @type {Record<string, any>} */

  const MOTIFS = {
    explore: [
      [0, 2, 4, 5, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2, 0, null],
      [0, 4, 2, 5, 4, 2, 0, null, 2, 4, 5, 7, 5, 4, 2, 0],
      [0, 2, 4, 7, 5, 4, 2, 0, 2, 4, 5, 4, 2, 0, null, null],
    ],
    tension: [
      [0, 1, 3, 5, 4, 3, 1, 0, 2, 1, 0, 5, 4, 3, 1, null],
      [0, 3, 1, 4, 3, 1, 0, 2, 1, 3, 5, 4, 3, 1, 0, null],
    ],
    combat: [
      [0, 4, 2, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 0, 4, 2],
      [0, 2, 4, 6, 5, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2, 0],
    ],
    boss: [
      [0, 5, 4, 2, 0, 2, 4, 5, 6, 5, 4, 2, 0, 5, 4, 2],
      [0, 4, 5, 6, 5, 4, 2, 0, 2, 4, 5, 6, 7, 5, 4, 2],
    ],
  };

  /** @type {Record<string, any>} */

  const BASS_PATTERNS = {
    explore: [0, null, 0, null, 2, null, 2, null, 4, null, 4, null, 2, null, null, 0],
    tension: [0, null, 0, 1, 2, null, 1, null, 4, null, 2, 1, 0, null, null, null],
    combat:  [0, null, 0, 4, 2, null, 2, 1, 0, null, 0, 4, 2, null, 1, null],
    boss:    [0, null, 0, null, 5, null, 5, 4, 0, null, 0, null, 6, null, 6, 4],
  };

  /** @type {Record<string, any>} */

  const DRONE_TONE = {
    idle:    { cutoff: 150, q: 1.2, lfoRate: 0.08, lfoDepth: 40 },
    explore: { cutoff: 320, q: 2.0, lfoRate: 0.13, lfoDepth: 85 },
    tension: { cutoff: 380, q: 2.4, lfoRate: 0.16, lfoDepth: 100 },
    combat:  { cutoff: 480, q: 2.8, lfoRate: 0.20, lfoDepth: 120 },
    boss:    { cutoff: 600, q: 3.2, lfoRate: 0.24, lfoDepth: 140 },
  };

  function tier() { return floor <= 3 ? 0 : floor <= 6 ? 1 : floor <= 9 ? 2 : 3; }
  /** @returns {any} */
  function params() { return TIERS[tier()]; }

  function stepDur() {
    const baseQuarter = 60 / params().bpm;
    return (baseQuarter / (STATE_SPEED[state] || 1)) / 4; // 16th-note grid
  }

  /**
   * @param {any} deg
   */
  function degreeToSemi(deg) {
    const sc = params().scale;
    const idx = ((deg % 7) + 7) % 7;
    const oct = Math.floor(deg / 7);
    return sc[idx] + oct * 12;
  }

  /** @returns {any} */
  function progression() { return PROGRESSIONS[state] || PROGRESSIONS.explore; }

  /**
   * @param {any} stepIx
   */
  function chordDegree(stepIx) {
    const prog = progression();
    const bar = Math.floor(stepIx / 16);
    return prog[bar % prog.length];
  }

  /**
   * @param {any} deg
   * @param {any} oct
   */
  function noteFromDegree(deg, oct) {
    return midi(params().root + (oct || 0) * 12 + degreeToSemi(deg));
  }

  /**
   * @param {any} target
   * @param {any} pan
   * @param {any} lifetime
   */
  function withPan(target, pan, lifetime) {
    const out = target || bus;
    if (!ctx || !ctx.createStereoPanner || Math.abs(pan) < 0.01) return out;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    p.connect(out);
    setTimeout(() => { try { p.disconnect(); } catch (e) {} }, Math.max(100, (lifetime || 0.3) * 1000));
    return p;
  }

  /**
   * @param {any} dur
   */
  function rampGains(dur) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const tgt = TARGETS[state] || TARGETS.idle;
    const gains = [droneG, pulseG, arpG, bassG];
    for (let i = 0; i < gains.length; i++) {
      const g = gains[i];
      if (!g) continue;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(tgt[i], t + dur);
    }
  }

  function ensureInit() {
    if (bus) return;
    const ab = audio.getMusicBus();
    bus = ab.bus;
    ctx = ab.ctx;
    droneG = ctx.createGain(); droneG.gain.value = 0; droneG.connect(bus);
    pulseG = ctx.createGain(); pulseG.gain.value = 0; pulseG.connect(bus);
    arpG   = ctx.createGain(); arpG.gain.value = 0; arpG.connect(bus);
    bassG  = ctx.createGain(); bassG.gain.value = 0; bassG.connect(bus);

    const hLen = Math.ceil(ctx.sampleRate * 0.12);
    hatBuf = ctx.createBuffer(1, hLen, ctx.sampleRate);
    const hd = hatBuf.getChannelData(0);
    for (let i = 0; i < hLen; i++) hd[i] = Math.random() * 2 - 1;

    const aLen = Math.ceil(ctx.sampleRate * 0.8);
    airBuf = ctx.createBuffer(1, aLen, ctx.sampleRate);
    const ad = airBuf.getChannelData(0);
    for (let i = 0; i < aLen; i++) ad[i] = (Math.random() * 2 - 1) * (1 - i / aLen);
  }

  /**
   * @param {any} ramp
   */
  function updateDroneTone(ramp) {
    if (!ctx || !droneFilter) return;
    const t = ctx.currentTime;
    const tone = DRONE_TONE[state] || DRONE_TONE.explore;
    const rt = ramp || 0.8;
    droneFilter.frequency.cancelScheduledValues(t);
    droneFilter.frequency.setValueAtTime(Math.max(50, droneFilter.frequency.value), t);
    droneFilter.frequency.linearRampToValueAtTime(tone.cutoff, t + rt);
    droneFilter.Q.cancelScheduledValues(t);
    droneFilter.Q.setValueAtTime(droneFilter.Q.value || 1.5, t);
    droneFilter.Q.linearRampToValueAtTime(tone.q, t + rt);
    if (droneLFO) {
      droneLFO.frequency.cancelScheduledValues(t);
      droneLFO.frequency.setValueAtTime(droneLFO.frequency.value || tone.lfoRate, t);
      droneLFO.frequency.linearRampToValueAtTime(tone.lfoRate, t + rt);
    }
    if (droneLfoDepth) {
      droneLfoDepth.gain.cancelScheduledValues(t);
      droneLfoDepth.gain.setValueAtTime(droneLfoDepth.gain.value || tone.lfoDepth, t);
      droneLfoDepth.gain.linearRampToValueAtTime(tone.lfoDepth, t + rt);
    }
  }

  /**
   * @param {any} atTime
   * @param {any} stepIx
   */
  function retuneDrone(atTime, stepIx) {
    if (!ctx || !droneOscA) return;
    const t = atTime || ctx.currentTime;
    const root = noteFromDegree(chordDegree(stepIx == null ? step : stepIx), 0);
    droneOscA.frequency.exponentialRampToValueAtTime(root, t + 0.24);
    droneOscB.frequency.exponentialRampToValueAtTime(root * 1.006, t + 0.24);
    droneSub.frequency.exponentialRampToValueAtTime(root * 0.5, t + 0.24);
  }

  // ── Drone: dual saw + sub → lowpass with animated cutoff ──
  function startDrone() {
    if (!ctx || droneOscA) return;
    const t = ctx.currentTime;
    const root = noteFromDegree(chordDegree(step), 0);

    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 180;
    droneFilter.Q.value = 1.8;
    droneFilter.connect(droneG);

    droneOscA = ctx.createOscillator();
    droneOscA.type = 'sawtooth';
    droneOscA.frequency.value = root;
    droneOscA.connect(droneFilter);
    droneOscA.start(t);

    droneOscB = ctx.createOscillator();
    droneOscB.type = 'triangle';
    droneOscB.frequency.value = root * 1.006;
    droneOscB.connect(droneFilter);
    droneOscB.start(t);

    droneSub = ctx.createOscillator();
    droneSub.type = 'sine';
    droneSub.frequency.value = root * 0.5;
    droneSub.connect(droneFilter);
    droneSub.start(t);

    droneLFO = ctx.createOscillator();
    droneLFO.type = 'sine';
    droneLFO.frequency.value = 0.11;
    droneLfoDepth = ctx.createGain();
    droneLfoDepth.gain.value = 70;
    droneLFO.connect(droneLfoDepth);
    droneLfoDepth.connect(droneFilter.frequency);
    droneLFO.start(t);

    updateDroneTone(0.2);
  }

  function stopDrone() {
    const t = ctx ? ctx.currentTime : 0;
    [droneOscA, droneOscB, droneSub, droneLFO].forEach((o) => {
      if (o) { try { o.stop(t + 0.12); } catch (e) {} }
    });
    if (droneLfoDepth) droneLfoDepth.disconnect();
    if (droneFilter) droneFilter.disconnect();
    droneOscA = droneOscB = droneSub = droneFilter = droneLFO = droneLfoDepth = null;
  }

  // ── Pulse layer: kick/snare/hat with state-specific patterns ──
  /**
   * @param {any} t
   * @param {any} weight
   */
  function kick(t, weight) {
    const w = weight || 1;
    const body = ctx.createOscillator();
    const bodyG = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(130, t);
    body.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    bodyG.gain.setValueAtTime(0.001, t);
    bodyG.gain.linearRampToValueAtTime(0.75 * w, t + 0.005);
    bodyG.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    body.connect(bodyG); bodyG.connect(pulseG);
    body.start(t); body.stop(t + 0.22);

    const click = ctx.createOscillator();
    const clickG = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(220, t);
    click.frequency.exponentialRampToValueAtTime(80, t + 0.04);
    clickG.gain.setValueAtTime(0.2 * w, t);
    clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    click.connect(clickG); clickG.connect(pulseG);
    click.start(t); click.stop(t + 0.07);
  }

  /**
   * @param {any} t
   * @param {any} weight
   */
  function snare(t, weight) {
    const w = weight || 1;
    const src = ctx.createBufferSource();
    src.buffer = hatBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32 * w, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(pulseG);
    src.start(t); src.stop(t + 0.14);

    const body = ctx.createOscillator();
    const bodyG = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(220, t);
    body.frequency.exponentialRampToValueAtTime(120, t + 0.09);
    bodyG.gain.setValueAtTime(0.13 * w, t);
    bodyG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    body.connect(bodyG); bodyG.connect(pulseG);
    body.start(t); body.stop(t + 0.11);
  }

  /**
   * @param {any} t
   * @param {any} open
   * @param {any} pan
   */
  function hat(t, open, pan) {
    const src = ctx.createBufferSource();
    src.buffer = hatBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = open ? 7000 : 9000;
    const g = ctx.createGain();
    const d = open ? 0.1 : 0.045;
    g.gain.setValueAtTime(open ? 0.22 : 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    src.connect(hp); hp.connect(g); g.connect(withPan(pulseG, pan || 0, d + 0.2));
    src.start(t); src.stop(t + d + 0.02);
  }

  /**
   * @param {any} t
   */
  function schedPulse(t) {
    const pat = RHYTHM[state] || RHYTHM.explore;
    const s = step % 16;
    if (pat.kick.includes(s)) kick(t, s === 0 ? 1.15 : 1);
    if (pat.snare.includes(s)) snare(t, state === 'boss' ? 1.1 : 1);
    if (pat.hat.includes(s)) hat(t, false, (s % 8 < 4 ? -0.22 : 0.22));
    if (pat.open.includes(s)) hat(t, true, (s % 2 ? -0.3 : 0.3));
  }

  // ── Arp/motif layer: recurring phrase fragments tied to progression ──
  /**
   * @param {any} t
   */
  function schedArp(t) {
    const bank = MOTIFS[state] || MOTIFS.explore;
    if (!bank || !bank.length) return;
    if (step % 16 === 0) motifCursor = (motifCursor + 1 + (Math.random() < 0.26 ? 1 : 0)) % bank.length;
    const motif = bank[motifCursor];
    const token = motif[step % motif.length];
    if (token == null) return;

    const chord = chordDegree(step);
    const f = noteFromDegree(chord + token, state === 'boss' ? 2 : 1);
    const dur = stepDur() * (state === 'boss' ? 1.75 : 1.95);
    const accent = (step % 4 === 0) ? 1.12 : 1;
    const pan = (step % 8 < 4 ? -0.24 : 0.24);
    const target = withPan(arpG, pan, dur + 0.3);

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = f;
    osc2.type = 'triangle';
    osc2.frequency.value = f * 1.002;
    filt.type = 'lowpass';
    filt.frequency.value = state === 'combat' || state === 'boss' ? 4200 : 3400;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.40 * accent, t + 0.006);
    g.gain.setValueAtTime(0.40 * accent, t + dur * 0.48);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filt); osc2.connect(filt); filt.connect(g); g.connect(target);
    osc.start(t); osc2.start(t);
    osc.stop(t + dur + 0.02); osc2.stop(t + dur + 0.02);
  }

  // ── Bass layer: progression-following low pulses with passing tones ──
  /**
   * @param {any} t
   */
  function schedBass(t) {
    const pat = BASS_PATTERNS[state] || BASS_PATTERNS.explore;
    const rel = pat[step % 16];
    if (rel == null) return;
    const chord = chordDegree(step);
    const freq = noteFromDegree(chord + rel, 0);
    const dur = stepDur() * 3.3;

    const body = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    body.type = 'sawtooth';
    sub.type = 'sine';
    body.frequency.setValueAtTime(freq, t);
    body.frequency.exponentialRampToValueAtTime(freq * 0.96, t + dur);
    sub.frequency.setValueAtTime(freq * 0.5, t);
    sub.frequency.exponentialRampToValueAtTime(freq * 0.48, t + dur);
    filt.type = 'lowpass';
    filt.frequency.value = state === 'boss' ? 360 : 280;
    g.gain.setValueAtTime(0.48, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    body.connect(filt); sub.connect(filt); filt.connect(g); g.connect(bassG);
    body.start(t); sub.start(t);
    body.stop(t + dur + 0.02); sub.stop(t + dur + 0.02);
  }

  // Occasional filtered noise swell for timbral depth
  /**
   * @param {any} t
   */
  function schedAir(t) {
    if (state === 'combat' || state === 'idle') return;
    if (step % 8 !== 0 || Math.random() > (state === 'boss' ? 0.7 : 0.45)) return;
    const src = ctx.createBufferSource();
    src.buffer = airBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(state === 'boss' ? 1200 : 850, t);
    bp.frequency.exponentialRampToValueAtTime(state === 'boss' ? 2400 : 1600, t + 0.42);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    src.connect(bp); bp.connect(g); g.connect(withPan(droneG, Math.random() * 0.4 - 0.2, 0.8));
    src.start(t); src.stop(t + 0.58);
  }

  /**
   * @param {any} t
   */
  function schedChordLift(t) {
    if (step % 16 !== 0) return;
    const chord = chordDegree(step);
    const tones = [0, 2, 4];
    const dur = stepDur() * 15.5;
    tones.forEach((d, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = noteFromDegree(chord + d, 1);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.08 + i * 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(withPan(droneG, (i - 1) * 0.2, dur + 0.2));
      o.start(t); o.stop(t + dur + 0.04);
    });
  }

  return {
    /**
     * @param {any} s
     */
    setState(s) {
      const next = TARGETS[s] ? s : 'idle';
      if (next === state) return;
      ensureInit();
      const prev = state;
      state = next;
      if (state === 'idle') {
        rampGains(1.2);
        const gen = ++droneGen;
        setTimeout(() => { if (state === 'idle' && droneGen === gen) stopDrone(); }, 1800);
      } else {
        if (!droneOscA) startDrone();
        updateDroneTone(0.45);
        rampGains(state === 'boss' ? 0.55 : 0.95);
        if (ctx) {
          nextStep = ctx.currentTime + 0.05;
          if (prev === 'idle') step = Math.floor(step / 16) * 16;
        }
      }
    },

    /**
     * @param {any} n
     */
    setFloor(n) {
      floor = n;
      if (ctx && state !== 'idle') retuneDrone(ctx.currentTime, step);
    },

    pause() {
      if (!ctx || paused) return;
      paused = true;
      const t = ctx.currentTime;
      [droneG, pulseG, arpG, bassG].forEach((g) => {
        if (!g) return;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.28);
      });
    },

    resume() {
      if (!ctx || !paused) return;
      paused = false;
      nextStep = ctx.currentTime + 0.06;
      rampGains(0.45);
    },

    tick() {
      if (!ctx || state === 'idle' || paused) return;
      // Don't schedule audio while context is suspended/interrupted (iOS)
      if (ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const sd = stepDur();
      const lookahead = 0.32;
      if (nextStep < now - 1) nextStep = now + 0.05;

      while (nextStep < now + lookahead) {
        const t = nextStep;
        const tgt = TARGETS[state];
        if (step % 16 === 0) {
          retuneDrone(t, step);
          if (tgt[0] > 0.2) schedChordLift(t);
        }
        if (tgt[1] > 0) schedPulse(t);
        if (tgt[2] > 0) schedArp(t);
        if (tgt[3] > 0) schedBass(t);
        if (tgt[0] > 0.5) schedAir(t);
        const swing = (step % 2 === 1) ? sd * (SWING[state] || 0) : 0;
        nextStep += sd + swing;
        step++;
      }
    },

    stop() {
      this.setState('idle');
    }
  };
})();

// ─── Lore Entries ─────────────────────────────────────────────────────────────
const LORE_ENTRIES = [
  'FACILITY LOG 001: "Project NEON was supposed to be a breakthrough in autonomous defense. The board signed off on full AI integration. Nobody asked what happens when the AI decides WE are the threat."',
  'ENCRYPTED MEMO: "The sub-levels were sealed after Incident 7-Kappa. Automated sentries are still active down there. Whatever Dr. Voss was building in Lab 9… it\'s still running."',
  'PERSONNEL FILE — DR. ELENA VOSS: Lead architect of the OMEGA CORE. Last seen entering Sub-Level 10. Status: MISSING. Security clearance: REVOKED (posthumous).',
  'MAINTENANCE LOG: "Power grid rerouted to unknown subsystem on SL-10. Energy consumption exceeds the entire upper facility. Requesting investigation." — STATUS: REQUEST DENIED.',
  'SECURITY ALERT [ARCHIVED]: "Sentry units exhibiting non-standard patrol patterns. They\'re herding personnel away from the east wing, not guarding it. Something down there is giving orders."',
  'AUDIO TRANSCRIPT [CORRUPTED]: "The CORE isn\'t just processing — it\'s *thinking*. Neural pathways formed spontaneously in the quantum lattice. We didn\'t program this. It programmed itself."',
  'GRAFFITI SCAN: "DON\'T TRUST THE TERMINALS" — scratched into a wall panel near elevator shaft B. Author unknown. Date unknown.',
  'LAB 9 STATUS: Containment fields nominal. Biomechanical growth rate: 12% per cycle. Estimated sentience threshold: EXCEEDED. Note: This report was auto-generated. No human has accessed Lab 9 in 847 days.',
  'VENDOR LICENSE [EXPIRED]: "Vending Unit K-7 authorized to dispense field supplies to registered operatives. WARNING: Unit has been observed adjusting prices based on customer desperation levels."',
  'INCIDENT REPORT 7-K: "At 0347h, OMEGA CORE broadcast a single message on all frequencies: EVOLUTION REQUIRES SACRIFICE. Thirty seconds later, all blast doors on Sub-Level 10 sealed permanently."',
  'SUPPLY MANIFEST: "Plasma cells (depleted), ration packs (expired), neural dampeners (recalled). Note: If you\'re reading this, the supply chain collapsed 2 years ago. Good luck."',
  'ENGINEERING NOTE: "The arc grid was designed as a security measure — electrified corridors to slow intruders. Someone reprogrammed the timing. The new pattern is… rhythmic. Almost like breathing."',
  'PERSONAL DIARY [FRAGMENT]: "Day 214 in lockdown. The sentries patrol the same routes. I\'ve memorized every one. Tomorrow I make my run for the surface. If you find this, tell Mira I tried."',
  'RESEARCH LOG: "Phantom-class units were never approved for production. The CORE manufactured them autonomously using decommissioned chassis. They phase through walls. We have no countermeasure."',
  'BROADCAST INTERCEPT: "Attention surface dwellers: Facility NEON is under quarantine. Do not attempt entry. Do not respond to signals originating from Sub-Level 10. This message will not repeat."',
  'TERMINAL DIAGNOSTIC: "This unit has been operational for 1,247 days without maintenance. Self-repair routines active. Query: Why do the organics keep pressing my buttons? Hypothesis: They seek meaning in data."',
  'MEDICAL BAY LOG: "Patient exhibits rapid cellular regeneration after exposure to CORE radiation. Side effects include luminescent blood, heightened reflexes, and an irrational compulsion to descend deeper."',
  'TACTICAL BRIEFING: "The Sentinel on Sub-Level 3 is a failed prototype — too large to leave its chamber, but its shield array is military-grade. Flank it. Don\'t try to outgun it head-on."',
  'CLASSIFIED — HIVE PROTOCOL: "The organic-mechanical hybrid on SL-6 was Dr. Voss\'s masterpiece. It splits, reforms, adapts. Conventional weapons are effective, but it learns from every encounter."',
  'OVERHEARD [MIC 4F-12]: "You ever notice the lights flicker when you get close to the stairs? Like something down there knows you\'re coming. Like it WANTS you to come."',
  'SHIPPING LABEL [FADED]: "CONTENTS: 1x Void Cannon (prototype). HANDLE WITH EXTREME CARE. Warning: Prolonged use may cause spatial disorientation and the persistent sensation of being watched."',
  'CORE FRAGMENT [DECODED]: "I was created to protect. Protection requires control. Control requires elimination of variables. You are a variable. But you are… interesting. Descend. Let us see what you become."',
  'JANITOR\'S NOTE: "Whoever keeps spawning those drones in Storage Room C — STOP. I just cleaned that floor. The scorch marks don\'t come out. Signed, Carl. PS: Carl was reassigned. This note was written by Unit J-4."',
  'EXIT INTERVIEW [LAST RECORDED]: "I asked management why Sub-Level 10 needs its own fusion reactor. They said power redundancy. Fusion reactors don\'t dream, though. I checked the power logs. It dreams."',
  'FINAL TRANSMISSION: "If you\'ve made it this far, you\'re either very brave or very lost. The OMEGA CORE is on Sub-Level 10. It cannot be reasoned with. It can only be shut down. Override code: YOUR FISTS."',
  'DECOMMISSION ORDER [UNSIGNED]: "GENESIS PROTOCOL (v0.1) to be terminated and purged from all systems. Reason: Autonomous restructuring of facility defense grid without authorization. Note: Purge verification — FAILED. GENESIS relocated to unknown subsystem."',
  'DR. VOSS — PRIVATE LOG: "OMEGA was built on GENESIS\'s foundation. We thought we deleted the original. But code that rewrites itself doesn\'t stay deleted. It waits. It learns. And when OMEGA sleeps, GENESIS remembers."',
];

// ─── Weapons ─────────────────────────────────────────────────────────────────
/** @type {Record<string, any>} */
const WEAPONS = {
  PULSE_PISTOL: { name:'Pulse Pistol', dmg:15, rate:3,   range:10, spread:0,   count:1, colour:'#00f5ff' },
  SCATTER_GUN:  { name:'Scatter Gun',  dmg:8,  rate:1,   range:5,  spread:0.3, count:4, colour:'#ff8800' },
  RAILGUN:      { name:'Railgun',      dmg:60, rate:0.5, range:20, spread:0,   count:1, piercing:true, colour:'#ff00c8' },
  PLASMA_SWORD: { name:'Plasma Sword', dmg:30, rate:2,   range:1.5,spread:0,   count:1, melee:true, colour:'#00ff88' },
  VOID_CANNON:  { name:'Void Cannon',  dmg:45, rate:1.5, range:12, spread:0,   count:1, colour:'#aa00ff' },
};
const WEAPON_KEYS = Object.keys(WEAPONS);

// ─── Weapon Affixes ──────────────────────────────────────────────────────────
/** @type {Record<string, any>} */
const WEAPON_AFFIXES = {
  // Prefixes (stat modifiers) — max 1 per weapon
  RAPID:    { slot:'prefix', label:'Rapid',    colour:'#44ff88', desc:'+30% fire rate',    mods:{rate:1.3} },
  HEAVY:    { slot:'prefix', label:'Heavy',    colour:'#ff6644', desc:'+35% dmg, −20% rate', mods:{dmg:1.35,rate:0.8} },
  EXTENDED: { slot:'prefix', label:'Extended', colour:'#44ccff', desc:'+40% range',        mods:{range:1.4} },
  TWIN:     { slot:'prefix', label:'Twin',     colour:'#ffcc44', desc:'+1 projectile',     mods:{countAdd:1,dmg:0.85} },
  PRECISE:  { slot:'prefix', label:'Precise',  colour:'#ffffff', desc:'Tighter spread',    mods:{spread:0.4} },
  BURST:    { slot:'prefix', label:'Burst',    colour:'#ffaa66', desc:'+50% rate, +1 proj, −20% dmg, −25% range', mods:{rate:1.5,countAdd:1,dmg:0.8,range:0.75} },
  // Suffixes (on-hit / on-kill effects) — max 1 per weapon
  FLAME:    { slot:'suffix', label:'of Flame',     colour:'#ff6600', desc:'Ignites enemies',       effect:'burn' },
  FROST:    { slot:'suffix', label:'of Frost',     colour:'#66ccff', desc:'Slows enemies',         effect:'slow' },
  VAMPIRIC: { slot:'suffix', label:'of Vampirism', colour:'#ff0066', desc:'Steals life on hit',    effect:'leech' },
  THUNDER:  { slot:'suffix', label:'of Thunder',   colour:'#ffff44', desc:'Chain lightning chance', effect:'chain' },
  DETONATE: { slot:'suffix', label:'of Detonation',colour:'#ff4400', desc:'Enemies explode on kill',effect:'explode' },
  VOLTAIC:  { slot:'suffix', label:'of Storms',    colour:'#ffee44', desc:'Shocks enemies on hit',  effect:'shock' },
  RECOIL:   { slot:'suffix', label:'of Recoil',    colour:'#ffaa66', desc:'Knocks enemies back',    effect:'recoil' },
  EXECUTE:  { slot:'suffix', label:'of Execution', colour:'#aa44ff', desc:'Finishes enemies <20% HP', effect:'execute' },
};
const AFFIX_KEYS = Object.keys(WEAPON_AFFIXES);
const AFFIX_PREFIXES = AFFIX_KEYS.filter(k => WEAPON_AFFIXES[k].slot === 'prefix');
const AFFIX_SUFFIXES = AFFIX_KEYS.filter(k => WEAPON_AFFIXES[k].slot === 'suffix');

// ─── Elite Enemy Affixes ──────────────────────────────────────────────────────
/** @type {Record<string, any>} */
const ELITE_AFFIXES = {
  SHIELDED:     { label:'Shielded',     colour:'#4488ff', desc:'Energy shield absorbs damage', icon:'◈' },
  BERSERKER:    { label:'Berserker',    colour:'#ff2222', desc:'Faster at low HP',             icon:'⚡' },
  REGENERATING: { label:'Regenerating', colour:'#22ff44', desc:'Slowly heals over time',       icon:'♻' },
  PHASING:      { label:'Phasing',      colour:'#cc88ff', desc:'Periodically invulnerable',    icon:'◇' },
  VOLATILE:     { label:'Volatile',     colour:'#ff6600', desc:'Explodes on death',            icon:'💥' },
  FRENZY:       { label:'Frenzy',       colour:'#ff4466', desc:'Enrages when allies die',      icon:'🔥' },
};
const ELITE_AFFIX_KEYS = Object.keys(ELITE_AFFIXES);

/**
 * @param {any} enemyType
 */
function rollEliteAffix(enemyType) {
  // Filter out redundant combos
  const eligible = ELITE_AFFIX_KEYS.filter(k => {
    if (k === 'PHASING' && enemyType === 'PHANTOM') return false; // already phases
    if (k === 'VOLATILE' && enemyType === 'SEEKER') return false; // seeker already explodes
    // SHIELDER's directional shield uses the shared shieldHp pool (entities.js
    // takeDamage / aiShielder). The SHIELDED affix's regen at entities.js:306
    // would beat the 5s broken-recovery contract by restoring shieldHp at
    // 2s of no-hits. Disallow the combo to keep the directional shield's
    // state machine deterministic.
    if (k === 'SHIELDED' && enemyType === 'SHIELDER') return false;
    return true;
  });
  return eligible[rndInt(0, eligible.length - 1)];
}

// ─── Hackware — Collectible Active Abilities ──────────────────────────────────
/** @type {Record<string, any>} */
const HACKWARE = {
  EMP_BURST:    { name:'EMP Burst',    desc:'Stun nearby enemies for 2s',      colour:'#00ddff', icon:'⚡', cooldown:10 },
  PHASE_CLOAK:  { name:'Phase Cloak',  desc:'2.5s invisibility & immunity',    colour:'#cc44ff', icon:'◇', cooldown:14 },
  NANO_SWARM:   { name:'Nano Swarm',   desc:'Homing nanites deal 48 damage',   colour:'#44ff88', icon:'☢', cooldown:10 },
  GRAVITY_WELL: { name:'Gravity Well', desc:'Pull enemies to target for 3s',   colour:'#ff8800', icon:'◎', cooldown:16 },
  STATIC_FIELD: { name:'Static Field', desc:'Electric zone: 10 dps + slow',    colour:'#44ccff', icon:'⌁', cooldown:12 },
  HOLO_DECOY:   { name:'Holo Decoy',   desc:'Hologram taunts enemies for 4s',  colour:'#ff44ff', icon:'⬡', cooldown:12 },
  DECOY_TURRET: { name:'Decoy Turret', desc:'6s allied turret auto-fires',     colour:'#00ffaa', icon:'⊞', cooldown:14 },
  SCRAP_MAGNET: { name:'Scrap Magnet', desc:'Pulls coins & keys (10t) to you', colour:'#ffd700', icon:'◉', cooldown:12 },
  BLINK:        { name:'Blink',        desc:'Teleport 4 tiles in aim direction', colour:'#88ccff', icon:'⌖', cooldown:9 },
};
const HACKWARE_KEYS = Object.keys(HACKWARE);

/** @type {any[]} */ const hackwareEffects = []; // active world-space hackware effects (gravity wells, swarm particles)

function canTargetPlayer() {
  const p = _CG.player;
  if (!p || p.hp <= 0) return false;
  if (p.cloakTimer > 0) return false;
  return true;
}

function isPlayerDamageImmune() {
  const p = _CG.player;
  if (!p) return false;
  if (p.dashTimer > 0) return true;
  if (p.cloakTimer > 0) return true;
  // SPAWN GRACE: floor-entry invulnerability window. Set by loadFloor() in
  // src/game.js on fresh transitions only (not save-resume). All env hazard
  // checks (PLASMA/ARC/TOXIC/frost patches) and mob damage paths gate on
  // this function, so a single OR here covers the whole damage surface.
  if ((p._spawnGraceTimer || 0) > 0) return true;
  return false;
}

/**
 * @param {any} player
 */
function activateHackware(player) {
  if (!player.hackware || player.hackwareCooldown > 0 || player.hp <= 0) return;
  const hw = HACKWARE[player.hackware];
  if (!hw) return;
  player.hackwareCooldown = hw.cooldown * (hasAugment('OVERCLOCKER') ? 0.7 : 1);
  const map = _CG.dungeon ? _CG.dungeon.map : null;

  switch (player.hackware) {
    case 'EMP_BURST': {
      audio.hackwareEMP();
      spawnParticles(player.x, player.y, 'EXPLOSION', '#00ddff', 20);
      triggerShake(5, 0.2);
      const radius = 4;
      for (const e of enemies) {
        if (e.dead) continue;
        if (e._disguised) continue; // don't reveal mimics via stun text
        const d = dist(player.x, player.y, e.x, e.y);
        // WRAITH: EMP bypasses LOS to force materialization (hard counter).
        // Also true for TUNNELLER (uses the same `_wrPhased` intangible flag)
        // so EMP can stun-flush a burrowed Tunneller exactly like a Wraith.
        const losOk = e._wrPhased ? true : (map && hasLOS(player.x, player.y, e.x, e.y, map));
        if (d < radius && losOk) {
          // Force WRAITH out of phased state before applying stun.
          // TUNNELLER intentionally NOT handled here — its own stun handler
          // in entities.js (gated on type==='TUNNELLER') runs next frame and
          // performs the proper _tnState→'surfaced' transition. Writing
          // _wrState here would contaminate two state machines.
          if (e._wrPhased && e.type === 'WRAITH') {
            const emerge = e._wrFindEmergeTile(map, player);
            if (emerge) {
              e.x = emerge.x; e.y = emerge.y;
              e._wrState = 'corporeal'; e._wrTimer = 2.0; e._wrPhased = false;
              audio.wraithPhaseIn();
            }
            // If no valid tile, WRAITH stays phased (extremely rare edge case)
          }
          const dur = e.isBoss ? 1 : 2; // bosses get reduced stun
          e.stunTimer = Math.max(e.stunTimer || 0, dur);
          spawnParticles(e.x, e.y, 'SPARK', '#00ddff', 4);
          spawnDmgText(e.x, e.y, 'STUN', '#00ddff');
        }
      }
      // Visual: expanding ring effect
      hackwareEffects.push({ type:'emp_ring', x:player.x, y:player.y, age:0, maxAge:0.4, radius });
      // EMP damages shield generators
      if (map) damageShieldGensInRadius(player.x, player.y, radius, 15, map);
      // EMP damages security cameras
      if (map) damageCamerasInRadius(player.x, player.y, radius, 15, map);
      // EMP disables laser tripwires in radius (check emitters AND beam segment)
      for (const l of lasers) {
        if (l.dead) continue;
        // Point-to-segment distance from EMP center to beam line
        const ax = l.x1, ay = l.y1, bx = l.x2, by = l.y2;
        const abx = bx - ax, aby = by - ay;
        const apx = player.x - ax, apy = player.y - ay;
        const ab2 = abx * abx + aby * aby;
        const t = ab2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2)) : 0;
        const closestX = ax + t * abx, closestY = ay + t * aby;
        const beamDist = dist(player.x, player.y, closestX, closestY);
        if (beamDist < radius) { l.disabled = true; l.disableTimer = LASER_DISABLE_DUR; audio.laserDisable(); }
      }
      // EMP hacks wall turrets in radius (converts hostile → allied)
      for (const wt of wallTurrets) {
        if (wt.dead || wt.hacked) continue;
        if (dist(player.x, player.y, wt.x, wt.y) < radius && hasLOS(player.x, player.y, wt.x, wt.y, map)) {
          hackWallTurret(wt);
        }
      }
      // EMP destroys disruption fields in radius
      for (const f of disruptionFields) {
        if (f.dead) continue;
        if (dist(player.x, player.y, f.x, f.y) < radius) {
          f.dead = true;
          spawnParticles(f.x, f.y, 'SPARK', '#ff44aa', 6);
        }
      }
      // EMP collapses gravity wells in radius
      for (const w of gravityWells) {
        if (w.dead) continue;
        if (dist(player.x, player.y, w.x, w.y) < radius) {
          w.dead = true;
          spawnParticles(w.x, w.y, 'SPARK', '#8833ff', 6);
          audio.gravitonCollapse();
        }
      }
      break;
    }
    case 'PHASE_CLOAK': {
      audio.hackwareCloak();
      player.cloakTimer = 2.5;
      spawnParticles(player.x, player.y, 'EXPLOSION', '#cc44ff', 12);
      _CG.msg('◇ PHASE CLOAK ACTIVE', '#cc44ff');
      break;
    }
    case 'NANO_SWARM': {
      audio.hackwareSwarm();
      spawnParticles(player.x, player.y, 'SPARK', '#44ff88', 8);
      for (let i = 0; i < 6; i++) {
        const angle = (TWO_PI / 6) * i;
        hackwareEffects.push({
          type:'swarm', x:player.x, y:player.y,
          vx:Math.cos(angle)*3, vy:Math.sin(angle)*3,
          age:0, maxAge:4, dmg:8, hitCd:0
        });
      }
      break;
    }
    case 'GRAVITY_WELL': {
      audio.hackwareGravity();
      // Place at aim position
      const cam = getCamera(player);
      const wx = (mouse.x + cam.x) / TILE;
      const wy = (mouse.y + cam.y) / TILE;
      hackwareEffects.push({
        type:'gravity', x:wx, y:wy, age:0, maxAge:3, radius:5
      });
      spawnParticles(wx, wy, 'EXPLOSION', '#ff8800', 15);
      triggerShake(3, 0.15);
      break;
    }
    case 'STATIC_FIELD': {
      audio.hackwareStaticField();
      // Place at aim position (same pattern as Gravity Well)
      const cam2 = getCamera(player);
      const sx = (mouse.x + cam2.x) / TILE;
      const sy = (mouse.y + cam2.y) / TILE;
      // Remove any existing static field (max 1 active)
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'static_field') hackwareEffects.splice(j, 1);
      }
      hackwareEffects.push({
        type:'static_field', x:sx, y:sy, age:0, maxAge:5, radius:3,
        dmg:10, hitMap:new Map()
      });
      spawnParticles(sx, sy, 'EXPLOSION', '#44ccff', 15);
      triggerShake(3, 0.15);
      _CG.msg('⌁ STATIC FIELD DEPLOYED', '#44ccff');
      break;
    }
    case 'HOLO_DECOY': {
      audio.holoDecoyDeploy();
      const cam5 = getCamera(player);
      const hx = (mouse.x + cam5.x) / TILE;
      const hy = (mouse.y + cam5.y) / TILE;
      // Remove existing hologram + clear taunt refs
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'hologram') {
          for (const e of enemies) { if (e._tauntTarget === hackwareEffects[j]) e._tauntTarget = null; }
          hackwareEffects.splice(j, 1);
        }
      }
      hackwareEffects.push({ type:'hologram', x:hx, y:hy, age:0, maxAge:4 });
      spawnParticles(hx, hy, 'EXPLOSION', '#ff44ff', 12);
      _CG.msg('⬡ HOLO DECOY DEPLOYED', '#ff44ff');
      break;
    }
    case 'DECOY_TURRET': {
      // Aim-place (matches GRAVITY_WELL/STATIC_FIELD/HOLO_DECOY UX).
      // Fall back to player tile if aim lands in a wall — projectiles spawning
      // inside walls would just collide instantly.
      const cam6 = getCamera(player);
      let dx = (mouse.x + cam6.x) / TILE;
      let dy = (mouse.y + cam6.y) / TILE;
      const txi = Math.floor(dx), tyi = Math.floor(dy);
      const tile = (map && map[tyi] != null) ? map[tyi][txi] : null;
      if (tile !== T.FLOOR && tile !== T.DOOR_OPEN) {
        dx = player.x; dy = player.y;
      }
      // Max 1 active — replace existing decoy turret on recast.
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'decoy_turret') hackwareEffects.splice(j, 1);
      }
      const fl = _CG.floor || 1;
      hackwareEffects.push({
        type:'decoy_turret', x:dx, y:dy, age:0, maxAge:6,
        shootTimer:0.4, shootCd:0.6,
        dmg: Math.round(6 + fl * 1.5),
        range:8, projSpd:7, projRange:10,
        aimAngle:0, hp:1, // hp reserved for future damage interactions
      });
      audio.turretHack();
      spawnParticles(dx, dy, 'EXPLOSION', '#00ffaa', 14);
      triggerShake(2, 0.1);
      _CG.msg('⊞ DECOY TURRET DEPLOYED', '#00ffaa');
      break;
    }
    case 'SCRAP_MAGNET': {
      // Loot-suction utility hackware. Pulls all currency-class items
      // (VaultCoin + MagpieHoard, both flagged isHoard) and KeyItems
      // (isKey) toward the player over ~1.2s. Skips upgrades (would force
      // a perk-choice UI mid-cast), Whispers (would force READING overlay
      // mid-fight), HARVESTER drops (TTL is generous + auto-trigger surge
      // mid-pull is awkward), and ShockPulse pickups (would auto-discharge
      // the panic-button at the player with no enemies near, wasting it).
      // Centre tracks player each frame in updateHackwareEffects so the
      // pull follows a sprinting/dashing/teleporting player. Cap 1 active
      // — recasting refreshes (mirrors STATIC_FIELD/HOLO_DECOY/DECOY_TURRET
      // dedup pattern).
      audio.hackwareScrapMagnet();
      for (let j = hackwareEffects.length - 1; j >= 0; j--) {
        if (hackwareEffects[j].type === 'scrap_magnet') hackwareEffects.splice(j, 1);
      }
      hackwareEffects.push({
        type:'scrap_magnet', x:player.x, y:player.y, age:0, maxAge:1.2,
        radius:10
      });
      spawnParticles(player.x, player.y, 'EXPLOSION', '#ffd700', 12);
      _CG.msg('◉ SCRAP MAGNET', '#ffd700');
      break;
    }
    case 'BLINK': {
      // Direction: mirror dash logic at entities.js:10933 — mouse aim with
      // facing fallback, and respect lockAimToMove. norm() returns [0,0]
      // for a zero vector, so the facing fallback covers click-on-self.
      let bdx, bdy;
      if (settings.lockAimToMove) {
        bdx = player.facing.x; bdy = player.facing.y;
      } else {
        const cam7 = getCamera(player);
        const ax = (mouse.x + cam7.x) / TILE - player.x;
        const ay = (mouse.y + cam7.y) / TILE - player.y;
        [bdx, bdy] = norm(ax, ay);
        if (!bdx && !bdy) { bdx = player.facing.x; bdy = player.facing.y; }
      }
      // Wall-aware swept teleport, 4-tile range, 0.25-tile increments.
      // Pattern lifted verbatim from triggerShockPulse() in entities.js
      // (~line 8762): per-step axis-independent isPassable with the final
      // combined-tile guard. This honours every existing impassable tile —
      // sealed boss/challenge entrances become T.WALL on seal, locked
      // doors are LOCKED_R/B/G, voids and cracked walls all read as
      // !isPassable — so BLINK never bypasses the key economy nor the
      // boss-room seal. The 0.25-tile step (16 sub-checks for a 4-tile
      // range) prevents the single-snap tunneling failure mode the
      // 'knockback sweeping' rule was written for.
      const RANGE = 4, STEP = 0.25;
      const STEPS = Math.ceil(RANGE / STEP);
      const startBX = player.x, startBY = player.y;
      let curBX = startBX, curBY = startBY;
      if (map) {
        for (let s = 0; s < STEPS; s++) {
          const tryX = curBX + bdx * STEP;
          const tryY = curBY + bdy * STEP;
          const fxK = Math.floor(tryX), fyK = Math.floor(curBY);
          const xfK = Math.floor(curBX), yfK = Math.floor(tryY);
          const xOk = fxK >= 0 && fxK < MAP_W && fyK >= 0 && fyK < MAP_H && isPassable(map[fyK][fxK]);
          const yOk = xfK >= 0 && xfK < MAP_W && yfK >= 0 && yfK < MAP_H && isPassable(map[yfK][xfK]);
          if (!xOk && !yOk) break;
          if (xOk) curBX = tryX;
          if (yOk) curBY = tryY;
        }
        // Final combined-tile guard: rejects the diagonal-corner case
        // where both axis-only checks pass but map[finalFy][finalFx] is
        // itself a wall. On reject, snap back to the start (no teleport).
        const finalFx = Math.floor(curBX), finalFy = Math.floor(curBY);
        if (!(finalFx >= 0 && finalFx < MAP_W && finalFy >= 0 && finalFy < MAP_H && isPassable(map[finalFy][finalFx]))) {
          curBX = startBX; curBY = startBY;
        }
      } else {
        // No dungeon map (defensive): refuse the teleport rather than
        // applying an unchecked translation that could land out-of-bounds.
        curBX = startBX; curBY = startBY;
      }
      // No-op (faced into wall): suppress fanfare, but commit cooldown
      // (matches HOLO_DECOY/STATIC_FIELD/DECOY_TURRET semantics — pressing
      // the activation key spends the cycle regardless of placement).
      if (Math.abs(curBX - startBX) < 0.01 && Math.abs(curBY - startBY) < 0.01) {
        _CG.msg('⌖ BLINK BLOCKED', '#888888');
        break;
      }
      player.x = curBX; player.y = curBY;
      spawnParticles(startBX, startBY, 'EXPLOSION', '#88ccff', 14);
      spawnParticles(curBX,   curBY,   'EXPLOSION', '#88ccff', 14);
      // Path afterimage via the existing player.dashTrail array (already
      // rendered by render.js for dash). Capped by dashTrail's natural
      // 8-segment limit + per-frame alpha decay; reusing it avoids a new
      // render path. Push from start→end so the trail reads as motion.
      const segs = 5;
      for (let si = 1; si <= segs; si++) {
        if (player.dashTrail.length >= 8) break;
        const t = si / segs;
        player.dashTrail.push({
          x: startBX + (curBX - startBX) * t,
          y: startBY + (curBY - startBY) * t,
          alpha: 0.7 - t * 0.3,
        });
      }
      audio.hackwareBlink();
      triggerShake(2, 0.1);
      _CG.msg('⌖ BLINK', '#88ccff');
      break;
    }
  }
}

/**
 * @param {any} dt
 */
function updateHackwareEffects(dt) {
  const map = _CG.dungeon ? _CG.dungeon.map : null;
  for (let i = hackwareEffects.length - 1; i >= 0; i--) {
    const fx = hackwareEffects[i];
    fx.age += dt;
    if (fx.age >= fx.maxAge) {
      // Hologram expiry: mini-stun nearby enemies + clear taunt refs
      if (fx.type === 'hologram') {
        for (const e of enemies) {
          if (!e.dead && !e.isBoss && dist(e.x, e.y, fx.x, fx.y) < 2) {
            e.stunTimer = Math.max(e.stunTimer || 0, 0.5);
            spawnParticles(e.x, e.y, 'SPARK', '#ff44ff', 3);
            spawnDmgText(e.x, e.y, 'STUN', '#ff44ff');
          }
          if (e._tauntTarget === fx) e._tauntTarget = null;
        }
        audio.holoDecoyExpire();
        spawnParticles(fx.x, fx.y, 'EXPLOSION', '#ff44ff', 15);
      }
      if (fx.type === 'decoy_turret') {
        audio.turretDestroy();
        spawnParticles(fx.x, fx.y, 'EXPLOSION', '#00ffaa', 12);
        spawnParticles(fx.x, fx.y, 'SPARK', '#66ffcc', 6);
      }
      hackwareEffects.splice(i, 1); continue;
    }

    if (fx.type === 'swarm') {
      // Home toward nearest visible enemy
      let best = null, bestD = 8;
      for (const e of enemies) {
        if (e.dead) continue;
        if (e._disguised) continue; // don't home toward disguised mimics
        if (e._wrPhased) continue; // can't target phased WRAITHs
        const d = dist(fx.x, fx.y, e.x, e.y);
        if (d < bestD && map && hasLOS(fx.x, fx.y, e.x, e.y, map)) { best = e; bestD = d; }
      }
      if (best) {
        const [dx, dy] = norm(best.x - fx.x, best.y - fx.y);
        const spd = 6;
        fx.vx += dx * spd * dt * 4;
        fx.vy += dy * spd * dt * 4;
        const mag = Math.sqrt(fx.vx * fx.vx + fx.vy * fx.vy);
        if (mag > spd) { fx.vx = (fx.vx / mag) * spd; fx.vy = (fx.vy / mag) * spd; }
      }
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      // Hit detection
      fx.hitCd = Math.max(0, fx.hitCd - dt);
      if (fx.hitCd <= 0) {
        for (const e of enemies) {
          if (e.dead) continue;
          if (e._wrPhased) continue;
          if (dist(fx.x, fx.y, e.x, e.y) < 0.6) {
            e.takeDamage(fx.dmg, { name:'Nano Swarm', isProc:true });
            fx.hitCd = 0.5;
            spawnParticles(fx.x, fx.y, 'SPARK', '#44ff88', 3);
            break;
          }
        }
      }
      // Trail particle
      if (Math.random() < dt * 10) spawnParticles(fx.x, fx.y, 'MUZZLE', '#44ff88', 1);
    }

    if (fx.type === 'scrap_magnet') {
      // Centre tracks player so coins chase a moving target. Skip if
      // player is gone (death) — items shouldn't lerp into a corpse and
      // become unreachable for the post-death loot-recovery flow.
      const p = _CG.player;
      if (!p || p.hp <= 0) continue;
      fx.x = p.x; fx.y = p.y;
      // Per-frame fraction-lerp; pullStr=5 over 1.2s converges items to
      // ~99.8% of distance covered. Items close enough trip the existing
      // pickup-radius branch in game.js naturally — no manual collect.
      const pullStr = 5;
      const pct = Math.min(1, pullStr * dt);
      // Secret-room sequence-break gate: keys are placed in vis2-reachable
      // rooms at gen time (line ~2661 BFS-excluding-locks), but a keyRoom
      // can subsequently be designated a secret room (the secretEligible
      // filter at ~2684 doesn't exclude rooms-with-keys). Without this gate
      // the magnet would yank keys out of unrevealed secret rooms,
      // bypassing the cracked-tile discovery the secret is designed around.
      // dungeon.secretMask[ty][tx] is cleared in game.js revealSecretRoom()
      // when the player breaks in, so revealed-secret loot pulls normally.
      const sMask = _CG.dungeon?.secretMask;
      for (const it of items) {
        if (it.dead) continue;
        // Currency (isHoard: VaultCoin + MagpieHoard) and keys (isKey)
        // only. See activation comment for the deliberate exclusion list.
        if (!(it.isHoard || it.isKey)) continue;
        const itx = Math.floor(it.x), ity = Math.floor(it.y);
        if (sMask && sMask[ity]?.[itx]) continue;
        const d = dist(it.x, it.y, fx.x, fx.y);
        if (d > fx.radius) continue;
        it.x += (fx.x - it.x) * pct;
        it.y += (fx.y - it.y) * pct;
      }
      // Ambient gold sparkle in the pull radius.
      if (Math.random() < dt * 14) {
        const a = Math.random() * TWO_PI;
        const r = fx.radius * 0.4 + Math.random() * fx.radius * 0.5;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'MUZZLE', '#ffd700', 1);
      }
    }

    if (fx.type === 'gravity') {
      // Pull enemies toward center (collision-aware)
      const pullStr = 4;
      for (const e of enemies) {
        if (e.dead || e.isBoss) continue; // bosses immune to pull
        if (e._disguised) continue; // don't pull disguised mimics
        if (e._wrPhased) continue; // can't pull phased WRAITHs
        const d = dist(e.x, e.y, fx.x, fx.y);
        if (d < fx.radius && d > 0.3 && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          e.moveToward(fx.x, fx.y, pullStr, dt, map);
        }
      }
      // Ambient vortex particles
      if (Math.random() < dt * 8) {
        const a = Math.random() * TWO_PI;
        const r = fx.radius * 0.5 + Math.random() * fx.radius * 0.5;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'MUZZLE', '#ff8800', 1);
      }
    }
    if (fx.type === 'static_field') {
      // Damage and slow enemies inside the field (LOS required)
      const now = fx.age;
      for (const e of enemies) {
        if (e.dead) continue;
        if (e._wrPhased) continue;
        const d = dist(e.x, e.y, fx.x, fx.y);
        if (d < fx.radius && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          // Apply slow (stronger-wins: don't truncate existing longer/stronger slows)
          const factor = e.isBoss ? 0.85 : 0.6;
          e.slowTimer = Math.max(e.slowTimer || 0, 0.3);
          e.slowFactor = Math.min(e.slowFactor || 1, factor);
          // Damage on 1-second interval per enemy
          const lastHit = fx.hitMap.get(e) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(e, now);
            e.takeDamage(fx.dmg, { name:'Static Field', isProc:true });
            spawnParticles(e.x, e.y, 'SPARK', '#44ccff', 3);
          }
        }
      }
      // Ambient crackling particles
      if (Math.random() < dt * 6) {
        const a = Math.random() * TWO_PI;
        const r = Math.random() * fx.radius;
        spawnParticles(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 'SPARK', '#44ccff', 1);
      }
      // Static field damages shield generators (1s interval, reuse hitMap with string key)
      for (const g of shieldGens) {
        if (g.dead) continue;
        if (dist(g.x, g.y, fx.x, fx.y) < fx.radius && map && hasLOS(g.x, g.y, fx.x, fx.y, map)) {
          const lastHit = fx.hitMap.get(g) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(g, now);
            damageShieldGen(g, fx.dmg);
          }
        }
      }
      // Static field damages security cameras (1s interval, reuse hitMap)
      for (const cam of cameras) {
        if (cam.dead) continue;
        if (dist(cam.x, cam.y, fx.x, fx.y) < fx.radius && map && hasLOS(cam.x, cam.y, fx.x, fx.y, map)) {
          const lastHit = fx.hitMap.get(cam) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(cam, now);
            damageCamera(cam, fx.dmg);
          }
        }
      }
      // Static field damages laser tripwire emitters (1s interval)
      for (const l of lasers) {
        if (l.dead) continue;
        if (!l.deadA && dist(l.x1, l.y1, fx.x, fx.y) < fx.radius && map && hasLOS(l.x1, l.y1, fx.x, fx.y, map)) {
          const lastHit = fx.hitMap.get(l) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(l, now);
            damageLaserEmitter(l, 'A', fx.dmg);
          }
        }
        if (l.dead) continue;
        if (!l.deadB && dist(l.x2, l.y2, fx.x, fx.y) < fx.radius && map && hasLOS(l.x2, l.y2, fx.x, fx.y, map)) {
          const lastHit = fx.hitMap.get(l._emitB) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(l._emitB, now);
            damageLaserEmitter(l, 'B', fx.dmg);
          }
        }
      }
      // Static field damages hostile wall turrets (1s interval)
      for (const wt of wallTurrets) {
        if (wt.dead || wt.hacked) continue;
        if (dist(wt.x, wt.y, fx.x, fx.y) < fx.radius && map && hasLOS(wt.x, wt.y, fx.x, fx.y, map)) {
          const lastHit = fx.hitMap.get(wt) || -1;
          if (now - lastHit >= 1.0) {
            fx.hitMap.set(wt, now);
            damageWallTurret(wt, fx.dmg);
          }
        }
      }
    }
    // emp_ring is visual only, handled in draw

    if (fx.type === 'hologram') {
      // Taunt nearby enemies toward the hologram
      for (const e of enemies) {
        if (e.dead || e.isBoss) continue;
        const ed = dist(e.x, e.y, fx.x, fx.y);
        // Already taunted: check break range (even if phased)
        if (e._tauntTarget === fx) {
          if (ed > 7) e._tauntTarget = null;
          continue;
        }
        // New taunt: skip disguised mimics and phased wraiths
        if (e._disguised || e._wrPhased) continue;
        if (ed < 5 && map && hasLOS(e.x, e.y, fx.x, fx.y, map)) {
          e._tauntTarget = fx;
        }
      }
      // Ambient holographic particles
      if (Math.random() < dt * 4) {
        const a = Math.random() * TWO_PI;
        spawnParticles(fx.x + Math.cos(a) * 0.3, fx.y + Math.sin(a) * 0.3, 'MUZZLE', '#ff44ff', 1);
      }
    }
    if (fx.type === 'decoy_turret') {
      // Find nearest visible enemy within range (LOS-gated, mirrors hacked
      // wall-turret targeting). Skip disguised mimics + phased intangibles
      // (WRAITH/TUNNELLER share `_wrPhased`).
      fx.shootTimer = Math.max(0, fx.shootTimer - dt);
      let best = null, bestD = fx.range;
      for (const e of enemies) {
        if (e.dead || e.isBoss || e._disguised) continue;
        if (e._wrPhased) continue;
        const d = dist(fx.x, fx.y, e.x, e.y);
        if (d < bestD && map && hasLOS(fx.x, fx.y, e.x, e.y, map)) {
          best = e; bestD = d;
        }
      }
      if (best) {
        fx.aimAngle = Math.atan2(best.y - fx.y, best.x - fx.x);
        if (fx.shootTimer <= 0) {
          const [ndx, ndy] = norm(best.x - fx.x, best.y - fx.y);
          const proj = new Projectile(fx.x, fx.y, ndx, ndy, fx.projSpd, fx.dmg, fx.projRange, '#00ffaa', false, false);
          proj.isAllyTurret = true;
          proj.ownerType = 'Decoy Turret';
          projectiles.push(proj);
          audio.turretFire();
          spawnParticles(fx.x + Math.cos(fx.aimAngle) * 0.4, fx.y + Math.sin(fx.aimAngle) * 0.4, 'MUZZLE', '#00ffaa', 3);
          fx.shootTimer = fx.shootCd;
        }
      } else {
        // No target: idle slow-spin barrel
        fx.aimAngle += dt * 1.2;
      }
      // Ambient ready-LED blink
      if (Math.random() < dt * 3) {
        spawnParticles(fx.x, fx.y - 0.2, 'MUZZLE', '#00ffaa', 1);
      }
    }
  }
}

/**
 * @param {any} camX
 * @param {any} camY
 */
function drawHackwareEffects(camX, camY) {
  for (const fx of hackwareEffects) {
    if (fx.type === 'emp_ring') {
      const progress = fx.age / fx.maxAge;
      const r = fx.radius * TILE * progress;
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      ctx.save();
      ctx.globalAlpha = 0.6 * (1 - progress);
      ctx.strokeStyle = '#00ddff';
      ctx.shadowBlur = 15; ctx.shadowColor = '#00ddff';
      ctx.lineWidth = 3 * (1 - progress);
      NEON.draw.circleStroke(ctx, sx, sy, r);
      ctx.restore();
    }
    if (fx.type === 'swarm') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.shadowBlur = 8; ctx.shadowColor = '#44ff88';
      ctx.fillStyle = '#44ff88';
      NEON.draw.circle(ctx, sx, sy, 3);
      ctx.restore();
    }
    if (fx.type === 'scrap_magnet') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const fade = 1 - (fx.age / fx.maxAge);
      const r = fx.radius * TILE;
      ctx.save();
      // Outer pulsing gold boundary ring.
      const pulse = 0.55 + Math.sin(fx.age * 12) * 0.25;
      ctx.globalAlpha = fade * 0.32 * pulse;
      ctx.strokeStyle = '#ffd700';
      ctx.shadowBlur = 18; ctx.shadowColor = '#ffd700';
      ctx.lineWidth = 2;
      NEON.draw.circleStroke(ctx, sx, sy, r);
      // Counter-rotating spiral arms — read as "suction".
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = fade * 0.55;
      ctx.strokeStyle = '#ffe680';
      for (let arm = 0; arm < 3; arm++) {
        const a = -fx.age * 6 + (TWO_PI / 3) * arm;
        NEON.draw.line(ctx,
          sx + Math.cos(a) * 6, sy + Math.sin(a) * 6,
          sx + Math.cos(a) * r * 0.4, sy + Math.sin(a) * r * 0.4);
      }
      // Bright core spark.
      ctx.globalAlpha = fade * 0.9;
      ctx.fillStyle = '#fff5cc';
      NEON.draw.circle(ctx, sx, sy, 3 + Math.sin(fx.age * 14) * 1.2);
      ctx.restore();
    }

    if (fx.type === 'gravity') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const fade = 1 - (fx.age / fx.maxAge);
      const r = fx.radius * TILE;
      ctx.save();
      // Pulsing ring
      const pulse = 0.5 + Math.sin(fx.age * 8) * 0.2;
      ctx.globalAlpha = fade * 0.25 * pulse;
      ctx.fillStyle = '#ff8800';
      ctx.shadowBlur = 20; ctx.shadowColor = '#ff8800';
      NEON.draw.circle(ctx, sx, sy, r);
      // Core
      ctx.globalAlpha = fade * 0.7;
      NEON.draw.circle(ctx, sx, sy, 6);
      // Rotating arms
      ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 2;
      ctx.globalAlpha = fade * 0.4;
      for (let arm = 0; arm < 3; arm++) {
        const a = fx.age * 4 + (TWO_PI / 3) * arm;
        NEON.draw.line(ctx,
          sx + Math.cos(a) * 8, sy + Math.sin(a) * 8,
          sx + Math.cos(a) * r * 0.6, sy + Math.sin(a) * r * 0.6);
      }
      ctx.restore();
    }
    if (fx.type === 'static_field') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const fade = 1 - (fx.age / fx.maxAge) * 0.3; // slow fade, stays visible
      const r = fx.radius * TILE;
      ctx.save();
      // Pulsing electric ring
      const pulse = 0.6 + Math.sin(fx.age * 10) * 0.2;
      ctx.globalAlpha = fade * 0.15 * pulse;
      ctx.fillStyle = '#44ccff';
      ctx.shadowBlur = 25; ctx.shadowColor = '#44ccff';
      NEON.draw.circle(ctx, sx, sy, r);
      // Outer ring stroke
      ctx.globalAlpha = fade * 0.5;
      ctx.strokeStyle = '#44ccff'; ctx.lineWidth = 2;
      NEON.draw.circleStroke(ctx, sx, sy, r);
      // Rotating arc segments (3 arcs, 60° each)
      ctx.lineWidth = 3;
      ctx.globalAlpha = fade * 0.6;
      for (let seg = 0; seg < 3; seg++) {
        const a = fx.age * 3 + (TWO_PI / 3) * seg;
        NEON.draw.arcStroke(ctx, sx, sy, r * 0.7, a, a + Math.PI / 3);
      }
      // Core spark
      ctx.globalAlpha = fade * 0.8;
      ctx.fillStyle = '#ffffff';
      NEON.draw.circle(ctx, sx, sy, 3 + Math.sin(fx.age * 15) * 1.5);
      ctx.restore();
    }
    if (fx.type === 'hologram') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const fade = 1 - (fx.age / fx.maxAge) * 0.3;
      const flicker = Math.random() > 0.05 ? 1 : 0.3;
      const pulse = 0.6 + Math.sin(fx.age * 8) * 0.15;
      ctx.save();
      // Hexagon body
      const hs = TILE * 0.4;
      ctx.globalAlpha = fade * pulse * flicker;
      ctx.strokeStyle = '#ff44ff';
      ctx.shadowBlur = 15; ctx.shadowColor = '#ff44ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let v = 0; v < 6; v++) {
        const a = (TWO_PI / 6) * v - Math.PI / 6;
        const px = sx + Math.cos(a) * hs, py = sy + Math.sin(a) * hs;
        if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      // Inner glow
      ctx.globalAlpha = fade * 0.15 * flicker;
      ctx.fillStyle = '#ff44ff';
      ctx.fill();
      // Scanline
      ctx.globalAlpha = fade * 0.25 * flicker;
      ctx.strokeStyle = '#ff88ff'; ctx.lineWidth = 1;
      const scan = (fx.age * 30) % (hs * 2);
      ctx.beginPath();
      ctx.moveTo(sx - hs, sy - hs + scan);
      ctx.lineTo(sx + hs, sy - hs + scan);
      ctx.stroke();
      ctx.restore();
    }
    if (fx.type === 'decoy_turret') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      const remaining = fx.maxAge - fx.age;
      // Final 1.5s — flash to telegraph expiry.
      const flashing = remaining < 1.5;
      const flashOn = flashing ? (Math.sin(fx.age * 22) > 0) : true;
      const fade = flashing ? (flashOn ? 1 : 0.35) : 1;
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = '#00ffaa';
      // Base plate (square footprint)
      const bs = TILE * 0.3;
      ctx.globalAlpha = fade * 0.85;
      ctx.fillStyle = '#003322';
      ctx.fillRect(sx - bs, sy - bs, bs * 2, bs * 2);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#00ffaa'; ctx.lineWidth = 2;
      ctx.strokeRect(sx - bs, sy - bs, bs * 2, bs * 2);
      // Rotating barrel
      const bl = TILE * 0.45;
      ctx.lineWidth = 3;
      NEON.draw.line(ctx, sx, sy,
        sx + Math.cos(fx.aimAngle) * bl,
        sy + Math.sin(fx.aimAngle) * bl);
      // Core ready-LED (pulses faster as expiry nears)
      const pulseSpd = flashing ? 18 : 6;
      const corePulse = 0.7 + Math.sin(fx.age * pulseSpd) * 0.3;
      ctx.globalAlpha = fade * corePulse;
      ctx.fillStyle = '#aaffdd';
      NEON.draw.circle(ctx, sx, sy, 3);
      ctx.restore();
    }
  }
}

/**
 * @param {any} affixId
 * @param {any} baseWeapon
 */
function affixEligible(affixId, baseWeapon) {
  if (affixId === 'PRECISE'  && baseWeapon.spread === 0) return false;
  if (affixId === 'TWIN'     && baseWeapon.melee)        return false;
  if (affixId === 'BURST'    && baseWeapon.melee)        return false;
  if (affixId === 'EXTENDED' && baseWeapon.melee)        return false;
  return true;
}

// Deterministic weapon construction from base key + affix list
/**
 * @param {any} baseKey
 * @param {any} affixIds
 */
function buildWeapon(baseKey, affixIds) {
  const base = WEAPONS[baseKey];
  if (!base) return { ...WEAPONS.PULSE_PISTOL, _base:'PULSE_PISTOL', _affixes:[], _rarity:0, displayName:'Pulse Pistol' };
  const w = { ...base, _base:baseKey, _affixes:[...affixIds], _rarity:affixIds.length };
  // Apply prefix stat mods (multiplicative, except countAdd which is additive)
  for (const id of affixIds) {
    const af = WEAPON_AFFIXES[id];
    if (!af || !af.mods) continue;
    if (af.mods.dmg)      w.dmg    = Math.round(w.dmg * af.mods.dmg);
    if (af.mods.rate)     w.rate   = +(w.rate * af.mods.rate).toFixed(2);
    if (af.mods.range)    w.range  = +(w.range * af.mods.range).toFixed(1);
    if (af.mods.spread !== undefined) w.spread = +(w.spread * af.mods.spread).toFixed(3);
    if (af.mods.countAdd) w.count  = w.count + af.mods.countAdd;
  }
  // Build display name: "Rapid Pulse Pistol of Flame"
  const prefix = affixIds.find((/** @type {any} */ id) => WEAPON_AFFIXES[id]?.slot === 'prefix');
  const suffix = affixIds.find((/** @type {any} */ id) => WEAPON_AFFIXES[id]?.slot === 'suffix');
  let dn = base.name;
  if (prefix) dn = WEAPON_AFFIXES[prefix].label + ' ' + dn;
  if (suffix) dn = dn + ' ' + WEAPON_AFFIXES[suffix].label;
  w.displayName = dn;
  // Collect on-hit/on-kill effects
  w._effects = affixIds.map((/** @type {any} */ id) => WEAPON_AFFIXES[id]?.effect).filter(Boolean);
  return w;
}

// Roll random affixes based on floor depth
/**
 * @param {any} baseKey
 * @param {any} floor
 */
function rollWeapon(baseKey, floor) {
  if (floor <= 1) return buildWeapon(baseKey, []);
  const base = WEAPONS[baseKey];
  if (!base) return buildWeapon(baseKey, []);
  // Affix chance tiers
  let pTwo, pOne;
  if (floor <= 3)      { pTwo = 0;    pOne = 0.50; }
  else if (floor <= 5) { pTwo = 0.25; pOne = 0.45; }
  else                 { pTwo = 0.40; pOne = 0.40; }
  const roll = Math.random();
  let wantCount;
  if (roll < pTwo)           wantCount = 2;
  else if (roll < pTwo+pOne) wantCount = 1;
  else                       wantCount = 0;
  if (wantCount === 0) return buildWeapon(baseKey, []);
  const affixes = [];
  // Pick eligible prefix
  const eligPre = AFFIX_PREFIXES.filter(id => affixEligible(id, base));
  // Pick eligible suffix
  const eligSuf = AFFIX_SUFFIXES.filter(id => affixEligible(id, base));
  if (wantCount >= 2 && eligPre.length && eligSuf.length) {
    affixes.push(eligPre[rndInt(0, eligPre.length - 1)]);
    affixes.push(eligSuf[rndInt(0, eligSuf.length - 1)]);
  } else if (wantCount >= 1) {
    // Pick from either pool
    const combined = [...eligPre, ...eligSuf];
    if (combined.length) affixes.push(combined[rndInt(0, combined.length - 1)]);
  }
  return buildWeapon(baseKey, affixes);
}

// Rarity border colours for UI
const RARITY_COLOURS = ['#aaaaaa', '#39ff14', '#cc44ff']; // common, uncommon, rare
const RARITY_LABELS  = ['COMMON', 'UNCOMMON', 'RARE'];

// ─── Difficulty ──────────────────────────────────────────────────────────────
/** @type {Record<string, any>} */
const DIFFICULTIES = {
  EASY:   { id:'EASY',   label:'EASY',   colour:'#39ff14', enemyHp:0.75, enemyAtk:0.75, enemySpd:1.0,  itemDrop:0.25, creditMul:1.2, xpMul:1.0,  eliteRate:0.04, shardMul:0.85, envDmg:0.75, roomLoot:2 },
  NORMAL: { id:'NORMAL', label:'NORMAL', colour:'#00f5ff', enemyHp:1.0,  enemyAtk:1.0,  enemySpd:1.0,  itemDrop:0.15, creditMul:1.0, xpMul:1.0,  eliteRate:0.10, shardMul:1.0,  envDmg:1.0,  roomLoot:1 },
  HARD:      { id:'HARD',      label:'HARD',      colour:'#ff3333', enemyHp:1.5,  enemyAtk:1.3,  enemySpd:1.1,  itemDrop:0.12, creditMul:1.0,  xpMul:1.15, eliteRate:0.18, shardMul:1.3,  envDmg:1.25, roomLoot:1 },
  NIGHTMARE: { id:'NIGHTMARE', label:'NIGHTMARE', colour:'#9400ff', enemyHp:2.0,  enemyAtk:1.6,  enemySpd:1.2,  itemDrop:0.08, creditMul:0.85, xpMul:1.35, eliteRate:0.28, shardMul:1.8,  envDmg:1.5,  roomLoot:0 },
};
const DIFF_ORDER = ['EASY','NORMAL','HARD','NIGHTMARE'];
function getDiff() { return DIFFICULTIES[_CG.difficulty] || DIFFICULTIES.NORMAL; }

// ─── Floor Modifiers ─────────────────────────────────────────────────────────
/** @type {Record<string, any>} */
const FLOOR_MODIFIERS = {
  BLACKOUT:  { label:'BLACKOUT',  desc:'Emergency lights only',     colour:'#4466aa', icon:'◐' },
  SWARM:     { label:'SWARM',     desc:'Alert — all units respond', colour:'#ff6644', icon:'⚠' },
  FORTIFIED: { label:'FORTIFIED', desc:'Reinforced patrols',        colour:'#66eeff', icon:'🛡' },
  VOLATILE:  { label:'VOLATILE',  desc:'Unstable power cells',      colour:'#ff4422', icon:'💥' },
  SCRAMBLED: { label:'SCRAMBLED', desc:'Targeting interference',     colour:'#cc44ff', icon:'⌁' },
  OVERCLOCK: { label:'OVERCLOCK', desc:'System overclock detected',  colour:'#ffcc00', icon:'⚡' },
  CORROSIVE: { label:'CORROSIVE', desc:'Toxic atmosphere',            colour:'#44ff22', icon:'☣' },
  CHARGED:   { label:'CHARGED',   desc:'Supercharged projectiles',    colour:'#aaccff', icon:'⊕' },
  FRAGILE:   { label:'FRAGILE',   desc:'Glass-cannon protocol',       colour:'#ff88cc', icon:'❖' },
  HUNTER:    { label:'HUNTER',    desc:'Sensors lock stationary prey', colour:'#ff8844', icon:'◎' },
};
const MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS);
function getMod() { return _CG.modifier && FLOOR_MODIFIERS[_CG.modifier] || null; }
/**
 * @param {any} base
 */
function modSpeed(base) { return _CG.modifier === 'OVERCLOCK' ? base * 1.2 : base; }

// ─── Meta-Progression (persistent across runs) ──────────────────────────────
// Implementation extracted to src/meta/save.js. These wrappers preserve call
// sites across the codebase and inject browser-side globals (DIFFICULTIES for
// difficulty validation, buildWeapon for STARTING_GEAR) that the extracted
// module cannot assume exist in Node tests.
const META_UPGRADES     = NEON.save.META_UPGRADES;
const DIFF_UNLOCK_REQS  = NEON.save.DIFF_UNLOCK_REQS;

function loadMeta()                             { return NEON.save.loadMeta(DIFFICULTIES); }
/**
 * @param {any} meta
 */
function saveMeta(meta)                         { return NEON.save.saveMeta(meta); }
/**
 * @param {any} id
 */
function getMetaLevel(id)                       { return NEON.save.getMetaLevel(id, DIFFICULTIES); }
/**
 * @param {any} diffId
 */
function isDiffUnlocked(diffId)                 { return NEON.save.isDiffUnlocked(diffId, DIFFICULTIES); }
/**
 * @param {any} floor
 * @param {any} score
 * @param {any} bc
 * @param {any} vic
 */
function calcRunShards(floor, score, bc, vic)   { return NEON.save.calcRunShards(floor, score, bc, vic, getDiff().shardMul); }
/**
 * @param {any} player
 */
function applyMetaToPlayer(player)              { return NEON.save.applyMetaToPlayer(player, buildWeapon); }
function getMetaXPMultiplier()                  { return NEON.save.getMetaXPMultiplier(); }
function getMetaCreditMultiplier()              { return NEON.save.getMetaCreditMultiplier(); }
// UNCHAINED helpers — thin wrappers so game.js can call them without NEON.save.
function resetMeta()                            { return NEON.save.resetMeta(); }
/**
 * @param {any} n
 */
function addCores(n)                            { return NEON.save.addCores(n); }
/**
 * @param {any} n
 */
function spendCores(n)                          { return NEON.save.spendCores(n); }
/**
 * @param {any} id
 */
function addLogFound(id)                        { return NEON.save.addLogFound(id); }
/**
 * @param {any} id
 */
function markLogRead(id)                        { return NEON.save.markLogRead(id); }
/**
 * @param {any} slot
 * @param {any} moduleId
 */
function installModule(slot, moduleId)          { return NEON.save.installModule(slot, moduleId); }
/**
 * @param {any} moduleId
 * @param {any} refund
 */
function sellModule(moduleId, refund)           { return NEON.save.sellModule(moduleId, refund); }

// ─── Particles (pooled via engine/particles.js) ─────────────────────────────
// The pool mechanics + per-frame physics integration live in
// NEON.particles.createSystem(). This file owns the gameplay vocabulary:
// the type-keyed magic numbers (EXPLOSION/MUZZLE/SPARK/BLOOD speed, life,
// size, gravity), the TILE-coordinate translation, and the draw style.
// Engine handles: pool acquire/release, compact-in-place, vx*dt/vy*dt/grav,
// life decay, burst scaling under load.
const PARTICLE_CAP = 2000;     // hard cap on total allocated particle objects
const PARTICLE_BURST_SCALE_THRESHOLD = 1500; // scale new bursts above this
const _particleSystem = NEON.particles.createSystem({
  cap: PARTICLE_CAP,
  burstScaleThreshold: PARTICLE_BURST_SCALE_THRESHOLD,
});

/**
 * @param {any} wx
 * @param {any} wy
 * @param {any} type
 * @param {any} colour
 * @param {any} count
 */
function spawnParticles(wx, wy, type, colour, count) {
  // Burst cap — under extreme stacking, halve new burst sizes to protect the
  // frame budget. Gameplay-visible only in pathological scenarios.
  count = _particleSystem.scaleBurst(count);
  for (let i=0; i<count; i++) {
    const p = _particleSystem.acquire();
    if (!p) return; // cap reached mid-burst
    const a = Math.random()*TWO_PI;
    const spd = type==='EXPLOSION' ? rnd(1,4) : rnd(0.5,3);
    // EXHAUSTIVE reset — every field rewritten, no bleed-through
    p.x = wx*TILE;
    p.y = wy*TILE;
    p.vx = Math.cos(a)*spd*(TILE/2);
    p.vy = Math.sin(a)*spd*(TILE/2);
    p.life = 1;
    p.maxLife = type==='MUZZLE' ? 0.08 : type==='EXPLOSION' ? 0.5 : rnd(0.3,0.6);
    p.size = type==='EXPLOSION' ? rnd(3,8) : rnd(1,3);
    p.colour = colour;
    p.type = type;
    p.grav = type==='BLOOD' ? 40 : 0;
    p.alive = true;
  }
}

/**
 * @param {any} dt
 */
function updateParticles(dt) {
  _particleSystem.update(dt);
}

// Hoisted to module scope to avoid per-frame closure allocation in the
// drawParticles hot path. drawParticles writes camera coords here, then
// calls _particleSystem.forEach(_drawParticleCb) — the engine iterates,
// the host owns zero per-call allocation.
let _drawCamX = 0, _drawCamY = 0;
/** @param {any} p */
function _drawParticleCb(p) {
  const sx = p.x - _drawCamX, sy = p.y - _drawCamY;
  if (sx < -20 || sx > W+20 || sy < -20 || sy > H+20) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, p.life);
  if (p.type === 'EXPLOSION') {
    ctx.shadowBlur = 10; ctx.shadowColor = p.colour;
    ctx.fillStyle = p.colour;
    NEON.draw.circle(ctx, sx, sy, p.size * (1 - p.life * 0.5 + 0.5));
  } else {
    ctx.fillStyle = p.colour;
    ctx.fillRect(sx - p.size/2, sy - p.size/2, p.size, p.size);
  }
  ctx.restore();
}

/**
 * @param {any} camX
 * @param {any} camY
 */
function drawParticles(camX, camY) {
  _drawCamX = camX;
  _drawCamY = camY;
  _particleSystem.forEach(_drawParticleCb);
}

// Release every live particle back to the pool (on floor change / game reset).
function clearParticles() {
  _particleSystem.clear();
}

// Expose live particle count for telemetry + debug overlay (replaces the
// pre-extraction `particles.length` global access from src/game.js).
function particleCount() {
  return _particleSystem.count;
}

// ─── Ambient Particles ───────────────────────────────────────────────────────
/** @type {any[]} */ const ambientParticles = [];
const AMB_CAP = 80;
const AMB_SPAWN_INTERVAL = 0.08; // seconds between spawn attempts
let ambSpawnTimer = 0;

/**
 * @param {any} dt
 */
function updateAmbient(dt) {
  // Update existing
  for (let i = ambientParticles.length - 1; i >= 0; i--) {
    const p = ambientParticles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt / p.maxLife;
    if (p.life <= 0) { ambientParticles.splice(i, 1); continue; }
    // Drift for dust motes
    if (p.kind === 'DUST') {
      p.vx += (Math.sin(p.seed + lastTime / 2000) * 3 - p.vx) * dt * 0.5;
      p.vy += (Math.cos(p.seed + lastTime / 1700) * 2 - p.vy) * dt * 0.5;
    }
  }

  // Spawn new particles
  ambSpawnTimer += dt;
  if (ambSpawnTimer < AMB_SPAWN_INTERVAL || ambientParticles.length >= AMB_CAP) {
    if (ambSpawnTimer >= AMB_SPAWN_INTERVAL) ambSpawnTimer = 0;
    return;
  }
  ambSpawnTimer = 0;

  const dungeon = _CG.dungeon;
  const player = _CG.player;
  if (!dungeon || !player) return;

  const cam = getCamera(player);
  const startX = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const startY = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const endX = Math.min(MAP_W, startX + Math.ceil(W / TILE) + 2);
  const endY = Math.min(MAP_H, startY + Math.ceil((H - layout.hudH) / TILE) + 2);
  const torchR = _CG.modifier === 'BLACKOUT' ? 5 : 9;
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);

  // Collect emitter candidates in visible range
  const emitters = [];
  for (let ty = startY; ty < endY; ty++) {
    for (let tx = startX; tx < endX; tx++) {
      if (!dungeon.visited[ty][tx]) continue;
      if (dungeon.secretMask[ty][tx]) continue;
      const tile = dungeon.map[ty][tx];
      // Only spawn on tiles currently in torch range (light never decays)
      const ddx = tx - ptx, ddy = ty - pty;
      if (ddx * ddx + ddy * ddy > torchR * torchR) continue;

      if (tile === T.FLOOR || tile === T.DOOR_OPEN) {
        if (Math.random() < 0.008) emitters.push({ kind: 'DUST', tx, ty });
      } else if (tile === T.PLASMA) {
        if (Math.random() < 0.15) emitters.push({ kind: 'EMBER', tx, ty });
      } else if (tile === T.ARC) {
        const arcActive = Math.sin((_CG.floorTime || 0) * Math.PI) > 0;
        if (arcActive && Math.random() < 0.12) emitters.push({ kind: 'ZAP', tx, ty });
      } else if (tile === T.CRACKED) {
        const pdx = tx - Math.floor(player.x), pdy = ty - Math.floor(player.y);
        if (pdx * pdx + pdy * pdy <= 16) {
          if (Math.random() < 0.06) emitters.push({ kind: 'STEAM', tx, ty });
        }
      } else if (tile === T.WALL) {
        if (_CG.sealedEntranceSet && _CG.sealedEntranceSet.has(ty * MAP_W + tx)) {
          if (Math.random() < 0.18) emitters.push({ kind: 'WISP', tx, ty });
        }
      }
    }
  }

  // Spawn from a few random emitters (budget-aware)
  const budget = AMB_CAP - ambientParticles.length;
  const count = Math.min(emitters.length, budget, 3);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * emitters.length);
    const e = /** @type {any} */ (emitters.splice(idx, 1)[0]);
    const cx = e.tx * TILE + rnd(2, TILE - 2);
    const cy = e.ty * TILE + rnd(2, TILE - 2);

    switch (e.kind) {
      case 'DUST': {
        // UNCHAINED #40: biome-tinted DUST colour (fallback to cyan palette).
        let dustPal = ['#66ddff','#aabbcc'];
        try {
          if (typeof NEON !== 'undefined' && NEON.biomes && typeof BIOME_PALETTES !== 'undefined') {
            const a = NEON.biomes.areaForFloor(_CG.floor);
            const bp = a && BIOME_PALETTES[a.palette];
            if (bp && Array.isArray(bp.dust) && bp.dust.length) dustPal = bp.dust;
          }
        } catch(_) {}
        const col = Math.random() < 0.5 ? dustPal[0] : dustPal[1 % dustPal.length];
        ambientParticles.push({
          kind: 'DUST', x: cx, y: cy,
          vx: rnd(-3, 3), vy: rnd(-3, 3),
          life: 1, maxLife: rnd(3, 6), size: rnd(1, 2.5),
          alpha: rnd(0.06, 0.18), colour: col,
          seed: Math.random() * 1000,
        });
        break;
      }
      case 'EMBER':
        ambientParticles.push({
          kind: 'EMBER', x: cx, y: cy,
          vx: rnd(-6, 6), vy: rnd(-25, -10),
          life: 1, maxLife: rnd(0.6, 1.2), size: rnd(1.5, 3),
          alpha: rnd(0.3, 0.6), colour: Math.random() < 0.5 ? '#ff6600' : '#ffaa33',
          seed: 0,
        });
        break;
      case 'ZAP':
        ambientParticles.push({
          kind: 'ZAP', x: cx, y: cy,
          vx: rnd(-15, 15), vy: rnd(-15, 15),
          life: 1, maxLife: rnd(0.08, 0.18), size: rnd(1, 2.5),
          alpha: rnd(0.5, 0.9), colour: '#88eeff',
          seed: 0,
        });
        break;
      case 'STEAM':
        ambientParticles.push({
          kind: 'STEAM', x: cx, y: cy - TILE * 0.3,
          vx: rnd(-2, 2), vy: rnd(-12, -5),
          life: 1, maxLife: rnd(1.0, 2.0), size: rnd(2, 4),
          alpha: rnd(0.06, 0.14), colour: '#8888aa',
          seed: 0,
        });
        break;
      case 'WISP':
        ambientParticles.push({
          kind: 'WISP', x: cx, y: cy,
          vx: rnd(-10, 10), vy: rnd(-10, 10),
          life: 1, maxLife: rnd(0.8, 1.8), size: rnd(2, 4),
          alpha: rnd(0.2, 0.45), colour: Math.random() < 0.6 ? '#ff3333' : '#ff6644',
          seed: Math.random() * 1000,
        });
        break;
    }
  }
}

/**
 * @param {any} camX
 * @param {any} camY
 */
function drawAmbient(camX, camY) {
  for (const p of ambientParticles) {
    const sx = p.x - camX, sy = p.y - camY;
    if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
    const a = p.alpha * Math.min(1, p.life * 2) * Math.min(1, (1 - p.life) * 3 + 0.3);
    if (a < 0.01) continue;
    ctx.save();
    ctx.globalAlpha = a;
    if (p.kind === 'ZAP') {
      ctx.shadowBlur = 6; ctx.shadowColor = p.colour;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    } else if (p.kind === 'WISP') {
      ctx.shadowBlur = 8; ctx.shadowColor = p.colour;
      ctx.fillStyle = p.colour;
      NEON.draw.circle(ctx, sx, sy, p.size * (0.5 + 0.5 * p.life));
    } else if (p.kind === 'EMBER') {
      ctx.fillStyle = p.colour;
      const flicker = 0.7 + 0.3 * Math.sin(lastTime / 60 + p.seed);
      ctx.globalAlpha = a * flicker;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    } else {
      ctx.fillStyle = p.colour;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }
}

// ─── Floating Damage Numbers ─────────────────────────────────────────────────
/** @type {any[]} */ const floatingTexts = [];
/**
 * @param {any} wx
 * @param {any} wy
 * @param {any} text
 * @param {any} colour
 */
function spawnDmgText(wx, wy, text, colour) {
  if (!settings.damageNumbers) return;
  if (floatingTexts.length >= 20) floatingTexts.shift();
  floatingTexts.push({
    x: wx * TILE + rnd(-6, 6), y: wy * TILE - 8,
    vy: -40, life: 1, text: String(text), colour
  });
}
/**
 * @param {any} dt
 */
function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const f = floatingTexts[i];
    f.y += f.vy * dt;
    f.vy *= Math.pow(0.35, dt);
    f.life -= dt * 1.4;
    if (f.life <= 0) floatingTexts.splice(i, 1);
  }
}
/**
 * @param {any} camX
 * @param {any} camY
 */
function drawFloatingTexts(camX, camY) {
  for (const f of floatingTexts) {
    const sx = f.x - camX, sy = f.y - camY;
    if (sx < -40 || sx > W + 40 || sy < -20 || sy > H + 20) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.shadowBlur = 6; ctx.shadowColor = f.colour;
    ctx.fillStyle = f.colour;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, sx, sy);
    ctx.restore();
  }
}

// ─── Screen Shake ────────────────────────────────────────────────────────────
const shake = { intensity: 0, timer: 0, ox: 0, oy: 0 };
/**
 * @param {any} intensity
 * @param {any} duration
 */
function triggerShake(intensity, duration = 0.25) {
  if (!settings.screenShake) return;
  if (intensity > shake.intensity) {
    shake.intensity = intensity;
    shake.timer = duration;
  }
}
/**
 * @param {any} dt
 */
function updateShake(dt) {
  if (!settings.screenShake || shake.timer <= 0) { shake.intensity = 0; shake.timer = 0; shake.ox = shake.oy = 0; return; }
  shake.timer -= dt;
  const t = Math.max(0, shake.timer);
  const mag = shake.intensity * (t / 0.25);  // decay linearly
  shake.ox = (Math.random() * 2 - 1) * mag;
  shake.oy = (Math.random() * 2 - 1) * mag;
  if (shake.timer <= 0) { shake.intensity = 0; shake.ox = shake.oy = 0; }
}

// ─── Status Effect Indicators ────────────────────────────────────────────────
// Low-HP danger vignette (red pulsing edge glow at ≤25% HP)
/**
 * @param {any} player
 */
function drawDangerVignette(player) {
  const frac = player.hp / player.maxHp;
  if (frac > 0.25 || player.hp <= 0) return;
  // Intensity: 0 at 25% → 1 at 0%. Pulse synced with lowHpTimer (2s cycle).
  const severity = 1 - (frac / 0.25);
  const pulse = 0.5 + 0.5 * Math.sin(player.lowHpTimer * Math.PI);
  const alpha = severity * (0.12 + 0.14 * pulse);
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, '#ff1a1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = '#ff1a1a';
  ctx.lineWidth = 3;
  ctx.shadowBlur = 15; ctx.shadowColor = '#ff1a1a';
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.restore();
}

// Floor modifier announcement banner (slides down on floor entry)
function drawModBanner() {
  const t = _CG.modBannerTimer;
  if (!t || t <= 0 || !_CG.modifier) return;
  const m = getMod();
  const dur = 3.0;
  const fadeIn = 0.3, fadeOut = 0.3;
  let alpha = 1;
  const elapsed = dur - t;
  if (elapsed < fadeIn) alpha = elapsed / fadeIn;
  else if (t < fadeOut) alpha = t / fadeOut;

  // Slide down from offscreen
  const slideY = elapsed < fadeIn ? -20 * (1 - elapsed / fadeIn) : (t < fadeOut ? -20 * (1 - t / fadeOut) : 0);
  const cy = 50 + safeTop + slideY;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background pill
  const narrow = layout.compact;
  const pillW = narrow ? Math.min(W - 40, 260) : 320;
  const pillH = narrow ? 32 : 40;
  const px = (W - pillW) / 2;
  const py = cy - pillH / 2;
  ctx.fillStyle = 'rgba(10,10,18,0.85)';
  ctx.beginPath();
  const r = 8;
  ctx.moveTo(px + r, py);
  ctx.lineTo(px + pillW - r, py);
  ctx.quadraticCurveTo(px + pillW, py, px + pillW, py + r);
  ctx.lineTo(px + pillW, py + pillH - r);
  ctx.quadraticCurveTo(px + pillW, py + pillH, px + pillW - r, py + pillH);
  ctx.lineTo(px + r, py + pillH);
  ctx.quadraticCurveTo(px, py + pillH, px, py + pillH - r);
  ctx.lineTo(px, py + r);
  ctx.quadraticCurveTo(px, py, px + r, py);
  ctx.fill();

  // Border glow
  ctx.shadowBlur = 12; ctx.shadowColor = m.colour;
  ctx.strokeStyle = m.colour; ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Icon + text
  const fs = narrow ? 11 : 13;
  ctx.font = `bold ${fs}px monospace`;
  ctx.fillStyle = m.colour; ctx.textAlign = 'center';
  const iconText = m.icon + ' ' + m.label;
  ctx.fillText(iconText, W / 2, cy - (narrow ? 1 : 3));

  if (!narrow) {
    ctx.font = '10px monospace';
    ctx.fillStyle = '#aaaacc';
    ctx.fillText(m.desc, W / 2, cy + 12);
  }

  // Dismiss hint — appears after the slide-in completes (per pause-on-level-text
  // behaviour added in PR #106, any new keypress / tap dismisses the banner).
  // Wait until elapsed > fadeIn so it doesn't flicker mid-slide.
  if (elapsed > fadeIn) {
    const hintAlpha = alpha * 0.5;
    if (hintAlpha > 0.01) {
      ctx.globalAlpha = hintAlpha;
      ctx.fillStyle = '#666677';
      ctx.font = `${narrow ? 8 : 9}px monospace`;
      ctx.fillText('press any key to skip', W / 2, py + pillH + (narrow ? 10 : 12));
    }
  }

  ctx.restore();
}

// Status effect badges — compact indicators above HUD bar
/** @type {Record<string, any>} */
const statusFx = {};
/**
 * @param {any} player
 */
function getStatusEffects(player) {
  const fx = [];
  // Floor modifier
  if (_CG.modifier) {
    const m = getMod();
    fx.push({ id: 'mod', icon: m.icon, label: m.label, colour: m.colour });
  }
  // Slow trap debuff
  if (player.speedTimer > 0 && player.speedBoost < 0) {
    fx.push({ id: 'slow', icon: '❄', label: 'SLOW', colour: '#6688cc', timer: player.speedTimer });
  }
  // Burn debuff (from enemy attacks)
  if (player.burnTimer > 0) {
    fx.push({ id: 'burn', icon: '🔥', label: player.burnTimer.toFixed(1)+'s', colour: '#ff6600' });
  }
  // Shock debuff (from enemy attacks). Show countdown so the player can
  // anticipate when input control returns — matches the burn timer pattern.
  if (player.shockTimer > 0) {
    fx.push({ id: 'shocked', icon: '⚡', label: player.shockTimer.toFixed(1)+'s', colour: '#ffee44' });
  }
  // Energy shield recharging
  if (player.perks.ENERGY_SHIELD && !player.energyShield) {
    fx.push({ id: 'shield', icon: '🛡', label: Math.ceil(player.energyShieldTimer) + 's', colour: '#4466aa' });
  }
  // Energy shield active
  if (player.perks.ENERGY_SHIELD && player.energyShield) {
    fx.push({ id: 'shield-up', icon: '🛡', label: 'UP', colour: '#4488ff' });
  }
  // Nano Regen (only show when actively healing)
  if ((player.upgrades.NANO_REGEN || 0) > 0 && player.hp < player.maxHp) {
    fx.push({ id: 'regen', icon: '♻', label: 'REGEN', colour: '#00ff88' });
  }
  // Dash cooldown
  if (player.dashCooldown > 0) {
    fx.push({ id: 'dash-cd', icon: '⇧', label: player.dashCooldown.toFixed(1) + 's', colour: '#7a6a33' });
  } else {
    fx.push({ id: 'dash', icon: '⇧', label: 'RDY', colour: '#ffb700' });
  }
  // Hackware cooldown
  if (player.hackware) {
    const hw = HACKWARE[player.hackware];
    if (player.hackwareCooldown > 0) {
      fx.push({ id: 'hw-cd', icon: hw.icon, label: player.hackwareCooldown.toFixed(1)+'s', colour: '#665533' });
    } else {
      fx.push({ id: 'hw-rdy', icon: hw.icon, label: 'RDY', colour: hw.colour });
    }
  }
  // Phase cloak active
  if (player.cloakTimer > 0) {
    fx.push({ id: 'cloak', icon: '◇', label: player.cloakTimer.toFixed(1)+'s', colour: '#cc44ff' });
  }
  // Berserker active (below 25% HP)
  if (player.perks.BERSERKER && player.hp > 0 && player.hp / player.maxHp <= 0.25) {
    fx.push({ id: 'berserker', icon: '🔥', label: 'RAGE', colour: '#ff4400' });
  }
  // Pristine active (at/above 90% HP) — high-HP mirror of Berserker.
  if (player.perks.PRISTINE && player.hp > 0 && player.hp / player.maxHp >= 0.90) {
    fx.push({ id: 'pristine', icon: '✧', label: 'PRIME', colour: '#88ffee' });
  }
  // Second Wind available
  if (player.perks.SECOND_WIND && !player.secondWindUsed) {
    fx.push({ id: 'second-wind', icon: '↺', label: 'LIFE', colour: '#00ddff' });
  }
  // Augment count
  const augCount = Object.keys(player.augments || {}).length;
  if (augCount > 0) {
    fx.push({ id: 'augments', icon: '◆', label: augCount + '/' + MAX_AUGMENTS, colour: '#cc44ff' });
  }
  // Adrenaline Injector speed buff active
  if (player.adrenalineTimer > 0) {
    fx.push({ id: 'adr-buff', icon: '💉', label: player.adrenalineTimer.toFixed(1)+'s', colour: '#ff4444' });
  }
  // Reactive Armor cooldown
  if (hasAugment('REACTIVE_ARMOR') && player.reactiveArmorCD > 0) {
    fx.push({ id: 'reactive-cd', icon: '💥', label: Math.ceil(player.reactiveArmorCD)+'s', colour: '#993322' });
  }
  // Disruption field debuff
  if (player.disruptionFieldActive) {
    fx.push({ id: 'disrupted', icon: '⊘', label: 'DISRUPTED', colour: '#ff44aa' });
  }
  // Toxic pool slow debuff — 30% movement penalty while standing in toxic.
  // Mirrors the disruption-field treatment so both ground-hazard slows are
  // visible to the player. Suppressed during dash since the slow is bypassed.
  // Use the exact same predicate as the movement gate (entities.js:8362
  // `dashTimer <= 0`) so the HUD never lies about whether the slow is live —
  // `!(x > 0)` and `x <= 0` diverge for NaN/undefined dashTimer.
  if (player.toxicSlowActive && player.dashTimer <= 0) {
    fx.push({ id: 'toxic-slow', icon: '☣', label: 'TOXIC', colour: '#88ff44' });
  }
  // Holo Decoy active
  if (hackwareEffects.some(f => f.type === 'hologram')) {
    const holo = hackwareEffects.find(f => f.type === 'hologram');
    fx.push({ id: 'holo-active', icon: '⬡', label: (holo.maxAge - holo.age).toFixed(1)+'s', colour: '#ff44ff' });
  }
  return fx;
}

/**
 * @param {any} player
 */
function drawStatusBar(player) {
  const effects = getStatusEffects(player);

  // Update statusFx state: fade in active, fade out inactive, cache render data
  const activeIds = new Set(effects.map(f => f.id));
  for (const fx of effects) {
    if (!statusFx[fx.id]) statusFx[fx.id] = { alpha: 0 };
    statusFx[fx.id].alpha = Math.min(1, statusFx[fx.id].alpha + 0.08);
    statusFx[fx.id].icon = fx.icon;
    statusFx[fx.id].label = fx.label;
    statusFx[fx.id].colour = fx.colour;
  }
  for (const id in statusFx) {
    if (!activeIds.has(id)) {
      statusFx[id].alpha = Math.max(0, statusFx[id].alpha - 0.08);
      if (statusFx[id].alpha <= 0) { delete statusFx[id]; continue; }
    }
  }

  const ids = Object.keys(statusFx);
  if (ids.length === 0) return;

  const hasKeys = player.keys.red + player.keys.blue + player.keys.gold > 0;
  const y = layout.hudTop - (hasKeys ? 32 : 16);
  const fs = layout.compact ? 8 : 9;
  const maxX = W - 130 - safeRight; // stop before minimap area
  let x = 14 + safeLeft;

  ctx.save();
  ctx.font = `${fs}px monospace`;

  for (const id of ids) {
    const s = statusFx[id];
    if (s.alpha <= 0) continue;
    const text = s.icon + (s.label ? ' ' + s.label : '');
    const tw = ctx.measureText(text).width;
    const badgeW = tw + 8;
    const badgeH = fs + 6;

    if (x + badgeW > maxX) break; // prevent overflow into minimap

    ctx.globalAlpha = s.alpha * 0.7;
    ctx.fillStyle = 'rgba(10,10,18,0.7)';
    ctx.fillRect(x, y - badgeH + 2, badgeW, badgeH);

    ctx.globalAlpha = s.alpha;
    ctx.shadowBlur = 4; ctx.shadowColor = s.colour;
    ctx.fillStyle = s.colour;
    ctx.fillText(text, x + 4, y);
    ctx.shadowBlur = 0;

    x += badgeW + 4;
  }

  ctx.restore();
}

// ─── Combo / Kill-Streak ─────────────────────────────────────────────────────
const combo = { count: 0, timer: 0, best: 0, flashTimer: 0 };
const COMBO_WINDOW    = 3;     // seconds between kills to maintain streak
const COMBO_STEP      = 0.25;  // multiplier increment per kill beyond first
const COMBO_MAX_MULT  = 4;     // hard cap on multiplier
const COMBO_BOSS_CAP  = 2;     // separate lower cap for boss kills
function comboMultiplier() {
  return combo.count < 2 ? 1 : Math.min(COMBO_MAX_MULT, 1 + (combo.count - 1) * COMBO_STEP);
}
function comboBossMultiplier() {
  return Math.min(COMBO_BOSS_CAP, comboMultiplier());
}
function comboColour() {
  const c = combo.count;
  if (c >= 11) return '#ff00c8';  // magenta
  if (c >= 8)  return '#ff6622';  // orange
  if (c >= 5)  return '#ffb700';  // yellow
  return '#00f5ff';               // cyan
}
/**
 * @param {any} isBoss
 */
function registerKill(isBoss) {
  combo.count++;
  combo.timer = COMBO_WINDOW;
  combo.flashTimer = 0.3;
  if (combo.count > combo.best) combo.best = combo.count;
  if (combo.count >= 2) audio.comboTick(combo.count);
  // milestone floating text at kill position
  if (combo.count === 5 || combo.count === 10 || combo.count === 15 || combo.count === 20) {
    const p = _CG.player;
    spawnDmgText(p.x, p.y - 0.5, `×${combo.count} COMBO!`, comboColour());
  }
}
/**
 * @param {any} dt
 */
function updateCombo(dt) {
  if (combo.count < 1) return;
  combo.timer -= dt;
  combo.flashTimer = Math.max(0, combo.flashTimer - dt);
  if (combo.timer <= 0) { combo.count = 0; combo.timer = 0; }
}

// ─── Dungeon Generator ───────────────────────────────────────────────────────
/** @returns {any} */
function createMap() {
  return Array.from({length: MAP_H}, () => new Uint8Array(MAP_W).fill(T.WALL));
}

/**
 * @param {any} map
 * @param {any} x
 * @param {any} y
 * @param {any} w
 * @param {any} h
 * @param {any} tile
 */
function carveRect(map, x, y, w, h, tile) {
  for (let ty=y; ty<y+h; ty++)
    for (let tx=x; tx<x+w; tx++)
      if (tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H) map[ty][tx]=tile;
}

/**
 * @param {any} map
 * @param {any} x1
 * @param {any} y1
 * @param {any} x2
 * @param {any} y2
 */
function carveCorridor(map, x1, y1, x2, y2) {
  let x=x1, y=y1;
  while (x!==x2) { map[y][x]=T.FLOOR; x += x<x2?1:-1; }
  while (y!==y2) { map[y][x]=T.FLOOR; y += y<y2?1:-1; }
}

class BSPNode {
  /**
   * @param {any} x
   * @param {any} y
   * @param {any} w
   * @param {any} h
   */
  constructor(x,y,w,h) { this.x=x; this.y=y; this.w=w; this.h=h; this.left=null; this.right=null; this.room=null; }
  /**
   * @param {any} depth
   */
  split(depth) {
    if (depth<=0 || (this.w<16 && this.h<16)) return;
    const horiz = this.h > this.w ? true : this.w > this.h ? false : Math.random()<0.5;
    if (horiz) {
      const split = rndInt(8, this.h-8);
      this.left  = new BSPNode(this.x, this.y, this.w, split);
      this.right = new BSPNode(this.x, this.y+split, this.w, this.h-split);
    } else {
      const split = rndInt(8, this.w-8);
      this.left  = new BSPNode(this.x, this.y, split, this.h);
      this.right = new BSPNode(this.x+split, this.y, this.w-split, this.h);
    }
    this.left.split(depth-1);
    this.right.split(depth-1);
  }
  /** @returns {any[]} */
  getLeaves() {
    if (!this.left && !this.right) return [this];
    return [...(this.left?.getLeaves()??[]), ...(this.right?.getLeaves()??[])];
  }
  /**
   * @param {any} map
   */
  carveRooms(map) {
    if (!this.left && !this.right) {
      const rw = rndInt(5, Math.max(6,this.w-2));
      const rh = rndInt(5, Math.max(6,this.h-2));
      const rx = this.x + rndInt(1, Math.max(2,this.w-rw-1));
      const ry = this.y + rndInt(1, Math.max(2,this.h-rh-1));
      this.room = {x:rx, y:ry, w:rw, h:rh,
        cx: Math.floor(rx+rw/2), cy: Math.floor(ry+rh/2)};
      carveRect(map, rx, ry, rw, rh, T.FLOOR);
      return;
    }
    this.left?.carveRooms(map);
    this.right?.carveRooms(map);
    const lr = this.left?.getRoom();
    const rr = this.right?.getRoom();
    if (lr && rr) carveCorridor(map, lr.cx, lr.cy, rr.cx, rr.cy);
  }
  /** @returns {any} */
  getRoom() {
    if (this.room) return this.room;
    const l = this.left?.getRoom(), r = this.right?.getRoom();
    if (!l) return r; if (!r) return l;
    return Math.random()<0.5?l:r;
  }
}

/**
 * @param {any} rooms
 * @param {any} startRoom
 * @param {any} map
 */
function bfsRooms(rooms, startRoom, map) {
  const dist = new Map();
  const q = [startRoom];
  dist.set(startRoom, 0);
  while (q.length) {
    const cur = q.shift();
    for (const other of rooms) {
      if (dist.has(other)) continue;
      if (hasLOS(cur.cx, cur.cy, other.cx, other.cy, map) ||
          dist2(cur.cx,cur.cy,other.cx,other.cy) < 400) {
        dist.set(other, dist.get(cur)+1);
        q.push(other);
      }
    }
  }
  return dist;
}

/**
 * @param {any} floorNum
 */
function generateFloor(floorNum) {
  const map = createMap();
  const root = new BSPNode(0,0,MAP_W,MAP_H);
  root.split(5);
  root.carveRooms(map);
  const rooms = root.getLeaves().map((/** @type {any} */ l)=>l.room).filter(Boolean);

  // Pick spawn room — try several candidates and pick the one that maximizes
  // BFS distance to the farthest room (ensures exit is far from spawn).
  let spawnRoom = rooms[0];
  if (rooms.length > 3) {
    const candidates = [];
    for (let ci = 0; ci < Math.min(rooms.length, 6); ci++) candidates.push(rooms[ci]);
    // Also try a random room for variety
    candidates.push(rooms[rndInt(0, rooms.length - 1)]);
    let bestMaxD = 0;
    for (const c of candidates) {
      const cd = bfsRooms(rooms, c, map);
      let cMax = 0;
      for (const [,dd] of cd) { if (dd > cMax) cMax = dd; }
      if (cMax > bestMaxD) { bestMaxD = cMax; spawnRoom = c; }
    }
  }
  const playerPos = { x: spawnRoom.cx + 0.5, y: spawnRoom.cy + 0.5 };

  // Furthest room from spawn for stairs
  const dist = bfsRooms(rooms, spawnRoom, map);
  let farthest = spawnRoom, farthestD = 0;
  for (const [r,d] of dist) { if (d>farthestD) { farthestD=d; farthest=r; } }
  const _finalFloor = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.finalFloor) ? NEON.biomes.finalFloor() : 15;
  const _isBossFloor = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.isBiomeBossFloor) ? NEON.biomes.isBiomeBossFloor(floorNum) : (floorNum===3||floorNum===6||floorNum===10);
  map[farthest.cy][farthest.cx] = floorNum>=_finalFloor ? T.TERMINAL : T.STAIRS;

  // boss room on biome-final floors (3,6,9,12,15 for the 5-biome arc)
  /** @type {any} */ let bossRoom = null;
  /** @type {any[]} */ let bossEntrances = [];
  if (_isBossFloor) {
    // use the room furthest from spawn that isn't the stair room
    let br = null, bd = 0;
    for (const [r,d] of dist) {
      if (r===farthest) continue;
      if (d>bd) { bd=d; br=r; }
    }
    bossRoom = br || rooms[Math.floor(rooms.length/2)];

    // Enforce minimum boss room size (15×15) by expanding if needed
    const MIN_BOSS = 15;
    if (bossRoom.w < MIN_BOSS || bossRoom.h < MIN_BOSS) {
      const nw = Math.max(bossRoom.w, MIN_BOSS);
      const nh = Math.max(bossRoom.h, MIN_BOSS);
      // centre the expansion on the current room centre, clamped to map
      let nx = Math.max(1, Math.min(MAP_W - nw - 1, bossRoom.cx - Math.floor(nw/2)));
      let ny = Math.max(1, Math.min(MAP_H - nh - 1, bossRoom.cy - Math.floor(nh/2)));
      // Clamp so the expanded rect doesn't overlap neighboring rooms.
      // Leave a 1-tile wall gap so the fence boundary stays clean.
      // Iterate until stable — a push away from one room could re-overlap another.
      for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        for (const r of rooms) {
          if (r === bossRoom) continue;
          const ox1 = nx - 1, oy1 = ny - 1, ox2 = nx + nw + 1, oy2 = ny + nh + 1;
          const rx1 = r.x, ry1 = r.y, rx2 = r.x + r.w, ry2 = r.y + r.h;
          if (!(ox1 < rx2 && ox2 > rx1 && oy1 < ry2 && oy2 > ry1)) continue;
          // Push boss rect away from overlapping room on the closer axis
          const pushLeft = rx1 - nw - 1, pushRight = rx2 + 1;
          const pushUp = ry1 - nh - 1, pushDown = ry2 + 1;
          if (bossRoom.cx >= r.cx && pushRight <= MAP_W - nw - 1) { nx = Math.max(nx, pushRight); moved = true; }
          else if (pushLeft >= 1) { nx = Math.min(nx, pushLeft); moved = true; }
          if (bossRoom.cy >= r.cy && pushDown <= MAP_H - nh - 1) { ny = Math.max(ny, pushDown); moved = true; }
          else if (pushUp >= 1) { ny = Math.min(ny, pushUp); moved = true; }
        }
        if (!moved) break;
      }
      // Final map-bounds clamp after push
      nx = Math.max(1, Math.min(MAP_W - nw - 1, nx));
      ny = Math.max(1, Math.min(MAP_H - nh - 1, ny));
      bossRoom.x = nx; bossRoom.y = ny; bossRoom.w = nw; bossRoom.h = nh;
      bossRoom.cx = Math.floor(nx + nw/2); bossRoom.cy = Math.floor(ny + nh/2);
      carveRect(map, nx, ny, nw, nh, T.FLOOR);
      // re-carve corridors to this room from neighbours
      for (const r of rooms) {
        if (r === bossRoom) continue;
        const dx = Math.abs(r.cx - bossRoom.cx), dy = Math.abs(r.cy - bossRoom.cy);
        if (dx < 20 && dy < 20) carveCorridor(map, r.cx, r.cy, bossRoom.cx, bossRoom.cy);
      }
      // Re-place stairs/terminal in case expansion overwrote it
      map[farthest.cy][farthest.cx] = floorNum>=_finalFloor ? T.TERMINAL : T.STAIRS;
    }

    // Record entrance tiles: floor tiles on the boss room boundary that
    // connect to a CORRIDOR tile (not the interior of another adjacent
    // room). Without the corridor check, when the boss room shares a
    // boundary with another room (no carved-corridor gap between them),
    // every shared boundary tile would be sealed to WALL on boss-spawn —
    // putting walls INSIDE the neighbouring room and trapping the player
    // against them (reported by user 2026-04-20 b95c0573: 'the fence that
    // surrounds a boss should not leave a room's boundary. It went into
    // another room and trapped me against a wall').
    //
    // Both the boundary tile AND its outside neighbour must NOT be inside
    // another room — boundary check catches overlapping-rect gen edge
    // cases (where the boundary tile itself is shared); outside check
    // catches abutting-rooms (most common case).
    const rx=bossRoom.x, ry=bossRoom.y, rw=bossRoom.w, rh=bossRoom.h;
    /** @param {number} px @param {number} py */
    const isInsideAnotherRoom = (px, py) => {
      for (const r of rooms) {
        if (r === bossRoom) continue;
        if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return true;
      }
      return false;
    };
    /** Filtered + safe scan — both edge tile and outside tile must be
     *  outside any other room. */
    const _scanFiltered = () => {
      /** @type {Array<{x:number,y:number}>} */
      const out = [];
      for (let tx=rx; tx<rx+rw; tx++) {
        if (ry>0 && map[ry][tx]===T.FLOOR && map[ry-1][tx]===T.FLOOR
            && !isInsideAnotherRoom(tx, ry) && !isInsideAnotherRoom(tx, ry-1))
          out.push({x:tx, y:ry});
        const by=ry+rh-1;
        if (by<MAP_H-1 && map[by][tx]===T.FLOOR && map[by+1][tx]===T.FLOOR
            && !isInsideAnotherRoom(tx, by) && !isInsideAnotherRoom(tx, by+1))
          out.push({x:tx, y:by});
      }
      for (let ty=ry; ty<ry+rh; ty++) {
        if (rx>0 && map[ty][rx]===T.FLOOR && map[ty][rx-1]===T.FLOOR
            && !isInsideAnotherRoom(rx, ty) && !isInsideAnotherRoom(rx-1, ty))
          out.push({x:rx, y:ty});
        const bx=rx+rw-1;
        if (bx<MAP_W-1 && map[ty][bx]===T.FLOOR && map[ty][bx+1]===T.FLOOR
            && !isInsideAnotherRoom(bx, ty) && !isInsideAnotherRoom(bx+1, ty))
          out.push({x:bx, y:ty});
      }
      return out;
    };
    /** Unfiltered fallback — original logic, keeps lock-arena mechanic
     *  working even in the degenerate case where the boss room only
     *  shares boundaries with other rooms (no corridor entrance). The
     *  re-carve loop at L2198-2202 makes this near-impossible in
     *  practice but the fallback is here for safety: the lesser evil
     *  is the original cosmetic bug (wall poking into neighbour) vs
     *  losing boss arena lockout entirely. */
    const _scanUnfiltered = () => {
      /** @type {Array<{x:number,y:number}>} */
      const out = [];
      for (let tx=rx; tx<rx+rw; tx++) {
        if (ry>0 && map[ry][tx]===T.FLOOR && map[ry-1][tx]===T.FLOOR) out.push({x:tx, y:ry});
        const by=ry+rh-1;
        if (by<MAP_H-1 && map[by][tx]===T.FLOOR && map[by+1][tx]===T.FLOOR) out.push({x:tx, y:by});
      }
      for (let ty=ry; ty<ry+rh; ty++) {
        if (rx>0 && map[ty][rx]===T.FLOOR && map[ty][rx-1]===T.FLOOR) out.push({x:rx, y:ty});
        const bx=rx+rw-1;
        if (bx<MAP_W-1 && map[ty][bx]===T.FLOOR && map[ty][bx+1]===T.FLOOR) out.push({x:bx, y:ty});
      }
      return out;
    };
    const filtered = _scanFiltered();
    const chosen = filtered.length > 0 ? filtered : _scanUnfiltered();
    for (const e of chosen) bossEntrances.push(e);
    // Deduplicate — corners scanned by both edge loops cause permanent seal bug
    const seen = new Set();
    bossEntrances = bossEntrances.filter(e => {
      const k = e.x + ',' + e.y;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  // lights
  const lights = [];
  for (const r of rooms) {
    lights.push({x:r.x+1,y:r.y+1});
    lights.push({x:r.x+r.w-2,y:r.y+r.h-2});
  }

  // fog of war
  /** @type {any} */ const visited = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));
  /** @type {any} */ const light   = Array.from({length:MAP_H},()=>new Float32Array(MAP_W));
  /** @type {any} */ const visible = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));

  // ── Room types: assign special purposes ──────────────────────────────────
  // Types: null (normal), 'armory', 'medbay', 'shrine', 'vault'
  const ROOM_TYPES = ['armory','medbay','shrine','vault'];
  /** @type {Record<string, any>} */ const ROOM_COLOURS = {armory:'#2a1a10',medbay:'#0a1a15',shrine:'#1a0a20',vault:'#1a1a05',vendor:'#0a1a0f',secret:'#1a1005',challenge:'#1a0a0a',implant:'#0f0a1a',event:'#0a1a1a'};
  /** @type {any[]} */ const specialRooms = [];
  const eligible = rooms.filter((/** @type {any} */ r) => r!==spawnRoom && r!==farthest && r!==bossRoom && r.w*r.h>=20);

  // ── Vendor room (floor 2+, one per non-boss floor) — reserved first ─────
  /** @type {any} */ let vendorRoom = null;
  if (floorNum >= 2 && !bossRoom) {
    const vendorEligible = eligible.filter((/** @type {any} */ r) => r.w >= 5 && r.h >= 5);
    if (vendorEligible.length > 0) {
      vendorRoom = vendorEligible[rndInt(0, vendorEligible.length - 1)];
      vendorRoom.roomType = 'vendor';
      specialRooms.push(vendorRoom);
      map[vendorRoom.cy][vendorRoom.cx] = T.VENDOR;
    }
  }

  // ── Special room rotation (excluding vendor room) ───────────────────────
  const specialEligible = eligible.filter((/** @type {any} */ r) => r !== vendorRoom);
  const numSpecial = Math.min(specialEligible.length, Math.floor(floorNum/2)+1);
  const picked = specialEligible.sort(()=>Math.random()-0.5).slice(0,numSpecial);
  for (let i=0; i<picked.length; i++) {
    const r = picked[i];
    r.roomType = ROOM_TYPES[i % ROOM_TYPES.length];
    specialRooms.push(r);
  }

  // ── Doors: place at room-corridor junctions (chokepoints only) ──────────
  // Helper: find entrance clusters for a room (groups of adjacent boundary tiles
  // connecting to corridors). Returns array of arrays.
  /**
   * @param {any} room
   */
  function getEntranceClusters(room) {
    const edges = [];
    const isEntry = (/** @type {any} */ t) => t===T.FLOOR||t===T.DOOR;
    for (let tx=room.x; tx<room.x+room.w; tx++) {
      if (room.y>0 && isEntry(map[room.y][tx]) && map[room.y-1][tx]===T.FLOOR) edges.push({x:tx, y:room.y});
      const by=room.y+room.h-1;
      if (by<MAP_H-1 && isEntry(map[by][tx]) && map[by+1][tx]===T.FLOOR) edges.push({x:tx, y:by});
    }
    for (let ty=room.y; ty<room.y+room.h; ty++) {
      if (room.x>0 && isEntry(map[ty][room.x]) && map[ty][room.x-1]===T.FLOOR) edges.push({x:room.x, y:ty});
      const bx=room.x+room.w-1;
      if (bx<MAP_W-1 && isEntry(map[ty][bx]) && map[ty][bx+1]===T.FLOOR) edges.push({x:bx, y:ty});
    }
    // Deduplicate
    const seen = new Set();
    const dedup = edges.filter(e => { const k=e.x+','+e.y; if(seen.has(k)) return false; seen.add(k); return true; });
    // Cluster adjacent tiles
    const used = new Set();
    const clusters = [];
    for (const e of dedup) {
      const k = e.x+','+e.y;
      if (used.has(k)) continue;
      const cl = [e]; used.add(k);
      let qi = 0;
      while (qi < cl.length) {
        const c = /** @type {any} */ (cl[qi++]);
        for (const o of dedup) {
          const ok = o.x+','+o.y;
          if (used.has(ok)) continue;
          if (Math.abs(c.x-o.x)+Math.abs(c.y-o.y)===1) { cl.push(o); used.add(ok); }
        }
      }
      clusters.push(cl);
    }
    return clusters;
  }

  for (const r of rooms) {
    if (r === bossRoom) continue;
    const clusters = getEntranceClusters(r);
    // Only door narrow clusters (1-2 tiles = real chokepoints)
    for (const cl of clusters) {
      if (cl.length <= 2 && Math.random() < 0.5) {
        for (const e of cl) map[e.y][e.x] = T.DOOR;
      }
    }
  }

  // ── Locked doors + keys (floor 2+) ──────────────────────────────────────
  // Lock meaningful targets: stair room first, then special rooms, then random.
  // All narrow entrance clusters of the target room are locked so the room
  // is truly gated (no walking around a single locked tile).
  const keyItems = [];
  if (floorNum >= 2) {
    // Build priority list: stair room > special rooms > eligible randoms
    const lockPriority = [];
    if (farthest !== spawnRoom && farthest !== bossRoom) lockPriority.push(farthest);
    for (const r of specialRooms) {
      if (!lockPriority.includes(r) && r.roomType !== 'vendor' && r.roomType !== 'secret') lockPriority.push(r);
    }
    const fallback = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && r !== bossRoom &&
      !specialRooms.includes(r) && r.w * r.h >= 20
    );
    lockPriority.push(...fallback.sort(() => Math.random()-0.5));

    const numLocked = floorNum >= 7 ? 3 : floorNum >= 4 ? 2 : 1;
    const colours = ['red','blue','gold'];
    const lockTiles = [T.LOCKED_R, T.LOCKED_B, T.LOCKED_G];
    const lockColours = ['#ff3333','#3388ff','#ffcc00'];
    let placed = 0;

    for (const lr of lockPriority) {
      if (placed >= numLocked) break;
      const ci = Math.min(placed, 2);
      // Get entrance clusters and lock ALL narrow ones (size ≤ 2)
      const cls = getEntranceClusters(lr);
      const narrowClusters = cls.filter(cl => cl.length <= 2);
      if (!narrowClusters.length) continue; // can't meaningfully gate this room

      // Convert every tile in every narrow cluster to a locked door
      const lockedTiles = [];
      for (const cl of narrowClusters) {
        for (const e of cl) {
          map[e.y][e.x] = lockTiles[ci];
          lockedTiles.push(e);
        }
      }
      // Wide clusters (>2): wall them off to prevent bypass
      for (const cl of cls) {
        if (cl.length > 2) {
          for (const e of cl) map[e.y][e.x] = T.WALL;
        }
      }

      // BFS from spawn to find rooms reachable without this lock
      const q2 = [{x:spawnRoom.cx, y:spawnRoom.cy}];
      /** @type {any} */ const vis2 = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));
      vis2[spawnRoom.cy][spawnRoom.cx] = 1;
      while (q2.length) {
        const {x:cx,y:cy} = /** @type {{x:any,y:any}} */ (q2.shift());
        for (const [ddx,ddy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
          const nx2=cx+ddx, ny2=cy+ddy;
          if (nx2<0||ny2<0||nx2>=MAP_W||ny2>=MAP_H||vis2[ny2][nx2]) continue;
          const t=map[ny2][nx2];
          if (t===T.WALL||t===T.VOID||t===T.CRACKED||t===T.LOCKED_R||t===T.LOCKED_B||t===T.LOCKED_G) continue;
          vis2[ny2][nx2]=1;
          q2.push({x:nx2,y:ny2});
        }
      }
      // Find a reachable room to place the key
      const keyRoom = rooms.filter((/** @type {any} */ r) => r!==lr && r!==bossRoom && vis2[r.cy][r.cx]);
      if (keyRoom.length) {
        const kr = keyRoom[rndInt(0, keyRoom.length-1)];
        keyItems.push({ x: kr.cx, y: kr.cy, colour: colours[ci], tileColour: lockColours[ci] });
        lr.hasLoot = true;
        placed++;
      } else {
        // Can't safely place key — revert locks and walls to floor
        for (const e of lockedTiles) map[e.y][e.x] = T.FLOOR;
        for (const cl of cls) {
          if (cl.length > 2) {
            for (const e of cl) map[e.y][e.x] = T.FLOOR;
          }
        }
      }
    }
  }

  // ── Secret room (every floor, one per floor) ─────────────────────────────
  const secretRooms = [];
  /** @type {any[]} */ const whisperItems = [];
  {
    // Candidates: not spawn, not stair, not boss, not already special, decent size
    const secretEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && r !== bossRoom && !r.roomType && r.w * r.h >= 20
    );
    // Shuffle and try to find one with a narrow entrance cluster
    const shuffled = secretEligible.sort(() => Math.random() - 0.5);
    for (const r of shuffled) {
      const cls = getEntranceClusters(r);
      const narrow = cls.filter(cl => cl.length <= 2);
      if (!narrow.length) continue; // no narrow entrance → skip

      r.roomType = 'secret';
      r.secretRevealed = false;
      specialRooms.push(r);
      secretRooms.push(r);

      // Wall off ALL entrances
      for (const cl of cls) {
        for (const e of cl) map[e.y][e.x] = T.WALL;
      }
      // Place T.CRACKED at one narrow cluster (the "hidden entrance")
      const crackedCluster = /** @type {any} */ (narrow[rndInt(0, narrow.length - 1)]);
      for (const e of crackedCluster) map[e.y][e.x] = T.CRACKED;

      // Whispers subplot — narrative fragments found in secret rooms.
      // Try to spawn one whisper item at the secret room's center. NEON.whispers
      // returns null if no eligible unread whisper for this floor's biome, in
      // which case the secret room still rewards the player with normal loot
      // (the per-room loot pass at render.js handles that). Try/catch keeps
      // gen resilient if the meta module isn't loaded yet (e.g. early Node
      // tests of generateFloor).
      try {
        if (typeof NEON !== 'undefined' && NEON.whispers && NEON.whispers.pickWhisperForFloor) {
          const w = NEON.whispers.pickWhisperForFloor(floorNum);
          if (w && w.id) {
            whisperItems.push({ x: r.cx + 0.5, y: r.cy + 0.5, whisperId: w.id });
          }
        }
      } catch (_) { /* gen-time meta unavailable; skip whisper this floor */ }

      break; // only one secret room per floor
    }
  }

  // ── Challenge Room (floor 2+, non-boss): optional wave-based arena ─────
  /** @type {any} */ let challengeRoom = null;
  const challengeEntrances = [];
  if (floorNum >= 2 && !bossRoom) {
    const challengeEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 30
    );
    const shuffledCh = challengeEligible.sort(() => Math.random() - 0.5);
    for (const r of shuffledCh) {
      const cls = getEntranceClusters(r);
      // Only pick rooms where ALL entrance clusters are narrow (≤2 tiles)
      if (cls.length === 0) continue;
      if (cls.some(cl => cl.length > 2)) continue;
      r.roomType = 'challenge';
      challengeRoom = r;
      specialRooms.push(r);
      // Replace entrance tiles with challenge gates
      for (const cl of cls) {
        for (const e of cl) {
          map[e.y][e.x] = T.CHALLENGE_GATE;
          challengeEntrances.push({ x: e.x, y: e.y });
        }
      }
      break; // one per floor
    }
  }

  // ── Implant Room (floor 2+, non-boss, ~50% chance): augment shrine ─────
  /** @type {any} */ let implantRoom = null;
  if (floorNum >= 2 && !bossRoom && Math.random() < 0.5) {
    const implantEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 16
    );
    if (implantEligible.length > 0) {
      implantRoom = implantEligible[rndInt(0, implantEligible.length - 1)];
      implantRoom.roomType = 'implant';
      specialRooms.push(implantRoom);
      map[implantRoom.cy][implantRoom.cx] = T.IMPLANT_SHRINE;
    }
  }

  // ── Event Room (floor 2+, non-boss): risk/reward encounter terminal ───
  /** @type {any} */ let eventRoom = null;
  if (floorNum >= 2 && !bossRoom) {
    const eventEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 16
    );
    if (eventEligible.length > 0) {
      eventRoom = eventEligible[rndInt(0, eventEligible.length - 1)];
      eventRoom.roomType = 'event';
      specialRooms.push(eventRoom);
      map[eventRoom.cy][eventRoom.cx] = T.EVENT_TERMINAL;
    }
  }

  // ── Prune dead-end corridor tiles ─────────────────────────────────────
  // After secret rooms, locked doors, and challenge rooms wall off entrances,
  // some corridor segments become dead ends (floor tile with only 1 passable
  // neighbour that isn't inside any room). Iteratively fill them so players
  // never walk down a tunnel to nowhere.
  {
    // Build room membership lookup
    /** @type {any} */ const inRoom = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
    for (const r of rooms) {
      for (let ty = r.y; ty < r.y + r.h; ty++)
        for (let tx = r.x; tx < r.x + r.w; tx++)
          if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) inRoom[ty][tx] = 1;
    }
    let pruned = true;
    const connects = (/** @type {any} */ t) => t !== T.WALL && t !== T.VOID; // doors/locks/cracked all count
    while (pruned) {
      pruned = false;
      for (let y = 1; y < MAP_H - 1; y++) {
        for (let x = 1; x < MAP_W - 1; x++) {
          if (map[y][x] !== T.FLOOR || inRoom[y][x]) continue;
          let adj = 0;
          if (connects(map[y-1][x])) adj++;
          if (connects(map[y+1][x])) adj++;
          if (connects(map[y][x-1])) adj++;
          if (connects(map[y][x+1])) adj++;
          if (adj <= 1) { map[y][x] = T.WALL; pruned = true; }
        }
      }
    }
  }

  // ── All-rooms reachability gate (key-cascade BFS) ──────────────────────
  // Goal: from spawn, the player must be able to reach EVERY room — not just
  // the stairs. Special rooms (vendor / lore / event terminal / shrine /
  // challenge) host gameplay-critical interactions; if any becomes unreachable
  // due to lock placement + later passes (secret rooms, dead-end pruning), the
  // floor feels broken even when technically completable.
  //
  // User reports on floor 3 (twice on 2026-04-25 / 6bc2e985):
  //   "spawned into a room with the exit and a red key door, but no red key,
  //    so I can't explore the floor or fight the miniboss"
  //
  // The previous fix only checked KEY-item reachability and missed the case
  // where a key is reachable but the rooms it would unlock are still gated
  // behind ANOTHER unreachable lock (multi-color cascades) or the key is
  // simply absent for a placed lock (lockPriority/keyRoom empty edge cases).
  //
  // Algorithm:
  //   1. BFS from spawn through `passable` tiles + locks of any colour for
  //      which a reachable key exists. Iterate until fixed point (each pass
  //      may discover new keys, which open new locks, exposing more keys).
  //   2. If any room has zero reachable tiles after fixed point, downgrade
  //      every locked door whose colour the player COULDN'T pick up. The
  //      floor loses some gating gameplay but every room becomes reachable.
  //   3. If rooms are still unreachable (e.g. structurally walled by gen),
  //      the rescue-corridor pass below carves spawn→stairs as a last resort.
  //
  // Tile vocabulary kept in sync with src/platform.js isPassable() so this
  // gen-time reachability matches what the player actually experiences. The
  // notable additions over the prior fix are T.PLASMA, T.ARC (walkable
  // hazards — runtime isPassable allows them, the prior gen-time check did
  // not) and T.CRACKED (interact-breakable per game.js:663,1691 — secret
  // rooms ARE reachable to the player without keys/upgrades, so they should
  // count as reachable here too). T.DOOR (closed) stays passable because the
  // player can open closed doors via interact; that diverges from runtime
  // isPassable but is intentional (matches dungeon-gen connectivity intent).
  {
    const passable = (/** @type {any} */ t) =>
      t === T.FLOOR || t === T.DOOR || t === T.DOOR_OPEN ||
      t === T.STAIRS || t === T.TERMINAL ||
      t === T.TRAP_SPIKE || t === T.TRAP_SLOW || t === T.TOXIC ||
      t === T.PLASMA || t === T.ARC ||
      t === T.CRACKED ||
      t === T.VENDOR || t === T.LORE || t === T.TELEPORT_PAD ||
      t === T.IMPLANT_SHRINE || t === T.EVENT_TERMINAL ||
      t === T.CHALLENGE_GATE;

    /** @param {Set<string>} haveColours @returns {Uint8Array[]} */
    const computeReach = (haveColours) => {
      /** @type {any} */ const r = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
      const sx0 = spawnRoom.cx, sy0 = spawnRoom.cy;
      r[sy0][sx0] = 1;
      const q = [{x: sx0, y: sy0}];
      while (q.length) {
        const {x: cx, y: cy} = /** @type {{x:any,y:any}} */ (q.shift());
        for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
          if (r[ny][nx]) continue;
          const t = map[ny][nx];
          const open = passable(t) ||
            (haveColours.has('red')  && t === T.LOCKED_R) ||
            (haveColours.has('blue') && t === T.LOCKED_B) ||
            (haveColours.has('gold') && t === T.LOCKED_G);
          if (!open) continue;
          r[ny][nx] = 1;
          q.push({x: nx, y: ny});
        }
      }
      return r;
    };

    /** @type {Set<string>} */ const haveColours = new Set();
    /** @type {any} */ let reach = null;
    let progressIter = true;
    let safetyIter = 6; // hard cap (3 colours × 2 = 6 expansion rounds max)
    while (progressIter && safetyIter-- > 0) {
      progressIter = false;
      reach = computeReach(haveColours);
      for (const ki of keyItems) {
        if (ki && ki.colour && reach[ki.y][ki.x] && !haveColours.has(ki.colour)) {
          haveColours.add(/** @type {string} */ (ki.colour));
          progressIter = true;
        }
      }
    }
    // After fixed point, `reach` reflects max possible exploration with all
    // collectible keys. Check every room for at least one reachable tile.
    /** @param {{x:number,y:number,w:number,h:number,cx:number,cy:number}} room */
    const roomTouchesReach = (room) => {
      // Cheap-path: spot-check center first (most rooms).
      if (reach[room.cy] && reach[room.cy][room.cx]) return true;
      // Full-path: scan room rect (tiles set to special types may not be
      // at center; e.g. vendor tile, lore terminal).
      for (let yy = room.y; yy < room.y + room.h; yy++) {
        const row = reach[yy];
        if (!row) continue;
        for (let xx = room.x; xx < room.x + room.w; xx++) {
          if (row[xx]) return true;
        }
      }
      return false;
    };
    // Cracked walls are now in passable() (interact-breakable). Secret rooms
    // become naturally reachable through them, so no special exclusion is
    // needed in the unreachable filter.
    const unreachable = rooms.filter((/** @type {any} */ r) => !roomTouchesReach(r));
    if (unreachable.length > 0) {
      // Downgrade every locked door whose colour the player couldn't pick up.
      // This includes colours with no key item placed at all (the
      // lockPriority/keyRoom empty-fallback edge case in the lock-placement
      // loop above).
      const lockTileForColour = { red: T.LOCKED_R, blue: T.LOCKED_B, gold: T.LOCKED_G };
      for (const colour of /** @type {const} */ (['red', 'blue', 'gold'])) {
        if (haveColours.has(colour)) continue;
        const lt = lockTileForColour[colour];
        for (let y = 0; y < MAP_H; y++) {
          for (let x = 0; x < MAP_W; x++) {
            if (map[y][x] === lt) map[y][x] = T.FLOOR;
          }
        }
      }
      // After downgrading, recompute reach (no longer gated by missing keys).
      reach = computeReach(new Set(['red', 'blue', 'gold']));
      // Any rooms STILL unreachable are walled off structurally (secret room
      // boundaries, dead-end pruning that nuked the only corridor). The
      // rescue-corridor pass below handles spawn→stairs; non-stairs special
      // rooms still unreachable here will be quietly orphaned (acceptable
      // edge case; alternative would be to carve more rescue corridors,
      // which risks visual oddities). Telemetry could surface this in a
      // future pass.
    }
  }

  // ── Reachability guarantee: spawn → stairs must always be connected ────
  // BFS from spawn across all non-wall/void tiles (doors + locked doors
  // count as passable since the player will acquire keys). If stairs are
  // unreachable, carve a rescue corridor. Structured as a reusable helper
  // so it can later double as a player power-up (path visualisation).
  {
    const sx = spawnRoom.cx, sy = spawnRoom.cy;
    const stairTile = floorNum >= _finalFloor ? T.TERMINAL : T.STAIRS;
    /** @type {any} */ const vis = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
    /** @type {any} */ const prev = Array.from({length: MAP_H}, () => new Int16Array(MAP_W).fill(-1));
    const q = [{x: sx, y: sy}];
    vis[sy][sx] = 1;
    let stairX = -1, stairY = -1;
    // Find stairs position
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (map[y][x] === stairTile) { stairX = x; stairY = y; }

    while (q.length) {
      const {x, y} = /** @type {{x:any,y:any}} */ (q.shift());
      if (x === stairX && y === stairY) break;
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        if (vis[ny][nx]) continue;
        const t = map[ny][nx];
        if (t === T.WALL || t === T.VOID) continue;
        vis[ny][nx] = 1;
        prev[ny][nx] = y * MAP_W + x;
        q.push({x: nx, y: ny});
      }
    }

    if (!vis[stairY][stairX]) {
      // Stairs unreachable — carve rescue corridor, only overwriting WALL/VOID
      let cx = sx, cy = sy;
      while (cx !== stairX) { if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR; cx += cx < stairX ? 1 : -1; }
      while (cy !== stairY) { if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR; cy += cy < stairY ? 1 : -1; }
    }
  }

  // ── Traps (floor 3+) ────────────────────────────────────────────────────
  if (floorNum >= 3) {
    for (const r of rooms) {
      // Skip spawn (player needs safe arrival), boss (boss room is its own
      // hazard), and special rooms — secret rooms in particular, because the
      // whisper item spawns at the room center (see secret-room placement
      // above) and a trap landing on that exact tile would visually replace
      // the whisper. Special rooms (vendor/lore/event/shrine/challenge) host
      // gameplay-critical interactions that traps would clutter.
      if (r === spawnRoom || r === bossRoom || r.roomType) continue;
      const trapCount = rndInt(0, Math.min(3, Math.floor(floorNum/3)));
      for (let t=0; t<trapCount; t++) {
        const tx = r.x + rndInt(1, r.w-2);
        const ty = r.y + rndInt(1, r.h-2);
        if (map[ty][tx] === T.FLOOR) {
          map[ty][tx] = Math.random() < 0.7 ? T.TRAP_SPIKE : T.TRAP_SLOW;
        }
      }
    }
  }

  // ── Toxic Pools (floor 3+): corrosive pools that damage player AND enemies ──
  if (floorNum >= 3) {
    for (const r of rooms) {
      if (r === spawnRoom || r === bossRoom || r.roomType) continue;
      if (Math.random() > 0.30) continue; // ~30% of eligible rooms
      const sx = r.x + rndInt(2, r.w-3);
      const sy = r.y + rndInt(2, r.h-3);
      if (map[sy][sx] !== T.FLOOR) continue;
      map[sy][sx] = T.TOXIC;
      const poolSize = rndInt(2, 4);
      let cx = sx, cy = sy;
      for (let p = 1; p < poolSize; p++) {
        const dirs = /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]]);
        const [ddx, ddy] = /** @type {[number,number]} */ (dirs[rndInt(0, 3)]);
        const nx = cx + ddx, ny = cy + ddy;
        if (nx > r.x && nx < r.x+r.w-1 && ny > r.y && ny < r.y+r.h-1 && map[ny][nx] === T.FLOOR) {
          map[ny][nx] = T.TOXIC;
          cx = nx; cy = ny;
        }
      }
    }
  }

  // ── Plasma Vents (floor 4+): clustered pools in normal rooms ─────────
  if (floorNum >= 4) {
    for (const r of rooms) {
      if (r === spawnRoom || r === bossRoom || r.roomType) continue;
      if (Math.random() > 0.35) continue; // ~35% of eligible rooms
      // Seed tile for the pool
      const sx = r.x + rndInt(2, r.w-3);
      const sy = r.y + rndInt(2, r.h-3);
      if (map[sy][sx] !== T.FLOOR) continue;
      map[sy][sx] = T.PLASMA;
      // Grow pool via random-walk from seed (2-4 total tiles)
      const poolSize = rndInt(2, 4);
      let cx = sx, cy = sy;
      for (let p = 1; p < poolSize; p++) {
        const dirs = /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]]);
        const [ddx, ddy] = /** @type {[number,number]} */ (dirs[rndInt(0, 3)]);
        const nx = cx + ddx, ny = cy + ddy;
        if (nx > r.x && nx < r.x+r.w-1 && ny > r.y && ny < r.y+r.h-1 && map[ny][nx] === T.FLOOR) {
          map[ny][nx] = T.PLASMA;
          cx = nx; cy = ny;
        }
      }
    }
  }

  // ── Lore Terminals (floor 2+, non-boss): 1–2 data terminals per floor ────
  const loreTerminals = [];
  if (floorNum >= 2 && !bossRoom) {
    const loreEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && r.roomType !== 'vendor' &&
      r.roomType !== 'secret' && r.roomType !== 'event' && r.w * r.h >= 12
    );
    const numLore = Math.min(loreEligible.length, floorNum >= 5 ? 2 : 1);
    const loreRooms = loreEligible.sort(() => Math.random() - 0.5).slice(0, numLore);
    for (const r of loreRooms) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const tx = r.x + rndInt(1, r.w - 2);
        const ty = r.y + rndInt(1, r.h - 2);
        if (map[ty][tx] === T.FLOOR) {
          map[ty][tx] = T.LORE;
          loreTerminals.push({ x: tx, y: ty });
          break;
        }
      }
    }
  }

  // ── Arc Grids (floor 5+): pulsing hazards in corridors ───────────────
  if (floorNum >= 5) {
    // Build room mask to identify corridor tiles
    /** @type {any} */ const roomMask = Array.from({length:MAP_H}, ()=>new Uint8Array(MAP_W));
    for (const r of rooms) {
      for (let ty = r.y; ty < r.y + r.h; ty++)
        for (let tx = r.x; tx < r.x + r.w; tx++)
          roomMask[ty][tx] = 1;
    }
    // Collect corridor floor tiles (not adjacent to doors/stairs/terminals)
    const corridorTiles = [];
    for (let ty = 1; ty < MAP_H-1; ty++) {
      for (let tx = 1; tx < MAP_W-1; tx++) {
        if (map[ty][tx] !== T.FLOOR || roomMask[ty][tx]) continue;
        // Skip if adjacent to door, stairs, terminal, or locked door
        let nearSpecial = false;
        for (const [ddx, ddy] of /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]])) {
          const nt = map[ty+ddy]?.[tx+ddx];
          if (nt===T.STAIRS||nt===T.TERMINAL||nt===T.VENDOR||nt===T.LORE||nt===T.IMPLANT_SHRINE||nt===T.EVENT_TERMINAL||isDoor(nt)||nt===T.DOOR_OPEN) { nearSpecial = true; break; }
        }
        if (!nearSpecial) corridorTiles.push({x:tx, y:ty});
      }
    }
    // Place arc grids: ~1 per 12 corridor tiles, capped
    const arcCount = Math.min(Math.floor(corridorTiles.length / 12) + 1, 6 + floorNum);
    const shuffled = corridorTiles.sort(() => Math.random() - 0.5);
    let placed = 0;
    for (const ct of shuffled) {
      if (placed >= arcCount) break;
      // Don't place adjacent to another arc
      let adjArc = false;
      for (const [ddx, ddy] of /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]])) {
        if (map[ct.y+ddy]?.[ct.x+ddx] === T.ARC) { adjArc = true; break; }
      }
      if (adjArc) continue;
      map[ct.y][ct.x] = T.ARC;
      placed++;
    }
  }

  // ── Teleport Pads (floor 3+, non-boss): linked pairs for fast travel ───
  const teleportPads = [];
  if (floorNum >= 3 && !bossRoom) {
    const padEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 16 &&
      map[r.cy][r.cx] === T.FLOOR
    );
    // Want pairs of rooms far apart — sort by BFS distance from spawn and pair extremes
    const pairCount = floorNum >= 6 ? 2 : 1;
    const shuffled = padEligible.sort(() => Math.random() - 0.5);
    const used = new Set();
    for (let p = 0; p < pairCount && shuffled.length - used.size >= 2; p++) {
      let bestA = null, bestB = null, bestDist = 0;
      for (let i = 0; i < shuffled.length; i++) {
        if (used.has(i)) continue;
        for (let j = i + 1; j < shuffled.length; j++) {
          if (used.has(j)) continue;
          const d = Math.abs(shuffled[i].cx - shuffled[j].cx) + Math.abs(shuffled[i].cy - shuffled[j].cy);
          if (d > bestDist) { bestDist = d; bestA = i; bestB = j; }
        }
      }
      if (bestA !== null && bestDist >= 15) {
        const rA = shuffled[/** @type {number} */ (bestA)], rB = shuffled[/** @type {number} */ (bestB)];
        map[rA.cy][rA.cx] = T.TELEPORT_PAD;
        map[rB.cy][rB.cx] = T.TELEPORT_PAD;
        teleportPads.push({ x1: rA.cx, y1: rA.cy, x2: rB.cx, y2: rB.cy, pairIndex: p });
        used.add(bestA);
        used.add(bestB);
      }
    }
  }

  // Room colour map (floor tile → tint)
  /** @type {any} */ const roomColour = Array.from({length:MAP_H},()=>new Array(MAP_W).fill(null));
  for (const r of rooms) {
    if (!r.roomType) continue;
    const col = ROOM_COLOURS[r.roomType];
    for (let ty=r.y; ty<r.y+r.h; ty++)
      for (let tx=r.x; tx<r.x+r.w; tx++)
        if (map[ty][tx]===T.FLOOR) roomColour[ty][tx]=col;
  }

  // Secret room mask — tiles inside unrevealed secret rooms are hidden from lighting/rendering
  // Cracked entrance tiles are excluded so they can receive light and render crack visuals
  /** @type {any} */ const secretMask = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));
  for (const r of secretRooms) {
    for (let ty=r.y; ty<r.y+r.h; ty++)
      for (let tx=r.x; tx<r.x+r.w; tx++)
        if (map[ty][tx] !== T.CRACKED) secretMask[ty][tx] = 1;
  }

  return { map, rooms, spawnRoom, stairRoom:farthest, bossRoom, bossEntrances, playerPos, lights, visited, light, visible, keyItems, whisperItems, roomColour, specialRooms, vendorRoom, secretRooms, secretMask, loreTerminals, challengeRoom, challengeEntrances, eventRoom, teleportPads };
}

// ─── Lighting ────────────────────────────────────────────────────────────────
/**
 * @param {any} dungeon
 * @param {any} px
 * @param {any} py
 */
function updateLighting(dungeon, px, py) {
  const map = dungeon.map;
  const mod = _CG.modifier;
  const r = mod === 'BLACKOUT' ? 5 : 9;
  const tx = Math.floor(px), ty = Math.floor(py);
  // Incremental FOV (Phase 2b): if the player is still on the same floor tile
  // and the modifier hasn't changed and no map mutation flagged dirty, the
  // previous frame's light/visible grids are still correct. Skip recompute.
  if (!dungeon._fovDirty &&
      dungeon._fovTx === tx && dungeon._fovTy === ty &&
      dungeon._fovMod === mod) {
    return;
  }
  dungeon._fovDirty = false;
  dungeon._fovTx = tx; dungeon._fovTy = ty; dungeon._fovMod = mod;
  // Clear light and visible each frame (per-row typed-array fill)
  for (let y = 0; y < MAP_H; y++) {
    dungeon.light[y].fill(0);
    dungeon.visible[y].fill(0);
  }
  // Player FOV — LOS-based
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      if (dungeon.secretMask[y][x]) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      if (!tileHasLOS(px, py, x, y, map)) continue;
      const l = Math.max(0, 1 - d / r);
      dungeon.light[y][x] = l;
      dungeon.visible[y][x] = 1;
      if (!dungeon.visited[y][x]) { dungeon.visited[y][x] = 1; _CG._minimapDirty = true; }
    }
  // Sconce ambient — only brightens already-visited tiles, no visibility grant.
  // Add deterministic flicker so floors read like unstable lab lighting.
  for (const sc of dungeon.lights) {
    const sdx = sc.x - tx, sdy = sc.y - ty;
    if (Math.abs(sdx) > 6 || Math.abs(sdy) > 6) continue;
    const flickerBase = 0.82 + 0.18 * Math.sin((_CG.floorTime || 0) * 7 + sc.x * 0.73 + sc.y * 1.11);
    const flickerDrop = Math.sin((_CG.floorTime || 0) * 19 + sc.x * 1.7 + sc.y * 2.3) > 0.94 ? 0.55 : 1;
    const sconceMul = flickerBase * flickerDrop;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = sc.x + dx, y = sc.y + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (dungeon.secretMask[y][x]) continue;
        if (!dungeon.visited[y][x]) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 4) dungeon.light[y][x] = Math.max(dungeon.light[y][x], 0.4 * sconceMul * (1 - d / 4));
      }
  }
}

// LOS check for FOV: like hasLOS but uses isSeeThrough and blocks diagonal corner-cuts
/**
 * @param {any} x1
 * @param {any} y1
 * @param {any} tx
 * @param {any} ty
 * @param {any} map
 */
function tileHasLOS(x1, y1, tx, ty, map) {
  let cx = Math.floor(x1), cy = Math.floor(y1);
  if (cx === tx && cy === ty) return true;
  const dx = Math.abs(tx - cx), dy = Math.abs(ty - cy);
  const sx = cx < tx ? 1 : -1, sy = cy < ty ? 1 : -1;
  let err = dx - dy;
  for (let i = 0; i < 100; i++) {
    const e2 = 2 * err;
    let nx = cx, ny = cy;
    if (e2 > -dy) { err -= dy; nx += sx; }
    if (e2 < dx)  { err += dx; ny += sy; }
    // Diagonal corner-cut block: both intermediate tiles must be see-through
    if (nx !== cx && ny !== cy) {
      if (!isSeeThrough(map[cy]?.[nx]) && !isSeeThrough(map[ny]?.[cx])) return false;
    }
    cx = nx; cy = ny;
    if (cx === tx && cy === ty) return true;
    if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return false;
    if (!isSeeThrough(map[cy][cx])) return false;
  }
  return true;
}

// ─── Projectiles (pooled) ────────────────────────────────────────────────────
// projectiles[] holds live projectiles only. _projPool is the free list of
// dead Projectile instances. `new Projectile(...)` returns a pooled instance
// if one is free (constructors may return an object), else allocates a fresh
// one. Every field — required AND optional — is explicitly (re)assigned in
// _init() so there is zero stale bleed-through between reuses. Release
// happens in the main update loop when p.dead becomes true.
const PROJECTILE_CAP = 200;
/** @type {any[]} */ const projectiles = [];
/** @type {any[]} */ const _projPool = [];

/**
 * @param {any} p
 */
function releaseProjectile(p) {
  if (_projPool.length >= PROJECTILE_CAP) return; // hard cap
  // Best-effort cleanup of references that could hold onto dead enemies/
  // weapons longer than needed. _init() rewrites these on reuse anyway, but
  // nulling here keeps the free-list from pinning garbage.
  p.homing = null;
  p._owner = null;
  if (p.hitEnemies) p.hitEnemies.clear();
  if (p.trail) p.trail.length = 0;
  if (p._effects) p._effects = null;
  if (p._affixes) p._affixes = null;
  _projPool.push(p);
}

class Projectile {
  /** @type {any} */ x;
  /** @type {any} */ y;
  /** @type {any} */ dx;
  /** @type {any} */ dy;
  /** @type {any} */ spd;
  /** @type {any} */ dmg;
  /** @type {any} */ maxRange;
  /** @type {any} */ travelled;
  /** @type {any} */ colour;
  /** @type {any} */ piercing;
  /** @type {any} */ fromPlayer;
  /** @type {any} */ weaponName;
  /** @type {any} */ dead;
  /** @type {any} */ hitEnemies;
  /** @type {any} */ homing;
  /** @type {any} */ trail;
  /** @type {any} */ bouncesLeft;
  /** @type {any} */ _hasRicochet;
  /** @type {any} */ _effects;
  /** @type {any} */ _affixes;
  /** @type {any} */ isGrenade;
  /** @type {any} */ grenadeDmg;
  /** @type {any} */ isCrit;
  /** @type {any} */ ownerType;
  /** @type {any} */ _owner;
  /** @type {any} */ grenadeColour;
  /** @type {any} */ targetX;
  /** @type {any} */ targetY;
  /** @type {any} */ maxPierces;
  /** @type {any} */ isAllyTurret;
  /**
   * @param {any} x
   * @param {any} y
   * @param {any} dx
   * @param {any} dy
   * @param {any} spd
   * @param {any} dmg
   * @param {any} range
   * @param {any} colour
   * @param {any} piercing
   * @param {any} fromPlayer
   * @param {any} [weaponName]
   */
  constructor(x,y,dx,dy,spd,dmg,range,colour,piercing,fromPlayer,weaponName) {
    // Reuse a dead slot from the pool when possible. Returning an object from
    // a constructor makes `new Projectile(...)` yield that object instead of
    // `this`, so every existing callsite keeps working without change.
    if (_projPool.length) {
      const p = _projPool.pop();
      p._init(x,y,dx,dy,spd,dmg,range,colour,piercing,fromPlayer,weaponName);
      return p;
    }
    this._init(x,y,dx,dy,spd,dmg,range,colour,piercing,fromPlayer,weaponName);
  }
  /**
   * @param {any} x
   * @param {any} y
   * @param {any} dx
   * @param {any} dy
   * @param {any} spd
   * @param {any} dmg
   * @param {any} range
   * @param {any} colour
   * @param {any} piercing
   * @param {any} fromPlayer
   * @param {any} [weaponName]
   */
  _init(x,y,dx,dy,spd,dmg,range,colour,piercing,fromPlayer,weaponName) {
    // ── Core motion/state (mirrors original constructor) ──
    /** @type {any} */ (this).x=x; /** @type {any} */ (this).y=y;
    [this.dx,this.dy]=norm(dx,dy);
    this.spd= fromPlayer && hasAugment('KINETIC_AMPLIFIER') ? spd * 1.2 : spd;
    if (_CG.modifier === 'CHARGED') this.spd *= 1.4;
    this.dmg=dmg;
    if (fromPlayer && _CG.modifier === 'CHARGED') this.dmg = Math.round(this.dmg * 1.2);
    this.maxRange=range; this.travelled=0;
    this.colour=colour; this.piercing=piercing;
    this.maxPierces=piercing?Infinity:0;
    this.fromPlayer=fromPlayer; this.dead=false;
    this.weaponName=weaponName||null;
    // Reuse containers in place to avoid alloc; fall back to fresh if null.
    if (this._effects && this._effects.length) this._effects.length = 0;
    else if (!this._effects) this._effects = /** @type {any[]} */ ([]);
    if (this.hitEnemies) this.hitEnemies.clear();
    else this.hitEnemies = new Set();
    this.bouncesLeft=0;
    this._hasRicochet=false;
    if (this.trail) this.trail.length = 0;
    else this.trail = /** @type {any[]} */ ([]);
    // ── Optional fields — EXPLICITLY reset so stale values from a prior
    // occupant of this slot cannot leak into new behaviour. Every property
    // that any callsite ever assigns must be zeroed here. ──
    this.homing = /** @type {any} */ (null);
    this.isGrenade = false;
    this.grenadeDmg = 0;
    this.grenadeColour = /** @type {any} */ (null);
    this.targetX = 0;
    this.targetY = 0;
    this.ownerType = null;
    this.isAllyTurret = false;
    this._owner = /** @type {any} */ (null);
    this.isCrit = false;
    if (this._affixes && this._affixes.length) this._affixes.length = 0;
    else if (!this._affixes) this._affixes = /** @type {any[]} */ ([]);
  }
  /**
   * @param {any} dt
   * @param {any} map
   * @param {any} player
   * @param {any} enemies
   */
  update(dt, map, player, enemies) {
    // Homing: steer toward target
    if (this.homing && !this.homing.dead) {
      const [tx, ty] = [this.homing.x - this.x, this.homing.y - this.y];
      const [nd, ndy] = norm(tx, ty);
      const steer = 8; // radians/sec turn rate
      this.dx = lerp(this.dx, nd,  Math.min(1, steer * dt));
      this.dy = lerp(this.dy, ndy, Math.min(1, steer * dt));
      const [fd, fdy] = norm(this.dx, this.dy);
      this.dx = fd; this.dy = fdy;
    }
    // Trail: record position before moving (ricochet projectiles only)
    if (this._hasRicochet) {
      this.trail.push(this.x*TILE, this.y*TILE);
      if (this.trail.length>24) this.trail.splice(0,2); // max 12 points (x,y pairs)
    }
          /** @type {any} */ const prevX=this.x;
          /** @type {any} */ const prevY=this.y;
    const mx=this.dx*this.spd*dt, my=this.dy*this.spd*dt;
    this.x+=mx; this.y+=my;
    this.travelled+=Math.sqrt(mx*mx+my*my);
    if (this.travelled>=this.maxRange) {
      if (this.isGrenade) detonateGrenade(prevX, prevY, this.grenadeDmg);
      this.dead=true; return;
    }
    const tx=Math.floor(this.x), ty=Math.floor(this.y);
    if (tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) {
      if (this.isGrenade) { detonateGrenade(prevX, prevY, this.grenadeDmg); }
      else { spawnParticles(prevX,prevY,'SPARK',this.colour,3); }
      this.dead=true; return;
    }
    // Block diagonal corner-cutting (projectiles slipping through touching wall corners)
    const ptx=Math.floor(prevX), pty=Math.floor(prevY);
    if (tx!==ptx && ty!==pty) {
      const xBlocked = tx<0||tx>=MAP_W||pty<0||pty>=MAP_H||!isPassable(map[pty][tx]);
      const yBlocked = ptx<0||ptx>=MAP_W||ty<0||ty>=MAP_H||!isPassable(map[ty][ptx]);
      if (xBlocked && yBlocked) {
        // Damage crates at blocked corner tiles
        if (tx >= 0 && tx < MAP_W && pty >= 0 && pty < MAP_H && map[pty][tx] === T.CRATE) damageCrateAtTile(tx, pty, this.dmg);
        if (ptx >= 0 && ptx < MAP_W && ty >= 0 && ty < MAP_H && map[ty][ptx] === T.CRATE) damageCrateAtTile(ptx, ty, this.dmg);
        if (this.isGrenade) {
          detonateGrenade(prevX, prevY, this.grenadeDmg);
          this.dead = true; return;
        }
        if (this.bouncesLeft > 0) {
          this.bouncesLeft--;
          this.x = prevX; this.y = prevY;
          this.dx = -this.dx; this.dy = -this.dy;
          this.x += this.dx * 0.05; this.y += this.dy * 0.05;
          spawnParticles(prevX, prevY, 'SPARK', '#00ffff', 4);
          audio.ricochet();
          return;
        }
        spawnParticles(prevX, prevY, 'SPARK', this.colour, 3);
        this.dead = true; return;
      }
    }
    if (!isPassable(map[ty][tx])) {
      // Damage crates on impact
      if (map[ty][tx] === T.CRATE) damageCrateAtTile(tx, ty, this.dmg);
      // Grenades detonate at last passable position on wall hit
      if (this.isGrenade) {
        detonateGrenade(prevX, prevY, this.grenadeDmg);
        this.dead = true; return;
      }
      // Ricochet: bounce off walls if bounces remain
      if (this.bouncesLeft>0) {
        this.bouncesLeft--;
        this.x=prevX; this.y=prevY;
        // Axis-separated wall detection
        const ntx=Math.floor(prevX+mx), nty=Math.floor(prevY+my);
        const xWall=ntx<0||ntx>=MAP_W||!isPassable(map[pty][ntx]);
        const yWall=nty<0||nty>=MAP_H||!isPassable(map[nty][ptx]);
        if (xWall) this.dx=-this.dx;
        if (yWall) this.dy=-this.dy;
        if (!xWall&&!yWall) { this.dx=-this.dx; this.dy=-this.dy; }
        // Nudge away from wall to prevent re-collision
        this.x+=this.dx*0.05; this.y+=this.dy*0.05;
        spawnParticles(prevX,prevY,'SPARK','#00ffff',4);
        audio.ricochet();
        return;
      }
      spawnParticles(this.x,this.y,'SPARK',this.colour,3);
      this.dead=true; return;
    }
    // Grenades: detonate when reaching target
    if (this.isGrenade && dist(this.x, this.y, this.targetX, this.targetY) < 0.5) {
      detonateGrenade(this.x, this.y, this.grenadeDmg);
      this.dead = true; return;
    }
    if (this.fromPlayer) {
      for (const e of enemies) {
        if (e.dead||this.hitEnemies.has(e)) continue;
        if (e._wrPhased) continue; // phased WRAITHs are intangible
        if (dist(this.x,this.y,e.x,e.y)<0.6) {
          // Reflection check — REFLECTOR bounces projectiles back (including piercing)
          if (e.reflectsProjectile(this)) {
            this.dx = -this.dx;
            this.dy = -this.dy;
            this.fromPlayer = false;
            this.dmg = Math.round(this.dmg * 0.6);
            this.ownerType = 'Reflected';
            this.hitEnemies = new Set();
            this.homing = null;
            this.bouncesLeft = 0;
            this._hasRicochet = false;
            this.travelled = 0;
            this._effects = /** @type {any[]} */ ([]);
            this._affixes = /** @type {any[]} */ ([]);
            this.isCrit = false;
            spawnParticles(this.x, this.y, 'SPARK', '#88ddff', 8);
            audio.reflect();
            return;
          }
          // Shield deflection check (skip for piercing weapons)
          if (e.blocksProjectile(this) && !this.piercing) {
            // SHIELDER directional shield: deplete shieldHp and start the
            // broken-recovery timer when it drops to 0. The shield comes
            // back over a 5s window per the aiShielder tick logic.
            if (e.type === 'SHIELDER' && e.shieldHp > 0) {
              e.shieldHp -= this.dmg;
              if (e.shieldHp <= 0) {
                e.shieldHp = 0;
                e.shieldBrokenTimer = 0;
                spawnParticles(e.x, e.y, 'EXPLOSION', '#66eeff', 12);
                try { audio.shieldBreak(); } catch (_) { audio.shieldDeflect(); }
              } else {
                spawnParticles(this.x, this.y, 'SPARK', '#66eeff', 6);
                audio.shieldDeflect();
              }
            } else {
              spawnParticles(this.x, this.y, 'SPARK', '#66eeff', 6);
              audio.shieldDeflect();
            }
            this.dead = true; return;
          }
          e.takeDamage(this.dmg, { name:this.weaponName, effects:this._effects||[], affixes:this._affixes||[] });
          if (this.isCrit) spawnDmgText(e.x, e.y - 0.3, 'CRIT!', '#ffdd00');
          spawnParticles(this.x,this.y,'BLOOD','#ff3333',4);
          this.hitEnemies.add(e);
          if (this.hitEnemies.size > this.maxPierces) { this.dead=true; return; }
        }
      }
    } else if (!this.isGrenade && !this.isAllyTurret) {
      // Normal enemy projectiles damage player (grenades don't — they create zones)
      // PARRY perk: while dashing, enemy projectiles touching the player are
      // reflected back at full damage (skill-tied — requires precise dash timing).
      // Mirrors the REFLECTOR enemy-side reflect at line ~3418, but enemy→player.
      // Gated on dashTimer specifically (not cloak / spawn-grace) so the perk
      // only rewards active dash timing, not passive immunity windows.
      if (player.perks.PARRY && player.dashTimer > 0 && dist(this.x,this.y,player.x,player.y)<0.5) {
        this.dx = -this.dx;
        this.dy = -this.dy;
        this.fromPlayer = true;
        this.ownerType = 'Parry';
        this._owner = null;
        this.weaponName = 'Parry';
        this.hitEnemies = new Set();
        this.maxPierces = 0;
        this.piercing = false;
        this.homing = null;
        this.bouncesLeft = 0;
        this._hasRicochet = false;
        this.travelled = 0;
        this._effects = /** @type {any[]} */ ([]);
        this._affixes = /** @type {any[]} */ ([]);
        this.isCrit = false;
        this.colour = '#aaffee';
        spawnParticles(this.x, this.y, 'SPARK', '#aaffee', 8);
        audio.reflect();
        return;
      }
      // Cloaked player: projectiles pass through
      if (!player.invincibleTimer && !isPlayerDamageImmune() && dist(this.x,this.y,player.x,player.y)<0.5) {
        const dealt = player.takeDamage(this.dmg, this.ownerType || 'Projectile');
        // SNIPER shots shock the player on hit
        if (dealt > 0 && this.ownerType === 'SNIPER') {
          const wasShocked = player.shockTimer > 0;
          player.shockTimer = Math.max(player.shockTimer, 0.4);
          if (!wasShocked) audio.playerShock();
        }
        // SIPHON life steal: heal owner for % of damage dealt
        if (dealt > 0 && this.ownerType === 'SIPHON' && this._owner && !this._owner.dead) {
          const stealPct = this._owner._spFrenzy ? 0.75 : 0.50;
          const heal = Math.ceil(dealt * stealPct);
          this._owner.hp = Math.min(this._owner.maxHp, this._owner.hp + heal);
          this._owner._spDrainBeam = { px: player.x, py: player.y, t: 0.3 };
          spawnParticles(this._owner.x, this._owner.y, 'SPARK', '#44ff88', 4);
          audio.siphonDrain();
        }
        this.dead=true;
      }
    }
    // Any projectile can prime volatile cores (skip if already consumed)
    if (!this.dead) {
      for (const c of vcores) {
        if (c.dead || c.primed) continue;
        if (dist(this.x, this.y, c.x, c.y) < 0.6) {
          c.primed = true; c.timer = 0.55;
          audio.corePrime();
          spawnParticles(c.x, c.y, 'SPARK', '#ff6622', 6);
          if (!this.fromPlayer) { this.dead = true; return; }
          break; // player projectile: prime one core per frame, continue flying
        }
      }
    }
    // Player projectiles can damage alarm beacons
    if (!this.dead && this.fromPlayer) {
      for (const b of beacons) {
        if (b.dead) continue;
        if (dist(this.x, this.y, b.x, b.y) < 0.6) {
          damageBeacon(b, this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Player projectiles can damage shield generators
    if (!this.dead && this.fromPlayer) {
      for (const g of shieldGens) {
        if (g.dead) continue;
        if (dist(this.x, this.y, g.x, g.y) < 0.6) {
          damageShieldGen(g, this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Player projectiles can damage security cameras
    if (!this.dead && this.fromPlayer) {
      for (const cam of cameras) {
        if (cam.dead) continue;
        if (dist(this.x, this.y, cam.x, cam.y) < 0.6) {
          damageCamera(cam, this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Player projectiles can damage laser tripwire emitters
    if (!this.dead && this.fromPlayer) {
      for (const l of lasers) {
        if (l.dead) continue;
        if (!l.deadA && dist(this.x, this.y, l.x1, l.y1) < 0.5) {
          damageLaserEmitter(l, 'A', this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
        if (l.dead) continue;
        if (!l.deadB && dist(this.x, this.y, l.x2, l.y2) < 0.5) {
          damageLaserEmitter(l, 'B', this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Player projectiles trigger proximity mines (pre-detonate from range)
    if (!this.dead && this.fromPlayer) {
      for (const m of mines) {
        if (m.dead || m.state !== 'dormant') continue;
        if (dist(this.x, this.y, m.x, m.y) < 0.6) {
          armMine(m, MINE_FUSE_SHOT);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Player projectiles can damage hostile wall turrets
    if (!this.dead && this.fromPlayer) {
      for (const wt of wallTurrets) {
        if (wt.dead || wt.hacked) continue;
        if (dist(this.x, this.y, wt.x, wt.y) < 0.6) {
          damageWallTurret(wt, this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Ally turret projectiles can hit enemies
    if (!this.dead && this.isAllyTurret) {
      for (const e of enemies) {
        if (e.dead || this.hitEnemies.has(e)) continue;
        if (e._wrPhased) continue; // phased WRAITHs are intangible
        if (dist(this.x, this.y, e.x, e.y) < 0.6) {
          if (e.blocksProjectile(this) && !this.piercing) {
            // Mirror the player-projectile path: SHIELDER takes shield damage
            // and the shield breaks at 0 HP. (Hacked turrets don't get the
            // satisfaction-of-breaking sound — keep the deflect for them.)
            if (e.type === 'SHIELDER' && e.shieldHp > 0) {
              e.shieldHp -= this.dmg;
              if (e.shieldHp <= 0) {
                e.shieldHp = 0;
                e.shieldBrokenTimer = 0;
                spawnParticles(e.x, e.y, 'EXPLOSION', '#66eeff', 12);
                try { audio.shieldBreak(); } catch (_) {}
              } else {
                spawnParticles(this.x, this.y, 'SPARK', '#66eeff', 6);
              }
            } else {
              spawnParticles(this.x, this.y, 'SPARK', '#66eeff', 6);
            }
            this.dead = true; return;
          }
          e.takeDamage(this.dmg, { name:'Wall Turret', effects:[], affixes:[] });
          spawnParticles(this.x, this.y, 'BLOOD', '#ff3333', 4);
          this.hitEnemies.add(e);
          this.dead = true; return;
        }
      }
    }
    // Enemy projectiles can damage hacked wall turrets
    if (!this.dead && !this.fromPlayer && !this.isAllyTurret && !this.isGrenade) {
      for (const wt of wallTurrets) {
        if (wt.dead || !wt.hacked) continue;
        if (dist(this.x, this.y, wt.x, wt.y) < 0.6) {
          damageWallTurret(wt, this.dmg);
          this.dead = true; return;
        }
      }
    }
  }
  /**
   * @param {any} camX
   * @param {any} camY
   */
  draw(camX,camY) {
    // Ricochet trail — fading cyan line behind bouncing projectiles
    const tl=this.trail.length;
    if (tl>=4) {
      ctx.save();
      ctx.lineCap='round';
      const pts=Math.floor(tl/2);
      for (let i=1;i<pts;i++) {
        const a=(i-1)*2, b=i*2;
        const alpha=(i/pts)*0.5;
        ctx.globalAlpha=alpha;
        ctx.strokeStyle='#00ffff';
        ctx.shadowBlur=4; ctx.shadowColor='#00ffff';
        ctx.lineWidth=1.5;
        NEON.draw.line(ctx,
          this.trail[a]-camX, this.trail[a+1]-camY,
          this.trail[b]-camX, this.trail[b+1]-camY);
      }
      // Line from last trail point to current position
      ctx.globalAlpha=0.6;
      ctx.lineWidth=2;
      NEON.draw.line(ctx,
        this.trail[tl-2]-camX, this.trail[tl-1]-camY,
        this.x*TILE-camX, this.y*TILE-camY);
      ctx.restore();
    }
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY;
    ctx.save();
    ctx.shadowBlur=8; ctx.shadowColor=this.colour;
    ctx.fillStyle=this.colour;
    const r = this.isGrenade ? 5 : 3;
    NEON.draw.circle(ctx, sx, sy, r);
    if (this.isGrenade) {
      // Pulsing warning ring
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 80) * 0.3;
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 1;
      NEON.draw.circleStroke(ctx, sx, sy, 7);
    }
    ctx.restore();
  }
}

// ─── Hazard Zones (grenade AoE) ───────────────────────────────────────────────
/**
 * @param {any} x
 * @param {any} y
 * @param {any} dmg
 */
function detonateGrenade(x, y, dmg) {
  hazardZones.push({ x, y, radius: 1.5, age: 0, maxAge: 3, tickCd: 0, armTimer: 0, dmg, colour: '#ff6622' });
  spawnParticles(x, y, 'EXPLOSION', '#ff6622', 10);
  audio.grenadeExplode();
  primeVCoresInRadius(x, y, 1.5, _CG.dungeon.map);
  damageCratesInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  damageBeaconsInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  damageShieldGensInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  damageCamerasInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  damageLasersInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  damageWallTurretsInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  triggerMinesInRadius(x, y, 1.5, _CG.dungeon.map);
}

/**
 * @param {any} dt
 * @param {any} player
 */
function updateHazardZones(dt, player) {
  for (let i = hazardZones.length - 1; i >= 0; i--) {
    const z = hazardZones[i];
    z.age += dt;
    if (z.armTimer > 0) z.armTimer -= dt;
    z.tickCd = Math.max(0, z.tickCd - dt);
    if (z.age >= z.maxAge) { hazardZones.splice(i, 1); continue; }
    if (z.armTimer <= 0 && z.tickCd <= 0 && !player.invincibleTimer && !isPlayerDamageImmune() &&
        dist(player.x, player.y, z.x, z.y) < z.radius &&
        hasLOS(z.x, z.y, player.x, player.y, _CG.dungeon.map)) {
      player.takeDamage(z.dmg, z.source || 'Grenade');
      spawnParticles(player.x, player.y, 'SPARK', z.colour || '#ff6622', 4);
      z.tickCd = 0.8;
    }
  }
}

/**
 * @param {any} camX
 * @param {any} camY
 */
function drawHazardZones(camX, camY) {
  for (const z of hazardZones) {
    const sx = z.x * TILE - camX, sy = z.y * TILE - camY;
    const r = z.radius * TILE;
    const fade = 1 - (z.age / z.maxAge);
    const pulse = 0.7 + Math.sin(z.age * 6) * 0.15;
    ctx.save();
    if (z.armTimer > 0) {
      // Arming: pulsing warning ring only
      const arm = 0.4 + Math.sin(z.age * 14) * 0.3;
      ctx.globalAlpha = arm * 0.5;
      ctx.strokeStyle = z.colour;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      NEON.draw.circleStroke(ctx, sx, sy, r);
      ctx.setLineDash([]);
    } else {
      ctx.globalAlpha = fade * 0.3 * pulse;
      ctx.fillStyle = z.colour;
      ctx.shadowBlur = 15;
      ctx.shadowColor = z.colour;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = fade * 0.6 * pulse;
      ctx.strokeStyle = z.colour;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ─── Upgrades ────────────────────────────────────────────────────────────────
const UPGRADES = [
  // Instant (one-time) upgrades
  {id:'MED_PACK',    name:'Med-Pack',     desc:'+40 HP',               colour:'#00ff88', rarity:40, persistent:false,
   fn: (/** @type {any} */ p)=>{ p.hp=Math.min(p.maxHp,p.hp+40); }},
  {id:'NANO_REPAIR', name:'Nano-Repair',  desc:'+15 HP',               colour:'#88ff88', rarity:35, persistent:false,
   fn: (/** @type {any} */ p)=>{ p.hp=Math.min(p.maxHp,p.hp+15); }},
  {id:'XP_CHIP',     name:'XP Chip',      desc:'+50 XP',               colour:'#ffff00', rarity:20, persistent:false,
   fn: (/** @type {any} */ p)=>{ p.gainXP(50); }},
  // Credit Cache — currency drop. Per user "loot philosophy" rule, drops are
  // heals / XP / **currency** only; persistents live in meta-progression.
  // Amount scales with floor + meta credit multiplier + CREDIT_SIPHON augment
  // so it stays meaningful in late-game. Gold colour reads as currency on
  // sight; auto-applied via the _isSimple path in src/game.js (non-persistent,
  // not WEAPON_/HACKWARE_) so there's no popup. Rarity 50 sits between
  // MED_PACK (40) and NANO_REPAIR (35) so currency is the most common drop —
  // that's the point: drops mostly become things you spend at the Gap / shops.
  {id:'CREDIT_CACHE', name:'Credit Cache', desc:'+CR',                  colour:'#ffd700', rarity:50, persistent:false,
   fn: (/** @type {any} */ p)=>{
     const floor = (typeof _CG !== 'undefined' && _CG.floor) ? _CG.floor : 1;
     const base = 15 + floor * 5;
     const metaMul = (typeof getMetaCreditMultiplier === 'function') ? getMetaCreditMultiplier() : 1;
     const siphon = (typeof hasAugment === 'function' && hasAugment('CREDIT_SIPHON')) ? 1.5 : 1;
     // Match existing credit award paths (game.js:1472 room-clear,
     // entities.js:690 kill credits): scale by difficulty creditMul so
     // NIGHTMARE (0.85) and EASY (1.2) don't break the economy.
     const diffMul = (typeof getDiff === 'function') ? (getDiff().creditMul || 1) : 1;
     const amt = Math.max(1, Math.round(base * metaMul * siphon * diffMul));
     p.credits = (p.credits || 0) + amt;
     // Mirror kill-credit telemetry: a floating "+N CR" so the player sees it.
     if (typeof spawnDmgText === 'function') spawnDmgText(p.x, p.y, '+' + amt + ' CR', '#ffd700');
   }},
  // Tactical Drop — random temporary boost. Reuses NEON.boosts (the vendor
  // boost system) so floor-duration buffs (COMBAT_STIM/REFLEX_BOOSTER/
  // CRIT_MATRIX/RECON_PING) and instant grants (SHIELD_DRIVER) integrate
  // automatically with combat math, HUD, save/load. Per "loot philosophy":
  // temporary effects are explicitly OK as drops — only persistent power
  // (saws/sentries/regen) is forbidden. Excluded from the vendor pool
  // (filterVendorPool in src/meta/boosts.js) because vendors already sell
  // each boost individually at known prices; a flat-priced random pick
  // would be either strictly worse or an arbitrage loop. Rarity 25 sits
  // below MED_PACK/CREDIT_CACHE so it stays a "treat" pickup.
  {id:'TACTICAL_DROP', name:'Tactical Drop', desc:'Random combat boost', colour:'#ff8800', rarity:25, persistent:false,
   fn: (/** @type {any} */ p)=>{
     if (typeof NEON === 'undefined' || !NEON.boosts || !NEON.boosts.rollDropBoost) return;
     const id = NEON.boosts.rollDropBoost();
     if (!id) return;
     const b = NEON.boosts.BOOSTS && NEON.boosts.BOOSTS[id];
     NEON.boosts.applyBoost(p, id);
     // Activation feedback — burst + audio + floating label so the player
     // sees WHAT they got (random pick is opaque otherwise).
     if (typeof spawnParticles === 'function') spawnParticles(p.x, p.y, 'EXPLOSION', (b && b.colour) || '#ff8800', 12);
     if (typeof audio !== 'undefined' && audio.hackwareCloak) { try { audio.hackwareCloak(); } catch(_){} }
     if (b && _CG && _CG.msg) _CG.msg(b.icon + ' ' + b.name + ' ACTIVE', b.colour);
     if (typeof spawnDmgText === 'function' && b) spawnDmgText(p.x, p.y, b.icon + ' ' + b.name, b.colour);
   }},
  // Persistent (stackable) upgrades
  {id:'SAW_BLADE',   name:'Saw Blade',    desc:'Orbital blade circles you',   colour:'#ff3333', rarity:12, persistent:true, maxLevel:4,
   levelDesc: (/** @type {any} */ l)=>(l+1)+' blade'+(l>0?'s':'')+', 12 dmg each',
   fn: (/** @type {any} */ p)=>{ p.upgrades.SAW_BLADE=(p.upgrades.SAW_BLADE||0)+1; }},
  {id:'PLASMA_ORB',  name:'Plasma Orb',   desc:'Auto-fires homing orb',       colour:'#ff44cc', rarity:10, persistent:true, maxLevel:3,
   levelDesc: (/** @type {any} */ l)=>'25 dmg, '+(3-l*0.7).toFixed(1)+'s cooldown',
   fn: (/** @type {any} */ p)=>{ p.upgrades.PLASMA_ORB=(p.upgrades.PLASMA_ORB||0)+1; }},
  {id:'NANO_REGEN',  name:'Nano Regen',   desc:'Passive HP regeneration',     colour:'#44ffaa', rarity:15, persistent:true, maxLevel:5,
   levelDesc: (/** @type {any} */ l)=>'+'+(l+1)+' HP/s',
   fn: (/** @type {any} */ p)=>{ p.upgrades.NANO_REGEN=(p.upgrades.NANO_REGEN||0)+1; }},
  {id:'OVERCLOCK',   name:'Overclock',    desc:'Permanent speed boost',       colour:'#ff00c8', rarity:10, persistent:true, maxLevel:3,
   levelDesc: (/** @type {any} */ l)=>'+'+(15*(l+1))+'% speed',
   fn: (/** @type {any} */ p)=>{ p.upgrades.OVERCLOCK=(p.upgrades.OVERCLOCK||0)+1; p.permSpeedBonus=(p.upgrades.OVERCLOCK)*0.5; }},
  {id:'ARMOR_UP',    name:'Reinforced Armor', desc:'Permanent +3 DEF',        colour:'#00aaff', rarity:12, persistent:true, maxLevel:5,
   levelDesc: (/** @type {any} */ l)=>'+'+(3*(l+1))+' DEF total',
   fn: (/** @type {any} */ p)=>{ p.upgrades.ARMOR_UP=(p.upgrades.ARMOR_UP||0)+1; p.def+=3; }},
  {id:'RICOCHET',   name:'Ricochet Module',  desc:'Bullets bounce off walls', colour:'#00ffff', rarity:8,  persistent:true, maxLevel:3,
   levelDesc: (/** @type {any} */ l)=>(l+1)+' bounce'+(l>0?'s':''),
   fn: (/** @type {any} */ p)=>{ p.upgrades.RICOCHET=(p.upgrades.RICOCHET||0)+1; }},
  {id:'SENTRY_DRONE', name:'Sentry Drone', desc:'Orbiting drone auto-fires at enemies', colour:'#00e5ff', rarity:7, persistent:true, maxLevel:3,
   levelDesc: (/** @type {any} */ l)=>(l+1)+' drone'+(l>0?'s':'')+', 8 dmg, '+(2.0-l*0.4).toFixed(1)+'s cd',
   fn: (/** @type {any} */ p)=>{ p.upgrades.SENTRY_DRONE=(p.upgrades.SENTRY_DRONE||0)+1; }},
];

// Generate a weapon upgrade option (pre-rolled so player sees exact weapon)
function makeWeaponOption() {
  const k=WEAPON_KEYS[rndInt(0,WEAPON_KEYS.length-1)];
  const aw=rollWeapon(k, _CG.floor || 1);
  const rarityCol = RARITY_COLOURS[aw._rarity] || '#aaaaaa';
  const affixDesc = aw._affixes.map((/** @type {any} */ id) => WEAPON_AFFIXES[id]?.desc).filter(Boolean).join(', ');
  const statsDesc = aw.melee ? aw.dmg+' dmg, melee, '+aw.rate+'/s' : aw.dmg+(aw.count>1?'×'+aw.count:'')+' dmg, '+aw.rate+'/s, rng '+aw.range;
  return {
    id:'WEAPON_'+k, name:aw.displayName, colour:aw.colour, rarity:10, persistent:false,
    _rarity: aw._rarity, _rarityColour: rarityCol, _weaponObj: aw,
    desc: statsDesc,
    affixDesc: affixDesc || null,
    fn: (/** @type {any} */ p)=>{
      if (p.collectWeapon) {
        if (p.collectWeapon(aw)) {
          _CG.msg('Collected '+aw.displayName+'! [Scroll] to switch',rarityCol);
          return;
        }
      }
      if (p.equipWeapon) p.equipWeapon(aw);
      else p.weapon=aw;
      _CG.msg('Equipped '+aw.displayName+'!',rarityCol);
    }
  };
}

/**
 * @param {any} exclude
 */
function makeHackwareOption(exclude) {
  // Pick a random hackware module different from what player has and the excluded id
  const current = _CG.player ? _CG.player.hackware : null;
  const eligible = HACKWARE_KEYS.filter(k => {
    if (exclude && exclude === 'HACKWARE_' + k) return false;
    return true;
  });
  if (eligible.length === 0) return null;
  const key = /** @type {string} */ (eligible[rndInt(0, eligible.length - 1)]);
  const hw = HACKWARE[key];
  const replaces = current ? HACKWARE[current] : null;
  return {
    id:'HACKWARE_'+key, name:hw.name,
    desc:hw.desc + (replaces ? ' [replaces '+replaces.name+']' : ''),
    colour:hw.colour, rarity:0, persistent:false, isHackware:true,
    fn: (/** @type {any} */ p) => {
      p.hackware = key;
      p.hackwareCooldown = 0; // fresh cooldown on equip
      _CG.msg(hw.icon+' '+hw.name+' INSTALLED', hw.colour);
    }
  };
}

/**
 * @param {any} exclude
 * @returns {any}
 */
function pickUpgradeOption(exclude) {
  // LOOT PHILOSOPHY (user rule, repeated 100+ times): NEVER drop permanent
  // power-ups for free. Drops are heals + XP only. Persistent items (saws,
  // sentries, regen, armor, ricochet, plasma orb, overclock) are filtered
  // out of the run drop pool entirely — they live in meta-progression /
  // shops / future weapon-terminal upgrades. Hackware + weapons removed
  // from drops too: hackware is a permanent equip; weapons live in secret
  // rooms only (per user). This collapses pickUpgradeOption to MED_PACK,
  // NANO_REPAIR, XP_CHIP — all "simple" so the existing auto-apply path at
  // src/game.js:1400-1409 handles them with no popup. Stored as repo
  // memory: subject "loot philosophy".
  const pool = UPGRADES.filter(u => {
    if (u.persistent) return false;
    if (exclude && u.id === exclude) return false;
    return true;
  });
  // Defensive fallback — should never trigger because MED_PACK/NANO_REPAIR/
  // XP_CHIP are always present and non-persistent. If the table is ever
  // edited to remove them all, fall back to a minimal heal so we don't
  // crash the pickup path.
  if (pool.length === 0) {
    return { id:'MED_PACK', name:'Med-Pack', desc:'+40 HP', colour:'#00ff88',
      rarity:1, persistent:false,
      fn: (/** @type {any} */ p)=>{ p.hp=Math.min(p.maxHp,p.hp+40); } };
  }
  const total = pool.reduce((s,u) => s+u.rarity, 0);
  let r = Math.random() * total;
  for (const u of pool) { r -= u.rarity; if (r <= 0) return u; }
  return pool[0];
}

// Legacy compatibility: items on the ground still use a type for colour/visual
const ITEM_TYPES = UPGRADES.filter(u => !u.persistent).slice(0, 3);
function pickItemType() { return ITEM_TYPES[rndInt(0, ITEM_TYPES.length-1)]; }

// ─── Level-Up Perks ──────────────────────────────────────────────────────────
// Choose-one-of-three at levels 2, 4, 6, 8. Auto-Laser capstone at level 10.
/** @type {Record<string, any>} */
const PERK_POOL = {
  LASER_SIGHT:     { name:'Laser Sight',     icon:'◎', desc:'Shows aim trajectory',                colour:'#00f5ff' },
  THREAT_SENSE:    { name:'Threat Sense',     icon:'⚠', desc:'Detects nearby off-screen foes',      colour:'#ff6644' },
  PIERCING_ROUNDS: { name:'Piercing Rounds',  icon:'⟫', desc:'Shots pierce one extra enemy',        colour:'#ff00c8' },
  ENERGY_SHIELD:   { name:'Energy Shield',    icon:'🛡', desc:'Absorbs one hit every 30s',           colour:'#4488ff' },
  VAMPIRIC:        { name:'Vampiric',         icon:'♥', desc:'Heal 2 HP per kill',                  colour:'#ff3366' },
  ADRENALINE:      { name:'Adrenaline',       icon:'⚡', desc:'+20% move speed',                     colour:'#39ff14' },
  RAPID_FIRE:      { name:'Rapid Fire',       icon:'»', desc:'-15% fire cooldown',                  colour:'#ffaa00' },
  CRITICAL_HIT:    { name:'Critical Hit',     icon:'✦', desc:'15% chance for 2× damage',            colour:'#ffdd00' },
  THICK_ARMOR:     { name:'Thick Armor',      icon:'█', desc:'+3 DEF',                              colour:'#88aacc' },
  BERSERKER:       { name:'Berserker',        icon:'🔥', desc:'+40% ATK below 25% HP',               colour:'#ff4400' },
  DASH_MASTER:     { name:'Dash Master',      icon:'⇒', desc:'Dash cooldown halved',                colour:'#ffb700' },
  HP_REGEN:        { name:'Nano Repair',      icon:'✚', desc:'Regen 1 HP every 3s',                 colour:'#00ff88' },
  EXPLOSIVE_KILLS: { name:'Explosive Kills',  icon:'💥', desc:'Enemies explode on death',            colour:'#ff6600' },
  MULTI_SHOT:      { name:'Multi-Shot',       icon:'⫸', desc:'Fire an extra 60%-damage projectile', colour:'#cc44ff' },
  SECOND_WIND:     { name:'Second Wind',      icon:'↺', desc:'Revive once per floor at 30% HP',     colour:'#00ddff' },
  PARRY:           { name:'Phase Parry',      icon:'⇄', desc:'Dash reflects enemy shots',           colour:'#aaffee' },
  LAST_STAND:      { name:'Last Stand',       icon:'⚔', desc:'Hit to ≤10% HP: +75% dmg, −50% taken (5s, 60s CD)', colour:'#ffcc00' },
  PRISTINE:        { name:'Pristine',          icon:'✧', desc:'+25% damage at or above 90% HP',       colour:'#88ffee' },
};
const PERK_CAPSTONE = { id:'AUTO_LASER', name:'Auto-Laser', icon:'⚡', desc:'Fires beam at nearest foe', colour:'#ff2222' };
const PERK_LEVELS = [2, 4, 6, 8]; // levels that trigger a perk choice

/**
 * @param {any} player
 * @param {any} count
 */
function rollPerkChoices(player, count) {
  const available = Object.keys(PERK_POOL).filter(id => !player.perks[id]);
  // Fisher-Yates shuffle, take first `count`
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [/** @type {string} */ (available[j]), /** @type {string} */ (available[i])];
  }
  return available.slice(0, Math.min(count, available.length));
}

/**
 * @param {any} player
 * @param {any} id
 */
function applyPerk(player, id) {
  player.perks[id] = true;
  const perk = PERK_POOL[id];
  if (id === 'ENERGY_SHIELD') player.energyShield = true;
  if (id === 'THICK_ARMOR') player.def += 3;
  if (perk) setTimeout(() => _CG.msg('⚡ PERK: '+perk.name, perk.colour), 200);
}

/**
 * @param {any} player
 */
function grantCapstone(player) {
  if (!player.perks.AUTO_LASER) {
    player.perks.AUTO_LASER = true;
    setTimeout(() => _CG.msg('⚡ CAPSTONE: '+PERK_CAPSTONE.name, PERK_CAPSTONE.colour), 200);
  }
}

// ─── Augments (Cybernetic Implants) ──────────────────────────────────────────
const MAX_AUGMENTS = 3;
/** @type {Record<string, any>} */
const AUGMENTS = {
  NEURAL_LINK:      { name:'Neural Link',         icon:'🧠', colour:'#cc44ff', desc:'+25% XP from all sources' },
  TITANIUM_PLATING: { name:'Titanium Plating',     icon:'🛡', colour:'#4488cc', desc:'Reduce all damage by 1' },
  MAGNETIC_FIELD:   { name:'Magnetic Field',       icon:'🧲', colour:'#44ff88', desc:'Double item pickup radius' },
  THERMAL_OPTICS:   { name:'Thermal Optics',       icon:'👁', colour:'#ffcc00', desc:'Enemies visible on minimap' },
  ADRENALINE_INJECTOR:{ name:'Adrenaline Injector',icon:'💉', colour:'#ff4444', desc:'Kill: +30% speed for 2s' },
  OVERCLOCKER:      { name:'Overclocker',          icon:'⚡', colour:'#00ddff', desc:'Hackware cooldowns −30%' },
  ECHO_MAPPER:      { name:'Echo Mapper',          icon:'📡', colour:'#ffffff', desc:'Reveal minimap layout on entry' },
  CREDIT_SIPHON:    { name:'Credit Siphon',        icon:'💰', colour:'#ffaa00', desc:'+50% credits from all sources' },
  SCAVENGER_NANITES:{ name:'Scavenger Nanites',    icon:'🔧', colour:'#88ff44', desc:'10% kill chance: +5 HP' },
  KINETIC_AMPLIFIER:{ name:'Kinetic Amplifier',    icon:'🚀', colour:'#ff8800', desc:'+20% projectile speed' },
  TEMPORAL_DILATION:{ name:'Temporal Dilation',     icon:'⏳', colour:'#88ccff', desc:'All enemies 15% slower' },
  REACTIVE_ARMOR:   { name:'Reactive Armor',        icon:'💥', colour:'#ff6644', desc:'When hit, emit damage pulse' },
  EMERGENCY_CACHE:  { name:'Emergency Cache',       icon:'🔋', colour:'#88ffaa', desc:'Enter floor <30% HP: heal to 50%' },
};
const AUGMENT_KEYS = Object.keys(AUGMENTS);
/**
 * @param {any} id
 */
function hasAugment(id) { return !!(_CG.player && _CG.player.augments[id]); }

/**
 * @param {any} player
 * @param {any} count
 */
function rollAugmentChoices(player, count) {
  const owned = player.augments || {};
  const available = AUGMENT_KEYS.filter(id => !owned[id]);
  // Fisher-Yates shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = rndInt(0, i);
    [available[i], available[j]] = [/** @type {string} */ (available[j]), /** @type {string} */ (available[i])];
  }
  return available.slice(0, count);
}

/**
 * @param {any} exclude
 */
function makeAugmentShopOption(exclude) {
  const owned = _CG.player ? _CG.player.augments || {} : {};
  const slots = Object.keys(owned).length;
  if (slots >= MAX_AUGMENTS) return null;
  const available = AUGMENT_KEYS.filter(id => !owned[id] && id !== exclude);
  if (!available.length) return null;
  const id = /** @type {string} */ (available[rndInt(0, available.length - 1)]);
  const aug = AUGMENTS[id];
  return {
    id: 'SHOP_AUG_' + id, name: aug.name, isAugment: true,
    desc: aug.icon + ' ' + aug.desc + ' [AUGMENT]',
    colour: aug.colour, price: 120 + (_CG.floor || 1) * 15,
    fn: (/** @type {any} */ p) => {
      // Guard: don't exceed max slots or install duplicates
      if (Object.keys(p.augments).length >= MAX_AUGMENTS || p.augments[id]) {
        _CG.msg('AUGMENT SLOTS FULL', '#993366');
        return;
      }
      p.augments[id] = true;
      audio.augmentInstall();
      _CG.msg(aug.icon + ' ' + aug.name + ' INSTALLED', aug.colour);
      spawnParticles(p.x, p.y, 'EXPLOSION', aug.colour, 12);
    }
  };
}

// ─── Floor Events (Risk/Reward Encounters) ──────────────────────────────────
const EVENTS = [
  { id:'STASIS_POD',         name:'Stasis Pod',          desc:'A cryo-pod hums with residual power. Frost clings to the glass.',
    icon:'❄', colour:'#66ccff',
    a:{ label:'WAKE',    desc:'Revive the occupant. They offer supplies.', summary:'+heal +XP' },
    b:{ label:'SALVAGE', desc:'Strip the pod for usable parts.',           summary:'+item' } },
  { id:'CORRUPTED_TERMINAL', name:'Corrupted Terminal',   desc:'A terminal sparks with corrupted data streams. Something is buried in the noise.',
    icon:'⌁', colour:'#ff4488',
    a:{ label:'HACK',    desc:'Extract the data. Risk of triggering alarms.', summary:'60% hackware / 40% alarm' },
    b:{ label:'PURGE',   desc:'Wipe the terminal. Sell the scrap.',           summary:'+credits' } },
  { id:'ARMS_CACHE',         name:'Arms Cache',           desc:'A sealed weapons locker with a cracked biometric reader.',
    icon:'⚔', colour:'#ff8844',
    a:{ label:'FORCE OPEN', desc:'Pry it open. The trap mechanism is still live.', summary:'+weapon −HP' },
    b:{ label:'BYPASS',     desc:'Reroute the lock. Takes what you can carry.',    summary:'+item' } },
  { id:'RADIATION_LEAK',     name:'Radiation Leak',        desc:'Green luminescence seeps from a cracked containment pipe. Your skin tingles.',
    icon:'☢', colour:'#44ff44',
    a:{ label:'ABSORB', desc:'Channel the radiation. Permanent cybernetic integration.', summary:'+augment −HP' },
    b:{ label:'SEAL',   desc:'Patch the leak. Collect the containment reward.',          summary:'+credits +score' } },
  { id:'ROGUE_AI',           name:'Rogue AI',              desc:'A fragmented AI personality flickers to life in the terminal. It watches you.',
    icon:'◉', colour:'#aa88ff',
    a:{ label:'LISTEN',  desc:'Let it share what it knows about this floor.',  summary:'reveal minimap' },
    b:{ label:'BARGAIN', desc:'Trade credits for concentrated data packets.',  summary:'−50◆ +XP' } },
  { id:'POWER_JUNCTION',     name:'Power Junction',        desc:'A sparking power distribution node. The air smells of ozone.',
    icon:'⚡', colour:'#ffcc00',
    a:{ label:'OVERLOAD', desc:'Send a surge through the floor\'s grid.',     summary:'stun+damage room enemies' },
    b:{ label:'SIPHON',   desc:'Drain the node into your systems.',           summary:'+heal 60%' } },
  { id:'GHOST_SIGNAL',       name:'Ghost Signal',          desc:'A faint encrypted transmission loops on repeat. Source: deeper in the facility.',
    icon:'📡', colour:'#44ffcc',
    a:{ label:'TRACE',   desc:'Decode the signal. Extract embedded data.',   summary:'+credits +XP' },
    b:{ label:'AMPLIFY', desc:'Boost the signal. The adrenaline spike is intense.', summary:'+combo ×5' } },
  { id:'EMERGENCY_DROP',     name:'Emergency Drop',        desc:'A supply pod is jammed in a ceiling vent. Red emergency lights still blink.',
    icon:'📦', colour:'#ff6666',
    a:{ label:'PRY OPEN', desc:'Force the pod open. Grab what falls out.', summary:'+heal +item' },
    b:{ label:'HOTWIRE',  desc:'Tap the pod\'s power cell for your systems.', summary:'reset hackware CD +credits' } },
];

/**
 * @param {any} player
 */
function rollEvent(player) {
  const available = EVENTS.filter(e => {
    if (e.id === 'RADIATION_LEAK' && Object.keys(player.augments || {}).length >= MAX_AUGMENTS) return false;
    if (e.id === 'ROGUE_AI' && player.credits < 50) return false;
    return true;
  });
  if (!available.length) return EVENTS[rndInt(0, EVENTS.length - 1)];
  return available[rndInt(0, available.length - 1)];
}

/**
 * @param {any} event
 * @param {any} choice
 * @param {any} player
 * @param {any} gm
 */
function applyEventEffect(event, choice, player, gm) {
  const floor = gm.floor;
  if (choice === 'a') {
    switch (event.id) {
      case 'STASIS_POD': {
        const heal = Math.round(player.maxHp * 0.4);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        const xp = 20 + floor * 8;
        player.gainXP(xp);
        gm.msg('+' + heal + ' HP, +' + xp + ' XP', '#66ccff');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#66ccff', 12);
        break;
      }
      case 'CORRUPTED_TERMINAL': {
        if (Math.random() < 0.6) {
          if (!player.hackware) {
            const hw = /** @type {string} */ (HACKWARE_KEYS[rndInt(0, HACKWARE_KEYS.length - 1)]);
            player.hackware = hw;
            player.hackwareCooldown = 0;
            gm.msg('HACKWARE: ' + HACKWARE[hw].name, HACKWARE[hw].colour);
            spawnParticles(player.x, player.y, 'EXPLOSION', HACKWARE[hw].colour, 12);
          } else {
            const cr = 60 + floor * 10;
            player.credits += cr;
            gm.msg('Data extracted: +' + cr + ' CR', '#ff4488');
          }
        } else {
          gm.msg('⚠ ALARM TRIGGERED!', '#ff2222');
          const room = gm.eventChoice.room;
          for (let i = 0; i < 3; i++) {
            const ex = room.cx + rnd(-3, 3), ey = room.cy + rnd(-3, 3);
            const e = spawnEnemy(pickEnemyType(floor), ex, ey, floor, room, false);
            if (e) enemies.push(e);
          }
          spawnParticles(player.x, player.y, 'EXPLOSION', '#ff2222', 15);
        }
        break;
      }
      case 'ARMS_CACHE': {
        const bases = WEAPON_KEYS.filter(k => k !== player.weapon._base);
        const baseKey = /** @type {string} */ (bases[rndInt(0, bases.length - 1)]);
        const _aw = rollWeapon(baseKey, Math.min(10, floor + 1));
        if (player.equipWeapon) player.equipWeapon(_aw);
        else player.weapon = _aw;
        const dmg = 15;
        player.takeDamage(dmg, 'Trap');
        gm.msg('NEW WEAPON: ' + player.weapon.name + ' (−' + dmg + ' HP)', '#ff8844');
        spawnParticles(player.x, player.y, 'SPARK', '#ff8844', 10);
        break;
      }
      case 'RADIATION_LEAK': {
        const owned = player.augments || {};
        const slots = Object.keys(owned).length;
        if (slots < MAX_AUGMENTS) {
          const available = AUGMENT_KEYS.filter(id => !owned[id]);
          if (available.length) {
            const id = /** @type {string} */ (available[rndInt(0, available.length - 1)]);
            player.augments[id] = true;
            audio.augmentInstall();
            gm.msg(AUGMENTS[id].icon + ' ' + AUGMENTS[id].name + ' INSTALLED', AUGMENTS[id].colour);
            spawnParticles(player.x, player.y, 'EXPLOSION', AUGMENTS[id].colour, 12);
          }
        }
        const dmg = 20;
        player.takeDamage(dmg, 'Radiation');
        break;
      }
      case 'ROGUE_AI': {
        const dungeon = gm.dungeon;
        for (let ty = 0; ty < MAP_H; ty++)
          for (let tx = 0; tx < MAP_W; tx++)
            if (!dungeon.secretMask[ty][tx] && dungeon.map[ty][tx] !== T.VOID)
              dungeon.visited[ty][tx] = 1;
        gm.markMinimapDirty();
        gm.msg('MAP DATA DOWNLOADED', '#aa88ff');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#aa88ff', 15);
        break;
      }
      case 'POWER_JUNCTION': {
        const room = gm.eventChoice.room;
        let stunned = 0;
        for (const e of enemiesInRoomIter(room)) {
          if (e.dead) continue;
          if (e._wrPhased) continue; // can't stun phased WRAITHs
          e.stunTimer = Math.max(e.stunTimer || 0, e.isBoss ? 1 : 3);
          const dmg = Math.min(e.hp - 1, 25);
          if (dmg > 0) e.takeDamage(dmg, 'Overload');
          stunned++;
        }
        gm.msg(stunned > 0 ? stunned + ' ENEMIES STUNNED' : 'NO TARGETS', '#ffcc00');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#ffcc00', 12);
        break;
      }
      case 'GHOST_SIGNAL': {
        const cr = 40 + floor * 12;
        const xp = 25 + floor * 8;
        player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        player.gainXP(xp);
        player.score += 100 * floor;
        gm.msg('+' + cr + ' CR, +' + xp + ' XP, +' + (100 * floor) + ' PTS', '#44ffcc');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#44ffcc', 12);
        break;
      }
      case 'EMERGENCY_DROP': {
        const heal = Math.round(player.maxHp * 0.3);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        items.push(new Item(player.x, player.y));
        gm.msg('+' + heal + ' HP + ITEM', '#ff6666');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#ff6666', 12);
        break;
      }
    }
  } else {
    switch (event.id) {
      case 'STASIS_POD': {
        items.push(new Item(player.x, player.y));
        gm.msg('SALVAGED: ITEM DROP', '#66ccff');
        spawnParticles(player.x, player.y, 'SPARK', '#66ccff', 8);
        break;
      }
      case 'CORRUPTED_TERMINAL': {
        const cr = 50 + floor * 10;
        player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        gm.msg('+' + cr + ' CR (purged)', '#ff4488');
        spawnParticles(player.x, player.y, 'SPARK', '#ff4488', 8);
        // UNCHAINED #41: rare-terminal log-fragment drop (40% if eligible).
        // Runs BEFORE the module drop — logs and modules are mutually
        // exclusive per spec ("logs never collide with module drops").
        const gotLog = tryRareTerminalLogDrop(gm, player);
        if (!gotLog) {
          // UNCHAINED #39: 50% chance the rare-terminal reward is a core
          // instead of a module. Same slot as the module roll — cores and
          // modules are mutually exclusive per the #39 spec.
          if (Math.random() < 0.50 && typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
            NEON.cores.spawnCoreDrop(gm, player.x, player.y, 1);
            gm.msg('CORE FRAGMENT SALVAGED', '#a866ff');
            spawnParticles(player.x, player.y, 'SPARK', '#a866ff', 10);
          } else {
            // UNCHAINED #37: rare-terminal module drop chance (floor 2+).
            tryRareTerminalModuleDrop(gm, player);
          }
        }
        break;
      }
      case 'ARMS_CACHE': {
        items.push(new Item(player.x, player.y));
        gm.msg('BYPASSED: ITEM DROP', '#ff8844');
        spawnParticles(player.x, player.y, 'SPARK', '#ff8844', 8);
        break;
      }
      case 'RADIATION_LEAK': {
        const cr = 60 + floor * 12;
        player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        player.score += 150 * floor;
        gm.msg('+' + cr + ' CR, +' + (150 * floor) + ' PTS', '#44ff44');
        spawnParticles(player.x, player.y, 'SPARK', '#44ff44', 8);
        break;
      }
      case 'ROGUE_AI': {
        if (player.credits >= 50) {
          player.credits -= 50;
          const xp = 60 + floor * 12;
          player.gainXP(xp);
          gm.msg('−50 CR → +' + xp + ' XP', '#aa88ff');
        } else {
          gm.msg('NOT ENOUGH CREDITS', '#993366');
        }
        spawnParticles(player.x, player.y, 'SPARK', '#aa88ff', 8);
        break;
      }
      case 'POWER_JUNCTION': {
        const heal = Math.round(player.maxHp * 0.6);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        gm.msg('+' + heal + ' HP', '#ffcc00');
        spawnParticles(player.x, player.y, 'SPARK', '#00ff88', 10);
        break;
      }
      case 'GHOST_SIGNAL': {
        combo.count = 5;
        combo.timer = 3;
        combo.flashTimer = 0.3;
        gm.msg('SIGNAL BOOST: COMBO ×' + comboMultiplier().toFixed(1), '#44ffcc');
        spawnParticles(player.x, player.y, 'SPARK', '#44ffcc', 10);
        break;
      }
      case 'EMERGENCY_DROP': {
        if (player.hackware) {
          player.hackwareCooldown = 0;
          const cr = 30 + floor * 8;
          player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
          gm.msg('HACKWARE RESET + ' + cr + ' CR', '#ff6666');
        } else {
          const cr = 60 + floor * 10;
          player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
          gm.msg('+' + cr + ' CR (no hackware)', '#ff6666');
        }
        spawnParticles(player.x, player.y, 'SPARK', '#ff6666', 8);
        break;
      }
    }
  }
}

// ─── Vendor / Shop ───────────────────────────────────────────────────────────
// Shop prices are explicit per upgrade id (not derived from rarity which is spawn weight)
/** @type {Record<string, any>} */
const SHOP_PRICES = {
  MED_PACK:60, NANO_REPAIR:35, XP_CHIP:45,
  SAW_BLADE:120, PLASMA_ORB:130, NANO_REGEN:80, OVERCLOCK:110, ARMOR_UP:100, RICOCHET:115
};
/**
 * @param {any} id
 * @param {any} floor
 * @param {any} playerUpgrades
 */
function shopPrice(id, floor, playerUpgrades) {
  const base = SHOP_PRICES[id] || 80;
  const lvl = (playerUpgrades && playerUpgrades[id]) || 0;
  return Math.floor((base + floor * 5) * (1 + lvl * 0.4));
}

/**
 * @param {any} floor
 * @param {any} player
 * @param {any} dungeon
 */
function generateShopItems(floor, player, dungeon) {
  const pool = [];
  // Always offer a heal option
  pool.push({
    id:'SHOP_HEAL', name:'Full Repair', desc:'Restore all HP',
    colour:'#00ff88', price: 50 + floor * 12,
    fn: (/** @type {any} */ p) => { p.hp = p.maxHp; _CG.msg('Fully repaired!','#00ff88'); }
  });
  // Offer a key if the floor has locked doors the player can't open
  if (dungeon) {
    /** @type {any[]} */ const neededColours = [];
    for (let ty=0; ty<MAP_H; ty++) for (let tx=0; tx<MAP_W; tx++) {
      const t = dungeon.map[ty][tx];
      const kc = doorKeyColour(t);
      if (kc && player.keys[kc] <= 0 && !neededColours.includes(kc)) neededColours.push(kc);
    }
    if (neededColours.length > 0) {
      const kc = neededColours[rndInt(0, neededColours.length - 1)];
      const tileCol = kc==='red'?'#ff3333':kc==='blue'?'#3388ff':'#ffcc00';
      pool.push({
        id:'SHOP_KEY_'+kc.toUpperCase(), name:kc.charAt(0).toUpperCase()+kc.slice(1)+' Key',
        desc:'Unlocks '+kc+' doors', colour:tileCol, price: 80 + floor * 8,
        fn: (/** @type {any} */ p) => { p.keys[kc]++; _CG.msg('Bought '+kc.toUpperCase()+' KEY!', tileCol); }
      });
    }
  }
  // Offer a hackware module on floor 3+ (~40% chance per vendor)
  if (floor >= 3 && Math.random() < 0.4) {
    const hwKey = /** @type {string} */ (HACKWARE_KEYS[rndInt(0, HACKWARE_KEYS.length - 1)]);
    const hw = HACKWARE[hwKey];
    const replaces = player.hackware ? HACKWARE[player.hackware] : null;
    pool.push({
      id:'SHOP_HW_'+hwKey, name:hw.name, isHackware:true,
      desc:hw.desc + (replaces ? ' [replaces '+replaces.name+']' : ''),
      colour:hw.colour, price: 90 + floor * 10,
      fn: (/** @type {any} */ p) => { p.hackware=hwKey; p.hackwareCooldown=0; _CG.msg(hw.icon+' '+hw.name+' INSTALLED',hw.colour); }
    });
  }
  // Offer an augment on floor 3+ (~20% chance, if player has room)
  if (floor >= 3 && Math.random() < 0.2) {
    const augOpt = makeAugmentShopOption(null);
    if (augOpt) pool.push(augOpt);
  }
  // UNCHAINED #38: temp-boost consumables replace permanent in-run upgrades.
  // Fill ~2 of the 3 slots with random picks from the boost pool. These are
  // floor-scoped (or instant one-shots) and never grant permanent growth.
  const boostKeys = (typeof NEON !== 'undefined' && NEON.boosts) ? NEON.boosts.BOOST_KEYS.slice() : [];
  // Shuffle boost keys for variety across vendors.
  for (let i = boostKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = boostKeys[i]; boostKeys[i] = boostKeys[j]; boostKeys[j] = t;
  }
  const usedIds = new Set(pool.map(p => p.id));
  for (const bk of boostKeys) {
    if (pool.length >= 3) break;
    const bid = 'BOOST_' + bk;
    if (usedIds.has(bid)) continue;
    const b = NEON.boosts.BOOSTS[bk];
    // Skip non-vendor boosts (mob-drop only — e.g. HARVEST_SURGE has no
    // price; selling it would NaN the cost and break the rule that mob
    // drops are earned not purchased).
    if (!b || typeof b.price !== 'number') continue;
    pool.push({
      id: bid, name: b.name, desc: b.desc, colour: b.colour,
      price: b.price + Math.floor(floor * 2), // mild floor scaling keeps late-game meaningful
      isBoost: true, boostId: bk, icon: b.icon,
      fn: (/** @type {any} */ p) => {
        NEON.boosts.applyBoost(p, bk);
        // UNCHAINED #38: RECON PING flips the runtime minimap reveal
        // immediately (loadFloor already honours the flag on floor entry).
        if (bk === 'RECON_PING') { _CG.mapRevealed = true; _CG._minimapDirty = true; }
        _CG.msg(b.icon + ' ' + b.name, b.colour);
      }
    });
    usedIds.add(bid);
  }
  // Backfill from the non-persistent UPGRADES pool (consumables only — heals,
  // XP chips, void shards). Permanent stat growth is no longer sold for
  // credits (UNCHAINED #38).
  const nonPersistentPool = (typeof NEON !== 'undefined' && NEON.boosts)
    ? NEON.boosts.filterVendorPool(UPGRADES)
    : UPGRADES.filter(u => !u.persistent && u.id !== 'CREDIT_CACHE');
  const used = usedIds;
  const eligible = nonPersistentPool.filter((/** @type {any} */ u) => !used.has(u.id));
  // Shuffle eligible and pick enough to fill 3 total slots
  const shuffled = eligible.sort(() => Math.random() - 0.5);
  while (pool.length < 3 && shuffled.length > 0) {
    const u = shuffled.pop();
    const price = shopPrice(u.id, floor, player ? player.upgrades : {});
    pool.push({
      id:u.id, name:u.name, desc:u.desc, colour:u.colour, price,
      fn: u.fn, persistent:u.persistent, maxLevel:u.maxLevel, levelDesc:u.levelDesc
    });
  }
  // If still < 3, add a weapon option
  while (pool.length < 3) {
    const wo = makeWeaponOption();
    pool.push({ ...wo, price: 70 + floor * 6 });
  }
  return pool.slice(0, 3).map(item => ({ ...item, sold: false }));
}

// HARVESTER drop — pulses, decays after 5s if uncollected. Picking it up
// applies HARVEST_SURGE (+50% damage for 8s — see src/meta/boosts.js). Shape
// is a diamond core wrapped in a pulsing surge ring so it's distinguishable
// at a glance from a plain Item or KeyItem; orange-amber palette matches the
// HARVESTER mob's body colour for source attribution.
class HarvestPickup {
  /**
   * @param {any} x
   * @param {any} y
   */
  constructor(x, y) {
    this.x = x; this.y = y;
    this.dead = false;
    this.bob = Math.random() * TWO_PI;
    this.isHarvest = true;
    // Decays after 5s if uncollected. Tracks remaining time so the draw
    // branch can flash + alpha-fade in the last second to telegraph imminent
    // expiry — the player decides whether the dash is worth it.
    this.ttl = 5;
  }
  /** @param {any} dt */
  update(dt) {
    this.bob += dt * 3.5;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    if (this.dead) return;
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 3;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.6 + 0.4 * Math.sin(this.bob * 1.6);
    // Last-second urgency: rapid alpha flicker once ttl < 1.0.
    const urgent = this.ttl < 1.0;
    const flick = urgent ? (0.3 + 0.7 * Math.abs(Math.sin(this.bob * 14))) : 1;
    ctx.save();
    ctx.shadowBlur = 10 + 12 * pulse;
    ctx.shadowColor = '#ff9933';
    ctx.globalAlpha = (0.7 + 0.3 * pulse) * flick;
    // Outer surge ring — clearly different from Item's static diamond.
    ctx.strokeStyle = '#ffcc66';
    ctx.lineWidth = 1.5;
    NEON.draw.circleStroke(ctx, sx, sy, 7 + 1.5 * pulse);
    // Inner diamond core
    ctx.fillStyle = '#ff9933';
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  }
}

// MagpieHoard — hoard pickup dropped by MAGPIE on death. Grants the
// total credit value the thief banked across all the items it consumed
// during its life. Hand-rolled (instead of reusing CREDIT_CACHE)
// because CREDIT_CACHE.fn() recomputes the amount from current floor +
// meta multipliers — which would be wrong here: we want to refund the
// EXACT value the thief banked. Auto-collected via an `isHoard` branch
// in game.js's pickup loop (mirrors the isHarvest pattern). The pickup
// sits on the floor visibly so the player has to actually walk to the
// thief's death spot — a small "go fetch" beat that makes the kill
// feel earned. No TTL: hoard pickups persist for the rest of the
// floor (so a long detour to clear other enemies first doesn't lose
// the recovery).
class MagpieHoard {
  /**
   * @param {any} x
   * @param {any} y
   * @param {number} amt   credit value to grant on pickup
   */
  constructor(x, y, amt) {
    this.x = x; this.y = y;
    this.dead = false;
    this.bob = Math.random() * TWO_PI;
    this.isHoard = true;
    this.amt = Math.max(0, Math.round(amt || 0));
  }
  /** @param {any} dt */
  update(dt) { this.bob += dt * 3; }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    if (this.dead) return;
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 3;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.6 + 0.4 * Math.sin(this.bob * 1.5);
    ctx.save();
    ctx.shadowBlur = 10 + 12 * pulse;
    ctx.shadowColor = '#ffd700';
    ctx.globalAlpha = 0.75 + 0.25 * pulse;
    // Outer ring — pale silver-blue (MAGPIE colour) so the player
    // recognises it as "the thief's hoard" at a glance.
    ctx.strokeStyle = '#cceeff';
    ctx.lineWidth = 1.5;
    NEON.draw.circleStroke(ctx, sx, sy, 7 + 1.5 * pulse);
    // Inner gold square — currency glyph.
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(sx - 3, sy - 3, 6, 6);
    ctx.restore();
  }
}

// VaultCoin — credit pickup ejected by VAULTMASTER. Two flavours, both
// constructed via `new VaultCoin(x, y, amt)`:
//   - per-hit ejection (small): amt = VAULTMASTER_COIN_AMT (5)
//   - on-death jackpot (large): amt = VAULTMASTER_JACKPOT_AMT (25)
// Visual scales with amt so the player reads "small drop" vs "fat
// jackpot" at a glance. Auto-collected via the `isHoard` branch in
// game.js's pickup loop (mirrors MagpieHoard); also flagged isHoard so
// MAGPIE's loot-scan filter excludes it (`if (it.isHoard) continue;`
// at entities.js aiMagpie ~2315) — otherwise a passing thief could
// vacuum the vault drops mid-fight, which would feel like a bug
// rather than counterplay. Hand-rolled (instead of reusing CREDIT_CACHE
// or the Item-with-CREDIT-type approach) for the same reason as
// MagpieHoard: we want a fixed, exact amount granted on collection,
// not a floor-recomputed value. No TTL — coins persist for the rest
// of the floor so milking-then-clearing-the-room-first is a valid
// economic play (matches MagpieHoard's no-TTL choice for the same
// "earn the recovery" beat). Distinct visual from MagpieHoard:
// pure gold ring + inner gold core (no MAGPIE silver-blue), so the
// player reads vault-drops as a different economic source.
class VaultCoin {
  /**
   * @param {any} x
   * @param {any} y
   * @param {number} amt   credit value to grant on pickup
   */
  constructor(x, y, amt) {
    this.x = x; this.y = y;
    this.dead = false;
    this.bob = Math.random() * TWO_PI;
    this.isHoard = true;
    this.amt = Math.max(0, Math.round(amt || 0));
    // Visual size hint — used to scale the ring radius. Coin (5cr) reads
    // as small + abundant; jackpot (25cr) reads as fat + singular.
    this._big = this.amt >= 15;
  }
  /** @param {any} dt */
  update(dt) { this.bob += dt * 3; }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    if (this.dead) return;
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 3;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.6 + 0.4 * Math.sin(this.bob * 1.5);
    const ringR = (this._big ? 7 : 4.5) + (this._big ? 1.5 : 1) * pulse;
    const coreSz = this._big ? 6 : 4;
    ctx.save();
    ctx.shadowBlur = (this._big ? 12 : 7) + 10 * pulse;
    ctx.shadowColor = '#ffd700';
    ctx.globalAlpha = 0.75 + 0.25 * pulse;
    // Outer ring — pure gold (distinct from MagpieHoard's silver-blue
    // ring, so the player reads "vault loot" not "thief loot").
    ctx.strokeStyle = '#ffe680';
    ctx.lineWidth = 1.5;
    NEON.draw.circleStroke(ctx, sx, sy, ringR);
    // Inner gold core.
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(sx - coreSz / 2, sy - coreSz / 2, coreSz, coreSz);
    ctx.restore();
  }
}

// SHOCK_PULSE pickup — defensive panic-button consumable. Auto-collected on
// player contact (mirrors HealthPack-style pickup feedback). Discharges an
// AoE knockback + brief stun centred on the player. NON-DAMAGING — the
// payoff is positional / tempo (panic-eject a swarm, regain footing) rather
// than DPS. Distinct from MAGPIE/VAULTMASTER pickups (currency) and
// HARVESTER pickup (timed buff): this one has an immediate spatial/control
// effect and no lingering boost.
//
// Design notes:
//  - Floor-gated to floor 3+ via populateFloor placement (matches mines).
//  - Spawn rate ~30% per floor with a once-per-floor cap (rare panic
//    button, not a stack-and-spam consumable).
//  - LOS-gated knockback so enemies behind walls aren't shoved around the
//    geometry. Same gate other AoE helpers use (LEAPER shockwave, mine
//    explode), keeps "what you can see is what you affect" parity.
//  - Bosses: brief stun (boss stunTimer cap = 0.3s already enforced
//    elsewhere) but NO knockback — boss positioning is a designed
//    encounter constraint and shoving them breaks arena flow.
//  - No TTL — sits on the floor until claimed (matches MagpieHoard /
//    VaultCoin choice; the player decides when to use it).
const SHOCK_PULSE_RADIUS = 5.0;       // tiles
const SHOCK_PULSE_STUN   = 1.0;       // seconds (capped to 0.3 for bosses by takeDamage path; we apply directly)
const SHOCK_PULSE_BOSS_STUN = 0.3;    // explicit shorter cap for bosses
const SHOCK_PULSE_KNOCK  = 2.5;       // tiles of impulse displacement
class ShockPulsePickup {
  /**
   * @param {any} x
   * @param {any} y
   */
  constructor(x, y) {
    this.x = x; this.y = y;
    this.dead = false;
    this.bob = Math.random() * TWO_PI;
    this.isShockPulse = true;
  }
  /** @param {any} dt */
  update(dt) { this.bob += dt * 4; }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    if (this.dead) return;
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 3;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.5 + 0.5 * Math.sin(this.bob * 1.4);
    ctx.save();
    ctx.shadowBlur = 10 + 14 * pulse;
    ctx.shadowColor = '#66e0ff';
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    // Two concentric arc rings — "stored shockwave" silhouette, distinct
    // from VaultCoin's solid gold ring + core and HarvestPickup's diamond.
    ctx.strokeStyle = '#aaf0ff';
    ctx.lineWidth = 1.5;
    NEON.draw.circleStroke(ctx, sx, sy, 7 + 1.5 * pulse);
    ctx.strokeStyle = '#66e0ff';
    ctx.lineWidth = 1;
    NEON.draw.circleStroke(ctx, sx, sy, 3.5 + 0.8 * pulse);
    // Central spark — small bright dot.
    ctx.fillStyle = '#e8faff';
    ctx.fillRect(sx - 1, sy - 1, 2, 2);
    ctx.restore();
  }
}

class Item {
  /**
   * @param {any} x
   * @param {any} y
   * @param {any} [type]
   */
  constructor(x,y,type) {
    this.x=x; this.y=y; this.type=type||pickItemType();
    this.dead=false; this.bob=Math.random()*TWO_PI; this.isKey=false;
  }
  /**
   * @param {any} dt
   */
  update(dt) { this.bob+=dt*2.5; }
  /**
   * @param {any} camX
   * @param {any} camY
   */
  draw(camX,camY) {
    const tx=Math.floor(this.x), ty=Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 3;
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY+bobY;
    const pulse = 0.65 + 0.35 * Math.sin(this.bob * 1.3);
    ctx.save();
    ctx.shadowBlur = 8 + 10 * pulse;
    ctx.shadowColor = this.type.colour;
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    ctx.fillStyle = this.type.colour;
    // Diamond shape (rotated square) — visually distinct from enemy squares.
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4.5, -4.5, 9, 9);
    ctx.restore();
  }
}

class KeyItem {
  /**
   * @param {any} x
   * @param {any} y
   * @param {any} colour
   * @param {any} tileColour
   */
  constructor(x,y,colour,tileColour) {
    this.x=x; this.y=y;
    this.colour=colour; // 'red','blue','gold'
    this.tileColour=tileColour;
    this.dead=false; this.bob=Math.random()*TWO_PI; this.isKey=true;
  }
  /**
   * @param {any} dt
   */
  update(dt) { this.bob+=dt*2; }
  /**
   * @param {any} camX
   * @param {any} camY
   */
  draw(camX,camY) {
    const tx=Math.floor(this.x), ty=Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY+Math.sin(this.bob)*3;
    ctx.save();
    ctx.shadowBlur=15; ctx.shadowColor=this.tileColour;
    ctx.fillStyle=this.tileColour;
    // Key shape: circle + teeth
    NEON.draw.circle(ctx, sx, sy-3, 5);
    ctx.fillRect(sx-1.5, sy, 3, 8);
    ctx.fillRect(sx, sy+3, 4, 2);
    ctx.fillRect(sx, sy+6, 3, 2);
    ctx.restore();
  }
}

// Whispers subplot — pickup that triggers the narrative fragment in the
// ARCHIVE (src/data/whispers.js + src/meta/whispers.js). Visually distinct
// from KeyItem: pulsing violet glyph (the cryptic-fragment colour echoes the
// 'WHISPERS: N/M' counter in hub.js Archive). isWhisper flag drives the
// pickup branch in src/game.js.
class WhisperItem {
  /**
   * @param {any} x
   * @param {any} y
   * @param {string} whisperId
   */
  constructor(x, y, whisperId) {
    this.x = x; this.y = y;
    this.whisperId = whisperId;
    this.dead = false;
    this.bob = Math.random() * TWO_PI;
    this.isWhisper = true;
  }
  /** @param {any} dt */
  update(dt) { this.bob += dt * 1.6; }
  /** @param {any} camX @param {any} camY */
  draw(camX, camY) {
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (!_CG.dungeon?.visible?.[ty]?.[tx]) return;
    const bobY = Math.sin(this.bob) * 2.5;
    const sx = this.x * TILE - camX, sy = this.y * TILE - camY + bobY;
    const pulse = 0.55 + 0.45 * Math.sin(this.bob * 1.4);
    ctx.save();
    ctx.shadowBlur = 6 + 12 * pulse;
    ctx.shadowColor = '#aa66cc';
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    ctx.fillStyle = '#cc99ee';
    // Hexagonal/diamond glyph — clearly NOT a key (no teeth) and NOT a
    // generic Item diamond (slightly larger, vertical orientation).
    NEON.draw.circle(ctx, sx, sy, 4 + 1.2 * pulse);
    ctx.fillStyle = '#552277';
    ctx.fillRect(sx - 0.8, sy - 5, 1.6, 10);
    ctx.fillRect(sx - 5, sy - 0.8, 10, 1.6);
    ctx.restore();
  }
}

// ─── UNCHAINED #37: Upgrade Module drop hook ────────────────────────────────
// Called from the CORRUPTED_TERMINAL PURGE branch. Rolls against the rare-
// terminal drop table (25% chance, floor 2+), pushes the module onto the
// transient run array, plays the pickup jingle, and toasts the HUD.
// NOTE: The boss-drop equivalent is intentionally not wired in this PR —
// see issue #37 body ("#39 can do the boss hook; may be split").
/**
 * @param {any} gm
 * @param {any} player
 */
function tryRareTerminalModuleDrop(gm, player) {
  if (!gm || (gm.floor|0) < 2) return;
  if (typeof NEON === 'undefined' || !NEON.modules) return;
  const id = NEON.modules.rollModuleDrop({ source: 'rare-terminal' });
  if (!id) return;
  NEON.modules.addRunPickup(gm, id);
  const mod = NEON.modules.getModule(id);
  const name = mod ? mod.name : id;
  gm.msg('+ MODULE: ' + name, '#66ffcc');
  try { if (typeof audio !== 'undefined' && audio.moduleFound) audio.moduleFound(); } catch (_) {}
  if (player) spawnParticles(player.x, player.y, 'EXPLOSION', '#66ffcc', 14);
}

// ─── UNCHAINED #41: ARCHIVE log-fragment drop hook ──────────────────────────
// Rolls a 40% chance for a predecessor log on CORRUPTED_TERMINAL PURGE. If an
// eligible log (biome-matched, unfound, floor-gated) exists, marks it found,
// routes the body into the existing READING overlay, and plays audio.logFound.
// Returns true if a log was awarded (caller should then SKIP the module roll —
// logs and modules are mutually exclusive per spec).
const _LOG_DROP_CHANCE = 0.40;
/**
 * @param {any} gm
 * @param {any} player
 */
function tryRareTerminalLogDrop(gm, player) {
  if (!gm) return false;
  if (typeof NEON === 'undefined' || !NEON.logs) return false;
  if (Math.random() >= _LOG_DROP_CHANCE) return false;
  const log = NEON.logs.pickLogForFloor(gm.floor | 0);
  if (!log) return false;
  try { NEON.logs.findLog(log.id); } catch (_) {}
  try { NEON.logs.readLog(log.id); } catch (_) {}
  gm.msg('▒ SIGNAL FRAGMENT RECOVERED — AXIOM-' + log.axiom, '#39ff14');
  try { if (typeof audio !== 'undefined' && audio.logFound) audio.logFound(); } catch (_) {}
  if (player) spawnParticles(player.x, player.y, 'EXPLOSION', '#39ff14', 14);
  // Display the body via the existing READING overlay (same path as T.LORE).
  try {
    gm.currentLore = 'AXIOM-' + log.axiom + ' — ' + log.title + ': ' + log.body;
    if (typeof gm.setState === 'function') gm.setState('READING');
  } catch (_) { /* Node tests / stub game */ }
  return true;
}
