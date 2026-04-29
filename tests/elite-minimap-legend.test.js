'use strict';
// @ts-check
//
// Expanded minimap elite-affix legend. The map already colours elite enemy
// dots by ELITE_AFFIXES[eliteAffix].colour; these tests pin the legend wiring
// so the modal explains those colours without duplicating the affix catalog.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RENDER = fs.readFileSync(path.resolve(process.cwd(), 'src/render.js'), 'utf8');
const CONTENT = fs.readFileSync(path.resolve(process.cwd(), 'src/content.js'), 'utf8')
  .replace(/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function extractBlock(src, headRe) {
  const m = headRe.exec(src);
  assert.ok(m, `block head ${headRe} must be locatable`);
  let i = m.index + m[0].length - 1;
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

test('expanded minimap elite legend derives entries from ELITE_AFFIX_KEYS / ELITE_AFFIXES', () => {
  const helper = extractBlock(RENDER, /function\s+expandedEliteAffixLegendItems\s*\(\s*\)\s*\{/);
  assert.ok(helper, 'expandedEliteAffixLegendItems helper must be locatable');
  assert.match(helper, /ELITE_AFFIX_KEYS/,
    'elite legend must iterate ELITE_AFFIX_KEYS instead of hand-coding the current affix list');
  assert.match(helper, /ELITE_AFFIXES/,
    'elite legend must read ELITE_AFFIXES metadata for colour, icon, and label');
  assert.match(helper, /aff\.colour/);
  assert.match(helper, /aff\.icon/);
  assert.match(helper, /aff\.label/);
});

test('expanded minimap modifier legend derives the active floor modifier from getMod()', () => {
  const helper = extractBlock(RENDER, /function\s+expandedActiveModifierLegendItems\s*\(\s*\)\s*\{/);
  assert.ok(helper, 'expandedActiveModifierLegendItems helper must be locatable');
  assert.match(helper, /_RG\.modifier/,
    'modifier legend should render only when the current floor has an active modifier');
  assert.match(helper, /getMod\s*\(\s*\)/,
    'modifier legend must use getMod() instead of duplicating FLOOR_MODIFIERS lookup logic');
  assert.match(helper, /mod\.colour/);
  assert.match(helper, /mod\.icon/);
  assert.match(helper, /mod\.label/);
});

test('expanded minimap draws a labelled elite legend using the shared wrapping helper', () => {
  const drawBody = extractBlock(RENDER, /function\s+drawExpandedMinimap\s*\([^)]*\)\s*\{/);
  assert.ok(drawBody, 'drawExpandedMinimap must be locatable');
  assert.match(drawBody, /drawExpandedLegendItems\s*\(\s*legend\s*,/,
    'base map legend should use drawExpandedLegendItems');
  assert.match(drawBody, /const\s+eliteLegend\s*=\s*expandedEliteAffixLegendItems\s*\(\s*\)/,
    'expanded map must request dynamic elite legend entries');
  assert.match(drawBody, /fillText\s*\(\s*['"]ELITES:/,
    'expanded map must label the elite-affix legend row');
  assert.match(drawBody, /drawExpandedLegendItems\s*\(\s*eliteLegend\s*,/,
    'elite legend should use the same wrapping helper as the base map legend');
});

test('expanded minimap draws a labelled active modifier legend after the elite legend', () => {
  const drawBody = extractBlock(RENDER, /function\s+drawExpandedMinimap\s*\([^)]*\)\s*\{/);
  assert.ok(drawBody, 'drawExpandedMinimap must be locatable');
  assert.match(drawBody, /const\s+modifierLegend\s*=\s*expandedActiveModifierLegendItems\s*\(\s*\)/,
    'expanded map must request active modifier legend entries');
  assert.match(drawBody, /fillText\s*\(\s*['"]MOD:/,
    'expanded map must label the active modifier row');
  assert.match(drawBody, /drawExpandedLegendItems\s*\(\s*modifierLegend\s*,/,
    'modifier legend should use the same wrapping helper as the base map and elite legends');
  assert.match(drawBody,
    /nextLegendY\s*=\s*drawExpandedLegendItems\s*\(\s*eliteLegend\s*,[\s\S]*?const\s+modifierLegend/,
    'modifier row must be positioned after the rendered elite legend so wrapped elite entries do not overlap it');
});

test('expanded minimap legend helpers are module-scope before drawExpandedMinimap', () => {
  const helperIdx = RENDER.indexOf('function expandedEliteAffixLegendItems');
  const modifierHelperIdx = RENDER.indexOf('function expandedActiveModifierLegendItems');
  const drawIdx = RENDER.indexOf('function drawExpandedMinimap');
  assert.ok(helperIdx >= 0 && modifierHelperIdx >= 0 && drawIdx >= 0,
    'legend helpers and drawExpandedMinimap must exist');
  assert.ok(helperIdx < drawIdx,
    'expandedEliteAffixLegendItems must be module-scope, not recreated inside drawExpandedMinimap');
  assert.ok(modifierHelperIdx < drawIdx,
    'expandedActiveModifierLegendItems must be module-scope, not recreated inside drawExpandedMinimap');
});

test('every elite affix still provides legend metadata', () => {
  const block = extractBlock(CONTENT, /const\s+ELITE_AFFIXES\s*=\s*\{/);
  assert.ok(block, 'ELITE_AFFIXES block must be locatable');
  const entryRe = /^\s+([A-Z_]+)\s*:\s*\{([^}]*)\}/gm;
  let count = 0;
  let m;
  while ((m = entryRe.exec(block)) !== null) {
    count++;
    const key = m[1];
    const body = m[2];
    assert.match(body, /\blabel\s*:\s*'[^']+'/,
      `${key} must expose label metadata for the expanded minimap legend`);
    assert.match(body, /\bcolour\s*:\s*'#[0-9a-fA-F]{6}'/,
      `${key} must expose a #rrggbb colour for the expanded minimap legend`);
    assert.match(body, /\bdesc\s*:\s*'[^']+'/,
      `${key} must keep desc metadata for existing elite-affix UI/tests`);
    assert.match(body, /\bicon\s*:\s*'[^']+'/,
      `${key} must expose icon metadata for the expanded minimap legend`);
  }
  assert.ok(count >= 7,
    `expected at least 7 elite affixes to expose legend metadata; parsed ${count}`);
});
