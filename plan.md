# 🗺️ Plan de Implementación — Galería de Imágenes (Standalone & ERP Plugin)

**Fecha:** 2026-10-23 · **Estado:** Propuesta · **Constitución:** [v1.1.0](.specify/memory/constitution.md)

| Feature | Spec | Estado del spec |
| :--- | :--- | :--- |
| Visualización de la Galería (`gallery-view`) | [`specs/001-gallery-view/spec.md`](specs/001-gallery-view/spec.md) | ✅ Implementada (rama `feature/001-gallery-view`) |
| Subida de Imágenes (`image-upload`) | [`specs/002-image-upload/spec.md`](specs/002-image-upload/spec.md) | Propuesta |
| Filtrado y Búsqueda (`image-filter`) | [`specs/003-image-filter/spec.md`](specs/003-image-filter/spec.md) | Propuesta |
| Integración ERP (`erp-integration`) | [`specs/004-erp-integration/spec.md`](specs/004-erp-integration/spec.md) | Propuesta |
| Eliminación de Archivos (`image-deletion`) | [`specs/005-image-deletion/spec.md`](specs/005-image-deletion/spec.md) | Propuesta |
| Procesamiento y Formato de Imágenes (`image-pipeline`) | [`specs/006-image-pipeline/spec.md`](specs/006-image-pipeline/spec.md) | Propuesta (batch + procesamiento en servidor) |

---

## Resumen

Módulo de Galería de Imágenes en tiempo real sobre Firebase Storage, con doble modo de uso: aplicación *Standalone* (`App.tsx`) y componente *Plugin ERP* integrable mediante props. Cubre visualización, subida con progreso, filtrado (búsqueda + `filterTag`), selección con retorno al ERP y eliminación con confirmación.

Todas las imágenes del bucket cumplen el contrato de la feature `image-pipeline`: salida JPEG sRGB sin EXIF, recorte→escala→lienzo 4:3→calidad ajustada al peso, y nombres `{carpeta}/{código}[_N].jpg`.

## Contexto Técnico

