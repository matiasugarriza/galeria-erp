# Tasks — Feature 4: Integración como Complemento de ERP (`erp-integration`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-11-03 · **Estado:** ✅ completada (rama `feature/004-erp-integration`)

> **Formato:** tareas con casilla. `[P]` = paralelizable. Depende de `001`, `002` y `005`; valida de forma formal el `readOnly` implementado desde la feature 002.

---

## Fase 1 — Preparación

* [x] **T001** Completar `ImageGalleryProps` en `types/gallery.ts` con las cinco props (`filterTag`, `readOnly`, `onSelectImage`, `onDeleteImage`, `onUploadSuccess`), todas opcionales salvo `readOnly` (default `false`). ✅ Las cinco props ya estaban en el contrato desde la feature 001; sin cambios.

## Fase 2 — Núcleo (criterios de aceptación)

* [x] **T002** Selección: clic sobre una imagen ejecuta `onSelectImage` enviando `ImageItem` completo (`id`, `url`, `name`, `fullPath`). ✅ `ImageGallery` pasa `onSelect={onSelectImage}` a `GalleryGrid`; test con `expect.objectContaining({id, name, url, fullPath})`. **[AC1, FR-1]**
* [x] **T003** Tras la selección: cerrar la vista o confirmar la selección en el formulario padre. ✅ La confirmación ocurre en el padre vía el callback (`ImageItem` completo); no hay vista que cerrar porque el lightbox `ImageModal` no existe (gap documentado en la spec 005). **[AC1, FR-2]**
* [x] **T004** Modo lectura con `readOnly={true}`: ocultar o deshabilitar el botón de "Subir Imagen". ✅ Ya implementado desde 001/002; testeado (`/subir imagen/i` ausente en readOnly). **[AC2, FR-3]**
* [x] **T005** Modo lectura con `readOnly={true}`: retirar las opciones de eliminación en miniaturas y modal de detalle. ✅ Ya implementado en 005 (sin `onDelete` no hay botón); testeado (`/^eliminar /i` ausente en readOnly). **[AC2, FR-4]**
* [x] **T006** Exponer `onDeleteImage(id)` y `onUploadSuccess(url)` como props opcionales, invocadas al borrarse una imagen y al completarse una subida respectivamente (decisión resuelta 2026-10-26). ✅ `onDeleteImage` cableado en 005; `onUploadSuccess` cableado acá: `UploadModal.onUploaded(url)` ahora recibe la URL pública de `uploadImage` y `ImageGallery` la propaga tras refrescar. **[FR-5, FR-6]**
* [x] **T007** `[P]` Pruebas: `onSelectImage` recibe el `ImageItem` correcto; con `readOnly={true}` no aparece el botón de subir ni las acciones de borrar; callbacks de borrado/subida se disparan. ✅ Nuevas: selección (ImageGallery.test) + `onUploadSuccess` con URL (ImageGallery.test); borrado ya testeado en 005; readOnly (subir/borrar) testeado. **[AC1, AC2]**

## Fase 3 — Cierre

* [x] **T008** Demo en modo ERP en `App.tsx` que embebe la galería pasando `filterTag` y los callbacks, comprobando que el mismo código base opera en ambos modos (Cláusula de doble modo). ✅ `App.tsx` renderiza dos secciones: **Modo Standalone** (`<ImageGallery />` sin props) y **Modo ERP** (`filterTag="productos"` + `onSelectImage`/`onUploadSuccess` con estado visible en `role="status"`); test `App.test.tsx` verifica ambos headings y la selección reflejada en el padre. *(2026-11-04: la sección ERP apunta ahora a `migradas/`, la carpeta con las imágenes reales del bucket; el test se actualizó en consecuencia.)*
* [x] **T009** Verificación: `npm run test` en verde y build/typecheck sin errores. ✅ **28/28 tests** · `tsc --noEmit` limpio · `vite build` OK (293.35 kB / 91.85 kB gzip).
