'use strict';
// @ts-check

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CORE_RUNTIME_SOURCE_KEYS,
  SOURCE_FILE_PATHS,
  blankStringContents,
  readSourceFile,
  readSourceFiles,
  resolveSourceFile,
  stripJsComments,
} = require('./_source-files.js');

test('source file facade records the script-tag runtime source tail', () => {
  assert.deepEqual(CORE_RUNTIME_SOURCE_KEYS, ['content', 'entities', 'render', 'game']);
  assert.equal(SOURCE_FILE_PATHS.contentTerminals.replaceAll('\\', '/'), 'src/content/terminals.js');
  assert.equal(SOURCE_FILE_PATHS.contentWeapons.replaceAll('\\', '/'), 'src/content/weapons.js');
  assert.equal(SOURCE_FILE_PATHS.contentUpgrades.replaceAll('\\', '/'), 'src/content/upgrades.js');
  assert.equal(SOURCE_FILE_PATHS.contentPickups.replaceAll('\\', '/'), 'src/content/pickups.js');
  assert.equal(SOURCE_FILE_PATHS.contentProjectiles.replaceAll('\\', '/'), 'src/content/projectiles.js');
  assert.equal(SOURCE_FILE_PATHS.contentMusic.replaceAll('\\', '/'), 'src/content/music.js');
  assert.equal(SOURCE_FILE_PATHS.contentModifiers.replaceAll('\\', '/'), 'src/content/modifiers.js');
  assert.equal(SOURCE_FILE_PATHS.contentMetaSave.replaceAll('\\', '/'), 'src/content/meta-save.js');
  assert.equal(SOURCE_FILE_PATHS.contentCombo.replaceAll('\\', '/'), 'src/content/combo.js');
  assert.equal(SOURCE_FILE_PATHS.contentEvents.replaceAll('\\', '/'), 'src/content/events.js');
  assert.equal(SOURCE_FILE_PATHS.contentShop.replaceAll('\\', '/'), 'src/content/shop.js');
  assert.equal(SOURCE_FILE_PATHS.contentPerks.replaceAll('\\', '/'), 'src/content/perks.js');
  assert.equal(SOURCE_FILE_PATHS.contentEffects.replaceAll('\\', '/'), 'src/content/effects.js');
  assert.equal(SOURCE_FILE_PATHS.contentHackware.replaceAll('\\', '/'), 'src/content/hackware.js');
  assert.equal(SOURCE_FILE_PATHS.contentStatus.replaceAll('\\', '/'), 'src/content/status.js');
  assert.equal(SOURCE_FILE_PATHS.content.replaceAll('\\', '/'), 'src/content.js');
  assert.equal(SOURCE_FILE_PATHS.entities.replaceAll('\\', '/'), 'src/entities.js');
  assert.equal(SOURCE_FILE_PATHS.render.replaceAll('\\', '/'), 'src/render.js');
  assert.equal(SOURCE_FILE_PATHS.game.replaceAll('\\', '/'), 'src/game.js');
});

