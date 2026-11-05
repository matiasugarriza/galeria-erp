# Feature 7: Galería ERP sobre Firestore (rendimiento, miniaturas y selección múltiple)

**ID de feature:** `gallery-performance`
**Estado:** 🟡 En implementación (rama `feature/007-gallery-performance`)
**Dependencias:** [`001-gallery-view`](../001-gallery-view/spec.md) (grilla), [`003-image-filter`](../003-image-filter/spec.md) (búsqueda), [`004-erp-integration`](../004-erp-integration/spec.md) (contrato del plugin), [`006-image-pipeline`](../006-image-pipeline/spec.md) (pipeline de imágenes)

---

## Contexto

El borrador inicial de esta feature (2026-11-04) planteaba paginar el listado de Storage (`listAll` → `list` con `maxItems`) y generar miniaturas JPEG de 400 px. El usuario redefinió la arquitectura (2026-11-05, ver `Log L3`): la grilla debe leer una **colección de Firestore** (un documento por foto) en lugar de listar Storage; las miniaturas pasan a **WebP de ~300 px**; la compresión se hace **en el navegador** antes de subir; **se elimina el modo standalone**; el contrato ERP pasa a **selección múltiple** (`onSelect(fotosElegidas)`); y el esquema queda preparado para futuras fotos generadas por IA.

## Requisitos Funcionales

* **FR-1 (modelo Firestore):** La grilla se alimenta de la colección raíz `fotos` (un documento por foto) con los campos: `codigo` (código de artículo), `codigoBusqueda` (normalizado para búsqueda), `nombre`, `carpeta`, `url` (imagen principal), `thumbUrl` (miniatura), `vista` (`frente|espalda|detalle`), `origen` (`corel|ia`), `basadaEn` (id de la foto original o `null`), `estado` (`aprobada|para_revisar`) y `creadoEn`. Los documentos los escribe **sólo la Cloud Function** (Admin SDK); el cliente nunca escribe. Reglas Firestore: **lectura pública, escritura denegada** al cliente. El `docId` es determinista: `carpeta__nombre` (barras reemplazadas por `__`) para que la migración y el borrado sean idempotentes.
* **FR-2 (paginado):** Primera página de **24 fotos** con `limit(24)`, orden `codigoBusqueda` + `__name__`, y `startAfter(cursor)` para las siguientes; scroll infinito al llegar al final de la grilla.
* **FR-3 (búsqueda):** La búsqueda consulta Firestore por **prefijo de código** (`codigoBusqueda >= término` y `<= término + \uf8ff`), insensible a mayúsculas y acentos (mismo criterio de normalización de la spec 003). No se filtra en el navegador después de descargar todo.
* **FR-4 (miniaturas WebP):** El pipeline genera una miniatura de **300 px de ancho** (300×225 sobre el lienzo 4:3) en **WebP calidad 80**, en `thumbs/{ruta-destino-sin-extensión}.webp`. La imagen grande se descarga **sólo al abrir el modal**.
* **FR-5 (lazy):** Toda `<img>` de la grilla usa `loading="lazy"`.
* **FR-6 (caché):** Las subidas (cliente y función) fijan `cacheControl: 'public, max-age=31536000'`.
* **FR-7 (compresión en el navegador):** Antes de subir, la imagen se achica y comprime en el cliente con `browser-image-compression` (dependencia autorizada explícitamente por el usuario): `maxWidthOrHeight: 1600`, `maxSizeMB: 1`, conservando el tipo original (PNG mantiene transparencia).
* **FR-8 (vista previa instantánea):** Al elegir una foto se muestra de inmediato en la grilla con una vista previa local (`URL.createObjectURL`) mientras sube en segundo plano; al completar, se refresca hasta que el documento aparezca (reintentos acotados) y se retira la vista previa.
* **FR-9 (miniatura al subir):** La miniatura se genera al procesar la subida (función), de modo que quede disponible apenas termina el procesamiento.
* **FR-10 (ampliar):** Al tocar una foto se abre el modal (lightbox) con la imagen grande, nombre y fecha; cierre por botón, `Esc` y clic fuera.
* **FR-11 (selección múltiple):** Se pueden tildar varias fotos; el componente devuelve las elegidas con `onSelect(fotosElegidas: GalleryPhoto[])` (reemplaza `onSelectImage`). Las fotos con `estado !== 'aprobada'` **no se pueden tildar** (quedan "para revisar").
* **FR-12 (filtro inicial por código):** El componente acepta una prop para abrirse ya filtrado por código de artículo.
* **FR-13 (sólo modo ERP):** Se elimina el modo standalone; `App.tsx` queda como harness de desarrollo que monta el componente en modo ERP.
* **FR-14 (formatos):** Se aceptan JPG, PNG y WebP (Corel exporta PNG con transparencia) además del HEIC ya soportado. La imagen principal procesada se guarda como **WebP** (preserva transparencia); las miniaturas siempre WebP.
* **FR-15 (esquema preparado para IA):** Campos `vista`, `origen`, `basadaEn` y `estado` con los valores indicados; una versión mejorada/generada por IA **nunca pisa** una foto existente: se guarda como foto nueva con `origen: 'ia'` y `basadaEn`. Sin generación por IA en esta feature.
* **FR-16 (borrado coherente):** Al borrarse un objeto de Storage, una segunda función (`on_object_deleted`) elimina su documento de Firestore y su miniatura. Borrar un objeto bajo `thumbs/` no hace nada.

