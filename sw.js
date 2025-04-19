
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('deriv-bot-cache').then(cache => {
      return cache.addAll(['/', '/index.html', '/bot.js']);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
