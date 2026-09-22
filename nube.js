// nube.js — entrada con Google + copia en la nube (Firebase). Fase 1: Nutrición y Ejercicios.
let initializeApp, getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, getFirestore, doc, getDoc, setDoc, getDocs, collection;
try{
  ({ initializeApp } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"));
  ({ getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"));
  ({ getFirestore, doc, getDoc, setDoc, getDocs, collection } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"));
}catch(e){
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99998;background:#7a1f1f;color:#fff;padding:10px 14px;font:14px system-ui,sans-serif;text-align:center";
  d.textContent = "⚠️ No se pudo cargar el código de Google/Firebase (fallo de red o bloqueado por una extensión/filtro). Detalle: " + (e && e.message ? e.message : e);
  (document.body || document.documentElement).appendChild(d);
  throw e;
}
window.__nubeVivo = true;
const app = initializeApp({ apiKey:"AIzaSyDYK1EoCKWyX_zvNk0XCu8KKxawgk4v598", authDomain:"gatslife0470.firebaseapp.com", projectId:"gatslife0470", storageBucket:"gatslife0470.firebasestorage.app", messagingSenderId:"235893987189", appId:"1:235893987189:web:733eeb67e6ad46f2aca53c" });
const auth = getAuth(app), db = getFirestore(app);

// Solo se sincronizan estos datos, y solo los de tu perfil (terminan en _Kakin o _Hija).
const PREF = ["dietaDiarioV3_","dietaRecetasV1_","dietaRepartoV1_","dietaFrecuentesV1_","dietaFiltrosV1_","dietaMedidasV1_","dietaPerfilDatosV1_","ejercicioHistorial_","fam_ex_rutina_"];
const COL = { Kakin:["#a9b1bf","#d93b3b"], Hija:["#f4e8d4","#8f5ae6"] };
const LETRA = { Kakin:"M", Hija:"F" };
const GATO = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="7,26 8,9 21,17" fill="{B}"/><polygon points="41,26 40,9 27,17" fill="{B}"/><polygon points="10,23 11,13 18,18" fill="#f2b8c6"/><polygon points="38,23 37,13 30,18" fill="#f2b8c6"/><ellipse cx="24" cy="30" rx="17" ry="14" fill="{B}"/><ellipse cx="18" cy="30" rx="2.2" ry="2.6" fill="#1b1b24"/><ellipse cx="30" cy="30" rx="2.2" ry="2.6" fill="#1b1b24"/><polygon points="22,34 26,34 24,36.5" fill="#f08aa0"/><path d="M24 36.5v2M24 38.5q-2.5 2-4.5.5M24 38.5q2.5 2 4.5.5" stroke="#1b1b24" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M12 34l-7-1.5M12 37l-7 1.5M36 34l7-1.5M36 37l7 1.5" stroke="#1b1b24" stroke-width="1" opacity=".55" stroke-linecap="round"/><ellipse cx="26" cy="15" rx="15" ry="6.5" transform="rotate(-9 26 15)" fill="{R}"/><rect x="21.5" y="6" width="3.4" height="3.8" rx="1.4" fill="{R}" transform="rotate(-9 23 8)"/></svg>';
const gato = (p, px=64) => GATO.replace("{B}",COL[p][0]).replace("{R}",COL[p][1]).replace("<svg ",`<svg width="${px}" height="${px}" `);
const raw = (k,v) => window.__nubeRaw(k,v);
const ls = k => localStorage.getItem(k);

let uid, perfil, mias = [], T = {}, pend = [], timer;
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
const dosGatos = `<div style="display:flex;justify-content:center;gap:4px">${gato("Kakin",84)}${gato("Hija",84)}</div>`;

function traducir(e){
  const m = { "auth/popup-closed-by-user":"Cerraste la ventana antes de terminar. Prueba de nuevo.",
    "auth/popup-blocked":"El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio.",
    "auth/unauthorized-domain":"Esta dirección no está autorizada en Firebase (Authentication → Configuración → Dominios autorizados).",
    "auth/operation-not-allowed":"El inicio con Google no está activado en Firebase (Authentication → Método de acceso).",
    "auth/network-request-failed":"No hay conexión a internet." };
  return m[e.code] || ("Error: " + (e.code || e.message));
}
function mostrarLogin(msg){
  const d = pantalla(`${dosGatos}<h1>Nuestra App</h1><p style="color:#8a94a3">Entra con tu cuenta de Google.</p><button id="nube-go" style="${BTN}">Entrar con Google</button><p id="nube-msg" style="color:#ff9b6b">${msg || ""}</p>`);
  d.querySelector("#nube-go").onclick = async () => { try{ sessionStorage.setItem("nubeYendo","1"); await signInWithRedirect(auth, new GoogleAuthProvider()); }catch(e){ sessionStorage.removeItem("nubeYendo"); d.querySelector("#nube-msg").textContent = traducir(e); } };
}
async function elegirPerfil(user, ref, aviso=""){
  const d = pantalla(`<h1>¿Quién eres?</h1><p style="color:#8a94a3">Se elige una sola vez para esta cuenta.</p>
    <div style="display:flex;gap:12px"><button data-p="Kakin" style="${BTN}">${gato("Kakin")}<br>M</button><button data-p="Hija" style="${BTN}">${gato("Hija")}<br>F</button></div><p style="color:#ff9b6b">${aviso}</p>`);
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
async function iniciar(user){
  uid = user.uid; pantalla("<p>Sincronizando…</p>");
  try{
    const ref = doc(db,"usuarios",uid); const s = await getDoc(ref);
    perfil = s.exists() ? s.data().perfil : await elegirPerfil(user, ref);
    mias = PREF.map(p => p + perfil);
    T = JSON.parse(ls("nubeT_"+uid) || "{}"); pend = JSON.parse(ls("nubePend_"+uid) || "[]");
    const snap = await getDocs(collection(db,"usuarios",uid,"datos")); const nube = {}; snap.forEach(x => nube[x.id] = x.data());
    const grande = k => (ls(k) || "").length > 120;
    let modo = "auto", cambio = false;
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
  }catch(e){
    console.error(e);
    const d = pantalla(`<h1>No se pudo entrar</h1><p style="color:#ff9b6b">${e.code || e.message}</p><p style="color:#8a94a3">Si dice permission-denied, tu correo todavía no está en las reglas de Firebase.</p><button style="${BTN}">Salir</button>`);
    d.querySelector("button").onclick = async () => { await signOut(auth); location.reload(); };
  }
}
function escuchar(){
  window.addEventListener("nube-cambio", () => {
    for(const k in window.__nubeSucias) if(mias.includes(k) && !pend.includes(k)) pend.push(k);
    window.__nubeSucias = {}; guardar(); estado("⏳","Guardando…");
    clearTimeout(timer); timer = setTimeout(enviar, 1500);
  });
  window.addEventListener("online", enviar);
  document.addEventListener("visibilitychange", () => { if(document.hidden) enviar(); });
  setInterval(() => { if(pend.length) enviar(); }, 30000);
  if(pend.length) enviar();
}

// ---------- pastilla y ajustes de pantalla ----------
let pill;
function estado(ico, txt){ if(pill){ pill.querySelector("span").textContent = ico; pill.title = txt; } }
function ui(){
  const st = document.createElement("style"); st.textContent = ".tabs-perfil,.perfiles{display:none!important;}"; document.head.appendChild(st);
  if(window.elegirPerfil) window.elegirPerfil(perfil);
  const fs = document.querySelector(".perfiles")?.closest("fieldset");
  if(fs){ if(perfil === "Hija") fs.style.display = "none"; else { const lg = fs.querySelector("legend"); if(lg) lg.textContent = "1. ¿Cómo estás hoy?"; } }
  pill = document.createElement("button"); pill.type = "button";
  pill.style.cssText = "position:fixed;left:10px;bottom:10px;z-index:9999;display:flex;align-items:center;gap:4px;padding:3px 10px 3px 4px;border-radius:20px;border:1px solid #2a3242;background:#1b2330;color:#e8ecf2;font-size:.85rem;cursor:pointer;";
  pill.innerHTML = gato(perfil,26) + `<b>${LETRA[perfil]}</b><span>☁️</span>`; document.body.appendChild(pill);
  pill.onclick = () => {
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
let resuelto = false;
const feo = "No se pudo confirmar la entrada con Google (se quedó esperando una respuesta que nunca llegó). Puede ser que el navegador esté bloqueando cookies entre sitios. Prueba: 1) recargar, 2) si sigue igual, permite las cookies para este sitio, o prueba en otro navegador (Chrome normal, sin modo incógnito).";
const vigia = setTimeout(() => { if(!resuelto){ sessionStorage.removeItem("nubeYendo"); mostrarLogin(feo); } }, 8000);
getRedirectResult(auth).catch(e => { sessionStorage.removeItem("nubeYendo"); window.__nubeErrRedirect = traducir(e); });
onAuthStateChanged(auth, u => {
  resuelto = true; clearTimeout(vigia);
  if(u) return iniciar(u);
  if(sessionStorage.getItem("nubeYendo") === "1" && !window.__nubeErrRedirect){ resuelto = false; setTimeout(() => { if(!resuelto){ sessionStorage.removeItem("nubeYendo"); mostrarLogin(feo); } }, 6000); return; } // volviendo de Google, esperar un poco más
  sessionStorage.removeItem("nubeYendo");
  mostrarLogin(window.__nubeErrRedirect);
});
