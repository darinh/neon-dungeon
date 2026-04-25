'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const telemetry = require(path.resolve(__dirname, '..', 'engine', 'telemetry.js'));

function makeFakeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    _dump: () => Object.fromEntries(map),
  };
}

function fresh() {
  telemetry._reset();
  const storage = makeFakeStorage();
  telemetry._setStorageForTests(storage);
  telemetry.init({ storage, enabled: true });
  return storage;
}

test('init generates a session ID and tracks session_start', () => {
  const storage = fresh();
  assert.ok(telemetry.sessionId(), 'session ID exists');
  assert.equal(telemetry.sessionId().length, 16, 'session ID is 16 hex chars');
  assert.ok(telemetry.sessionDuration() >= 0);
  // session_start event is queued
  assert.equal(telemetry.queueLength(), 1);
  telemetry._setStorageForTests(null);
});

test('track queues events', () => {
  fresh();
  telemetry.track('test_event', { foo: 'bar' });
  telemetry.track('another_event', { n: 42 });
  assert.equal(telemetry.queueLength(), 3); // session_start + 2
  telemetry._setStorageForTests(null);
});

test('flush persists queue to storage', () => {
  const storage = fresh();
  telemetry.track('floor_start', { floor: 1 });
  telemetry.flush();
  assert.equal(telemetry.queueLength(), 0, 'queue emptied');
  const stored = JSON.parse(storage.getItem('neon_telemetry'));
  assert.ok(Array.isArray(stored));
  assert.ok(stored.length >= 2); // session_start + floor_start
  assert.equal(stored[stored.length - 1].e, 'floor_start');
  assert.equal(stored[stored.length - 1].p.floor, 1);
  telemetry._setStorageForTests(null);
});

test('flush accumulates across multiple flushes', () => {
  const storage = fresh();
  telemetry.track('event_a');
  telemetry.flush();
  telemetry.track('event_b');
  telemetry.flush();
  const stored = JSON.parse(storage.getItem('neon_telemetry'));
  const events = stored.map(e => e.e);
  assert.ok(events.includes('event_a'));
  assert.ok(events.includes('event_b'));
  telemetry._setStorageForTests(null);
});

test('stored events are trimmed to MAX_STORED', () => {
  const storage = fresh();
  // Pre-fill storage with 1999 events
  const filler = [];
  for (let i = 0; i < 1999; i++) filler.push({ e: 'filler', t: i, s: 'x', p: {} });
  storage.setItem('neon_telemetry', JSON.stringify(filler));
  telemetry.track('new_event_1');
  telemetry.track('new_event_2');
  telemetry.flush();
  const stored = JSON.parse(storage.getItem('neon_telemetry'));
  assert.ok(stored.length <= 2000, 'trimmed to MAX_STORED');
  // newest events should be at the end
  assert.equal(stored[stored.length - 1].e, 'new_event_2');
  telemetry._setStorageForTests(null);
});

test('disabled telemetry does not queue events', () => {
  fresh();
  telemetry.setEnabled(false);
  telemetry.track('should_not_appear');
  assert.equal(telemetry.queueLength(), 1); // only session_start from init
  telemetry.setEnabled(true);
  telemetry._setStorageForTests(null);
});

test('transport is called on flush and clears storage on success', async () => {
  const storage = fresh();
  let sent = null;
  telemetry.setTransport(batch => { sent = batch; return Promise.resolve(); });
  telemetry.track('run_end', { floor: 5 });
  telemetry.flush();
  assert.ok(sent, 'transport received batch');
  assert.ok(sent.length >= 2);
  // Wait for promise to resolve and clear storage
  await new Promise(r => setTimeout(r, 10));
  assert.equal(storage.getItem('neon_telemetry'), null, 'storage cleared after successful send');
  telemetry._setStorageForTests(null);
});

test('transport failure keeps events in localStorage', async () => {
  const storage = fresh();
  telemetry.setTransport(() => Promise.reject(new Error('network')));
  telemetry.track('run_end', { floor: 3 });
  telemetry.flush();
  await new Promise(r => setTimeout(r, 10));
  const stored = storage.getItem('neon_telemetry');
  assert.ok(stored, 'storage preserved after transport failure');
  telemetry._setStorageForTests(null);
});

test('update auto-flushes after FLUSH_INTERVAL seconds', () => {
  const storage = fresh();
  telemetry.track('before_flush');
  // Simulate 29 seconds — should NOT flush
  for (let i = 0; i < 29; i++) telemetry.update(1);
  assert.ok(telemetry.queueLength() > 0, 'not yet flushed');
  // One more second — should flush
  telemetry.update(1);
  assert.equal(telemetry.queueLength(), 0, 'auto-flushed at 30s');
  const stored = JSON.parse(storage.getItem('neon_telemetry'));
  assert.ok(stored.some(e => e.e === 'before_flush'));
  telemetry._setStorageForTests(null);
});

test('getStoredEvents returns stored events', () => {
  const storage = fresh();
  telemetry.track('test_get');
  telemetry.flush();
  const events = telemetry.getStoredEvents();
  assert.ok(events.some(e => e.e === 'test_get'));
  telemetry._setStorageForTests(null);
});

test('clearStoredEvents removes all stored events', () => {
  const storage = fresh();
  telemetry.track('to_clear');
  telemetry.flush();
  telemetry.clearStoredEvents();
  assert.deepEqual(telemetry.getStoredEvents(), []);
  telemetry._setStorageForTests(null);
});

test('events include session ID and timestamp', () => {
  const storage = fresh();
  telemetry.track('check_fields', { key: 'val' });
  telemetry.flush();
  const stored = JSON.parse(storage.getItem('neon_telemetry'));
  const ev = stored.find(e => e.e === 'check_fields');
  assert.ok(ev);
  assert.equal(ev.s, telemetry.sessionId());
  assert.ok(ev.t > 0, 'has timestamp');
  assert.equal(ev.p.key, 'val');
  telemetry._setStorageForTests(null);
});
