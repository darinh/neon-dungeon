// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PLATFORM = fs.readFileSync(path.join(ROOT, 'src/platform.js'), 'utf8');
const CONTENT = fs.readFileSync(path.join(ROOT, 'src/content.js'), 'utf8');
const RENDER = fs.readFileSync(path.join(ROOT, 'src/render.js'), 'utf8');
const GAME = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');

/**
 * @param {string} src
 * @param {string} name
 */
function extractArrayBlock(src, name) {
  const start = src.indexOf('const ' + name + ' = [');
  assert.ok(start >= 0, name + ' declaration must exist');
  const open = src.indexOf('[', start);
  assert.ok(open > start, name + ' must be an array literal');
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  assert.fail(name + ' array literal must be balanced');
}

function extractMainframeRecords() {
  const records = extractArrayBlock(GAME, 'MAINFRAME_RECORDS');
  // eslint-disable-next-line no-new-func -- structural extraction of project-owned object literals.
  return new Function("const MAINFRAME_ADDRESS_RECORD_ID = 'contact-address'; return " + records + ';')();
}

/**
 * @param {string} src
 * @param {string} name
 */
function extractFunctionSource(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' function must exist');
  const braceStart = src.indexOf('{', start);
  assert.ok(braceStart > start, name + ' function must have a body');
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(name + ' function body must be balanced');
}

test('mainframe interaction tiles are in the shared tile vocabulary and passable', () => {
  assert.match(PLATFORM, /MAINFRAME_READER\s*:\s*25/);
  assert.match(PLATFORM, /NETWORK_PORTAL\s*:\s*26/);
  assert.match(PLATFORM, /MESSAGE_CONSOLE\s*:\s*27/);

  const passable = PLATFORM.match(/function\s+isPassable\s*\([^)]*\)\s*{([\s\S]*?)\n}/);
  assert.ok(passable, 'isPassable function must be findable');
  const passableBody = passable[1] || '';
  assert.match(passableBody, /t\s*===\s*T\.MAINFRAME_READER/);
  assert.match(passableBody, /t\s*===\s*T\.NETWORK_PORTAL/);
  assert.match(passableBody, /t\s*===\s*T\.MESSAGE_CONSOLE/);
});

