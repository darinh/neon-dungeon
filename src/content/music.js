// @ts-check
'use strict';

// Procedural gameplay soundtrack and rendered title/menu music controller.
// Loaded before src/content.js so the global `music` surface remains stable
// for platform.js and game.js while audio state lives in its own module.

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
  /** @type {any} */ let titleAudio = null;
  let titleWanted = false;
  let titleRetryAt = 0;
  let droneGen = 0;
  let motifCursor = 0;

  const TITLE_THEME_SRC = './assets/audio/title-theme.wav';
  const TITLE_THEME_GAIN = 0.28;

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

  function syncTitleVolume() {
    if (!titleAudio) return;
    titleAudio.volume = clamp(settings.musicVol * TITLE_THEME_GAIN, 0, 1);
  }

  function ensureTitleAudio() {
    if (titleAudio || typeof Audio === 'undefined') return titleAudio;
    titleAudio = new Audio(TITLE_THEME_SRC);
    titleAudio.loop = true;
    titleAudio.preload = 'auto';
    syncTitleVolume();
    return titleAudio;
  }

  /**
   * @param {boolean} force
   */
  function tryPlayTitle(force) {
    if (!titleWanted) return;
    const a = ensureTitleAudio();
    if (!a) return;
    syncTitleVolume();
    if (!a.paused) return;
    const now = Date.now();
    if (!force && now < titleRetryAt) return;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => { titleRetryAt = 0; }).catch(() => { titleRetryAt = Date.now() + 1000; });
    }
  }

  /** @param {boolean} reset */
  function stopTitle(reset) {
    titleWanted = false;
    titleRetryAt = 0;
    if (!titleAudio) return;
    titleAudio.pause();
    if (reset) {
      try { titleAudio.currentTime = 0; } catch (_) {}
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
    for (let i = 0; i < hLen; i++) hd[i] = rand('cosmetic') * 2 - 1;

    const aLen = Math.ceil(ctx.sampleRate * 0.8);
    airBuf = ctx.createBuffer(1, aLen, ctx.sampleRate);
    const ad = airBuf.getChannelData(0);
    for (let i = 0; i < aLen; i++) ad[i] = (rand('cosmetic') * 2 - 1) * (1 - i / aLen);
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
    if (step % 16 === 0) motifCursor = (motifCursor + 1 + (rand('cosmetic') < 0.26 ? 1 : 0)) % bank.length;
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
    if (step % 8 !== 0 || rand('cosmetic') > (state === 'boss' ? 0.7 : 0.45)) return;
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
    src.connect(bp); bp.connect(g); g.connect(withPan(droneG, rand('cosmetic') * 0.4 - 0.2, 0.8));
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
      if (s === 'menu') {
        if (state !== 'idle') {
          state = 'idle';
          paused = false;
          rampGains(0.6);
          const gen = ++droneGen;
          setTimeout(() => { if (state === 'idle' && droneGen === gen) stopDrone(); }, 900);
        }
        titleWanted = true;
        tryPlayTitle(false);
        return;
      }
      stopTitle(true);
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
      if (titleWanted) {
        tryPlayTitle(true);
        return;
      }
      if (!ctx || !paused) return;
      paused = false;
      nextStep = ctx.currentTime + 0.06;
      rampGains(0.45);
    },

    tick() {
      if (titleWanted) {
        tryPlayTitle(false);
        return;
      }
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
    },

    isTitlePlaying() {
      return titleWanted && !!titleAudio && !titleAudio.paused;
    },

    /**
     * @param {number} _v
     */
    setVolume(_v) {
      syncTitleVolume();
    }
  };
})();
