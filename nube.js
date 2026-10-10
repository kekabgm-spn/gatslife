// nube.js — entrada con Google + copia en la nube (Firebase). Fase 1: Nutrición y Ejercicios.
let initializeApp, getAuth, GoogleAuthProvider, signInWithCredential, onAuthStateChanged, signOut, getFirestore, doc, getDoc, setDoc, getDocs, collection, onSnapshot, updateDoc, deleteDoc;
try{
  ({ initializeApp } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"));
  ({ getAuth, GoogleAuthProvider, signInWithCredential, onAuthStateChanged, signOut } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"));
  ({ getFirestore, doc, getDoc, setDoc, getDocs, collection, onSnapshot, updateDoc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"));
}catch(e){
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99998;background:#7a1f1f;color:#fff;padding:10px 14px;font:14px system-ui,sans-serif;text-align:center";
  d.textContent = "⚠️ No se pudo cargar el código de Google/Firebase (fallo de red o bloqueado por una extensión/filtro). Detalle: " + (e && e.message ? e.message : e);
  (document.body || document.documentElement).appendChild(d);
  throw e;
}
const GIS_CLIENT_ID = "235893987189-hkdej19871r8qkbkgke2dm6n971tb1q1.apps.googleusercontent.com";
window.__nubeVivo = true;
const app = initializeApp({ apiKey:"AIzaSyDYK1EoCKWyX_zvNk0XCu8KKxawgk4v598", authDomain:"gatslife0470.firebaseapp.com", projectId:"gatslife0470", storageBucket:"gatslife0470.firebasestorage.app", messagingSenderId:"235893987189", appId:"1:235893987189:web:733eeb67e6ad46f2aca53c" });
const auth = getAuth(app), db = getFirestore(app);
// Entrega la credencial de tu sesión para hablar con tu Worker (las claves de IA ya no viven en el aparato).
window.__nubeToken = async () => { try{ await auth.authStateReady(); return auth.currentUser ? await auth.currentUser.getIdToken() : null; }catch(e){ return null; } };

// Solo se sincronizan estos datos, y solo los de tu perfil (terminan en _Mamy o _Filha).
const PREF = ["dietaDiarioV3_","dietaRecetasV1_","dietaComidasGuardadasV1_","dietaRepartoV1_","dietaFrecuentesV1_","dietaFiltrosV1_","dietaMedidasV1_","dietaPerfilDatosV1_","ejercicioHistorial_","huaweiDiaV1_","huaweiPasosKcalV1_","huaweiQuemadoV1_","fam_ex_rutina_","fam_ex_favoritos_","fam_ex_videos_","fam_ex_perfilbusq_","saludCondicionesV1_","saludCirugiasV1_","saludMedicacionV1_","saludMedTomasV1_","saludBancoMedV1_","saludPruebasV1_","saludArticV1_","saludSintomasV1_","perfilMetasV1_"];
const IMG_GATO = {
  Mamy: "gato-mamy.png",
  Filha: "gato-filha.png"
};
const LETRA = { Mamy:"M", Filha:"F" };
const COL_PERFIL = { Mamy:"#c98e2c", Filha:"#7d37a3" };
const gato = (p, px=64) => `<img src="${IMG_GATO[p]}" alt="" width="${px}" height="${px}" style="display:inline-block;border-radius:${Math.round(px*0.18)}px">`;
const raw = (k,v) => window.__nubeRaw(k,v);
const ls = k => localStorage.getItem(k);

let uid, perfil, mias = [], T = {}, pend = [], timer, sinConexion = false;
const PERFILES_OK = ["Mamy","Filha"];
const conTiempo = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("tiempo agotado"), { code:"deadline-exceeded" })), ms))]);
const esErrorRed = e => !navigator.onLine || ["unavailable","deadline-exceeded","auth/network-request-failed"].includes(e && e.code) || /offline|network|failed to fetch/i.test(String((e && e.message) || ""));
// Perfil de esta cuenta guardado en el aparato (para poder entrar sin internet).
function perfilGuardado(u){
  let p = ls("nubePerfil_"+u) || ls("dietaPerfilActivo");
  if(p === "Kakin") p = "Mamy"; else if(p === "Hija") p = "Filha";
  return PERFILES_OK.includes(p) ? p : null;
}
const guardar = () => { raw("nubeT_"+uid, JSON.stringify(T)); raw("nubePend_"+uid, JSON.stringify(pend)); };