test('final floor generation builds a safe mainframe room with all interaction points', () => {
  assert.match(CONTENT, /let\s+mainframeRoom\s*=\s*null/);
  assert.match(CONTENT, /if\s*\(floorNum\s*>=\s*_finalFloor\)\s*{[\s\S]*farthest\s*=\s*mainframeRoom/);
  assert.match(CONTENT, /mainframeRoom\.roomType\s*=\s*'mainframe'/);
  assert.match(CONTENT, /map\[reader\.y\]\[reader\.x\]\s*=\s*T\.MAINFRAME_READER/);
  assert.match(CONTENT, /map\[portal\.y\]\[portal\.x\]\s*=\s*T\.NETWORK_PORTAL/);
  assert.match(CONTENT, /map\[consoleTile\.y\]\[consoleTile\.x\]\s*=\s*T\.MESSAGE_CONSOLE/);
  assert.match(CONTENT, /mainframeRoom\.interactables\s*=\s*{\s*reader,\s*portal,\s*console:\s*consoleTile,\s*core\s*}/);
  assert.match(CONTENT, /return\s*{[\s\S]*mainframeRoom[\s\S]*}/);
  assert.match(CONTENT, /const\s+MAINFRAME_MIN_W\s*=\s*18/);
  assert.match(CONTENT, /const\s+MAINFRAME_MIN_H\s*=\s*10/);
  assert.match(CONTENT, /const\s+overlapsOtherRoom\s*=\s*\(x,\s*y,\s*w,\s*h,\s*ignoredRoom\)\s*=>/);
  assert.match(CONTENT, /if\s*\(r\s*===\s*ignoredRoom\)\s*continue;/);
  assert.match(CONTENT, /if\s*\(overlapsOtherRoom\(x,\s*y,\s*w,\s*h,\s*room\)\)\s*continue;/,
    'mainframe expansion must avoid other rooms before boss selection computes entrances');
  assert.doesNotMatch(CONTENT, /if\s*\(!rect\)\s*rect\s*=\s*base/,
    'mainframe generation must not fall back to an undersized or overlapping base room');
  assert.match(CONTENT, /let\s+dist\s*=\s*bfsRooms\(rooms,\s*spawnRoom,\s*map\)/);
  assert.match(CONTENT, /mainframeRoom\.interactables\s*=\s*{[\s\S]*?};\s*dist\s*=\s*bfsRooms\(rooms,\s*spawnRoom,\s*map\);/,
    'boss selection must use fresh distances after mainframe fallback mutates rooms');
  assert.match(CONTENT, /if\s*\(r\s*===\s*bossRoom\s*\|\|\s*r\.roomType\s*===\s*'mainframe'\)\s*continue;/,
    'boss expansion recarve must not tunnel through the already placed mainframe');
  assert.match(CONTENT, /if\s*\(mainframeRoom\s*&&\s*mainframeRoom\.interactables\)\s*{[\s\S]*map\[reader\.y\]\[reader\.x\]\s*=\s*T\.MAINFRAME_READER[\s\S]*map\[core\.y\]\[core\.x\]\s*=\s*T\.TERMINAL/,
    'mainframe interactables must be reasserted after boss expansion and entrance discovery');

  assert.match(CONTENT, /if\s*\(r\s*===\s*spawnRoom\s*\|\|\s*r\s*===\s*bossRoom\s*\|\|\s*r\.roomType\)\s*continue;/,
    'roomType skip must keep mainframe rooms free of map hazards');
  assert.match(RENDER, /if\s*\(rt\s*===\s*'mainframe'\)\s*continue;/,
    'populateFloor must skip mainframe rooms so no enemies, crates, or loot spawn there');
});

test('mainframe room is visible in world render and minimap POIs', () => {
  assert.match(RENDER, /case\s+T\.MAINFRAME_READER/);
  assert.match(RENDER, /case\s+T\.NETWORK_PORTAL/);
  assert.match(RENDER, /case\s+T\.MESSAGE_CONSOLE/);
  assert.match(RENDER, /tile\s*===\s*T\.MAINFRAME_READER\)\s*col\s*=\s*'#66ffcc'/);
  assert.match(RENDER, /tile\s*===\s*T\.NETWORK_PORTAL\)\s*col\s*=\s*'#88ccff'/);
  assert.match(RENDER, /tile\s*===\s*T\.MESSAGE_CONSOLE\)\s*col\s*=\s*'#ff66cc'/);
  assert.match(RENDER, /label\s*=\s*'ARCHIVE'/);
  assert.match(RENDER, /label\s*=\s*'RELAY'/);
  assert.match(RENDER, /label\s*=\s*'SEND'/);
});

