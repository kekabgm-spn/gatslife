// claves.js — claves de IA y YouTube (por aparato), tope diario y respaldo.
// Regla: la clave 2 solo se usa si la 1 es inválida o fue revocada. Si se agota la cuota (error 429) NO se cambia de clave ni se reintenta.
(function(){
  // Dirección de tu Worker de Cloudflare (sin barra al final). Si está vacía, la app usa las claves guardadas en este aparato como antes.
  var PROXY = "https://gatslife-ia.kekabgm.workers.dev";
  var K = {gem:["dietaGeminiKey","dietaGeminiKey2"], yt:["fam_ex_yt_key","fam_ex_yt_key2"], modelo:"dietaGeminiModelo", tope:"iaTopeDia", cont:"iaConteoV1"};
  try{ localStorage.removeItem("iaCacheV1"); }catch(e){} // limpia la memoria antigua
  function leer(k){ try{ return (localStorage.getItem(k)||"").trim(); }catch(e){ return ""; } }
  function proxyOn(){ return /^https:\/\//i.test(PROXY); }
  function base(){ return PROXY.replace(/\/+$/, ""); }
  async function token(){
    for(var i=0; i<40 && !window.__nubeToken; i++) await new Promise(function(r){ setTimeout(r, 250); }); // espera a que cargue el inicio de sesión (hasta 10 s)
    if(!window.__nubeToken) throw new Error("No cargó el inicio de sesión. Revisa tu conexión e inténtalo de nuevo.");
    var t = await window.__nubeToken();
    if(!t) throw new Error("Inicia sesión con Google para usar la IA.");
    return t;
  }
  async function viaProxy(ruta, opciones){
    var tok = await token(); opciones = opciones || {}; opciones.headers = Object.assign({Authorization:"Bearer " + tok}, opciones.headers || {});
    try{ return await fetch(base() + ruta, opciones); }
    catch(e){ throw new Error("No pude conectar con tu servidor de claves (Worker). Revisa internet o la dirección PROXY en claves.js."); }
  }
  function lista(ids){ return ids.map(leer).filter(Boolean); }
  function hoy(){ var d=new Date(); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }
  function conteo(){ try{ var c=JSON.parse(localStorage.getItem(K.cont)); if(c && c.f===hoy()) return c; }catch(e){} return {f:hoy(), n:0}; }
  function tope(){ var t=parseInt(leer(K.tope),10); return t>0 ? t : 40; }
  var enCurso = 0; // hora en que empezó la petición activa (0 = ninguna); caduca a los 90 s por si algo se cuelga
  function sumar(){ var c=conteo(); c.n++; try{ localStorage.setItem(K.cont, JSON.stringify(c)); }catch(e){} }
  function claveMala(status, err){
    var m = (err && err.message) || "";
    if(/quota|exhausted|limit exceeded|rate/i.test(m) || status===429) return false;      // cuota: nunca se cambia de clave
    return (status===400 && /api key|keyinvalid/i.test(m)) || (status===403 && /api key|permission|denied|leaked|expired|forbidden|not configured/i.test(m));
  }
  function msg(status, err){
    var m = (err && err.message) || ("Error " + status);
    if(status===429) return "Se agotó la cuota de la IA por ahora (error 429). No reintento solo: espera un rato o a mañana. Detalle: " + m;
    return m;
  }
  window.IAClaves = {
    proxyActivo: function(){ return proxyOn(); },
    tieneGemini: function(){ return proxyOn() || lista(K.gem).length > 0; },
    tieneSpoonacular: function(){ return proxyOn() || !!leer("dietaSpoonacularKey"); },
    // Bases de alimentos privadas (BEDCA y AESAN): se piden al Worker (solo responde a tus cuentas con sesión) y se guardan en el aparato
    // 30 días para no descargarlas cada vez ni gastar datos. Si no hay conexión se usa la copia guardada aunque sea antigua.
    datos: async function(nombre){
      var DIAS30 = 30*864e5, ruta = "/datos/" + encodeURIComponent(nombre), clave = new Request(base() + ruta), cache = null, guardada = null;
      try{ cache = await caches.open("datos-privados-v1"); guardada = await cache.match(clave); }catch(e){}
      if(guardada){
        var t = parseInt(guardada.headers.get("x-guardado"), 10) || 0;
        if(Date.now() - t < DIAS30){ try{ return await guardada.clone().json(); }catch(e){} }
      }
      try{
        if(!proxyOn()) throw new Error("No está configurada la dirección del Worker (PROXY) en claves.js.");
        var r = await viaProxy(ruta);
        if(!r.ok){ var d = {}; try{ d = await r.json(); }catch(e){} throw new Error((d.error && d.error.message) || ("Error " + r.status)); }
        var texto = await r.text(), json = JSON.parse(texto);
        if(cache){ try{ await cache.put(clave, new Response(texto, {headers:{"Content-Type":"application/json", "x-guardado": String(Date.now())}})); }catch(e){} }
        return json;
      }catch(e){
        if(guardada){ try{ return await guardada.clone().json(); }catch(e2){} }
        throw e;
      }
    },
    usoHoy: function(){ return {usadas: conteo().n, tope: tope()}; },
    gemini: async function(body){
      var usaProxy = proxyOn(), claves = usaProxy ? [null] : lista(K.gem), modelo = leer(K.modelo) || "gemini-3.1-flash-lite";
      // La búsqueda de Google NO es gratis en los modelos 3.x: si la petición lleva esa herramienta se usa un modelo 2.5 (cambiable en localStorage "dietaGeminiModeloWeb").
      if(body && Array.isArray(body.tools) && body.tools.some(function(t){ return t && (t.google_search || t.googleSearch); })) modelo = leer("dietaGeminiModeloWeb") || "gemini-2.5-flash";
      if(enCurso && Date.now() - enCurso < 90000) throw new Error("Ya hay una petición a la IA en curso. Espera a que termine.");
      if(!usaProxy && !claves.length) throw new Error("Falta la clave de Gemini. Ponla una vez en ⚙️ Ajustes.");
      if(conteo().n >= tope()) throw new Error("Llegaste al tope diario de llamadas a la IA (" + tope() + "). Se reinicia mañana; puedes cambiarlo en ⚙️ Ajustes.");
      var ultimo = null;
      enCurso = Date.now();
      try{
      for(var i=0; i<claves.length; i++){
        sumar();
        var resp = usaProxy
          ? await viaProxy("/gemini", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({model:modelo, body:body})})
          : await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelo) + ":generateContent",
          {method:"POST", headers:{"Content-Type":"application/json","x-goog-api-key":claves[i]}, body:JSON.stringify(body)});
        var data = {}; try{ data = await resp.json(); }catch(e){}
        if(resp.ok && !data.error) return data;
        ultimo = new Error(msg(resp.status, data.error));
        if(usaProxy || !claveMala(resp.status, data.error)) throw ultimo;
      }
      throw ultimo;
      } finally { enCurso = 0; }
    },
    geminiTexto: async function(prompt){
      var data = await this.gemini({contents:[{parts:[{text:prompt}]}]});
      var t = (((data.candidates||[])[0]||{}).content||{}).parts; t = ((t||[])[0]||{}).text || "";
      return t.replace(/```json|```/g, "").trim();
    },
    youtube: async function(urlSinClave){
      if(proxyOn()){
        var rq = await viaProxy("/youtube?" + urlSinClave.split("?").slice(1).join("?")), dq = {}; try{ dq = await rq.json(); }catch(e){}
        if(rq.ok && !dq.error) return dq;
        throw new Error((dq.error && dq.error.message) || "Error de YouTube API");
      }
      var claves = lista(K.yt);
      if(!claves.length) throw new Error("Falta la clave de YouTube. Ponla en Ajustes (⚙️).");
      var ultimo = null;
      for(var i=0; i<claves.length; i++){
        var resp = await fetch(urlSinClave + "&key=" + encodeURIComponent(claves[i]));
        var data = {}; try{ data = await resp.json(); }catch(e){}
        if(resp.ok && !data.error) return data;
        ultimo = new Error((data.error && data.error.message) || "Error de YouTube API");
        if(!claveMala(resp.status, data.error)) throw ultimo;
      }
      throw ultimo;
    },
    spoonacular: async function(urlSinClave){
      var r, d = {};
      if(proxyOn()){ r = await viaProxy("/spoonacular?" + urlSinClave.split("?").slice(1).join("?")); }
      else { var k = leer("dietaSpoonacularKey"); if(!k) throw new Error("Falta la clave de Spoonacular."); r = await fetch(urlSinClave + "&apiKey=" + encodeURIComponent(k)); }
      try{ d = await r.json(); }catch(e){}
      if(r.ok || (d && d.status === "failure")) return d;
      throw new Error((d && d.error && d.error.message) || "Error de Spoonacular.");
    }
  };
})();
