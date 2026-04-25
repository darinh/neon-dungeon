// Tests for engine/audio.js — Web Audio synth engine factory.
//
// Strategy: inject a fake `win` with a stub AudioContext into createEngine,
// then assert the engine wires up master/reverb/music busses, lazy-mounts
// on first call, and emits the right node types from osc/noise/wetDry.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createEngine } = require(path.join(__dirname, '..', 'engine', 'audio.js'));

// ─── Fake AudioContext ──────────────────────────────────────────────────────
function makeFakeNode(kind, ctx) {
  const node = {
    _kind: kind,
    _connections: [],
    _disconnected: false,
    connect(target) { this._connections.push(target); ctx._connections.push({ from: this, to: target }); return target; },
    disconnect() { this._disconnected = true; },
    gain: { value: 0, _ramps: [], setValueAtTime(v, t) { this.value = v; this._ramps.push(['set', v, t]); }, linearRampToValueAtTime(v, t) { this.value = v; this._ramps.push(['lin', v, t]); }, exponentialRampToValueAtTime(v, t) { this.value = v; this._ramps.push(['exp', v, t]); }, cancelScheduledValues() { this._ramps.length = 0; } },
    threshold: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    pan: { value: 0 },
    Q: { value: 0 },
    frequency: { value: 0, setValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; } },
    detune: { value: 0 },
    type: '',
    buffer: null,
    start() { this._started = true; },
    stop() { this._stopped = true; },
  };
  return node;
}

function makeFakeCtx() {
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 1000, // small so noiseBuf init is cheap
    destination: { _kind: 'destination', _connections: [] },
    _connections: [],
    _created: [],
    _track(kind) { const n = makeFakeNode(kind, this); this._created.push(n); return n; },
    createDynamicsCompressor() { return this._track('compressor'); },
    createGain() { return this._track('gain'); },
    createConvolver() { return this._track('convolver'); },
    createOscillator() { return this._track('osc'); },
    createBiquadFilter() { return this._track('filter'); },
    createBufferSource() { return this._track('bufferSource'); },
    createStereoPanner() { return this._track('panner'); },
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      return { numberOfChannels: channels, length, sampleRate: rate, getChannelData() { return data; } };
    },
    resume() { this.state = 'running'; return Promise.resolve(); },
  };
  return ctx;
}

function makeWin() {
  const ctx = makeFakeCtx();
  return { win: { AudioContext: function () { return ctx; } }, ctx };
}

// ─── Surface ────────────────────────────────────────────────────────────────
test('exports { createEngine }', () => {
  const mod = require(path.join(__dirname, '..', 'engine', 'audio.js'));
  assert.deepEqual(Object.keys(mod), ['createEngine']);
});

test('engine surface is the documented set', () => {
  const { win } = makeWin();
  const eng = createEngine({ win, getSfxVolume: () => 1, getMusicVolume: () => 1 });
  const expected = ['getCtx', 'resume', 'isRunning', 'setSfxVolume', 'setMusicVolume', 'getMusicBus', 'getNoiseBuffer', 'panOut', 'osc', 'noise', 'wetDry'].sort();
  assert.deepEqual(Object.keys(eng).sort(), expected);
});

// ─── Lazy init ──────────────────────────────────────────────────────────────
test('getCtx() lazily mounts compressor + master + reverb + noise buffer', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win, getSfxVolume: () => 0.5, getMusicVolume: () => 1 });
  assert.equal(ctx._created.length, 0, 'no nodes before getCtx()');
  assert.equal(eng.getNoiseBuffer(), null, 'no noise buffer before getCtx()');

  const c = eng.getCtx();
  assert.equal(c, ctx);
  // compressor + master gain + convolver + reverbGain = 4 nodes minimum
  const kinds = ctx._created.map(n => n._kind);
  assert.ok(kinds.includes('compressor'));
  assert.ok(kinds.includes('gain'));
  assert.ok(kinds.includes('convolver'));
  assert.ok(eng.getNoiseBuffer() !== null, 'noise buffer mounted');

  // Master gain should reflect 0.7 * sfxVol(0.5) = 0.35 before any ramp
  const master = ctx._created.find(n => n._kind === 'gain');
  assert.equal(master.gain.value, 0.35);

  // Second call returns same context, no new mounting
  const before = ctx._created.length;
  eng.getCtx();
  assert.equal(ctx._created.length, before);
});

test('isRunning reflects ctx.state', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win });
  assert.equal(eng.isRunning(), false, 'pre-init');
  eng.getCtx();
  assert.equal(eng.isRunning(), false, 'suspended after init');
  ctx.state = 'running';
  assert.equal(eng.isRunning(), true);
});

test('resume() calls ctx.resume()', async () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win });
  eng.resume();
  await new Promise(r => setTimeout(r, 5));
  assert.equal(ctx.state, 'running');
});

