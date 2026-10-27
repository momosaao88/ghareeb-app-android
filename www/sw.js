const V='siraj-v20';
const A=['./','index.html','styles.css','app.js','scripts/modules/bootstrap.js','scripts/modules/quran-data.js','scripts/modules/search-engine.js','scripts/modules/mushaf-renderer.js','scripts/modules/package.json','scripts/core.js','scripts/sources.js','scripts/additional-meanings.js','scripts/muyassar-meanings.js','data.js','manifest.json','privacy.html','fonts/HafsSmart.ttf','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(A.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>hit||fetch(r).then(n=>{if(n.ok){const c=n.clone();caches.open(V).then(x=>x.put(r,c));}return n;}).catch(()=>r.mode==='navigate'?caches.match('index.html'):Response.error())));
});