// ---------- pantallas ----------
const BTN = "display:block;width:100%;margin:10px 0;padding:14px;border-radius:12px;border:1px solid #35c26a;background:rgba(53,194,106,.15);color:#35c26a;font-size:1rem;font-weight:800;cursor:pointer;";
function pantalla(html){
  let d = document.getElementById("nube-capa");
  if(!d){ d = document.createElement("div"); d.id = "nube-capa";
    d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#10151f;color:#e8ecf2;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;overflow:auto;";
    document.body.appendChild(d); }
  d.innerHTML = `<div style="max-width:380px;width:100%">${html}</div>`; return d;
}
const quitar = () => document.getElementById("nube-capa")?.remove();
const dosGatos = `<div style="display:flex;justify-content:center;gap:4px">${gato("Mamy",84)}${gato("Filha",84)}</div>`;

function traducir(e){
  const m = { "auth/popup-closed-by-user":"Cerraste la ventana antes de terminar. Prueba de nuevo.",
    "auth/popup-blocked":"El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio.",
    "auth/unauthorized-domain":"Esta dirección no está autorizada en Firebase (Authentication → Configuración → Dominios autorizados).",
    "auth/operation-not-allowed":"El inicio con Google no está activado en Firebase (Authentication → Método de acceso).",
    "auth/network-request-failed":"No hay conexión a internet." };
  return m[e.code] || ("Error: " + (e.code || e.message));
}
function traducirGis(motivo){
  const m = { "credential_returned_moved":"Un momento raro del navegador. Toca Recargar.",
    "unregistered_origin":"Esta dirección no está registrada en Google Cloud (Credenciales → tu Cliente OAuth → Orígenes autorizados de JavaScript)." };
  return m[motivo] || null;
}
let entrando = false;
async function onCredGoogle(resp){
  if(entrando) return; entrando = true;
  try{
    await signInWithCredential(auth, GoogleAuthProvider.credential(resp.credential));
  }catch(e){
    entrando = false;
    const d = document.getElementById("nube-capa");
    if(d) d.querySelector("p:last-child").textContent = traducir(e);
  }
}
function cargarGIS(){
  return new Promise((res, rej) => {
    if(window.google && window.google.accounts && window.google.accounts.id) return res();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar el botón de Google."));
    document.head.appendChild(s);
  });
}
async function mostrarLogin(msg){
  const d = pantalla(`${dosGatos}<h1>Nuestra App</h1><p style="color:#8a94a3">Entra con tu cuenta de Google.</p><div id="nube-btn" style="display:flex;justify-content:center;margin:14px 0"></div><p style="color:#ff9b6b">${msg || ""}</p>`);
  try{
    await cargarGIS();
    window.google.accounts.id.initialize({ client_id: GIS_CLIENT_ID, callback: onCredGoogle, itp_support: true, use_fedcm_for_prompt: true });
    window.google.accounts.id.renderButton(document.getElementById("nube-btn"), { theme: "filled_black", size: "large", text: "continue_with", shape: "pill", width: 260 });
  }catch(e){
    d.querySelector("p:last-child").textContent = "No se pudo mostrar el botón de Google: " + e.message;
  }
}
async function elegirPerfil(user, ref, aviso=""){
  const d = pantalla(`<h1>¿Quién eres?</h1><p style="color:#8a94a3">Se elige una sola vez para esta cuenta.</p>
    <div style="display:flex;gap:12px"><button data-p="Mamy" style="${BTN}">${gato("Mamy")}<br>M</button><button data-p="Filha" style="${BTN}">${gato("Filha")}<br>F</button></div><p style="color:#ff9b6b">${aviso}</p>`);
  const p = await new Promise(r => d.querySelectorAll("button").forEach(b => b.onclick = () => r(b.dataset.p)));
  try{ await setDoc(ref, { perfil:p, email:user.email.toLowerCase() }); return p; }
  catch(e){ return elegirPerfil(user, ref, "Esa opción no corresponde a tu cuenta. Prueba con la otra."); }
}
function preguntar(){
  const d = pantalla(`<h1>Ya hay datos</h1><p style="color:#8a94a3">Hay datos guardados en la nube y también en este navegador. ¿Cuáles conservas?</p>
    <button data-m="nube" style="${BTN}">Los de la nube</button><button data-m="local" style="${BTN}">Los de este navegador (reemplazan la nube)</button>`);
  return new Promise(r => d.querySelectorAll("button").forEach(b => b.onclick = () => r(b.dataset.m)));
}

