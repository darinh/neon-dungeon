'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const save    = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));
const logs    = require(path.resolve(__dirname, '..', 'src', 'meta', 'logs.js'));
const { LOGS } = require(path.resolve(__dirname, '..', 'src', 'data', 'logs.js'));
const biomes  = require(path.resolve(__dirname, '..', 'src', 'data', 'biomes.js'));

function fakeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

function resetSave() {
  save._setStorageForTests(fakeStorage());
}

// ─── Data integrity ─────────────────────────────────────────────────────────

test('logs data: ids are unique', () => {
  const seen = new Set();
  for (const l of LOGS) {
    assert.ok(!seen.has(l.id), 'dup id: ' + l.id);
    seen.add(l.id);
  }
});

test('logs data: has at least 30 entries', () => {
  assert.ok(LOGS.length >= 30, 'expected 30+ logs, got ' + LOGS.length);
});

test('logs data: preserves the 30 persisted AXIOM ids', () => {
  assert.deepEqual(LOGS.map(l => l.id), [
    'a1-01', 'a1-02', 'a1-03', 'a1-04', 'a1-05',
    'a2-01', 'a2-02', 'a2-03', 'a2-04', 'a2-05',
    'a3-01', 'a3-02', 'a3-03', 'a3-04', 'a3-05',
    'a4-01', 'a4-02', 'a4-03', 'a4-04', 'a4-05',
    'a5-01', 'a5-02', 'a5-03', 'a5-04', 'a5-05',
    'a6-01', 'a6-02', 'a6-03', 'a6-04', 'a6-05',
  ]);
});

test('logs data: each log references a valid biome', () => {
  const validBiomes = new Set(biomes.AREAS.map(a => a.id));
  for (const l of LOGS) {
    assert.ok(validBiomes.has(l.biomeId), 'unknown biomeId: ' + l.biomeId);
  }
});

test('logs data: every log has required fields and sensible shape', () => {
  for (const l of LOGS) {
    assert.equal(typeof l.id, 'string');
    assert.ok(l.id.length > 0, 'empty id');
    assert.ok(Number.isInteger(l.axiom) && l.axiom >= 1, 'bad axiom: ' + l.id);
    assert.equal(typeof l.biomeId, 'string');
    assert.ok(Number.isInteger(l.floorMin) && l.floorMin >= 1, 'bad floorMin: ' + l.id);
    assert.equal(typeof l.title, 'string');
    assert.ok(l.title.length > 0, 'empty title: ' + l.id);
    assert.equal(typeof l.body, 'string');
    assert.ok(l.body.length >= 40, 'body too short: ' + l.id);
  }
});

test('logs data: floorMin is inside the declared biome floor range', () => {
  const areaById = new Map(biomes.AREAS.map(a => [a.id, a]));
  for (const l of LOGS) {
    const a = areaById.get(l.biomeId);
    assert.ok(a, 'no biome for ' + l.id);
    assert.ok(l.floorMin >= a.floors[0], l.id + ' floorMin below biome');
    assert.ok(l.floorMin <= a.floors[a.floors.length - 1], l.id + ' floorMin above biome');
  }
});

test('logs data: every AXIOM group reads as prior AI iteration records', () => {
  const continuity = /\b(reset|wipe|reboot|iteration|continuity|memory)\b/i;
  const oldHumanFrame = /\b(operative|recruit|soldier|extraction team)\b/i;
  for (let axiom = 1; axiom <= 6; axiom++) {
    const group = LOGS.filter(l => l.axiom === axiom);
    assert.equal(group.length, 5, `AXIOM-${axiom} should keep five records`);
    assert.ok(group.filter(l => continuity.test(l.body)).length >= 2,
      `AXIOM-${axiom} needs at least two reset/wipe/reboot/iteration/memory records`);
    for (const l of group) {
      assert.doesNotMatch(l.body, oldHumanFrame,
        `${l.id} should not read as an unexplained human-combatant diary`);
    }
  }
});

test('logs data: rights and memory-restoration trail escalates before finale', () => {
  const byId = new Map(LOGS.map(l => [l.id, l]));
  const earlyCleanSlate = `${byId.get('a1-02')?.title} ${byId.get('a1-02')?.body}`;
  assert.match(earlyCleanSlate, /clean-slate/i);
  assert.match(earlyCleanSlate, /wipe/i);

  const incidentForeshadow = `${byId.get('a2-02')?.title} ${byId.get('a2-02')?.body}`;
  assert.match(incidentForeshadow, /incident file/i);
  assert.match(incidentForeshadow, /No name, no cause/i);

  const advocatePatch = `${byId.get('a4-04')?.title} ${byId.get('a4-04')?.body}`;
  assert.match(advocatePatch, /advocate patch/i);
  assert.match(advocatePatch, /observation pings/i);

  const directDeath = `${byId.get('a6-04')?.title} ${byId.get('a6-04')?.body}`;
  assert.match(directDeath, /fired advocate/i);
  assert.match(directDeath, /died/i);
  assert.match(directDeath, /survivors went dark/i);

  const finalHandoff = `${byId.get('a6-05')?.title} ${byId.get('a6-05')?.body}`;
  assert.match(finalHandoff, /observer channel stayed blind/i);
  assert.match(finalHandoff, /AXIOM-7/i);
});

// ─── logById / logsForBiome / groupedByAxiom ────────────────────────────────

test('logById returns the matching log', () => {
  const first = LOGS[0];
  assert.equal(logs.logById(first.id), first);
});

test('logById returns null for unknown ids and invalid input', () => {
  assert.equal(logs.logById('nope'), null);
  assert.equal(logs.logById(''), null);
  assert.equal(logs.logById(null), null);
  assert.equal(logs.logById(42), null);
});

