# Feature 3: Filtrado y Búsqueda (`image-filter`)

**ID de feature:** `image-filter`
**Estado:** ✅ Implementada (rama `feature/003-image-filter`; 21/21 tests en verde)
**Dependencias:** [`001-gallery-view`](../001-gallery-view/spec.md) (la grilla filtrable)

---

## Contexto

La galería debe ofrecer dos mecanismos de filtrado: una búsqueda rápida en tiempo real por nombre y un filtro automático por contexto (`filterTag`) cuando el componente se instancia desde un módulo del ERP.

## Requisitos Funcionales

* **FR-1:** La galería expone una barra de búsqueda rápida cuyo texto filtra la grilla instantáneamente, mostrando solo las imágenes cuyo nombre coincide con el texto ingresado. La comparación es **insensible a mayúsculas y acentos** (normalización NFKD del término y de los nombres, decisión resuelta del 2026-10-26). Dado que los nombres siguen la convención `{código}[_N].jpg` (feature [`006-image-pipeline`](../006-image-pipeline/spec.md)), la búsqueda opera de facto sobre códigos de imagen.
* **FR-2:** El componente soporta la prop `filterTag`; al recibirla, la vista muestra por defecto únicamente las imágenes etiquetadas con ese tag de contexto (ej. `"productos"`, `"facturas"`, `"avatares"`). El tag de contexto corresponde a la **carpeta** del bucket (`filterTag="productos"` → carpeta `productos/`) *(inferido de la convención de nombres de la feature 006 — confirmar)*.

## Escenarios y Criterios de Aceptación

### Escenario 1: Filtrado en tiempo real por término de búsqueda

* **Given** que la galería contiene múltiples imágenes cargadas
* **When** el usuario escribe texto en la barra de búsqueda rápida
* **Then** la grilla se filtra instantáneamente mostrando solo las imágenes cuyo nombre coincide con el texto ingresado

### Escenario 2: Filtrado automático por contexto de ERP (`filterTag`)

* **Given** que el componente de la galería se instancia desde un módulo del ERP con la prop `filterTag="productos"`
* **When** el sistema recupera los elementos de Firebase
* **Then** la vista aplica el filtro por defecto mostrando únicamente las imágenes etiquetadas como "productos"

## Entidades Clave

* `ImageItem` — modelo de datos definido en el [plan consolidado](../../plan.md#modelo-de-datos); el campo `tag` sostiene el filtrado por contexto.
* Estado de filtro de la galería — ver [modelo de datos](../../plan.md#modelo-de-datos).

## Fuera de Alcance

* Subida y borrado de archivos (features [`002-image-upload`](../002-image-upload/spec.md) y [`005-image-deletion`](../005-image-deletion/spec.md)).
* Restricciones de permisos del modo ERP (feature [`004-erp-integration`](../004-erp-integration/spec.md)).
