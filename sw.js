const CACHE_NAME = 'luxury-candle-v2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Installation : pré-mise en cache des fichiers essentiels
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interception des requêtes : Cache d'abord, puis réseau avec mise en cache dynamique
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Ne pas intercepter les requêtes API / POST (comme l'envoi de commandes ou l'IA)
    if (event.request.method !== 'GET') {
        return;
    }

    // Données Supabase (produits, commandes) : toujours en direct, sauf les photos du stockage
    if (url.hostname.endsWith('supabase.co') && !url.pathname.startsWith('/storage/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Si trouvé dans le cache, on le sert tout de suite
                return cachedResponse;
            }

            // Sinon on tente le réseau
            return fetch(event.request).then((networkResponse) => {
                // Si la ressource est valide, on la sauvegarde dans le cache (ex: photos des bougies)
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // En cas de panne totale réseau, retourner la page d'accueil si c'est une navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
