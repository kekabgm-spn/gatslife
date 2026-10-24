// nutrientes-bedca.js — nutrientes reales de BEDCA por 100 g (archivo privado «nutrientes» del Worker) unidos a los nombres de alimentos.
// Regla: un dato que falta es «sin dato» (null), NUNCA 0. Los valores ya vienen pasados a la unidad de cada nutriente (g, mg o µg).
(function(){
"use strict";
var norm = function(s){ return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
var comp = [], idx = {}, lista = [], porNombre = {}, estado = { listo:false, error:null }, montaje = { total:0, emparejados:0 }, promesa = null, avisar_ = [];

function montar(nut, genericos){
  comp = nut.comp || []; idx = {}; comp.forEach(function(c, i){ idx[c.k] = i; });
  var porId = {}, porNom = {}; (genericos || []).forEach(function(g){ porId[String(g.code).replace("bedca-", "")] = g; if(!porNom[norm(g.nombre)]) porNom[norm(g.nombre)] = g; });
  lista = []; porNombre = {}; var total = (nut.datos || []).length, porId_ = 0, porNom_ = 0;
  (nut.datos || []).forEach(function(r){
    // Se empareja por número de BEDCA y se comprueba el nombre; si el número no coincide, se usa el nombre.
    var g = porId[String(r[0])], nom = r[3] != null ? norm(r[3]) : null;
    if(g && (nom == null || norm(g.nombre) === nom)) porId_++;
    else if(nom != null && porNom[nom]){ g = porNom[nom]; porNom_++; }
    else return;
    var e = { id:r[0], nombre:g.nombre, v:r[1], peq:r[2] === 1 }; e.rac = racionDe(g.nombre, e.peq);
    lista.push(e); if(!porNombre[norm(g.nombre)]) porNombre[norm(g.nombre)] = e;
  });
  montaje = { total:total, emparejados:lista.length, porNumero:porId_, porNombre:porNom_ };
}

// ---------- Ración típica (APROXIMADA: reglas por nombre; lo que no encaja se queda en 100 g y se marca como «sin ración definida») ----------
var RAC = [
  [/aceite de h[ií]gado|soluble|suced[aá]neo de caf|caf[eé] en polvo/, 5], [/condensada|nata |crema de leche/, 20], [/caviar|hueva|huevas/, 15], [/fritos|chips|aperitivo|snack|palomitas|ganchitos|patatas fritas/, 30], [/salvado|germen/, 15], [/perejil|cilantro|albahaca|menta|cebollino|chile|guindilla/, 10],
  [/enlatad|en conserva|conserva/, 60], [/desecad|deshidrat|(^|[ ,])seco|(^|[ ,])pasa|uva pasa|orejon|d[aá]til|chufa/, 30], [/aceite|manteca|mantequilla|margarina/, 10],
  [/clara/, 33], [/yema/, 18], [/huevo/, 60],
  [/queso (fresco|de burgos|cottage|reques[oó]n|ricotta|mozzarella|batido)|reques[oó]n|cuajada/, 60], [/queso/, 30],
  [/chocolate|cacao/, 25],
  [/leche en polvo/, 25], [/leche|bebida (de )?(soja|avena|almendra|arroz)/, 200], [/yogur|k[eé]fir|natillas|flan/, 125],
  [/chia|ch[ií]a|lino|s[eé]samo|c[aá]ñamo|amapola|girasol, pipa/, 15], [/almendra|nuez|nueces|avellana|anacardo|cacahuete|pistacho|pipa|semilla|pi[nñ][oó]n|casta[nñ]a|coco|frutos secos|macadamia/, 30],
  [/jam[oó]n|chorizo|salchich|fuet|salami|mortadela|bacon|bac[oó]n|embutido|lomo embuchado|morcilla|sobrasada|chopped|paté|pate/, 40],
  [/lenteja|garbanzo|alubia|jud[ií]as? (blancas?|pintas?)|haba|soja|legumbre|guisante, seco|guisante seco/, null, [/hervid|cocid|estofad/, 150], [/./, 60]],
  [/arroz|pasta|macarr|espagueti|fideo|cusc[uú]s|tallar|lasa[nñ]a|[ñn]oqui/, null, [/hervid|cocid/, 150], [/./, 80]],
  [/pan |pan,|^pan$|tostada|biscote|picos|regañá|regana|cracker/, 40], [/galleta|bizcocho|magdalena|croissant|bollo|donut/, 30],
  [/cereal|muesli|copos|avena|granola/, 40], [/harina|maicena|almid[oó]n|s[eé]mola|pan rallado/, 30],
  [/az[uú]car|miel|mermelada|sirope|confitura|dulce de/, 15],
  [/caf[eé]/, 150], [/cerveza/, 330], [/vino|cava|sidra/, 100], [/zumo|jugo|refresco|bebida|infusi|(^|[ ,])t[eé]([ ,]|$)|n[eé]ctar|batido|smoothie/, 200],
  [/tofu|tempeh|seit[aá]n/, 100],
  [/almeja|berberecho|ostra|navaja|mejill[oó]n|mejillon/, 100],
  [/pescado|salm[oó]n|at[uú]n|sardina|caballa|boquer|anchoa|merluza|bacalao|trucha|arenque|dorada|lubina|rape|lenguado|pescadilla|jurel|pez espada|emperador|mero|bonito|gamba|langostino|calamar|pulpo|sepia|cangrejo|chipir|marisco|angula|salmonete|rodaballo|besugo|palometa|abadejo|atun/, 120],
  [/pollo|pavo|ternera|cerdo|cordero|conejo|vaca|buey|carne|lomo|solomillo|chuleta|filete|h[ií]gado|hamburguesa|pato|cabrito|lech[oó]n|codorniz|perdiz|jabal[ií]|venado|rabo|callos|costilla|cochinillo/, 120],
  [/patata|boniato|batata|pur[eé]/, 170], [/aguacate/, 100],
  [/lechuga|r[uú]cula|canónigo|canonigo|berro|escarola|endivia|espinaca.*crud/, 60],
  [/espinaca|acelga|br[oó]coli|coliflor|jud[ií]a verde|tomate|pimiento|zanahoria|cebolla|calabac|berenjena|pepino|\bcol\b|coles|repollo|alcachofa|esp[aá]rrago|champi|seta|puerro|apio|remolacha|calabaza|ensalada|verdura|hortaliza|guisante|r[aá]bano|nabo|cardo|borraja|pimiento|ma[ií]z|brotes|gazpacho|sopa|crema de|caldo/, 150],
  [/fresa|cereza|uva|mel[oó]n|sand[ií]a|melocot|albaricoq|kiwi|pi[nñ]a|mango|papaya|ciruela|higo|granada|mandarina|manzana|pera|naranja|pl[aá]tano|pomelo|lim[oó]n|guayaba|frambuesa|ar[aá]ndano|mora|n[eé]spero|caqui|chirimoya|fruta|lichi|d[aá]til|pasa|orejon|dátil/, 150]
];
function racionDe(nombre, peq){
  var n = String(nombre || "").toLowerCase();
  if(peq) return { g:/caf[eé]|aceite/.test(n) ? 5 : 2, def:true };
  if(/desecad|deshidrat|(^|[ ,])seco|(^|[ ,])pasa|uva pasa|orejon|d[aá]til|chufa/.test(n)) return { g:30, def:true };
  try{ if(typeof medidasDefecto === "function"){ var d = medidasDefecto({ nombre:nombre }); if(d && d.tipica && d.unidad > 0) return { g:d.unidad, def:true, unidad:true }; } }catch(e){}
  for(var i = 0; i < RAC.length; i++){
    var r = RAC[i]; if(!r[0].test(n)) continue;
    if(r[1] != null) return { g:r[1], def:true };
    for(var j = 2; j < r.length; j++) if(r[j][0].test(n)) return { g:r[j][1], def:true };
  }
  return { g:100, def:false };
}
function cargar(){
  if(promesa) return promesa;
  promesa = Promise.resolve().then(function(){
    if(!window.IAClaves || !IAClaves.datos) throw new Error("claves.js no está actualizado");
    var base = window.BuscadorBase ? BuscadorBase.cargar() : Promise.reject(new Error("buscar.js no está cargado"));
    return Promise.all([IAClaves.datos("nutrientes"), base]).then(function(rs){
      var gen = BuscadorBase.genericos();
      if(!gen || !gen.length) throw new Error("No se cargó la base de alimentos (BEDCA).");
      montar(rs[0], gen); if(!lista.length) throw new Error("No coincide ningún alimento entre el archivo de nutrientes y la base BEDCA de la app."); estado = { listo:true, error:null };
    });
  }).catch(function(e){ estado = { listo:false, error:(e && e.message) || "error" }; promesa = null; })
    .then(function(){ avisar_.forEach(function(f){ try{ f(); }catch(e){} }); });
  return promesa;
}
function val(e, k){ if(!e) return null; var i = idx[k]; if(i == null) return null; var v = e.v[i]; return (v == null || !isFinite(v)) ? null : v; }
// EPA + DHA: si solo hay uno de los dos se usa ese; si no hay ninguno, sin dato.
function o3(e){ var a = val(e, "epa"), b = val(e, "dha"); return (a == null && b == null) ? null : (a || 0) + (b || 0); }
window.NutBedca = {
  cargar: cargar,
  estado: function(){ return estado; },
  montaje: function(){ return montaje; },
  alCargar: function(f){ avisar_.push(f); },
  comp: function(){ return comp; },
  lista: function(){ return lista; },
  porNombre: function(n){ return porNombre[norm(n)] || null; },
  val: val, o3: o3,
  // Lo mismo que la estimación de IA del Análisis (por 100 g), pero con datos reales de BEDCA. Faltantes → _sd[id] = true.
  comoEstimacion: function(nombre, ids){
    var e = porNombre[norm(nombre)]; if(!e) return null;
    var r = { _sd:{}, bedca:true, cat:"", gu:{} };
    ids.forEach(function(id){ var v = val(e, id); if(v == null) r._sd[id] = true; r[id] = v == null ? 0 : v; });
    var ev = o3(e), ala = val(e, "ala");
    if(ev != null && ev >= 0.4) r.cat = "azul"; else if(ala != null && ala >= 2) r.cat = "vegetal";
    return r;
  }
};
})();
