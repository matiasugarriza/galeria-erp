# Tasks — Feature 4: Integración como Complemento de ERP (`erp-integration`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-10-26

> **Formato:** tareas con casilla. `[P]` = paralelizable. Depende de `001`, `002` y `005`; valida de forma formal el `readOnly` implementado desde la feature 002.

---

## Fase 1 — Preparación

* [ ] **T001** Completar `ImageGalleryProps` en `types/gallery.ts` con las cinco props (`filterTag`, `readOnly`, `onSelectImage`, `onDeleteImage`, `onUploadSuccess`), todas opcionales salvo `readOnly` (default `false`).

## Fase 2 — Núcleo (criterios de aceptación)

* [ ] **T002** Selección: clic sobre una imagen ejecuta `onSelectImage` enviando `ImageItem` completo (`id`, `url`, `name`, `fullPath`). **[AC1, FR-1]**
* [ ] **T003** Tras la selección: cerrar la vista o confirmar la selección en el formulario padre. **[AC1, FR-2]**
* [ ] **T004** Modo lectura con `readOnly={true}`: ocultar o deshabilitar el botón de "Subir Imagen". **[AC2, FR-3]**
* [ ] **T005** Modo lectura con `readOnly={true}`: retirar las opciones de eliminación en miniaturas y modal de detalle. **[AC2, FR-4]**
* [ ] **T006** Exponer `onDeleteImage(id)` y `onUploadSuccess(url)` como props opcionales, invocadas al borrarse una imagen y al completarse una subida respectivamente (decisión resuelta 2026-10-26). **[FR-5, FR-6]**
* [ ] **T007** `[P]` Pruebas: `onSelectImage` recibe el `ImageItem` correcto; con `readOnly={true}` no aparece el botón de subir ni las acciones de borrar; callbacks de borrado/subida se disparan. **[AC1, AC2]**

## Fase 3 — Cierre

* [ ] **T008** Demo en modo ERP en `App.tsx` que embebe la galería pasando `filterTag` y los callbacks, comprobando que el mismo código base opera en ambos modos (Cláusula de doble modo).
* [ ] **T009** Verificación: `npm run test` en verde y build/typecheck sin errores.
