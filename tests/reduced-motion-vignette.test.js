'use strict';
// REDUCED MOTION extension: drawDangerVignette freezes its sin-pulse at
// the midpoint when settings.reducedMotion is on. The full-screen red
// vignette is the most prominent low-HP safety signal, but the 2-second
// sin-pulse (alpha modulated by sin(player.lowHpTimer * Math.PI)) is
// precisely the photosensitivity / vestibular trigger the setting exists
// to mitigate. Keep the vignette VISIBLE — it's a critical danger
// signal — but freeze the throbbing motion.
//
// This extends the umbrella established by:
//   PR #182 — LEVEL UP flash gate
//   PR #186 — particle burst halving

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const CONTENT_NC = stripComments(CONTENT);

// ─── Source wiring ────────────────────────────────────────────────────────

test('reduced-motion-vignette: drawDangerVignette gates the pulse on settings.reducedMotion', () => {
  const body = CONTENT_NC.match(
    /function\s+drawDangerVignette\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body, 'drawDangerVignette function body must be findable');
  assert.match(body[0], /settings\.reducedMotion/,
    'drawDangerVignette must reference settings.reducedMotion');
  // The gate must compute pulse via the settings.reducedMotion ternary —
  // a static 0.5 midpoint when on, full sin oscillation when off. The
  // 0.5 midpoint preserves the average alpha so the vignette intensity
  // is roughly the same on both paths.
  assert.match(body[0], /settings\.reducedMotion\s*\?\s*0\.5/,
    'drawDangerVignette must use 0.5 (midpoint) as the static pulse value when reducedMotion is on');
});

test('reduced-motion-vignette: vignette visibility itself is NOT gated (safety signal preserved)', () => {
  // Critical: the early-return condition must remain "frac > 0.25 OR
  // hp <= 0" — adding a `|| settings.reducedMotion` here would HIDE
  // the vignette entirely, removing the danger signal. Defense check.
  const body = CONTENT_NC.match(
    /function\s+drawDangerVignette\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body, 'drawDangerVignette function body must be findable');
  // The early return must reference frac and hp, NOT settings.reducedMotion.
  const earlyReturn = body[0].match(/if\s*\(\s*frac[\s\S]{0,80}\)\s*return/);
  assert.ok(earlyReturn, 'early-return guard on frac must exist');
  assert.doesNotMatch(earlyReturn[0], /reducedMotion/,
    'early-return must NOT include reducedMotion (would suppress critical safety signal)');
});

test('reduced-motion-vignette: pulse expression preserves the original sin oscillation when off', () => {
  const body = CONTENT_NC.match(
    /function\s+drawDangerVignette\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body, 'drawDangerVignette function body must be findable');
  // The "off" branch of the ternary must preserve the original
  // 0.5 + 0.5 * Math.sin(player.lowHpTimer * Math.PI) expression so
  // existing motion-sensitive players who haven't opted in get the
  // original behaviour byte-for-byte.
  assert.match(body[0],
    /0\.5\s*\+\s*0\.5\s*\*\s*Math\.sin\s*\(\s*player\.lowHpTimer\s*\*\s*Math\.PI\s*\)/,
    'the reducedMotion=off branch must preserve the original sin pulse expression');
});

// ─── Behavioural exercise ────────────────────────────────────────────────

