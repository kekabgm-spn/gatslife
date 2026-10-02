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

if("serviceWorker" in navigator){ window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(e){ console.warn("sw.js:", e); }); }); }