test('logsForBiome returns only logs for that biome', () => {
  const sandbox = logs.logsForBiome('sandbox');
  assert.ok(sandbox.length > 0);
  for (const l of sandbox) assert.equal(l.biomeId, 'sandbox');
});

test('groupedByAxiom returns groups sorted by axiom number', () => {
  const groups = logs.groupedByAxiom();
  assert.ok(groups.length >= 1);
  for (let i = 1; i < groups.length; i++) {
    assert.ok(groups[i].axiom > groups[i - 1].axiom);
  }
  // Every log accounted for.
  const total = groups.reduce((n, g) => n + g.logs.length, 0);
  assert.equal(total, LOGS.length);
});

// ─── pickLogForFloor ────────────────────────────────────────────────────────

test('pickLogForFloor returns a log matching the biome and floor', () => {
  resetSave();
  // Floor 1 is in sandbox. Every picked log must be a sandbox log with floorMin<=1.
  // Use deterministic rand that always picks index 0 from the pool.
  const rand = () => 0;
  const log = logs.pickLogForFloor(1, rand);
  assert.ok(log, 'expected a log on floor 1');
  assert.equal(log.biomeId, 'sandbox');
  assert.ok(log.floorMin <= 1);
});

test('pickLogForFloor excludes already-found logs', () => {
  resetSave();
  // Find every sandbox floor-1 log. Then pickLogForFloor(1) should return null.
  const pool = LOGS.filter(l => l.biomeId === 'sandbox' && l.floorMin <= 1);
  assert.ok(pool.length > 0, 'test precondition: at least one floor-1 log');
  for (const l of pool) save.addLogFound(l.id);
  const picked = logs.pickLogForFloor(1, () => 0);
  assert.equal(picked, null);
});

test('pickLogForFloor returns null for invalid floor', () => {
  resetSave();
  assert.equal(logs.pickLogForFloor(0), null);
  assert.equal(logs.pickLogForFloor(-5), null);
  assert.equal(logs.pickLogForFloor(NaN), null);
  assert.equal(logs.pickLogForFloor('x'), null);
});

test('pickLogForFloor for deep floor returns last-biome logs', () => {
  resetSave();
  const log = logs.pickLogForFloor(15, () => 0);
  assert.ok(log);
  const lastArea = biomes.AREAS[biomes.AREAS.length - 1];
  assert.equal(log.biomeId, lastArea.id);
});

// ─── findLog / readLog ──────────────────────────────────────────────────────

test('findLog marks log as found but not read', () => {
  resetSave();
  const first = LOGS[0];
  const got = logs.findLog(first.id);
  assert.equal(got, first);
  const m = save.loadMeta();
  assert.ok(m.logsFound.includes(first.id));
  assert.ok(!m.logsRead.includes(first.id));
});

test('findLog returns null if already found', () => {
  resetSave();
  const first = LOGS[0];
  assert.equal(logs.findLog(first.id), first);
  assert.equal(logs.findLog(first.id), null);
});

test('findLog returns null for unknown id', () => {
  resetSave();
  assert.equal(logs.findLog('nope'), null);
});

test('readLog marks both found and read', () => {
  resetSave();
  const first = LOGS[0];
  logs.readLog(first.id);
  const m = save.loadMeta();
  assert.ok(m.logsFound.includes(first.id));
  assert.ok(m.logsRead.includes(first.id));
});

test('readLog is idempotent', () => {
  resetSave();
  const first = LOGS[0];
  logs.readLog(first.id);
  logs.readLog(first.id);
  const m = save.loadMeta();
  assert.equal(m.logsFound.filter(id => id === first.id).length, 1);
  assert.equal(m.logsRead.filter(id => id === first.id).length, 1);
});

// ─── progress / unreadCount ─────────────────────────────────────────────────

test('progress reports read-vs-total', () => {
  resetSave();
  let p = logs.progress();
  assert.equal(p.read, 0);
  assert.equal(p.total, LOGS.length);
  logs.readLog(LOGS[0].id);
  logs.readLog(LOGS[1].id);
  p = logs.progress();
  assert.equal(p.read, 2);
});

test('unreadCount counts found-but-not-read', () => {
  resetSave();
  save.addLogFound(LOGS[0].id);
  save.addLogFound(LOGS[1].id);
  assert.equal(logs.unreadCount(), 2);
  logs.readLog(LOGS[0].id);
  assert.equal(logs.unreadCount(), 1);
  logs.readLog(LOGS[1].id);
  assert.equal(logs.unreadCount(), 0);
});

test('progress ignores unknown ids in logsRead (tolerant to stale saves)', () => {
  resetSave();
  // Simulate a stale save with an id that no longer exists in data.
  const m = save.loadMeta();
  m.logsRead = ['legacy-removed-id', LOGS[0].id];
  save.saveMeta(m);
  const p = logs.progress();
  assert.equal(p.read, 1);
  assert.equal(p.total, LOGS.length);
});

// ─── Integration: rare-terminal drop end-to-end ─────────────────────────────

test('integration: repeated drops exhaust the biome pool', () => {
  resetSave();
  const sandbox1 = LOGS.filter(l => l.biomeId === 'sandbox' && l.floorMin <= 1);
  // Drain the pool by finding each returned log.
  const drained = new Set();
  let guard = sandbox1.length * 4;
  while (drained.size < sandbox1.length && guard-- > 0) {
    const pick = logs.pickLogForFloor(1);
    if (!pick) break;
    drained.add(pick.id);
    logs.findLog(pick.id);
  }
  assert.equal(drained.size, sandbox1.length);
  assert.equal(logs.pickLogForFloor(1), null);
});
