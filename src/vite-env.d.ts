/// <reference types="vite/client" />

// Variables de entorno de Firebase (Cláusula IV: credenciales SOLO en env vars VITE_).
// Copiá .env.example a .env y completá estos valores para correr el harness de desarrollo.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_APP_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
