// familia.js — Fase 2: datos que ven y editan las dos cuentas a la vez (Casa, Calendario compartido e invitaciones a tareas puntuales).
// Usa la misma conexión a Firebase que ya abrió nube.js — no vuelve a iniciar sesión ni a cargar Firebase de nuevo.
// Guarda toda la lista de "Casa" como un solo documento en Firestore (familia/casa), y escucha cambios en vivo
// con onSnapshot: si tu hija marca algo en su celular, tu pantalla se actualiza sola, sin que hagas nada.

window.Familia = { listo: false };

function conectarFamilia(f){
  const { db, doc, onSnapshot, setDoc } = f;

  function crearCanal(nombreDoc, campo){
    const ref = doc(db, "familia", nombreDoc);
    let ultimoEnviado = null;
    let timerEnvio = null;
    return {
      escuchar(cb){
        onSnapshot(ref, (snap)=>{
          const data = snap.exists() ? snap.data() : { [campo]: [] };
          let lista = Array.isArray(data[campo]) ? data[campo] : [];
          // Datos compartidos escritos antes del cambio de nombres (Kakin -> Mamy, Hija -> Filha)
          const viejo = JSON.stringify(lista);
          if(viejo.indexOf('"Kakin"') >= 0 || viejo.indexOf('"Hija"') >= 0){
            lista = JSON.parse(viejo.split('"Kakin"').join('"Mamy"').split('"Hija"').join('"Filha"'));
          }
          ultimoEnviado = JSON.stringify(lista);
          cb(lista);
        }, (err)=>{
          console.error("Familia/"+nombreDoc+":", err);
          avisoFamiliaError("No se pudo conectar " + nombreDoc + " compartido (" + (err.code||err.message) + "). Revisa las reglas de Firestore si dice permission-denied.");
        });
      },
      guardar(lista){
        const txt = JSON.stringify(lista);
        if(txt === ultimoEnviado) return;
        clearTimeout(timerEnvio);
        timerEnvio = setTimeout(async ()=>{
          try{
            ultimoEnviado = txt;
            await setDoc(ref, { [campo]: lista, actualizadoPor: f.perfil, actualizadoEn: Date.now() });
          }catch(err){
            console.error("Familia/"+nombreDoc+" (guardar):", err);
            avisoFamiliaError("No se pudo guardar un cambio en " + nombreDoc + " (" + (err.code||err.message) + ").");
          }
        }, 1200);
      }
    };
  }

  const canalCasa = crearCanal("casa", "tareas");
  const canalCalendario = crearCanal("calendario", "eventos");
  const canalInvitaciones = crearCanal("invitaciones", "items");

  window.Familia = {
    listo: true,
    perfil: f.perfil,
    escucharCasa(cb){ canalCasa.escuchar(cb); },
    guardarCasa(tareas){ canalCasa.guardar(tareas); },
    escucharCalendario(cb){ canalCalendario.escuchar(cb); },
    guardarCalendario(eventos){ canalCalendario.guardar(eventos); },
    escucharInvitaciones(cb){ canalInvitaciones.escuchar(cb); },
    guardarInvitaciones(items){ canalInvitaciones.guardar(items); }
  };
  window.dispatchEvent(new Event("familia-casa-lista"));
  window.dispatchEvent(new Event("familia-calendario-lista"));
  window.dispatchEvent(new Event("familia-invitaciones-lista"));
}

function avisoFamiliaError(msg){
  let d = document.getElementById("familia-aviso");
  if(!d){
    d = document.createElement("div");
    d.id = "familia-aviso";
    d.style.cssText = "position:fixed;bottom:10px;left:10px;right:10px;z-index:99997;background:#7a1f1f;color:#fff;padding:10px 14px;border-radius:10px;font:13px system-ui,sans-serif;text-align:center";
    document.body.appendChild(d);
  }
  d.textContent = "⚠️ " + msg;
}

if(window.__familia){
  conectarFamilia(window.__familia);
} else {
  window.addEventListener("familia-lista", ()=> conectarFamilia(window.__familia), { once:true });
}
