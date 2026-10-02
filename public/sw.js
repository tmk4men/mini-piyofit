const CACHE = "mini-piyofit-v1";

self.addEventListener("install", (e) => {
  // 即座に新SWを適用
  self.skipWaiting();
  // HTML以外のシェルを事前キャッシュ
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["./manifest.webmanifest", "./icon.svg"]))
      .catch(() => {}),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 他オリジン（MediaPipe CDNなど）はSWを介さずそのまま
  if (url.origin !== self.location.origin) return;

  // HTML / ナビゲーション → network-first（古いindex.htmlをキャッシュしたままにしない）
  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./"))),
    );
    return;
  }

  // ハッシュ付きアセット等 → cache-first
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached),
    ),
  );
});
