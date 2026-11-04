# 🖼️ Galería de Imágenes — Standalone & ERP Plugin

Galería de imágenes en tiempo real sobre **Firebase Storage**, con doble modo de uso:

1. **Standalone** — app web completa e independiente (`App.tsx`).
2. **ERP Plugin** — el mismo componente `ImageGallery` embebido en un módulo del ERP corporativo mediante props.

Desarrollada con un pipeline **SpecKit** (specs → plan → tasks → implementación): 6 features implementadas, testeadas y documentadas en [`specs/`](./specs/).

---

## ✨ Puntos clave

| # | Feature | Spec | Qué resuelve |
|---|---------|------|--------------|
| 001 | Galería | [`specs/001-gallery-view`](./specs/001-gallery-view) | Grilla responsiva, lightbox, listado en tiempo real desde Storage |
| 002 | Subida | [`specs/002-image-upload`](./specs/002-image-upload) | Modal con drag & drop, validación de formato/tamaño (10 MB), progreso y errores visibles |
| 003 | Filtro | [`specs/003-image-filter`](./specs/003-image-filter) | Búsqueda por nombre (normaliza tildes/mayúsculas) y filtro por carpeta (`filterTag`) |
| 004 | Integración ERP | [`specs/004-erp-integration`](./specs/004-erp-integration) | Callbacks `onSelectImage` / `onUploadSuccess` / `onDeleteImage` y demo dual-mode |
| 005 | Eliminación | [`specs/005-image-deletion`](./specs/005-image-deletion) | Confirmación (`ConfirmDialog`), `deleteObject` y remoción inmediata de la grilla |
| 006 | Pipeline servidor | [`specs/006-image-pipeline`](./specs/006-image-pipeline) | Cloud Function `onFinalize` (Python/Pillow): recorte 4:3, JPEG sRGB ≤300 KB, naming convencionado |

Decisiones de diseño que conviene conocer:

- **Credenciales sólo en env vars `VITE_*`** (Cláusula IV): nada hardcodeado; `src/config/firebase.ts` es el único punto de lectura y `src/index.ts` no expone config interna al consumidor del ERP.
- **Sin librerías UI externas**: todo el diseño es Tailwind v4 + componentes nativos de React (Regla de Oro de `AGENTS.md`).
- **Tipos centralizados**: todos los tipos viven en `src/types/gallery.ts` (nada de `any` ni `@ts-ignore`; TypeScript estricto).
- **Anti-reprocesamiento (FR-25)**: el pipeline marca `customMetadata.pipeline=done` en la salida para que un segundo evento no vuelva a deformar la imagen ya rellenada.
- **Sanitización de nombres con case preservado**: `sanitizar("Código") === "Codigo"` (decisión del conflicto FR-22 vs FR-24).
- **Gap conocido**: la eliminación vive sólo en las miniaturas de la grilla; `ImageModal.tsx` no existe y no tiene spec (candidato a spec 007).

---

## 🛠️ Stack

- **Core:** React `^19.3.0` + TypeScript `^7.0.2`
- **Build:** Vite `^8.3.1` (module type)
- **Estilos:** Tailwind CSS `^4.3.3` (`@tailwindcss/vite`)
- **Iconos:** `lucide-react` `^1.48.0`
- **Backend:** Firebase JS SDK (`firebase/storage`, `firebase/app`)
- **Testing:** Vitest `^5.0.2` (frontend) + pytest (backend)
- **Pipeline servidor:** Python + Pillow en [`functions/`](./functions/)

---

## 📂 Estructura

```text
src/
├── components/ImageGallery/
│   ├── ImageGallery.tsx      # Componente raíz (orquestador UI)
│   ├── GalleryGrid.tsx       # Grilla responsiva y miniaturas
│   ├── ImageModal.tsx        # (no existe aún — gap documentado)
│   ├── ConfirmDialog.tsx     # Confirmación de borrado
│   ├── UploadModal.tsx       # Modal / drag & drop de subida
│   └── searchUtils.ts        # Normalización de búsqueda
├── config/firebase.ts        # Inicialización (lee env vars VITE_)
├── services/storageService.ts# listImages / uploadImage / deleteImage
├── types/gallery.ts          # Interfaces y types
├── index.ts                  # Exportación pública (plugin ERP)
└── App.tsx                   # Demo standalone + modo ERP

functions/                    # Backend Python (fuera de src/ — Cláusula I)
├── pipeline.py               # Orden de procesamiento (FR-7)
├── naming.py                 # sanitizar / calcular_destino
├── main.py                   # Handler onFinalize (FR-25)
├── requirements.txt
└── tests/                    # 30 tests pytest

specs/                        # Specs 001–006 (español, escenarios verbatim)
storage.rules                 # Reglas de Storage (públicas, desplegadas — ver Estado)
firebase.json                 # Config de deploy (functions + storage)
```

---

## 🚀 Puesta en marcha

