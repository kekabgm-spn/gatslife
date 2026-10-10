// sw.js — funciona sin conexión. Sube VERSION cada vez que cambies archivos para que se actualice la caché.
const VERSION = "nuestra-app-vv39";
const LOCAL = ["./","index.html","ajustes.html","nutricion.html","ejercicios.html","tareas.html","calendario.html","salud.html","huawei.html",
  "nube.js","pasos.js","buscar.js","claves.js","familia.js","tema.js","migracion.js","manifest.json","icono.png","icono-192.png","icono-maskable-192.png","icono-maskable-512.png","gato-mamy.png","gato-filha.png",
  "cuerpo-anterior.jpg","cuerpo-posterior.jpg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => Promise.all(LOCAL.map(u => c.add(u).catch(()=>{})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if(r.method !== "GET") return;
  const u = new URL(r.url);
  const propio = u.origin === location.origin;
  const firebaseJs = u.hostname === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/");
  if(!propio && !firebaseJs) return;               // APIs, login de Google y datos: siempre a la red
  if(firebaseJs){                                   // versiones fijas: caché primero
    e.respondWith(caches.match(r).then(h => h || fetch(r).then(x => { const c = x.clone(); caches.open(VERSION).then(ca => ca.put(r, c)); return x; })));
    return;
  }
  e.respondWith(fetch(r).then(x => { if(x.ok){ const c = x.clone(); caches.open(VERSION).then(ca => ca.put(r, c)); } return x; })
    .catch(() => caches.match(r, { ignoreSearch:true }).then(h => h || caches.match("index.html"))));   // red primero, caché si no hay conexión
});
