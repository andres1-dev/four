// Service Worker — Network Only, sin cache
// Incrementar este número fuerza que las PWAs instaladas descarten el SW anterior
const SW_VERSION = 'v24';

// Al instalar: activar de inmediato sin esperar
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Al activar: tomar control de todos los clientes abiertos y notificarles
self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Limpiar cualquier cache residual de versiones anteriores
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window' }).then((clients) =>
          clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }))
        )
      )
  );
});

// Fetch: siempre desde la red, sin tocar cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});