// ─── Volume control ─────────────────────────────────────────────────────────
test('setSfxVolume() ramps master gain to 0.7*v', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win, getSfxVolume: () => 1 });
  eng.getCtx();
  const master = ctx._created.find(n => n._kind === 'gain');
  eng.setSfxVolume(0.5);
  // last ramp should be linearRampToValueAtTime to 0.35
  const last = master.gain._ramps[master.gain._ramps.length - 1];
  assert.deepEqual(last, ['lin', 0.35, 0.02]);
});

test('setSfxVolume() before getCtx() is a no-op (no master yet)', () => {
  const { win } = makeWin();
  const eng = createEngine({ win });
  eng.setSfxVolume(0.5); // must not throw
});

test('getMusicBus() lazy-mounts music compressor + bus', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win, getMusicVolume: () => 0.5 });
  const { bus, ctx: c } = eng.getMusicBus();
  assert.equal(c, ctx);
  // Music bus gain = 0.20 * 0.5 = 0.1
  assert.equal(bus.gain.value, 0.1);
  // Second call returns same bus
  assert.equal(eng.getMusicBus().bus, bus);
});

test('setMusicVolume() ramps music bus gain to 0.20*v', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win, getMusicVolume: () => 1 });
  eng.getMusicBus();
  // Find the music bus: it was created AFTER reverb stuff; the second-to-last gain.
  // Easier: setMusicVolume on a known volume and check the most-recently-rampled gain.
  eng.setMusicVolume(0.5);
  const gains = ctx._created.filter(n => n._kind === 'gain');
  const ramped = gains.find(g => g.gain._ramps.some(r => r[0] === 'lin' && r[1] === 0.10));
  assert.ok(ramped, 'a gain node was ramped to 0.10 (= 0.20 * 0.5)');
});

// ─── Voice helpers ──────────────────────────────────────────────────────────
test('osc() schedules an oscillator + gain and connects them', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win });
  eng.osc('sine', 440, 220, 0.5, 0, 0.1);
  const oscs = ctx._created.filter(n => n._kind === 'osc');
  assert.equal(oscs.length, 1);
  assert.equal(oscs[0].type, 'sine');
  assert.ok(oscs[0]._started);
  assert.ok(oscs[0]._stopped);
});

test('osc() with filterType creates a biquad filter', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win });
  eng.osc('square', 200, 800, 0.3, 0, 0.05, null, { filterType: 'lowpass', filterFreq: 1200, q: 2 });
  const filters = ctx._created.filter(n => n._kind === 'filter');
  assert.equal(filters.length, 1);
  assert.equal(filters[0].type, 'lowpass');
  assert.equal(filters[0].Q.value, 2);
});

test('noise() uses the cached noise buffer', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win });
  eng.noise(0.3, 0, 0.05, 800);
  const sources = ctx._created.filter(n => n._kind === 'bufferSource');
  assert.equal(sources.length, 1);
  assert.equal(sources[0].buffer, eng.getNoiseBuffer(), 'reuses the cached buffer');
});

test('wetDry() returns a split gain wired to dry + reverb wet busses', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win });
  const split = eng.wetDry(0.8, 0.4, 0.5);
  assert.equal(split.gain.value, 0.8);
  // split should connect to two gain nodes (dry + wet)
  assert.equal(split._connections.length, 2);
  assert.ok(split._connections.every(n => n._kind === 'gain'));
});

// ─── panOut ─────────────────────────────────────────────────────────────────
test('panOut() with |pan|<0.01 returns target unchanged (no panner created)', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win });
  eng.getCtx();
  const before = ctx._created.filter(n => n._kind === 'panner').length;
  const target = { _kind: 'fakeTarget' };
  const out = eng.panOut(target, 0.005, 0.2);
  assert.equal(out, target);
  assert.equal(ctx._created.filter(n => n._kind === 'panner').length, before);
});

test('panOut() with significant pan creates and connects a StereoPanner', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win });
  eng.getCtx();
  const target = { _kind: 'fakeTarget', _connections: [], connect(t) { this._connections.push(t); } };
  const out = eng.panOut(target, 0.5, 0.2);
  const panners = ctx._created.filter(n => n._kind === 'panner');
  assert.equal(panners.length, 1);
  assert.equal(panners[0].pan.value, 0.5);
  assert.equal(out, panners[0]);
});

test('panOut() with no createStereoPanner falls back to target', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win });
  eng.getCtx();
  ctx.createStereoPanner = null;
  const target = { _kind: 'fakeTarget' };
  assert.equal(eng.panOut(target, 0.9, 0.2), target);
});

// ─── Defaults ───────────────────────────────────────────────────────────────
test('createEngine() with no opts defaults volumes to 1', () => {
  const { win, ctx } = makeWin();
  const eng = createEngine({ win });
  eng.getCtx();
  const master = ctx._created.find(n => n._kind === 'gain');
  assert.equal(master.gain.value, 0.7);
});