// ---------- copia ----------
async function subirClave(k){
  const v = ls(k);
  if(v === null){ pend = pend.filter(x => x !== k); return; }
  if(v.length > 950000){ estado("⚠️","Datos demasiado grandes para la nube: "+k); pend = pend.filter(x => x !== k); guardar(); return; }
  const t = Date.now(); await setDoc(doc(db,"usuarios",uid,"datos",k), { valor:v, t });
  T[k] = t; pend = pend.filter(x => x !== k); guardar();
}
async function enviar(){
  if(!pend.length){ estado("☁️","Todo guardado"); return; }
  try{ for(const k of [...pend]) await subirClave(k); estado("☁️","Todo guardado"); }
  catch(e){ console.error(e); estado("⚠️","No se pudo guardar: "+(e.code||e.message)); }
}
// ---------- entrar sin conexión ----------
function avisoSinConexion(volvio){
  let b = document.getElementById("nube-sinred");
  if(!b){
    b = document.createElement("div"); b.id = "nube-sinred";
    b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99996;background:#7a5a12;color:#fff;padding:8px 12px;font:13px system-ui,sans-serif;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:center";
    b.innerHTML = '<span></span><button type="button" data-a="re" style="padding:5px 12px;border-radius:8px;border:1px solid #fff;background:transparent;color:#fff;font-weight:700;cursor:pointer"></button><button type="button" data-a="x" aria-label="Cerrar aviso" style="padding:5px 9px;border-radius:8px;border:1px solid #fff;background:transparent;color:#fff;cursor:pointer">✕</button>';
    b.querySelector('[data-a="re"]').onclick = () => location.reload();
    b.querySelector('[data-a="x"]').onclick = () => b.remove();
    document.body.appendChild(b);
  }
  b.querySelector("span").textContent = volvio
    ? "🌐 Volvió internet. Toca «Sincronizar» para subir tus cambios."
    : "📴 Sin conexión (o muy lenta): trabajas con los datos de este aparato. Se subirán cuando vuelva internet.";
  b.querySelector('[data-a="re"]').textContent = volvio ? "Sincronizar" : "Reintentar";
}
function entrarSinConexion(user, p){
  perfil = p; mias = PERFILES_OK.includes(p) ? PREF.map(x => x + p) : [];
  try{ T = JSON.parse(ls("nubeT_"+uid) || "{}"); }catch(e){ T = {}; }
  try{ pend = JSON.parse(ls("nubePend_"+uid) || "[]"); }catch(e){ pend = []; }
  if(ls("dietaPerfilActivo") !== perfil){
    raw("dietaPerfilActivo", perfil);
    const veces = Number(sessionStorage.getItem("nubeRec") || 0);
    if(veces < 2){ sessionStorage.setItem("nubeRec", veces + 1); location.reload(); return; }
  }
  sessionStorage.removeItem("nubeRec");
  sinConexion = true;
  quitar(); window.__nubeOn = true; ui(); escuchar(true);
  estado("📴", "Sin conexión: tus cambios se guardan en este aparato y se subirán al volver internet");
  avisoSinConexion(false);
  // Tareas y Calendario comparten datos con la otra cuenta: sin conexión se quedan con lo de este aparato.
  const poner = () => { window.Familia = Object.assign(window.Familia || {}, { listo:false, perfil }); };
  poner(); setTimeout(poner, 0); window.addEventListener("load", poner);
}
function errorEntrada(e){
  const red = esErrorRed(e);
  const msg = red
    ? "No hay conexión y este aparato todavía no sabe quién eres. Conéctate a internet una vez para poder entrar sin conexión la próxima vez."
    : "Si dice permission-denied, tu correo todavía no está en las reglas de Firebase.";
  const d = pantalla(`<h1>No se pudo entrar</h1><p style="color:#ff9b6b">${e.code || e.message}</p><p style="color:#8a94a3">${msg}</p><button data-a="re" style="${BTN}">Reintentar</button><button data-a="salir" style="${BTN}border-color:#8a94a3;color:#8a94a3;">Salir de la cuenta</button>`);
  d.querySelector('[data-a="re"]').onclick = () => location.reload();
  d.querySelector('[data-a="salir"]').onclick = async () => {
    if(!navigator.onLine && !(await window.confirmar("Estás sin conexión: si sales de la cuenta, no podrás volver a entrar hasta que tengas internet. ¿Salir de todos modos?"))) return;
    await signOut(auth); location.reload();
  };
}

