# Tasks — Feature 3: Filtrado y Búsqueda (`image-filter`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-10-26

> **Formato:** tareas con casilla. `[P]` = paralelizable. Depende de [`001-gallery-view/tasks.md`](../001-gallery-view/tasks.md).

---

## Fase 1 — Preparación

* [ ] **T001** Utilidad de normalización de búsqueda (colocada junto a los componentes, p. ej. `searchUtils.ts`): NFKD + eliminación de diacríticos + minúsculas, aplicada al término y a los nombres.

## Fase 2 — Núcleo (criterios de aceptación)

* [ ] **T002** Barra de búsqueda rápida en `ImageGallery.tsx` con estado `searchTerm` (local, minimalista — Cláusula III). **[AC1]**
* [ ] **T003** Filtrado instantáneo de la grilla mientras el usuario escribe, insensible a mayúsculas y acentos (FR-1). **[AC1]**
* [ ] **T004** Soporte de `filterTag`: la prop conecta `listImages(filterTag)` (carpeta del bucket) y la vista aplica ese filtro por defecto. **[AC2, FR-2]**
* [ ] **T005** `[P]` Pruebas: filtrado en tiempo real por texto, coincidencia insensible a mayúsculas/acentos, y filtrado automático por `filterTag="productos"` sobre mocks. **[AC1, AC2]**

## Fase 3 — Cierre

* [ ] **T006** Accesibilidad de la barra de búsqueda (`aria-label`, `:focus-visible`).
* [ ] **T007** Verificación: `npm run test` en verde y build/typecheck sin errores.
