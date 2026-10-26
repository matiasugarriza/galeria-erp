# Feature 1: Visualización de la Galería de Imágenes (`gallery-view`)

**ID de feature:** `gallery-view`
**Estado:** Propuesta
**Dependencias:** ninguna (feature base de la galería)

---

## Contexto

El componente debe recuperar las imágenes desde Firebase Storage y presentarlas en una grilla responsiva con estado de carga y estado vacío. Esta feature es la base sobre la que se apoyan las demás (subida, filtrado, integración ERP y borrado).

Los archivos del bucket siguen la convención `{carpeta}/{código}[_N].jpg` definida en la feature [`006-image-pipeline`](../006-image-pipeline/spec.md): el "nombre del archivo" que muestra cada miniatura es ese nombre ya normalizado (siempre `.jpg`, sin EXIF ni metadatos).

## Requisitos Funcionales

* **FR-1:** Al abrir la vista de la galería, el sistema recupera las imágenes desde Firebase Storage y las renderiza en una grilla responsiva (*mobile-first*).
* **FR-2:** Cada miniatura muestra el nombre del archivo y la fecha de creación.
* **FR-3:** Mientras la carga está en curso se muestra un indicador temporal (*skeleton/spinner*).
* **FR-4:** Si el bucket no contiene imágenes, se muestra un estado vacío (*empty state*) con un acceso directo a la acción de subida.

## Escenarios y Criterios de Aceptación

### Escenario 1: Carga exitosa de imágenes desde Firebase Storage

* **Given** que la conexión con Firebase Storage está activa
* **When** el usuario abre la vista de la galería de imágenes
* **Then** el sistema muestra un indicador de carga (*skeleton/spinner*) temporal
* **And** renderiza las miniaturas de las imágenes en una grilla responsiva (mobile-first)
* **And** cada miniatura muestra el nombre del archivo y la fecha de creación

### Escenario 2: Visualización de galería vacía

* **Given** que no existen imágenes almacenadas en el bucket de Firebase
* **When** el usuario abre la galería
* **Then** el sistema muestra un estado vacío (*empty state*) indicando que no hay archivos
* **And** presenta un botón o acceso directo para invocar la acción de subida

## Entidades Clave

* `ImageItem` — modelo de datos definido en el [plan consolidado](../../plan.md#modelo-de-datos).

## Fuera de Alcance

* Subida de archivos (feature [`002-image-upload`](../002-image-upload/spec.md)).
* Filtrado y búsqueda (feature [`003-image-filter`](../003-image-filter/spec.md)).
* Eliminación de archivos (feature [`005-image-deletion`](../005-image-deletion/spec.md)).
* Comportamiento ERP: `readOnly` y `onSelectImage` (feature [`004-erp-integration`](../004-erp-integration/spec.md)).