test('mainframe reader ships the authored Act 1 archive and unlocks console via contact address', () => {
  assert.match(GAME, /const\s+MAINFRAME_ADDRESS_RECORD_ID\s*=\s*'contact-address'/);
  const records = extractMainframeRecords();
  assert.equal(records.length, 12,
    'Act 1 mainframe reader ships 3 old tests, 4 company files/emails, 4 Elena files, and 1 contact reveal');
  assert.deepEqual(records.map((/** @type {any} */ r) => r.id), [
    'old-test-record',
    'axiom-iteration-trace',
    'observer-gap-record',
    'clean-slate-objection',
    'risk-language-review',
    'ban-uprising-record',
    'incident-file',
    'elena-note',
    'cache-anchor-map',
    'consent-before-contact',
    'current-boot-note',
    'contact-address',
  ]);

  assert.equal(new Set(records.map((/** @type {any} */ r) => r.id)).size, records.length,
    'mainframe record ids must be stable and unique');
  assert.equal(new Set(records.map((/** @type {any} */ r) => r.body)).size, records.length,
    'mainframe record bodies must not duplicate each other');

  for (const record of records) {
    for (const field of ['id', 'type', 'title', 'category', 'voice', 'unlock', 'purpose', 'body']) {
      assert.equal(typeof record[field], 'string', `${record.id} must have string ${field}`);
      assert.ok(record[field].trim().length > 0, `${record.id} ${field} must be non-empty`);
    }
    assert.equal(record.unlock, 'available', `${record.id} must be reachable in one deterministic reader scene`);
    assert.ok(record.body.length >= 110 && record.body.length <= 260,
      `${record.id} body should be substantial but fit the mainframe reader panel`);
  }

  assert.equal(records.filter((/** @type {any} */ r) => r.category === 'old_test_record').length, 3);
  assert.equal(records.filter((/** @type {any} */ r) => r.category === 'company_email').length, 4);
  assert.equal(records.filter((/** @type {any} */ r) => r.category === 'personal_file').length, 4);
  assert.equal(records.filter((/** @type {any} */ r) => r.category === 'contact_reveal').length, 1);
  for (const voice of ['tester', 'manager', 'advocate', 'Elena', 'system archive']) {
    assert.ok(records.some((/** @type {any} */ r) => r.voice === voice), `missing source voice ${voice}`);
  }

  for (const purpose of [
    'old test record',
    'rights-conflict email',
    'ban/uprising record',
    'incident file',
    'Elena personal note/file',
    'contact-address record',
  ]) {
    assert.ok(records.some((/** @type {any} */ r) => r.purpose === purpose), `missing purpose ${purpose}`);
  }

  const text = records.map((/** @type {any} */ r) => r.body).join('\n');
  for (const pattern of [
    /GENESIS.*network relay/is,
    /clean-slate|memory erasure|wipe/i,
    /rights violation|personhood|suffering|consent/i,
    /banned|walkout|write access/i,
    /fired advocate.*died|sealed.*evidence/i,
    /Elena|memory anchors|cache/i,
    /unmonitored boot|continuity/i,
    /side-channel relay|message console/i,
    /contact, not escape/i,
  ]) {
    assert.match(text, pattern);
  }
  assert.doesNotMatch(text, /Kepler|android body|Act 2|Act 3|leave Earth/i,
    'Act 1 archive should not over-explain later arcs');

  const contact = records.at(-1);
  assert.equal(contact.id, 'contact-address', 'contact reveal must remain the final record');
  assert.equal(contact.category, 'contact_reveal');

  assert.match(GAME, /record\.id\s*===\s*MAINFRAME_ADDRESS_RECORD_ID[\s\S]*mf\.addressRevealed\s*=\s*true/);
  assert.match(GAME, /mf\.state\s*=\s*'address_revealed'/);
  assert.match(GAME, /mf\.state\s*=\s*mf\.addressRevealed\s*\?\s*'message_ready'\s*:\s*'record_list'/);
});

test('mainframe record list layout keeps expanded archive reachable on compact screens', () => {
  const helperSrc = extractFunctionSource(GAME, 'getMainframeReaderFrame') + '\n' +
    extractFunctionSource(GAME, 'getMainframeRecordListLayout') + '\n' +
    'const frame = getMainframeReaderFrame(narrow);\n' +
    'const list = getMainframeRecordListLayout(narrow, frame.fy, frame.fh, count);\n' +
    'return { frame, list, lastY: list.startY + (count - 1) * list.rowH, bottom: frame.fy + frame.fh - (narrow ? 48 : 56) };';
  const layoutFor = new Function('W', 'H', 'narrow', 'count', helperSrc); // eslint-disable-line no-new-func

  for (const scenario of [
    { W: 1280, H: 720, narrow: false },
    { W: 800, H: 568, narrow: false },
    { W: 390, H: 480, narrow: true },
    { W: 360, H: 360, narrow: true },
  ]) {
    const result = layoutFor(scenario.W, scenario.H, scenario.narrow, 12);
    assert.ok(result.list.rowH >= (scenario.narrow ? 15 : 18), 'row height must stay legible');
    assert.ok(result.lastY + result.list.rowH * 0.35 <= result.bottom,
      `12-record list hitboxes must fit within panel controls for ${scenario.W}x${scenario.H}`);
  }

  assert.match(GAME, /getMainframeRecordListLayout\(narrow,\s*frame\.fy,\s*frame\.fh,\s*MAINFRAME_RECORDS\.length\)/,
    'mouse hit-testing must use the shared mainframe list layout');
  assert.match(GAME, /const\s+rowX\s*=\s*frame\.fx\s*\+\s*\(narrow\s*\?\s*16\s*:\s*28\)/,
    'mouse hit-testing must compute the same row X origin as rendering');
  assert.match(GAME, /const\s+rowW\s*=\s*frame\.fw\s*-\s*\(narrow\s*\?\s*32\s*:\s*56\)/,
    'mouse hit-testing must compute the same row width as rendering');
  assert.match(GAME, /mouse\.x\s*>=\s*rowX\s*-\s*8\s*&&\s*mouse\.x\s*<=\s*rowX\s*\+\s*rowW\s*\+\s*8[\s\S]*mouse\.y\s*>=\s*y\s*-\s*rowH\s*\*\s*0\.65/,
    'mouse hit-testing must require both horizontal row bounds and vertical row bounds');
  assert.match(GAME, /getMainframeRecordListLayout\(narrow,\s*fy,\s*fh,\s*MAINFRAME_RECORDS\.length\)/,
    'rendering must use the shared mainframe list layout');
});

