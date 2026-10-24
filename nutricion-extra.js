// nutricion-extra.js — funciones nuevas de la pestaña Nutrición:
//   · «Copiar de otro día» y «Repetir la última vez» en cada comida (solo AÑADE alimentos, nunca borra ni cambia lo ya guardado)
//   · «Qué me falta hoy»: 3 ideas de tus alimentos frecuentes según lo que te queda por cubrir (sin IA)
//   · «Escribir lo que comiste» (1 llamada de IA por comida entera), «Foto de la etiqueta» y la lista de «Recientes»
// Usa lo que ya existe en nutricion.js: estado, fechaActual, diaDe, guardarEstado, render, MEALS, COMIDAS, sumarDias, hoyISO,
// objetivosDia, totalesDelDia, quemadasTotales, topFrecuentes, registrarFrecuente, esc. Y, si está cargado, window.AnalisisNut (analisis.js).
(function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };
  var nf = function(n){ return String(Math.round(n * 10) / 10).replace(".", ","); };
  var st = { copiarEn:null, comidaOrigen:null, desde:null, marcados:null };

  // Mensaje breve que se va solo (avisar() de tema.js abre un cuadro que hay que cerrar; aquí no hace falta).
  function aviso(t){
    var d = $("extraToast");
    if(!d){
      d = document.createElement("div"); d.id = "extraToast"; d.setAttribute("role", "status");
      d.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--accent);color:#06210f;padding:10px 16px;border-radius:10px;font-weight:800;z-index:9999;max-width:90%;text-align:center;pointer-events:none";
      document.body.appendChild(d);
    }
    d.textContent = t; d.style.display = "block";
    clearTimeout(d._t); d._t = setTimeout(function(){ d.style.display = "none"; }, 3200);
  }
  function fechaCorta(f){ return new Date(f + "T00:00:00").toLocaleDateString("es-ES", { weekday:"short", day:"numeric", month:"short" }); }
  function nombreComida(id){ var c = COMIDAS.filter(function(x){ return x.id === id; })[0]; return c ? c.nombre : id; }
  function clonar(x){ return JSON.parse(JSON.stringify(x)); }

  // Alimentos de una comida de un día (más los snacks pegados a ella). No crea días vacíos: solo lee.
  function entradasDe(f, comidaId){
    var d = estado.dias[f];
    if(!d || !d.comidas) return [];
    var base = (d.comidas[comidaId] || []).filter(Boolean).map(function(it){ return { item:it, snack:false }; });
    var pegados = (d.comidas.snacks || []).filter(function(it){ return it && it.pegadaA === comidaId; }).map(function(it){ return { item:it, snack:true }; });
    return base.concat(pegados);
  }
  function kcalDe(es){ return Math.round(es.reduce(function(s, e){ return s + (+e.item.kcal || 0); }, 0)); }
  function diasConComida(origen, destino, max){
    var out = [], desde = (origen === destino) ? 1 : 0; // la misma comida del mismo día no se puede copiar sobre sí misma
    for(var i = desde; i <= 90 && out.length < max; i++){
      var f = sumarDias(fechaActual, -i);
      if(entradasDe(f, origen).length) out.push(f);
    }
    return out;
  }
  // Añade copias al final de la comida de destino. No toca nada de lo que ya hay.
  function anadir(destino, entradas){
    var dia = diaDe(fechaActual), n = 0;
    entradas.forEach(function(e){
      var c = clonar(e.item);
      if(e.snack){ c.pegadaA = destino; dia.comidas.snacks.push(c); }
      else { delete c.pegadaA; dia.comidas[destino].push(c); }
      n++;
    });
    guardarEstado();
    return n;
  }
  function repetirUltima(comidaId){
    for(var i = 1; i <= 120; i++){
      var f = sumarDias(fechaActual, -i), es = entradasDe(f, comidaId);
      if(es.length){
        var n = anadir(comidaId, es);
        st.copiarEn = null; render();
        aviso("🔁 Copiados " + n + " alimento" + (n === 1 ? "" : "s") + " de " + nombreComida(comidaId).toLowerCase() + " del " + fechaCorta(f) + ".");
        return;
      }
    }
    aviso("Todavía no hay ninguna vez anterior de " + nombreComida(comidaId).toLowerCase() + ".");
  }

  function panelCopiar(destino){
    var box = document.createElement("div"); box.className = "cp-panel";
    var origen = st.comidaOrigen || destino;
    box.innerHTML =
      '<div class="cp-fila">' +
        '<label>Copiar desde<select class="cp-origen">' + MEALS.map(function(m){ return '<option value="' + m.id + '"' + (m.id === origen ? " selected" : "") + ">" + m.icono + " " + m.nombre + "</option>"; }).join("") + "</select></label>" +
        '<label>Otro día<input type="date" class="cp-fecha" max="' + fechaActual + '"></label>' +
      "</div>" +
      '<div class="cp-dias"></div><div class="cp-lista"></div><div class="cp-pie"></div>';
    var selO = box.querySelector(".cp-origen"), inF = box.querySelector(".cp-fecha");
    var cDias = box.querySelector(".cp-dias"), cLista = box.querySelector(".cp-lista"), cPie = box.querySelector(".cp-pie");

    function pintar(){
      origen = st.comidaOrigen || destino;
      var dias = diasConComida(origen, destino, 8);
      if(!st.desde) st.desde = dias[0] || null;
      inF.value = st.desde || "";
      cDias.innerHTML = "";
      if(!dias.length){ cDias.innerHTML = '<div class="estado">No hay ' + esc(nombreComida(origen).toLowerCase()) + ' anotada en los últimos días. Prueba con otra comida o elige una fecha.</div>'; }
      dias.forEach(function(f){
        var es = entradasDe(f, origen), b = document.createElement("button");
        b.type = "button"; b.className = "cp-dia" + (f === st.desde ? " on" : "");
        b.textContent = fechaCorta(f) + " · " + es.length + " alim. · " + kcalDe(es) + " kcal";
        b.onclick = function(){ st.desde = f; st.marcados = null; pintar(); };
        cDias.appendChild(b);
      });
      var es2 = (st.desde && !(st.desde === fechaActual && origen === destino)) ? entradasDe(st.desde, origen) : [];
      if(!st.marcados) st.marcados = new Set(es2.map(function(_, i){ return i; }));
      cLista.innerHTML = "";
      if(st.desde && !es2.length) cLista.innerHTML = '<div class="estado">Ese día no hay ' + esc(nombreComida(origen).toLowerCase()) + " anotada.</div>";
      es2.forEach(function(e, i){
        var it = e.item, fila = document.createElement("label"); fila.className = "cp-item";
        var cant = it.gramos !== undefined ? it.gramos + " g" : (it.porciones + " porc.");
        fila.innerHTML = '<input type="checkbox"' + (st.marcados.has(i) ? " checked" : "") + '><span class="cp-nom">' + (e.snack ? "🍎 " : "") + esc(it.nombre) +
          '<small>' + esc(cant) + " · " + Math.round(it.kcal || 0) + " kcal</small></span>";
        fila.querySelector("input").onchange = function(ev){ if(ev.target.checked) st.marcados.add(i); else st.marcados["delete"](i); pintar(); };
        cLista.appendChild(fila);
      });
      var sel = es2.filter(function(_, i){ return st.marcados.has(i); });
      cPie.innerHTML = '<button type="button" class="cp-ok"' + (sel.length ? "" : " disabled") + ">Añadir " + sel.length + " alimento" + (sel.length === 1 ? "" : "s") + (sel.length ? " (" + kcalDe(sel) + " kcal)" : "") +
        ' a ' + esc(nombreComida(destino).toLowerCase()) + '</button><button type="button" class="cp-x">Cerrar</button>';
      cPie.querySelector(".cp-ok").onclick = function(){
        var n = anadir(destino, sel); st.copiarEn = null; st.desde = null; st.marcados = null; render();
        aviso("📋 Añadidos " + n + " alimento" + (n === 1 ? "" : "s") + " a " + nombreComida(destino).toLowerCase() + ".");
      };
      cPie.querySelector(".cp-x").onclick = function(){ st.copiarEn = null; render(); };
    }
    selO.onchange = function(){ st.comidaOrigen = selO.value; st.desde = null; st.marcados = null; pintar(); };
    inF.onchange = function(){ st.desde = inF.value || null; st.marcados = null; pintar(); };
    pintar();
    return box;
  }

  // Los dos botones al pie de cada comida (render() de nutricion.js los coloca).
  function barraCopiar(comidaId){
    var wrap = document.createElement("div"); wrap.className = "comida-acc";
    wrap.innerHTML = '<button type="button" class="acc-btn acc-copiar">📋 Copiar de otro día</button><button type="button" class="acc-btn acc-repetir">🔁 Repetir la última vez</button>';
    wrap.querySelector(".acc-copiar").onclick = function(){
      st.copiarEn = (st.copiarEn === comidaId) ? null : comidaId;
      st.comidaOrigen = comidaId; st.desde = null; st.marcados = null; render();
    };
    wrap.querySelector(".acc-repetir").onclick = function(){ repetirUltima(comidaId); };
    if(st.copiarEn === comidaId) wrap.appendChild(panelCopiar(comidaId));
    return wrap;
  }

  // ---------- Qué me falta hoy ----------
  function comidaSegunHora(){ var h = new Date().getHours(); return h < 11 ? "desayuno" : h < 16 ? "almuerzo" : "cena"; }
  function ideas(def, kcalRest, micro){
    var cand = [];
    topFrecuentes(40).forEach(function(f){
      if(!(f.kcal100 >= 0)) return;
      var g = Math.min(400, Math.max(20, f.ultimoGramos || f.porcionG || 100)), kcalP = f.kcal100 * g / 100;
      if(kcalRest != null && kcalP > Math.max(kcalRest, 0) + 40) return; // no cabe en lo que te queda
      var ap = { prot:(f.prot100 || 0) * g / 100, carbh:(f.carbh100 || 0) * g / 100, grasa:(f.grasa100 || 0) * g / 100 };
      var score = 0, razones = [];
      [["prot", "proteína", 1.5], ["carbh", "hidratos", 1], ["grasa", "grasa", 0.7]].forEach(function(m){
        if(def[m[0]] > 3){ var fr = Math.min(ap[m[0]] / def[m[0]], 1); score += m[2] * fr; if(fr >= 0.15) razones.push("+" + Math.round(ap[m[0]]) + " g de " + m[1]); }
      });
      var ent = window.AnalisisNut && AnalisisNut.aporte(f.nombre);
      if(ent) micro.forEach(function(m){
        var a = (ent[m.id] || 0) * g / 100;
        if(a > 0 && m.falta > 0){ var fr2 = Math.min(a / m.falta, 1); score += fr2; if(fr2 >= 0.15) razones.push("+" + nf(a) + " " + m.u + " de " + m.n.toLowerCase()); }
      });
      if(score > 0.2) cand.push({ f:f, g:g, kcalP:kcalP, score:score, razones:razones });
    });
    cand.sort(function(a, b){ return (b.score - a.score) || ((b.f.veces || 0) - (a.f.veces || 0)); });
    return cand.slice(0, 3);
  }
  function renderFaltaHoy(){
    var cont = $("faltaHoy"); if(!cont) return;
    if(fechaActual !== hoyISO()){ cont.innerHTML = ""; cont.hidden = true; return; }
    cont.hidden = false;
    var h = "<h2><span>💡 Qué me falta hoy</span></h2>";
    if(!estado.meta){
      cont.innerHTML = h + '<div class="rep-nota">Pon tu meta de calorías en Perfil y te sugeriré qué comer para cerrar el día.</div>'; return;
    }
    var obj = objetivosDia(), t = totalesDelDia(fechaActual), q = quemadasTotales(fechaActual).total;
    var kcalRest = estado.meta - t.kcal + q;
    var def = { prot:obj.prot != null ? Math.max(0, obj.prot - t.prot) : 0, carbh:obj.carbh != null ? Math.max(0, obj.carbh - t.carbh) : 0, grasa:obj.grasa != null ? Math.max(0, obj.grasa - t.grasa) : 0 };
    var mi = { lista:[], sinEstimar:0 };
    try{ if(window.AnalisisNut) mi = AnalisisNut.faltantes(fechaActual); }catch(e){}
    if(kcalRest <= 0){
      cont.innerHTML = h + '<div class="fh-res">Ya llegaste a tu meta de calorías de hoy (' + Math.abs(Math.round(kcalRest)) + " kcal " + (kcalRest < 0 ? "por encima" : "justas") + ").</div>"; return;
    }
    var partes = ["<b>" + Math.round(kcalRest) + " kcal</b>"];
    if(def.prot > 0) partes.push(Math.round(def.prot) + " g de proteína");
    if(def.carbh > 0) partes.push(Math.round(def.carbh) + " g de hidratos");
    if(def.grasa > 0) partes.push(Math.round(def.grasa) + " g de grasa");
    h += '<div class="fh-res">Te quedan ' + partes.join(" · ") + ".</div>";
    if(mi.lista.length) h += '<div class="fh-micro">Vas flojo hoy en: ' + mi.lista.map(function(m){ return esc(m.n.toLowerCase()); }).join(", ") + (mi.sinEstimar ? " (hay alimentos sin estimar en Análisis, así que puede estar incompleto)" : "") + ".</div>";
    var sug = ideas(def, kcalRest, mi.lista);
    if(!sug.length){
      h += '<div class="rep-nota">' + (topFrecuentes(1).length ? "Ninguno de tus alimentos frecuentes encaja ahora con lo que te falta." : "Cuando tengas alimentos frecuentes (los que más añades), te sugeriré aquí cuáles te encajan.") + "</div>";
      cont.innerHTML = h; return;
    }
    h += '<div class="fh-sug"></div><div class="rep-nota">Ideas de tus alimentos frecuentes, con la cantidad que sueles tomar. Valores aproximados.</div>';
    cont.innerHTML = h;
    var lista = cont.querySelector(".fh-sug"), destino = comidaSegunHora();
    sug.forEach(function(s){
      var fila = document.createElement("div"); fila.className = "fh-fila";
      fila.innerHTML = '<div><b>' + esc(s.f.nombre) + "</b><small>" + Math.round(s.g) + " g · " + Math.round(s.kcalP) + " kcal" + (s.razones.length ? " → " + esc(s.razones.join(", ")) : "") + "</small></div>" +
        '<button type="button">+ ' + esc(nombreComida(destino)) + "</button>";
      fila.querySelector("button").onclick = function(){
        diaDe(fechaActual).comidas[destino].push({ nombre:s.f.nombre, gramos:Math.round(s.g), kcal:s.kcalP,
          grasa:(s.f.grasa100 || 0) * s.g / 100, carbh:(s.f.carbh100 || 0) * s.g / 100, prot:(s.f.prot100 || 0) * s.g / 100 });
        try{ registrarFrecuente(s.f, Math.round(s.g)); }catch(e){}
        guardarEstado(); render();
        aviso("✔ Añadido a " + nombreComida(destino).toLowerCase() + ": " + s.f.nombre);
      };
      lista.appendChild(fila);
    });
  }


  // ---------- utilidades de IA ----------
  function textoDe(data){
    var ps = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    return ps.map(function(x){ return x.text || ""; }).join("").replace(/```json|```/g, "").trim();
  }
  function jsonDe(t, abre, cierra){
    var a = t.indexOf(abre), b = t.lastIndexOf(cierra);
    if(a < 0 || b <= a) throw new Error("La IA no devolvió un resultado legible. Prueba otra vez.");
    return JSON.parse(t.slice(a, b + 1));
  }
  function sinClave(){ return !(window.IAClaves && IAClaves.tieneGemini()); }
  var num = function(v){ var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) && n >= 0 ? n : 0; };

  // ---------- Escribir lo que comiste con tus palabras ----------
  // 1 llamada a la IA para toda la comida: separa alimentos y cantidades. Los números salen de BEDCA (genéricos) cuando el alimento existe;
  // si no existe, se usan los valores estimados por esa misma llamada y se marcan como aproximados. Tú revisas antes de añadir.
  function promptEscribir(texto){
    return 'Eres un asistente de nutrición. Una persona describe lo que ha comido: "' + texto.replace(/"/g, "'") + '". ' +
      'Separa CADA alimento o ingrediente distinto («tostada con aceite» son dos: pan tostado y aceite de oliva; «café con leche» es uno solo). ' +
      'Devuelve SOLO un array JSON, sin texto extra ni ```, con un objeto por alimento y estas claves exactas: ' +
      'busqueda (nombre genérico en español, corto y simple como en una tabla de alimentos española, sin marcas; p. ej. "huevo revuelto", "pan blanco tostado", "aceite de oliva", "café con leche"), ' +
      'cantidad (número: la que dijo la persona; si no dijo ninguna, una ración habitual), ' +
      'unidad ("g", "ml", "unidad", "rebanada", "loncha", "cucharada", "cucharadita", "taza", "vaso" o "racion"), ' +
      'gramos (número: peso total estimado de esa cantidad, en gramos), ' +
      'kcal100, grasa100, carbh100, prot100 (números: valores estimados por 100 g de ese alimento tal como se come; solo se usarán si el alimento no existe en la base de datos). ' +
      'No añadas alimentos que no se mencionan.';
  }
  // Busca el alimento genérico: si no sale con todas las palabras, prueba con menos (quitando las últimas).
  function opcionesLocales(busqueda){
    var B = window.BuscadorBase; if(!B) return [];
    var pal = busqueda.split(/\s+/).filter(Boolean);
    for(var n = pal.length; n >= 1; n--){
      var r = B.buscar(pal.slice(0, n).join(" "), "");
      var gen = (r.gen || []).slice();
      if(gen.length){
        // Entre varias opciones, las más habituales primero (huevo de gallina antes que de pato, etc.). Orden estable.
        var peso = function(p){ var t = String(p.nombre || "").toLowerCase(), v = 0;
          if(/gallina|vaca|entero|fresc/.test(t)) v -= 2; if(/frit|empanad|rebozad|con sal/.test(t)) v += 1; if(/pato|pavo|codorniz|oca|cabra|oveja|yema|clara|en polvo|deshidrat/.test(t)) v += 2; return v; };
        gen = gen.map(function(p, i){ return { p:p, i:i }; }).sort(function(a, b){ return (peso(a.p) - peso(b.p)) || (a.i - b.i); }).map(function(x){ return x.p; });
        return gen.slice(0, 8);
      }
    }
    return [];
  }
  function productoIA(o){
    var nombre = String(o.busqueda || "alimento").trim();
    return { code:"ia-" + slug(nombre), nombre:nombre.charAt(0).toUpperCase() + nombre.slice(1) + " (aprox.)", marca:"estimado por IA",
      kcal100:Math.min(num(o.kcal100), 950), grasa100:num(o.grasa100), carbh100:num(o.carbh100), prot100:num(o.prot100), nova:null, porcionG:null, cantidadG:null, scans:0 };
  }
  function gramosDeLinea(o, p){
    var cant = num(o.cantidad), u = String(o.unidad || "").toLowerCase();
    if(u === "g" || u === "ml") return cant > 0 ? cant : num(o.gramos);
    if(u === "unidad" && cant > 0){ var d = medidasDefecto(p); if(d.tipica) return cant * d.unidad; }
    return num(o.gramos) > 0 ? num(o.gramos) : (cant > 0 ? cant : 100);
  }
  function panelEscribir(alAnadir){
    var box = document.createElement("div"); box.className = "esc-panel";
    box.innerHTML =
      '<textarea class="esc-txt" rows="3" placeholder="Ej.: 2 huevos revueltos, una tostada con aceite y un café con leche"></textarea>' +
      '<button type="button" class="btn-primario esc-ir">✨ Analizar lo que comí</button>' +
      '<div class="rep-nota">Gasta <b>1 llamada de IA</b> por comida entera. Los números salen de BEDCA cuando el alimento existe; si no, son estimados por la IA y quedan marcados como «aprox.». Revisa la lista antes de añadir.</div>' +
      '<div class="esc-estado estado"></div><div class="esc-res"></div>';
    var txt = box.querySelector(".esc-txt"), ir = box.querySelector(".esc-ir"), est = box.querySelector(".esc-estado"), res = box.querySelector(".esc-res");
    ir.onclick = function(){
      var t = txt.value.trim(); res.innerHTML = ""; est.textContent = "";
      if(!t){ est.textContent = "Escribe primero lo que comiste."; return; }
      if(sinClave()){ est.textContent = "Falta la clave de Gemini. Ponla una vez en ⚙️ Ajustes."; return; }
      ir.disabled = true; est.textContent = "Pensando…";
      var cargado = (window.BuscadorBase ? BuscadorBase.cargar() : Promise.resolve({ errores:["buscar.js no está cargado"] }));
      Promise.all([cargado, IAClaves.gemini({ contents:[{ parts:[{ text:promptEscribir(t) }] }], generationConfig:{ responseMimeType:"application/json", temperature:0.1 } })])
        .then(function(rs){
          var lineas = jsonDe(textoDe(rs[1]), "[", "]");
          if(!Array.isArray(lineas) || !lineas.length) throw new Error("No encontré alimentos en lo que escribiste. Prueba a contarlo de otra forma.");
          est.textContent = (rs[0].errores && rs[0].errores.length) ? "No se pudo cargar la base de alimentos (" + rs[0].errores.join(" · ") + "): se usarán estimaciones de la IA." : "";
          pintarLineas(lineas.slice(0, 25), res, est, alAnadir);
        })
        .catch(function(e){ est.textContent = "⚠️ " + (e && e.message ? e.message : "No se pudo analizar."); })
        .then(function(){ ir.disabled = false; });
    };
    return box;
  }
  function pintarLineas(lineas, cont, est, alAnadir){
    var filas = lineas.map(function(o){
      var ops = opcionesLocales(String(o.busqueda || "")).map(function(p){ return { p:p, ia:false }; });
      var pia = productoIA(o);
      if(!ops.length){ guardarEstIA(slug(String(o.busqueda || "")), pia); } // se recuerda: la próxima vez no hace falta IA
      ops.push({ p:pia, ia:true });
      return { o:o, ops:ops, i:0, g:gramosDeLinea(o, ops[0].p), marcada:true };
    });
    cont.innerHTML = '<div class="esc-tit">Revisa y ajusta:</div><div class="esc-lineas"></div><div class="esc-pie"></div>';
    var lista = cont.querySelector(".esc-lineas"), pie = cont.querySelector(".esc-pie");
    function kcalFila(f){ var p = f.ops[f.i].p; return Math.round(p.kcal100 * f.g / 100); }
    function pintarPie(){
      var sel = filas.filter(function(f){ return f.marcada && f.g > 0; }), kc = sel.reduce(function(s, f){ return s + kcalFila(f); }, 0);
      pie.innerHTML = '<button type="button" class="cp-ok"' + (sel.length ? "" : " disabled") + ">Añadir " + sel.length + " alimento" + (sel.length === 1 ? "" : "s") + " (" + kc + " kcal)</button>";
      pie.querySelector("button").onclick = function(){
        alAnadir(sel.map(function(f){ var p = f.ops[f.i].p; return { p:p, g:Math.round(f.g * 10) / 10 }; }));
      };
    }
    filas.forEach(function(f){
      var fila = document.createElement("div"); fila.className = "esc-fila";
      var o = f.o, dicho = (num(o.cantidad) ? nf(num(o.cantidad)) + " " + (o.unidad || "") + " · " : "");
      fila.innerHTML = '<label class="esc-chk"><input type="checkbox" checked><span class="esc-nom"></span></label>' +
        '<div class="esc-ctl"><select class="esc-sel"></select><span class="esc-g"><input type="number" min="0" step="any" inputmode="decimal"> g</span><b class="esc-kc"></b></div>';
      var sel = fila.querySelector(".esc-sel"), inG = fila.querySelector(".esc-g input"), nom = fila.querySelector(".esc-nom"), kc = fila.querySelector(".esc-kc");
      f.ops.forEach(function(op, i){ var e = document.createElement("option"); e.value = i; e.textContent = op.ia ? "✨ Estimado por IA: " + op.p.nombre : "BEDCA: " + op.p.nombre; sel.appendChild(e); });
      function pintarFila(){
        var op = f.ops[f.i];
        nom.innerHTML = esc(String(o.busqueda || "")) + '<small>' + esc(dicho) + (op.ia ? "⚠️ valores aproximados de la IA" : "valores de BEDCA") + "</small>";
        kc.textContent = kcalFila(f) + " kcal"; inG.value = Math.round(f.g * 10) / 10; sel.value = f.i;
        fila.classList.toggle("esc-ia", op.ia);
      }
      sel.onchange = function(){ f.i = parseInt(sel.value, 10) || 0; f.g = gramosDeLinea(f.o, f.ops[f.i].p); pintarFila(); pintarPie(); };
      inG.oninput = function(){ f.g = num(inG.value); kc.textContent = kcalFila(f) + " kcal"; pintarPie(); };
      fila.querySelector("input[type=checkbox]").onchange = function(ev){ f.marcada = ev.target.checked; pintarPie(); };
      pintarFila(); lista.appendChild(fila);
    });
    pintarPie();
  }

  // ---------- Foto de la etiqueta ----------
  function reducirImagen(archivo, maxLado){
    return new Promise(function(resolve){
      try{
        var url = URL.createObjectURL(archivo), im = new Image();
        im.onload = function(){
          var k = Math.min(1, maxLado / Math.max(im.width, im.height)), c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          resolve({ mime:"image/jpeg", base64:c.toDataURL("image/jpeg", 0.85).split(",")[1] });
        };
        im.onerror = function(){ URL.revokeObjectURL(url); resolve(null); };
        im.src = url;
      }catch(e){ resolve(null); }
    });
  }
  var PROMPT_ETIQUETA = "Esta imagen debería ser la etiqueta nutricional (tabla de valores nutricionales) de un alimento envasado. Devuelve SOLO un objeto JSON, sin texto extra ni ```, con estas claves exactas: " +
    "legible (true si se ve una tabla nutricional y se puede leer; false si no), nombre (nombre del producto si se ve en la imagen; si no, null), marca (si se ve; si no, null), " +
    "kcal100, grasa100, carbh100, prot100 (números POR 100 g o por 100 ml; si la etiqueta solo da valores «por ración», conviértelos a 100 g usando el peso de la ración que figure), " +
    "porcionG (gramos de una ración si figura; si no, null). Copia los números tal como se ven, con punto decimal y sin unidades. Usa null si un dato no aparece. No inventes nada.";
  function formularioEtiqueta(c, d, alUsar){
    var kc = num(d.kcal100), gr = num(d.grasa100), ch = num(d.carbh100), pr = num(d.prot100), aviso = "";
    var est = 9 * gr + 4 * ch + 4 * pr;
    if(kc > 0 && Math.abs(kc - est) > Math.max(60, 0.35 * est)) aviso = "⚠️ Las calorías no cuadran con los gramos de grasa, hidratos y proteína: puede que se haya leído mal algún número. Compáralo con la foto.";
    c.innerHTML = '<div class="esc-tit">📷 Leído de la etiqueta (por 100 g). <b>Revisa los números con la foto:</b></div>' +
      '<div class="etq-grid"><label class="etq-nom">Nombre<input type="text" class="etq-n" value="' + esc(d.nombre || "") + '" placeholder="Nombre del producto"></label>' +
      '<label>kcal<input type="number" class="etq-k" step="any" value="' + kc + '"></label><label>Grasa (g)<input type="number" class="etq-g" step="any" value="' + gr + '"></label>' +
      '<label>Hidratos (g)<input type="number" class="etq-c" step="any" value="' + ch + '"></label><label>Proteína (g)<input type="number" class="etq-p" step="any" value="' + pr + '"></label>' +
      '<label>Ración (g)<input type="number" class="etq-r" step="any" value="' + (num(d.porcionG) || "") + '" placeholder="opcional"></label></div>' +
      (aviso ? '<div class="estado">' + aviso + "</div>" : "") + '<button type="button" class="btn-primario etq-ok">Usar estos valores</button>';
    c.querySelector(".etq-ok").onclick = function(){
      var q = function(s){ return num(c.querySelector(s).value); }, nombre = c.querySelector(".etq-n").value.trim() || "Producto (etiqueta)";
      if(!(q(".etq-k") >= 0) || !(q(".etq-k") <= 950)){ aviso_("Revisa las kcal: deben estar entre 0 y 950 por 100 g."); return; }
      alUsar({ code:"etq-" + slug(nombre + "-" + (d.marca || "")), nombre:nombre, marca:d.marca || "etiqueta (foto)", kcal100:q(".etq-k"), grasa100:q(".etq-g"), carbh100:q(".etq-c"), prot100:q(".etq-p"),
        nova:null, porcionG:q(".etq-r") > 0 ? q(".etq-r") : null, cantidadG:null, scans:0 });
    };
  }
  function aviso_(t){ aviso(t); }
  // Abre la cámara/galería, lee la etiqueta con IA y enseña un formulario para revisar. alUsar(producto) recibe el resultado final.
  function etiqueta(cont, alUsar){
    if(sinClave()){ cont.innerHTML = '<div class="estado">Falta la clave de Gemini. Ponla una vez en ⚙️ Ajustes.</div>'; return; }
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.setAttribute("capture", "environment");
    inp.onchange = function(){
      var arch = inp.files && inp.files[0]; if(!arch) return;
      cont.innerHTML = '<div class="estado">Leyendo la etiqueta…</div>';
      reducirImagen(arch, 1600).then(function(img){ return img || archivoABase64(arch).then(function(b){ return { mime:arch.type || "image/jpeg", base64:b }; }); })
        .then(function(img){ return IAClaves.gemini({ contents:[{ parts:[{ inline_data:{ mime_type:img.mime, data:img.base64 } }, { text:PROMPT_ETIQUETA }] }], generationConfig:{ responseMimeType:"application/json", temperature:0 } }); })
        .then(function(data){
          var d = jsonDe(textoDe(data), "{", "}");
          if(d.legible === false || !(num(d.kcal100) > 0 || num(d.grasa100) > 0 || num(d.carbh100) > 0 || num(d.prot100) > 0)){
            cont.innerHTML = '<div class="estado">No pude leer una tabla nutricional en esa foto. Prueba con más luz, de frente y con la tabla bien enfocada.</div>'; return;
          }
          formularioEtiqueta(cont, d, alUsar);
        })
        .catch(function(e){ cont.innerHTML = '<div class="estado">⚠️ No se pudo leer la etiqueta: ' + esc(e && e.message ? e.message : "error") + "</div>"; });
    };
    inp.click();
  }

  // ---------- Recientes ----------
  function listaRecientes(max){
    var vistos = {}, out = [];
    for(var i = 0; i <= 30 && out.length < max; i++){
      var f = sumarDias(fechaActual, -i), d = estado.dias[f]; if(!d || !d.comidas) continue;
      COMIDAS.forEach(function(c){
        (d.comidas[c.id] || []).slice().reverse().forEach(function(it){
          if(!it || !it.nombre || out.length >= max) return;
          var k = String(it.nombre).toLowerCase() + "|" + (it.gramos !== undefined ? "g" : "p");
          if(vistos[k]) return; vistos[k] = 1; out.push({ item:it, fecha:f });
        });
      });
    }
    return out;
  }
  function panelRecientes(alAnadir){
    var box = document.createElement("div"), l = listaRecientes(25);
    if(!l.length){ box.innerHTML = '<div class="estado">Todavía no hay alimentos recientes. Cuando anotes comidas, aquí aparecerán para repetirlos con un toque.</div>'; return box; }
    l.forEach(function(e){
      var it = e.item, fila = document.createElement("div"); fila.className = "rec-fila";
      var cant = it.gramos !== undefined ? it.gramos + " g" : (it.porciones + " porc.");
      fila.innerHTML = '<div><b>' + esc(it.nombre) + "</b><small>" + esc(cant) + " · " + Math.round(it.kcal || 0) + " kcal · " + esc(fechaCorta(e.fecha)) + '</small></div><button type="button" class="rec-add">+ Añadir</button>';
      fila.querySelector("button").onclick = function(){ var c = clonar(it); delete c.pegadaA; alAnadir(c); };
      box.appendChild(fila);
    });
    return box;
  }

  window.NutExtra = { barraCopiar:barraCopiar, renderFaltaHoy:renderFaltaHoy, panelEscribir:panelEscribir, etiqueta:etiqueta, panelRecientes:panelRecientes, aviso:aviso };
  try{ render(); }catch(e){}
})();
