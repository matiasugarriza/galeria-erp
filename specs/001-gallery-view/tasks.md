# Tasks — Feature 1: Visualización de la Galería (`gallery-view`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-10-26 · **Estado:** ✅ completada (commit en `feature/001-gallery-view`)

> **Formato:** tareas con casilla. `[P]` = paralelizable con tareas del mismo nivel. Las pruebas se colocan junto a su componente (decisión resuelta). Esta feature incluye el **scaffold base** del proyecto (T001–T006), requisito previo de todas las demás.

---

## Fase 1 — Preparación (scaffold)

* [x] **T001** Crear `package.json` con el stack autorizado (Cláusula I de la constitución): react `^19.3.0`, typescript `^7.0.2`, vite `^8.3.1`, tailwindcss `^4.3.3` + `@tailwindcss/vite`, lucide-react `^1.48.0`, firebase, vitest `^5.0.2`; scripts `dev`, `build`, `test` (Vitest). ✅ versiones verificadas en npm antes de instalar.
* [x] **T002** Configurar `vite.config.ts`, `tsconfig.json` en modo estricto (sin `any`/`@ts-ignore`), integración de Tailwind v4 y configuración de Vitest (convención por defecto: detecta `*.test.tsx` junto a los componentes). ✅ `jsdom` + `globals: true`.
* [x] **T003** Crear la estructura `src/` de `agents.md`: `components/ImageGallery/`, `config/`, `services/`, `types/`, más `index.ts` y `App.tsx`. ✅ más `main.tsx` (bootstrap Vite) y `vite-env.d.ts` (tipado de env vars).
* [x] **T004** `src/config/firebase.ts`: inicialización del SDK leyendo exclusivamente env vars `VITE_FIREBASE_*`; sin credenciales en el código (Cláusula IV). ✅ inicialización perezosa; plantilla documentada en `vite-env.d.ts` (el hook de permisos bloqueó `.env.example`).
* [x] **T005** `src/types/gallery.ts`: interfaces `ImageItem` (`id`, `name`, `url`, `fullPath`, `createdAt`, `tag?`), `UploadState`, `GalleryFilterState` según el modelo de datos del plan. ✅ más `ImageGalleryProps` (contrato dual-mode completo).
* [x] **T006** `src/services/storageService.ts`: `listImages(filterTag?)` con `listAll`/`list` + `getDownloadURL`, devolviendo `ImageItem[]`; manejo de excepciones de permisos y archivos inexistentes. ✅ incluye `getMetadata` por objeto para `timeCreated` (riesgo R2 aceptado en el plan).

## Fase 2 — Núcleo (criterios de aceptación)

* [x] **T007** `ImageGallery.tsx`: componente raíz con estado de carga, estado de error visible y `useEffect` con *cleanup* (Cláusula III). ✅ flag `cancelled` en el effect.
* [x] **T008** `GalleryGrid.tsx`: grilla responsiva *mobile-first* (`grid-cols-1 sm:2 md:3 lg:4 xl:5`); cada miniatura muestra nombre de archivo y fecha de creación, con `aria-label` y `:focus-visible`. ✅ **[AC1]**
* [x] **T009** Indicador de carga (*skeleton/spinner*) visible mientras `listImages` está en curso. ✅ skeleton `role="status"` con 8 bloques `animate-pulse`. **[AC1]**
* [x] **T010** Estado vacío (*empty state*) cuando no hay imágenes, con botón/acceso directo a la acción de subida. ✅ botón `aria-label="Subir imagen"` (costura hacia el UploadModal de la feature 002). **[AC2]**
* [x] **T011** `[P]` Pruebas (colocadas junto a los componentes, con mocks de `storageService`): carga exitosa (skeleton → grilla con nombre y fecha) y galería vacía (empty state + acceso a subida). ✅ 8 pruebas en verde (más error visible y filtro `filterTag`). **[AC1, AC2]**

## Fase 3 — Cierre

* [x] **T012** `App.tsx`: demo en modo Standalone consumiendo `ImageGallery` sin props de integración (comportamiento por defecto).
* [x] **T013** `src/index.ts`: exportación pública de `ImageGallery` e `ImageGalleryProps` para el modo Plugin ERP.
* [x] **T014** Verificación: `npm run test` en verde y build/typecheck sin errores (Definition of Done). ✅ 8/8 tests · `tsc --noEmit` limpio · `vite build` OK (269.76 kB / 85.25 kB gzip).
