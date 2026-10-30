/* FS 포털 서비스 워커 — 앱 화면 캐시(오프라인 첫 화면) + 푸시 알림 수신. 메시지 데이터는 캐시하지 않음 */
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

const CACHE = "fstalk-v6";   // v6: 현장 오프라인(실마리 데이터·웹폰트 저장)
const DATA = "fstalk-data";   // 실마리 암호화 데이터(열어 본 것만) — 버전이 바뀌어도 유지
const META = "fstalk-meta";   // 앱 아이콘 숫자(안 읽은 수) 보관 — 캐시 정리 때 지우지 않음

// 앱이 꺼져 있을 때 알림이 오면 앱 아이콘 숫자 +1 (앱을 열면 정확한 수로 다시 맞춤)
self.addEventListener("push", e => {
  let room = "";
  try { const d = e.data && e.data.json(); room = (d && d.data && d.data.room) || ""; } catch (err) {}
  if (!room || !self.navigator || !("setAppBadge" in self.navigator)) return;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    if (list.some(c => c.visibilityState === "visible")) return;   // 앱이 화면에 떠 있으면 앱이 직접 셈
    return caches.open(META).then(c => c.match("./badge").then(r => r ? r.text() : "0").then(t => {
      const n = (parseInt(t, 10) || 0) + 1;
      return c.put("./badge", new Response(String(n))).then(() => self.navigator.setAppBadge(n));
    }));
  }).catch(() => {}));
});

// 앱이 직접 띄운 알림(창이 열려 있을 때)을 누르면 그 방으로 — FCM이 띄운 알림은 Firebase가 처리
self.addEventListener("notificationclick", e => {
  const url = e.notification.data && e.notification.data.url;
  if (!url) return;
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const target = new URL(url, self.registration.scope).href;
    for (const c of list) { if (c.url.split("#")[0] === target.split("#")[0] && "focus" in c) { c.navigate ? c.navigate(target).catch(() => {}) : null; return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
const SHELL = ["./", "./index.html", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== META && k !== DATA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 앱 화면: 항상 최신을 먼저, 안 되면 저장본
  if (req.mode === "navigate" && url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { if (r.ok && r.type === "basic" && !r.redirected) { const copy = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); } return r; })   // 오류 화면·와이파이 로그인 화면은 저장하지 않음
      .catch(() => caches.match("./index.html")));
    return;
  }
  // 실마리 데이터(암호화 상태 그대로): 항상 최신을 먼저, 전파가 약하면 마지막 받은 것 — 병원 안에서도 최근 본 장비·에러를 볼 수 있게
  if (url.origin === location.origin && url.pathname.startsWith("/sysmex-ts/data/")) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(DATA).then(c => c.put(url.origin + url.pathname, copy)); } return r; })
      .catch(() => caches.open(DATA).then(c => c.match(url.origin + url.pathname)).then(hit => hit || Response.error())));
    return;
  }
  // 웹폰트(Pretendard, 버전 고정): 저장본 우선
  if (url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("/pretendard@")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
    return;
  }
  // 버전이 고정된 Firebase SDK·글꼴·아이콘: 저장본 우선
  if (url.hostname === "www.gstatic.com" || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com") || (url.origin === location.origin && url.pathname.includes("/icons/"))) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
  }
});
