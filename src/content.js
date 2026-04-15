'use strict';

// ─── Procedural Music ────────────────────────────────────────────────────────
const music = (() => {
  let bus = null, ctx = null;
  let state = 'idle';
  let floor = 1;
  let nextStep = 0, step = 0;
  let paused = false;
  let hatBuf = null, airBuf = null;
  let droneGen = 0;
  let motifCursor = 0;

  // Layer gain nodes
  let droneG = null, pulseG = null, arpG = null, bassG = null;
  // Persistent drone synth parts
  let droneOscA = null, droneOscB = null, droneSub = null, droneFilter = null, droneLFO = null, droneLfoDepth = null;

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  const TIERS = [
    { root: 36, bpm: 92,  scale: [0, 2, 3, 5, 7, 8, 10] }, // C minor
    { root: 34, bpm: 102, scale: [0, 2, 3, 5, 7, 8, 10] }, // Bb minor
    { root: 32, bpm: 112, scale: [0, 2, 3, 5, 7, 8, 10] }, // Ab minor
    { root: 29, bpm: 122, scale: [0, 1, 3, 5, 7, 8, 10] }, // F phrygian tint
  ];

  const STATE_SPEED = { idle: 0.85, explore: 1.0, tension: 1.08, combat: 1.18, boss: 1.26 };
  const SWING = { idle: 0, explore: 0.02, tension: 0.04, combat: 0.06, boss: 0.08 };

  // Target gains per music state [drone, pulse, arp, bass]
  const TARGETS = {
    idle:    [0, 0, 0, 0],
    explore: [0.95, 0.3, 0.62, 0.3],
    tension: [0.85, 0.55, 0.42, 0.48],
    combat:  [0.72, 1.0, 0.5, 0.9],
    boss:    [1.0, 1.0, 0.38, 1.0],
  };

  const PROGRESSIONS = {
    idle:    [0, 5, 3, 4],
    explore: [0, 3, 5, 4],
    tension: [0, 2, 5, 4],
    combat:  [0, 6, 5, 3],
    boss:    [0, 6, 1, 5],
  };

  const RHYTHM = {
    explore: { kick: [0, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14], open: [15] },
    tension: { kick: [0, 6, 8, 11, 14], snare: [4, 12], hat: [2, 4, 6, 8, 10, 12, 14], open: [15] },
    combat:  { kick: [0, 3, 6, 8, 11, 14], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], open: [6, 14] },
    boss:    { kick: [0, 2, 5, 8, 10, 13], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], open: [7, 15] },
  };

  const MOTIFS = {
    explore: [
      [0, 2, 4, null, 2, 1, 2, 4, 5, null, 4, 2, 1, null, 0, null],
      [0, 1, 3, 4, null, 3, 1, null, 2, 3, 5, null, 4, 3, 1, null],
      [0, null, 2, 4, 5, 4, 2, null, 1, 2, 4, null, 3, 2, 1, null],
    ],
    tension: [
      [0, 1, 3, null, 4, 3, 1, null, 2, 1, 0, null, 5, 4, 2, null],
      [0, null, 1, 3, 4, null, 3, 1, 2, null, 1, 0, 5, null, 3, 1],
    ],
    combat: [
      [0, 4, 2, 5, 4, 2, 1, null, 0, 2, 4, 5, 4, 2, 1, null],
      [0, 2, 4, 6, 5, 4, 2, 1, 0, 2, 3, 5, 4, 3, 1, null],
    ],
    boss: [
      [0, 5, 4, 2, 1, 2, 4, 5, 6, 5, 4, 2, 1, null, 0, null],
      [0, 4, 5, 6, 5, 4, 2, 1, 0, 2, 4, 5, 6, 5, 3, null],
    ],
  };

  const BASS_PATTERNS = {
    explore: [0, null, null, null, 2, null, null, null, 4, null, null, null, 2, null, null, null],
    tension: [0, null, 1, null, 2, null, 1, null, 4, null, 2, null, 1, null, null, null],
    combat:  [0, null, 4, null, 2, null, 1, null, 0, null, 4, null, 2, null, 1, null],
    boss:    [0, null, 0, null, 5, null, 4, null, 0, null, 0, null, 6, null, 4, null],
  };

  const DRONE_TONE = {
    idle:    { cutoff: 120, q: 1.2, lfoRate: 0.08, lfoDepth: 40 },
    explore: { cutoff: 210, q: 1.8, lfoRate: 0.11, lfoDepth: 72 },
    tension: { cutoff: 250, q: 2.2, lfoRate: 0.14, lfoDepth: 90 },
    combat:  { cutoff: 310, q: 2.6, lfoRate: 0.17, lfoDepth: 110 },
    boss:    { cutoff: 420, q: 3.0, lfoRate: 0.2, lfoDepth: 130 },
  };

  function tier() { return floor <= 3 ? 0 : floor <= 6 ? 1 : floor <= 9 ? 2 : 3; }
  function params() { return TIERS[tier()]; }

  function stepDur() {
    const baseQuarter = 60 / params().bpm;
    return (baseQuarter / (STATE_SPEED[state] || 1)) / 4; // 16th-note grid
  }

  function degreeToSemi(deg) {
    const sc = params().scale;
    const idx = ((deg % 7) + 7) % 7;
    const oct = Math.floor(deg / 7);
    return sc[idx] + oct * 12;
  }

  function progression() { return PROGRESSIONS[state] || PROGRESSIONS.explore; }

  function chordDegree(stepIx) {
    const prog = progression();
    const bar = Math.floor(stepIx / 16);
    return prog[bar % prog.length];
  }

  function noteFromDegree(deg, oct) {
    return midi(params().root + (oct || 0) * 12 + degreeToSemi(deg));
  }

  function withPan(target, pan, lifetime) {
    const out = target || bus;
    if (!ctx || !ctx.createStereoPanner || Math.abs(pan) < 0.01) return out;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    p.connect(out);
    setTimeout(() => { try { p.disconnect(); } catch (e) {} }, Math.max(100, (lifetime || 0.3) * 1000));
    return p;
  }

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

  function schedPulse(t) {
    const pat = RHYTHM[state] || RHYTHM.explore;
    const s = step % 16;
    if (pat.kick.includes(s)) kick(t, s === 0 ? 1.15 : 1);
    if (pat.snare.includes(s)) snare(t, state === 'boss' ? 1.1 : 1);
    if (pat.hat.includes(s)) hat(t, false, (s % 8 < 4 ? -0.22 : 0.22));
    if (pat.open.includes(s)) hat(t, true, (s % 2 ? -0.3 : 0.3));
  }

  // ── Arp/motif layer: recurring phrase fragments tied to progression ──
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
    filt.frequency.value = state === 'combat' || state === 'boss' ? 2600 : 2000;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.34 * accent, t + 0.01);
    g.gain.setValueAtTime(0.34 * accent, t + dur * 0.52);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filt); osc2.connect(filt); filt.connect(g); g.connect(target);
    osc.start(t); osc2.start(t);
    osc.stop(t + dur + 0.02); osc2.stop(t + dur + 0.02);
  }

  // ── Bass layer: progression-following low pulses with passing tones ──
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
    filt.frequency.value = state === 'boss' ? 220 : 190;
    g.gain.setValueAtTime(0.42, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    body.connect(filt); sub.connect(filt); filt.connect(g); g.connect(bassG);
    body.start(t); sub.start(t);
    body.stop(t + dur + 0.02); sub.stop(t + dur + 0.02);
  }

  // Occasional filtered noise swell for timbral depth
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
const WEAPONS = {
  PULSE_PISTOL: { name:'Pulse Pistol', dmg:15, rate:3,   range:10, spread:0,   count:1, colour:'#00f5ff' },
  SCATTER_GUN:  { name:'Scatter Gun',  dmg:8,  rate:1,   range:5,  spread:0.3, count:4, colour:'#ff8800' },
  RAILGUN:      { name:'Railgun',      dmg:60, rate:0.5, range:20, spread:0,   count:1, piercing:true, colour:'#ff00c8' },
  PLASMA_SWORD: { name:'Plasma Sword', dmg:30, rate:2,   range:1.5,spread:0,   count:1, melee:true, colour:'#00ff88' },
  VOID_CANNON:  { name:'Void Cannon',  dmg:45, rate:1.5, range:12, spread:0,   count:1, colour:'#aa00ff' },
};
const WEAPON_KEYS = Object.keys(WEAPONS);

