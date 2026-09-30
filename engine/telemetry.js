// @ts-check
// No PII. Session ids are random; events stay in localStorage until a transport is set.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).telemetry = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  const STORAGE_KEY = 'neon_telemetry';
  const MAX_QUEUE = 500;
  const MAX_STORED = 2000;
  const FLUSH_INTERVAL = 30;   // seconds

  /** @type {Array<{e:string,t:number,s:string,p:any}>} */
  let _queue = [];
  /** @type {string|null} */
  let _sessionId = null;
  let _sessionStart = 0;
  /** @type {((batch: any) => Promise<any>) | null} */
  let _transport = null;
  let _flushTimer = 0;
  /** @type {Storage|null} */
  let _storage = null;         // tests inject storage; production falls through to localStorage
  let _enabled = true;

  function _getStorage() {
    if (_storage) return _storage;
    try { return typeof localStorage !== 'undefined' ? localStorage : null; }
    catch (_) { return null; }
  }

  function _genId() {
    const a = new Uint8Array(8);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }

  /** @type {((this: Document, ev: Event) => any) | null} */
  let _visHandler = null;
  /** @type {((this: Window, ev: Event) => any) | null} */
  let _unloadHandler = null;

  /** @param {any} [opts] */
  function init(opts) {
    const o = opts || {};
    _sessionId = _genId();
    _sessionStart = Date.now();
    _transport = o.transport || null;
    _storage = o.storage || null;
    _enabled = o.enabled !== false;
    _queue = [];

    // init() can run again; drop the previous listeners or hide/unload flush twice.
    if (_visHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', _visHandler);
    }
    if (_unloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', _unloadHandler);
    }
    _visHandler = function () { if (document.visibilityState === 'hidden') flush(); };
    _unloadHandler = function () { flush(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', _visHandler);
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', _unloadHandler);

    // Coarse class only — a full userAgent is a fingerprint.
    let platform = 'unknown';
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/Mobile|Android/i.test(ua)) platform = 'mobile';
      else if (/Tablet|iPad/i.test(ua)) platform = 'tablet';
      else platform = 'desktop';
    }
    track('session_start', {
      platform,
      touchSupported: typeof navigator !== 'undefined' && 'ontouchstart' in (typeof window !== 'undefined' ? window : {}),
      timestamp: _sessionStart,
    });
  }

  /** @param {string} event @param {any} [props] */
  function track(event, props) {
    if (!_enabled) return;
    _queue.push({
      e: event,
      t: Date.now(),
      s: _sessionId || 'no-session',
      p: props || {},
    });
    if (_queue.length >= MAX_QUEUE) flush();
  }

  function flush() {
    if (!_queue.length) return;
    const batch = _queue.splice(0);
    _persist(batch);
    _send(batch);
  }

  /** @param {Array<any>} batch */
  function _persist(batch) {
    const store = _getStorage();
    if (!store) return;
    try {
      let existing;
      try { existing = JSON.parse(store.getItem(STORAGE_KEY) || '[]'); }
      catch (_) { existing = []; } // corrupted JSON: drop the old blob, keep this batch
      if (!Array.isArray(existing)) existing = [];
      const merged = existing.concat(batch);
      const trimmed = merged.length > MAX_STORED ? merged.slice(merged.length - MAX_STORED) : merged;
      store.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (_) { /* storage full or unavailable — drop silently */ }
  }

  /** @param {Array<any>} batch */
  function _send(batch) {
    if (!_transport) return;
    try {
      const store = _getStorage();
      const all = store ? JSON.parse(store.getItem(STORAGE_KEY) || '[]') : batch;
      const sentCount = all.length;
      const result = _transport(all);
      // Slice by the count we sent so events queued during the request stay stored.
      if (result && typeof result.then === 'function') {
        result.then(function () {
          try {
            if (!store) return;
            const current = JSON.parse(store.getItem(STORAGE_KEY) || '[]');
            if (current.length <= sentCount) { store.removeItem(STORAGE_KEY); }
            else { store.setItem(STORAGE_KEY, JSON.stringify(current.slice(sentCount))); }
          } catch (_) {}
        }).catch(function () { /* keep in localStorage for retry */ });
      }
    } catch (_) { /* transport error — data stays in localStorage */ }
  }

  // dt is seconds.
  /** @param {number} [dt] */
  function update(dt) {
    _flushTimer += (dt || 0);
    if (_flushTimer >= FLUSH_INTERVAL) {
      _flushTimer = 0;
      flush();
    }
  }

  function sessionId() { return _sessionId; }
  function sessionDuration() { return Date.now() - _sessionStart; }
  function queueLength() { return _queue.length; }

  function getStoredEvents() {
    const store = _getStorage();
    if (!store) return [];
    try { return JSON.parse(store.getItem(STORAGE_KEY) || '[]'); }
    catch (_) { return []; }
  }

  function clearStoredEvents() {
    const store = _getStorage();
    if (store) try { store.removeItem(STORAGE_KEY); } catch (_) {}
  }

  /** @param {any} fn */
  function setTransport(fn) { _transport = typeof fn === 'function' ? fn : null; }
  /** @param {any} v */
  function setEnabled(v) { _enabled = !!v; }

  /** @param {any} s */
  function _setStorageForTests(s) { _storage = s; }
  function _reset() { _queue = []; _sessionId = null; _sessionStart = 0; _transport = null; _flushTimer = 0; _enabled = true; _visHandler = null; _unloadHandler = null; }

  return {
    init,
    track,
    flush,
    update,
    sessionId,
    sessionDuration,
    queueLength,
    getStoredEvents,
    clearStoredEvents,
    setTransport,
    setEnabled,
    _setStorageForTests,
    _reset,
  };
}));
