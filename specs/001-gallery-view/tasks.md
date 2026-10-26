# Tasks — Feature 1: Visualización de la Galería (`gallery-view`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-10-26

> **Formato:** tareas con casilla. `[P]` = paralelizable con tareas del mismo nivel. Las pruebas se colocan junto a su componente (decisión resuelta). Esta feature incluye el **scaffold base** del proyecto (T001–T006), requisito previo de todas las demás.

---

## Fase 1 — Preparación (scaffold)

* [ ] **T001** Crear `package.json` con el stack autorizado (Cláusula I de la constitución): react `^19.3.0`, typescript `^7.0.2`, vite `^8.3.1`, tailwindcss `^4.3.3` + `@tailwindcss/vite`, lucide-react `^1.48.0`, firebase, vitest `^5.0.2`; scripts `dev`, `build`, `test` (Vitest).
* [ ] **T002** Configurar `vite.config.ts`, `tsconfig.json` en modo estricto (sin `any`/`@ts-ignore`), integración de Tailwind v4 y configuración de Vitest (convención por defecto: detecta `*.test.tsx` junto a los componentes).
* [ ] **T003** Crear la estructura `src/` de `agents.md`: `components/ImageGallery/`, `config/`, `services/`, `types/`, más `index.ts` y `App.tsx`.
* [ ] **T004** `src/config/firebase.ts`: inicialización del SDK leyendo exclusivamente env vars `VITE_FIREBASE_*`; sin credenciales en el código (Cláusula IV).
* [ ] **T005** `src/types/gallery.ts`: interfaces `ImageItem` (`id`, `name`, `url`, `fullPath`, `createdAt`, `tag?`), `UploadState`, `GalleryFilterState` según el modelo de datos del plan.
* [ ] **T006** `src/services/storageService.ts`: `listImages(filterTag?)` con `listAll`/`list` + `getDownloadURL`, devolviendo `ImageItem[]`; manejo de excepciones de permisos y archivos inexistentes.

## Fase 2 — Núcleo (criterios de aceptación)

* [ ] **T007** `ImageGallery.tsx`: componente raíz con estado de carga, estado de error visible y `useEffect` con *cleanup* (Cláusula III). **[AC1, AC2]**
* [ ] **T008** `GalleryGrid.tsx`: grilla responsiva *mobile-first* (`grid-cols-1 sm:2 md:3 lg:4 xl:5`); cada miniatura muestra nombre de archivo y fecha de creación, con `aria-label` y `:focus-visible`. **[AC1]**
* [ ] **T009** Indicador de carga (*skeleton/spinner*) visible mientras `listImages` está en curso. **[AC1]**
* [ ] **T010** Estado vacío (*empty state*) cuando no hay imágenes, con botón/acceso directo a la acción de subida. **[AC2]**
* [ ] **T011** `[P]` Pruebas (colocadas junto a los componentes, con mocks de `storageService`): carga exitosa (skeleton → grilla con nombre y fecha) y galería vacía (empty state + acceso a subida). **[AC1, AC2]**

## Fase 3 — Cierre

* [ ] **T012** `App.tsx`: demo en modo Standalone consumiendo `ImageGallery` sin props de integración (comportamiento por defecto).
* [ ] **T013** `src/index.ts`: exportación pública de `ImageGallery` e `ImageGalleryProps` para el modo Plugin ERP.
* [ ] **T014** Verificación: `npm run test` en verde y build/typecheck sin errores (Definition of Done).
