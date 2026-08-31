// service-worker.js
const CACHE_NAME = 'venditori-le-shell-v2';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth-logic.js',
  './js/auth.js',
  './js/validators.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

// Solo asset statici dell'app shell passano dalla cache. Tutto il resto
// (chiamate a Supabase) va sempre in rete: niente dati offline nell'MVP.
self.addEventListener('fetch', (event) => {
  if (APP_SHELL.some((path) => event.request.url.endsWith(path.replace('./', '/')))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
