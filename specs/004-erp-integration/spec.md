# Feature 4: Integración como Complemento de ERP (`erp-integration`)

**ID de feature:** `erp-integration`
**Estado:** Propuesta
**Dependencias:** [`001-gallery-view`](../001-gallery-view/spec.md), [`002-image-upload`](../002-image-upload/spec.md) y [`005-image-deletion`](../005-image-deletion/spec.md) (los controles que el modo lectura debe ocultar)

---

## Contexto

Cuando la galería se embebe en un módulo del ERP, el formulario padre necesita seleccionar imágenes mediante callbacks y, según el contexto, restringir las acciones destructivas mediante el modo de solo lectura. Este comportamiento se rige por el patrón *dual-mode* definido en `skills.md` (`skill:dual-mode-component-design`).

## Requisitos Funcionales

* **FR-1:** Al hacer clic sobre una imagen existente, el componente ejecuta el callback `onSelectImage` enviando el objeto `ImageItem` completo (`id`, `url`, `name`, `fullPath`).
* **FR-2:** Tras la selección, el sistema cierra la vista o confirma la selección en el formulario padre.
* **FR-3:** Con la propiedad `readOnly={true}`, el botón de "Subir Imagen" se encuentra oculto o deshabilitado.
* **FR-4:** Con la propiedad `readOnly={true}`, las opciones de eliminación en las miniaturas o modales de detalle no están disponibles.
* **FR-5:** El componente expone la prop opcional `onDeleteImage(id: string)` y la invoca con el `id` de la imagen eliminada tras confirmarse la eliminación (decisión resuelta del 2026-10-26; comportamiento derivado de `skills.md`, sin escenario Gherkin propio).
* **FR-6:** El componente expone la prop opcional `onUploadSuccess(url: string)` y la invoca con la URL pública de la imagen recién subida y procesada (decisión resuelta del 2026-10-26; comportamiento derivado de `skills.md`, sin escenario Gherkin propio).

## Escenarios y Criterios de Aceptación

### Escenario 1: Selección de imagen y retorno al ERP

* **Given** que la galería está embebida en un formulario del ERP
* **And** se pasó la prop `onSelectImage` al componente principal
* **When** el usuario hace clic sobre una imagen existente
* **Then** el sistema ejecuta el callback `onSelectImage` enviando el objeto `ImageItem` (`id`, `url`, `name`, `fullPath`)
* **And** se cierra la vista o se confirma la selección en el formulario padre

### Escenario 2: Restricción de permisos en modo lectura (`readOnly`)

* **Given** que el componente de la galería se instancia con la propiedad `readOnly={true}`
* **When** el usuario visualiza la interfaz
* **Then** el botón de "Subir Imagen" se encuentra oculto o deshabilitado
* **And** las opciones de eliminación en las miniaturas o modales de detalle no están disponibles

## Entidades Clave

* `ImageItem` — objeto entregado al ERP por `onSelectImage`; ver [modelo de datos](../../plan.md#modelo-de-datos). Su campo `name` corresponde al nombre en el bucket (`{código}[_N].jpg`, feature [`006-image-pipeline`](../006-image-pipeline/spec.md)).
* `ImageGalleryProps` — contrato de integración; ver [contratos de interfaz](../../plan.md#contratos-de-interfaz).

## Fuera de Alcance

* La instalación física del módulo dentro del ERP corporativo: el entregable de esta feature es el contrato de props y su comportamiento dentro del componente.