// ─── Weapon Affixes ──────────────────────────────────────────────────────────
const WEAPON_AFFIXES = {
  // Prefixes (stat modifiers) — max 1 per weapon
  RAPID:    { slot:'prefix', label:'Rapid',    colour:'#44ff88', desc:'+30% fire rate',    mods:{rate:1.3} },
  HEAVY:    { slot:'prefix', label:'Heavy',    colour:'#ff6644', desc:'+35% dmg, −20% rate', mods:{dmg:1.35,rate:0.8} },
  EXTENDED: { slot:'prefix', label:'Extended', colour:'#44ccff', desc:'+40% range',        mods:{range:1.4} },
  TWIN:     { slot:'prefix', label:'Twin',     colour:'#ffcc44', desc:'+1 projectile',     mods:{countAdd:1,dmg:0.85} },
  PRECISE:  { slot:'prefix', label:'Precise',  colour:'#ffffff', desc:'Tighter spread',    mods:{spread:0.4} },
  // Suffixes (on-hit / on-kill effects) — max 1 per weapon
  FLAME:    { slot:'suffix', label:'of Flame',     colour:'#ff6600', desc:'Ignites enemies',       effect:'burn' },
  FROST:    { slot:'suffix', label:'of Frost',     colour:'#66ccff', desc:'Slows enemies',         effect:'slow' },
  VAMPIRIC: { slot:'suffix', label:'of Vampirism', colour:'#ff0066', desc:'Steals life on hit',    effect:'leech' },
  THUNDER:  { slot:'suffix', label:'of Thunder',   colour:'#ffff44', desc:'Chain lightning chance', effect:'chain' },
  DETONATE: { slot:'suffix', label:'of Detonation',colour:'#ff4400', desc:'Enemies explode on kill',effect:'explode' },
  VOLTAIC:  { slot:'suffix', label:'of Storms',    colour:'#ffee44', desc:'Shocks enemies on hit',  effect:'shock' },
};
const AFFIX_KEYS = Object.keys(WEAPON_AFFIXES);
const AFFIX_PREFIXES = AFFIX_KEYS.filter(k => WEAPON_AFFIXES[k].slot === 'prefix');
const AFFIX_SUFFIXES = AFFIX_KEYS.filter(k => WEAPON_AFFIXES[k].slot === 'suffix');

// ─── Elite Enemy Affixes ──────────────────────────────────────────────────────
const ELITE_AFFIXES = {
  SHIELDED:     { label:'Shielded',     colour:'#4488ff', desc:'Energy shield absorbs damage', icon:'◈' },
  BERSERKER:    { label:'Berserker',    colour:'#ff2222', desc:'Faster at low HP',             icon:'⚡' },
  REGENERATING: { label:'Regenerating', colour:'#22ff44', desc:'Slowly heals over time',       icon:'♻' },
  PHASING:      { label:'Phasing',      colour:'#cc88ff', desc:'Periodically invulnerable',    icon:'◇' },
};
const ELITE_AFFIX_KEYS = Object.keys(ELITE_AFFIXES);

function rollEliteAffix(enemyType) {
  // Filter out redundant combos
  const eligible = ELITE_AFFIX_KEYS.filter(k => {
    if (k === 'PHASING' && enemyType === 'PHANTOM') return false; // already phases
    return true;
  });
  return eligible[rndInt(0, eligible.length - 1)];
}

// ─── Hackware — Collectible Active Abilities ──────────────────────────────────
const HACKWARE = {
  EMP_BURST:    { name:'EMP Burst',    desc:'Stun nearby enemies for 2s',      colour:'#00ddff', icon:'⚡', cooldown:10 },
  PHASE_CLOAK:  { name:'Phase Cloak',  desc:'2.5s invisibility & immunity',    colour:'#cc44ff', icon:'◇', cooldown:14 },
  NANO_SWARM:   { name:'Nano Swarm',   desc:'Homing nanites deal 48 damage',   colour:'#44ff88', icon:'☢', cooldown:10 },
  GRAVITY_WELL: { name:'Gravity Well', desc:'Pull enemies to target for 3s',   colour:'#ff8800', icon:'◎', cooldown:16 },
  STATIC_FIELD: { name:'Static Field', desc:'Electric zone: 10 dps + slow',    colour:'#44ccff', icon:'⌁', cooldown:12 },
};
const HACKWARE_KEYS = Object.keys(HACKWARE);

let hackwareEffects = []; // active world-space hackware effects (gravity wells, swarm particles)

function canTargetPlayer() {
  const p = game.player;
  if (!p || p.hp <= 0) return false;
  if (p.cloakTimer > 0) return false;
  return true;
}

function isPlayerDamageImmune() {
  const p = game.player;
  if (!p) return false;
  if (p.dashTimer > 0) return true;
  if (p.cloakTimer > 0) return true;
  return false;
}

function activateHackware(player) {
  if (!player.hackware || player.hackwareCooldown > 0 || player.hp <= 0) return;
  const hw = HACKWARE[player.hackware];
  if (!hw) return;
  player.hackwareCooldown = hw.cooldown * (hasAugment('OVERCLOCKER') ? 0.7 : 1);
  const map = game.dungeon ? game.dungeon.map : null;

  switch (player.hackware) {
    case 'EMP_BURST': {
      audio.hackwareEMP();
      spawnParticles(player.x, player.y, 'EXPLOSION', '#00ddff', 20);
      triggerShake(5, 0.2);
      const radius = 4;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = dist(player.x, player.y, e.x, e.y);
        if (d < radius && map && hasLOS(player.x, player.y, e.x, e.y, map)) {
          const dur = e.isBoss ? 1 : 2; // bosses get reduced stun
          e.stunTimer = Math.max(e.stunTimer || 0, dur);
          spawnParticles(e.x, e.y, 'SPARK', '#00ddff', 4);
          spawnDmgText(e.x, e.y, 'STUN', '#00ddff');
        }
      }
      // Visual: expanding ring effect
      hackwareEffects.push({ type:'emp_ring', x:player.x, y:player.y, age:0, maxAge:0.4, radius });
      break;
    }
    case 'PHASE_CLOAK': {
      audio.hackwareCloak();
      player.cloakTimer = 2.5;
      spawnParticles(player.x, player.y, 'EXPLOSION', '#cc44ff', 12);
      game.msg('◇ PHASE CLOAK ACTIVE', '#cc44ff');
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
      game.msg('⌁ STATIC FIELD DEPLOYED', '#44ccff');
      break;
    }
  }
}

