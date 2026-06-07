/* Service worker — caches the app shell so the escape room works fully offline
   once it has been opened once. Bump CACHE to ship an update. */
const CACHE = "cs-escape-v4";
const ASSETS = [
  "./", "index.html", "css/styles.css",
  "js/data.js", "js/rng.js", "js/sound.js", "js/fx.js", "js/story.js",
  "js/settings.js", "js/dragdrop.js", "js/puzzles.js", "js/engine.js",
  "manifest.json", "assets/icon-192.png", "assets/icon-512.png",
  "assets/fonts/orbitron-700.woff2", "assets/fonts/orbitron-900.woff2"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {}));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => { try { c.put(e.request, copy); } catch (_) {} });
      return res;
    }).catch(() => caches.match("index.html")))
  );
});
