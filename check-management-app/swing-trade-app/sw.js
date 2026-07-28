const CACHE_NAME = "swing-trade-app-v3";
const ASSETS = ["./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ネットワーク優先: オンライン時は常に最新を取得しキャッシュを更新する。
// 旧バージョンはキャッシュ優先だったため、デプロイしても端末に反映されない
// 不具合があった。オフライン時のみキャッシュにフォールバックする。
self.addEventListener("fetch", (event) => {
  // ページ遷移(mode:"navigate")はSWで横取りせずブラウザに任せる。
  // event.requestを横取りしてfetch()し直すとハングする環境があったため、
  // 常に最新を取りに行きたいnavigateリクエストはそもそも介入しない方が安全。
  if (event.request.mode === "navigate") return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
