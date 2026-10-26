# 🤖 AGENTS.md — Reglas Técnicas y Contexto del Proyecto

Este documento establece las directrices técnicas, la arquitectura y los estándares de código que los agentes de IA deben seguir estrictamente para el desarrollo y mantenimiento del proyecto **Galería de Imágenes (Standalone & ERP Plugin)**.

Para conocer el flujo de trabajo y la delimitación de responsabilidades entre subagentes, consulta el archivo [`orchestration.md`](./orchestration.md).

---

## 🎯 Contexto y Objetivo del Proyecto
El proyecto consiste en una **Galería de Imágenes en tiempo real basada en Firebase Storage**, diseñada con un enfoque híbrido:
1. **Modo Standalone:** Una aplicación web completa e independiente (`App.tsx`).
2. **Modo ERP Plugin:** Un componente reutilizable e integrable dentro de un módulo del ERP corporativo mediante props.

---

## 🛠️ Stack Tecnológico Estricto

Cualquier código generado debe ser 100% compatible con las siguientes versiones del ecosistema:

* **Core:** React `^19.3.0` + TypeScript `^7.0.2`
* **Build Tool:** Vite `^8.3.1` (Module Type: `"module"`)
* **Styling:** Tailwind CSS `^4.3.3` (con `@tailwindcss/vite`)
* **Iconos:** `lucide-react` `^1.48.0`
* **Backend Services:** Firebase JS SDK (`firebase/storage`, `firebase/app`)
* **Testing:** Vitest `^5.0.2` (Ejecutar con `npm run test`)

> ⚠️ **REGLA DE ORO:** No instales ni sugieras librerías UI externas adicionales (como Shadcn UI, Material UI o configuraciones antiguas de Tailwind v3) a menos que se solicite explícitamente. Todo el diseño UI debe crearse con componentes nativos de React y clases de utilidad de Tailwind v4.

---

## 📂 Arquitectura y Estructura de Archivos

Los agentes deben mantener rigurosamente la siguiente estructura modular:

```text
src/
├── components/
│   └── ImageGallery/
│       ├── ImageGallery.tsx    # Componente raíz (orquestador UI)
│       ├── GalleryGrid.tsx     # Grilla responsiva y renderizado de ítems
│       ├── ImageModal.tsx      # Lightbox / Vista en detalle / Acciones
│       └── UploadModal.tsx     # Modal / Zona Drag & Drop para carga
├── config/
│   └── firebase.ts         # Inicialización de Firebase SDK
├── services/
│   └── storageService.ts   # Abstracción de llamadas a Firebase Storage
├── types/
│   └── gallery.ts          # Interfaces y Types de TypeScript
├── index.ts                # Exportación pública para integración como módulo/ERP
└── App.tsx                 # Entrada y demostración en Modo Standalone
```

---

## 📏 Convenciones de Código y Naming

* **Archivos de componentes:** PascalCase con extensión `.tsx` (ej: `ImageGallery.tsx`).
* **Servicios, utilidades y configuración:** camelCase con extensión `.ts` (ej: `storageService.ts`, `firebase.ts`).
* **Tipos e interfaces:** se concentran exclusivamente en `src/types/gallery.ts`; no se declaran tipos compartidos fuera de ese archivo.
* **Hooks personalizados:** prefijo `use` en camelCase (ej: `useGalleryImages`).
* **Responsabilidad única:** cada componente de `ImageGallery/` renderiza una parte delimitada de la UI; el módulo se expone al mundo exterior únicamente a través de `ImageGallery.tsx` y `src/index.ts`.

---

## 🧰 Estándares de Código

* **TypeScript estricto:** prohibido el uso de `any` y `@ts-ignore`; ante la duda se define una interfaz explícita en `types/gallery.ts`.
* **Props tipadas:** todo componente expone sus props mediante una interfaz nombrada (ej: `ImageGalleryProps`) exportada desde el módulo.
* **Limpieza de efectos:** todo listener o suscripción de Firebase se desmonta en la función de retorno de `useEffect` (*cleanup*), para evitar fugas de memoria.
* **Manejo de errores:** toda operación asíncrona con Firebase Storage (`uploadBytesResumable`, `getDownloadURL`, `deleteObject`) gestiona un estado de error visible para el usuario, no solo `console.error`.
* **Estado local minimalista:** el estado vive lo más cerca posible del componente que lo usa; se eleva mediante props/callbacks solo cuando un componente hermano realmente lo necesita.
* **Accesibilidad:** los controles interactivos de la galería (subir, cerrar modal, eliminar) llevan `aria-label` descriptivo y son navegables con teclado (`:focus-visible`).

---

## ⚙️ Configuración de Firebase

* Las credenciales del proyecto Firebase se inyectan exclusivamente mediante variables de entorno con prefijo `VITE_` (ej: `VITE_FIREBASE_API_KEY`) y se leen únicamente en `src/config/firebase.ts`.
* **Prohibido** escribir credenciales o claves hardcodeadas en el código fuente ni en los documentos del repositorio.
* El módulo exportado (`src/index.ts`) nunca expone la configuración interna de Firebase al consumidor del plugin ERP.

---

## ✅ Criterios de Aceptación (Definition of Done)

Una tarea se considera terminada solo cuando:

1. `npm run test` (Vitest) pasa sin errores y las nuevas funcionalidades cuentan con pruebas que cubren sus callbacks y estados.
2. El proyecto compila sin errores de TypeScript.
3. La UI resultante es responsiva (*Mobile First*) y fue construida únicamente con Tailwind v4 y componentes nativos de React.
4. No se agregaron dependencias nuevas fuera del stack autorizado.
5. El flujo de 5 fases de [`orchestration.md`](./orchestration.md) se completó y el hallazgo quedó registrado en Engram.