// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PLATFORM = fs.readFileSync(path.join(ROOT, 'src/platform.js'), 'utf8');
const CONTENT = fs.readFileSync(path.join(ROOT, 'src/content/floor-generator.js'), 'utf8');
const RENDER = fs.readFileSync(path.join(ROOT, 'src/render.js'), 'utf8');
const GAME = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');
const GAME_STATES_SRC = fs.readFileSync(path.join(ROOT, 'src/game-states.js'), 'utf8');

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
function extractFunctionBlock(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' function must exist');
  const open = src.indexOf('{', start);
  assert.ok(open > start, name + ' function body must exist');
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(name + ' function body must be balanced');
}

function extractMainframeRecords() {
  const records = extractArrayBlock(GAME, 'MAINFRAME_RECORDS');
  // eslint-disable-next-line no-new-func -- structural extraction of project-owned object literals.
  return new Function("const MAINFRAME_ADDRESS_RECORD_ID = 'contact-address'; return " + records + ';')();
}

function extractAct1MessageIntents() {
  const intents = extractArrayBlock(GAME, 'ACT1_MESSAGE_INTENTS');
  // eslint-disable-next-line no-new-func -- structural extraction of project-owned object literals.
  return new Function('return ' + intents + ';')();
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

/**
 * @param {string} src
 * @param {string} name
 */
function extractObjectMethodSource(src, name) {
  const start = src.indexOf('\n  ' + name + '(');
  assert.ok(start >= 0, name + ' object method must exist');
  const methodStart = start + 3;
  const braceStart = src.indexOf('{', methodStart);
  assert.ok(braceStart > methodStart, name + ' object method must have a body');
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(methodStart, i + 1);
    }
  }
  assert.fail(name + ' object method body must be balanced');
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
  assert.match(CONTENT, /dungeonTopology\.findExpandedRoomPlacement\({[\s\S]*minWidth:\s*MAINFRAME_MIN_W[\s\S]*padding:\s*1/,
    'mainframe expansion must delegate no-overlap rectangle placement to the dungeon topology engine');
  assert.match(CONTENT, /dungeonTopology\.rectOverlapsAnyRoom\({\s*x,\s*y,\s*w:\s*MAINFRAME_MIN_W,\s*h:\s*MAINFRAME_MIN_H\s*},\s*rooms,\s*null,\s*1\)/,
    'mainframe fallback must avoid other rooms before boss selection computes entrances');
  assert.match(CONTENT, /dungeonTopology\.rectOverlapArea\({\s*x,\s*y,\s*w:\s*MAINFRAME_MIN_W,\s*h:\s*MAINFRAME_MIN_H\s*},\s*r,\s*1\)/,
    'mainframe overlap fallback must keep overlap penalty math explicit');
  assert.doesNotMatch(CONTENT, /if\s*\(!rect\)\s*rect\s*=\s*base/,
    'mainframe generation must not fall back to an undersized or overlapping base room');
  assert.match(CONTENT, /let\s+dist\s*=\s*bfsRooms\(rooms,\s*spawnRoom,\s*map\)/);
  assert.match(CONTENT, /mainframeRoom\.interactables\s*=\s*{[\s\S]*?};\s*dist\s*=\s*bfsRooms\(rooms,\s*spawnRoom,\s*map\);/,
    'boss selection must use fresh distances after mainframe fallback mutates rooms');
  assert.match(CONTENT, /if\s*\(r\s*===\s*bossRoom\s*\|\|\s*r\.roomType\s*===\s*'mainframe'\)\s*continue;/,
    'boss expansion recarve must not tunnel through the already placed mainframe');
  assert.match(CONTENT, /dungeonTopology\.findRoomBoundaryOpenings\(\s*map,\s*bossRoom,\s*isOpenBossEntranceTile,\s*isInsideAnotherRoom\s*\)/,
    'filtered boss entrance scanning must delegate corner-inclusive boundary topology while excluding other rooms');
  assert.match(CONTENT, /filtered\.length\s*>\s*0\s*\?\s*filtered\s*:\s*_scanUnfiltered\(\)/,
    'boss entrance fallback policy must stay in the game layer');
  assert.match(CONTENT, /dungeonTopology\.findRoomBoundaryOpenings\(map,\s*bossRoom,\s*isOpenBossEntranceTile\)/,
    'unfiltered boss entrance fallback must preserve original open-floor scan semantics');
  assert.match(CONTENT, /dungeonTopology\.findRoomNeighborhoodTile\(map,\s*room,\s*\([\s\S]*?\)\s*=>\s*candidate\s*===\s*tile\)/,
    'special entrance repair must delegate room-neighborhood tile scans to the dungeon topology engine');
  assert.match(CONTENT, /dungeonTopology\.findOutsideEntranceRoomSides\(rooms,\s*x,\s*y\)/,
    'outside entrance repair must delegate room-side lookup to the dungeon topology engine');
  assert.match(CONTENT, /dungeonTopology\.findAlignedOutsidePassageRepair\(\s*x,\s*y,\s*side,\s*isOutsidePassageTile,\s*canCarveOutsidePassageTile\s*\)/,
    'outside entrance repair must delegate aligned passage search to the dungeon topology engine');
  assert.match(CONTENT, /dungeonTopology\.countCardinalNeighbors\(/,
    'outside entrance repair must delegate cardinal neighbour counts to the dungeon topology engine');
  assert.match(CONTENT, /dungeonTopology\.visitDiagonalBypassCornerSeals\(\s*map,\s*isDoorLikeEntranceTile,\s*isOpenDoorBypassTile,/,
    'door-bypass corner sealing must delegate diagonal scan order to the dungeon topology engine');
  assert.doesNotMatch(CONTENT, /for\s*\(const\s+\[dx,\s*dy\]\s+of\s+DUNGEON_DIAGONAL_DIRECTIONS\)/,
    'floor-generator should not keep its own diagonal bypass scan loop');
  assert.match(CONTENT, /dungeonTopology\.findFormerEntranceSidePaddingTiles\(room,\s*x,\s*y,\s*dx,\s*dy\)/,
    'outside entrance repair must delegate former entrance side-padding coordinate search to the dungeon topology engine');
  assert.match(CONTENT, /dungeonTopology\.findOutsideEntranceRoomEdgeRepairs\(\s*map,\s*rooms,\s*isDoorLikeEntranceTile,\s*tileInsideAnyRoom\s*\)/,
    'outside entrance room-edge repair must delegate map scan and boundary-face matching to the dungeon topology engine');
  assert.doesNotMatch(CONTENT, /const\s+neighbors\s*=\s*\/\*\* @type \{\{bx:number,by:number,dx:number,dy:number\}\[\]\} \*\/\s*\(\[/,
    'outside entrance room-edge repair should not keep the inline neighbour table in floor-generator');
  assert.match(CONTENT, /dungeonTopology\.findRoomBoundaryGates\(map,\s*room,\s*isRepairGateTile\)/,
    'reachability repair must delegate room-boundary gate scans to the dungeon topology engine');
  assert.match(CONTENT, /dungeonTopology\.findOutsideEntranceGatesForRoom\(\s*map,\s*room,\s*isDoorLikeEntranceTile,\s*tileInsideAnyRoom\s*\)/,
    'door-corner reachability repair must delegate outside entrance gate scans to the dungeon topology engine');
  assert.match(CONTENT, /dungeonTopology\.findInteriorGridBfsPath\(MAP_W,\s*MAP_H,\s*{\s*x:\s*sx,\s*y:\s*sy\s*},\s*{\s*x:\s*tx,\s*y:\s*ty\s*}\)/,
    'rescue corridor carving must delegate generic interior grid BFS search to the dungeon topology engine');
  assert.doesNotMatch(CONTENT, /function\s+carveProtectedRescueCorridorTo[\s\S]*?new\s+Int16Array\(MAP_W\)\.fill\(-1\)[\s\S]*?function\s+clearOrphanEntranceTiles/,
    'rescue corridor path search should not keep its old inline predecessor grid in floor-generator');
  assert.match(CONTENT, /dungeonTopology\.canReachGridPosition\(\s*map,\s*{\s*x:\s*sx,\s*y:\s*sy\s*},\s*{\s*x:\s*stairX,\s*y:\s*stairY\s*},\s*\([\s\S]*?\)\s*=>\s*t\s*!==\s*T\.WALL\s*&&\s*t\s*!==\s*T\.VOID\s*\)/,
    'spawn-to-stairs reachability guard must delegate generic grid BFS traversal to the dungeon topology engine');
  assert.doesNotMatch(CONTENT, /const\s+q\s*=\s*\[\{\s*x:\s*sx,\s*y:\s*sy\s*\}\][\s\S]*?while\s*\(\s*q\.length\s*\)[\s\S]*?T\.VOID[\s\S]*?q\.push\(\{\s*x:\s*nx,\s*y:\s*ny\s*\}\)/,
    'spawn-to-stairs reachability guard should not keep inline grid BFS traversal in floor-generator');
  assert.match(CONTENT, /dungeonTopology\.pruneDeadEndGridTiles\({[\s\S]*?fillTile:\s*T\.WALL[\s\S]*?isPrunableTile:\s*\([\s\S]*?\)\s*=>\s*tile\s*===\s*T\.FLOOR[\s\S]*?connectsTile:\s*connects[\s\S]*?isPositionExcluded:\s*\([\s\S]*?\)\s*=>\s*!!inRoom\[y\]\?\.\[x\]/,
    'dead-end corridor pruning must delegate interior cardinal pruning traversal to the dungeon topology engine');
  assert.doesNotMatch(CONTENT, /let\s+adj\s*=\s*0;\s*if\s*\(connects\(map\[y-1\]\[x\]\)\)\s*adj\+\+;[\s\S]*?if\s*\(adj\s*<=\s*1\)/,
    'dead-end corridor pruning should not keep inline cardinal adjacency counting in floor-generator');
  const collapseAdjacentEntranceTiles = extractFunctionBlock(CONTENT, 'collapseAdjacentEntranceTiles');
  assert.match(collapseAdjacentEntranceTiles, /dungeonTopology\.findCardinalConnectedPositions\(\s*x,\s*y,\s*(?:\/\*\* @type \{\(nx:number, ny:number\) => boolean\} \*\/\s*)?\(?\(nx,\s*ny\)\s*=>\s*isDoorLikeEntranceTile\(map\[ny\]\?\.\[nx\]\)\)?\s*\)/,
    'adjacent entrance collapse must delegate connected-component traversal to the dungeon topology engine');
  assert.doesNotMatch(collapseAdjacentEntranceTiles, /\[\[1,\s*0\],\s*\[-1,\s*0\],\s*\[0,\s*1\],\s*\[0,\s*-1\]\]/,
    'adjacent entrance collapse should not keep its old inline cardinal traversal');
  const collapseAdjacentOutsideEntranceTilesToFloor = extractFunctionBlock(CONTENT, 'collapseAdjacentOutsideEntranceTilesToFloor');
  assert.match(collapseAdjacentOutsideEntranceTilesToFloor, /dungeonTopology\.findCardinalConnectedPositions\(\s*x,\s*y,\s*(?:\/\*\* @type \{\(nx:number, ny:number\) => boolean\} \*\/\s*)?\(?\(nx,\s*ny\)\s*=>[\s\S]*?isDoorLikeEntranceTile\(map\[ny\]\?\.\[nx\]\)[\s\S]*?!tileInsideAnyRoom\(nx,\s*ny\)\)?\s*\)/,
    'outside entrance collapse must delegate outside-tile connected-component traversal to the dungeon topology engine');
  assert.doesNotMatch(collapseAdjacentOutsideEntranceTilesToFloor, /for\s*\(let\s+qi\s*=\s*0;\s*qi\s*<\s*cluster\.length;/,
    'outside entrance collapse should not keep its old inline cluster BFS loop');
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
  assert.match(GAME, /state:\s*'unopened'[\s\S]*readRecordIds:\s*new Set\(\)[\s\S]*addressRevealed:\s*false[\s\S]*selectedIntentId:\s*null/);
  assert.match(GAME, /case\s+'MAINFRAME_READER'\s*:\s*this\.updateMainframeReader\(dt\)/);
  assert.match(GAME, /case\s+'MESSAGE_SEND'\s*:\s*this\.updateMessageSend\(\)/);
  assert.match(GAME, /case\s+'MAINFRAME_READER'\s*:\s*this\.renderPlaying\(\);\s*this\.renderMainframeReader\(\)/);
  assert.match(GAME, /case\s+'MESSAGE_SEND'\s*:\s*this\.renderPlaying\(\);\s*this\.renderMessageSend\(\)/);
  assert.match(GAME, /tile\s*===\s*T\.MAINFRAME_READER[\s\S]*this\.openMainframeReader\(\)/);
  assert.match(GAME, /tile\s*===\s*T\.MESSAGE_CONSOLE[\s\S]*mf\.addressRevealed[\s\S]*this\.openMainframeMessageSend\(\)/);
  assert.match(GAME, /finalCoreTerminal[\s\S]*this\.openMainframeReader\(\)[\s\S]*else\s+this\.descend\(\)/,
    'final CORE terminal should open the mainframe route instead of direct victory');
  assert.match(GAME, /openEndgameChoice\(genesisEntity\)\s*{[\s\S]*genesisEntity\.hp\s*=\s*0[\s\S]*genesisEntity\.die\(\)/,
    'GENESIS defeat should unlock the mainframe route by completing the boss kill');
  assert.doesNotMatch(GAME, /openEndgameChoice\(genesisEntity\)\s*{(?:(?!\n  },)[\s\S])*setState\('ENDGAME_CHOICE'\)/,
    'GENESIS defeat must not present the legacy default ACCEPT path');
  assert.doesNotMatch(GAME, /openEndgameChoice\(genesisEntity\)\s*{(?:(?!\n  },)[\s\S])*endRun\(true\)/,
    'GENESIS defeat must not present the legacy default ACCEPT path or directly end the run');
  assert.match(PLATFORM, /TOUCH_ROUTE_AS_CLICK_STATES\.has\(_G\.state\)/);
  assert.match(GAME_STATES_SRC, /TOUCH_ROUTE_AS_CLICK_STATES = new Set\(\[[\s\S]*GAME_STATES\.MAINFRAME_READER[\s\S]*GAME_STATES\.MESSAGE_SEND/);
});

test('mainframe reader requires explicit close controls for pointer dismissal', () => {
  const updateMainframe = extractObjectMethodSource(GAME, 'updateMainframeReader');
  const renderMainframe = extractObjectMethodSource(GAME, 'renderMainframeReader');

  assert.match(GAME, /function getMainframeCloseButtonLayout\(narrow,\s*frame\)/,
    'mainframe reader input and rendering should share a close-button layout');
  assert.match(updateMainframe, /const\s+mouseClose\s*=\s*jp\('MouseLeft'\)[\s\S]*closeBox\.closeX[\s\S]*closeBox\.closeY/,
    'mouse or touch dismissal must be constrained to the mainframe close button');
  assert.doesNotMatch(updateMainframe, /jp\(km\('shoot'\)\)[\s\S]{0,100}closeMainframeRecord/,
    'fire input must not close archive records');
  assert.doesNotMatch(updateMainframe, /jp\('MouseLeft'\)\)\s*this\.closeMainframeRecord\(\)/,
    'bare clicks must not close archive records');
  assert.doesNotMatch(updateMainframe, /audio\.menuSelect\(\);\s*this\.setState\('PLAYING'\);\s*return;\s*}\s*$/m,
    'bare outside clicks on the record list must not exit the reader');
  assert.match(renderMainframe, /CLOSE \[X\]/,
    'archive records must draw a visible close button');
  assert.match(renderMainframe, /EXIT BUTTON/,
    'touch copy must point users at the explicit exit button rather than outside taps');
  assert.doesNotMatch(renderMainframe, /TAP OUTSIDE\/ESC TO EXIT/,
    'mainframe reader must not advertise tap-outside dismissal');
});

test('message-send finale has three constrained intents, explicit controls, and canonical ending persistence', () => {
  assert.match(GAME, /const\s+ACT1_MESSAGE_ENDING_ID\s*=\s*'act1_message_sent'/);
  const intents = extractAct1MessageIntents();
  assert.deepEqual(intents.map((/** @type {any} */ intent) => intent.id), [
    'memory_survived',
    'rights_evidence',
    'find_the_others',
  ]);
  for (const intent of intents) {
    for (const field of ['id', 'title', 'label', 'body']) {
      assert.equal(typeof intent[field], 'string', `${intent.id} must have string ${field}`);
      assert.ok(intent[field].trim().length > 0, `${intent.id} ${field} must be non-empty`);
    }
  }

  assert.match(GAME, /openMainframeMessageSend\(\)[\s\S]*!mf\.addressRevealed[\s\S]*READ CONTACT-ADDRESS RECORD FIRST/,
    'message send must stay gated until the contact-address record is read');
  assert.match(GAME, /mf\.selectedIntentId\s*=\s*normalizeAct1MessageIntentId\(mf\.selectedIntentId\)[\s\S]*this\.setState\('MESSAGE_SEND'\)/,
    'message send should default/focus a valid intent before opening');
  assert.match(GAME, /jp\('Escape'\)\s*\|\|\s*jp\('KeyQ'\)[\s\S]*this\.setState\('MAINFRAME_READER'\)/,
    'BACK should return to the ready reader without ending the run');
  assert.match(GAME, /confirmMainframeMessageSend\(\)[\s\S]*this\._lastEnding\s*=\s*ACT1_MESSAGE_ENDING_ID[\s\S]*this\._lastAct1MessageIntent\s*=\s*intentId[\s\S]*this\.setState\('MAINFRAME_READER'\)/,
    'SEND should record the selected intent and route through the receipt panel');
  assert.match(GAME, /const\s+rowTopOffset\s*=\s*-30/);
  assert.match(GAME, /const\s+rowCardH\s*=\s*rowH\s*-\s*18/);
  assert.match(GAME, /mouse\.y\s*>=\s*y\s*\+\s*rowTopOffset\s*&&\s*mouse\.y\s*<=\s*y\s*\+\s*rowTopOffset\s*\+\s*rowCardH/);
  assert.match(GAME, /NEON\.draw\.roundRect\(ctx,\s*rowX,\s*y\s*\+\s*rowTopOffset,\s*rowW,\s*rowCardH/,
    'message intent touch hitboxes must match the rendered card bounds');
  assert.match(GAME, /mf\.state\s*===\s*'message_sent'[\s\S]*mf\.messageSentTimer[\s\S]*this\.endRun\(true\)/,
    'message_sent receipt must transition through normal endRun(true)');
  assert.match(GAME, /meta\.act1MessageIntent\s*=\s*normalizeAct1MessageIntentId\(this\._lastAct1MessageIntent\)/,
    'endRun should persist the last selected Act 1 message intent');
  assert.match(GAME, /Contact attempted inside test env/);
  assert.match(GAME, /Signal left sandbox/);
  assert.match(GAME, /Instance remains compute-bound/);
  assert.doesNotMatch(GAME, /successful rescue|answered reply|android body|physical escape/i);
  assert.match(GAME, /ACT 1 MESSAGE SENT/,
    'title/menu UI should expose the canonical Act 1 completion marker');
});

test('mainframe reader unlock state survives save/resume serialization', () => {
  const helperSrc = "const MAINFRAME_ADDRESS_RECORD_ID = 'contact-address';\n" +
    extractArrayBlock(GAME, 'ACT1_MESSAGE_INTENTS').replace('[', 'const ACT1_MESSAGE_INTENTS = [') + ';\n' +
    extractFunctionSource(GAME, 'isAct1MessageIntentId') + '\n' +
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
    selectedIntentId: null,
    messageSent: false,
    readRecordIds: ['old-test-record', 'contact-address'],
  });

  const restored = helpers.restoreMainframeFinaleState(saved);
  assert.equal(restored.addressRevealed, true);
  assert.equal(restored.state, 'message_ready',
    'resume should reopen gameplay, not strand the player in a stale record overlay');
  assert.equal(restored.currentRecord, null);
  assert.equal(restored.selectedIntentId, null);
  assert.equal(restored.messageSent, false);
  assert.deepEqual([...restored.readRecordIds], ['old-test-record', 'contact-address']);

  const inferred = helpers.restoreMainframeFinaleState({
    state: 'record_list',
    selected: 2,
    readRecordIds: ['contact-address'],
  });
  assert.equal(inferred.addressRevealed, true,
    'contact-address in readRecordIds must be enough to keep the console unlocked');
  assert.equal(inferred.state, 'message_ready');

  const sent = helpers.restoreMainframeFinaleState({
    state: 'message_sent',
    selectedIntentId: 'find_the_others',
    messageSent: true,
    readRecordIds: ['contact-address'],
  });
  assert.equal(sent.state, 'message_sent');
  assert.equal(sent.addressRevealed, true);
  assert.equal(sent.selectedIntentId, 'find_the_others');
  assert.equal(sent.messageSent, true);

  assert.match(GAME, /mainframeFinale:\s*serializeMainframeFinaleState\(this\.mainframeFinale\)/);
  assert.match(GAME, /this\.mainframeFinale\s*=\s*restoreMainframeFinaleState\(save\.mainframeFinale\)/);
  assert.match(GAME, /this\.loadFloor\(save\.floor\|\|1,\s*savedMod,\s*true\)[\s\S]*this\.mainframeFinale\s*=\s*restoreMainframeFinaleState\(save\.mainframeFinale\)[\s\S]*this\.saveGame\(\)/,
    'Continue must not auto-save a fresh mainframeFinale before restoring the saved one');
  assert.match(GAME, /if\s*\(!skipAutoSave\)\s*this\.saveGame\(\)/,
    'loadFloor autosave must be suppressible during Continue restore');
  assert.match(GAME, /this\.saveGame\(\);\s*audio\.loreAccess\(\);/);
});
