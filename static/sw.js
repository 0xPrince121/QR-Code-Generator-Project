// Optimized Service Worker for QR Code Generator
const CACHE_NAME = 'qr-generator-v2.0.0';
const STATIC_CACHE = 'qr-static-v2.0.0';
const DYNAMIC_CACHE = 'qr-dynamic-v2.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
    '/',
    '/static/style.css',
    '/static/script.js',
    '/static/qr_codes/',
    // Don't cache external CDN files to avoid cache size issues
];

// Network-first strategy for API calls
const API_PATHS = ['/generate_qr', '/download/'];

// Cache-first strategy for static assets
const STATIC_ASSETS = ['.css', '.js', '.png', '.jpg', '.svg', '.ico'];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static files
            caches.open(STATIC_CACHE)
                .then((cache) => {
                    console.log('Service Worker: Caching static files');
                    return cache.addAll(STATIC_FILES);
                }),
            // Skip waiting to activate immediately
            self.skipWaiting()
        ])
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control immediately
            self.clients.claim()
        ])
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Handle different types of requests
    if (isAPIRequest(url)) {
        // Network-first strategy for API calls
        event.respondWith(networkFirstStrategy(request));
    } else if (isStaticAsset(url)) {
        // Cache-first strategy for static assets
        event.respondWith(cacheFirstStrategy(request));
    } else {
        // Stale-while-revalidate for other requests
        event.respondWith(staleWhileRevalidateStrategy(request));
    }
});

// Network-first strategy for API calls
async function networkFirstStrategy(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error('Network response not ok');
    } catch (error) {
        // Fallback to cache
        console.log('Service Worker: Network failed, trying cache for', request.url);
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback for API calls
        return new Response(
            JSON.stringify({ 
                error: 'Offline - please check your connection', 
                offline: true 
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        // Try network if not in cache
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Failed to fetch static asset:', request.url);
        
        // Return offline fallback
        return new Response(
            'Offline - Asset not available',
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
            }
        );
    }
}

// Stale-while-revalidate for other requests
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Fetch from network in background
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch((error) => {
        console.log('Service Worker: Background fetch failed for', request.url);
    });
    
    // Return cached response immediately if available
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Wait for network if no cache
    return fetchPromise || new Response('Offline', { 
        status: 503,
        statusText: 'Service Unavailable' 
    });
}

// Check if request is an API call
function isAPIRequest(url) {
    return API_PATHS.some(path => url.pathname.startsWith(path));
}

// Check if request is for static assets
function isStaticAsset(url) {
    return STATIC_ASSETS.some(ext => url.pathname.includes(ext)) ||
           url.pathname.startsWith('/static/');
}

// Background sync for failed requests (if supported)
self.addEventListener('sync', (event) => {
    if (event.tag === 'qr-generation') {
        console.log('Service Worker: Background sync for QR generation');
        event.waitUntil(retryFailedRequests());
    }
});

// Retry failed requests when back online
async function retryFailedRequests() {
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    
    const retryPromises = requests.map(async (request) => {
        try {
            const response = await fetch(request);
            if (response.ok) {
                console.log('Service Worker: Retry successful for', request.url);
            }
        } catch (error) {
            console.log('Service Worker: Retry failed for', request.url);
        }
    });
    
    await Promise.all(retryPromises);
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_URLS') {
        const urlsToCache = event.data.payload;
        event.waitUntil(
            caches.open(STATIC_CACHE).then(cache => {
                return cache.addAll(urlsToCache);
            })
        );
    }
});

// Cache cleanup utility
async function cleanupCache(cacheName, maxItems = 50) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxItems) {
        // Remove oldest items
        const itemsToDelete = keys.slice(0, keys.length - maxItems);
        await Promise.all(
            itemsToDelete.map(key => cache.delete(key))
        );
        console.log(`Service Worker: Cleaned up ${itemsToDelete.length} items from ${cacheName}`);
    }
}

// Periodic cache cleanup
setInterval(() => {
    cleanupCache(DYNAMIC_CACHE);
}, 300000); // Every 5 minutes

console.log('Service Worker: Loaded and ready');
