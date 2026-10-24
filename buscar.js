// buscar.js — pestaña "Buscar" (estilo FatSecret): una sola caja de búsqueda, resultados por fuente y ficha con comida + cantidad + medida.
// Fuentes: 1) alimentos genéricos en español (BEDCA, alimentos-bedca.json)  2) productos de supermercado (AESAN, alimentos-aesan.json)
//          3) OpenFoodFacts (solo si lo pides, o para códigos de barras que no estén en AESAN).
// Usa funciones que ya existen en nutricion.html: slug, esc, tarjetaProducto, registrarFrecuente, topFrecuentes, buscarPorCodigoBarras,
// abrirEscaner, buscarOFFPag, extraerSuper, diaDe, guardarEstado, render, COMIDAS, SUPER_MARCAS y la variable fechaActual.
(function(){
  "use strict";
  var panel = document.querySelector('.panel[data-panel="bus"]');
  if(!panel) return;
  var $ = function(id){ return document.getElementById(id); };

  var SUPERS = [["mercadona","Mercadona"],["carrefour","Carrefour"],["lidl","Lidl"],["dia","Dia"],["aldi","Aldi"],["alcampo","Alcampo"],
    ["eroski","Eroski"],["el-corte-ingles","El Corte Inglés"],["consum","Consum"],["ahorramas","Ahorramás"],["ifa","IFA"]];
  var PASO = 30; // cuántos resultados se muestran de cada vez

  // ---------- estilos (solo de esta pestaña) ----------
  var st = document.createElement("style");
  st.textContent =
    ".bus-q{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--panel-alt,#111827);color:inherit;font-size:1rem}" +
    ".bus-fila{display:flex;gap:8px;margin:8px 0;flex-wrap:wrap}" +
    ".bus-fila select{flex:1;min-width:150px;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel-alt,#111827);color:inherit}" +
    ".bus-fila button{padding:10px 14px;border-radius:10px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-weight:800;cursor:pointer}" +
    ".bus-fila button.pri{background:var(--accent);color:#06210f}" +
    ".bus-nota{font-size:.8rem;color:var(--muted);margin:4px 0 10px}" +
    ".bus-tit{font-weight:800;margin:16px 0 6px;font-size:.95rem}" +
    ".bus-mas{margin:8px 0}.bus-mas button{width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-weight:800;cursor:pointer}" +
    ".bus-fuente{font-size:.72rem;color:var(--muted);margin:22px 0 8px;line-height:1.4}";
  document.head.appendChild(st);

  // ---------- carga de las bases (solo la primera vez) ----------
  var bedca = [], aesan = [], porEAN = new Map(), cargado = null, errores = [];
  function sinCeros(c){ return String(c||"").replace(/^0+/, ""); }
  function cargar(){
    if(cargado) return cargado;
    // Las bases NO están en la web pública: se piden al Worker y solo responde a tus cuentas con sesión (ver IAClaves.datos en claves.js).
    var pedir = function(nombre){ return (window.IAClaves && IAClaves.datos) ? IAClaves.datos(nombre) : Promise.reject(new Error("claves.js no está actualizado")); };
    cargado = Promise.allSettled([pedir("bedca"), pedir("aesan")]).then(function(rs){
      errores = [];
      if(rs[0].status === "fulfilled"){
        bedca = rs[0].value.datos.map(function(r){
          return { code:"bedca-"+r[0], nombre:r[1], marca:"BEDCA (genérico)", kcal100:r[2], grasa100:r[3]||0, prot100:r[4]||0, carbh100:r[5]||0,
                   nova:null, porcionG:null, cantidadG:null, scans:0, _h:" "+slug(r[1]).replace(/-/g," ") };
        });
      } else errores.push("la base de alimentos genéricos (BEDCA): " + ((rs[0].reason && rs[0].reason.message) || "error"));
      if(rs[1].status === "fulfilled"){
        aesan = rs[1].value.datos.map(function(r){
          var o = { code:r[0], nombre:r[1], marca:r[2]||"", super:r[3]||"", kcal100:r[4], grasa100:r[5]||0, carbh100:r[6]||0, prot100:r[7]||0,
                    nova:null, porcionG:null, cantidadG:null, scans:0, _h:" "+slug(r[1]+" "+(r[2]||"")+" "+(r[3]||"")).replace(/-/g," "), _s:slug(r[3]||"") };
          porEAN.set(sinCeros(r[0]), o);
          return o;
        });
      } else errores.push("la base de productos de supermercado (AESAN): " + ((rs[1].reason && rs[1].reason.message) || "error"));
      if(errores.length) cargado = null; // si algo falló, la próxima búsqueda lo vuelve a intentar
    });
    return cargado;
  }

  // ---------- búsqueda local ----------
  function tokens(q){
    return slug(q).split("-").filter(Boolean).map(function(t){ return (t.length > 3 && t.charAt(t.length-1) === "s") ? t.slice(0,-1) : t; });
  }
  function buscarLocal(lista, toks, filtro){
    var out = [];
    for(var i=0;i<lista.length;i++){
      var p = lista[i];
      if(filtro && !filtro(p)) continue;
      var ok = true, empieza = false;
      for(var j=0;j<toks.length;j++){
        var k = p._h.indexOf(" " + toks[j]);
        if(k < 0){ ok = false; break; }
        if(j === 0 && k === 0) empieza = true;
      }
      if(ok) out.push({p:p, sc:(empieza ? 0 : 100) + p.nombre.length});
    }
    out.sort(function(a,b){ return a.sc - b.sc; });
    return out.map(function(x){ return x.p; });
  }
  function filtroSuper(t){
    if(!t) return null;
    var marcas = (typeof SUPER_MARCAS !== "undefined" && SUPER_MARCAS[t]) || [];
    return function(p){ return p._s === t || marcas.indexOf(slug(p.marca)) >= 0; };
  }

  // ---------- añadir al diario ----------
  function aviso(t){
    var d = $("busToast");
    if(!d){
      d = document.createElement("div"); d.id = "busToast";
      d.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--accent);color:#06210f;padding:10px 16px;border-radius:10px;font-weight:800;z-index:9999;max-width:90%;text-align:center";
      document.body.appendChild(d);
    }
    d.textContent = t; d.style.display = "block";
    clearTimeout(d._t); d._t = setTimeout(function(){ d.style.display = "none"; }, 2800);
  }
  function agregar(p, g, med){
    var c = (med && COMIDAS.some(function(x){ return x.id === med.comida; })) ? med.comida : "almuerzo";
    window.__comidaBuscar = c;
    diaDe(fechaActual).comidas[c].push({
      nombre:p.nombre, gramos:g, kcal:p.kcal100*g/100,
      grasa:(p.grasa100||0)*g/100, carbh:(p.carbh100||0)*g/100, prot:(p.prot100||0)*g/100
    });
    guardarEstado(); render();
    try{ registrarFrecuente(p, g); }catch(e){}
    var cn = COMIDAS.filter(function(x){ return x.id === c; })[0].nombre;
    aviso("✔ Añadido a " + cn + " · " + $("fechaLabel").textContent);
  }
  function tarjeta(p){
    var card = tarjetaProducto(p, "", function(pp, g, med){ agregar(pp, g, med); if(card._cerrar) card._cerrar(); }, null, true);
    return card;
  }

  // ---------- pantalla ----------
  panel.innerHTML =
    '<input id="busQ" class="bus-q" type="search" placeholder="Busca un alimento o producto: huevo, leche hacendado, yogur…" autocomplete="off">' +
    '<div class="bus-fila"><select id="busSuper" aria-label="Supermercado"><option value="">Cualquier supermercado</option>' +
      SUPERS.map(function(s){ return '<option value="'+s[0]+'">'+s[1]+'</option>'; }).join("") + '</select>' +
      '<button id="busIr" type="button" class="pri">Buscar</button><button id="busEsc" type="button">📷 Escanear código</button></div>' +
    '<div id="busFecha" class="bus-nota"></div>' +
    '<div id="busRes"></div>' +
    '<div class="bus-fuente">Alimentos genéricos: AESAN/BEDCA Base de Datos Española de Composición de Alimentos v1.0 (2010), valores por 100 g de porción comestible; la energía se convirtió de kJ a kcal (1 kcal = 4,184 kJ) en los casos en que venía en kJ. ' +
    'Productos de supermercado: AESAN, base de datos de alimentos y bebidas comercializados en España (2022); pueden haber cambiado de composición. ' +
    'Otros productos y códigos de barras: Open Food Facts. Los valores son orientativos.</div>';

  var q = $("busQ"), selSuper = $("busSuper"), res = $("busRes");
  var lim = {gen:PASO, sup:PASO}, offEstado = null, ultima = null;

  function fechaNota(){ $("busFecha").textContent = "📅 Se añade al día que ves arriba: " + $("fechaLabel").textContent + ". Elige la comida al abrir un alimento."; }
  fechaNota();
  try{ new MutationObserver(fechaNota).observe($("fechaLabel"), {childList:true, characterData:true, subtree:true}); }catch(e){}

  function seccion(titulo){ var d = document.createElement("div"); d.className = "bus-tit"; d.textContent = titulo; res.appendChild(d); }
  function masBtn(texto, fn){
    var d = document.createElement("div"); d.className = "bus-mas";
    var b = document.createElement("button"); b.type = "button"; b.textContent = texto; b.onclick = fn;
    d.appendChild(b); res.appendChild(d);
  }
  function estado(t){ var d = document.createElement("div"); d.className = "estado"; d.textContent = t; res.appendChild(d); }

  function pintar(){
    var texto = q.value.trim(), tienda = selSuper.value;
    res.innerHTML = "";
    if(errores.length) estado("No se pudo cargar " + errores.join(" · ") + ". Comprueba que tengas la sesión de Google iniciada y que el Worker esté configurado con los datos (repositorio privado). Se volverá a intentar al buscar de nuevo.");
    var toks = tokens(texto);
    if(!toks.length){
      var fr = (typeof topFrecuentes === "function") ? topFrecuentes(8) : [];
      if(fr.length){ seccion("⭐ Tus frecuentes"); fr.forEach(function(p){ res.appendChild(tarjeta(p)); }); }
      else estado("Escribe lo que buscas. Por ejemplo: «huevo», «arroz», «yogur natural» o «leche hacendado».");
      return;
    }
    var vistosOFF = new Set();
    if(!tienda){
      var gen = buscarLocal(bedca, toks, null);
      seccion("🥚 Alimentos genéricos (" + gen.length + ")");
      if(!gen.length) estado("Sin coincidencias entre los alimentos genéricos.");
      gen.slice(0, lim.gen).forEach(function(p){ res.appendChild(tarjeta(p)); });
      if(gen.length > lim.gen) masBtn("Ver más genéricos", function(){ lim.gen += PASO; pintar(); });
    }
    var sup = buscarLocal(aesan, toks, filtroSuper(tienda));
    seccion("🛒 Productos de supermercado" + (tienda ? " · " + selSuper.options[selSuper.selectedIndex].text : "") + " (" + sup.length + ")");
    if(!sup.length) estado("Sin coincidencias en la base de productos de supermercado.");
    sup.slice(0, lim.sup).forEach(function(p){ vistosOFF.add(p.code); res.appendChild(tarjeta(p)); });
    if(sup.length > lim.sup) masBtn("Ver más productos", function(){ lim.sup += PASO; pintar(); });
    sup.forEach(function(p){ vistosOFF.add(p.code); });
    // Open Food Facts: solo si lo pides (así no se pasa del límite de búsquedas por minuto)
    ultima = {texto:texto, tienda:tienda, vistos:vistosOFF};
    var cont = document.createElement("div"); cont.id = "busOFF"; res.appendChild(cont);
    var d = document.createElement("div"); d.className = "bus-mas";
    var b = document.createElement("button"); b.type = "button"; b.textContent = "🌐 Buscar también en Open Food Facts";
    b.onclick = function(){ buscarOFF(1, b); };
    d.appendChild(b); cont.appendChild(d);
  }

  function buscarOFF(pagina, boton){
    var cont = $("busOFF"); if(!cont || !ultima) return;
    boton.disabled = true; boton.textContent = "Buscando en Open Food Facts…";
    var f = {nova:"todos", pais:"", marca:"", tienda:ultima.tienda, sinClasificar:true};
    buscarOFFPag(ultima.texto, f, pagina, ultima.vistos).then(function(r){
      cont.innerHTML = "";
      var t = document.createElement("div"); t.className = "bus-tit"; t.textContent = "🌐 Open Food Facts"; cont.appendChild(t);
      if(!r.productos.length){ var e = document.createElement("div"); e.className = "estado"; e.textContent = "Open Food Facts no aporta nada nuevo para esta búsqueda."; cont.appendChild(e); return; }
      r.productos.forEach(function(p){ cont.appendChild(tarjeta(p)); });
      if(r.hayMas){
        var d = document.createElement("div"); d.className = "bus-mas";
        var b2 = document.createElement("button"); b2.type = "button"; b2.textContent = "Ver más de Open Food Facts";
        b2.onclick = function(){ var hijos = cont.querySelectorAll(".resultado"); buscarOFFMas(pagina + 1, b2); };
        d.appendChild(b2); cont.appendChild(d);
      }
    }).catch(function(err){
      boton.disabled = false; boton.textContent = "🌐 Reintentar Open Food Facts";
      var e = document.createElement("div"); e.className = "estado";
      e.textContent = "No se pudo conectar con Open Food Facts (" + (err && err.message || "error") + "). Suele ser temporal: espera un minuto.";
      cont.appendChild(e);
    });
  }
  function buscarOFFMas(pagina, boton){
    boton.disabled = true; boton.textContent = "Buscando…";
    var cont = $("busOFF");
    var f = {nova:"todos", pais:"", marca:"", tienda:ultima.tienda, sinClasificar:true};
    buscarOFFPag(ultima.texto, f, pagina, ultima.vistos).then(function(r){
      boton.parentNode.remove();
      r.productos.forEach(function(p){ cont.appendChild(tarjeta(p)); });
      if(r.hayMas){
        var d = document.createElement("div"); d.className = "bus-mas";
        var b2 = document.createElement("button"); b2.type = "button"; b2.textContent = "Ver más de Open Food Facts";
        b2.onclick = function(){ buscarOFFMas(pagina + 1, b2); };
        d.appendChild(b2); cont.appendChild(d);
      }
    }).catch(function(){ boton.disabled = false; boton.textContent = "Reintentar"; });
  }

  // ---------- eventos ----------
  function lanzar(){
    var x = (typeof extraerSuper === "function") ? extraerSuper(q.value.trim()) : {tienda:"", termino:q.value};
    if(x.tienda && SUPERS.some(function(s){ return s[0] === x.tienda; })){ selSuper.value = x.tienda; q.value = x.termino; }
    lim = {gen:PASO, sup:PASO};
    cargar().then(pintar);
  }
  var temporizador = null;
  q.addEventListener("input", function(){ clearTimeout(temporizador); temporizador = setTimeout(function(){ lim = {gen:PASO, sup:PASO}; cargar().then(pintar); }, 250); });
  q.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); clearTimeout(temporizador); lanzar(); } });
  $("busIr").onclick = lanzar;
  selSuper.onchange = function(){ lim = {gen:PASO, sup:PASO}; cargar().then(pintar); };

  $("busEsc").onclick = function(){
    abrirEscaner(function(codigo){
      res.innerHTML = '<div class="estado">Buscando el código ' + esc(codigo) + '…</div>';
      cargar().then(function(){
        var p = porEAN.get(sinCeros(codigo));
        if(p) return {p:p, de:"AESAN"};
        return buscarPorCodigoBarras(codigo).then(function(o){ return o ? {p:o, de:"Open Food Facts"} : null; });
      }).then(function(r){
        res.innerHTML = "";
        if(!r){ estado("No se encontró ningún producto con el código " + codigo + " ni en AESAN ni en Open Food Facts. Puedes añadirlo a mano desde Día → Alimentos."); return; }
        seccion("📷 Código " + codigo + " · encontrado en " + r.de);
        res.appendChild(tarjeta(r.p));
        var c = res.querySelector(".res-cab"); if(c) c.click();
      }).catch(function(e){ res.innerHTML = ""; estado("No se pudo buscar el código: " + (e && e.message || "error")); });
    });
  };

  // Motor compartido: la pestaña Día usa exactamente la misma búsqueda local (BEDCA + AESAN) que esta pestaña.
  window.BuscadorBase = {
    cargar: function(){ return cargar().then(function(){ return {errores: errores.slice()}; }); },
    buscar: function(texto, tienda){ var toks = tokens(texto); return { gen: tienda ? [] : buscarLocal(bedca, toks, null), sup: buscarLocal(aesan, toks, filtroSuper(tienda)) }; },
    porCodigo: function(codigo){ return porEAN.get(sinCeros(codigo)) || null; }
  };

  // al abrir la pestaña: precarga las bases y enseña los frecuentes
  var tabBtn = document.querySelector('#tabsSec [data-p="bus"]');
  if(tabBtn) tabBtn.addEventListener("click", function(){ fechaNota(); cargar().then(function(){ if(!q.value.trim()) pintar(); }); });
  pintar();
})();