function updateHackwareEffects(dt) {
  const map = game.dungeon ? game.dungeon.map : null;
  for (let i = hackwareEffects.length - 1; i >= 0; i--) {
    const fx = hackwareEffects[i];
    fx.age += dt;
    if (fx.age >= fx.maxAge) { hackwareEffects.splice(i, 1); continue; }

    if (fx.type === 'swarm') {
      // Home toward nearest visible enemy
      let best = null, bestD = 8;
      for (const e of enemies) {
        if (e.dead) continue;
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

    if (fx.type === 'gravity') {
      // Pull enemies toward center (collision-aware)
      const pullStr = 4;
      for (const e of enemies) {
        if (e.dead || e.isBoss) continue; // bosses immune to pull
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
    }
    // emp_ring is visual only, handled in draw
  }
}

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
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TWO_PI); ctx.stroke();
      ctx.restore();
    }
    if (fx.type === 'swarm') {
      const sx = fx.x * TILE - camX, sy = fx.y * TILE - camY;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.shadowBlur = 8; ctx.shadowColor = '#44ff88';
      ctx.fillStyle = '#44ff88';
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, TWO_PI); ctx.fill();
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
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TWO_PI); ctx.fill();
      // Core
      ctx.globalAlpha = fade * 0.7;
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, TWO_PI); ctx.fill();
      // Rotating arms
      ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 2;
      ctx.globalAlpha = fade * 0.4;
      for (let arm = 0; arm < 3; arm++) {
        const a = fx.age * 4 + (TWO_PI / 3) * arm;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * 8, sy + Math.sin(a) * 8);
        ctx.lineTo(sx + Math.cos(a) * r * 0.6, sy + Math.sin(a) * r * 0.6);
        ctx.stroke();
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
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TWO_PI); ctx.fill();
      // Outer ring stroke
      ctx.globalAlpha = fade * 0.5;
      ctx.strokeStyle = '#44ccff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TWO_PI); ctx.stroke();
      // Rotating arc segments (3 arcs, 60° each)
      ctx.lineWidth = 3;
      ctx.globalAlpha = fade * 0.6;
      for (let seg = 0; seg < 3; seg++) {
        const a = fx.age * 3 + (TWO_PI / 3) * seg;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.7, a, a + Math.PI / 3);
        ctx.stroke();
      }
      // Core spark
      ctx.globalAlpha = fade * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(sx, sy, 3 + Math.sin(fx.age * 15) * 1.5, 0, TWO_PI); ctx.fill();
      ctx.restore();
    }
  }
}

function affixEligible(affixId, baseWeapon) {
  if (affixId === 'PRECISE'  && baseWeapon.spread === 0) return false;
  if (affixId === 'TWIN'     && baseWeapon.melee)        return false;
  if (affixId === 'EXTENDED' && baseWeapon.melee)        return false;
  return true;
}

// Deterministic weapon construction from base key + affix list
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
  const prefix = affixIds.find(id => WEAPON_AFFIXES[id]?.slot === 'prefix');
  const suffix = affixIds.find(id => WEAPON_AFFIXES[id]?.slot === 'suffix');
  let dn = base.name;
  if (prefix) dn = WEAPON_AFFIXES[prefix].label + ' ' + dn;
  if (suffix) dn = dn + ' ' + WEAPON_AFFIXES[suffix].label;
  w.displayName = dn;
  // Collect on-hit/on-kill effects
  w._effects = affixIds.map(id => WEAPON_AFFIXES[id]?.effect).filter(Boolean);
  return w;
}

// Roll random affixes based on floor depth
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
const DIFFICULTIES = {
  EASY:   { id:'EASY',   label:'EASY',   colour:'#39ff14', enemyHp:0.75, enemyAtk:0.75, enemySpd:1.0,  itemDrop:0.28, creditMul:1.2, xpMul:1.0,  eliteRate:0.04, shardMul:0.85, envDmg:0.75 },
  NORMAL: { id:'NORMAL', label:'NORMAL', colour:'#00f5ff', enemyHp:1.0,  enemyAtk:1.0,  enemySpd:1.0,  itemDrop:0.20, creditMul:1.0, xpMul:1.0,  eliteRate:0.08, shardMul:1.0,  envDmg:1.0 },
  HARD:   { id:'HARD',   label:'HARD',   colour:'#ff3333', enemyHp:1.25, enemyAtk:1.15, enemySpd:1.05, itemDrop:0.18, creditMul:1.0, xpMul:1.15, eliteRate:0.12, shardMul:1.3,  envDmg:1.15 },
};
const DIFF_ORDER = ['EASY','NORMAL','HARD'];
function getDiff() { return DIFFICULTIES[game.difficulty] || DIFFICULTIES.NORMAL; }

// ─── Floor Modifiers ─────────────────────────────────────────────────────────
const FLOOR_MODIFIERS = {
  BLACKOUT:  { label:'BLACKOUT',  desc:'Emergency lights only',     colour:'#4466aa', icon:'◐' },
  SWARM:     { label:'SWARM',     desc:'Alert — all units respond', colour:'#ff6644', icon:'⚠' },
  FORTIFIED: { label:'FORTIFIED', desc:'Reinforced patrols',        colour:'#66eeff', icon:'🛡' },
  VOLATILE:  { label:'VOLATILE',  desc:'Unstable power cells',      colour:'#ff4422', icon:'💥' },
  SCRAMBLED: { label:'SCRAMBLED', desc:'Targeting interference',     colour:'#cc44ff', icon:'⌁' },
  OVERCLOCK: { label:'OVERCLOCK', desc:'System overclock detected',  colour:'#ffcc00', icon:'⚡' },
};
const MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS);
function getMod() { return game.modifier && FLOOR_MODIFIERS[game.modifier] || null; }
function modSpeed(base) { return game.modifier === 'OVERCLOCK' ? base * 1.2 : base; }

// ─── Meta-Progression (persistent across runs) ──────────────────────────────
const META_UPGRADES = [
  { id:'VITAL_BOOST',   name:'Vital Systems',    desc:'+10 max HP',          maxLv:3, costs:[5,12,22],  icon:'♥' },
  { id:'SCAVENGER',     name:'Scavenger Protocol',desc:'+15% credit gain',   maxLv:3, costs:[5,12,22],  icon:'◈' },
  { id:'QUICK_LEARNER', name:'Quick Learner',     desc:'+15% XP gain',       maxLv:3, costs:[5,12,22],  icon:'★' },
  { id:'ARMOR_PLATING', name:'Armor Plating',     desc:'+1 starting DEF',    maxLv:3, costs:[8,18,30],  icon:'▣' },
  { id:'STARTING_GEAR', name:'Weapon Cache',      desc:'Start with upgraded weapon', maxLv:1, costs:[25], icon:'⚔' },
  { id:'PERSISTENCE',   name:'Data Persistence',  desc:'+3 fragments per run',maxLv:2, costs:[12,25],   icon:'◆' },
];

function loadMeta() {
  try {
    const raw = localStorage.getItem('neonDungeonMeta');
    if (!raw) return { shards:0, upgrades:{}, stats:{ totalRuns:0, totalShards:0, bestFloor:0, victories:0 }, lastDifficulty:'NORMAL' };
    const m = JSON.parse(raw);
    if (!m.stats) m.stats = { totalRuns:0, totalShards:0, bestFloor:0, victories:0 };
    if (!m.upgrades) m.upgrades = {};
    m.shards = Math.max(0, Math.floor(Number(m.shards) || 0));
    // Clamp upgrade levels to valid ranges
    for (const u of META_UPGRADES) {
      if (u.id in m.upgrades) {
        m.upgrades[u.id] = Math.max(0, Math.min(u.maxLv, Math.floor(Number(m.upgrades[u.id]) || 0)));
      }
    }
    if (!DIFFICULTIES[m.lastDifficulty]) m.lastDifficulty = 'NORMAL';
    return m;
  } catch(e) { return { shards:0, upgrades:{}, stats:{ totalRuns:0, totalShards:0, bestFloor:0, victories:0 }, lastDifficulty:'NORMAL' }; }
}

function saveMeta(meta) {
  try { localStorage.setItem('neonDungeonMeta', JSON.stringify(meta)); } catch(e){}
}

function getMetaLevel(id) {
  const m = loadMeta();
  return m.upgrades[id] || 0;
}

function calcRunShards(floor, score, bossesCleared, victory) {
  let runShards = floor;                                    // 1 per floor reached
  runShards += bossesCleared * 2;                           // 2 per boss cleared
  if (victory) runShards += 5;                              // 5 for victory
  runShards += Math.min(5, Math.floor(score / 2000));       // 1 per 2000 score, cap 5
  // Difficulty scales only the run-earned portion
  runShards = Math.round(runShards * getDiff().shardMul);
  const persistLv = getMetaLevel('PERSISTENCE');
  runShards += persistLv * 3;                               // flat bonus from PERSISTENCE (unscaled)
  return runShards;
}

