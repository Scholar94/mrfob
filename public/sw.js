const CACHE = "mrfob-shell-v3";
const SHELL = ["/mrfob/", "/mrfob/offline.html", "/mrfob/manifest.webmanifest", "/mrfob/mr-fop-app-logo.webp", "/mrfob/mr-fop-website-logo.webp", "/mrfob/mr-fop-fashion-institute-logo.webp"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith("mrfob-shell-") && key !== CACHE).map(key => caches.delete(key)))
  ));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const offline = await caches.match("/mrfob/offline.html");
      return offline || new Response("You are offline. Reconnect and try again.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }));
    return;
  }

  // Cache only same-origin static assets, never Firebase/API or account data.
  if (!/\.(?:css|js|mjs|svg|png|jpg|jpeg|webp|ico|woff2?)$/i.test(url.pathname)) return;
  event.respondWith(caches.match(request).then(async cached => {
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return new Response("This resource is unavailable offline.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  }));
});