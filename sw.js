// NEON DUNGEON — Service Worker (cache-first offline PWA)
'use strict';

const CACHE = 'neon-dungeon-assets';
const ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
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
  './src/content/meta-save.js',
  './src/content/combo.js',
  './src/entities/room-index.js',
  './src/content/events.js',
  './src/content/shop.js',
  './src/content/perks.js',
  './src/content/effects.js',
  './src/content/hackware.js',
  './src/content/status.js',
  './src/content/lighting.js',
  './src/content/floor-generator.js',
  './src/content.js',
  './src/entities.js',
  './src/entities/fuse-shards.js',
  './src/render.js',
  './src/game.js',
  './assets/audio/title-theme.wav',
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-192x192-maskable.png',
  './icon-512x512-maskable.png',
];
const ASSET_URLS = new Set(ASSETS.map((asset) => new URL(asset, self.location.href).href));

// Pre-cache all static assets on install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Purge old caches on activate. The cache name is intentionally stable:
// freshness comes from network-first fetches, not a second version number.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function cacheFromNetwork(e) {
  return fetch(e.request).then((response) => {
    if (response.ok) {
      const clone = response.clone();
      e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, clone)));
    }
    return response;
  });
}

function cacheAppShellFromNetwork(e) {
  return fetch(e.request).then((response) => {
    if (response.ok) {
      const clone = response.clone();
      e.waitUntil(caches.open(CACHE).then((c) => c.put('./', clone)));
    }
    return response;
  });
}

function isAppShellNavigation(url) {
  const appRoot = new URL('./', self.location.href);
  const appIndex = new URL('./index.html', self.location.href);
  return url.pathname === appRoot.pathname ||
    url.pathname === appRoot.pathname.replace(/\/$/, '') ||
    url.pathname === appIndex.pathname;
}

// Network-first for app assets; cached fallback keeps the PWA offline-capable.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (e.request.mode === 'navigate') {
    if (!isAppShellNavigation(url)) {
      if (!ASSET_URLS.has(url.href)) {
        e.respondWith(fetch(e.request));
        return;
      }

      e.respondWith(cacheFromNetwork(e).catch(() => caches.match(e.request)));
      return;
    }

    e.respondWith(
      cacheAppShellFromNetwork(e).catch(() => caches.match('./').then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  if (!ASSET_URLS.has(url.href)) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    cacheFromNetwork(e).catch(() => caches.match(e.request))
  );
});
