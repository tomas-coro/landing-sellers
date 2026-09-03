// service-worker.js
const CACHE_NAME = 'venditori-le-shell-v24';

const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth-logic.js',
  './js/auth.js',
  './js/validators.js',
  './js/web-push.js',
  './js/catalogo-prezzi.js',
  './js/app.js',
  './manifest.json'
];

const APP_SHELL_URLS = new Set(
  APP_SHELL.map((path) => new URL(path, self.registration.scope).href)
);

// Durante l'installazione forza una richiesta fresca.
// In questo modo una nuova cache non viene popolata con asset presi
// dalla vecchia cache HTTP del browser.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        APP_SHELL.map(async (path) => {
          const request = new Request(
            new URL(path, self.registration.scope).href,
            { cache: 'reload' }
          );

          const response = await fetch(request);

          if (!response.ok) {
            throw new Error(`Impossibile aggiornare ${path}: HTTP ${response.status}`);
          }

          await cache.put(request, response);
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Landing Sellers è un'app online.
// Per HTML/CSS/JS preferiamo sempre la versione pubblicata su GitHub Pages.
// La cache resta come fallback quando la rete non è disponibile.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;

  if (!sameOrigin) return;

  const isNavigation = request.mode === 'navigate';
  const isAppShell = APP_SHELL_URLS.has(requestUrl.href);

  if (!isNavigation && !isAppShell) return;

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(async (response) => {
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);

        if (cached) return cached;

        if (isNavigation) {
          const fallback =
            await caches.match(new URL('./index.html', self.registration.scope).href) ||
            await caches.match(new URL('./', self.registration.scope).href);

          if (fallback) return fallback;
        }

        throw new Error('Risorsa non disponibile offline');
      })
  );
});

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = {
      title: 'Landing Evolution',
      body: event.data ? event.data.text() : ''
    };
  }

  const title = data.title || 'Landing Evolution';

  const options = {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: data.url || './' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const relativeUrl =
    (event.notification.data && event.notification.data.url) || './';

  const targetUrl =
    new URL(relativeUrl, self.registration.scope).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
