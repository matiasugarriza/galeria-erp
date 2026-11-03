# Tasks — Feature 5: Eliminación de Archivos (`image-deletion`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-11-03 · **Estado:** ✅ completada (rama `feature/005-image-deletion`)

> **Formato:** tareas con casilla. `[P]` = paralelizable. Depende de [`001-gallery-view/tasks.md`](../001-gallery-view/tasks.md).

---

## Fase 1 — Preparación

* [x] **T001** Añadir a `storageService.ts` `deleteImage(fullPath)` con `deleteObject` y manejo de excepciones (permisos, archivo inexistente). ✅ Lanza la excepción de `deleteObject` al llamador; el componente la muestra en `role="alert"`. **[FR-2]**

## Fase 2 — Núcleo (criterios de aceptación)

* [x] **T002** Acción de eliminar en las miniaturas y en el modal de detalle (`ImageModal.tsx`), accesible (`aria-label`, teclado), disponible solo con permisos de edición (`readOnly=false`). ✅ Botón `Trash2` superpuesto en `GalleryGrid` con `aria-label="Eliminar {name}"` y `focus-visible`; oculto con `readOnly` y sin `onDelete`. **⚠️ `ImageModal.tsx` (lightbox) no existe en el código ni tiene spec que lo cree — ver Gap abajo.** **[AC1]**
* [x] **T003** Modal de diálogo de confirmación antes de eliminar; la acción no se ejecuta hasta confirmar. ✅ `ConfirmDialog.tsx` (`role="dialog"`, `aria-modal`); test "no ejecuta la eliminación sin confirmación". **[AC1]**
* [x] **T004** Tras confirmar: eliminar el archivo físico del bucket con `deleteObject`. ✅ `handleConfirmDelete` → `deleteImage(target.fullPath)`. **[AC1, FR-2]**
* [x] **T005** Tras eliminar: remover la miniatura de la interfaz de forma inmediata y, si la prop está presente, invocar `onDeleteImage(id)`. ✅ Remoción optimista por `setState` (sin refetch) + `onDeleteImage?.(id)`. **[AC1, FR-3]**
* [x] **T006** `[P]` Pruebas con mocks de `storageService`: la eliminación no ocurre sin confirmación; tras confirmar se llama a `deleteObject` y la miniatura desaparece; el error de permisos es visible. ✅ 4 pruebas nuevas en `ImageGallery.test.tsx` + 1 en `GalleryGrid.test.tsx`. **[AC1]**

## Fase 3 — Cierre

* [x] **T007** Errores de `deleteObject` visibles para el usuario (no solo `console.error`, Cláusula III). ✅ `role="alert"` dentro del diálogo; el diálogo permanece abierto y la miniatura no se remueve.
* [x] **T008** Verificación: `npm run test` en verde y build/typecheck sin errores. ✅ **25/25 tests** · `tsc --noEmit` limpio · `vite build` OK (292.60 kB / 91.67 kB gzip).

---

## Gap detectado (decisión autónoma)

**T002 menciona `ImageModal.tsx` (lightbox / vista en detalle), pero el componente no existe** y ninguna spec de las 6 lo crea: la 001 definió la grilla, no un lightbox (referencia arquitectónica en `agents.md`/`plan.md` sin spec propietaria). Decisión: implementar la eliminación **sólo en las miniaturas** (lo que exigen FR-1/FR-2/FR-3 y el escenario de la spec) y **no crear un lightbox sin spec**. `ImageModal.tsx` queda como candidato a una spec futura (p. ej. `007-image-detail`), donde además se ubicaría la segunda acción de eliminar prevista por T002.
