# Tasks — Feature 2: Subida de Nuevas Imágenes (`image-upload`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-10-26

> **Formato:** tareas con casilla. `[P]` = paralelizable. Depende del scaffold de [`001-gallery-view/tasks.md`](../001-gallery-view/tasks.md). El pipeline de normalización corre **en servidor** (feature 006); el componente solo valida, sube y refresca.

---

## Fase 1 — Preparación

* [ ] **T001** Definir en `types/gallery.ts` los tipos de error de subida (formato no soportado, archivo >10 MB) como *union* tipada.

## Fase 2 — Núcleo (criterios de aceptación)

* [ ] **T002** `UploadModal.tsx`: modal con zona *drag & drop* y selección directa de archivo; accesible (`aria-label`, navegación con teclado). **[AC1]**
* [ ] **T003** Validación de formato: aceptar `.jpg`, `.png`, `.webp`; bloquear la operación y mostrar mensaje claro con los formatos permitidos ante `.pdf`, `.exe`, `.txt`, etc. **[AC2, FR-4]**
* [ ] **T004** Validación de tamaño: bloquear archivos >10 MB con mensaje junto al de formato, sin iniciar la subida. **[FR-5]**
* [ ] **T005** `uploadImage(file, onProgress)` en `storageService.ts` con `uploadBytesResumable`; la barra de progreso del modal refleja 0%–100% en tiempo real. **[AC1, FR-2]**
* [ ] **T006** Tras completarse la subida: refrescar la lista (la normalización la ejecuta la Cloud Function de la feature 006, FR-6 de esta spec) y mostrar la imagen ya procesada en la grilla. **[AC1, FR-3, FR-6]**
* [ ] **T007** Respetar `readOnly={true}`: la invocación del modal de subida no está disponible en modo lectura (validación formal en la feature 004).
* [ ] **T008** `[P]` Pruebas con mocks de `storageService`: progreso 0→100, rechazo de formato no permitido con mensaje, rechazo de >10 MB, y actualización automática de la grilla tras subida. **[AC1, AC2]**

## Fase 3 — Cierre

* [ ] **T009** Errores de red/permisos de `uploadBytesResumable` visibles para el usuario (no solo `console.error`, Cláusula III).
* [ ] **T010** Verificación: `npm run test` en verde y build/typecheck sin errores.