async function iniciar(user){
  uid = user.uid;
  pantalla('<p>Sincronizando…</p><p style="color:#8a94a3;font-size:.85rem">Si no hay internet, entrará con los datos de este aparato.</p>');
  if(!navigator.onLine){ const pg = perfilGuardado(uid); if(pg){ entrarSinConexion(user, pg); return; } }
  try{
    const ref = doc(db,"usuarios",uid); const s = await conTiempo(getDoc(ref));
    perfil = s.exists() ? s.data().perfil : await elegirPerfil(user, ref);
    // Cuentas creadas antes del cambio de nombres: Kakin -> Mamy, Hija -> Filha
    if(perfil === "Kakin") perfil = "Mamy"; else if(perfil === "Hija") perfil = "Filha";
    raw("nubePerfil_"+uid, perfil);
    mias = PREF.map(p => p + perfil);
    T = JSON.parse(ls("nubeT_"+uid) || "{}"); pend = JSON.parse(ls("nubePend_"+uid) || "[]");
    const snap = await conTiempo(getDocs(collection(db,"usuarios",uid,"datos"))); const nube = {}; snap.forEach(x => nube[x.id] = x.data());
    const grande = k => (ls(k) || "").length > 120;
    let modo = "auto", cambio = false;
    // Si en otro aparato (o aquí) se usó «Reiniciar mis datos», estos datos locales también se borran.
    const reinNube = Number(nube["_reinicio"] && nube["_reinicio"].t) || 0;
    if(reinNube > Number(ls("nubeRein_"+uid) || 0)){
      mias.forEach(k => localStorage.removeItem(k));
      T = {}; pend = []; guardar(); raw("nubeRein_"+uid, String(reinNube)); cambio = true;
    }
    if(ls("nubeVinc_"+uid) !== "1"){
      const hayNube = mias.some(k => nube[k]), hayLocal = mias.some(grande);
      modo = (hayNube && hayLocal) ? await preguntar() : (hayNube ? "nube" : "local");
    }
    for(const k of mias){
      const n = nube[k], l = ls(k), p = pend.includes(k);
      const subir = modo === "local" ? grande(k) : modo === "auto" ? (p || (!n && grande(k))) : false;
      const bajar = n && (modo === "nube" || (modo === "auto" && !p && n.t > (T[k] || 0)));
      if(subir) await subirClave(k);
      else if(bajar){ if(n.valor !== l){ raw(k, n.valor); cambio = true; } T[k] = n.t; }
    }
    raw("nubeVinc_"+uid, "1"); guardar();
    if(ls("dietaPerfilActivo") !== perfil){ raw("dietaPerfilActivo", perfil); cambio = true; }
    const veces = Number(sessionStorage.getItem("nubeRec") || 0);
    if(cambio && veces < 2){ sessionStorage.setItem("nubeRec", veces + 1); location.reload(); return; }
    sessionStorage.removeItem("nubeRec");
    quitar(); window.__nubeOn = true; ui(); escuchar();
    // ---------- Fase 2: expone lo necesario para que familia.js (tareas/calendario compartidos) use la misma conexión ----------
    window.__familia = {
      db, doc, getDoc, setDoc, onSnapshot, updateDoc, deleteDoc, collection, getDocs,
      uid, perfil, email: user.email.toLowerCase()
    };
    window.dispatchEvent(new Event("familia-lista"));
  }catch(e){
    console.error(e);
    if(window.__nubeOn) return;   // el fallo fue después de entrar: no se vuelve a montar nada
    const pg = esErrorRed(e) ? perfilGuardado(uid) : null;
    if(pg){ entrarSinConexion(user, pg); return; }
    errorEntrada(e);
  }
}
function escuchar(sin){
  window.addEventListener("nube-cambio", () => {
    for(const k in window.__nubeSucias) if(mias.includes(k) && !pend.includes(k)) pend.push(k);
    window.__nubeSucias = {}; guardar();
    if(sin){ estado("📴", "Sin conexión: guardado en este aparato, se subirá al volver internet"); return; }
    estado("⏳","Guardando…");
    clearTimeout(timer); timer = setTimeout(enviar, 1500);
  });
  if(sin){ window.addEventListener("online", () => { estado("🌐", "Volvió internet: toca para sincronizar"); avisoSinConexion(true); }); return; }
  window.addEventListener("online", enviar);
  document.addEventListener("visibilitychange", () => { if(document.hidden) enviar(); });
  setInterval(() => { if(pend.length) enviar(); }, 30000);
  if(pend.length) enviar();
}

