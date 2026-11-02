/**
 * ChatArchive - Service Worker para Soporte Offline y PWA
 * Compatible con GitHub Pages (sin rutas absolutas al dominio raíz)
 */

const CACHE_NAME = 'chatarchive-cache-v1.1.0';

// Lista de recursos locales esenciales para funcionamiento 100% offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  
  // Logotipos e Iconos
  './assets/logo/logo.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',

  // Librerías Vendor Locales (Sin CDN)
  './vendor/bootstrap/css/bootstrap.min.css',
  './vendor/bootstrap/js/bootstrap.bundle.min.js',
  './vendor/bootstrap-icons/font/bootstrap-icons.min.css',
  './vendor/bootstrap-icons/font/fonts/bootstrap-icons.woff2',
  './vendor/bootstrap-icons/font/fonts/bootstrap-icons.woff',
  './vendor/jszip/jszip.min.js',

  // Hojas de Estilo Propias
  './css/style.css',
  './css/components.css',
  './css/chat.css',
  './css/responsive.css',

  // Módulos JavaScript Core y Vistas
  './js/app.js',
  './js/core/config.js',
  './js/core/state.js',
  './js/core/router.js',
  './js/utils/helpers.js',
  './js/utils/dates.js',
  './js/utils/validation.js',
  './js/views/dashboard.js',
  './js/views/library.js',
  './js/views/settings.js',
  
  // Módulos de Importación y Parser (Etapa 2)
  './js/import/importer.js',
  './js/import/parser.js',
  './js/import/txt-reader.js',
  './js/import/zip-reader.js',
  './js/import/media-handler.js',
  './workers/parser-worker.js'
];

// Instalación: Cachear recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ChatArchive SW] Pre-cacheando recursos offline...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activación: Limpieza de cachés antiguas sin tocar IndexedDB
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ChatArchive SW] Eliminando versión de caché antigua:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptación de peticiones: Cache First con Network Fallback
self.addEventListener('fetch', (event) => {
  // Ignorar esquemas no soportados (ej. chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Si la petición es válida y de nuestro mismo origen, podemos guardarla en caché dinámicamente
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.method === 'GET'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Si falla la red y se solicitó un documento HTML, devolver index.html de la caché
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
