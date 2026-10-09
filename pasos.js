// pasos.js — Reglas compartidas entre Fitness (ejercicios.html) y Huawei (huawei.html) para que
// NINGÚN paso ni ninguna caloría se cuente dos veces.
//
// Los pasos de un día pueden venir de 3 sitios:
//   1) Actividades que graba el reloj (caminata, carrera…)  -> ya traen sus propias kcal   (huaweiDiaV1.actPasos)
//   2) Caminatas/carreras que anotas TÚ a mano en Fitness   -> se calculan por minutos (kcal = fórmula MET)
//   3) El resto de pasos del día ("sueltos")                 -> opcionalmente se convierten en kcal
// Los pasos sueltos = pasos totales del reloj − pasos de (1) − pasos de (2).
// Estimación de pasos de una caminata/carrera anotada a mano: minutos × pasos por minuto (aproximado).
(function(){
  var PASOS_POR_MIN = { caminata: 100, corrida: 160 };
  var KCAL_POR_PASO_Y_KG = 0.0003;   // misma fórmula de siempre: pasos × peso × 0,0003

  function lj(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
  function esAuto(h){ return !!(h && h.hid); }   // entradas que vienen del reloj (hw:…) o del cálculo de pasos (hwp:…)

  // Pasos que ya están dentro de caminatas/carreras anotadas a mano ese día.
  // Si marcaste "sin reloj" (reloj === false), esos pasos NO están en el total del reloj y no se descuentan.
  function pasosManuales(hist, fecha){
    var t = 0;
    (hist || []).forEach(function(h){
      if(!h || h.fecha !== fecha || esAuto(h) || h.reloj === false) return;
      var ppm = PASOS_POR_MIN[h.tipo];
      var min = parseFloat(h.minutos);
      if(ppm && min > 0) t += Math.round(min * ppm);
    });
    return t;
  }

  function pesoDe(p){
    var m = lj('dietaMedidasV1_' + p, []).filter(function(x){ return x && x.peso > 0; }).sort(function(a, b){ return a.fecha < b.fecha ? 1 : -1; });
    if(m.length) return m[0].peso;
    var pm = lj('perfilMetasV1_' + p, null);
    return pm && pm.pesoInicial > 0 ? pm.pesoInicial : null;
  }

  // x = resumen del día del reloj {pasos, actPasos}; manuales = pasos de caminatas anotadas a mano
  function kcalPasosDe(x, peso, manuales){
    var extra = Math.max(0, (x.pasos || 0) - (x.actPasos || 0) - (manuales || 0));
    return { extra: extra, kcal: Math.round(extra * peso * KCAL_POR_PASO_Y_KG) };
  }

  // Reescribe en el historial las líneas automáticas "👣 Pasos del día" de todos los días.
  // Se llama al sincronizar, al activar/desactivar la opción y cada vez que cambia una caminata a mano.
  function aplicar(p){
    var on = localStorage.getItem('huaweiPasosKcalV1_' + p) === '1';
    var h = lj('ejercicioHistorial_' + p, []).filter(function(x){ return !(x && x.hid && String(x.hid).indexOf('hwp:') === 0); });
    var n = 0;
    if(on){
      var peso = pesoDe(p);
      if(!peso) return { n: 0, sinPeso: true };
      var d = lj('huaweiDiaV1_' + p, {});
      Object.keys(d).forEach(function(f){
        var k = kcalPasosDe(d[f], peso, pasosManuales(h, f));
        if(k.kcal > 0){ h.push({ fecha: f, tipo: 'caminata', nombre: '👣 Pasos del día (sin actividades)', minutos: Math.round(k.extra / 100), kcal: k.kcal, hid: 'hwp:' + f }); n++; }
      });
    }
    localStorage.setItem('ejercicioHistorial_' + p, JSON.stringify(h));
    return { n: n, sinPeso: false };
  }

  var API = { PASOS_POR_MIN: PASOS_POR_MIN, pasosManuales: pasosManuales, kcalPasosDe: kcalPasosDe, aplicar: aplicar, pesoDe: pesoDe };
  if(typeof window !== 'undefined') window.Pasos = API;
  if(typeof module !== 'undefined') module.exports = API;
})();
