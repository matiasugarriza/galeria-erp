# 🖼️ Galería de Imágenes — Plugin ERP

Galería en tiempo real sobre **Firebase Storage + Firestore**, en **modo ERP únicamente** (la app standalone se retiró en la spec 007). La grilla se alimenta de la colección `fotos` de Firestore — un documento por foto con código de artículo, URL y URL de miniatura — y consulta en lotes de 24 con scroll infinito.

Desarrollada con un pipeline **SpecKit** (specs → plan → tasks → implementación): 7 features implementadas y documentadas en [`specs/`](./specs/).

---

## ✨ Puntos clave

| # | Feature | Spec | Qué resuelve |
|---|---------|------|--------------|
| 001 | Galería | [`specs/001-gallery-view`](./specs/001-gallery-view) | Grilla responsiva y lightbox |
| 002 | Subida | [`specs/002-image-upload`](./specs/002-image-upload) | Modal con drag & drop, validación de formato/tamaño (10 MB), progreso y errores visibles |
| 003 | Filtro | [`specs/003-image-filter`](./specs/003-image-filter) | Búsqueda insensible a tildes/mayúsculas (desde la 007, en Firestore por prefijo de código) |
| 004 | Integración ERP | [`specs/004-erp-integration`](./specs/004-erp-integration) | Callbacks del plugin (desde la 007, selección múltiple con `onSelect`) |
| 005 | Eliminación | [`specs/005-image-deletion`](./specs/005-image-deletion) | Confirmación (`ConfirmDialog`), `deleteObject` y remoción inmediata de la grilla |
| 006 | Pipeline servidor | [`specs/006-image-pipeline`](./specs/006-image-pipeline) | Cloud Function `onFinalize` (Python/Pillow): recorte 4:3, sRGB, naming convencionado |
| 007 | Rendimiento y ficha técnica | [`specs/007-gallery-performance`](./specs/007-gallery-performance) | Firestore + paginado 24 + búsqueda por prefijo, miniaturas WebP 300 px, compresión en el navegador, vista previa local, selección múltiple, esquema preparado para IA |

Decisiones de diseño que conviene conocer:

- **Credenciales sólo en env vars `VITE_*`** (Cláusula IV): nada hardcodeado; `src/config/firebase.ts` es el único punto de lectura y `src/index.ts` no expone config interna al consumidor del ERP.
- **Sin librerías UI externas**: todo el diseño es Tailwind v4 + componentes nativos de React (Regla de Oro de `AGENTS.md`). La única dependencia nueva autorizada es `browser-image-compression` (compresión en el navegador, FR-7).
- **Tipos centralizados**: todos los tipos viven en `src/types/gallery.ts` (nada de `any` ni `@ts-ignore`; TypeScript estricto).
- **Firestore es la fuente de verdad (spec 007)**: la colección raíz `fotos` la escribe **sólo la Cloud Function** (Admin SDK); el cliente tiene lectura pública y escritura denegada. La grilla consulta con `limit(24)` + `startAfter` y la búsqueda usa el campo normalizado `codigoBusqueda` (rango `>=` / `<=` + `\uf8ff`), sin filtrar en el navegador.
- **Miniaturas WebP**: el pipeline genera `thumbs/{ruta-sin-ext}.webp` a 300×225 (q80). La foto grande se descarga **sólo al abrir el modal**; las `<img>` de la grilla usan `loading="lazy"`.
- **Caché de un año**: cliente y función suben con `cacheControl: 'public, max-age=31536000'`.
- **Vista previa instantánea**: al elegir una foto se comprime en el navegador (≤1600 px, ≤1 MB), se muestra al instante con una vista previa local y se sube en segundo plano; la miniatura y el documento se crean al procesar la subida.
- **Anti-reprocesamiento (FR-25 + 007)**: el pipeline marca `customMetadata.pipeline=done` y además ignora todo objeto bajo `thumbs/`.
- **Sanitización de nombres con case preservado**: `sanitizar("Código") === "Codigo"`.
- **Preparado para IA (spec 007, FR-15)**: cada foto lleva `vista` (`frente|espalda|detalle`), `origen` (`corel|ia`), `basadaEn` y `estado` (`aprobada|para_revisar`). Una versión generada nunca pisa la original: se guarda como foto nueva y queda "para revisar" (no tildable hasta aprobarla). Sin generación por IA en esta feature.

