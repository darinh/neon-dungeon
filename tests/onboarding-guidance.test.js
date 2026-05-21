'use strict';
// @ts-check

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const GAME = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
const SPEC = fs.readFileSync(path.join(ROOT, 'docs', 'spec.md'), 'utf8');

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const GAME_NC = stripComments(GAME);

function extractMethod(name, nextName) {
  const pattern = new RegExp(`${name}\\s*\\(\\s*\\)\\s*\\{[\\s\\S]*?\\n\\s{2}\\},?\\n\\s*${nextName}`);
  const match = GAME_NC.match(pattern);
  assert.ok(match, `${name} body must be findable`);
  return match[0];
}

function buildOnboardingLayoutHarness() {
  const match = GAME_NC.match(/function\s+getOnboardingGuidanceLayout\s*\(\s*narrow\s*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(match, 'getOnboardingGuidanceLayout body must be findable');
  const script = new vm.Script(`${match[0]}; getOnboardingGuidanceLayout(true);`);
  return (context) => script.runInNewContext(context);
}

test('renderPlaying draws first-floor onboarding after prompt indicator', () => {
  const renderPlaying = extractMethod('renderPlaying', 'renderOnboardingGuidance');
  assert.match(renderPlaying, /this\.renderSystemMessageIndicator\(\);\s*this\.renderOnboardingGuidance\(\);/,
    'onboarding guidance should render near narrative prompt affordances');
});

test('first-floor onboarding guidance is gated away from combat and prompts', () => {
  const guidance = extractMethod('renderOnboardingGuidance', 'renderPaused');
  assert.match(guidance, /this\.state\s*!==\s*'PLAYING'\s*\|\|\s*this\.floor\s*!==\s*1/,
    'guidance must only appear while actively playing floor 1');
  assert.match(guidance, /this\.hasPendingSystemMessage\(\)\s*\|\|\s*this\.systemMessageThreatActive\(\)/,
    'guidance must yield to unread system prompts and unsafe rooms');
  assert.match(GAME_NC, /Math\.min\(targetY,\s*layout\.hudTop\s*-\s*h\s*-\s*8\)/,
    'guidance must clamp above the bottom HUD on compact displays');
  assert.match(GAME_NC, /if\s*\(\s*y\s*\+\s*h\s*>\s*layout\.hudTop\s*-\s*8\s*\)\s*return\s+null/,
    'guidance must hide when ultra-compact displays cannot fit the card above the HUD');
});

test('first-floor onboarding layout fits normal compact displays and hides ultra-compact no-fit displays', () => {
  const getLayout = buildOnboardingLayoutHarness();
  const normalCompact = getLayout({
    W: 320,
    safeLeft: 0,
    safeRight: 0,
    safeTop: 0,
    layout: { hudTop: 262 },
  });
  assert.ok(normalCompact, '320x320-style compact fixture should fit onboarding guidance');
  assert.equal(normalCompact.x, 12);
  assert.equal(normalCompact.y + normalCompact.h <= 262 - 8, true,
    'normal compact card must end above the HUD guard band');

  const ultraCompact = getLayout({
    W: 200,
    safeLeft: 0,
    safeRight: 0,
    safeTop: 20,
    layout: { hudTop: 140 },
  });
  assert.equal(ultraCompact, null,
    '200x200-style compact fixture must hide guidance instead of overlapping the HUD');
});

test('first-floor onboarding explains objective and desktop/touch controls', () => {
  const guidance = extractMethod('renderOnboardingGuidance', 'renderPaused');
  assert.match(GAME, /Objective: clear rooms, read cyan terminals, find stairs\./,
    'guidance must state the immediate objective');
  assert.match(guidance, /KEY_DISPLAY\(km\('up'\)\)[\s\S]*KEY_DISPLAY\(km\('shoot'\)\)/,
    'desktop guidance must reflect current movement and shoot bindings');
  assert.match(guidance, /KEY_DISPLAY\(km\('interact'\)\)[\s\S]*KEY_DISPLAY\(km\('dash'\)\)[\s\S]*KEY_DISPLAY\(km\('voidshard'\)\)/,
    'desktop guidance must reflect current interact, dash, and bomb bindings');
  assert.match(guidance, /Left drag move · right drag aim \+ fire/,
    'touch guidance must use touch vocabulary');
  assert.match(guidance, /USE interact · DASH dodge · BOMB cracks\/walls/,
    'touch guidance must explain touch actions by button label');
});

test('spec documents first-floor onboarding guidance contract', () => {
  assert.match(SPEC, /renderOnboardingGuidance\(\)/,
    'spec must name the code surface that owns onboarding guidance');
  assert.match(SPEC, /floor 1[^.]+while `PLAYING`/s,
    'spec must pin the floor and state guards');
  assert.match(SPEC, /unread system prompt[^.]+unsafe rooms/s,
    'spec must pin the prompt and safety guards');
  assert.match(SPEC, /Objective: clear rooms, read cyan terminals, find stairs\./,
    'spec must preserve the immediate objective copy');
});
