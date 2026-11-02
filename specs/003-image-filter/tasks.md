# Tasks — Feature 3: Filtrado y Búsqueda (`image-filter`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-11-02 · **Estado:** ✅ completada (rama `feature/003-image-filter`)

> **Formato:** tareas con casilla. `[P]` = paralelizable. Depende de [`001-gallery-view/tasks.md`](../001-gallery-view/tasks.md).

---

## Fase 1 — Preparación

* [x] **T001** Utilidad de normalización de búsqueda (colocada junto a los componentes, p. ej. `searchUtils.ts`): NFKD + eliminación de diacríticos + minúsculas, aplicada al término y a los nombres. ✅ `src/components/ImageGallery/searchUtils.ts` con `normalizeSearch` / `matchesSearch` (`\p{M}` para diacríticos).

## Fase 2 — Núcleo (criterios de aceptación)

* [x] **T002** Barra de búsqueda rápida en `ImageGallery.tsx` con estado `searchTerm` (local, minimalista — Cláusula III). ✅ `useState` local, input con `aria-label="Buscar imágenes"` e icono `Search`. **[AC1]**
* [x] **T003** Filtrado instantáneo de la grilla mientras el usuario escribe, insensible a mayúsculas y acentos (FR-1). ✅ `visibleItems = items.filter(matchesSearch)` en el render; se limpia al cambiar `filterTag`. **[AC1, FR-1]**
* [x] **T004** Soporte de `filterTag`: la prop conecta `listImages(filterTag)` (carpeta del bucket) y la vista aplica ese filtro por defecto. ✅ ya cableado desde la spec 001; test existente "pasa filterTag al servicio de listado". **[AC2, FR-2]**
* [x] **T005** `[P]` Pruebas: filtrado en tiempo real por texto, coincidencia insensible a mayúsculas/acentos, y filtrado automático por `filterTag="productos"` sobre mocks. ✅ 6 pruebas nuevas (4 en `searchUtils.test.ts`, 2 en `ImageGallery.test.tsx`); filterTag cubierto desde la 001. **[AC1, AC2]**

## Fase 3 — Cierre

* [x] **T006** Accesibilidad de la barra de búsqueda (`aria-label`, `:focus-visible`). ✅ `aria-label` + `focus-visible:outline-2` en el input.
* [x] **T007** Verificación: `npm run test` en verde y build/typecheck sin errores. ✅ **21/21 tests** · `tsc --noEmit` limpio · `vite build` OK (289.64 kB / 91.05 kB gzip).

> **Decisión autónoma:** cuando la búsqueda no tiene coincidencias, la grilla muestra un aviso "No se encontraron imágenes que coincidan con …" en lugar de una pantalla en blanco (no definido en la spec; mejora de UX sin nuevos requisitos).
