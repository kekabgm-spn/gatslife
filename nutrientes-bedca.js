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
    var e = { id:r[0], nombre:g.nombre, v:r[1], peq:r[2] === 1 };
    lista.push(e); if(!porNombre[norm(g.nombre)]) porNombre[norm(g.nombre)] = e;
  });
  montaje = { total:total, emparejados:lista.length, porNumero:porId_, porNombre:porNom_ };
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