test('source file facade resolves and loads core runtime sources', () => {
  assert.equal(resolveSourceFile(__dirname, 'content').endsWith('src/content.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentTerminals').endsWith('src/content/terminals.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentWeapons').endsWith('src/content/weapons.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentUpgrades').endsWith('src/content/upgrades.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentPickups').endsWith('src/content/pickups.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentProjectiles').endsWith('src/content/projectiles.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentMusic').endsWith('src/content/music.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentModifiers').endsWith('src/content/modifiers.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentMetaSave').endsWith('src/content/meta-save.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentCombo').endsWith('src/content/combo.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentEvents').endsWith('src/content/events.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentShop').endsWith('src/content/shop.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentPerks').endsWith('src/content/perks.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentEffects').endsWith('src/content/effects.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentHackware').endsWith('src/content/hackware.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentStatus').endsWith('src/content/status.js'), true);
  const sources = readSourceFiles(__dirname);
  const terminalSource = readSourceFile(__dirname, 'contentTerminals');
  const weaponSource = readSourceFile(__dirname, 'contentWeapons');
  const upgradeSource = readSourceFile(__dirname, 'contentUpgrades');
  const pickupSource = readSourceFile(__dirname, 'contentPickups');
  const projectileSource = readSourceFile(__dirname, 'contentProjectiles');
  const musicSource = readSourceFile(__dirname, 'contentMusic');
  const modifierSource = readSourceFile(__dirname, 'contentModifiers');
  const metaSaveSource = readSourceFile(__dirname, 'contentMetaSave');
  const comboSource = readSourceFile(__dirname, 'contentCombo');
  const eventSource = readSourceFile(__dirname, 'contentEvents');
  const shopSource = readSourceFile(__dirname, 'contentShop');
  const perkSource = readSourceFile(__dirname, 'contentPerks');
  const effectsSource = readSourceFile(__dirname, 'contentEffects');
  const hackwareSource = readSourceFile(__dirname, 'contentHackware');
  const statusSource = readSourceFile(__dirname, 'contentStatus');
  assert.match(terminalSource, /const\s+LORE_ENTRIES\s*=\s*\[/);
  assert.match(weaponSource, /const\s+WEAPON_AFFIXES\s*=\s*\{/);
  assert.match(upgradeSource, /const\s+UPGRADES\s*=\s*\[/);
  assert.match(upgradeSource, /const\s+AUGMENTS\s*=\s*\{/);
  assert.match(pickupSource, /class\s+Item\b/);
  assert.match(pickupSource, /class\s+WeaponCacheItem\b/);
  assert.match(projectileSource, /class\s+Projectile\b/);
  assert.match(projectileSource, /function\s+detonateGrenade\s*\(/);
  assert.match(musicSource, /const\s+music\s*=\s*\(\(\)\s*=>\s*\{/);
  assert.match(musicSource, /function\s+tryPlayTitle\s*\(/);
  assert.match(modifierSource, /const\s+DIFFICULTIES\s*=\s*\{/);
  assert.match(modifierSource, /const\s+FLOOR_MODIFIERS\s*=\s*\{/);
  assert.match(metaSaveSource, /const\s+META_UPGRADES\s*=/);
  assert.match(metaSaveSource, /function\s+loadMeta\s*\(/);
  assert.match(comboSource, /const\s+combo\s*=\s*\{/);
  assert.match(comboSource, /function\s+registerKill\s*\(/);
  assert.match(eventSource, /const\s+EVENTS\s*=\s*\[/);
  assert.match(eventSource, /function\s+applyEventEffect\s*\(/);
  assert.match(shopSource, /const\s+SHOP_PRICES\s*=\s*\{/);
  assert.match(shopSource, /function\s+generateShopItems\s*\(/);
  assert.match(perkSource, /const\s+PERK_POOL\s*=\s*\{/);
  assert.match(perkSource, /function\s+rollPerkChoices\s*\(/);
  assert.match(effectsSource, /function\s+spawnParticles\s*\(/);
  assert.match(effectsSource, /function\s+spawnDmgText\s*\(/);
  assert.match(hackwareSource, /const\s+HACKWARE\s*=\s*\{/);
  assert.match(hackwareSource, /function\s+activateHackware\s*\(/);
  assert.match(statusSource, /function\s+getStatusEffects\s*\(/);
  assert.match(statusSource, /function\s+drawStatusBar\s*\(/);
  assert.doesNotMatch(sources.content, /function\s+spawnParticles\s*\(/);
  assert.doesNotMatch(sources.content, /const\s+ambientParticles\s*=/);
  assert.doesNotMatch(sources.content, /function\s+activateHackware\s*\(/);
  assert.doesNotMatch(sources.content, /function\s+registerKill\s*\(/);
  assert.doesNotMatch(sources.content, /function\s+getStatusEffects\s*\(/);
  assert.doesNotMatch(sources.content, /function\s+loadMeta\s*\(/);
  assert.match(sources.content, /function\s+generateFloor\s*\(/);
  assert.match(sources.entities, /class\s+Player\b/);
  assert.match(sources.render, /function\s+drawWorld\s*\(/);
  assert.match(sources.game, /const\s+game\s*=/);
});

test('source file facade rejects unknown keys loudly', () => {
  assert.throws(
    // @ts-expect-error exercising runtime validation.
    () => readSourceFile(__dirname, 'contents'),
    /Unknown source file key: contents/
  );
});

test('stripJsComments preserves comment-like text in strings and regex literals', () => {
  const source = [
    "const url = 'https://example.test/path'; // remove line comment",
    'const re = /\\/\\/ not a comment/;',
    'function f(x) { return /[/*]/.test(x); }',
    'function g(ok, x) { if (ok) /[/*]/.test(x); return 1; }',
    '/* remove block comment',
    '   but preserve its newline */',
    'const done = true;',
  ].join('\n');

  const stripped = stripJsComments(source);
  assert.match(stripped, /https:\/\/example\.test\/path/);
  assert.match(stripped, /\/\\\/\\\/ not a comment\//);
  assert.match(stripped, /return \/\[\/\*\]\/\.test\(x\);/);
  assert.match(stripped, /if \(ok\) \/\[\/\*\]\/\.test\(x\);/);
  assert.doesNotMatch(stripped, /remove line comment/);
  assert.doesNotMatch(stripped, /remove block comment/);
  assert.match(stripped, /const done = true;/);
});

test('blankStringContents preserves string length and quote delimiters', () => {
  const src = "const value = 'a { tricky } string';";
  const blanked = blankStringContents(src);
  assert.equal(blanked.length, src.length);
  assert.match(blanked, /'                   '/);
  assert.doesNotMatch(blanked, /tricky/);
});
