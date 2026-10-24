// analisis.js — pestaña «Análisis» de Nutrición: micronutrientes estimados con IA, raciones de omega 3 y colágeno,
// prioridades según la última analítica leída, y buscador de alimentos por nutriente.
// Usa globals de nutricion.js: estado, perfilActivo, mostrarPestana. Todo lo estimado es APROXIMADO.
(function(){
"use strict";

// Nutrientes con cifra. limite:true → la meta es un tope, no un mínimo.
const NUT = [
  { id:"c",   n:"Calcio",       u:"mg", meta:1000 },
  { id:"d",   n:"Vitamina D",   u:"µg", meta:15 },
  { id:"fe",  n:"Hierro",       u:"mg", meta:11 },
  { id:"vc",  n:"Vitamina C",   u:"mg", meta:100 },
  { id:"b12", n:"Vitamina B12", u:"µg", meta:4 },
  { id:"mg",  n:"Magnesio",     u:"mg", meta:320 },
  { id:"k",   n:"Potasio",      u:"mg", meta:3500 },
  { id:"fib", n:"Fibra",        u:"g",  meta:25 },
  { id:"na",  n:"Sodio",        u:"mg", meta:2000, limite:true }
];
// Nutrientes del explorador «Alimentos con…» (datos reales de BEDCA). meta = referencia habitual de un adulto, editable. lim:true → es un tope.
const EXP = [
  { id:"o3",  n:"Omega 3 (EPA+DHA)", c:"Omega 3", u:"g",  meta:0.25 }, { id:"ala", n:"Omega 3 vegetal (ALA)", c:"ALA", u:"g", meta:1.1 },
  { id:"c", n:"Calcio", c:"Calcio", u:"mg", meta:1000 }, { id:"fe", n:"Hierro", c:"Hierro", u:"mg", meta:11 }, { id:"d", n:"Vitamina D", c:"Vit. D", u:"µg", meta:15 },
  { id:"b12", n:"Vitamina B12", c:"B12", u:"µg", meta:4 }, { id:"vc", n:"Vitamina C", c:"Vit. C", u:"mg", meta:100 }, { id:"mg", n:"Magnesio", c:"Magnesio", u:"mg", meta:320 },
  { id:"k", n:"Potasio", c:"Potasio", u:"mg", meta:3500 }, { id:"fib", n:"Fibra", c:"Fibra", u:"g", meta:25 }, { id:"zn", n:"Zinc", c:"Zinc", u:"mg", meta:10 },
  { id:"se", n:"Selenio", c:"Selenio", u:"µg", meta:55 }, { id:"i", n:"Yodo", c:"Yodo", u:"µg", meta:150 }, { id:"p", n:"Fósforo", c:"Fósforo", u:"mg", meta:700 },
  { id:"va", n:"Vitamina A", c:"Vit. A", u:"µg", meta:800 }, { id:"ve", n:"Vitamina E", c:"Vit. E", u:"mg", meta:12 }, { id:"b6", n:"Vitamina B6", c:"B6", u:"mg", meta:1.5 },
  { id:"fol", n:"Folato", c:"Folato", u:"µg", meta:330 }, { id:"tia", n:"Tiamina (B1)", c:"B1", u:"mg", meta:1 }, { id:"rib", n:"Riboflavina (B2)", c:"B2", u:"mg", meta:1.6 },
  { id:"nia", n:"Niacina", c:"Niacina", u:"mg", meta:15 }, { id:"cu", n:"Cobre", c:"Cobre", u:"mg", meta:1.3 }, { id:"prot", n:"Proteína", c:"Proteína", u:"g", meta:60 },
  { id:"na", n:"Sodio", c:"Sodio", u:"mg", meta:2000, lim:true }, { id:"sat", n:"Grasa saturada", c:"Grasa sat.", u:"g", meta:22, lim:true }
];
const EXTRA = EXP.filter(x => !["c","d","fe","vc","b12","mg","k","fib","na"].includes(x.id));
const clave = x => x.k || (x.id === "prot" ? "prot" : x.id);
const COMIDAS = ["desayuno","almuerzo","cena","snacks"];
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DIAS = ["L","M","X","J","V","S","D"];
const K_CACHE = "nutriNutrientesV1";

// ---------- Lista propia para el buscador (por 100 g, valores APROXIMADOS) ----------
const ALIM = {
  o3:  { n:"Omega 3", u:"g EPA+DHA", l:[["Caballa",2.5],["Arenque",1.7],["Salmón",2],["Sardina",1.4],["Boquerón / anchoa",1.4],["Atún rojo fresco",1],["Trucha",0.8],["Mejillones",0.5],["Semillas de lino (ALA vegetal)",22,"g ALA"],["Semillas de chía (ALA vegetal)",17.5,"g ALA"],["Nueces (ALA vegetal)",9,"g ALA"]] },
  c:   { n:"Calcio", u:"mg", l:[["Queso parmesano",1180],["Semillas de sésamo",975],["Queso manchego curado",850],["Sardinas en lata (con espina)",380],["Tofu firme con calcio",350],["Almendras",265],["Higos secos",170],["Col rizada (kale)",150],["Yogur natural",125],["Leche",120]] },
  fe:  { n:"Hierro", u:"mg", l:[["Almejas",14],["Cacao puro en polvo",14],["Hígado de pollo",9],["Semillas de calabaza",8.8],["Espinacas cocidas",3.6],["Lentejas cocidas",3.3],["Garbanzos cocidos",2.9],["Ternera",2.6]] },
  d:   { n:"Vitamina D", u:"µg", l:[["Arenque",22],["Salmón",11],["Caballa",8],["Sardinas en lata",5],["Setas expuestas a luz UV (varía)",5],["Yema de huevo",5.4],["Huevo entero",1.9]] },
  b12: { n:"Vitamina B12", u:"µg", l:[["Hígado de ternera",65],["Almejas",50],["Mejillones",20],["Sardina",9],["Caballa",8],["Salmón",4],["Ternera",2.5],["Huevo",1.2]] },
  vc:  { n:"Vitamina C", u:"mg", l:[["Guayaba",230],["Pimiento rojo crudo",150],["Perejil fresco",140],["Kiwi",90],["Coles de Bruselas",85],["Brócoli crudo",85],["Fresas",60],["Naranja",50]] },
  mg:  { n:"Magnesio", u:"mg", l:[["Pipas de calabaza",530],["Almendras",270],["Anacardos",260],["Chocolate negro 70 %",200],["Cacahuetes",170],["Avena",135],["Espinacas cocidas",87]] },
  k:   { n:"Potasio", u:"mg", l:[["Albaricoque seco",1300],["Dátiles",650],["Aguacate",490],["Espinacas cocidas",470],["Patata cocida",410],["Alubias cocidas",400],["Salmón",380],["Plátano",360],["Kiwi",310]] },
  fib: { n:"Fibra", u:"g", l:[["Semillas de chía",34],["Semillas de lino",27],["Almendras",12],["Avena",10],["Lentejas cocidas",8],["Pan integral",7],["Garbanzos cocidos",7],["Aguacate",6.7],["Frambuesas",6.5]] },
  col: { n:"Colágeno", u:"", l:[["Caldo de huesos casero"],["Gelatina neutra sin sabor"],["Piel de pollo o de pescado"],["Manitas de cerdo"],["Rabo de toro"],["Jarrete / morcillo (cocción larga)"],["Carrillera"]] }
};
const CHIPS = [["o3","Omega 3"],["col","Colágeno"],["c","Calcio"],["fe","Hierro"],["d","Vit. D"],["b12","B12"],["vc","Vit. C"],["mg","Magnesio"],["k","Potasio"],["fib","Fibra"]];

// ---------- Utilidades ----------
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const nf = n => String(Math.round(n * 10) / 10).replace(".", ",");
const num = v => { const n = Number(String(v).replace(",", ".")); return isFinite(n) && n >= 0 && n < 100000 ? n : 0; };
const lj = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
const sj = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const hoy = () => iso(new Date());
const suma = (f, n) => { const d = new Date(f + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const lunesDe = f => suma(f, -((new Date(f + "T00:00:00").getDay() + 6) % 7));
let semana = lunesDe(hoy()), chip = null, ocupado = false, msgEst = "";
let exG = 0, exQ = "", exEsp = false, exModo = "alim", exVer = 30, exOrden = "racion";

function metas(){
  const m = lj("nutriMetasMicroV1_" + perfilActivo, {}), o = {};
  NUT.forEach(x => { o[x.id] = m[x.id] > 0 ? m[x.id] : x.meta; });
  EXTRA.forEach(x => { o[x.id] = m[x.id] > 0 ? m[x.id] : x.meta; });
  o.rAzul = typeof m.rAzul === "number" && m.rAzul >= 0 ? m.rAzul : 2;
  o.rCol = typeof m.rCol === "number" && m.rCol >= 0 ? m.rCol : 3;
  return o;
}
const cache = () => lj(K_CACHE, {});

// Valores por 100 g de un alimento: si existe en BEDCA con ese nombre, los datos reales; lo que falte allí (sin dato) se completa con la estimación de IA si la hay.
function estimacion(nombre, C){
  const nk = norm(nombre), ec = C[nk], eb = window.NutBedca && NutBedca.estado().listo ? NutBedca.comoEstimacion(nombre, NUT.map(x => x.id)) : null;
  if(!eb) return ec;
  NUT.forEach(x => { if(eb._sd[x.id] && ec && !ec.bedca && ec[x.id] != null){ eb[x.id] = ec[x.id]; delete eb._sd[x.id]; } });
  if(!eb.cat && ec && ec.cat) eb.cat = ec.cat;
  if(ec && ec.gu) eb.gu = Object.assign({}, ec.gu);
  return eb;
}
const PESCADO = /salm[oó]n|at[uú]n|sardina|caballa|boquer|anchoa|bonito|trucha|arenque|merluza|bacalao|mejill|pulpo|calamar|gamba|langostino|dorada|lubina|rape|lenguado|pescadilla|jurel|pez espada|emperador|mero|sepia|almeja|berberecho|ostra|cangrejo|chipir/i;
function gramosItem(it, e){
  if(it.gramos > 0) return it.gramos;
  const u = norm(it.unidad || "unidad"), q = +it.cantidad > 0 ? +it.cantidad : 1;
  if(u === "ml") return q;
  if(u === "l") return q * 1000;
  const gu = e && e.gu && e.gu[u];
  return gu > 0 ? q * gu : 0;
}

// ---------- Datos de la semana ----------
function datosSemana(lun, C){
  const dias = [], pend = new Map(), fuentes = {}, sinDato = {}, sdO3 = new Set(), B = window.NutBedca && NutBedca.estado().listo;
  NUT.forEach(x => { fuentes[x.id] = {}; sinDato[x.id] = new Set(); });
  const est = (typeof estado !== "undefined" && estado && estado.dias) || {};
  for(let i = 0; i < 7; i++){
    const f = suma(lun, i), d = est[f], r = { f, n: 0, sin: 0, v: {}, azul: 0, col: 0, veg: 0, nb: 0, o3: 0, ala: 0 };
    NUT.forEach(x => { r.v[x.id] = 0; });
    if(d && d.comidas) COMIDAS.forEach(cid => (d.comidas[cid] || []).forEach(it => {
      if(!it || !it.nombre) return;
      r.n++;
      const nk = norm(it.nombre), e = estimacion(it.nombre, C), g = gramosItem(it, e), eb = B && NutBedca.porNombre(it.nombre);
      if(eb){ r.nb++; if(g > 0){ const a = NutBedca.o3(eb), b = NutBedca.val(eb, "ala"); if(a != null) r.o3 += a * g / 100; else if(PESCADO.test(it.nombre)) sdO3.add(it.nombre); if(b != null) r.ala += b * g / 100; } }
      else if(g > 0 && B && PESCADO.test(it.nombre)) sdO3.add(it.nombre);
      if(!e || !(g > 0)){ r.sin++; pend.set(nk + "|" + norm(it.unidad || "unidad"), { n: it.nombre, u: it.unidad || "unidad" }); }
      if(!e) return;
      if(e.cat === "azul") r.azul += g > 0 ? g / 125 : 1;
      else if(e.cat === "colageno") r.col += 1;
      else if(e.cat === "vegetal") r.veg += 1;
      if(!(g > 0)) return;
      NUT.forEach(x => { if(e._sd && e._sd[x.id]){ sinDato[x.id].add(it.nombre); return; } const v = (e[x.id] || 0) * g / 100; r.v[x.id] += v; fuentes[x.id][it.nombre] = (fuentes[x.id][it.nombre] || 0) + v; });
    }));
    dias.push(r);
  }
  return { dias, pend: Array.from(pend.values()), fuentes, sinDato, sdO3: Array.from(sdO3) };
}

// ---------- Analítica: prioridades ----------
function estadoVal(x){
  if(x.v != null){ if(x.max != null && x.v > x.max) return "alto"; if(x.min != null && x.v < x.min) return "bajo"; if(x.min != null || x.max != null) return "ok"; }
  return x.e === "alto" || x.e === "bajo" ? x.e : "ok";
}
function prioridades(){
  const l = (lj("saludPruebasV1_" + perfilActivo, []) || []).filter(p => p && p.tipo === "analitica" && Array.isArray(p.valores) && p.valores.length).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  const r = { prio: {}, noSubir: {}, notas: [], fecha: null };
  if(!l.length) return r;
  const a = l[l.length - 1]; r.fecha = a.fecha;
  const FUERTES = { d: /vitamina d|25 oh|25 hidroxi|calcifediol/, b12: /b12|cobalamina/, fe: /ferritina|^hierro|hierro serico/ };
  const SANGRE = { c: /^calcio/, mg: /^magnesio/, k: /^potasio/, na: /^sodio/ };
  a.valores.forEach(x => {
    const e = estadoVal(x); if(e !== "alto" && e !== "bajo") return;
    const nm = norm(x.k || x.n);
    Object.keys(FUERTES).forEach(id => { if(FUERTES[id].test(nm)){ if(e === "bajo") r.prio[id] = x.n; else r.noSubir[id] = x.n; } });
    Object.keys(SANGRE).forEach(id => { if(SANGRE[id].test(nm)) r.notas.push(x.n + (e === "alto" ? " alto" : " bajo")); });
  });
  return r;
}

// ---------- Estimación con IA ----------
function promptEst(lote){
  return "Eres nutricionista. Para cada alimento de la lista estima los nutrientes por 100 g de alimento tal como se consume (si el nombre indica cocinado, cocinado; si es un plato preparado, estima el plato). " +
    "Devuelve SOLO un array JSON, sin texto adicional, con un objeto por alimento: " +
    '{"i":índice de la lista,"c":calcio mg,"d":vitamina D µg,"fe":hierro mg,"vc":vitamina C mg,"b12":vitamina B12 µg,"mg":magnesio mg,"k":potasio mg,"fib":fibra g,"na":sodio mg,"cat":"azul"|"vegetal"|"colageno"|"","gu":gramos que pesa 1 <unidad> de ese alimento (solo si la unidad no es g, kg ni ml; si no, null)}. ' +
    "cat: azul = pescado azul rico en omega 3 (salmón, sardina, caballa, boquerón, atún fresco, arenque…); vegetal = fuente vegetal de omega 3 (nueces, lino, chía, cáñamo); colageno = fuente de colágeno (caldo de huesos, gelatina, piel de pollo o pescado, manitas, rabo, jarrete, carrillera…); si no aplica, cadena vacía. " +
    "Usa 0 si el nutriente es despreciable. Números, no texto.\n\nALIMENTOS:\n" + lote.map((x, i) => i + ". " + x.n + " | unidad: " + x.u).join("\n");
}
async function estimar(lista){
  const C = cache();
  for(let i = 0; i < lista.length; i += 30){
    const lote = lista.slice(i, i + 30);
    msgEst = "Estimando " + (i + 1) + "–" + (i + lote.length) + " de " + lista.length + "…"; const el = $("anaEst"); if(el) el.textContent = msgEst;
    const data = await IAClaves.gemini({ contents: [{ parts: [{ text: promptEst(lote) }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } });
    const ps = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const t = ps.map(x => x.text || "").join("").replace(/```json|```/g, "").trim(), a = t.indexOf("["), b = t.lastIndexOf("]");
    let arr = null; try{ arr = JSON.parse(t.slice(a, b + 1)); }catch(e){}
    if(!Array.isArray(arr)) throw new Error("La IA no devolvió un resultado legible. Prueba otra vez.");
    arr.forEach(o => {
      const it = o && lote[o.i]; if(!it) return;
      const nk = norm(it.n), prev = C[nk] || { gu: {} };
      const e = { cat: ["azul", "vegetal", "colageno"].includes(o.cat) ? o.cat : "", gu: Object.assign({}, prev.gu) };
      NUT.forEach(x => { e[x.id] = num(o[x.id]); });
      const gu = num(o.gu); if(gu > 0) e.gu[norm(it.u)] = gu;
      C[nk] = e;
    });
    sj(K_CACHE, C);
  }
}

// ---------- Pintar ----------
function barra(pct, limite){
  const w = Math.max(0, Math.min(100, pct)), col = limite ? (pct > 100 ? "var(--warn)" : "var(--accent)") : (pct < 70 ? "var(--warn)" : pct < 100 ? "#e0b13a" : "var(--accent)");
  return '<div style="height:8px;background:var(--panel-alt);border-radius:6px;overflow:hidden;margin:5px 0"><div style="height:100%;width:' + w + '%;background:' + col + '"></div></div>';
}
function top3(fu){ return Object.keys(fu).sort((a, b) => fu[b] - fu[a]).slice(0, 3).filter(k => fu[k] > 0); }
function textoEstado(x, pct){
  if(x.limite) return pct > 100 ? "por encima del límite" : "dentro del límite";
  return pct < 70 ? "bajo" : pct < 100 ? "justo" : "bien";
}
function etiquetaSemana(l){ const a = new Date(l + "T00:00:00"), b = new Date(suma(l, 6) + "T00:00:00"); return a.getDate() + " " + MESES[a.getMonth()] + " – " + b.getDate() + " " + MESES[b.getMonth()] + " " + b.getFullYear(); }
function puntosDias(dias, k, umbral){ return '<div style="display:flex;gap:6px;margin-top:4px">' + dias.map((d, i) => '<span style="text-align:center;font-size:0.72rem;color:var(--muted)"><span style="display:block;width:22px;height:22px;line-height:22px;border-radius:50%;border:1px solid var(--line);' + (d[k] > umbral ? "background:var(--accent);color:#fff;border-color:var(--accent)" : "") + '">' + (d[k] > umbral ? "✓" : "") + "</span>" + DIAS[i] + "</span>").join("") + "</div>"; }

function sugerencias(bajos, pr){
  const out = [];
  bajos.forEach(x => {
    if(pr.noSubir[x.id]) return;
    const real = bedcaListo() ? ranking(defExp(x.id), false, "racion").out.slice(0, 4).map(r => [r.e.nombre + " ≈" + r.e.rac.g + " g", nf(r.r)]) : null, al = ALIM[x.id];
    if(!real && !al) return;
    out.push('<li><b>' + esc(x.n) + (pr.prio[x.id] ? " ⭐" : "") + ":</b> " + (real || al.l.slice(0, 4)).map(a => esc(a[0]) + " (" + a[1] + ")").join(", ") + ' <a href="#" data-act="chip" data-id="' + x.id + '" style="color:var(--accent)">ver más</a></li>');
  });
  return out.length ? '<ul style="margin:6px 0 0 18px;padding:0;font-size:0.85rem">' + out.join("") + '</ul><div class="pie" style="font-size:0.74rem;color:var(--muted);margin-top:4px">' + (bedcaListo() ? "Valores de BEDCA por ración típica aproximada (sin especias)." : "Valores aproximados por 100 g (lista hecha a mano: no se pudo cargar BEDCA).") + "</div>" : "";
}
const bedcaListo = () => !!(window.NutBedca && NutBedca.estado().listo);
const defExp = id => EXP.find(x => x.id === id);
const valorExp = (e, x) => x.id === "o3" ? NutBedca.o3(e) : NutBedca.val(e, clave(x));
const fmt = (v, u) => (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100).toString().replace(".", ",") + " " + u;
// Ranking de alimentos por nutriente (por 100 g). Los que no tienen el dato NO aparecen (nunca se cuentan como 0): solo se cuentan aparte.
function ranking(x, conEsp, orden){
  const out = []; let sin = 0; const q = norm(exQ);
  NutBedca.lista().forEach(e => {
    if(!conEsp && e.peq) return;
    if(q && !(" " + norm(e.nombre) + " ").includes(" " + q) && !norm(e.nombre).includes(q)) return;
    const v = valorExp(e, x); if(v == null){ sin++; return; } out.push({ e, v, r: v * e.rac.g / 100 });
  });
  const por = (orden || exOrden) === "100" ? "v" : "r";
  out.sort((a, b) => b[por] - a[por]); return { out, sin };
}
function nutReceta(r, x){
  if(!Array.isArray(r.ingredientes) || !r.ingredientes.length || typeof r.ingredientes[0] !== "object") return null;
  let tot = 0, con = 0; const C = cache(), esNut = NUT.some(n => n.id === x.id);
  r.ingredientes.forEach(i => {
    const g = num(i.gramos), eb = NutBedca.porNombre(i.nombre); let v = eb ? valorExp(eb, x) : null;
    if(v == null && !eb && esNut){ const ec = C[norm(i.nombre)]; if(ec && ec[x.id] != null) v = ec[x.id]; }
    if(v != null && g > 0){ tot += v * g / 100; con++; }
  });
  return { v: tot / (num(r.porciones) || 1), con, n: r.ingredientes.length };
}
function filasExplorador(){
  const x = defExp(chip), M = metas(), meta = M[x.id] || x.meta, hay = '';
  let h = "";
  if(exModo === "rec"){
    const rs = (typeof recetas !== "undefined" ? recetas : []) || [], q = norm(exQ); let sinDesglose = 0; const l = [];
    rs.forEach(r => { if(q && !norm(r.nombre).includes(q)) return; const c = nutReceta(r, x); if(!c){ sinDesglose++; return; } if(c.con > 0) l.push({ r, c }); });
    l.sort((a, b) => b.c.v - a.c.v);
    if(!l.length) return '<div style="color:var(--muted);font-size:0.84rem;padding:8px 0">Ninguna receta tuya tiene datos de este nutriente.' + (sinDesglose ? " " + sinDesglose + " recetas no se pueden calcular porque no guardan los ingredientes con gramos (las de IA o de internet)." : "") + "</div>";
    h += l.slice(0, exVer).map(o => { const pct = meta ? o.c.v / meta * 100 : 0;
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span>' + esc(o.r.nombre) + '<small style="display:block;color:var(--muted)">dato en ' + o.c.con + " de " + o.c.n + ' ingredientes</small></span><span style="text-align:right"><b>' + fmt(o.c.v, x.u) + '</b> por ración' + (meta ? '<small style="display:block;color:var(--muted)">' + Math.round(pct) + " % " + (x.lim ? "del límite" : "del objetivo diario") + "</small>" : "") + "</span></div>"; }).join("");
    if(l.length > exVer) h += '<button type="button" data-act="mas" style="margin-top:8px;padding:7px 12px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer">Ver más</button>';
    if(sinDesglose) h += '<div style="font-size:0.76rem;color:var(--muted);margin-top:6px">' + sinDesglose + " receta(s) sin ingredientes con gramos no entran en la lista.</div>";
    return h;
  }
  const R = ranking(x, exEsp), g = exG > 0 ? exG : 0;
  if(!R.out.length) return '<div style="color:var(--muted);font-size:0.84rem;padding:8px 0">No hay alimentos con ese filtro.</div>';
  const lin = (et, cant, pct, fuerte) => '<div style="' + (fuerte ? "" : "color:var(--muted);") + '"><small>' + et + '</small> <b>' + fmt(cant, x.u) + "</b>" + (meta ? ' <small style="color:var(--muted)">(' + Math.round(pct) + " %)</small>" : "") + "</div>";
  h += '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--muted);padding-bottom:3px;border-bottom:1px solid var(--line)"><span>Alimento</span><span>' + (x.lim ? "% del límite diario" : "% de tu objetivo diario") + "</span></div>";
  h += R.out.slice(0, exVer).map(o => { const rg = o.e.rac.g, por = o.e.rac.def ? "≈" + rg + " g" : "100 g*", para = !x.lim && o.v > 0 && meta ? meta / o.v * 100 : 0;
    let extra = "";
    if(x.id === "o3"){ const a = NutBedca.val(o.e, "epa"), b = NutBedca.val(o.e, "dha"); extra = "por 100 g: EPA " + (a == null ? "sin dato" : fmt(a, "g")) + " · DHA " + (b == null ? "sin dato" : fmt(b, "g")); }
    return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--line)"><span>' + esc(o.e.nombre) + (extra ? '<small style="display:block;color:var(--muted)">' + extra + "</small>" : "") + (para && para < 3000 ? '<small style="display:block;color:var(--muted)">objetivo diario con ≈ ' + Math.round(para) + " g</small>" : "") + '</span><span style="text-align:right;white-space:nowrap">' +
      lin("ración " + por + ":", o.r, meta ? o.r / meta * 100 : 0, exOrden === "racion") + lin("100 g:", o.v, meta ? o.v / meta * 100 : 0, exOrden === "100") + (g ? lin(g + " g:", o.v * g / 100, meta ? o.v * g / 100 / meta * 100 : 0, false) : "") + "</span></div>"; }).join("");
  if(R.out.length > exVer) h += '<button type="button" data-act="mas" style="margin-top:8px;padding:7px 12px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer">Ver más (' + (R.out.length - exVer) + ')</button>';
  h += '<div style="font-size:0.76rem;color:var(--muted);margin-top:8px">' + R.sin + " alimentos de BEDCA no tienen este dato y no aparecen (no es lo mismo que «0»). La ración es una estimación mía por tipo de alimento (aprox.); * = sin ración definida, se usan 100 g." + (x.id === "o3" ? " BEDCA solo trae EPA/DHA de unos pocos pescados." : "") + (x.id === "o3" || true ? " Alimentos emparejados con la base de la app: " + NutBedca.montaje().emparejados + " de " + NutBedca.montaje().total + "." : "") + (x.id === "ala" ? " Es el dato «18:3» de BEDCA, que en la práctica es casi todo ALA, pero no lo separa." : "") + "</div>";
  return h;
}
function buscador(pr){
  const ok = bedcaListo(), st = window.NutBedca ? NutBedca.estado() : { listo: false, error: "no cargado" };
  const botones = ok ? EXP.map(x => [x.id, x.c]).concat([["col", "Colágeno"]]) : CHIPS;
  let h = '<div class="recetas-sec" style="margin-top:12px"><h2><span>🔎 Alimentos con…</span></h2>' + (ok ? "" : '<div style="font-size:0.8rem;color:var(--warn);margin-bottom:8px">⚠️ No pude cargar los nutrientes reales de BEDCA' + (st.error ? " (" + esc(st.error) + ")" : "") + '. Se muestra una lista aproximada hecha a mano. <button type="button" data-act="reintentar" style="margin-left:6px;padding:4px 10px;border-radius:8px;border:1px solid var(--accent);background:var(--accent-soft);color:var(--accent);cursor:pointer">Reintentar</button></div>') +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' +
    botones.map(c => '<button type="button" data-act="chip" data-id="' + c[0] + '" style="padding:6px 10px;border-radius:999px;border:1px solid ' + (chip === c[0] ? "var(--accent)" : "var(--line)") + ";background:" + (chip === c[0] ? "var(--accent-soft)" : "var(--panel)") + ";color:" + (chip === c[0] ? "var(--accent)" : "var(--ink)") + ';font-size:0.8rem;cursor:pointer">' + c[1] + "</button>").join("") + "</div>";
  if(!chip) h += '<div style="font-size:0.82rem;color:var(--muted)">Elige un nutriente para ver los alimentos que más tienen' + (ok ? ", con la cantidad y el % de tu objetivo diario." : ".") + "</div>";
  if(chip && ok && chip !== "col"){
    const x = defExp(chip), id = chip === "o3" ? null : chip;
    if(id && pr.noSubir[id]) h += '<div style="color:var(--warn);font-size:0.84rem;margin-bottom:6px">⚠️ Tu última analítica tiene este valor alto (' + esc(pr.noSubir[id]) + '). Consúltalo con tu médico antes de subirlo.</div>';
    const sp = 'padding:6px 11px;border-radius:8px;border:1px solid ';
    h += '<div style="display:flex;gap:6px;margin-bottom:8px"><button type="button" data-act="modo" data-m="alim" style="' + sp + (exModo === "alim" ? "var(--accent);background:var(--accent-soft);color:var(--accent)" : "var(--line);background:var(--panel);color:var(--ink)") + ';cursor:pointer;font-size:0.82rem">🥦 Alimentos</button><button type="button" data-act="modo" data-m="rec" style="' + sp + (exModo === "rec" ? "var(--accent);background:var(--accent-soft);color:var(--accent)" : "var(--line);background:var(--panel);color:var(--ink)") + ';cursor:pointer;font-size:0.82rem">📖 Mis recetas</button></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;font-size:0.82rem"><input type="text" data-exp="q" placeholder="Filtrar por nombre (ej.: pescado)" value="' + esc(exQ) + '" style="flex:1 1 150px;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--panel-alt);color:var(--ink)">' +
      (exModo === "alim" ? '<label style="display:flex;gap:5px;align-items:center;color:var(--muted)">Ordenar por <select data-exp="orden" style="padding:7px;border-radius:8px;border:1px solid var(--line);background:var(--panel-alt);color:var(--ink)"><option value="racion"' + (exOrden === "racion" ? " selected" : "") + '>ración típica</option><option value="100"' + (exOrden === "100" ? " selected" : "") + '>100 g</option></select></label><label style="display:flex;gap:5px;align-items:center;color:var(--muted)">Otra cantidad <input type="number" data-exp="g" min="1" step="any" placeholder="opcional" value="' + (exG || "") + '" style="width:84px;padding:7px;border-radius:8px;border:1px solid var(--line);background:var(--panel-alt);color:var(--ink)"> g</label><label style="display:flex;gap:5px;align-items:center;color:var(--muted)"><input type="checkbox" data-exp="esp" ' + (exEsp ? "checked" : "") + '> incluir especias y hierbas secas</label>' : "") + '</div>' +
      '<div id="anaLista" style="font-size:0.84rem">' + filasExplorador() + '</div>' +
      '<div style="font-size:0.74rem;color:var(--muted);margin-top:6px">' + (x.id === "o3" ? "Omega 3 = EPA + DHA. " : "") + "El objetivo diario es una referencia habitual para un adulto (puedes cambiarla en «Ajustar metas»), no una recomendación personal. Datos de BEDCA (AESAN) por 100 g.</div>";
  } else if(chip && ALIM[chip] && (!ok || chip === "col")){
    const al = ALIM[chip], id = chip === "o3" ? null : chip;
    if(id && pr.noSubir[id]) h += '<div style="color:var(--warn);font-size:0.84rem;margin-bottom:6px">⚠️ Tu última analítica tiene este valor alto (' + esc(pr.noSubir[id]) + '). Consúltalo con tu médico antes de subirlo.</div>';
    h += '<div style="font-size:0.84rem">' + al.l.map(a => '<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--line)"><span>' + esc(a[0]) + '</span><b>' + (a[1] != null ? a[1] + " " + (a[2] || al.u) : "") + '</b></div>').join("") + '</div><div style="font-size:0.74rem;color:var(--muted);margin-top:6px">' + (chip === "col" ? "No existe una cantidad diaria oficial de colágeno: se trata de variedad en la dieta. " : "Por 100 g, valores aproximados que varían según especie y cocinado. ") + "</div>";
  }
  const q = lj("nutriBusquedaIAV1", {});
  h += '<div style="margin-top:10px"><div style="font-size:0.8rem;color:var(--muted);margin-bottom:4px">O pregunta en libre (usa la IA):</div><div style="display:flex;gap:6px"><input id="anaQ" type="text" placeholder="ej: alimentos con colágeno y vitamina C fáciles de comprar" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--line);background:var(--panel-alt);color:var(--ink);font-size:0.85rem"><button type="button" data-act="buscarIA" class="btn-ana" style="padding:9px 12px;border-radius:8px;border:1px solid var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:700;cursor:pointer">Buscar</button></div><div id="anaQres" style="font-size:0.85rem;white-space:pre-wrap;margin-top:8px"></div></div></div>';
  return h;
}

function render(){
  const root = $("anaRoot"); if(!root) return;
  const C = cache(), M = metas(), S = datosSemana(semana, C), pr = prioridades(), reg = S.dias.filter(d => d.n > 0), esActual = semana >= lunesDe(hoy());
  let h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px"><button type="button" data-act="prev" style="padding:6px 14px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:1rem;cursor:pointer">‹</button><b style="flex:1;text-align:center">' + etiquetaSemana(semana) + '</b><button type="button" data-act="next" ' + (esActual ? "disabled" : "") + ' style="padding:6px 14px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:1rem;cursor:pointer;' + (esActual ? "opacity:.35" : "") + '">›</button></div>';
  if(!reg.length) return void (root.innerHTML = h + '<div style="color:var(--muted);font-style:italic">No hay comidas registradas esta semana.</div>' + buscador(pr));
  h += '<div style="font-size:0.84rem;color:var(--muted);margin-bottom:8px">' + reg.length + (reg.length === 1 ? " día registrado" : " días registrados") + ' esta semana. Las medias se hacen solo sobre esos días.</div>';
  if(S.pend.length) h += '<div style="background:var(--panel);border:1px solid var(--warn);border-radius:10px;padding:10px;margin-bottom:10px;font-size:0.85rem"><b>' + S.pend.length + (S.pend.length === 1 ? " alimento" : " alimentos") + ' sin estimar.</b> Sin eso, las cifras de abajo quedan cortas. <div style="margin-top:8px"><button type="button" data-act="estimar" ' + (ocupado ? "disabled" : "") + ' style="padding:8px 12px;border-radius:8px;border:1px solid var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:700;cursor:pointer">🤖 Estimar con IA</button> <span id="anaEst" style="color:var(--muted)">' + esc(msgEst) + '</span></div></div>';
  if(reg.every(d => d.sin >= d.n)){ root.innerHTML = h + '<div style="font-size:0.84rem;color:var(--muted);margin:8px 0">Aún no hay estimaciones para estos alimentos: pulsa «Estimar con IA» para ver tus nutrientes.</div>' + buscador(pr); return; }
  // Nutrientes con cifra
  const bajos = [];
  h += '<div class="recetas-sec"><h2><span>🥗 Nutrientes (media por día)</span></h2>';
  NUT.forEach(x => {
    const med = reg.reduce((s, d) => s + d.v[x.id], 0) / reg.length, meta = M[x.id], pct = meta ? med / meta * 100 : 0, t3 = top3(S.fuentes[x.id]);
    if(!x.limite && pct < 70 && !(pr.noSubir[x.id])) bajos.push(x);
    h += '<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + x.n + (pr.prio[x.id] ? ' ⭐' : '') + (pr.noSubir[x.id] ? ' 🚫' : '') + '</b><span style="font-size:0.85rem">' + nf(med) + " / " + nf(meta) + " " + x.u + (x.limite ? " (límite)" : "") + '</span></div>' + barra(pct, x.limite) +
      '<div style="font-size:0.78rem;color:var(--muted)">' + Math.round(pct) + " % · " + textoEstado(x, pct) + (pr.prio[x.id] ? " · prioridad: " + esc(pr.prio[x.id]) + " bajo en tu analítica" : "") + (pr.noSubir[x.id] ? " · " + esc(pr.noSubir[x.id]) + " alto en tu analítica: no conviene subirlo" : "") + (t3.length ? "<br>Tus mayores fuentes: " + t3.map(k => esc(k) + " (" + nf(S.fuentes[x.id][k]) + ")").join(", ") : "") + (S.sinDato[x.id].size ? "<br>⚠️ Sin dato de " + x.n.toLowerCase() + " en BEDCA para: " + Array.from(S.sinDato[x.id]).slice(0, 3).map(esc).join(", ") + (S.sinDato[x.id].size > 3 ? " y " + (S.sinDato[x.id].size - 3) + " más" : "") + " (no se cuentan como 0, pero la cifra queda corta)." : "") + "</div></div>";
  });
  h += (pr.notas.length ? '<div style="font-size:0.8rem;color:var(--muted);margin-top:8px">🩸 En tu última analítica: ' + pr.notas.map(esc).join(", ") + ". Ese valor en sangre lo regula el cuerpo y casi nunca refleja lo que comes: coméntalo con tu médico.</div>" : "") + "</div>";
  // Raciones
  const azul = S.dias.reduce((s, d) => s + d.azul, 0), col = S.dias.reduce((s, d) => s + d.col, 0), vegDias = S.dias.filter(d => d.veg > 0).length;
  const prot = reg.reduce((s, d) => s + (((estado.dias || {})[d.f] && totalesDelDia(d.f).prot) || 0), 0) / reg.length, vc = reg.reduce((s, d) => s + d.v.vc, 0) / reg.length;
  const nreg = reg.length, mo3 = reg.reduce((s, d) => s + d.o3, 0) / nreg, mala = reg.reduce((s, d) => s + d.ala, 0) / nreg, nbTot = reg.reduce((s, d) => s + d.nb, 0), nTot = reg.reduce((s, d) => s + d.n, 0);
  const bloqueO3 = bedcaListo() ? '<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b>Omega 3 con datos de BEDCA</b> (media por día)<div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px"><span>EPA + DHA (pescado)</span><span>' + fmt(mo3, "g") + " / " + fmt(M.o3, "g") + '</span></div>' + barra(M.o3 ? mo3 / M.o3 * 100 : 0, false) +
    '<div style="display:flex;justify-content:space-between;gap:8px"><span>ALA (vegetal)</span><span>' + fmt(mala, "g") + " / " + fmt(M.ala, "g") + '</span></div>' + barra(M.ala ? mala / M.ala * 100 : 0, false) +
    '<div style="font-size:0.76rem;color:var(--muted)">' + nbTot + " de " + nTot + " alimentos registrados están en BEDCA; solo esos suman aquí." + (S.sdO3.length ? " ⚠️ Pescados/mariscos sin dato de EPA/DHA (no se cuentan como 0): " + S.sdO3.slice(0, 3).map(esc).join(", ") + (S.sdO3.length > 3 ? " y " + (S.sdO3.length - 3) + " más" : "") + "." : "") + "</div></div>" : "";
  h += '<div class="recetas-sec" style="margin-top:12px"><h2><span>🐟 Omega 3 y colágeno (por semana)</span></h2>' + bloqueO3 +
    '<div style="padding:6px 0"><b>Pescado azul:</b> ≈ ' + nf(azul) + " raciones · meta " + M.rAzul + puntosDias(S.dias, "azul", 0) + '<div style="font-size:0.78rem;color:var(--muted);margin-top:4px">' + (vegDias ? "Fuentes vegetales (nueces, lino, chía) en " + vegDias + (vegDias === 1 ? " día" : " días") + ". " : "") + 'El omega 3 vegetal (ALA) se aprovecha mucho peor que el del pescado.</div></div>' +
    '<div style="padding:6px 0;border-top:1px solid var(--line)"><b>Fuentes de colágeno:</b> ' + Math.round(col) + " · meta " + M.rCol + puntosDias(S.dias, "col", 0) + '<div style="font-size:0.78rem;color:var(--muted);margin-top:4px">Proteína media ' + Math.round(prot) + " g/día · vitamina C media " + Math.round(vc) + ' mg/día: el cuerpo fabrica su colágeno con proteína y vitamina C. Que comer colágeno mejore articulaciones o piel tiene evidencia limitada: tómalo como variedad.</div></div></div>';
  // Sugerencias
  const sug = sugerencias(bajos.sort((a, b) => (pr.prio[b.id] ? 1 : 0) - (pr.prio[a.id] ? 1 : 0)), pr);
  if(sug) h += '<div class="recetas-sec" style="margin-top:12px"><h2><span>💡 Para subir lo que va bajo</span></h2>' + sug + "</div>";
  // Consejo IA
  const g = lj("nutriAnalisisIAV1_" + perfilActivo + "|" + semana, null);
  h += '<div class="recetas-sec" style="margin-top:12px"><h2><span>🤖 Lectura de la semana</span></h2>' + (g && g.texto ? '<div style="background:var(--panel-alt);border-radius:8px;padding:10px;font-size:0.86rem;white-space:pre-wrap">' + esc(g.texto) + '</div><div style="font-size:0.74rem;color:var(--muted);margin-top:4px">Generada el ' + esc(g.fecha) + ". Orientación, no un consejo médico.</div>" : '<div style="font-size:0.84rem;color:var(--muted)">Resume la semana y propone alimentos concretos. Solo se envían cifras, sin tu nombre.</div>') +
    '<div style="margin-top:8px"><button type="button" data-act="iaSemana" ' + (ocupado ? "disabled" : "") + ' style="padding:8px 12px;border-radius:8px;border:1px solid var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:700;cursor:pointer">' + (g && g.texto ? "🔄 Volver a generar" : "Generar lectura") + '</button> <span id="anaIA" style="font-size:0.8rem;color:var(--muted)"></span></div></div>';
  h += buscador(pr);
  // Metas
  h += '<details style="margin-top:12px"><summary style="cursor:pointer;color:var(--muted);font-size:0.86rem">⚙️ Ajustar metas</summary><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">' + NUT.concat(EXTRA.map(x => ({ id: x.id, n: x.n, u: x.u, limite: x.lim }))).map(x => '<label style="font-size:0.8rem;color:var(--muted)">' + x.n + " (" + x.u + (x.limite ? ", límite" : "") + ')<input type="number" min="0" step="any" data-meta="' + x.id + '" value="' + M[x.id] + '" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--panel-alt);color:var(--ink)"></label>').join("") +
    '<label style="font-size:0.8rem;color:var(--muted)">Pescado azul (raciones/semana)<input type="number" min="0" step="any" data-meta="rAzul" value="' + M.rAzul + '" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--panel-alt);color:var(--ink)"></label><label style="font-size:0.8rem;color:var(--muted)">Fuentes de colágeno (por semana; 7 = a diario)<input type="number" min="0" step="any" data-meta="rCol" value="' + M.rCol + '" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--panel-alt);color:var(--ink)"></label></div><div style="font-size:0.74rem;color:var(--muted);margin-top:6px">Las metas de partida son valores habituales para un adulto. Cámbialas según tu caso (edad, sexo, embarazo…) o lo que te indique tu médico.</div></details>';
  h += '<div style="font-size:0.74rem;color:var(--muted);margin-top:12px">Los alimentos que están en la base BEDCA usan sus valores reales; el resto son cifras estimadas por IA a partir del nombre y la cantidad, y son aproximadas. Los suplementos no se cuentan salvo que los registres como alimento. Orientación, no un consejo médico.</div>';
  root.innerHTML = h;
}

// ---------- IA: lectura semanal y búsqueda libre ----------
async function lecturaSemana(){
  const C = cache(), M = metas(), S = datosSemana(semana, C), pr = prioridades(), reg = S.dias.filter(d => d.n > 0);
  if(!reg.length) return;
  const el = $("anaIA"); ocupado = true; if(el) el.textContent = "Pensando…";
  const lineas = NUT.map(x => { const med = reg.reduce((s, d) => s + d.v[x.id], 0) / reg.length; return x.n + ": " + nf(med) + " " + x.u + "/día (meta " + nf(M[x.id]) + (x.limite ? ", es un límite" : "") + ")"; });
  const azul = S.dias.reduce((s, d) => s + d.azul, 0), col = S.dias.reduce((s, d) => s + d.col, 0);
  const prompt = "Eres un asistente de nutrición para una persona adulta. Con los datos agregados de abajo (estimaciones aproximadas), escribe en español sencillo: 1) un resumen de 3 a 5 frases de cómo fue la semana en micronutrientes; 2) tres sugerencias de alimentos concretos y fáciles de encontrar en España para mejorar lo que va bajo. " +
    "No indiques suplementos ni dosis, no diagnostiques, no inventes datos. " + (Object.keys(pr.noSubir).length ? "NO recomiendes subir: " + Object.values(pr.noSubir).join(", ") + " (están altos en su analítica; sugiere comentarlo con su médico). " : "") + (Object.keys(pr.prio).length ? "Prioriza: " + Object.values(pr.prio).join(", ") + " (bajos en su analítica). " : "") + "Máximo 180 palabras, sin títulos.\n\nDATOS (" + reg.length + " días con comidas registradas):\n" + lineas.join("\n") + "\nPescado azul: ≈" + nf(azul) + " raciones; fuentes de colágeno: " + Math.round(col) + ".";
  try{
    const t = await IAClaves.geminiTexto(prompt); if(!t) throw new Error("La IA no devolvió texto. Prueba otra vez.");
    sj("nutriAnalisisIAV1_" + perfilActivo + "|" + semana, { texto: t.slice(0, 2000), fecha: hoy() });
    ocupado = false; render();
  }catch(e){ ocupado = false; const el2 = $("anaIA"); if(el2) el2.textContent = "⚠️ " + (e && e.message ? e.message : "No se pudo generar."); }
}
async function buscarLibre(){
  const q = ($("anaQ").value || "").trim().slice(0, 140), out = $("anaQres"); if(!q) return;
  const cb = lj("nutriBusquedaIAV1", {}), k = norm(q);
  if(cb[k]){ out.textContent = cb[k]; return; }
  out.textContent = "Buscando…";
  try{
    const t = await IAClaves.geminiTexto("Lista hasta 8 alimentos fáciles de encontrar en España que cumplan: " + q + ". Una línea por alimento con la cantidad aproximada del nutriente por 100 g y, si ayuda, una ración típica. Sin introducción ni conclusión, máximo 150 palabras. Valores aproximados.");
    if(!t) throw new Error("La IA no devolvió texto.");
    const keys = Object.keys(cb); if(keys.length >= 30) delete cb[keys[0]];
    cb[k] = t.slice(0, 1500); sj("nutriBusquedaIAV1", cb); out.textContent = cb[k];
  }catch(e){ out.textContent = "⚠️ " + (e && e.message ? e.message : "No se pudo buscar."); }
}

// ---------- Eventos ----------
function sinClave(){ if(!window.IAClaves || !IAClaves.tieneGemini()){ if(window.avisar) avisar("Falta la clave de Gemini. Ponla una vez en ⚙️ Ajustes."); return true; } return false; }
document.addEventListener("click", async ev => {
  const b = ev.target.closest && ev.target.closest("#anaRoot [data-act]"); if(!b) return;
  const a = b.dataset.act; if(a === "chip") ev.preventDefault();
  if(a === "prev"){ semana = suma(semana, -7); render(); }
  else if(a === "next"){ if(semana < lunesDe(hoy())){ semana = suma(semana, 7); render(); } }
  else if(a === "modo"){ exModo = b.dataset.m; exVer = 30; render(); }
  else if(a === "mas"){ exVer += 30; const l = $("anaLista"); if(l) l.innerHTML = filasExplorador(); }
  else if(a === "reintentar"){ if(window.NutBedca) NutBedca.cargar(); }
  else if(a === "chip"){ chip = chip === b.dataset.id && !b.closest("ul") ? null : b.dataset.id; exVer = 30; render(); const r = $("anaRoot"); const t = r.querySelector('[data-act="buscarIA"]'); if(t && t.scrollIntoView) t.scrollIntoView({ block: "center" }); }
  else if(a === "estimar"){ if(ocupado || sinClave()) return; const S = datosSemana(semana, cache()); ocupado = true; render();
    try{ await estimar(S.pend); msgEst = ""; }catch(e){ msgEst = "⚠️ " + (e && e.message ? e.message : "No se pudo estimar."); } ocupado = false; render(); }
  else if(a === "iaSemana"){ if(ocupado || sinClave()) return; lecturaSemana(); }
  else if(a === "buscarIA"){ if(sinClave()) return; buscarLibre(); }
});
// Filtro y cantidad del explorador: solo se repinta la lista (para no perder el cursor al escribir)
document.addEventListener("input", ev => {
  const i = ev.target; if(!i || !i.dataset || !i.dataset.exp) return;
  if(i.dataset.exp === "q") exQ = i.value; else if(i.dataset.exp === "g") exG = num(i.value) > 0 ? num(i.value) : 0; else return;
  exVer = 30; const l = $("anaLista"); if(l && chip && chip !== "col") l.innerHTML = filasExplorador();
});
document.addEventListener("change", ev => {
  const e = ev.target; if(e && e.dataset && e.dataset.exp === "orden"){ exOrden = e.value === "100" ? "100" : "racion"; exVer = 30; const l = $("anaLista"); if(l) l.innerHTML = filasExplorador(); return; }
  if(e && e.dataset && e.dataset.exp === "esp"){ exEsp = e.checked; exVer = 30; const l = $("anaLista"); if(l) l.innerHTML = filasExplorador(); return; }
  const i = ev.target; if(!i || !i.dataset || !i.dataset.meta) return;
  const m = lj("nutriMetasMicroV1_" + perfilActivo, {}), v = parseFloat(String(i.value).replace(",", "."));
  if(isFinite(v) && v >= 0){ m[i.dataset.meta] = v; sj("nutriMetasMicroV1_" + perfilActivo, m); render(); }
});
// Lo que usa «Qué me falta hoy» (nutricion-extra.js): nutrientes que vas cortos hoy y lo que aporta un alimento por 100 g (si ya está estimado).
window.AnalisisNut = {
  faltantes: function(f){
    const C = cache(), M = metas(), pr = prioridades(), S = datosSemana(lunesDe(f), C), d = S.dias.find(x => x.f === f), lista = [];
    if(!d || !d.n) return { lista: lista, sinEstimar: 0, total: 0 };
    if(d.sin >= d.n) return { lista: lista, sinEstimar: d.sin, total: d.n }; // ningún alimento del día está estimado todavía: no se puede decir qué falta
    NUT.forEach(x => {
      if(x.limite || pr.noSubir[x.id]) return;
      const meta = M[x.id]; if(!(meta > 0)) return;
      const falta = meta - d.v[x.id];
      if(falta > 0.3 * meta) lista.push({ id: x.id, n: x.n, u: x.u, falta: falta, meta: meta });
    });
    return { lista: lista, sinEstimar: d.sin, total: d.n };
  },
  aporte: function(nombre){ return estimacion(nombre, cache()) || null; }
};
// Nutrientes reales de BEDCA: se piden en segundo plano (el Worker los guarda en el aparato 30 días) y se repinta al llegar.
if(window.NutBedca){ NutBedca.alCargar(() => { const p = document.querySelector('.panel[data-panel="ana"]'); if(p && !p.hidden) render(); if(window.NutExtra) try{ NutExtra.renderFaltaHoy(); }catch(e){} }); setTimeout(() => NutBedca.cargar(), 800); }
// Engancha con las pestañas y el cambio de perfil de nutricion.js
const mp0 = window.mostrarPestana;
if(typeof mp0 === "function") window.mostrarPestana = function(p){ const r = mp0.apply(this, arguments); if(p === "ana") render(); return r; };
document.querySelectorAll("#tabsPerfil button").forEach(b => b.addEventListener("click", () => setTimeout(() => { const p = document.querySelector('.panel[data-panel="ana"]'); if(p && !p.hidden) render(); }, 0)));
try{ if(localStorage.getItem("nutriPestanaV1") === "ana") render(); }catch(e){}
})();
