// familia.js — datos que ven y editan las dos cuentas a la vez (Casa, Calendario compartido e invitaciones a tareas puntuales).
// Usa la misma conexión a Firebase que ya abrió nube.js — no vuelve a iniciar sesión ni a cargar Firebase de nuevo.
//
// FASE 3 — dos formatos en la nube:
//  · "anterior": cada lista es UN solo documento (familia/casa, familia/calendario, familia/invitaciones).
//     Si dos personas cambian algo casi a la vez, gana el último y el otro cambio se pierde.
//  · "nuevo": cada tarea / evento / invitación es SU PROPIO documento (familia/casa/items/<id>, etc.).
//     Solo se escribe lo que cambió, así que dos cambios en cosas distintas no se pisan.
// La app usa el formato "nuevo" cuando existe la marca familia/_migracion (la crea el botón «Migrar» de Ajustes).
// Hasta entonces sigue funcionando exactamente como antes. Las pantallas (Tareas, Calendario, Hoy) no notan la diferencia:
// siguen llamando a escucharCasa / guardarCasa, etc.

window.Familia = { listo: false };

function conectarFamilia(f){
  const { db, doc, getDoc, setDoc, getDocs, deleteDoc, collection, onSnapshot } = f;
  const CAMPOS = { casa: "tareas", calendario: "eventos", invitaciones: "items" };
  const refMarca = doc(db, "familia", "_migracion");

  // (Fase 7b) Ya no se convierten nombres viejos: se deja la lista tal cual.
  const convertirNombres = lista => lista;
  // Ejecuta varias tareas asíncronas con un máximo de n a la vez; si alguna falla, lanza el primer error al final.
  async function correr(fns, n){
    let i = 0, fallo = null;
    const obreros = Array.from({ length: Math.min(n, fns.length) }, async () => {
      while(i < fns.length){ const fn = fns[i++]; try{ await fn(); }catch(e){ fallo = fallo || e; } }
    });
    await Promise.all(obreros);
    if(fallo) throw fallo;
  }
  // Nombre del documento de cada elemento: «i_» + su id (sin barras ni caracteres prohibidos en Firestore)
  const idDoc = id => "i_" + encodeURIComponent(String(id));

  // ---------- ¿Qué formato hay en la nube? ----------
  let modo = null;                 // "anterior" | "nuevo"
  const esperando = [];
  function fijarModo(m){ modo = m; esperando.splice(0).forEach(fn => fn()); }
  function conModo(fn){ if(modo) fn(); else esperando.push(fn); }
  const esperarModo = () => new Promise(res => conModo(res));
  function vigilarModo(){
    onSnapshot(refMarca, (snap) => {
      if(snap.metadata && snap.metadata.fromCache && !snap.exists() && !modo) return;   // todavía no contestó la nube
      const nuevo = snap.exists() && Number(snap.data().v) >= 1;
      if(!modo){
        if(nuevo) sessionStorage.removeItem("famRec");
        fijarModo(nuevo ? "nuevo" : "anterior");
      } else if(modo === "anterior" && nuevo){
        // Otro aparato acaba de migrar: se recarga para pasar al formato nuevo sin escribir nada en el viejo.
        const veces = Number(sessionStorage.getItem("famRec") || 0);
        if(veces < 3){ sessionStorage.setItem("famRec", veces + 1); location.reload(); }
      }
    }, (err) => {
      console.error("Familia/_migracion:", err);
      avisoFamiliaError("No se pudo comprobar el formato de los datos compartidos (" + (err.code || err.message) + ").");
      setTimeout(vigilarModo, 5000);
    });
  }

  // ---------- Formato anterior: un documento por lista (igual que antes) ----------
  function canalAnterior(nombreDoc, campo){
    const ref = doc(db, "familia", nombreDoc);
    let ultimoEnviado = null, timerEnvio = null;
    return {
      escuchar(cb){
        onSnapshot(ref, (snap) => {
          const data = snap.exists() ? snap.data() : { [campo]: [] };
          const lista = convertirNombres(Array.isArray(data[campo]) ? data[campo] : []);
          ultimoEnviado = JSON.stringify(lista);
          cb(lista);
        }, (err) => {
          console.error("Familia/" + nombreDoc + ":", err);
          avisoFamiliaError("No se pudo conectar " + nombreDoc + " compartido (" + (err.code || err.message) + "). Revisa las reglas de Firestore si dice permission-denied.");
        });
      },
      guardar(lista){
        const txt = JSON.stringify(lista);
        if(txt === ultimoEnviado) return;
        clearTimeout(timerEnvio);
        timerEnvio = setTimeout(async () => {
          try{
            ultimoEnviado = txt;
            await setDoc(ref, { [campo]: lista, actualizadoPor: f.perfil, actualizadoEn: Date.now() });
          }catch(err){
            ultimoEnviado = null;
            console.error("Familia/" + nombreDoc + " (guardar):", err);
            avisoFamiliaError("No se pudo guardar un cambio en " + nombreDoc + " (" + (err.code || err.message) + ").");
          }
        }, 1200);
      }
    };
  }

  // ---------- Formato nuevo: un documento por elemento ----------
  function canalNuevo(nombreDoc){
    const col = collection(db, "familia", nombreDoc, "items");
    const refItem = id => doc(db, "familia", nombreDoc, "items", id);
    let remoto = new Map();            // docId -> { j: texto JSON del elemento, o: posición }
    let ultimoO = 0, timer = null, pendiente = null;
    const siguienteO = () => (ultimoO = Math.max(ultimoO + 1, Date.now()));

    // Compara la lista que entrega la pantalla con lo que hay en la nube y saca SOLO lo que cambió.
    function calcular(lista){
      const vistos = new Map();
      (Array.isArray(lista) ? lista : []).forEach(it => {
        if(!it || typeof it !== "object") return;
        if(it.id === undefined || it.id === null || it.id === "") it.id = "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        vistos.set(idDoc(it.id), it);
      });
      const set = new Map(), del = new Set();
      vistos.forEach((it, id) => {
        const j = JSON.stringify(it), r = remoto.get(id);
        if(!r || r.j !== j) set.set(id, { j, o: r ? r.o : siguienteO() });
      });
      remoto.forEach((r, id) => { if(!vistos.has(id)) del.add(id); });
      return { set, del, total: vistos.size };
    }
    async function escribir(p){
      const fns = [];
      p.set.forEach((v, id) => fns.push(() => setDoc(refItem(id), { j: v.j, o: v.o, por: f.perfil, en: Date.now() })));
      p.del.forEach(id => fns.push(() => deleteDoc(refItem(id))));
      await correr(fns, 8);
    }
    return {
      escuchar(cb){
        onSnapshot(col, (snap) => {
          if(snap.metadata && snap.metadata.fromCache && snap.empty) return;   // vacío porque aún no contestó la nube: no se toma por «lista vacía»
          const nuevoRemoto = new Map(), filas = [];
          snap.forEach(d => {
            const x = d.data(); let it = null;
            try{ it = JSON.parse(x.j); }catch(e){ console.warn("Familia/" + nombreDoc + ": elemento ilegible", d.id); }
            if(!it || typeof it !== "object") return;
            const o = Number(x.o) || 0;
            nuevoRemoto.set(d.id, { j: JSON.stringify(it), o });
            filas.push({ o, id: d.id, it });
            if(o > ultimoO) ultimoO = o;
          });
          remoto = nuevoRemoto;
          filas.sort((a, b) => (a.o - b.o) || (a.id < b.id ? -1 : 1));
          cb(convertirNombres(filas.map(r => r.it)));
        }, (err) => {
          console.error("Familia/" + nombreDoc + ":", err);
          avisoFamiliaError("No se pudo conectar " + nombreDoc + " compartido (" + (err.code || err.message) + "). Revisa las reglas de Firestore si dice permission-denied.");
        });
      },
      guardar(lista){
        const p = calcular(lista);
        // Freno de seguridad: una lista vacía no borra de golpe todo lo que hay en la nube.
        if(p.total === 0 && remoto.size > 3){ console.warn("Familia/" + nombreDoc + ": lista vacía ignorada (no se borra todo de golpe)."); return; }
        if(!p.set.size && !p.del.size){ pendiente = null; clearTimeout(timer); return; }
        pendiente = p;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const q = pendiente; pendiente = null;
          if(!q) return;
          try{ await escribir(q); }
          catch(err){
            console.error("Familia/" + nombreDoc + " (guardar):", err);
            avisoFamiliaError("No se pudo guardar un cambio en " + nombreDoc + " (" + (err.code || err.message) + "). Se reintentará.");
            if(!pendiente){ pendiente = q; clearTimeout(timer); timer = setTimeout(() => { const r = pendiente; pendiente = null; if(r) escribir(r).catch(e => console.error(e)); }, 15000); }
          }
        }, 800);
      }
    };
  }

  // ---------- Cada lista usa un formato u otro según la marca de la nube ----------
  function crearCanal(nombreDoc){
    const anterior = canalAnterior(nombreDoc, CAMPOS[nombreDoc]), nuevo = canalNuevo(nombreDoc);
    return {
      escuchar(cb){ conModo(() => (modo === "nuevo" ? nuevo : anterior).escuchar(cb)); },
      guardar(lista){ conModo(() => (modo === "nuevo" ? nuevo : anterior).guardar(lista)); }
    };
  }
  const canalCasa = crearCanal("casa");
  const canalCalendario = crearCanal("calendario");
  const canalInvitaciones = crearCanal("invitaciones");

  // ---------- Copia de seguridad y migración (se usan desde Ajustes) ----------
  async function leerAnterior(n){
    const s = await getDoc(doc(db, "familia", n));
    return (s.exists() && Array.isArray(s.data()[CAMPOS[n]])) ? s.data()[CAMPOS[n]] : [];
  }
  async function leerNuevo(n){
    const s = await getDocs(collection(db, "familia", n, "items")), filas = [];
    s.forEach(d => { try{ filas.push({ o: Number(d.data().o) || 0, id: d.id, it: JSON.parse(d.data().j) }); }catch(e){} });
    return filas.sort((a, b) => (a.o - b.o) || (a.id < b.id ? -1 : 1)).map(r => r.it);
  }
  const migracion = {
    // Cuántos elementos hay en cada formato.
    async estado(){
      await esperarModo();
      const r = { modo, anterior: {}, nuevo: {}, marca: null };
      for(const n of Object.keys(CAMPOS)){
        r.anterior[n] = (await leerAnterior(n)).length;
        r.nuevo[n] = (await getDocs(collection(db, "familia", n, "items"))).size;
      }
      const m = await getDoc(refMarca); r.marca = m.exists() ? m.data() : null;
      return r;
    },
    // Copia completa de lo compartido (los dos formatos), tal cual está en la nube.
    async copia(){
      await esperarModo();
      const c = { app: "nuestra-app", tipo: "compartidos", version: 1, fecha: new Date().toISOString(), por: f.perfil, modo, anterior: {}, nuevo: {} };
      for(const n of Object.keys(CAMPOS)){ c.anterior[n] = await leerAnterior(n); c.nuevo[n] = await leerNuevo(n); }
      return c;
    },
    // Pasa de un documento por lista a un documento por elemento. No borra nada del formato anterior (queda como respaldo).
    async migrar(){
      await esperarModo();
      if(!navigator.onLine) throw new Error("Hace falta conexión a internet.");
      const marca = await getDoc(refMarca);   // se mira la nube, no lo que cree esta pantalla
      if(modo === "nuevo" || (marca.exists() && Number(marca.data().v) >= 1)) throw new Error("Ya está en el formato nuevo.");
      const prep = {}, resumen = {};
      for(const n of Object.keys(CAMPOS)){
        const lista = convertirNombres(await leerAnterior(n)), vistos = new Map();
        lista.forEach((it, i) => {
          if(!it || typeof it !== "object") return;
          const copia = (it.id === undefined || it.id === null || it.id === "") ? Object.assign({}, it, { id: "mig-" + n + "-" + i }) : it;
          const k = idDoc(copia.id), previo = vistos.get(k);
          vistos.set(k, { it: copia, o: previo ? previo.o : i });   // si el id está repetido: manda el contenido del último, pero conserva el sitio del primero
        });
        prep[n] = vistos;
        resumen[n] = { antes: lista.length, despues: vistos.size, duplicados: lista.length - vistos.size };
      }
      for(const n of Object.keys(CAMPOS)){
        const col = collection(db, "familia", n, "items");
        // Restos de un intento anterior que se cortó a medias: se limpian para que la comprobación sea exacta.
        const previos = await getDocs(col), sobran = [];
        previos.forEach(d => { if(!prep[n].has(d.id)) sobran.push(() => deleteDoc(doc(db, "familia", n, "items", d.id))); });
        await correr(sobran, 8);
        const fns = [];
        prep[n].forEach((v, id) => fns.push(() => setDoc(doc(db, "familia", n, "items", id), { j: JSON.stringify(v.it), o: v.o, por: f.perfil, en: Date.now(), mig: true })));
        await correr(fns, 8);
      }
      // Comprobación: lo escrito tiene que coincidir elemento por elemento con lo que se quería escribir.
      for(const n of Object.keys(CAMPOS)){
        const s = await getDocs(collection(db, "familia", n, "items")), leidos = new Map();
        s.forEach(d => leidos.set(d.id, d.data().j));
        let bien = leidos.size === prep[n].size;
        prep[n].forEach((v, id) => { if(leidos.get(id) !== JSON.stringify(v.it)) bien = false; });
        if(!bien) throw new Error("La comprobación de «" + n + "» no coincide. No se activó el formato nuevo y no se perdió nada.");
      }
      await setDoc(refMarca, { v: 1, en: Date.now(), por: f.perfil, cuentas: resumen });
      return resumen;
    }
  };

  // ---------- Fase 4: copia y restauración de lo compartido (se usan desde la copia única de Ajustes) ----------
  // Devuelve las tres listas tal como están ahora en la nube, en el formato que esté activo.
  async function leerCompartidos(){
    await esperarModo();
    const r = {};
    for(const n of Object.keys(CAMPOS)){
      r[n] = convertirNombres(modo === "nuevo" ? await leerNuevo(n) : await leerAnterior(n));
    }
    return r;
  }
  // Sustituye lo que hay en la nube por las listas que se pasan (solo las que vengan en «datos»).
  // Una lista vacía en la copia NO se aplica si en la nube hay algo: se avisa en el resultado (freno de seguridad).
  async function restaurarCompartidos(datos){
    await esperarModo();
    if(!navigator.onLine) throw new Error("Hace falta conexión a internet.");
    const res = {};
    for(const n of Object.keys(CAMPOS)){
      if(!datos || !Array.isArray(datos[n])) continue;
      const lista = convertirNombres(datos[n]), vistos = new Map();
      lista.forEach((it, i) => {
        if(!it || typeof it !== "object") return;
        const c = (it.id === undefined || it.id === null || it.id === "") ? Object.assign({}, it, { id: "res-" + n + "-" + i }) : it;
        const k = idDoc(c.id), previo = vistos.get(k);
        vistos.set(k, { it: c, o: previo ? previo.o : i });
      });
      const hayAhora = modo === "nuevo" ? (await getDocs(collection(db, "familia", n, "items"))).size : (await leerAnterior(n)).length;
      if(vistos.size === 0 && hayAhora > 0){ res[n] = { omitida: true, hayAhora }; continue; }
      if(modo === "nuevo"){
        const col = collection(db, "familia", n, "items"), previos = await getDocs(col), sobran = [];
        previos.forEach(d => { if(!vistos.has(d.id)) sobran.push(() => deleteDoc(doc(db, "familia", n, "items", d.id))); });
        const fns = [];
        vistos.forEach((v, id) => fns.push(() => setDoc(doc(db, "familia", n, "items", id), { j: JSON.stringify(v.it), o: v.o, por: f.perfil, en: Date.now(), res: true })));
        await correr(fns, 8);       // primero se escribe lo de la copia…
        await correr(sobran, 8);    // …y solo después se quita lo que sobra
        const s = await getDocs(col), leidos = new Map();
        s.forEach(d => leidos.set(d.id, d.data().j));
        let bien = leidos.size === vistos.size;
        vistos.forEach((v, id) => { if(leidos.get(id) !== JSON.stringify(v.it)) bien = false; });
        if(!bien) throw new Error("La comprobación de «" + n + "» no coincide tras restaurar. Vuelve a intentarlo.");
      } else {
        const arr = Array.from(vistos.values()).sort((a, b) => a.o - b.o).map(v => v.it);
        await setDoc(doc(db, "familia", n), { [CAMPOS[n]]: arr, actualizadoPor: f.perfil, actualizadoEn: Date.now() });
        if((await leerAnterior(n)).length !== arr.length) throw new Error("La comprobación de «" + n + "» no coincide tras restaurar. Vuelve a intentarlo.");
      }
      res[n] = { antes: hayAhora, despues: vistos.size };
    }
    return res;
  }

  window.Familia = {
    listo: true,
    leerCompartidos,
    restaurarCompartidos,
    perfil: f.perfil,
    escucharCasa(cb){ canalCasa.escuchar(cb); },
    guardarCasa(tareas){ canalCasa.guardar(tareas); },
    escucharCalendario(cb){ canalCalendario.escuchar(cb); },
    guardarCalendario(eventos){ canalCalendario.guardar(eventos); },
    escucharInvitaciones(cb){ canalInvitaciones.escuchar(cb); },
    guardarInvitaciones(items){ canalInvitaciones.guardar(items); },
    migracion
  };
  vigilarModo();
  window.dispatchEvent(new Event("familia-casa-lista"));
  window.dispatchEvent(new Event("familia-calendario-lista"));
  window.dispatchEvent(new Event("familia-invitaciones-lista"));
  window.dispatchEvent(new Event("familia-migracion-lista"));
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