---

## 🛠️ Stack

- **Core:** React `^19.3.0` + TypeScript `^7.0.2`
- **Build:** Vite `^8.3.1` (module type)
- **Estilos:** Tailwind CSS `^4.3.3` (`@tailwindcss/vite`)
- **Iconos:** `lucide-react` `^1.48.0`
- **Datos:** Firebase JS SDK (`firebase/app`, `firebase/storage`, `firebase/firestore`) + `browser-image-compression`
- **Testing:** Vitest `^5.0.2` (frontend) + pytest (backend)
- **Pipeline servidor:** Python + Pillow + `google-cloud-storage` + `google-cloud-firestore` en [`functions/`](./functions/)

---

## 📂 Estructura

```text
src/
├── components/ImageGallery/
│   ├── ImageGallery.tsx      # Componente raíz (paginado, búsqueda, selección)
│   ├── GalleryGrid.tsx       # Grilla (miniatura, tilde, borrado)
│   ├── ImageModal.tsx        # Lightbox / foto grande
│   ├── ConfirmDialog.tsx     # Confirmación de borrado
│   ├── UploadModal.tsx       # Modal / drag & drop de subida
│   └── searchUtils.ts        # Normalización de búsqueda (NFKD)
├── config/firebase.ts        # Inicialización perezosa (app, storage, firestore)
├── services/galleryService.ts# fetchGalleryPage (Firestore, 24 por página)
├── services/storageService.ts# compressImage / uploadImage / deleteImage
├── types/gallery.ts          # GalleryPhoto y ImageGalleryProps
├── index.ts                  # Exportación pública (plugin ERP)
└── App.tsx                   # Harness de desarrollo (sólo modo ERP)

functions/                    # Backend Python (fuera de src/ — Cláusula I)
├── pipeline.py               # Orden de procesamiento + miniatura WebP
├── naming.py                 # sanitizar / destino / docId / documento Firestore
├── main.py                   # Handlers onFinalize + onDelete (firebase-functions)
├── migrar_galeria.py         # Migración idempotente: miniaturas + documentos
├── requirements.txt
└── tests/                    # 87 tests pytest

specs/                        # Specs 001–007 (español, escenarios verbatim)
storage.rules                 # Reglas de Storage (públicas — ver Estado)
firestore.rules               # Reglas de Firestore (lectura pública, escritura Admin)
firestore.indexes.json        # Índice de búsqueda por prefijo
firebase.json                 # Config de deploy (functions + storage + firestore)
```

---

## 🚀 Puesta en marcha

### Requisitos

- **Node.js 24 LTS** (recomendado; Node 22 funciona con warnings `EBADENGINE`)
- **npm** — en Windows PowerShell usá `npm.cmd` (la política de ejecución bloquea `npm.ps1`)
- **Python 3.12+** sólo si vas a correr el backend

### 1. Instalar dependencias

```bash
npm.cmd install
pip install -r functions/requirements.txt   # backend
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

Abrí la URL que imprime Vite (por defecto `http://localhost:5173`). `App.tsx` es un **harness de desarrollo**: monta el plugin en modo ERP y muestra las fotos elegidas con `onSelect`.

### 4. Scripts disponibles

| Comando | Qué hace |
|---------|----------|
| `npm.cmd run dev` | Dev server con HMR |
| `npm.cmd run build` | Chequeo de tipos (`tsc --noEmit`) + build de producción |
| `npm.cmd run preview` | Sirve el build de producción |
| `npm.cmd run test` | Corre la suite Vitest una vez (52 tests) |
| `npm.cmd run test:watch` | Vitest en modo watch |
| `npm.cmd run typecheck` | Sólo chequeo de tipos |
| `python -m pytest functions/tests` | Suite del backend (87 tests) |

