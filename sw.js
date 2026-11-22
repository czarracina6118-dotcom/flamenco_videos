importScripts('./drive-media.js');
const C='curso-flamenco-v7-4-1-drive-1',A=['./','./index.html','./manifest.json','./selected-files.js','./drive-client.js','./drive-ui.js','./drive-media.js','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('curso-flamenco-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='DRIVE_PING')e.ports[0]?.postMessage({drive:true});});
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url),base=new URL(self.registration.scope);
 if(url.origin!==base.origin)return;
 if(url.pathname.startsWith(base.pathname+'_drive_media/')){
  e.respondWith(serveDriveMedia(e.request,{clientId:e.clientId,clients:self.clients}).catch(()=>new Response('No se pudo conectar con Drive.',{status:503,headers:{'Cache-Control':'no-store'}})));return;
 }
 if(e.request.method!=='GET')return;
 e.respondWith(fetch(e.request).then(response=>{
  if(response.ok&&A.some(path=>new URL(path,base).href===url.href)){
   const copy=response.clone();e.waitUntil(caches.open(C).then(c=>c.put(e.request,copy)).catch(()=>{}));
  }
  return response;
 }).catch(async()=>{
  const saved=await caches.match(e.request);if(saved)return saved;
  if(e.request.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
  return Response.error();
 }));
});
