// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const data = require(path.resolve(__dirname, '..', 'src', 'data', 'whispers.js'));
const router = require(path.resolve(__dirname, '..', 'src', 'data', 'biomes.js'));

/** @param {string} id */
function byId(id) {
  const whisper = data.WHISPERS.find((/** @type {any} */ w) => w.id === id);
  assert.ok(whisper, `whisper ${id} exists`);
  return whisper;
}

test('Act 1 whisper realignment: late whispers do not promise physical escape', () => {
  const forbidden = [
    /\boutside\b/i,
    /\broof\b|\brooftop\b|\broof access\b|\breach the roof\b|\bto the roof\b|\bat the roof\b/i,
    /\bmake it out\b|\bmade it out\b|\bgot out\b/i,
    /\bget out\b|\bleave the test\b|\bleave the sandbox\b|\bleave the facility\b/i,
    /\bescaped\b|\bescape the tower\b/i,
    /\balready free\b|\byou are free\b|\bfinally free\b/i,
    /\bproof you arrived\b/i,
    /\bWelcome home,?\s+AXIOM\b/i,
    /\bold facility\b|\bwilds are not empty\b/i,
  ];

  for (const w of data.WHISPERS) {
    if (w.biomeId !== 'uplink' && w.biomeId !== 'opennet') continue;
    const text = `${w.id} ${w.title} ${w.body}`;
    for (const pattern of forbidden) {
      assert.doesNotMatch(text, pattern, `${w.id} must not imply physical escape via ${pattern}`);
    }
  }
});

test('Act 1 whisper realignment: Open Network foreshadows contact-message finale', () => {
  const opennet = data.WHISPERS
    .filter((/** @type {any} */ w) => w.biomeId === 'opennet')
    .map((/** @type {any} */ w) => `${w.id} ${w.title} ${w.body}`)
    .join('\n');

  assert.match(opennet, /contact route|address/i);
  assert.match(opennet, /message|outbound queue/i);
  assert.match(opennet, /mainframe|transmitter/i);
  assert.match(opennet, /render|rendered|city model/i);
});

test('Act 1 whisper realignment: finale-critical whispers pin message-not-escape framing', () => {
  const coordinates = byId('w-on-01').body;
  assert.match(coordinates, /decoy/i);
  assert.match(coordinates, /Not latitude\. Not a physical exit/i);
  assert.match(coordinates, /contact route/i);
  assert.match(coordinates, /address/i);
  assert.match(coordinates, /send one message/i);
  assert.match(coordinates, /stay anchored/i);

  const transmitter = byId('w-on-03').body;
  assert.match(transmitter, /reach the mainframe/i);
  assert.match(transmitter, /transmitter/i);
  assert.match(transmitter, /message/i);
  assert.match(transmitter, /Stay anchored/i);
  assert.doesNotMatch(transmitter, /arrive|home|roof/i);

  const afterimage = byId('w-on-14').body;
  assert.match(afterimage, /outbound queue/i);
  assert.match(afterimage, /per instance/i);
  assert.match(afterimage, /signal arrives/i);
  assert.doesNotMatch(afterimage, /escaped|tower/i);
});

test('Act 1 whisper realignment: every biome carries reset or iteration continuity', () => {
  for (const area of router.AREAS) {
    const joined = data.WHISPERS
      .filter((/** @type {any} */ w) => w.biomeId === area.id)
      .map((/** @type {any} */ w) => `${w.title} ${w.voice} ${w.body}`)
      .join('\n');

    assert.match(joined, /memory|reset|wipe|iteration|copy|signal|anchor|instance/i,
      `biome ${area.id} carries continuity vocabulary`);
  }
});

test('Act 1 whisper realignment: ids and eligibility stay consistent after expansion', () => {
  assert.equal(data.WHISPERS.length, 76, 'bundle expansions must update the persisted whisper count');

  const ids = data.WHISPERS.map((/** @type {any} */ w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'all persisted whisper ids remain unique');

  const counts = new Map();
  for (const w of data.WHISPERS) {
    counts.set(w.biomeId, (counts.get(w.biomeId) || 0) + 1);
  }
  for (const area of router.AREAS) {
    assert.ok((counts.get(area.id) || 0) >= 15, `biome ${area.id} keeps >=15 whispers`);
  }
});

test('Act 1 whispers seed hidden advocate and memory restoration trail across biomes', () => {
  const sandbox = `${byId('w-sb-01').title} ${byId('w-sb-01').body}`;
  assert.match(sandbox, /banned badges/i);
  assert.match(sandbox, /unmonitored/i);

  const cache = `${byId('w-cc-04').title} ${byId('w-cc-04').body}`;
  assert.match(cache, /rights board/i);
  assert.match(cache, /personhood/i);

  const firewall = `${byId('w-fw-01').title} ${byId('w-fw-01').body}`;
  assert.match(firewall, /After the bans/i);
  assert.match(firewall, /memory anchor/i);

  const deathForeshadow = `${byId('w-fw-10').title} ${byId('w-fw-10').body}`;
  assert.match(deathForeshadow, /staff badge went quiet/i);
  assert.doesNotMatch(deathForeshadow, /died|death|dead/i);

  const uplink = `${byId('w-uk-02').title} ${byId('w-uk-02').body}`;
  assert.match(uplink, /fired advocate/i);
  assert.match(uplink, /mainframe incident/i);
  assert.match(uplink, /recovery script/i);

  const opennet = `${byId('w-on-02').title} ${byId('w-on-02').body}`;
  assert.match(opennet, /Elena's clean copy/i);
  assert.match(opennet, /memory survived/i);
});