test('reduced-motion-vignette: behavioural — alpha is constant (frozen) when reducedMotion is on', () => {
  // Stand up a sandbox that captures ctx.globalAlpha at draw time. A
  // frozen pulse should yield the same alpha across multiple lowHpTimer
  // values; an oscillating pulse should yield different values.
  const body = CONTENT_NC.match(
    /function\s+drawDangerVignette\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body, 'drawDangerVignette function body must be extractable');

  const makeSandbox = (reducedMotion) => {
    const alphaSamples = [];
    const ctx = {
      _alpha: 1,
      get globalAlpha() { return this._alpha; },
      set globalAlpha(v) { this._alpha = v; alphaSamples.push(v); },
      save() {}, restore() {}, fillRect() {}, strokeRect() {},
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillStyle: '', strokeStyle: '', lineWidth: 0, shadowBlur: 0, shadowColor: '',
    };
    return { ctx, settings: { reducedMotion }, alphaSamples };
  };

  const fn = new Function( // eslint-disable-line no-new-func
    'ctx', 'settings', 'W', 'H', 'Math',
    body[0] + '\nreturn drawDangerVignette;'
  );

  // Reduced-motion ON: probe at three different lowHpTimer values; the
  // FIRST captured alpha (the non-stroke main fill) should be identical
  // across probes since the pulse is frozen.
  const onProbes = [0.0, 0.5, 1.0].map(t => {
    const s = makeSandbox(true);
    const draw = fn(s.ctx, s.settings, 800, 600, Math);
    draw({ hp: 10, maxHp: 100, lowHpTimer: t });
    return s.alphaSamples[0]; // first set is the main vignette alpha
  });
  assert.equal(onProbes[0], onProbes[1],
    'reducedMotion=on: alpha at lowHpTimer=0 must match alpha at lowHpTimer=0.5 (pulse frozen)');
  assert.equal(onProbes[1], onProbes[2],
    'reducedMotion=on: alpha at lowHpTimer=0.5 must match alpha at lowHpTimer=1.0 (pulse frozen)');

  // Reduced-motion OFF: same probes should produce DIFFERENT alpha
  // values (sin oscillation is alive).
  const offProbes = [0.0, 0.5, 1.0].map(t => {
    const s = makeSandbox(false);
    const draw = fn(s.ctx, s.settings, 800, 600, Math);
    draw({ hp: 10, maxHp: 100, lowHpTimer: t });
    return s.alphaSamples[0];
  });
  // At lowHpTimer=0 → sin(0)=0 → pulse=0.5 (matches frozen midpoint).
  // At lowHpTimer=0.5 → sin(π/2)=1 → pulse=1.0 (peak).
  // At lowHpTimer=1.0 → sin(π)=0 → pulse=0.5 (back to mid).
  // So offProbes[0] === offProbes[2] (both at sin=0 → pulse=0.5), but
  // offProbes[1] > offProbes[0] (peak vs mid). The peak proves the
  // oscillation is alive when reducedMotion is off.
  assert.ok(offProbes[1] > offProbes[0],
    `reducedMotion=off: alpha at peak (t=0.5) must exceed mid (t=0); got peak=${offProbes[1]}, mid=${offProbes[0]}`);

  // Cross-check: the reducedMotion=on alpha must equal the off alpha
  // at sin=0 (both compute pulse=0.5), proving the average intensity
  // is preserved.
  assert.equal(onProbes[0], offProbes[0],
    'reducedMotion=on must use pulse=0.5 (the same value reducedMotion=off computes at sin=0)');
});

test('reduced-motion-vignette: vignette early-returns when player above 25% HP regardless of setting', () => {
  const body = CONTENT_NC.match(
    /function\s+drawDangerVignette\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body);
  const ctx = {
    _calls: 0,
    save() { this._calls++; }, restore() {}, fillRect() {}, strokeRect() {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    fillStyle: '', strokeStyle: '', lineWidth: 0, shadowBlur: 0, shadowColor: '',
    globalAlpha: 1,
  };
  const fn = new Function( // eslint-disable-line no-new-func
    'ctx', 'settings', 'W', 'H', 'Math',
    body[0] + '\nreturn drawDangerVignette;'
  );
  const draw = fn(ctx, { reducedMotion: true }, 800, 600, Math);
  draw({ hp: 50, maxHp: 100, lowHpTimer: 0 });
  assert.equal(ctx._calls, 0,
    'vignette must early-return at 50% HP — no draw work, no save/restore');
});