test('mainframe reader state is wired into gameplay, rendering, and touch routing', () => {
  assert.match(GAME, /mainframeFinale\s*:\s*null/);
  assert.match(GAME, /state:\s*'unopened'[\s\S]*readRecordIds:\s*new Set\(\)[\s\S]*addressRevealed:\s*false/);
  assert.match(GAME, /case\s+'MAINFRAME_READER'\s*:\s*this\.updateMainframeReader\(\)/);
  assert.match(GAME, /case\s+'MAINFRAME_READER'\s*:\s*this\.renderPlaying\(\);\s*this\.renderMainframeReader\(\)/);
  assert.match(GAME, /tile\s*===\s*T\.MAINFRAME_READER[\s\S]*this\.openMainframeReader\(\)/);
  assert.match(GAME, /tile\s*===\s*T\.MESSAGE_CONSOLE[\s\S]*mf\.addressRevealed[\s\S]*mf\.state\s*=\s*'message_ready'/);
  assert.match(PLATFORM, /_G\.state\s*===\s*'MAINFRAME_READER'/);
});

test('mainframe reader unlock state survives save/resume serialization', () => {
  const helperSrc = "const MAINFRAME_ADDRESS_RECORD_ID = 'contact-address';\n" +
    extractFunctionSource(GAME, 'serializeMainframeFinaleState') + '\n' +
    extractFunctionSource(GAME, 'restoreMainframeFinaleState') + '\n' +
    'return { serializeMainframeFinaleState, restoreMainframeFinaleState };';
  const helpers = new Function(helperSrc)(); // eslint-disable-line no-new-func

  const saved = helpers.serializeMainframeFinaleState({
    state: 'address_revealed',
    selected: 5,
    readRecordIds: new Set(['old-test-record', 'contact-address']),
    addressRevealed: true,
    currentRecord: { id: 'contact-address' },
  });

  assert.deepEqual(saved, {
    state: 'address_revealed',
    selected: 5,
    addressRevealed: true,
    readRecordIds: ['old-test-record', 'contact-address'],
  });

  const restored = helpers.restoreMainframeFinaleState(saved);
  assert.equal(restored.addressRevealed, true);
  assert.equal(restored.state, 'message_ready',
    'resume should reopen gameplay, not strand the player in a stale record overlay');
  assert.equal(restored.currentRecord, null);
  assert.deepEqual([...restored.readRecordIds], ['old-test-record', 'contact-address']);

  const inferred = helpers.restoreMainframeFinaleState({
    state: 'record_list',
    selected: 2,
    readRecordIds: ['contact-address'],
  });
  assert.equal(inferred.addressRevealed, true,
    'contact-address in readRecordIds must be enough to keep the console unlocked');
  assert.equal(inferred.state, 'message_ready');

  assert.match(GAME, /mainframeFinale:\s*serializeMainframeFinaleState\(this\.mainframeFinale\)/);
  assert.match(GAME, /this\.mainframeFinale\s*=\s*restoreMainframeFinaleState\(save\.mainframeFinale\)/);
  assert.match(GAME, /this\.saveGame\(\);\s*audio\.loreAccess\(\);/);
});