### Requisitos

- **Node.js 24 LTS** (recomendado; Node 22 funciona con warnings `EBADENGINE`)
- **npm** — en Windows PowerShell usá `npm.cmd` (la política de ejecución bloquea `npm.ps1`)
- **Python 3.12+** sólo si vas a correr el backend de la spec 006

### 1. Instalar dependencias

```bash
npm.cmd install
```

### 2. Configurar Firebase (variables de entorno)

Creá un archivo `.env` en la raíz con los datos de tu proyecto Firebase (Consola → Configuración de tu app → SDK):

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

> ⚠️ Sin `.env`, la app arranca pero muestra estado de carga/error porque no puede inicializar Firebase. Nunca subas `.env` al repositorio.

### 3. Levantar la app

```bash
npm.cmd run dev        # servidor de desarrollo (Vite)
```

Abrí la URL que imprime Vite (por defecto `http://localhost:5173`). Verás dos secciones: **Modo Standalone** (lista la raíz del bucket) y **Modo ERP** (plugin con `filterTag="migradas"` — la carpeta con las imágenes migradas — y callbacks).

### 4. Scripts disponibles

| Comando | Qué hace |
|---------|----------|
| `npm.cmd run dev` | Dev server con HMR |
| `npm.cmd run build` | Chequeo de tipos (`tsc --noEmit`) + build de producción |
| `npm.cmd run preview` | Sirve el build de producción |
| `npm.cmd run test` | Corre la suite Vitest una vez (28 tests) |
| `npm.cmd run test:watch` | Vitest en modo watch |
| `npm.cmd run typecheck` | Sólo chequeo de tipos |

---

## 🔌 Uso como plugin ERP

```tsx
import { ImageGallery } from './src'   // exportación vía src/index.ts

<ImageGallery
  filterTag="productos"                      // limita el listado a esa carpeta
  readOnly={false}                           // true → oculta subir/eliminar
  onSelectImage={(image) => { /* imagen elegida */ }}
  onUploadSuccess={(url) => { /* URL tras procesar */ }}
  onDeleteImage={(id) => { /* id eliminado */ }}
/>
```

Props completas en [`src/types/gallery.ts`](./src/types/gallery.ts) (`ImageGalleryProps`).

---

## ⚙️ Backend del pipeline (spec 006)

```bash
# dependencias (una vez)
pip install -r functions/requirements.txt

# tests del backend (30 pytest)
python -m pytest functions/tests
```

Flujo: subida → evento `onFinalize` → `ya_procesado` (FR-25) → recorte/lienzo 4:3 → JPEG sRGB calidad 90 (fallback 60 si supera 300 KB) → nombre convencionado `{carpeta}/{código}[_N].jpg` → marcado `pipeline=done`. `pillow-heif` habilita conversión de HEIC/HEIF (FR-6); `rembg` es opcional bajo `USAR_REMBG=true`.

**Estado del despliegue (T010):** ✅ **desplegada y verificada E2E (2026-11-04).** La función `procesar_subida` corre en Cloud Functions 2.º gen (python312, `us-east1`) y una subida nueva termina en JPEG sRGB sin EXIF con el nombre convencionado. Detalle completo en `specs/006-image-pipeline/tasks.md` (T010).

---

## 🔐 Reglas de Storage

[`storage.rules`](./storage.rules) define el acceso al bucket con validaciones de tamaño (10 MB) y tipo MIME. Estado actual:

- **Desplegadas el 2026-11-04 con acceso público** (lectura libre; escritura y borrado libres con validación MIME/10 MB), por decisión del usuario para la demo: la app no usa `firebase/auth` y las reglas anteriores devolvían `storage/unauthorized`, dejando la galería sin imágenes.
- La Cloud Function del pipeline **bypasea** estas reglas (Admin SDK), así que el backend no depende de ellas.
- ⚠️ **Antes de producción:** reintroducir autenticación (`request.auth != null`) según el modelo de sesión real del ERP — decisión todavía pendiente.

---

## 🧪 Tests

- **Frontend:** 28 tests Vitest junto a cada componente (callbacks, estados, validaciones, costura de filtros). `npm.cmd run test`
- **Backend:** 30 tests pytest (naming, pipeline, calidad determinista monkeypatcheando `_guardar_jpeg`). `python -m pytest functions/tests`
- **DoD:** suite verde + `tsc --noEmit` sin errores + UI mobile-first con Tailwind v4 + sin dependencias nuevas fuera del stack.

---

## 📖 Más documentación

- [`AGENTS.md`](./AGENTS.md) — reglas técnicas y arquitectura para agentes
- [`orchestration.md`](./orchestration.md) — flujo de trabajo y subagentes
- [`plan.md`](./plan.md) — plan de implementación
- [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) — constitución del proyecto
- `specs/NNN-*/spec.md` y sus `tasks.md` — cada feature sigue el ciclo SpecKit completo
