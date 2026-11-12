const CACHE_NAME = 'salon-anas-push-v23';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/icon-180.png', '/admin-premium.css', '/admin-premium.js', '/customer-cards.css', '/customer-cards.js', '/appointments-premium.css', '/appointments-premium.js', '/appointments-v3.css', '/appointments-v3.js', '/push-confirm.css', '/salon-home.css', '/salon-home.js', '/admin-club.css', '/admin-club.js', '/admin-messages.css', '/admin-messages.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(fetch(req, req.mode === 'navigate' ? {cache:'no-store'} : undefined).then(resp => {
    if(resp && resp.ok){
      const copy=resp.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)));
    }
    return resp;
  }).catch(()=>caches.match(req).then(cached=>cached||caches.match('/index.html'))));
});
self.addEventListener('push', event => {
  let data={};
  try{data=event.data ? event.data.json() : {}}
  catch{data={body:event.data?event.data.text():''}}
  event.waitUntil(self.registration.showNotification(
    String(data.title||'SALON ANAS 1').slice(0,80),
    {
      body:String(data.body||'Eine neue Nachricht von SALON ANAS 1.').slice(0,240),
      icon:'/icon-192.png', badge:'/icon-192.png',
      data:{url:data.url||'/'}
    }
  ));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  let target;
  try{target=new URL(event.notification.data?.url||'/',self.location.origin)}
  catch{target=new URL('/',self.location.origin)}
  if(target.origin !== self.location.origin) return;
  event.waitUntil(self.clients.openWindow(target.href));
});