---

## 🔌 Uso como plugin ERP

```tsx
import { ImageGallery } from './src'   // exportación vía src/index.ts

<ImageGallery
  codigoInicial="CH-001"                    // abre ya filtrado por código de artículo
  readOnly={false}                          // true → sólo lectura (sin subir/borrar/tildar)
  onSelect={(fotosElegidas) => {            // selección múltiple tildada
    /* GalleryPhoto[] en orden de selección */
  }}
  onUploadSuccess={(foto) => { /* documento ya creado en Firestore */ }}
/>
```

Props completas en [`src/types/gallery.ts`](./src/types/gallery.ts) (`ImageGalleryProps`).

---

## ⚙️ Backend del pipeline (specs 006 + 007)

```bash
# dependencias (una vez)
pip install -r functions/requirements.txt

# tests del backend (87 pytest)
python -m pytest functions/tests

# migración de las imágenes existentes (miniaturas WebP + documentos Firestore)
python functions/migrar_galeria.py --credentials <ruta-al-json-de-la-SA>
```

Flujo de una subida: el cliente comprime (≤1600 px, ≤1 MB) → sube con `cacheControl` de un año → evento `onFinalize` → `ya_procesado` (FR-25) + guarda `thumbs/` → recorte/lienzo 4:3 (relleno transparente si el PNG tiene alfa) → **WebP calidad 85** → nombre convencionado `{carpeta}/{código}[_N].webp` → **miniatura WebP 300×225 (q80)** en `thumbs/` → metadata `pipeline=done`, `firebaseStorageDownloadTokens` y `cacheControl` → **documento `fotos/{carpeta__nombre}`** con URL y thumbUrl resueltas. Al borrar un objeto, `on_object_deleted` elimina su documento y su miniatura.

**Estado del despliegue de la spec 007:** ⚠️ **pendiente** (2026-11-05). El código está implementado y testeado localmente (52 + 87 tests verdes), pero falta: habilitar Firestore en el proyecto, desplegar `functions` + reglas/índices de Firestore y correr la migración de las 200+ imágenes existentes. La sesión de Firebase CLI venció (`firebase login --reauth`). La función de la spec 006 sigue desplegada y operativa (python312, `us-east1`).

---

## 🔐 Reglas de acceso

- **Storage** ([`storage.rules`](./storage.rules)): desplegadas el 2026-11-04 con acceso público (lectura libre; escritura/borrado libres con validación MIME y 10 MB), por decisión del usuario para la demo. La Cloud Function bypasea las reglas (Admin SDK).
- **Firestore** ([`firestore.rules`](./firestore.rules)): `fotos` con lectura pública y escritura denegada al cliente (sólo Admin SDK escribe).
- ⚠️ **Antes de producción:** reintroducir autenticación (`request.auth != null`) según el modelo de sesión real del ERP — decisión pendiente.

---

## 🧪 Tests

- **Frontend:** 52 tests Vitest junto a cada componente y servicio (paginado, búsqueda por prefijo, miniaturas y respaldo, modal, selección múltiple, vista previa, harness ERP). `npm.cmd run test`
- **Backend:** 87 tests pytest (naming, pipeline WebP, miniaturas, documentos Firestore, handlers, migración). `python -m pytest functions/tests`
- **DoD:** suite verde + `tsc --noEmit` sin errores + UI mobile-first con Tailwind v4 + sin dependencias nuevas fuera del stack autorizado.

---

## 📖 Más documentación

- [`AGENTS.md`](./AGENTS.md) — reglas técnicas y arquitectura para agentes
- [`orchestration.md`](./orchestration.md) — flujo de trabajo y subagentes
- [`plan.md`](./plan.md) — plan de implementación
- [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) — constitución del proyecto
- `specs/NNN-*/spec.md` y sus `tasks.md` — cada feature sigue el ciclo SpecKit completo
