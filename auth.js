/**
 * @file auth.js
 * @description Wrapper de Firebase Authentication — email/contraseña y
 *   Google, según lo definido (ambas opciones). No expone objetos crudos
 *   de Firebase fuera de este módulo; el resto de la app solo conoce
 *   estas funciones.
 *
 * @exports registrarse, iniciarSesion, iniciarSesionConGoogle,
 *   cerrarSesion, onCambioAuth, getUsuarioActual
 */

import { auth } from './firebase-init.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as _signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';

const _googleProvider = new GoogleAuthProvider();

/**
 * Crea una cuenta nueva con email y contraseña.
 * @throws {Error} código Firebase, ej. 'auth/email-already-in-use'
 */
export async function registrarse(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Inicia sesión con email y contraseña existentes.
 * @throws {Error} código Firebase, ej. 'auth/invalid-credential'
 */
export async function iniciarSesion(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Inicia sesión con Google (popup). Sirve tanto para registro como
 * para login — Firebase crea la cuenta la primera vez automáticamente.
 */
export async function iniciarSesionConGoogle() {
  const cred = await signInWithPopup(auth, _googleProvider);
  return cred.user;
}

export async function cerrarSesion() {
  await _signOut(auth);
}

/**
 * Suscribe un callback a cambios de sesión (login/logout, y el estado
 * inicial al cargar la página). Devuelve la función de desuscripción.
 * @param {(user: object|null) => void} callback
 */
export function onCambioAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getUsuarioActual() {
  return auth.currentUser;
}

/**
 * ID token de Firebase del usuario logueado, para mandar al Worker de
 * Cloudflare como "Authorization: Bearer <esto>" (ver sintesis-ia.js y
 * cloudflare-worker/sintesis-respuesta.js). Firebase lo renueva solo
 * si ya venció (dura 1 hora); null si no hay nadie logueado.
 */
export async function obtenerIdToken() {
  return auth.currentUser ? await auth.currentUser.getIdToken() : null;
}

/**
 * Traduce los códigos de error más comunes de Firebase Auth a mensajes
 * en español. No cubre todos los códigos posibles — para los no
 * mapeados, devuelve un mensaje genérico en vez del código crudo.
 */
export function mensajeError(error) {
  const MAPA = {
    'auth/email-already-in-use': 'Ese email ya tiene una cuenta. Probá iniciar sesión.',
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/invalid-email': 'El email no es válido.',
    'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/too-many-requests': 'Demasiados intentos. Probá de nuevo en un rato.',
  };
  return MAPA[error?.code] || 'Ocurrió un error. Probá de nuevo.';
}
