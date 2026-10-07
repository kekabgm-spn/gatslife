/**
 * @file sw.js
 * @description Service worker de "El Código de las Cartas".
 *
 *   Qué guarda y cómo:
 *   - CARCASA (html, css, js, iconos): red primero; si no hay red o tarda
 *     más de 4 s, usa la copia guardada. Así siempre ves la versión nueva
 *     cuando hay internet, y la app abre sin conexión.
 *   - DATOS (carpeta data/): se guardan la primera vez que se consultan y
 *     luego se leen del móvil (cada JSON pesa ~450 KB; no se precargan
 *     los ~250 MB). Si cambias un JSON, sube CACHE_VERSION.
 *   - IMÁGENES de cartas (raw.githubusercontent.com): igual que los datos.
 *   - Firebase SDK (gstatic.com/firebasejs, versión fija): se guarda para
 *     que la página no se rompa sin conexión. Login e historial siguen
 *     necesitando internet.
 *   - Todo lo demás (Firestore, Worker de Cloudflare, etc.) NO se toca.
 *
 *   Para forzar que todos los usuarios descarguen todo de nuevo:
 *   cambia CACHE_VERSION (por ejemplo 'v2').
 */
const CACHE_VERSION = 'v4'; // 3/10/2026: muro de login (js/muro-login.js) + control de acceso real en el Worker
const CACHE_CARCASA = 'codigo-cartas-carcasa-' + CACHE_VERSION;
const CACHE_DATOS = 'codigo-cartas-datos-' + CACHE_VERSION;
const CACHE_IMAGENES = 'codigo-cartas-imagenes-' + CACHE_VERSION;
const CACHES_ACTUALES = [CACHE_CARCASA, CACHE_DATOS, CACHE_IMAGENES];

const ESPERA_RED_MS = 4000;

const PRECARGAR = [
  "./",
  "arcanos.html",
  "combinaciones-marsella.html",
  "combinaciones-rws.html",
  "detalle-combinacion-marsella.html",
  "detalle-combinacion-rws.html",
  "detalle-tirada.html",
  "estudio-analisis-de-una-tirada.html",
  "estudio-astros.html",
  "estudio-cabala.html",
  "estudio-chakras.html",
  "estudio-el-camino-del-loco.html",
  "estudio-entorno-lectura.html",
  "estudio-golden-dawn.html",
  "estudio-historia.html",
  "estudio-junguiano.html",
  "estudio-mujeres-en-el-tarot.html",
  "estudio-new-age.html",
  "estudio-numerologia.html",
  "estudio-protocolo.html",
  "estudio-rituales-esotericos.html",
  "estudio-rituales-tarot.html",
  "estudio-tabla-arcanos-golden-dawn.html",
  "estudio-tabla-arcanos-marsella.html",
  "estudio-tabla-arcanos-nueva-era.html",
  "estudio-tabla-arcanos-rws.html",
  "estudio-tarot-clasico.html",
  "estudio-tarot-hoy.html",
  "estudio-terapeutico.html",
  "estudio-transicion.html",
  "estudios.html",
  "guia-practica-tirada.html",
  "historial.html",
  "index.html",
  "indicar-cartas.html",
  "introduccion.html",
  "listado-tiradas.html",
  "tipos-lecturas.html",
  "veredicto-marsella.html",
  "veredicto-rws.html",
  "css/animations.css",
  "css/base.css",
  "css/components.css",
  "css/estudios.css",
  "css/icons.css",
  "css/layout.css",
  "css/responsive.css",
  "js/animations.js",
  "js/arcanos-init.js",
  "js/auth-widget.js",
  "js/auth.js",
  "js/automatic.js",
  "js/card-helpers.js",
  "js/combinations-marsella.js",
  "js/combinations-rws.js",
  "js/data-marsella.js",
  "js/data-rws.js",
  "js/dom-nota.js",
  "js/firebase-init.js",
  "js/fusion-sinonimos.js",
  "js/glosario-arcanos.js",
  "js/guardar-historial.js",
  "js/historial.js",
  "js/images.js",
  "js/main.js",
  "js/muro-login.js",
  "js/max-combinaciones.js",
  "js/navigation.js",
  "js/readings-marsella.js",
  "js/readings-rws.js",
  "js/render-carta-marsella.js",
  "js/render-carta-rws.js",
  "js/selection.js",
  "js/sintesis-ia.js",
  "js/tiempo-fusion.js",
  "js/veredicto-marsella.js",
  "js/veredicto-rws.js",
  "manifest.json",
  "js/pwa.js",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_CARCASA);
    // Uno a uno: si un archivo falla, los demás se guardan igualmente.
    await Promise.allSettled(
      PRECARGAR.map((ruta) => cache.add(new Request(new URL(ruta, self.registration.scope).href, { cache: 'reload' })))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(
      nombres
        .filter((n) => n.startsWith('codigo-cartas-') && !CACHES_ACTUALES.includes(n))
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

function redConTiempo(request) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ESPERA_RED_MS);
    fetch(request).then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function redPrimero(request) {
  // FIX 2/10/2026: fetch(request) a secas deja que el navegador conteste
  // desde SU PROPIA caché HTTP (la de toda la vida, no la de este Service
  // Worker) si el servidor mandó cabeceras Cache-Control que lo permiten —
  // GitHub Pages las manda. Resultado: "red primero" podía no tocar la red
  // en absoluto y servir una copia vieja, incluso recién subido el cambio.
  // Se reconstruye la petición con cache: 'reload' para forzar ida real al
  // servidor (sigue guardándose después en la caché de ESTE Service Worker
  // como respaldo offline, eso no cambia).
  const peticionSinCacheHTTP = new Request(request, { cache: 'reload' });
  const cache = await caches.open(CACHE_CARCASA);
  try {
    const resp = await redConTiempo(peticionSinCacheHTTP);
    if (resp && resp.ok) cache.put(request, resp.clone());
    return resp;
  } catch (e) {
    const guardada = await cache.match(request, { ignoreSearch: true });
    if (guardada) return guardada;
    if (request.mode === 'navigate') {
      const inicio = await cache.match(new URL('./', self.registration.scope).href);
      if (inicio) return inicio;
    }
    throw e;
  }
}

async function cachePrimero(request, nombreCache, peticionRed) {
  const cache = await caches.open(nombreCache);
  const guardada = await cache.match(request);
  if (guardada) return guardada;
  const resp = await fetch(peticionRed || request);
  if (resp && resp.ok) cache.put(request, resp.clone());
  return resp;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Archivos de esta misma web
  if (url.origin === self.location.origin) {
    const ruta = url.pathname.slice(new URL(self.registration.scope).pathname.length);
    if (ruta.startsWith('data/')) {
      event.respondWith(cachePrimero(request, CACHE_DATOS));
    } else {
      event.respondWith(redPrimero(request));
    }
    return;
  }

  // Imágenes de las cartas (GitHub). Se piden en modo "cors" para que se
  // guarden como respuesta normal (las "opacas" ocupan mucho más cupo).
  if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/tarot-imagenes/')) {
    event.respondWith(
      cachePrimero(request, CACHE_IMAGENES, new Request(request.url, { mode: 'cors', credentials: 'omit' }))
    );
    return;
  }

  // Firebase SDK (versión fija en la URL, no cambia)
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(cachePrimero(request, CACHE_CARCASA));
    return;
  }
  // Cualquier otra cosa: el navegador la gestiona normalmente.
});
