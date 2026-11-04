# Feature 2: Subida de Nuevas Imágenes (`image-upload`)

**ID de feature:** `image-upload`
**Estado:** ✅ Implementada (rama `feature/002-image-upload`; 15/15 tests en verde)
**Dependencias:** [`001-gallery-view`](../001-gallery-view/spec.md) (la grilla que debe actualizarse)

---

## Contexto

El componente debe permitir cargar imágenes a Firebase Storage mediante arrastre (*drag & drop*) o selección de archivo, mostrando el progreso real de la subida. La acción solo existe cuando el componente no opera en modo lectura.

> El procesamiento ocurre **en servidor**: `uploadImage` sube el archivo a Firebase Storage y, tras la subida, la Cloud Function de la feature [`006-image-pipeline`](../006-image-pipeline/spec.md) aplica el pipeline completo (normalización, nombre sanitizado y peso ≤ 300 KB) antes de que la imagen quede definitiva en el bucket. El componente no reproduce el pipeline en el cliente.

## Requisitos Funcionales

* **FR-1:** Aceptar archivos de imagen en formato `.jpg`, `.png` o `.webp`, ingresados por arrastre o selección directa, únicamente cuando el componente no se encuentra en modo `readOnly=true`.
* **FR-2:** Durante la carga se muestra una barra de progreso activa de 0% a 100%.
* **FR-3:** Tras la subida exitosa, la grilla de la galería se actualiza automáticamente mostrando la nueva imagen.
* **FR-4:** Bloquear la operación de subida de archivos con extensión no soportada, mostrando un mensaje de error claro que indique los formatos permitidos.
* **FR-5:** Bloquear la operación de subida de archivos mayores a 10 MB, mostrando un mensaje de error claro junto al de formato, sin iniciar la subida (el servidor además garantiza el techo de 300 KB tras procesar, feature 006).
* **FR-6:** Una vez completada la subida, la normalización del archivo la ejecuta el procesamiento en servidor de la feature 006 (Cloud Function `onFinalize`); el componente espera, refresca la lista y muestra la imagen ya procesada.

## Escenarios y Criterios de Aceptación

### Escenario 1: Subida exitosa de un archivo válido

* **Given** que el componente no se encuentra en modo `readOnly=true`
* **When** el usuario arrastra o selecciona un archivo de imagen en formato `.jpg`, `.png` o `.webp`
* **Then** el sistema muestra una barra de progreso de subida activa (0% a 100%)
* **And** el archivo se almacena correctamente en Firebase Storage
* **And** la grilla de la galería se actualiza automáticamente mostrando la nueva imagen

### Escenario 2: Rechazo de formato no permitido

* **Given** que el usuario se encuentra en el modal de subida de archivos
* **When** intenta cargar un archivo con extensión no soportada (ej. `.pdf`, `.exe`, `.txt`)
* **Then** el sistema bloquea la operación de subida
* **And** muestra un mensaje de error claro indicando los formatos permitidos

## Entidades Clave

* `ImageItem` — modelo de datos definido en el [plan consolidado](../../plan.md#modelo-de-datos).
* Estado de subida en progreso (porcentaje 0–100%) — ver [modelo de datos](../../plan.md#modelo-de-datos).

## Fuera de Alcance

* Restricciones de permisos por `readOnly` en el resto de la UI (feature [`004-erp-integration`](../004-erp-integration/spec.md)).
* Visualización base de la grilla (feature [`001-gallery-view`](../001-gallery-view/spec.md)).
* Las reglas de seguridad del bucket a nivel servidor: se entregan como propuesta desplegable en [`storage.rules`](../../storage.rules) (decisión resuelta del 2026-10-26; actualizadas y desplegadas con acceso público el 2026-11-04 para la demo — ver README «Reglas de Storage»).
