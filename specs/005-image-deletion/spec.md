# Feature 5: Eliminación de Archivos (`image-deletion`)

**ID de feature:** `image-deletion`
**Estado:** ✅ Implementada (rama `feature/005-image-deletion`; 25/25 tests en verde)
**Dependencias:** [`001-gallery-view`](../001-gallery-view/spec.md) (las miniaturas eliminables)

---

## Contexto

El usuario con permisos de edición puede eliminar imágenes de la galería. La eliminación requiere confirmación explícita, borra el archivo físico del bucket de Firebase Storage y actualiza la interfaz de forma inmediata.

`fullPath` identifica la ubicación del archivo según la convención `{carpeta}/{código}[_N].jpg` (feature [`006-image-pipeline`](../006-image-pipeline/spec.md)). La numeración de variantes es estable entre corridas del proceso batch: **no se renumera** tras una eliminación desde el complemento.

## Requisitos Funcionales

* **FR-1:** La galería ofrece la acción de eliminar una imagen cuando el componente tiene permisos de edición (`readOnly=false`), y exige confirmación de la acción en un modal de diálogo.
* **FR-2:** Tras la confirmación, el archivo físico se elimina del bucket de Firebase Storage.
* **FR-3:** La miniatura correspondiente se remueve de la interfaz de usuario de forma inmediata tras la eliminación.

## Escenarios y Criterios de Aceptación

### Escenario 1: Eliminación exitosa de una imagen

* **Given** que el usuario tiene permisos de edición (`readOnly=false`)
* **When** selecciona la opción de eliminar una imagen y confirma la acción en el modal de diálogo
* **Then** el sistema elimina el archivo físico del bucket de Firebase Storage
* **And** remueve la miniatura correspondiente de la interfaz de usuario de forma inmediata

## Entidades Clave

* `ImageItem` — identidad del archivo a eliminar (`id`/`fullPath`); ver [modelo de datos](../../plan.md#modelo-de-datos).

## Fuera de Alcance

* Las reglas de seguridad del bucket a nivel servidor: se entregan como propuesta desplegable en [`storage.rules`](../../storage.rules) (decisión resuelta del 2026-10-26).
* Restricciones de permisos del modo ERP (feature [`004-erp-integration`](../004-erp-integration/spec.md)).