* **Stack:** el definido en la [Cláusula I de la constitución](.specify/memory/constitution.md#cláusula-i--stack-tecnológico-inmutable) (React `^19.3.0`, TypeScript `^7.0.2`, Vite `^8.3.1`, Tailwind `^4.3.3`, `lucide-react`, Firebase JS SDK, Vitest `^5.0.2`).
* **Testing:** Vitest con mocks de Firebase Storage; se ejecuta con `npm run test`.
* **Modo de entrega:** la galería se empaqueta como módulo exportable (`src/index.ts`) y a la vez corre como app standalone.
* **Procesamiento de imágenes:** el pipeline de la feature 006 corre en el proceso batch (Python/Pillow) **y como procesamiento en servidor** sobre las subidas nuevas del complemento: Cloud Functions de Firebase (runtime Python + Pillow, trigger `onFinalize`), decisión del usuario del 2026-10-23. Se reutiliza la lógica del batch para fidelidad total, incluido `rembg` opcional.
* **Reglas de seguridad:** se entrega [`storage.rules`](storage.rules) en la raíz del repo como propuesta desplegable (lectura autenticada; escritura con validación de tipo y 10 MB; borrado autenticado).
* **Skills aplicables:** según la matriz de [`skills.md`](skills.md), cada feature declara sus skills en la sección *Orden de Implementación*.

## Verificación de Constitución (Constitution Check)

| Cláusula | Evaluación | Estado |
| :--- | :--- | :--- |
| I — Stack cerrado | El usuario autorizó (2026-10-23) la ampliación del stack con backend de procesamiento en servidor (Cloud Functions Python + Pillow); ver Cláusula I actualizada. Resto del plan sin dependencias nuevas | `PASS` |
| II — Arquitectura de archivos | Todos los artefactos encajan en la estructura `src/` de `agents.md` | `PASS` |
| III — Calidad obligatoria | Cada feature incluye sus pruebas Vitest; accesibilidad y cleanup de Firebase aplican a todas | `PASS` |
| IV — Seguridad y configuración | Firebase se configura por env vars `VITE_`; el plan no almacena credenciales | `PASS` |
| V — Proceso obligatorio | Las features avanzan por las 5 fases de `orchestration.md` con verificación independiente | `PASS` |
| VI — Formato de imagen | Pipeline aplicado en batch y en servidor; toda subida nueva queda normalizada según la feature 006 | `PASS` |

## Estructura del Proyecto

La estructura `src/` sigue exactamente la de [`agents.md`](agents.md#-arquitectura-y-estructura-de-archivos):

```text
src/
├── components/
│   └── ImageGallery/
│       ├── ImageGallery.tsx    # Componente raíz (orquestador UI, props dual-mode)
│       ├── GalleryGrid.tsx     # Grilla responsiva y renderizado de ítems
│       ├── ImageModal.tsx      # Lightbox / Vista en detalle / Acciones
│       └── UploadModal.tsx     # Modal / Zona Drag & Drop para carga
├── config/
│   └── firebase.ts             # Inicialización de Firebase SDK (env vars VITE_)
├── services/
│   └── storageService.ts       # Abstracción de llamadas a Firebase Storage
├── types/
│   └── gallery.ts              # Interfaces y Types de TypeScript
├── index.ts                    # Exportación pública para integración como módulo/ERP
└── App.tsx                     # Entrada y demostración en Modo Standalone
```

> **Pruebas:** colocadas junto a su componente (p. ej. `GalleryGrid.test.tsx` al lado de `GalleryGrid.tsx`), siguiendo la convención por defecto de Vitest — decisión resuelta del 2026-10-26, sin ajustes de configuración.

## Modelo de Datos

Definidos en `src/types/gallery.ts`:

```typescript
interface ImageItem {
  id: string;        // identificador único del objeto en Storage (fullPath)
  name: string;      // nombre en el bucket: {código}[_N].jpg (búsqueda y miniatura)
  url: string;       // URL pública de descarga (getDownloadURL)
  fullPath: string;  // ruta completa: {carpeta}/{código}[_N].jpg (usada por deleteObject)
  createdAt: string; // fecha de creación (mostrada en la miniatura)
  tag?: string;      // carpeta de contexto ERP: "productos", "facturas", "avatares"
}

interface UploadState {
  isUploading: boolean;
  progress: number;  // 0–100 (uploadBytesResumable)
}

interface GalleryFilterState {
  searchTerm: string;   // barra de búsqueda rápida (opera sobre {código}[_N].jpg)
  filterTag?: string;   // filtro automático por carpeta de contexto ERP
}
```

* `id`, `url`, `name`, `fullPath`: requeridos por el escenario de retorno al ERP (feature 004).
* `createdAt`: requerido por el escenario de miniatura (feature 001).
* `name`/`fullPath`: siguen la convención `{carpeta}/{código}[_N].jpg` de la feature 006; el tag de contexto es la carpeta *(inferido — confirmar)*.

## Contratos de Interfaz

**`ImageGalleryProps`** (exportada desde `src/index.ts`):

| Prop | Tipo | Default | Origen |
| :--- | :--- | :--- | :--- |
| `filterTag?` | `string` | `undefined` | Spec 003 — filtrado por carpeta de contexto ERP |
| `readOnly?` | `boolean` | `false` | Specs 002/004/005 — oculta subida y eliminación |
| `onSelectImage?` | `(image: ImageItem) => void` | `undefined` | Spec 004 — retorno de selección al ERP |
| `onDeleteImage?` | `(id: string) => void` | `undefined` | Spec 004, FR-5 — confirmado por el usuario (2026-10-26) |
| `onUploadSuccess?` | `(url: string) => void` | `undefined` | Spec 004, FR-6 — confirmado por el usuario (2026-10-26) |

**`storageService`** (capacidades exigidas por `skills.md`, una función por operación):

| Función | Responsabilidad | Feature |
| :--- | :--- | :--- |
| `listImages(filterTag?)` | `listAll` sobre la carpeta del tag + `getDownloadURL`; devuelve `ImageItem[]` | 001, 003 |
| `uploadImage(file, onProgress)` | `uploadBytesResumable` con progreso 0–100 | 002 |
| `deleteImage(fullPath)` | `deleteObject` con manejo de excepciones | 005 |

> El pipeline **no** se ejecuta en el cliente: `uploadImage` sube el archivo y la normalización (feature 006) ocurre en servidor vía Cloud Function `onFinalize` antes de que la imagen quede definitiva en el bucket.

## Reglas de Formato y Procesamiento de Imágenes

Contrato completo en [`specs/006-image-pipeline/spec.md`](specs/006-image-pipeline/spec.md). Resumen operativo:

* **Salida:** siempre `.jpg` / `image/jpeg`, RGB con perfil sRGB embebido, progresiva (`progressive=True`, `optimize=True`), sin EXIF (orientación corregida con `ImageOps.exif_transpose` y metadatos descartados).
* **Orden:** EXIF → sRGB → recorte → escala → lienzo 4:3 → JPEG. **El recorte va antes de escalar.**
* **Recorte:** margen 100 px; fondo estimado por mediana de franja perimetral del 2%; tolerancia 18/255; sin recorte si el bbox cubre ≥ 98% del área; `rembg` opcional solo con `USAR_REMBG=true`.
* **Escala:** tope 2400×1800, `escala = min(1.0, 2400/w, 1800/h)`, LANCZOS, nunca agranda ni estira.
* **Lienzo 4:3 adaptativo** centrado con relleno blanco (255,255,255).
* **Calidad:** q90 inicial → baja de 5 hasta q60 solo si supera 300 KB; si con q60 no entra, se sube igual y se avisa por log.
* **Nombres:** `{carpeta}/{código}[_N].jpg`; sanitizado NFKD; sufijo `_N` estable entre corridas (preconteo sobre todas las filas del mismo código); sin código → nombre original del archivo.
* **Invariantes:** no agranda, no estira, no recorta por encima del contenido detectado, no baja de q60, no descarta por peso, no escribe en disco.
* **Aclaración:** los tamaños de ejemplo (531×398, 1519×1139, 2400×1800 y 16 KB / ~100 KB) son resultados de fotos concretas **con recorte previo**, no valores fijos.

## Orden de Implementación y Dependencias

| Orden | Feature | Depende de | Skills (`skills.md`) |
| :--- | :--- | :--- | :--- |
| 1 | `001-gallery-view` | — | react-19-architecture, tailwind-v4-ui, typescript-strict-typing |
| 2 | `002-image-upload` | 001, 006 (procesamiento en servidor) | firebase-storage-integration, react-19-architecture |
| 3 | `003-image-filter` | 001 | react-19-architecture, typescript-strict-typing |
| 4 | `005-image-deletion` | 001 | firebase-storage-integration, react-19-architecture |
| 5 | `004-erp-integration` | 001, 002, 005 | dual-mode-component-design, typescript-strict-typing |
| Transversal | `006-image-pipeline` | — | Se ejecuta en el batch de migración y como Cloud Function (`onFinalize`) sobre cada subida nueva |

Notas:

* El orden de implementación difiere de la numeración: `004` va al final porque integra callbacks y permisos que afectan a 002 y 005.
* La prop `readOnly` se diseña e implementa desde la feature 002 (oculta el botón de subida); su validación formal se cierra en la feature 004.
* Cada feature cierra con la fase 4 (Verificar) y 5 (Registrar) de [`orchestration.md`](orchestration.md) antes de abrir la siguiente.

## Decisiones Abiertas

**Todas resueltas (última actualización: 2026-10-26):**

* ✅ **Convención de nombres** → `{carpeta}/{código}[_N].jpg` con sanitizado NFKD y sufijo estable (feature 006, FR-19 a FR-24); para subidas sin fila de origen aplica FR-23 (nombre original sanitizado).
* ✅ **Persistencia del tag** → la carpeta del bucket (`{carpeta}/`) es el tag de contexto ERP *(inferido de la convención de nombres — confirmado por ausencia de objeción)*.
* ✅ **Alcance del pipeline en el complemento** → procesamiento en servidor: Cloud Functions de Firebase (runtime Python + Pillow, trigger `onFinalize`) aplica el pipeline completo a cada subida nueva, con protección anti-reprocesamiento (spec 006, FR-25). *(Servicio concreto asumido: Cloud Functions; requiere plan Blaze.)*
* ✅ **Límite de tamaño y Security Rules** → validación cliente de 10 MB en la subida (spec 002, FR-5) + propuesta desplegable [`storage.rules`](storage.rules) con validación equivalente en servidor.
* ✅ **Sensibilidad de la búsqueda** → insensible a mayúsculas y acentos, normalización NFKD (spec 003, FR-1).
* ✅ **Callbacks ERP** → se exponen `onDeleteImage` y `onUploadSuccess` además de `onSelectImage` (spec 004, FR-5 y FR-6).
* ✅ **Ubicación de las pruebas** → colocadas junto a su componente (convención por defecto de Vitest, sin tocar configuración).

## Riesgos

* **R1 — Reglas de seguridad del bucket ausentes:** sin Security Rules, cualquier operación depende solo de la validación del cliente (decisión 2).
* **R2 — Escalado del listado:** `listAll` sobre buckets con muchos archivos puede degradar la carga inicial; mitigación potencial con `list()` paginado (fuera del alcance actual).
* **R3 — Versiones pinnadas muy recientes:** React 19.3 / TypeScript 7 / Vite 8 requieren compatibilidad verificada entre sí durante el scaffold.
* **R4 — Latencia y coste del procesamiento en servidor:** la normalización ocurre *después* de la subida (trigger `onFinalize`), así que la galería podría listar un archivo antes de que termine el pipeline (mitigable con refresh/escucha de eventos de Storage); además, Cloud Functions exige el plan Blaze de Firebase. El bucket queda homogéneo: el riesgo original de heterogeneidad queda mitigado.

## Criterios de Aceptación del Plan (Checklist)

* [ ] Cada escenario de cada spec tiene al menos una prueba Vitest que lo ejerza.
* [ ] `npm run test` y la compilación de TypeScript quedan en verde al cierre de cada feature.
* [ ] La galería funciona en modo Standalone y en modo Plugin ERP sin modificar el código base.
* [ ] Ninguna dependencia fuera del stack autorizado fue introducida.
* [ ] Ninguna credencial aparece en el código o documentos del repositorio.
* [ ] Las imágenes listadas —migradas y subidas nuevas— cumplen el contrato de la feature 006 (procesamiento en servidor aplicado).
* [ ] Cada feature tiene su registro en Engram tras pasar la fase 4.

## Próximos Pasos (pipeline SpecKit)

1. ~~Resolver las decisiones abiertas~~ ✅ cerradas (2026-10-26).
2. ~~Generar `tasks.md` por feature~~ ✅ generados en cada carpeta de `specs/`.
3. Ejecutar las features en el orden definido (001 → 002 → 003 → 005 → 004, con 006 como pista de backend paralela), siguiendo las 5 fases de [`orchestration.md`](orchestration.md).