## Escenarios y Criterios de Aceptación

### Escenario 1: Grilla desde Firestore con paginado (FR-1, FR-2)

* **Given** una colección `fotos` con más de 24 documentos
* **When** la galería monta
* **Then** muestra las primeras 24 (orden por `codigoBusqueda`) y, al llegar al final, carga el siguiente lote con `startAfter` sin duplicados ni saltos

### Escenario 2: Búsqueda por prefijo de código (FR-3)

* **Given** que la galería muestra la primera página
* **When** el usuario escribe `ch-0` en la barra de búsqueda
* **Then** se consultan en Firestore los documentos con `codigoBusqueda` desde `ch-0` hasta el prefijo superior (sin traer todo) y la grilla muestra sólo coincidencias

### Escenario 3: Miniatura con respaldo (FR-4, FR-5)

* **Given** una foto cuya miniatura aún no existe
* **When** la grilla la renderiza
* **Then** muestra la imagen completa como respaldo (con `loading="lazy"`), sin errores visibles

### Escenario 4: Ampliar a tamaño real (FR-10)

* **Given** una grilla con fotos
* **When** el usuario toca una foto
* **Then** se abre el modal con la imagen grande y se cierra con botón, `Esc` o clic fuera

### Escenario 5: Selección múltiple y aprobación (FR-11)

* **Given** una grilla con fotos aprobadas y una "para revisar"
* **When** el usuario tilda dos aprobadas
* **Then** `onSelect` recibe las dos fotos elegidas (en orden de selección); la "para revisar" no se puede tildar

### Escenario 6: Subida comprimida con vista previa (FR-7, FR-8, FR-9)

* **Given** que el usuario elige un JPG de 6 MB
* **When** se inicia la subida
* **Then** la foto aparece de inmediato en la grilla como vista previa local, se sube comprimida (≤1600 px, ≤1 MB) con `cacheControl` de un año, y al procesarse aparece la foto real con su miniatura WebP y su documento en Firestore

### Escenario 7: Filtro inicial por código (FR-12)

* **Given** que el ERP monta el componente con un código de artículo
* **When** la galería monta
* **Then** la búsqueda arranca con ese código y la grilla muestra sólo sus fotos

### Escenario 8: Borrado coherente (FR-16)

* **Given** una foto con documento y miniatura
* **When** el usuario la elimina
* **Then** se borran el objeto, su documento y su miniatura; la grilla deja de mostrarla

### Escenario 9: Formatos y transparencia (FR-14)

* **Given** un PNG con fondo transparente exportado de Corel
* **When** se sube y procesa
* **Then** la imagen principal y la miniatura se guardan en WebP conservando la transparencia

## Entidades Clave

* `GalleryPhoto` (reemplaza `ImageItem`): `{ id, codigo, nombre, carpeta, url, thumbUrl, fullPath, vista, origen, basadaEn, estado, creadoEn }`.
* `fetchGalleryPage({ codigoPrefijo?, cursor? })` — servicio de consulta paginada a Firestore (lote de 24).
* `ImageGalleryProps`: `{ codigoInicial?, readOnly?, onSelect?, onUploadSuccess? }` (se retira `filterTag`).
* Documento `fotos/{carpeta__nombre}` — fuente de verdad de la grilla.

## Decisiones autónomas

1. **La colección es la fuente única:** se retira `filterTag` (filtro por carpeta) porque el nuevo contrato pide filtro por **código de artículo** (`codigoInicial`); todas las fotos viven en la colección.
2. **Salida principal en WebP** (calidad 85) para todas las imágenes procesadas: menor peso y soporte de transparencia para PNG de Corel. Las imágenes históricas `.jpg` permanecen como están.
3. **`docId` determinista** `carpeta__nombre` para que migración, upsert y borrado sean idempotentes; `codigo` se deriva del nombre quitando la extensión y el sufijo de variante (`_N` o `-N`).
4. **La función fija `firebaseStorageDownloadTokens` y `cacheControl`** en la subida de la imagen principal y de la miniatura, y escribe `url`/`thumbUrl` ya resueltas en el documento: el cliente no llama `getDownloadURL` al listar.
5. **Firestore en `southamerica-east1`** (región más cercana al usuario) — decisión de infraestructura registrada al crear la base.
6. **Reglas Firestore:** lectura pública, escritura denegada al cliente (sólo Admin SDK escribe); coherente con la postura temporal de reglas públicas de Storage ya desplegada.

## Fuera de Alcance

* Generación o mejora de imágenes con IA (sólo se prepara el esquema).
* Flujo de UI de aprobación de fotos "para revisar" (sólo se impide tildarlas).
* Autenticación / modelo de sesión (pendiente aparte).
* Reorganización de carpetas existentes (se conserva `migradas/`).
* Edición o borrado de fotos desde el modal.
