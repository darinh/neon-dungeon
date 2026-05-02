// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TITLE_WAV = path.join(ROOT, 'assets', 'audio', 'title-theme.wav');

/** @param {string} file */
function readWavMeta(file) {
  const b = fs.readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WAVE');
  /** @type {any} */
  let fmt = null;
  /** @type {any} */
  let data = null;
  let off = 12;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    const start = off + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: b.readUInt16LE(start),
        channels: b.readUInt16LE(start + 2),
        sampleRate: b.readUInt32LE(start + 4),
        byteRate: b.readUInt32LE(start + 8),
        blockAlign: b.readUInt16LE(start + 12),
        bitsPerSample: b.readUInt16LE(start + 14),
      };
    } else if (id === 'data') {
      data = { size };
    }
    off = start + size + (size % 2);
  }
  assert.ok(fmt, 'fmt chunk present');
  assert.ok(data, 'data chunk present');
  return { fmt, data, seconds: data.size / fmt.byteRate };
}

test('title music asset is a browser-playable 24-bit stereo WAV loop', () => {
  const meta = readWavMeta(TITLE_WAV);
  assert.equal(meta.fmt.audioFormat, 1, 'PCM WAV');
  assert.equal(meta.fmt.channels, 2, 'stereo');
  assert.equal(meta.fmt.sampleRate, 44100, '44.1kHz export');
  assert.equal(meta.fmt.bitsPerSample, 24, '24-bit source quality preserved');
  assert.ok(meta.seconds > 21 && meta.seconds < 23, `12-bar title loop duration: ${meta.seconds}`);
});

test('title music is precached for the offline PWA shell', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/assets\/audio\/title-theme\.wav'/);
});

test('menu state owns title music and gameplay leaves it', () => {
  const content = fs.readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8');
  const game = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
  const platform = fs.readFileSync(path.join(ROOT, 'src', 'platform.js'), 'utf8');
  assert.match(content, /TITLE_THEME_SRC = '\.\/assets\/audio\/title-theme\.wav'/);
  assert.match(content, /if \(s === 'menu'\)/);
  assert.match(content, /function tryPlayTitle\(force\)/);
  assert.match(content, /const TITLE_THEME_GAIN = 0\.28;/);
  assert.match(content, /if \(!force && now < titleRetryAt\) return;/);
  assert.match(content, /tryPlayTitle\(true\);/);
  assert.match(content, /tryPlayTitle\(false\);/);
  assert.match(content, /isTitlePlaying\(\) \{\n      return titleWanted && !!titleAudio && !titleAudio\.paused;\n    \}/);
  assert.match(game, /if \(s === 'MENU'\) \{ this\.menuSel = 0; this\._menuTitleUnlockConsumed = false; this\._menuTitleUnlockPending = false; music\.setState\('menu'\); \}/);
  assert.match(game, /game\.state='MENU';\nmusic\.setState\('menu'\);/);
  assert.doesNotMatch(game, /updateMenu\(dt\) \{\n    music\.setState\('menu'\);/);
  assert.match(game, /prevState === 'MENU' \|\| prevState === 'SEED_SETUP' \|\| prevState === 'ARCHIVES'/);
  assert.match(game, /music\.setState\('explore'\);\n      else music\.resume\(\);/);
  assert.match(game, /if \(this\._menuTitleUnlockPending\) \{/);
  assert.match(game, /this\._menuTitleUnlockPending = false;/);
  assert.match(game, /this\._menuTitleUnlockConsumed = true;/);
  assert.match(platform, /function resumeInteractiveAudio\(consumeMenuActivation\)/);
  assert.match(platform, /function menuTitleNeedsGestureUnlock\(\)/);
  assert.match(platform, /const consumeTitleUnlock = consumeMenuActivation && menuTitleNeedsGestureUnlock\(\);/);
  assert.match(platform, /if \(consumeTitleUnlock\) _G\._menuTitleUnlockPending = true;/);
  assert.match(platform, /_G\.state === 'MENU' \|\| _G\.state === 'SEED_SETUP' \|\| _G\.state === 'ARCHIVES'/);
  assert.match(platform, /_G\.state === 'SETTINGS' && _G\._settingsFrom === 'MENU'/);
});
