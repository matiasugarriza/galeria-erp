import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

// Configuración leída EXCLUSIVAMENTE de variables de entorno VITE_ (Cláusula IV).
// El módulo exportado nunca expone esta configuración al consumidor del plugin ERP.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null

/** Devuelve la instancia única de la app de Firebase (inicialización perezosa). */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig)
  }
  return app
}

/**
 * Firestore de la aplicación (spec 007, FR-1): la grilla se alimenta de la
 * colección `fotos`, escrita sólo por la Cloud Function (lectura pública).
 *
 * Es perezoso a propósito: importar el módulo sin `VITE_FIREBASE_PROJECT_ID`
 * no debe romper el arranque (misma política que `getFirebaseApp`).
 */
export function getDb(): Firestore {
  return getFirestore(getFirebaseApp())
}