function applyMetaToPlayer(player) {
  const m = loadMeta();
  const u = m.upgrades;
  if (u.VITAL_BOOST)   { player.maxHp += u.VITAL_BOOST * 10; player.hp = player.maxHp; }
  if (u.ARMOR_PLATING) { player.def += u.ARMOR_PLATING; }
  if (u.STARTING_GEAR) {
    const pool = ['SCATTER_GUN','RAILGUN','PLASMA_SWORD','VOID_CANNON'];
    player.weapon = buildWeapon(pool[Math.floor(Math.random() * pool.length)], []);
  }
}

function getMetaXPMultiplier()     { return 1 + getMetaLevel('QUICK_LEARNER') * 0.15; }
function getMetaCreditMultiplier() { return 1 + getMetaLevel('SCAVENGER') * 0.15; }

// ─── Particles ───────────────────────────────────────────────────────────────
let particles = [];
function spawnParticles(wx, wy, type, colour, count) {
  for (let i=0; i<count; i++) {
    const a = Math.random()*TWO_PI;
    const spd = type==='EXPLOSION' ? rnd(1,4) : rnd(0.5,3);
    particles.push({
      x: wx*TILE, y: wy*TILE,
      vx: Math.cos(a)*spd*(TILE/2), vy: Math.sin(a)*spd*(TILE/2),
      life: 1, maxLife: type==='MUZZLE'?0.08:type==='EXPLOSION'?0.5:rnd(0.3,0.6),
      size: type==='EXPLOSION' ? rnd(3,8) : rnd(1,3),
      colour, type,
      grav: type==='BLOOD' ? 40 : 0,
    });
  }
}
function updateParticles(dt) {
  for (let i=particles.length-1; i>=0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.life -= dt / p.maxLife;
    if (p.life <= 0) particles.splice(i,1);
  }
}
function drawParticles(camX, camY) {
  for (const p of particles) {
    const sx = p.x - camX, sy = p.y - camY;
    if (sx < -20 || sx > W+20 || sy < -20 || sy > H+20) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    if (p.type === 'EXPLOSION') {
      ctx.shadowBlur = 10; ctx.shadowColor = p.colour;
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * (1 - p.life * 0.5 + 0.5), 0, TWO_PI);
      ctx.fill();
    } else {
      ctx.fillStyle = p.colour;
      ctx.fillRect(sx - p.size/2, sy - p.size/2, p.size, p.size);
    }
    ctx.restore();
  }
}

// ─── Ambient Particles ───────────────────────────────────────────────────────
let ambientParticles = [];
const AMB_CAP = 80;
const AMB_SPAWN_INTERVAL = 0.08; // seconds between spawn attempts
let ambSpawnTimer = 0;

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

  const dungeon = game.dungeon;
  const player = game.player;
  if (!dungeon || !player) return;

  const cam = getCamera(player);
  const startX = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const startY = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const endX = Math.min(MAP_W, startX + Math.ceil(W / TILE) + 2);
  const endY = Math.min(MAP_H, startY + Math.ceil((H - layout.hudH) / TILE) + 2);
  const torchR = game.modifier === 'BLACKOUT' ? 5 : 9;
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
        const arcActive = Math.sin((game.floorTime || 0) * Math.PI) > 0;
        if (arcActive && Math.random() < 0.12) emitters.push({ kind: 'ZAP', tx, ty });
      } else if (tile === T.CRACKED) {
        const pdx = tx - Math.floor(player.x), pdy = ty - Math.floor(player.y);
        if (pdx * pdx + pdy * pdy <= 16) {
          if (Math.random() < 0.06) emitters.push({ kind: 'STEAM', tx, ty });
        }
      } else if (tile === T.WALL) {
        if ((game.bossSealed && game.bossEntrances && game.bossEntrances.some(e => e.x === tx && e.y === ty)) ||
            (game.challengeSealed && game.challengeEntrances && game.challengeEntrances.some(e => e.x === tx && e.y === ty))) {
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
    const e = emitters.splice(idx, 1)[0];
    const cx = e.tx * TILE + rnd(2, TILE - 2);
    const cy = e.ty * TILE + rnd(2, TILE - 2);

    switch (e.kind) {
      case 'DUST':
        ambientParticles.push({
          kind: 'DUST', x: cx, y: cy,
          vx: rnd(-3, 3), vy: rnd(-3, 3),
          life: 1, maxLife: rnd(3, 6), size: rnd(1, 2.5),
          alpha: rnd(0.06, 0.18), colour: Math.random() < 0.3 ? '#66ddff' : '#aabbcc',
          seed: Math.random() * 1000,
        });
        break;
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
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * (0.5 + 0.5 * p.life), 0, TWO_PI);
      ctx.fill();
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
let floatingTexts = [];
function spawnDmgText(wx, wy, text, colour) {
  if (!settings.damageNumbers) return;
  if (floatingTexts.length >= 20) floatingTexts.shift();
  floatingTexts.push({
    x: wx * TILE + rnd(-6, 6), y: wy * TILE - 8,
    vy: -40, life: 1, text: String(text), colour
  });
}
function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const f = floatingTexts[i];
    f.y += f.vy * dt;
    f.vy *= Math.pow(0.35, dt);
    f.life -= dt * 1.4;
    if (f.life <= 0) floatingTexts.splice(i, 1);
  }
}
function drawFloatingTexts(camX, camY) {
  for (const f of floatingTexts) {
    const sx = f.x - camX, sy = f.y - camY;
    if (sx < -40 || sx > W + 40 || sy < -20 || sy > H + 20) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.shadowBlur = 6; ctx.shadowColor = f.colour;
    ctx.fillStyle = f.colour;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, sx, sy);
    ctx.restore();
  }
}

// ─── Screen Shake ────────────────────────────────────────────────────────────
const shake = { intensity: 0, timer: 0, ox: 0, oy: 0 };
function triggerShake(intensity, duration = 0.25) {
  if (!settings.screenShake) return;
  if (intensity > shake.intensity) {
    shake.intensity = intensity;
    shake.timer = duration;
  }
}
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
  const t = game.modBannerTimer;
  if (!t || t <= 0 || !game.modifier) return;
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

  ctx.restore();
}

