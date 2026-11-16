// Service worker: код и стили сначала из сети (всегда свежая версия), при отсутствии сети отдаёт сохранённое.
// v0.5.8: в «каркас» кладём только лёгкое (код, стили, иконки). Картинки (WebP в assets/) идут из кэша, если уже есть,
// и кладутся туда по мере показа, а не заранее: кэш не раздувается и телефон не качает их при каждом запуске.
// Если заменить картинку под тем же именем, поднимите версию CACHE, иначе останется старая.
const CACHE = 'tgm-v14';
const SHELL = ['./', 'index.html', 'style.css', 'config.js', 'manifest.json', 'js/app.js', 'js/calc.js', 'js/store.js', 'js/i18n.js', 'js/sound.js', 'js/prices.js', 'js/library.js', 'js/learn.js', 'js/auth.js', 'js/merge.js', 'js/authtext.js', 'js/tour.js', 'js/push.js', 'js/changelog.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // облако и CDN идут напрямую
  const isImage = /\/assets\/.+\.(webp|png|jpe?g)$/i.test(url.pathname);
  e.respondWith(
    (isImage ? caches.match(req) : Promise.resolve(null)).then((hit) => hit || fetch(url.href, { cache: isImage ? 'default' : 'no-store' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })).catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});

// Push-уведомления: сервер присылает { title, body, tag, url }
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'TGM', { body: d.body || '', tag: d.tag || 'tgm', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate && c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});