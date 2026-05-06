const CACHE_NAME = "password-manager-v1";
const assets = [
  "/",
  "/index.html",
  "/app.js",
  "/manifest.json",
  "/icon.png"
];

// При установке — кешируем основные ресурсы
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

// При активации — удаляем старые кеши (если нужно)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// При каждом запросе — отвечаем из кеша при необходимости
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});