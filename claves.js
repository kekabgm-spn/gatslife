// claves.js — claves de IA y YouTube (por aparato), tope diario y respaldo.
// Regla: la clave 2 solo se usa si la 1 es inválida o fue revocada. Si se agota la cuota (error 429) NO se cambia de clave ni se reintenta.
(function(){
  var K = {gem:["dietaGeminiKey","dietaGeminiKey2"], yt:["fam_ex_yt_key","fam_ex_yt_key2"], modelo:"dietaGeminiModelo", tope:"iaTopeDia", cont:"iaConteoV1"};
  try{ localStorage.removeItem("iaCacheV1"); }catch(e){} // limpia la memoria antigua
  function leer(k){ try{ return (localStorage.getItem(k)||"").trim(); }catch(e){ return ""; } }
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
    tieneGemini: function(){ return lista(K.gem).length > 0; },
    usoHoy: function(){ return {usadas: conteo().n, tope: tope()}; },
    gemini: async function(body){
      var claves = lista(K.gem), modelo = leer(K.modelo) || "gemini-3.1-flash-lite";
      if(enCurso && Date.now() - enCurso < 90000) throw new Error("Ya hay una petición a la IA en curso. Espera a que termine.");
      if(!claves.length) throw new Error("Falta la clave de Gemini. Ponla una vez en ⚙️ Ajustes.");
      if(conteo().n >= tope()) throw new Error("Llegaste al tope diario de llamadas a la IA (" + tope() + "). Se reinicia mañana; puedes cambiarlo en ⚙️ Ajustes.");
      var ultimo = null;
      enCurso = Date.now();
      try{
      for(var i=0; i<claves.length; i++){
        sumar();
        var resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelo) + ":generateContent",
          {method:"POST", headers:{"Content-Type":"application/json","x-goog-api-key":claves[i]}, body:JSON.stringify(body)});
        var data = {}; try{ data = await resp.json(); }catch(e){}
        if(resp.ok && !data.error) return data;
        ultimo = new Error(msg(resp.status, data.error));
        if(!claveMala(resp.status, data.error)) throw ultimo;
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
    }
  };
})();
