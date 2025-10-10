const VERSION = '1.2.1';
const CACHE_NAME = `hydration-v${VERSION}`;
const urlsToCache = [
    './',
    'index.html',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'favicon-32x32.png',
    'app.js',
    'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(async (res) => {
            if (res || false)
                if (res.type !== 'cors' || !res.url.includes(self.location.origin))
                    // If the resource is not a CORS request or doesn't belong to the same origin, return the cached response
                    return res;
            // If resource is not in cache or is not a CORS request or doesn't belong to the same origin, fetch it from the network
            return fetch(e.request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        if (e.request.method === 'GET' && e.request.url.startsWith('http') && e.request.mode !== 'cors') {
                            cache.put(e.request, responseClone);
                        }
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(e.request);
                });
        })
    );
});

self.addEventListener('activate', (e) => {
    const cacheWhitelist = [CACHE_NAME];

    e.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete caches not in the whitelist
                        if (cacheWhitelist.indexOf(cacheName) === -1) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            // Claim all clients to allow service worker to control them
            .then(() => self.clients.claim())
    );
});
