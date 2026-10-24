// motor-busqueda.js — motor de búsqueda de alimentos (BEDCA + AESAN). Sin IA ni llamadas a internet.
// Lo usan la pestaña «Buscar» (buscar.js) y el buscador de cada comida (nutricion.js, vía window.BuscadorBase).
// Qué hace, en orden:
//  1) Búsqueda normal: cada palabra que escribes debe aparecer al principio de alguna palabra del nombre.
//     Ayuda con sinónimos (papa = patata…), abreviaturas de AESAN (chclt = chocolate…) y quita palabras sueltas como «con» o «de».
//  2) Solo si no sale nada: corrige errores al escribir («yogurt», «tomte») comparando con las palabras que existen en las bases.
//  3) Solo si sigue sin salir nada: muestra los resultados de cada palabra por separado («pollo con arroz» → pollo, arroz).
//  Los alimentos que ya comes (frecuentes) suben al principio, y las filas repetidas de AESAN (mismo producto, otro código) se ocultan.
(function(root){
  "use strict";

  var PARASITAS = { con:1, de:1, del:1, y:1, e:1, en:1, al:1, a:1, la:1, el:1, lo:1, los:1, las:1, un:1, una:1, unos:1, unas:1, para:1, por:1 };

  // Sinónimos en los dos sentidos (palabras sin tildes y en singular). El usuario puede añadir los suyos (setUsuario).
  var GRUPOS = [
    ["patata","papa"], ["judia","alubia","frijol","habichuela"], ["platano","banana","banano"], ["yogur","yogurt","yoghurt","yogourt"],
    ["tomate","jitomate"], ["aguacate","palta"], ["fresa","frutilla"], ["melocoton","durazno"], ["albaricoque","damasco"],
    ["cacahuete","cacahuate","mani"], ["maiz","choclo","elote"], ["guisante","arveja","chicharo"], ["calabacin","zucchini"],
    ["calabaza","zapallo","auyama"], ["pimiento","morron"], ["zumo","jugo"], ["gamba","camaron"], ["ternera","vacuno","res"],
    ["cerdo","chancho","puerco"], ["galleta","galletita"], ["refresco","gaseosa"], ["champinon","seta","hongo"], ["col","repollo"],
    ["sandia","patilla"], ["tostada","tostado"], ["mejillon","choro"], ["boniato","batata","camote"], ["cangrejo","jaiba"], ["cacao","cocoa"]
  ];
  // Un solo sentido: lo que escribes → lo que se busca (en España «manteca» es grasa de cerdo, por eso «mantequilla» NO busca «manteca»).
  var UN_SENTIDO = { manteca:["mantequilla"] };

  // Abreviaturas que usa la base de supermercados (AESAN). Lo que escribes → comienzos de palabra abreviados que también se buscan.
  var ABREV = {
    chocolate:["chclt","chocoltn","choclt","chocolat"], azucar:["azucr","azcr","azc"], cubierto:["cbrt"], blanco:["blnc"], negro:["ngr"],
    naranja:["nrnj","narnj"], leche:["lch","lech"], limon:["lmon"], integral:["intgrl"], arroz:["arrz"], trigo:["trg"], barrita:["brrt"],
    fruta:["frt"], avena:["avn"], refresco:["refresc","rfrscnt"], vitaminado:["vtmnd"]
  };

  var estadoVoc = { gen:null, sup:null, mapa:null };
  var sinUsuario = [];

  function norm(s){ return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function singular(t){ return (t.length > 3 && t.charAt(t.length - 1) === "s") ? t.slice(0, -1) : t; }
  function sinPlural(t){ return singular(norm(t)); }

  // ---------- sinónimos ----------
  function mapaSinonimos(){
    var m = {};
    function unir(lista){
      var pal = lista.map(sinPlural).filter(Boolean);
      pal.forEach(function(a){ (m[a] = m[a] || {}); pal.forEach(function(b){ if(b !== a) m[a][b] = 1; }); });
    }
    GRUPOS.forEach(unir);
    sinUsuario.forEach(unir);
    Object.keys(UN_SENTIDO).forEach(function(k){ var a = sinPlural(k); m[a] = m[a] || {}; UN_SENTIDO[k].forEach(function(b){ m[a][sinPlural(b)] = 1; }); });
    return m;
  }
  var MAPA_SIN = mapaSinonimos();
  function setUsuario(lista){
    sinUsuario = [];
    (lista || []).forEach(function(par){ if(Array.isArray(par) && par.filter(Boolean).length >= 2) sinUsuario.push(par); });
    MAPA_SIN = mapaSinonimos();
  }

  // ---------- grupos de palabras ----------
  // Un «grupo» es una palabra que escribe el usuario con todas las formas que cuentan como acierto:
  //   p  = lo que escribió (acierta por comienzo de palabra, así «yogu» ya encuentra «yogur»)
  //   ex = palabras completas equivalentes (sinónimos o correcciones)    ab = abreviaturas por comienzo de palabra
  function nuevoGrupo(palabra){
    var p = singular(palabra), g = { p:p, orig:palabra, ex:[], ab:[], extraP:[], exacto:false };
    if(/(on|or|er|ar|ur|al|ol)es$/.test(palabra) && palabra.length > 5) g.extraP.push(palabra.slice(0, -2)); // limones → limon
    var sin = MAPA_SIN[p];
    if(sin){ g.exacto = true; Object.keys(sin).forEach(function(s){ g.ex.push(s); }); } // «papa» no debe encontrar «papaya»: con sinónimos se exige la palabra completa
    var base = p.replace(/(es|s)$/, "");
    var ab = ABREV[p] || ABREV[base]; if(ab) g.ab = ab.slice();
    return g;
  }
  // ¿acierta el grupo en este nombre? (h = " palabra palabra palabra " ya normalizado). Devuelve la posición del acierto o -1.
  function acierta(h, g){
    var k, i, j, f;
    if(g.exacto){
      k = h.indexOf(" " + g.p + " "); if(k < 0) k = h.indexOf(" " + g.p + "s "); if(k < 0) k = h.indexOf(" " + g.p + "es ");
    } else k = h.indexOf(" " + g.p);
    if(k >= 0) return k;
    for(i = 0; i < g.extraP.length; i++){ k = h.indexOf(" " + g.extraP[i]); if(k >= 0) return k; }
    for(i = 0; i < g.ex.length; i++){
      f = g.ex[i];
      k = h.indexOf(" " + f + " "); if(k < 0) k = h.indexOf(" " + f + "s "); if(k < 0) k = h.indexOf(" " + f + "es ");
      if(k >= 0) return k;
    }
    for(j = 0; j < g.ab.length; j++){ k = h.indexOf(" " + g.ab[j]); if(k >= 0) return k; }
    return -1;
  }

  // ---------- recorrer una lista ----------
  function firma(p){ return p.nombre.toLowerCase() + "|" + p.kcal100 + "|" + p.grasa100 + "|" + p.carbh100 + "|" + p.prot100; }
  function buscarLista(lista, grupos, filtro, fr, dedup){
    var out = [], vistos = dedup ? Object.create(null) : null;
    for(var i = 0; i < lista.length; i++){
      var p = lista[i];
      if(filtro && !filtro(p)) continue;
      var h = p._h, ok = true, empieza = false;
      for(var j = 0; j < grupos.length; j++){
        var k = acierta(h, grupos[j]);
        if(k < 0){ ok = false; break; }
        if(j === 0 && k === 0) empieza = true;
      }
      if(!ok) continue;
      if(dedup){ var f = firma(p); if(vistos[f]) continue; vistos[f] = 1; }
      var sc = (empieza ? 0 : 100) + p.nombre.length;
      if(fr){ var v = fr[(p.code || (p.nombre + "|" + (p.marca || ""))).toLowerCase()]; if(v) sc -= 400 + 20 * Math.min(v, 10); }
      out.push({ p:p, sc:sc });
    }
    out.sort(function(a, b){ return a.sc - b.sc; });
    return out.map(function(x){ return x.p; });
  }
  function existe(listas, grupo){
    for(var l = 0; l < listas.length; l++){
      var lista = listas[l];
      for(var i = 0; i < lista.length; i++) if(acierta(lista[i]._h, grupo) >= 0) return true;
    }
    return false;
  }

  // ---------- corrección de errores al escribir ----------
  function vocabulario(gen, sup){
    if(estadoVoc.gen === gen && estadoVoc.sup === sup && estadoVoc.mapa) return estadoVoc.mapa;
    var m = Object.create(null);
    [gen, sup].forEach(function(lista){
      for(var i = 0; i < lista.length; i++){
        var pal = lista[i]._h.split(" ");
        for(var j = 0; j < pal.length; j++){ var w = pal[j]; if(w.length >= 3 && !/^\d+$/.test(w)) m[w] = (m[w] || 0) + 1; }
      }
    });
    estadoVoc = { gen:gen, sup:sup, mapa:m };
    return m;
  }
  // Distancia entre dos palabras: cada letra que sobra, falta, cambia o se intercambia con la vecina cuenta 1.
  function distancia(a, b){
    var la = a.length, lb = b.length, i, j, d = [];
    for(i = 0; i <= la; i++){ d[i] = [i]; }
    for(j = 1; j <= lb; j++) d[0][j] = j;
    for(i = 1; i <= la; i++) for(j = 1; j <= lb; j++){
      var c = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if(i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[la][lb];
  }
  function parecidas(voc, t){
    if(t.length < 4) return [];
    var maxd = t.length >= 8 ? 2 : 1, mejor = 99, c = [];
    for(var w in voc){
      if(Math.abs(w.length - t.length) > maxd) continue;
      var d = distancia(w, t);
      if(d > maxd) continue;
      if(d < mejor){ mejor = d; c = []; }
      if(d === mejor) c.push({ w:w, n:voc[w] });
    }
    c.sort(function(a, b){ return b.n - a.n; });
    return c.slice(0, 3).map(function(x){ return x.w; });
  }

  // ---------- punto de entrada ----------
  // o = { gen, sup, texto, tienda, filtroSuper, fr }
  // Devuelve { gen:[], sup:[], nota:"", partes:null | [{t, gen, sup}] }
  function buscar(o){
    var palabras = norm(o.texto).split(" ").filter(Boolean);
    var utiles = palabras.filter(function(w){ return !PARASITAS[w]; });
    if(!utiles.length) utiles = palabras;
    var vacio = { gen:[], sup:[], nota:"", partes:null };
    if(!utiles.length) return vacio;
    var grupos = utiles.map(nuevoGrupo);
    function correr(gs){
      return { gen: o.tienda ? [] : buscarLista(o.gen, gs, null, o.fr, false), sup: buscarLista(o.sup, gs, o.filtroSuper || null, o.fr, true) };
    }
    var r = correr(grupos);
    if(r.gen.length || r.sup.length){
      // Plato de varias palabras sin ningún alimento genérico que lo contenga entero («pollo con arroz»): además se ofrece cada palabra por separado.
      var extra = null;
      if(grupos.length > 1 && !r.gen.length && !o.tienda){
        extra = [];
        grupos.forEach(function(g){ var x = correr([g]); if(x.gen.length) extra.push({ t:g.orig, gen:x.gen.slice(0, 12), sup:[], totGen:x.gen.length, totSup:0 }); });
        if(extra.length < 2) extra = null;
      }
      return { gen:r.gen, sup:r.sup, nota:"", partes:extra, partesAdemas:!!extra };
    }

    // 2) palabras que no existen en ninguna parte → buscar parecidas
    var listas = [o.gen, o.sup], desconocidas = grupos.filter(function(g){ return !existe(listas, g); }), cambios = [];
    if(desconocidas.length){
      var voc = vocabulario(o.gen, o.sup);
      desconocidas.forEach(function(g){
        var cs = parecidas(voc, g.p);
        if(cs.length){ g.ex = g.ex.concat(cs); cambios.push([g.orig, cs[0]]); }
      });
      if(cambios.length){
        var r2 = correr(grupos);
        if(r2.gen.length || r2.sup.length){
          return { gen:r2.gen, sup:r2.sup, partes:null,
            nota:"Mostrando resultados para " + cambios.map(function(c){ return "«" + c[1] + "»"; }).join(" y ") + " (escribiste " + cambios.map(function(c){ return "«" + c[0] + "»"; }).join(" y ") + ")." };
        }
      }
    }
    // 3) ninguna combinación: resultados de cada palabra por separado
    if(grupos.length > 1){
      var partes = [];
      grupos.forEach(function(g){
        var x = correr([g]);
        if(x.gen.length || x.sup.length) partes.push({ t:g.orig, gen:x.gen.slice(0, 12), sup:x.sup.slice(0, 6), totGen:x.gen.length, totSup:x.sup.length });
      });
      if(partes.length) return { gen:[], sup:[], partes:partes,
        nota:"No hay ningún alimento con todas esas palabras juntas. Te enseño cada una por separado: añade cada alimento con su cantidad." };
    }
    return vacio;
  }

  root.MotorBusqueda = { buscar:buscar, setUsuario:setUsuario, norm:norm, distancia:distancia, _GRUPOS:GRUPOS };
})(typeof window !== "undefined" ? window : globalThis);
