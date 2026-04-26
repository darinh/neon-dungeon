// Tests for engine/math.js — pure math + RNG primitives.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const math = require(path.join(__dirname, '..', 'engine', 'math.js'));

test('exports the documented surface', () => {
  assert.deepEqual(
    Object.keys(math).sort(),
    ['clamp', 'dist', 'dist2', 'lerp', 'norm', 'rnd', 'rndInt'].sort()
  );
});

test('clamp: constrains to [lo, hi]', () => {
  assert.equal(math.clamp(5, 0, 10), 5);
  assert.equal(math.clamp(-1, 0, 10), 0);
  assert.equal(math.clamp(99, 0, 10), 10);
  assert.equal(math.clamp(0, 0, 10), 0);
  assert.equal(math.clamp(10, 0, 10), 10);
});

test('clamp: handles negative ranges', () => {
  assert.equal(math.clamp(-5, -10, -1), -5);
  assert.equal(math.clamp(-20, -10, -1), -10);
  assert.equal(math.clamp(0, -10, -1), -1);
});

test('lerp: linear interpolation, no clamping', () => {
  assert.equal(math.lerp(0, 10, 0), 0);
  assert.equal(math.lerp(0, 10, 1), 10);
  assert.equal(math.lerp(0, 10, 0.5), 5);
  // No clamp on t — extrapolation is allowed (used by easing/anim code).
  assert.equal(math.lerp(0, 10, 2), 20);
  assert.equal(math.lerp(0, 10, -1), -10);
});

test('dist: euclidean distance', () => {
  assert.equal(math.dist(0, 0, 3, 4), 5);
  assert.equal(math.dist(0, 0, 0, 0), 0);
  assert.equal(math.dist(1, 1, 1, 1), 0);
  assert.equal(math.dist(-1, -1, 2, 3), 5);
});

test('dist2: squared distance avoids sqrt', () => {
  assert.equal(math.dist2(0, 0, 3, 4), 25);
  assert.equal(math.dist2(0, 0, 0, 0), 0);
  assert.equal(math.dist2(-2, -3, 1, 1), 25);
});

test('norm: returns unit vector', () => {
  const [nx, ny] = math.norm(3, 4);
  assert.equal(nx, 0.6);
  assert.equal(ny, 0.8);
});

test('norm: zero vector returns (0, 0) without dividing by zero', () => {
  const [nx, ny] = math.norm(0, 0);
  assert.equal(nx, 0);
  assert.equal(ny, 0);
});

test('rnd: returns float in [min, max)', () => {
  for (let i = 0; i < 1000; i++) {
    const v = math.rnd(2, 5);
    assert.ok(v >= 2 && v < 5, `rnd out of range: ${v}`);
  }
});

test('rndInt: returns integer in [min, max] inclusive', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const v = math.rndInt(1, 4);
    assert.ok(Number.isInteger(v), `not int: ${v}`);
    assert.ok(v >= 1 && v <= 4, `out of range: ${v}`);
    seen.add(v);
  }
  // With 5000 trials over 4 buckets, all should appear.
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4]);
});

test('rndInt: min == max returns min', () => {
  for (let i = 0; i < 100; i++) {
    assert.equal(math.rndInt(7, 7), 7);
  }
});
