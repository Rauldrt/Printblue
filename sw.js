const CACHE_NAME = 'printlabel-pro-v1';

// Recursos críticos para funcionar offline
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Instalación: Precarga de recursos esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Usar Promise.allSettled para que si un CDN falla momentáneamente no rompa la instalación
      const cachePromises = PRECACHE_ASSETS.map((asset) =>
        cache.add(asset).catch((err) => {
          console.warn(`[ServiceWorker] Falló precaching de ${asset}:`, err);
        })
      );
      await Promise.allSettled(cachePromises);
    })
  );
  self.skipWaiting();
});

// Activación: Limpieza de versiones viejas de caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Eliminando caché antiguo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptación de peticiones de red (Stale-While-Revalidate & Cache-First)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo gestionar solicitudes GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Estrategia Cache First con actualización en segundo plano para recursos CDN y locales
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // En segundo plano revalidar con la red para mantener actualizado
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
            }
          })
          .catch(() => {
            // Ignorar errores de red en segundo plano (modo offline)
          });

        return cachedResponse;
      }

      // Si no está en caché, buscar en red y guardar
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Guardar copia en caché si es recurso local, cdnjs, jsdelivr o fonts
          const isCacheableOrigin = 
            url.origin === self.location.origin ||
            url.hostname.includes('jsdelivr.net') ||
            url.hostname.includes('tailwindcss.com') ||
            url.hostname.includes('cdnjs.cloudflare.com') ||
            url.hostname.includes('googleapis.com') ||
            url.hostname.includes('gstatic.com');

          if (isCacheableOrigin) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          // Si falla la red y se solicita documento HTML, devolver index.html de caché
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
