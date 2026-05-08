'use strict';

// Browser script order is producer-before-consumer and must match index.html.
// Keep engine primitives first, followed by game data/meta modules, dungeon
// helpers, then the large runtime coordinators that consume those globals.
const requiredInIndex = [
  './src/neon.js',
  './src/game-states.js',
  './engine/math.js',
  './engine/viewport.js',
  './engine/audio.js',
  './engine/input.js',
  './engine/touch.js',
  './engine/draw.js',
  './engine/decor.js',
  './engine/particles.js',
  './engine/minimap.js',
  './src/platform.js',
  './engine/biomes.js',
  './src/data/biomes.js',
  './src/data/palettes.js',
  './src/data/logs.js',
  './src/data/whispers.js',
  './src/meta/save.js',
  './engine/telemetry.js',
  './src/meta/cores.js',
  './engine/spawn.js',
  './engine/alarm-light.js',
  './src/meta/alarm-light.js',
  './src/meta/upgrades.js',
  './src/meta/modules.js',
  './src/meta/logs.js',
  './src/meta/whispers.js',
  './src/meta/behavior.js',
  './src/meta/boosts.js',
  './engine/cinematic.js',
  './src/meta/intro.js',
  './src/meta/hub.js',
  './engine/render-boundary.js',
  './engine/dungeon/topology.js',
  './engine/dungeon/reachability.js',
  './src/content/terminals.js',
  './src/content/weapons.js',
  './src/content/upgrades.js',
  './src/content/pickups.js',
  './src/content/projectiles.js',
  './src/content/music.js',
  './src/content/modifiers.js',
  './src/content/events.js',
  './src/content/shop.js',
  './src/content/perks.js',
  './src/content.js',
  './src/entities.js',
  './src/render.js',
  './src/game.js',
];

const requiredPrecache = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
  ...requiredInIndex,
  './assets/audio/title-theme.wav',
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-192x192-maskable.png',
  './icon-512x512-maskable.png',
];

const noStore = [
  {
    path: './version.json',
    reason: 'Generated only in the GitHub Pages artifact by release-version.yml; keep it out of sw.js precache so the title screen fetch stays release-driven.',
  },
];

module.exports = {
  requiredInIndex,
  requiredPrecache,
  noStore,
};
