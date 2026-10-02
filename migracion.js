// migracion.js — Traspaso único de nombres: Kakin -> Mamy, Hija -> Filha.
// Se ejecuta al abrir cualquier página, ANTES que el resto del código, y solo la primera vez en cada navegador.
// Copia lo que estaba guardado con los nombres viejos a los nombres nuevos; no borra nada si ya existe algo nuevo.
(function(){
  var FLAG = "migracionNombresV1";
  try{
    if(localStorage.getItem(FLAG) === "1") return;

    function cambiar(txt){
      return String(txt)
        .split('"Kakin"').join('"Mamy"')
        .split('"Hija"').join('"Filha"')
        .split('_Kakin"').join('_Mamy"')
        .split('_Hija"').join('_Filha"');
    }
    // Claves sin sufijo de perfil, pero cuyo contenido menciona los nombres
    var CONTENIDO = ["calEventosV1","calEspecialistasV2","calVistaV1","tareasKokuk_v1","tareasFiltros_v1"];

    var claves = [];
    for(var i = 0; i < localStorage.length; i++) claves.push(localStorage.key(i));

    claves.forEach(function(k){
      var v = localStorage.getItem(k);
      if(v === null) return;

      // 1) Datos por perfil: nombre_Kakin -> nombre_Mamy, nombre_Hija -> nombre_Filha
      var m = k.match(/^(.*)_(Kakin|Hija)$/);
      if(m){
        var nuevaClave = m[1] + "_" + (m[2] === "Kakin" ? "Mamy" : "Filha");
        if(localStorage.getItem(nuevaClave) === null){
          localStorage.setItem(nuevaClave, cambiar(v));
          localStorage.removeItem(k);
        }
        return;
      }
      // 2) Perfil activo guardado como texto suelto
      if(k === "dietaPerfilActivo"){
        if(v === "Kakin") localStorage.setItem(k, "Mamy");
        else if(v === "Hija") localStorage.setItem(k, "Filha");
        return;
      }
      // 3) Contenido compartido y control de sincronización con la nube
      if(CONTENIDO.indexOf(k) >= 0 || k.indexOf("nubeT_") === 0 || k.indexOf("nubePend_") === 0){
        var nuevo = cambiar(v);
        if(nuevo !== v) localStorage.setItem(k, nuevo);
      }
    });

    localStorage.setItem(FLAG, "1");
  }catch(e){ console.warn("migracion.js:", e); }
})();
