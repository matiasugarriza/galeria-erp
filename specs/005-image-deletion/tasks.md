# Tasks — Feature 5: Eliminación de Archivos (`image-deletion`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-10-26

> **Formato:** tareas con casilla. `[P]` = paralelizable. Depende de [`001-gallery-view/tasks.md`](../001-gallery-view/tasks.md).

---

## Fase 1 — Preparación

* [ ] **T001** Añadir a `storageService.ts` `deleteImage(fullPath)` con `deleteObject` y manejo de excepciones (permisos, archivo inexistente). **[FR-2]**

## Fase 2 — Núcleo (criterios de aceptación)

* [ ] **T002** Acción de eliminar en las miniaturas y en el modal de detalle (`ImageModal.tsx`), accesible (`aria-label`, teclado), disponible solo con permisos de edición (`readOnly=false`). **[AC1]**
* [ ] **T003** Modal de diálogo de confirmación antes de eliminar; la acción no se ejecuta hasta confirmar. **[AC1]**
* [ ] **T004** Tras confirmar: eliminar el archivo físico del bucket con `deleteObject`. **[AC1, FR-2]**
* [ ] **T005** Tras eliminar: remover la miniatura de la interfaz de forma inmediata y, si la prop está presente, invocar `onDeleteImage(id)`. **[AC1, FR-3]**
* [ ] **T006** `[P]` Pruebas con mocks de `storageService`: la eliminación no ocurre sin confirmación; tras confirmar se llama a `deleteObject` y la miniatura desaparece; el error de permisos es visible. **[AC1]**

## Fase 3 — Cierre

* [ ] **T007** Errores de `deleteObject` visibles para el usuario (no solo `console.error`, Cláusula III).
* [ ] **T008** Verificación: `npm run test` en verde y build/typecheck sin errores.
