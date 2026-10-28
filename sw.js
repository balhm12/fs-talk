/* FS Talk 서비스 워커 — 앱 화면 캐시(오프라인 첫 화면) + 푸시 알림 수신. 메시지 데이터는 캐시하지 않음 */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");
firebase.initializeApp({
  apiKey: "AIzaSyBbjBmVrsJuuWnT-MWpESlLPxzgG9pkueU",
  authDomain: "fs-talk-fa383.firebaseapp.com",
  databaseURL: "https://fs-talk-fa383-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fs-talk-fa383",
  storageBucket: "fs-talk-fa383.firebasestorage.app",
  messagingSenderId: "95175163518",
  appId: "1:95175163518:web:7ce131f6318887057ea22f"
});
firebase.messaging(); // 앱이 꺼져 있을 때 온 알림을 표시하고, 누르면 해당 방을 엶

const CACHE = "fstalk-v2";
const SHELL = ["./", "./index.html", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 앱 화면: 항상 최신을 먼저, 안 되면 저장본
  if (req.mode === "navigate" && url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  // 버전이 고정된 Firebase SDK·글꼴·아이콘: 저장본 우선
  if (url.hostname === "www.gstatic.com" || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com") || (url.origin === location.origin && url.pathname.includes("/icons/"))) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
  }
});
