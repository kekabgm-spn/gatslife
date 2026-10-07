/**
 * @file sintesis-ia.js
 * @description Llama al Worker de Cloudflare (ver /cloudflare-worker) para
 *   generar la Vista de lectura completa de una tirada (formato "El
 *   Corazón Dividido": párrafo + Aspectos positivos + Aspectos a
 *   considerar por posición, más Síntesis y Mensaje final). Reescrito
 *   26/9/2026 para el formato nuevo — la función vieja (intentarSintesis,
 *   un párrafo corto) ya no se usa en ningún lado.
 *
 *   Diseñado para no romper nada si el Worker todavía no está
 *   desplegado o configurado: si WORKER_URL está vacío, o la llamada
 *   falla o tarda demasiado, se devuelve null y quien llama debe mostrar
 *   una versión de respaldo — nunca se debe dejar al usuario mirando
 *   "Generando..." para siempre.
 *
 * @exports generarLecturaCompleta
 */

import { obtenerIdToken } from './auth.js';

// URL del Worker desplegado en Cloudflare (ver cloudflare-worker/README.md).
// Vacío = esta función no hace nada, y quien la llama debe mostrar su
// propio contenido de respaldo.
const WORKER_URL = 'https://small-river-7822.kekainsight.workers.dev';

// La respuesta ahora es mucho más larga que el párrafo corto original
// (varias cartas, viñetas, síntesis) — el timeout viejo (6s) se queda
// corto casi siempre. 25s da margen sin dejar a alguien esperando
// eternamente si el Worker no contesta.
const TIMEOUT_MS = 25000;

/**
 * @param {object} datos
 * @param {string} datos.idTirada
 * @param {string} datos.nombreTirada
 * @param {Array<{posicion:string, significado:string, carta:string, orientacion:string, caracteristicas:string, tendencia:string, alerta:string, decisiones:string}>} datos.cartas
 * @param {Array<{carta1:string, carta2:string, interpretacion:string, momento:string, evolucion:string, consejo:string}>} [datos.combinaciones]
 *   Combinaciones ya escritas entre pares de cartas (hasta 5, las
 *   principales) — agregado 26/9/2026 para que la Síntesis se apoye en
 *   texto real en vez de que Gemini la infiera solo de cartas sueltas.
 * @returns {Promise<string|null>} el texto completo generado, o null si
 *   no se pudo (Worker no configurado, error de red, timeout, etc.)
 */
export async function generarLecturaCompleta({ idTirada, nombreTirada, cartas, combinaciones }) {
  if (!WORKER_URL) return null;

  // FIX 3/10/2026: el Worker ahora exige estar logueado con un correo
  // autorizado (ver cloudflare-worker/sintesis-respuesta.js). Sin token
  // ni siquiera vale la pena intentar — el muro de login (muro-login.js)
  // ya debería haber bloqueado la página antes de llegar acá, esto es
  // un respaldo por si algo llama a esta función de otra forma.
  const idToken = await obtenerIdToken();
  if (!idToken) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ idTirada, nombreTirada, cartas, combinaciones: combinaciones || [] }),
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.texto || null;
  } catch (err) {
    // Timeout, red caída, CORS mal configurado, lo que sea — nunca rompe
    // la página, solo se cae al contenido de respaldo.
    console.warn('[sintesis-ia] No se pudo generar la lectura:', err?.message || err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