// Status effect badges — compact indicators above HUD bar
const statusFx = {};
function getStatusEffects(player) {
  const fx = [];
  // Floor modifier
  if (game.modifier) {
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
  // Shock debuff (from enemy attacks)
  if (player.shockTimer > 0) {
    fx.push({ id: 'shocked', icon: '⚡', label: 'SHOCK', colour: '#ffee44' });
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
  return fx;
}

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
function registerKill(isBoss) {
  combo.count++;
  combo.timer = COMBO_WINDOW;
  combo.flashTimer = 0.3;
  if (combo.count > combo.best) combo.best = combo.count;
  if (combo.count >= 2) audio.comboTick(combo.count);
  // milestone floating text at kill position
  if (combo.count === 5 || combo.count === 10 || combo.count === 15 || combo.count === 20) {
    const p = game.player;
    spawnDmgText(p.x, p.y - 0.5, `×${combo.count} COMBO!`, comboColour());
  }
}
function updateCombo(dt) {
  if (combo.count < 1) return;
  combo.timer -= dt;
  combo.flashTimer = Math.max(0, combo.flashTimer - dt);
  if (combo.timer <= 0) { combo.count = 0; combo.timer = 0; }
}

// ─── Dungeon Generator ───────────────────────────────────────────────────────
function createMap() {
  return Array.from({length: MAP_H}, () => new Uint8Array(MAP_W).fill(T.WALL));
}

function carveRect(map, x, y, w, h, tile) {
  for (let ty=y; ty<y+h; ty++)
    for (let tx=x; tx<x+w; tx++)
      if (tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H) map[ty][tx]=tile;
}

function carveCorridor(map, x1, y1, x2, y2) {
  let x=x1, y=y1;
  while (x!==x2) { map[y][x]=T.FLOOR; x += x<x2?1:-1; }
  while (y!==y2) { map[y][x]=T.FLOOR; y += y<y2?1:-1; }
}

class BSPNode {
  constructor(x,y,w,h) { this.x=x; this.y=y; this.w=w; this.h=h; this.left=null; this.right=null; this.room=null; }
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
  getLeaves() {
    if (!this.left && !this.right) return [this];
    return [...(this.left?.getLeaves()??[]), ...(this.right?.getLeaves()??[])];
  }
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
  getRoom() {
    if (this.room) return this.room;
    const l = this.left?.getRoom(), r = this.right?.getRoom();
    if (!l) return r; if (!r) return l;
    return Math.random()<0.5?l:r;
  }
}

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

function generateFloor(floorNum) {
  const map = createMap();
  const root = new BSPNode(0,0,MAP_W,MAP_H);
  root.split(5);
  root.carveRooms(map);
  const rooms = root.getLeaves().map(l=>l.room).filter(Boolean);

  // spawn in first room
  const spawnRoom = rooms[0];
  const playerPos = { x: spawnRoom.cx + 0.5, y: spawnRoom.cy + 0.5 };

  // furthest room from spawn for stairs
  const dist = bfsRooms(rooms, spawnRoom, map);
  let farthest = spawnRoom, farthestD = 0;
  for (const [r,d] of dist) { if (d>farthestD) { farthestD=d; farthest=r; } }
  map[farthest.cy][farthest.cx] = floorNum>=10 ? T.TERMINAL : T.STAIRS;

  // boss room on floors 3,6,10
  let bossRoom = null;
  let bossEntrances = [];
  if (floorNum===3||floorNum===6||floorNum===10) {
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
      const nx = Math.max(1, Math.min(MAP_W - nw - 1, bossRoom.cx - Math.floor(nw/2)));
      const ny = Math.max(1, Math.min(MAP_H - nh - 1, bossRoom.cy - Math.floor(nh/2)));
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
      map[farthest.cy][farthest.cx] = floorNum>=10 ? T.TERMINAL : T.STAIRS;
    }

    // Record entrance tiles: floor tiles on room boundary that connect to corridors
    const rx=bossRoom.x, ry=bossRoom.y, rw=bossRoom.w, rh=bossRoom.h;
    for (let tx=rx; tx<rx+rw; tx++) {
      // top edge
      if (ry>0 && map[ry][tx]===T.FLOOR && map[ry-1][tx]===T.FLOOR)
        bossEntrances.push({x:tx, y:ry});
      // bottom edge
      const by=ry+rh-1;
      if (by<MAP_H-1 && map[by][tx]===T.FLOOR && map[by+1][tx]===T.FLOOR)
        bossEntrances.push({x:tx, y:by});
    }
    for (let ty=ry; ty<ry+rh; ty++) {
      // left edge
      if (rx>0 && map[ty][rx]===T.FLOOR && map[ty][rx-1]===T.FLOOR)
        bossEntrances.push({x:rx, y:ty});
      // right edge
      const bx=rx+rw-1;
      if (bx<MAP_W-1 && map[ty][bx]===T.FLOOR && map[ty][bx+1]===T.FLOOR)
        bossEntrances.push({x:bx, y:ty});
    }
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
  const visited = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));
  const light   = Array.from({length:MAP_H},()=>new Float32Array(MAP_W));
  const visible = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));

  // ── Room types: assign special purposes ──────────────────────────────────
  // Types: null (normal), 'armory', 'medbay', 'shrine', 'vault'
  const ROOM_TYPES = ['armory','medbay','shrine','vault'];
  const ROOM_COLOURS = {armory:'#2a1a10',medbay:'#0a1a15',shrine:'#1a0a20',vault:'#1a1a05',vendor:'#0a1a0f',secret:'#1a1005',challenge:'#1a0a0a',implant:'#0f0a1a',event:'#0a1a1a'};
  const specialRooms = [];
  const eligible = rooms.filter(r => r!==spawnRoom && r!==farthest && r!==bossRoom && r.w*r.h>=20);

  // ── Vendor room (floor 2+, one per non-boss floor) — reserved first ─────
  let vendorRoom = null;
  if (floorNum >= 2 && !bossRoom) {
    const vendorEligible = eligible.filter(r => r.w >= 5 && r.h >= 5);
    if (vendorEligible.length > 0) {
      vendorRoom = vendorEligible[rndInt(0, vendorEligible.length - 1)];
      vendorRoom.roomType = 'vendor';
      specialRooms.push(vendorRoom);
      map[vendorRoom.cy][vendorRoom.cx] = T.VENDOR;
    }
  }

  // ── Special room rotation (excluding vendor room) ───────────────────────
  const specialEligible = eligible.filter(r => r !== vendorRoom);
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
  function getEntranceClusters(room) {
    const edges = [];
    const isEntry = t => t===T.FLOOR||t===T.DOOR;
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
        const c = cl[qi++];
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
    const fallback = rooms.filter(r =>
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
      const vis2 = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));
      vis2[spawnRoom.cy][spawnRoom.cx] = 1;
      while (q2.length) {
        const {x:cx,y:cy} = q2.shift();
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
      const keyRoom = rooms.filter(r => r!==lr && r!==bossRoom && vis2[r.cy][r.cx]);
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

  // ── Secret room (floor 3+, one per floor, not boss floors) ──────────────
  const secretRooms = [];
  if (floorNum >= 3 && !bossRoom) {
    // Candidates: not spawn, not stair, not special, not vendor, decent size
    const secretEligible = rooms.filter(r =>
      r !== spawnRoom && r !== farthest && !r.roomType && r.w * r.h >= 20
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
      const crackedCluster = narrow[rndInt(0, narrow.length - 1)];
      for (const e of crackedCluster) map[e.y][e.x] = T.CRACKED;

      break; // only one secret room per floor
    }
  }

  // ── Challenge Room (floor 2+, non-boss): optional wave-based arena ─────
  let challengeRoom = null;
  const challengeEntrances = [];
  if (floorNum >= 2 && !bossRoom) {
    const challengeEligible = rooms.filter(r =>
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
  let implantRoom = null;
  if (floorNum >= 2 && !bossRoom && Math.random() < 0.5) {
    const implantEligible = rooms.filter(r =>
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
  let eventRoom = null;
  if (floorNum >= 2 && !bossRoom) {
    const eventEligible = rooms.filter(r =>
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

  // ── Traps (floor 3+) ────────────────────────────────────────────────────
  if (floorNum >= 3) {
    for (const r of rooms) {
      if (r === spawnRoom || r === bossRoom) continue;
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
        const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
        const [ddx, ddy] = dirs[rndInt(0, 3)];
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
    const loreEligible = rooms.filter(r =>
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
    const roomMask = Array.from({length:MAP_H}, ()=>new Uint8Array(MAP_W));
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
        for (const [ddx, ddy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
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
      for (const [ddx, ddy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
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
    const padEligible = rooms.filter(r =>
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
        const rA = shuffled[bestA], rB = shuffled[bestB];
        map[rA.cy][rA.cx] = T.TELEPORT_PAD;
        map[rB.cy][rB.cx] = T.TELEPORT_PAD;
        teleportPads.push({ x1: rA.cx, y1: rA.cy, x2: rB.cx, y2: rB.cy, pairIndex: p });
        used.add(bestA);
        used.add(bestB);
      }
    }
  }

  // Room colour map (floor tile → tint)
  const roomColour = Array.from({length:MAP_H},()=>new Array(MAP_W).fill(null));
  for (const r of rooms) {
    if (!r.roomType) continue;
    const col = ROOM_COLOURS[r.roomType];
    for (let ty=r.y; ty<r.y+r.h; ty++)
      for (let tx=r.x; tx<r.x+r.w; tx++)
        if (map[ty][tx]===T.FLOOR) roomColour[ty][tx]=col;
  }

  // Secret room mask — tiles inside unrevealed secret rooms are hidden from lighting/rendering
  // Cracked entrance tiles are excluded so they can receive light and render crack visuals
  const secretMask = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));
  for (const r of secretRooms) {
    for (let ty=r.y; ty<r.y+r.h; ty++)
      for (let tx=r.x; tx<r.x+r.w; tx++)
        if (map[ty][tx] !== T.CRACKED) secretMask[ty][tx] = 1;
  }

  return { map, rooms, spawnRoom, stairRoom:farthest, bossRoom, bossEntrances, playerPos, lights, visited, light, visible, keyItems, roomColour, specialRooms, vendorRoom, secretRooms, secretMask, loreTerminals, challengeRoom, challengeEntrances, eventRoom, teleportPads };
}

// ─── Lighting ────────────────────────────────────────────────────────────────
function updateLighting(dungeon, px, py) {
  const map = dungeon.map;
  const r = game.modifier === 'BLACKOUT' ? 5 : 9;
  const tx = Math.floor(px), ty = Math.floor(py);
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
      dungeon.visited[y][x] = 1;
    }
  // Sconce ambient — only brightens already-visited tiles, no visibility grant
  for (const sc of dungeon.lights) {
    const sdx = sc.x - tx, sdy = sc.y - ty;
    if (Math.abs(sdx) > 6 || Math.abs(sdy) > 6) continue;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = sc.x + dx, y = sc.y + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (dungeon.secretMask[y][x]) continue;
        if (!dungeon.visited[y][x]) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 4) dungeon.light[y][x] = Math.max(dungeon.light[y][x], 0.4 * (1 - d / 4));
      }
  }
}

// LOS check for FOV: like hasLOS but uses isSeeThrough and blocks diagonal corner-cuts
function tileHasLOS(x1, y1, tx, ty, map) {
  let cx = Math.floor(x1), cy = Math.floor(y1);
  if (cx === tx && cy === ty) return true;
  let dx = Math.abs(tx - cx), dy = Math.abs(ty - cy);
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

// ─── Projectiles ─────────────────────────────────────────────────────────────
let projectiles = [];
class Projectile {
  constructor(x,y,dx,dy,spd,dmg,range,colour,piercing,fromPlayer,weaponName) {
    this.x=x; this.y=y;
    [this.dx,this.dy]=norm(dx,dy);
    this.spd= fromPlayer && hasAugment('KINETIC_AMPLIFIER') ? spd * 1.2 : spd;
    this.dmg=dmg;
    this.maxRange=range; this.travelled=0;
    this.colour=colour; this.piercing=piercing;
    this.maxPierces=piercing?Infinity:0;
    this.fromPlayer=fromPlayer; this.dead=false;
    this.weaponName=weaponName||null;
    this._effects=[];  // affix effects carried from weapon
    this.hitEnemies=new Set();
    this.bouncesLeft=0;
    this._hasRicochet=false;
    this.trail=[];
  }
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
    const prevX=this.x, prevY=this.y;
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
        if (dist(this.x,this.y,e.x,e.y)<0.6) {
          // Shield deflection check (skip for piercing weapons)
          if (e.blocksProjectile(this) && !this.piercing) {
            spawnParticles(this.x, this.y, 'SPARK', '#66eeff', 6);
            audio.shieldDeflect();
            this.dead = true; return;
          }
          e.takeDamage(this.dmg, { name:this.weaponName, effects:this._effects||[], affixes:this._affixes||[] });
          if (this.isCrit) spawnDmgText(e.x, e.y - 0.3, 'CRIT!', '#ffdd00');
          spawnParticles(this.x,this.y,'BLOOD','#ff3333',4);
          this.hitEnemies.add(e);
          if (this.hitEnemies.size > this.maxPierces) { this.dead=true; return; }
        }
      }
    } else if (!this.isGrenade) {
      // Normal enemy projectiles damage player (grenades don't — they create zones)
      // Cloaked player: projectiles pass through
      if (!player.invincibleTimer && !isPlayerDamageImmune() && dist(this.x,this.y,player.x,player.y)<0.5) {
        const dealt = player.takeDamage(this.dmg, this.ownerType || 'Projectile');
        // SNIPER shots shock the player on hit
        if (dealt > 0 && this.ownerType === 'SNIPER') {
          const wasShocked = player.shockTimer > 0;
          player.shockTimer = Math.max(player.shockTimer, 0.4);
          if (!wasShocked) audio.playerShock();
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
  }
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
        ctx.beginPath();
        ctx.moveTo(this.trail[a]-camX, this.trail[a+1]-camY);
        ctx.lineTo(this.trail[b]-camX, this.trail[b+1]-camY);
        ctx.stroke();
      }
      // Line from last trail point to current position
      ctx.globalAlpha=0.6;
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(this.trail[tl-2]-camX, this.trail[tl-1]-camY);
      ctx.lineTo(this.x*TILE-camX, this.y*TILE-camY);
      ctx.stroke();
      ctx.restore();
    }
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY;
    ctx.save();
    ctx.shadowBlur=8; ctx.shadowColor=this.colour;
    ctx.fillStyle=this.colour;
    ctx.beginPath();
    const r = this.isGrenade ? 5 : 3;
    ctx.arc(sx,sy,r,0,TWO_PI);
    ctx.fill();
    if (this.isGrenade) {
      // Pulsing warning ring
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 80) * 0.3;
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ─── Hazard Zones (grenade AoE) ───────────────────────────────────────────────
function detonateGrenade(x, y, dmg) {
  hazardZones.push({ x, y, radius: 1.5, age: 0, maxAge: 3, tickCd: 0, armTimer: 0, dmg, colour: '#ff6622' });
  spawnParticles(x, y, 'EXPLOSION', '#ff6622', 10);
  audio.grenadeExplode();
  primeVCoresInRadius(x, y, 1.5, game.dungeon.map);
}

function updateHazardZones(dt, player) {
  for (let i = hazardZones.length - 1; i >= 0; i--) {
    const z = hazardZones[i];
    z.age += dt;
    if (z.armTimer > 0) z.armTimer -= dt;
    z.tickCd = Math.max(0, z.tickCd - dt);
    if (z.age >= z.maxAge) { hazardZones.splice(i, 1); continue; }
    if (z.armTimer <= 0 && z.tickCd <= 0 && !player.invincibleTimer && !isPlayerDamageImmune() &&
        dist(player.x, player.y, z.x, z.y) < z.radius &&
        hasLOS(z.x, z.y, player.x, player.y, game.dungeon.map)) {
      player.takeDamage(z.dmg, z.source || 'Grenade');
      spawnParticles(player.x, player.y, 'SPARK', z.colour || '#ff6622', 4);
      z.tickCd = 0.8;
    }
  }
}

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
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TWO_PI);
      ctx.stroke();
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
   fn: p=>{ p.hp=Math.min(p.maxHp,p.hp+40); }},
  {id:'NANO_REPAIR', name:'Nano-Repair',  desc:'+15 HP',               colour:'#88ff88', rarity:35, persistent:false,
   fn: p=>{ p.hp=Math.min(p.maxHp,p.hp+15); }},
  {id:'XP_CHIP',     name:'XP Chip',      desc:'+50 XP',               colour:'#ffff00', rarity:20, persistent:false,
   fn: p=>{ p.gainXP(50); }},
  {id:'VOID_SHARD',  name:'Void Shard',   desc:'+1 void bomb charge',  colour:'#aa00ff', rarity:4,  persistent:false,
   fn: p=>{ p.shards=(p.shards||0)+1; game.msg('Got Void Shard! ('+p.shards+')','#aa00ff'); }},
  // Persistent (stackable) upgrades
  {id:'SAW_BLADE',   name:'Saw Blade',    desc:'Orbital blade circles you',   colour:'#ff3333', rarity:12, persistent:true, maxLevel:4,
   levelDesc: l=>(l+1)+' blade'+(l>0?'s':'')+', 12 dmg each',
   fn: p=>{ p.upgrades.SAW_BLADE=(p.upgrades.SAW_BLADE||0)+1; }},
  {id:'PLASMA_ORB',  name:'Plasma Orb',   desc:'Auto-fires homing orb',       colour:'#ff44cc', rarity:10, persistent:true, maxLevel:3,
   levelDesc: l=>'25 dmg, '+(3-l*0.7).toFixed(1)+'s cooldown',
   fn: p=>{ p.upgrades.PLASMA_ORB=(p.upgrades.PLASMA_ORB||0)+1; }},
  {id:'NANO_REGEN',  name:'Nano Regen',   desc:'Passive HP regeneration',     colour:'#44ffaa', rarity:15, persistent:true, maxLevel:5,
   levelDesc: l=>'+'+(l+1)+' HP/s',
   fn: p=>{ p.upgrades.NANO_REGEN=(p.upgrades.NANO_REGEN||0)+1; }},
  {id:'OVERCLOCK',   name:'Overclock',    desc:'Permanent speed boost',       colour:'#ff00c8', rarity:10, persistent:true, maxLevel:3,
   levelDesc: l=>'+'+(15*(l+1))+'% speed',
   fn: p=>{ p.upgrades.OVERCLOCK=(p.upgrades.OVERCLOCK||0)+1; p.permSpeedBonus=(p.upgrades.OVERCLOCK)*0.5; }},
  {id:'ARMOR_UP',    name:'Reinforced Armor', desc:'Permanent +3 DEF',        colour:'#00aaff', rarity:12, persistent:true, maxLevel:5,
   levelDesc: l=>'+'+(3*(l+1))+' DEF total',
   fn: p=>{ p.upgrades.ARMOR_UP=(p.upgrades.ARMOR_UP||0)+1; p.def+=3; }},
  {id:'RICOCHET',   name:'Ricochet Module',  desc:'Bullets bounce off walls', colour:'#00ffff', rarity:8,  persistent:true, maxLevel:3,
   levelDesc: l=>(l+1)+' bounce'+(l>0?'s':''),
   fn: p=>{ p.upgrades.RICOCHET=(p.upgrades.RICOCHET||0)+1; }},
  {id:'SENTRY_DRONE', name:'Sentry Drone', desc:'Orbiting drone auto-fires at enemies', colour:'#00e5ff', rarity:7, persistent:true, maxLevel:3,
   levelDesc: l=>(l+1)+' drone'+(l>0?'s':'')+', 8 dmg, '+(2.0-l*0.4).toFixed(1)+'s cd',
   fn: p=>{ p.upgrades.SENTRY_DRONE=(p.upgrades.SENTRY_DRONE||0)+1; }},
];

// Generate a weapon upgrade option (pre-rolled so player sees exact weapon)
function makeWeaponOption() {
  const k=WEAPON_KEYS[rndInt(0,WEAPON_KEYS.length-1)];
  const aw=rollWeapon(k, game.floor || 1);
  const rarityCol = RARITY_COLOURS[aw._rarity] || '#aaaaaa';
  const affixDesc = aw._affixes.map(id => WEAPON_AFFIXES[id]?.desc).filter(Boolean).join(', ');
  const statsDesc = aw.melee ? aw.dmg+' dmg, melee, '+aw.rate+'/s' : aw.dmg+(aw.count>1?'×'+aw.count:'')+' dmg, '+aw.rate+'/s, rng '+aw.range;
  return {
    id:'WEAPON_'+k, name:aw.displayName, colour:aw.colour, rarity:10, persistent:false,
    _rarity: aw._rarity, _rarityColour: rarityCol,
    desc: statsDesc,
    affixDesc: affixDesc || null,
    fn: p=>{ p.weapon=aw; game.msg('Equipped '+aw.displayName+'!',rarityCol); }
  };
}

function makeHackwareOption(exclude) {
  // Pick a random hackware module different from what player has and the excluded id
  const current = game.player ? game.player.hackware : null;
  const eligible = HACKWARE_KEYS.filter(k => {
    if (exclude && exclude === 'HACKWARE_' + k) return false;
    return true;
  });
  if (eligible.length === 0) return null;
  const key = eligible[rndInt(0, eligible.length - 1)];
  const hw = HACKWARE[key];
  const replaces = current ? HACKWARE[current] : null;
  return {
    id:'HACKWARE_'+key, name:hw.name,
    desc:hw.desc + (replaces ? ' [replaces '+replaces.name+']' : ''),
    colour:hw.colour, rarity:0, persistent:false, isHackware:true,
    fn: p => {
      p.hackware = key;
      p.hackwareCooldown = 0; // fresh cooldown on equip
      game.msg(hw.icon+' '+hw.name+' INSTALLED', hw.colour);
    }
  };
}

function pickUpgradeOption(exclude) {
  // Build eligible pool: exclude maxed persistent upgrades and the excluded id
  const pool = UPGRADES.filter(u => {
    if (exclude && u.id === exclude) return false;
    if (u.persistent && game.player) {
      const cur = game.player.upgrades[u.id] || 0;
      if (cur >= u.maxLevel) return false;
    }
    return true;
  });
  // 12% chance for a hackware option (floor 3+)
  if (game.floor >= 3 && Math.random() < 0.12 && (!exclude || !exclude.startsWith('HACKWARE_'))) {
    const hw = makeHackwareOption(exclude);
    if (hw) return hw;
  }
  // 20% chance for a weapon option (always eligible)
  if (Math.random() < 0.2 && (!exclude || !exclude.startsWith('WEAPON_'))) return makeWeaponOption();
  if (pool.length === 0) return makeWeaponOption();
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
};
const PERK_CAPSTONE = { id:'AUTO_LASER', name:'Auto-Laser', icon:'⚡', desc:'Fires beam at nearest foe', colour:'#ff2222' };
const PERK_LEVELS = [2, 4, 6, 8]; // levels that trigger a perk choice

function rollPerkChoices(player, count) {
  const available = Object.keys(PERK_POOL).filter(id => !player.perks[id]);
  // Fisher-Yates shuffle, take first `count`
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, Math.min(count, available.length));
}

function applyPerk(player, id) {
  player.perks[id] = true;
  const perk = PERK_POOL[id];
  if (id === 'ENERGY_SHIELD') player.energyShield = true;
  if (id === 'THICK_ARMOR') player.def += 3;
  if (perk) setTimeout(() => game.msg('⚡ PERK: '+perk.name, perk.colour), 200);
}

function grantCapstone(player) {
  if (!player.perks.AUTO_LASER) {
    player.perks.AUTO_LASER = true;
    setTimeout(() => game.msg('⚡ CAPSTONE: '+PERK_CAPSTONE.name, PERK_CAPSTONE.colour), 200);
  }
}

// ─── Augments (Cybernetic Implants) ──────────────────────────────────────────
const MAX_AUGMENTS = 3;
const AUGMENTS = {
  NEURAL_LINK:      { name:'Neural Link',         icon:'🧠', colour:'#cc44ff', desc:'+25% XP from all sources' },
  TITANIUM_PLATING: { name:'Titanium Plating',     icon:'🛡', colour:'#4488cc', desc:'Reduce all damage by 1' },
  MAGNETIC_FIELD:   { name:'Magnetic Field',       icon:'🧲', colour:'#44ff88', desc:'Double item pickup radius' },
  THERMAL_OPTICS:   { name:'Thermal Optics',       icon:'👁', colour:'#ffcc00', desc:'Enemies visible on minimap' },
  ADRENALINE_INJECTOR:{ name:'Adrenaline Injector',icon:'💉', colour:'#ff4444', desc:'Kill: +30% speed for 2s' },
  OVERCLOCKER:      { name:'Overclocker',          icon:'⚡', colour:'#00ddff', desc:'Hackware cooldowns −30%' },
  ECHO_MAPPER:      { name:'Echo Mapper',          icon:'📡', colour:'#ffffff', desc:'Reveal floor layout on entry' },
  CREDIT_SIPHON:    { name:'Credit Siphon',        icon:'💰', colour:'#ffaa00', desc:'+50% credits from all sources' },
  SCAVENGER_NANITES:{ name:'Scavenger Nanites',    icon:'🔧', colour:'#88ff44', desc:'10% kill chance: +5 HP' },
  KINETIC_AMPLIFIER:{ name:'Kinetic Amplifier',    icon:'🚀', colour:'#ff8800', desc:'+20% projectile speed' },
  TEMPORAL_DILATION:{ name:'Temporal Dilation',     icon:'⏳', colour:'#88ccff', desc:'All enemies 15% slower' },
  REACTIVE_ARMOR:   { name:'Reactive Armor',        icon:'💥', colour:'#ff6644', desc:'When hit, emit damage pulse' },
};
const AUGMENT_KEYS = Object.keys(AUGMENTS);
function hasAugment(id) { return !!(game.player && game.player.augments[id]); }

function rollAugmentChoices(player, count) {
  const owned = player.augments || {};
  const available = AUGMENT_KEYS.filter(id => !owned[id]);
  // Fisher-Yates shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = rndInt(0, i);
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}

function makeAugmentShopOption(exclude) {
  const owned = game.player ? game.player.augments || {} : {};
  const slots = Object.keys(owned).length;
  if (slots >= MAX_AUGMENTS) return null;
  const available = AUGMENT_KEYS.filter(id => !owned[id] && id !== exclude);
  if (!available.length) return null;
  const id = available[rndInt(0, available.length - 1)];
  const aug = AUGMENTS[id];
  return {
    id: 'SHOP_AUG_' + id, name: aug.name, isAugment: true,
    desc: aug.icon + ' ' + aug.desc + ' [AUGMENT]',
    colour: aug.colour, price: 120 + (game.floor || 1) * 15,
    fn: p => {
      // Guard: don't exceed max slots or install duplicates
      if (Object.keys(p.augments).length >= MAX_AUGMENTS || p.augments[id]) {
        game.msg('AUGMENT SLOTS FULL', '#993366');
        return;
      }
      p.augments[id] = true;
      audio.augmentInstall();
      game.msg(aug.icon + ' ' + aug.name + ' INSTALLED', aug.colour);
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
    a:{ label:'LISTEN',  desc:'Let it share what it knows about this floor.',  summary:'reveal map' },
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

function rollEvent(player) {
  const available = EVENTS.filter(e => {
    if (e.id === 'RADIATION_LEAK' && Object.keys(player.augments || {}).length >= MAX_AUGMENTS) return false;
    if (e.id === 'ROGUE_AI' && player.credits < 50) return false;
    return true;
  });
  if (!available.length) return EVENTS[rndInt(0, EVENTS.length - 1)];
  return available[rndInt(0, available.length - 1)];
}

function applyEventEffect(event, choice, player, gm) {
  const floor = gm.floor;
  const d = getDiff();
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
            const hw = HACKWARE_KEYS[rndInt(0, HACKWARE_KEYS.length - 1)];
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
        const baseKey = bases[rndInt(0, bases.length - 1)];
        player.weapon = rollWeapon(baseKey, Math.min(10, floor + 1));
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
            const id = available[rndInt(0, available.length - 1)];
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
        gm.msg('MAP DATA DOWNLOADED', '#aa88ff');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#aa88ff', 15);
        break;
      }
      case 'POWER_JUNCTION': {
        const room = gm.eventChoice.room;
        let stunned = 0;
        for (const e of enemies) {
          if (e.dead || e.room !== room) continue;
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
const SHOP_PRICES = {
  MED_PACK:60, NANO_REPAIR:35, XP_CHIP:45, VOID_SHARD:90,
  SAW_BLADE:120, PLASMA_ORB:130, NANO_REGEN:80, OVERCLOCK:110, ARMOR_UP:100, RICOCHET:115
};
function shopPrice(id, floor, playerUpgrades) {
  const base = SHOP_PRICES[id] || 80;
  const lvl = (playerUpgrades && playerUpgrades[id]) || 0;
  return Math.floor((base + floor * 5) * (1 + lvl * 0.4));
}

function generateShopItems(floor, player, dungeon) {
  const pool = [];
  // Always offer a heal option
  pool.push({
    id:'SHOP_HEAL', name:'Full Repair', desc:'Restore all HP',
    colour:'#00ff88', price: 50 + floor * 12,
    fn: p => { p.hp = p.maxHp; game.msg('Fully repaired!','#00ff88'); }
  });
  // Offer a key if the floor has locked doors the player can't open
  if (dungeon) {
    const neededColours = [];
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
        fn: p => { p.keys[kc]++; game.msg('Bought '+kc.toUpperCase()+' KEY!', tileCol); }
      });
    }
  }
  // Offer a hackware module on floor 3+ (~40% chance per vendor)
  if (floor >= 3 && Math.random() < 0.4) {
    const hwKey = HACKWARE_KEYS[rndInt(0, HACKWARE_KEYS.length - 1)];
    const hw = HACKWARE[hwKey];
    const replaces = player.hackware ? HACKWARE[player.hackware] : null;
    pool.push({
      id:'SHOP_HW_'+hwKey, name:hw.name, isHackware:true,
      desc:hw.desc + (replaces ? ' [replaces '+replaces.name+']' : ''),
      colour:hw.colour, price: 90 + floor * 10,
      fn: p => { p.hackware=hwKey; p.hackwareCooldown=0; game.msg(hw.icon+' '+hw.name+' INSTALLED',hw.colour); }
    });
  }
  // Offer an augment on floor 3+ (~20% chance, if player has room)
  if (floor >= 3 && Math.random() < 0.2) {
    const augOpt = makeAugmentShopOption(null);
    if (augOpt) pool.push(augOpt);
  }
  // Fill remaining slots from UPGRADES pool
  const used = new Set(pool.map(p => p.id));
  const eligible = UPGRADES.filter(u => {
    if (used.has(u.id)) return false;
    if (u.persistent && player) {
      const cur = player.upgrades[u.id] || 0;
      if (cur >= u.maxLevel) return false;
    }
    return true;
  });
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

class Item {
  constructor(x,y,type) {
    this.x=x; this.y=y; this.type=type||pickItemType();
    this.dead=false; this.bob=Math.random()*TWO_PI; this.isKey=false;
  }
  update(dt) { this.bob+=dt*2; }
  draw(camX,camY) {
    const tx=Math.floor(this.x), ty=Math.floor(this.y);
    if (!game.dungeon?.visible?.[ty]?.[tx]) return;
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY+Math.sin(this.bob)*2;
    ctx.save();
    ctx.shadowBlur=12; ctx.shadowColor=this.type.colour;
    ctx.fillStyle=this.type.colour;
    ctx.fillRect(sx-5,sy-5,10,10);
    ctx.restore();
  }
}

class KeyItem {
  constructor(x,y,colour,tileColour) {
    this.x=x; this.y=y;
    this.colour=colour; // 'red','blue','gold'
    this.tileColour=tileColour;
    this.dead=false; this.bob=Math.random()*TWO_PI; this.isKey=true;
  }
  update(dt) { this.bob+=dt*2; }
  draw(camX,camY) {
    const tx=Math.floor(this.x), ty=Math.floor(this.y);
    if (!game.dungeon?.visible?.[ty]?.[tx]) return;
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY+Math.sin(this.bob)*3;
    ctx.save();
    ctx.shadowBlur=15; ctx.shadowColor=this.tileColour;
    ctx.fillStyle=this.tileColour;
    // Key shape: circle + teeth
    ctx.beginPath();
    ctx.arc(sx, sy-3, 5, 0, TWO_PI);
    ctx.fill();
    ctx.fillRect(sx-1.5, sy, 3, 8);
    ctx.fillRect(sx, sy+3, 4, 2);
    ctx.fillRect(sx, sy+6, 3, 2);
    ctx.restore();
  }
}
