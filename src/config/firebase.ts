import { initializeApp, type FirebaseApp } from 'firebase/app'

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