// «Reiniciar mis datos» (se usa desde Ajustes): borra tus datos personales en la nube y en este aparato.
// Deja una marca en la nube para que tus otros aparatos también se vacíen la próxima vez que abran la app con conexión.
// No toca lo compartido (Casa, Calendario, Invitaciones), ni las claves, ni tu ficha de perfil.
window.__nubeReiniciar = async () => {
  if(!uid || !perfil || !window.__nubeOn) throw new Error("La sincronización no está activa. Recarga la página e inténtalo de nuevo.");
  if(sinConexion || !navigator.onLine) throw new Error("Hace falta conexión a internet para reiniciar.");
  const ids = [...mias];
  for(const k of ids) await conTiempo(deleteDoc(doc(db,"usuarios",uid,"datos",k)), 15000);
  const t = Date.now();
  await conTiempo(setDoc(doc(db,"usuarios",uid,"datos","_reinicio"), { t }), 15000);
  ids.forEach(k => localStorage.removeItem(k));
  T = {}; pend = []; guardar(); raw("nubeRein_"+uid, String(t));
};

// Fase 4: tras restaurar una copia, Ajustes pide subir ya lo restaurado y comprueba si quedó algo pendiente.
window.__nubeEnviar = async () => { if(!uid || sinConexion || !window.__nubeOn) return false; await enviar(); return pend.length === 0; };

// ---------- pastilla y ajustes de pantalla ----------
let pill;
function estado(ico, txt){ if(pill){ pill.querySelector("span").textContent = ico; pill.title = txt; } }
function ui(){
  const st = document.createElement("style"); st.textContent = ".tabs-perfil,.perfiles{display:none!important;}"; document.head.appendChild(st);
  if(window.elegirPerfil) window.elegirPerfil(perfil);
  const fs = document.querySelector(".perfiles")?.closest("fieldset");
  if(fs){ if(perfil === "Filha") fs.style.display = "none"; else { const lg = fs.querySelector("legend"); if(lg) lg.textContent = "1. ¿Cómo estás hoy?"; } }
  pill = document.createElement("button"); pill.type = "button";
  pill.style.cssText = "display:flex;align-items:center;gap:4px;padding:3px 10px 3px 4px;border-radius:20px;border:1px solid #2a3242;background:#1b2330;color:#e8ecf2;font-size:.85rem;cursor:pointer;";
  pill.innerHTML = gato(perfil,26) + `<b>${LETRA[perfil]}</b><span>☁️</span>`;
  const barra = document.createElement("div"); barra.style.cssText = "position:fixed;left:10px;bottom:10px;z-index:9999;display:flex;align-items:center;gap:8px;";
  barra.appendChild(pill);
  // Atajo para volver al inicio («Hola…») desde cualquier pantalla, menos desde el propio inicio.
  if(!/(^|\/)(index\.html)?$/.test(location.pathname)){
    const casa = document.createElement("a"); casa.href = "index.html"; casa.title = "Volver al inicio"; casa.setAttribute("aria-label", "Volver al inicio"); casa.textContent = "🏠";
    casa.style.cssText = "display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;border:1px solid #2a3242;background:#1b2330;color:#e8ecf2;font-size:1.05rem;text-decoration:none;";
    barra.appendChild(casa);
  }
  document.body.appendChild(barra);
  pill.onclick = () => {
    if(sinConexion){
      const d = pantalla(`<div style="display:flex;justify-content:center">${gato(perfil,72)}</div><h2>${LETRA[perfil]} · ${auth.currentUser?.email || ""}</h2><p style="color:#8a94a3">Sin conexión. Tus cambios se guardan en este aparato y se subirán cuando vuelva internet.</p>
        <button data-a="re" style="${BTN}">Reintentar conexión</button><button data-a="cerrar" style="${BTN}">Volver</button>`);
      d.querySelector('[data-a="re"]').onclick = () => location.reload();
      d.querySelector('[data-a="cerrar"]').onclick = quitar;
      return;
    }
    const d = pantalla(`<div style="display:flex;justify-content:center">${gato(perfil,72)}</div><h2>${LETRA[perfil]} · ${auth.currentUser?.email || ""}</h2>
      <button data-a="sync" style="${BTN}">Sincronizar ahora</button><button data-a="salir" style="${BTN}">Salir de la cuenta</button><button data-a="cerrar" style="${BTN}">Volver</button>`);
    d.querySelectorAll("button").forEach(b => b.onclick = async () => {
      if(b.dataset.a === "cerrar") quitar();
      else if(b.dataset.a === "sync"){ await enviar(); raw("nubeVinc_"+uid, "1"); location.reload(); }
      else { await enviar(); await signOut(auth); location.reload(); }
    });
  };
}

pantalla("<p>Cargando…</p>");
onAuthStateChanged(auth, u => u ? iniciar(u) : mostrarLogin());
