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

// ---------- Avisos y confirmaciones propios (sustituyen a alert() y confirm() del navegador) ----------
// Uso:  avisar("Texto");                         → muestra un aviso con «Entendido»
//       if(await confirmar("¿Borrar esto?")) …   → true si pulsa Aceptar, false si cancela, pulsa fuera o Escape
//       confirmar("¿Borrar?", {si:"Borrar", peligro:true})   → botón rojo con otro texto
// A diferencia de confirm(), NO paran el código: hay que esperar la respuesta con await (o .then).
(function(){
  var cola = Promise.resolve();
  function mostrar(texto, op){
    return new Promise(function(resolve){
      var previo = document.activeElement;
      var capa = document.createElement("div");
      capa.setAttribute("role", "alertdialog"); capa.setAttribute("aria-modal", "true");
      capa.style.cssText = "position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;";
      var caja = document.createElement("div");
      caja.style.cssText = "max-width:380px;width:100%;max-height:85vh;overflow:auto;background:var(--panel,var(--card,#1b2330));color:var(--ink,#e8ecf2);border:1px solid var(--line,#2a3242);border-radius:14px;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.45);";
      var p = document.createElement("p");
      p.style.cssText = "margin:0 0 16px;font-size:.98rem;line-height:1.45;white-space:pre-line;overflow-wrap:anywhere;";
      p.textContent = String(texto);
      var fila = document.createElement("div");
      fila.style.cssText = "display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;";
      function boton(txt, estilo){
        var b = document.createElement("button"); b.type = "button"; b.textContent = txt;
        b.style.cssText = "margin:0;padding:10px 16px;border-radius:10px;font-size:.95rem;font-weight:700;cursor:pointer;min-height:42px;" + estilo;
        return b;
      }
      var acento = op.peligro ? "#e5484d" : "var(--accent,#35c26a)";
      var bSi = boton(op.si || (op.aviso ? "Entendido" : "Aceptar"), "border:1px solid " + acento + ";background:" + (op.peligro ? "#e5484d;color:#fff" : "transparent;color:" + acento) + ";");
      var bNo = op.aviso ? null : boton(op.no || "Cancelar", "border:1px solid var(--line,#2a3242);background:transparent;color:var(--ink,#e8ecf2);");
      if(bNo) fila.appendChild(bNo);
      fila.appendChild(bSi);
      caja.appendChild(p); caja.appendChild(fila); capa.appendChild(caja);
      var cerrado = false;
      function cerrar(r){
        if(cerrado) return; cerrado = true;
        document.removeEventListener("keydown", tecla, true);
        capa.remove();
        try{ if(previo && previo.focus) previo.focus(); }catch(e){}
        resolve(r);
      }
      function tecla(e){
        if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); cerrar(op.aviso ? true : false); }
        else if(e.key === "Tab"){   // el foco se queda dentro del cuadro
          var bs = bNo ? [bNo, bSi] : [bSi], i = bs.indexOf(document.activeElement);
          e.preventDefault(); bs[(i + (e.shiftKey ? bs.length - 1 : 1)) % bs.length].focus();
        }
      }
      bSi.onclick = function(){ cerrar(true); };
      if(bNo) bNo.onclick = function(){ cerrar(false); };
      capa.addEventListener("click", function(e){ if(e.target === capa) cerrar(op.aviso ? true : false); });
      document.addEventListener("keydown", tecla, true);
      document.body.appendChild(capa);
      (bNo || bSi).focus();   // en las confirmaciones el foco empieza en «Cancelar»: un Enter de más no borra nada
    });
  }
  function encolar(texto, op){
    var r = cola.then(function(){ return mostrar(texto, op); });
    cola = r.catch(function(){});
    return r;
  }
  window.avisar = function(texto){ return encolar(texto, { aviso: true }); };
  window.confirmar = function(texto, op){ return encolar(texto, op || {}); };
})();
