'use strict';
// UNCHAINED #35 — hub state machine smoke tests. Node-only; no DOM/canvas.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const hub = require(path.resolve(__dirname, '..', 'src', 'meta', 'hub.js'));

function fakeGame(floor) {
  return {
    state: 'PLAYING',
    floor: floor | 0,
    hub: null,
    setState(s) { this.state = s; },
  };
}

test('enterHub flips state to HUB and captures floor/biome metadata', () => {
  const g = fakeGame(3);
  hub.enterHub(g);
  assert.equal(g.state, 'HUB');
  assert.ok(g.hub, 'hub state object exists');
  assert.equal(g.hub.fromFloor, 3);
  assert.equal(g.hub.nextFloor, 4);
  assert.equal(g.hub.selected, 0);
  assert.equal(g.hub.activePanel, null);
  assert.equal(g.hub.terminals.length, 4);
  assert.ok(typeof g.hub.biomeName === 'string' && g.hub.biomeName.length > 0);
});

test('exitHub clears hub and advances floor (no-fadeTo path)', () => {
  const g = fakeGame(2);
  hub.enterHub(g);
  hub.exitHub(g);
  assert.equal(g.hub, null);
  assert.equal(g.state, 'PLAYING');
  assert.equal(g.floor, 3);
});

test('terminals conform to the parallel-safety panel API', () => {
  const terms = hub.buildTerminals();
  assert.equal(terms.length, 4);
  for (const t of terms) {
    assert.equal(typeof t.id, 'string');
    assert.ok(t.id.length > 0, 'id non-empty');
    assert.equal(typeof t.label, 'string');
    assert.equal(typeof t.update, 'function');
    assert.equal(typeof t.draw, 'function');
    assert.equal(typeof t.onOpen, 'function');
    assert.equal(typeof t.onClose, 'function');
  }
  const ids = terms.map(t => t.id);
  assert.deepEqual(ids, ['upgrade', 'modules', 'armory', 'archive']);
});

test('updateHub advances selector with ArrowRight via injected input', () => {
  const g = fakeGame(1);
  hub.enterHub(g);
  const pressed = new Set(['ArrowRight']);
  g._hubInput = {
    jp: code => pressed.has(code),
    km: () => null,
  };
  hub.updateHub(g, 0.016);
  assert.equal(g.hub.selected, 1);
});

test('updateHub Space triggers exitHub', () => {
  const g = fakeGame(4);
  hub.enterHub(g);
  const pressed = new Set(['Space']);
  g._hubInput = { jp: c => pressed.has(c), km: () => null };
  hub.updateHub(g, 0.016);
  assert.equal(g.hub, null);
  assert.equal(g.floor, 5);
  assert.equal(g.state, 'PLAYING');
});

test('updateHub Enter opens selected panel; Escape closes it', () => {
  const g = fakeGame(1);
  hub.enterHub(g);
  let pressed = new Set(['Enter']);
  g._hubInput = { jp: c => pressed.has(c), km: () => null };
  hub.updateHub(g, 0.016);
  assert.ok(g.hub.activePanel, 'panel opened');
  assert.equal(g.hub.activePanel.id, 'upgrade');
  pressed = new Set(['Escape']);
  hub.updateHub(g, 0.016);
  assert.equal(g.hub.activePanel, null, 'panel closed');
});
