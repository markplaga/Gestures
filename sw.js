// PWA-UPDATE-SYSTEM v1: auto-update, version banner, Check for updates. Do not remove this line.
// Gesture Slideshow service worker.
// Keeps the app working offline and installs new versions safely.
// It only ever touches its own caches ("gestures-..."); localStorage, IndexedDB and
// saved settings live outside the cache and are never cleared by an update.
const VERSION = '1.0.0';
const CACHE = 'gestures-' + VERSION;
const OLD_CACHES = ['gestures-v2'];
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];
const CDN = [];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([
    ...SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r); })),
    ...CDN.map(u => c.add(u).catch(() => null))
  ])));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'GET_VERSION' && e.ports[0]) e.ports[0].postMessage({ version: VERSION });
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => (k.startsWith('gestures-') && k !== CACHE) || OLD_CACHES.includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function fromNetwork(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.endsWith('/version.json')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fromNetwork(new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' }), 6000)
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return r; })
      .catch(() => caches.match('./index.html', { cacheName: CACHE }).then(r => r || caches.match('./index.html'))));
    return;
  }
  const same = url.origin === location.origin;
  const cdn = /cdn\.jsdelivr\.net|storage\.googleapis\.com|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!same && !cdn) return;
  e.respondWith(caches.match(req, { cacheName: CACHE }).then(hit => hit || caches.match(req)).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
