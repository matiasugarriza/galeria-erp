# 🛠️ SKILLS.md — Definición de Skills del Agente de IA

Este documento define el catálogo de habilidades, patrones de diseño y capacidades técnicas requeridas para el desarrollo del proyecto **Galería de Imágenes (Standalone & ERP Plugin)**. 

El agente de IA debe invocar y aplicar estas *skills* según el contexto de la tarea asignada.

---

## 📑 Índice de Skills

1. [skill:react-19-architecture](#1-skillreact-19-architecture)
2. [skill:tailwind-v4-ui](#2-skilltailwind-v4-ui)
3. [skill:firebase-storage-integration](#3-skillfirebase-storage-integration)
4. [skill:dual-mode-component-design](#4-skilldual-mode-component-design)
5. [skill:typescript-strict-typing](#5-skilltypescript-strict-typing)
6. [skill:testing-vitest](#6-skilltesting-vitest)

---

### 1. `skill:react-19-architecture`
**Descripción:** Capacidad para estructurar componentes React 19 eficientes, utilizando patrones modernos de gestión de estado, hooks y optimización de renderizado.

* **Capacidades clave:**
  * Uso correcto de hooks funcionales (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`).
  * Minimizar re-renders innecesarios mediante memorización estratégica y estructura de estado colocalizada.
  * Implementación de patrones de fallback y Suspense o estados de carga declarativos (*Skeletons* y *Spinners*).
  * Control adecuado del ciclo de vida para evitar fugas de memoria (*memory leaks*) en listeners de Firebase.

---

### 2. `skill:tailwind-v4-ui`
**Descripción:** Habilidad para construir interfaces de usuario fluidas, responsivas y accesibles utilizando la nueva sintaxis y motor de Tailwind CSS v4 con `@tailwindcss/vite`.

* **Capacidades clave:**
  * Maquetación **Mobile First** con la sintaxis de grilla adaptativa (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`).
  * Manejo de Layouts complejos: Modal (Lightbox), zonas *Drag & Drop*, tooltips y galerías tipo Masonry o Grid fija.
  * Microinteracciones y estados visuales: `:hover`, `:focus-visible`, `:active`, transiciones de opacidad y escala (`transition-all duration-200`).
  * Incorporación de iconos SVG limpios desde `lucide-react` respetando alineación y accesibilidad (`aria-label`).

---

### 3. `skill:firebase-storage-integration`
**Descripción:** Dominio en la abstracción y consumo de Firebase Storage Web SDK (v10/v11) para operaciones asíncronas con archivos multimedia.

* **Capacidades clave:**
  * **Listado de archivos:** Recuperación de referencias mediante `listAll` / `list` y generación de URLs públicas de descarga (`getDownloadURL`).
  * **Carga de archivos:** Uso de `uploadBytesResumable` para monitorear el progreso exacto en porcentaje (0% - 100%).
  * **Gestión de Metadatos:** Inserción y lectura de metadatos personalizados (`customMetadata` para tags, dimensiones o autor).
  * **Eliminación y Limpieza:** Borrado seguro de objetos con `deleteObject` y manejo de excepciones de permisos o archivos inexistentes.

---

### 4. `skill:dual-mode-component-design`
**Descripción:** Capacidad arquitectónica para diseñar un componente principal que opere de forma autónoma (**Standalone**) o embebida (**Plugin ERP**) sin modificar el código fuente base.

* **Capacidades clave:**
  * **Diseño de Props Inversas / Callbacks:** Exposición limpia de eventos como `onSelectImage(image)`, `onDeleteImage(id)`, `onUploadSuccess(url)`.
  * **Modo Lectura / Permisos:** Control condicional de la UI basado en flags como `readOnly={true}` (oculta controles de subida y borrado).
  * **Aislamiento de contexto:** Asegurar que el componente funcione en modo *Standalone* cuando no recibe props de integración, proporcionando comportamientos por defecto (*fallbacks*).
  * **Filtros contextuales:** Soporte para la prop `filterTag` para segmentar vistas por contexto del ERP (ej: "productos", "facturas", "avatares").

---

### 5. `skill:typescript-strict-typing`
**Descripción:** Definición estricta y segura del sistema de tipos del proyecto sin recurrir a tipos ambiguos.

* **Capacidades clave:**
  * Definición de interfaces claras para modelos de datos (`ImageItem`), props (`ImageGalleryProps`) y respuestas de servicios.
  * Uso de *Unions*, *Optional Chaining* (`?.`) y *Nullish Coalescing* (`??`) para evitar errores en tiempo de ejecución.
  * Manejo de tipos de eventos React (`React.ChangeEvent<HTMLInputElement>`, `React.DragEvent<HTMLDivElement>`).

---

### 6. `skill:testing-vitest`
**Descripción:** Capacidad para escribir y ejecutar pruebas unitarias e integrales ligeras utilizando `vitest`.

* **Capacidades clave:**
  * Pruebas de renderizado y props del componente `ImageGallery`.
  * Mocks de llamadas a Firebase Storage para testing offline.
  * Verificación de disparos de callbacks (`onSelectImage`) ante eventos de interacción del usuario.

---

## 🎯 Matriz de Aplicación por Tarea

| Tarea / Requerimiento | Skills Requeridas |
| :--- | :--- |
| **Creación de la Grilla de Imágenes** | `react-19-architecture`, `tailwind-v4-ui`, `typescript-strict-typing` |
| **Conexión y Subida a Firebase** | `firebase-storage-integration`, `react-19-architecture` |
| **Lightbox / Modal de Detalle** | `tailwind-v4-ui`, `react-19-architecture` |
| **Integración como Plugin del ERP** | `dual-mode-component-design`, `typescript-strict-typing` |
| **Pruebas Unitarias** | `testing-vitest`, `typescript-strict-typing` |