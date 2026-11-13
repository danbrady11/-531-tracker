const CACHE_NAME = "531-tracker-v70";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/app.js",
  "./js/calc.js",
  "./js/program.js",
  "./js/state.js",
  "./js/storage.js",
  "./js/timer.js",
  "./js/chart.js",
  "./js/sync.js",
  "./js/lift-meta.js",
  "./js/rehab-meta.js",
  "./js/views/today.js",
  "./js/views/settings.js",
  "./js/views/history.js",
  "./js/views/calendar.js",
  "./js/views/rehab.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

// cache.addAll() fetches through the browser's regular HTTP cache, not just
// the Cache Storage API's own cache — so on an update, a file the browser
// still considers HTTP-fresh (e.g. within GitHub Pages' max-age window) can
// get silently reused from that stale HTTP cache while other files fetch
// genuinely new, leaving this version's cache internally inconsistent (seen
// in practice: a new index.html with a new nav tab, paired with an old
// cached app.js that doesn't know the new view exists — a dead tab and no
// error, since nothing actually threw). { cache: "reload" } forces every
// precache fetch to bypass HTTP cache and hit the network, so a given
// CACHE_NAME's contents are always from one consistent deploy.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.all(PRECACHE_URLS.map((url) => fetch(url, { cache: "reload" }).then((response) => cache.put(url, response)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for same-origin assets, with a network fetch to refresh the cache
// in the background. Falls back to network entirely for cross-origin requests.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
