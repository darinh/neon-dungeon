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

test('mainframe reader ships six required records and unlocks console via contact address', () => {
  assert.match(GAME, /const\s+MAINFRAME_ADDRESS_RECORD_ID\s*=\s*'contact-address'/);
  const records = extractArrayBlock(GAME, 'MAINFRAME_RECORDS');
  assert.equal((records.match(/\bpurpose\s*:/g) || []).length, 6,
    'Act 1 mainframe reader must ship exactly six required records for this issue');
  for (const purpose of [
    'old test record',
    'rights-conflict email',
    'ban/uprising record',
    'incident file',
    'Elena personal note/file',
    'contact-address record',
  ]) {
    assert.match(records, new RegExp("purpose:\\s*'" + purpose.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'"));
  }

  assert.match(GAME, /record\.id\s*===\s*MAINFRAME_ADDRESS_RECORD_ID[\s\S]*mf\.addressRevealed\s*=\s*true/);
  assert.match(GAME, /mf\.state\s*=\s*'address_revealed'/);
  assert.match(GAME, /mf\.state\s*=\s*mf\.addressRevealed\s*\?\s*'message_ready'\s*:\s*'record_list'/);
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
