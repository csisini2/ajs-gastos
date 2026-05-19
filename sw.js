// Service Worker AJS — cachea la app y los scripts de Firebase
// para que arranque rápido aunque la red esté lenta
const CACHE = 'ajs-cache-v2';

// Recursos que queremos cachear (la app + Firebase SDK)
const FIREBASE_URLS = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
];

self.addEventListener('install', e => {
  // activar de inmediato sin esperar
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FIREBASE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // NUNCA cachear llamadas a la base de datos ni autenticación de Firebase
  // (esos datos tienen que ser siempre frescos y en tiempo real)
  if (url.includes('firebaseio.com') ||
      url.includes('identitytoolkit') ||
      url.includes('googleapis.com') ||
      url.includes('google.com/identitytoolkit')) {
    return; // dejar pasar a la red normal, sin cache
  }

  // Para los scripts de Firebase SDK: servir de cache primero (rápido),
  // y actualizar en segundo plano
  if (FIREBASE_URLS.some(f => url.startsWith(f.split('?')[0]))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Para el resto (la página, manifest): red primero, cache como respaldo
  if (e.request.method === 'GET' &&
      (url.endsWith('/') || url.endsWith('.html') || url.endsWith('.json'))) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
  }
});
