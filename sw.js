// NEON DUNGEON — Service Worker (cache-first offline PWA)
'use strict';

const CACHE = 'neon-dungeon-v179';
const ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './manifest.json',
  './engine/math.js',
  './engine/viewport.js',
  './engine/audio.js',
  './engine/input.js',
  './engine/touch.js',
  './engine/draw.js',
  './engine/decor.js',
  './engine/particles.js',
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
  './src/content.js',
  './src/entities.js',
  './src/render.js',
  './src/game.js',
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-192x192-maskable.png',
  './icon-512x512-maskable.png',
];

// Pre-cache all static assets on install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Purge old cache versions on activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate for navigation (HTML); cache-first for known assets
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests: serve cached immediately, update cache from network
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const netFetch = fetch(e.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return response;
        });
        return cached || netFetch;
      })
    );
    return;
  }

  // Static assets: cache-first, only cache if pre-cached (no unbounded growth)
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
