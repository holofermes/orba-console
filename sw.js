// Orba Console: app-shell service worker (offline + installable PWA).
// Bump CACHE when you change index.html so clients pick up the new shell.
const CACHE = "orba-console-v2";
const SHELL = ["./", "./index.html", "./orba-protocol/js/orba-protocol.js", "./manifest.json", "./icon-192.png", "./icon-512.png", "./favicon.svg", "./favicon.ico"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for the app shell/library (so edits show up when online),
// falling back to cache when offline. Bluetooth traffic never hits the SW.
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});
