// tema.js — Claro/oscuro. Se guarda en este navegador (localStorage), no se sincroniza entre dispositivos:
// cada quien elige el que prefiere en su propio teléfono o compu.
(function(){
  var CLAVE = "temaAppV1";
  function aplicar(t){ document.documentElement.setAttribute("data-theme", t); }
  aplicar(localStorage.getItem(CLAVE) || "dark");

  window.alternarTema = function(){
    var actual = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    localStorage.setItem(CLAVE, actual);
    aplicar(actual);
    pintarBoton(actual);
  };
  function pintarBoton(t){
    var btn = document.getElementById("btnTema");
    if(btn) btn.textContent = t === "light" ? "🌙" : "☀️";
  }
  var st = document.createElement("style");
  st.textContent = "#btnTema{display:flex !important;align-items:center;justify-content:center;padding:0 !important;line-height:1 !important;width:38px !important;height:38px !important;border-radius:50% !important;font-size:1.1rem !important;box-sizing:border-box;overflow:hidden}";
  document.head.appendChild(st);
  document.addEventListener("DOMContentLoaded", function(){
    pintarBoton(localStorage.getItem(CLAVE) || "dark");
  });
})();

// ---------- Botón «i»: nota explicativa que se abre al tocarla (móvil) ----------
// En el ordenador, al pasar el cursor por encima también sale el globo del navegador (atributo title).
// Uso en HTML: <button type="button" class="ayu" data-t="Texto" title="Texto" aria-label="Más información">i</button>
// Uso en JavaScript: ayu("Texto") devuelve ese mismo botón como texto HTML.
(function(){
  function esc(t){ return String(t).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
  window.ayu = function(texto){
    return '<button type="button" class="ayu" data-t="' + esc(texto) + '" title="' + esc(texto) + '" aria-label="Más información" aria-expanded="false">i</button>';
  };
  var st2 = document.createElement("style");
  st2.textContent =
    ".ayu{position:relative;display:inline-flex !important;align-items:center;justify-content:center;width:20px !important;height:20px !important;min-width:20px !important;margin:0 0 0 6px !important;padding:0 !important;border:1px solid currentColor !important;border-radius:50% !important;background:transparent !important;color:var(--muted,var(--mut,var(--gris2,#8a94a3))) !important;font:italic 700 12px/1 Georgia,serif !important;text-transform:none !important;letter-spacing:0 !important;box-shadow:none !important;cursor:pointer;vertical-align:middle;opacity:.85}" +
    ".ayu::after{content:'';position:absolute;inset:-8px}" +
    ".ayu:hover,.ayu:focus-visible{opacity:1}.ayu:focus-visible{outline:2px solid currentColor;outline-offset:2px}" +
    "#ayuPop{position:fixed;display:none;z-index:100001;max-width:min(320px,calc(100vw - 24px));padding:10px 12px;border-radius:10px;background:var(--panel,var(--card,#1b2330));color:var(--ink,#e8ecf2);border:1px solid var(--line,#2a3242);box-shadow:0 6px 24px rgba(0,0,0,.35);font:400 .85rem/1.45 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;text-transform:none;letter-spacing:0}";
  document.head.appendChild(st2);
  var pop = null, actual = null;
  function cerrar(){
    if(pop) pop.style.display = "none";
    if(actual){ actual.setAttribute("aria-expanded","false"); actual = null; }
  }
  function abrir(b){
    if(!pop){ pop = document.createElement("div"); pop.id = "ayuPop"; pop.setAttribute("role","status"); document.body.appendChild(pop); }
    pop.textContent = b.getAttribute("data-t"); pop.style.display = "block";
    var r = b.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, m = 12;
    var left = Math.min(Math.max(r.left + r.width/2 - w/2, m), window.innerWidth - w - m);
    var top = r.bottom + 8; if(top + h > window.innerHeight - m) top = Math.max(m, r.top - h - 8);
    pop.style.left = left + "px"; pop.style.top = top + "px";
    b.setAttribute("aria-expanded","true"); actual = b;
  }
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest(".ayu");
    if(b){ e.preventDefault(); e.stopPropagation(); if(actual === b) cerrar(); else { cerrar(); abrir(b); } return; }
    if(pop && !pop.contains(e.target)) cerrar();
  }, true);
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") cerrar(); });
  window.addEventListener("scroll", cerrar, {passive:true});
  window.addEventListener("resize", cerrar);
})();

if("serviceWorker" in navigator){ window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(e){ console.warn("sw.js:", e); }); }); }
