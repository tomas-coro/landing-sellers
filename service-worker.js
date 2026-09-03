// service-worker.js
const CACHE_NAME = 'venditori-le-shell-v7';
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
    ).then(() => self.clients.claim())
  );
});

// Il nuovo service worker resta "in attesa" finche' l'app non lo dice
// esplicitamente (bottone "Aggiorna" in app.js): senza questo, saltare
// subito all'attivazione romperebbe una sessione con la pagina gia' aperta.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
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

// Solo la subscription/registrazione in questa fase: nessuna logica
// definitiva di notifiche automatiche (vedi FASE eventi, ancora da
// definire). Ogni push ricevuto produce comunque una notifica visibile,
// perche' senza questo iOS revoca la subscription.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'Landing Evolution', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Landing Evolution';
  const options = {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
