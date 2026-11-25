const CACHE="attendance-app-v3-5-explicit-ampm";
const FILES=["./","./index.html","./style.css","./app.js","./manifest.json","./icon-192.png","./icon-512.png","./icon-180.png"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
 self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys()
  .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
  .then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 const appShell=["/","/index.html","/app.js","/style.css","/manifest.json","/sw.js"].some(path=>url.pathname.endsWith(path));
 if(appShell){
  event.respondWith(fetch(event.request).then(response=>{
   const copy=response.clone();
   caches.open(CACHE).then(cache=>cache.put(event.request,copy));
   return response;
  }).catch(()=>caches.match(event.request)));
 }else{
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
 }
});
