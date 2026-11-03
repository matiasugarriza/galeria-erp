# Feature 6: Procesamiento y Formato de Imágenes (`image-pipeline`)

**ID de feature:** `image-pipeline`
**Estado:** ✅ Implementada en `functions/` (rama `feature/006-image-pipeline`; 26/26 tests pytest en verde). Despliegue de la Cloud Function pendiente (T010, requiere plan Blaze)
**Dependencias:** ninguna (reglas transversales que gobiernan el contenido del bucket)

---

## Contexto

Este pipeline normaliza las imágenes antes de que residan en el bucket de Firebase Storage. Se ejecuta en dos frentes:

1. **Proceso batch de migración** (Google Drive → bucket), donde cada imagen proviene de una fila con su código.
2. **Procesamiento en servidor de subidas nuevas** (decisión del usuario, 2026-10-23): una Cloud Function de Firebase (runtime Python + Pillow, disparada por `onFinalize`) aplica este pipeline a cada archivo que el complemento web sube, de modo que todo el bucket cumple este contrato uniformemente.

Para las subidas del complemento no existe "fila" de origen, por lo que aplica la regla **FR-23**: se usa el nombre original del archivo (sanitizado) como nombre base. Estas reglas determinan el formato real de **todas** las imágenes que la galería consume, por lo que las demás features deben leerlas: la visualización (001), la subida (002) y la eliminación (005) operan sobre archivos que ya cumplen este contrato.

## Requisitos Funcionales

### Formato de salida

* **FR-1:** Extensión y MIME: siempre `.jpg` / `image/jpeg`. Se ignora la extensión original de Drive.
* **FR-2:** Color: siempre RGB. Imágenes en L, RGBA, CMYK o con perfil ICC se convierten a RGB.
* **FR-3:** Progresivo: sí (`progressive=True`), con `optimize=True`.
* **FR-4:** Perfil ICC: se embebe el perfil sRGB en el archivo final.
* **FR-5:** EXIF: se corrige la orientación (`ImageOps.exif_transpose`) y luego todo el EXIF se descarta. La salida no lleva metadatos.
* **FR-6:** Formatos de entrada soportados: el resto (HEIC/HEIF, TIFF, GIF, BMP, WebP, PNG) se convierte a JPEG.

### Orden del pipeline

* **FR-7:** El pipeline se ejecuta en este orden exacto:
  1. Orientación EXIF + borrado de EXIF
  2. Conversión a sRGB (respetando el ICC embebido si lo hay, intento perceptual)
  3. Recorte automático al contenido
  4. Escala (sin agrandar)
  5. Lienzo 4:3 con padding blanco
  6. JPEG con calidad ajustada al peso

  El recorte va antes de escalar: por eso una foto de 3457 px puede terminar en 1519×1139 en vez de tocar el tope.

### Recorte

* **FR-8:** Margen de aire: 100 px alrededor del contenido detectado (`CROP_MARGIN_PX`).
* **FR-9:** Detección por defecto: por contraste con el color de fondo. El fondo se estima con la mediana de una franja perimetral del 2% del lado más corto (robusto ante píxeles sueltos). Se busca el bbox de píxeles que se alejan del fondo más de 18/255 (`CROP_TOLERANCE`).
* **FR-10:** Sin recorte si el bbox detectado cubre ≥ 98% del área total (`CROP_MIN_GAIN = 0.02`): la foto ya está encuadrada.
* **FR-11:** Detección con IA (opcional): `rembg`, solo con `USAR_REMBG=true` y `pip install "rembg[cpu]"`. Modelo de ~1 GB en la primera corrida. Si falla o no está instalado, cae al método por color de fondo.

### Escala y lienzo

* **FR-12:** Tope: 2400×1800 px (`CANVAS_W`, `CANVAS_H`). Nunca se agranda: `escala = min(1.0, 2400/w, 1800/h)`. Resampling LANCZOS.
* **FR-13:** Nunca se recorta a la fuerza ni se estira: se respeta la proporción original siempre.
* **FR-14:** Lienzo 4:3 adaptativo (se ajusta a la imagen, no al revés):
  * Si la relación de aspecto es ≥ 4:3 → ancho = `w`, alto = `w × 3/4`
  * Si no → alto = `h`, ancho = `h × 4/3`
  * Luego se clampea al tope 2400×1800 y se garantiza que el lienzo contenga la imagen.
* **FR-15:** Relleno: blanco puro (255,255,255), centrado.

### Calidad y peso

* **FR-16:** Calidad inicial: 90. Baja de a 5, hasta un mínimo de 60, solo si supera el techo. Techo: 300 KB (`PESO_MAX_KB`).
* **FR-17:** Si ni con q60 entra en el límite, se sube igual y se avisa por log (no se pierde la imagen).
* **FR-18:** Pesos típicos verificados: 16 KB (foto chica 531×398), ~100 KB (foto ancha a 2400×1800).

### Nombres de archivo en el bucket

* **FR-19:** Formato: `{carpeta}/{código}[_N].{ext}`, con la extensión ya siempre `.jpg`.
* **FR-20:** La primera imagen de un código va sin sufijo; las siguientes `_2`, `_3`, …
* **FR-21:** El número de variante es estable entre corridas: se preconta sobre todas las filas del mismo código, migradas o no. Si solo se contaran las pendientes, un reintento renumeraría y pisaría archivos.
* **FR-22:** Sanitizado: NFKD para quitar acentos (Código → codigo, ñ → n), caracteres problemáticos → `_` (CH-001/A B → CH-001_A_B), se limpian `.`, `_`, `-` al inicio y fin, y si no queda nada → `sin_codigo`.
* **FR-23:** Sin código en la fila → se usa el nombre original del archivo.
* **FR-24:** Agrupamiento de variantes insensible a mayúsculas, pero el nombre conserva el case original.

### Procesamiento en servidor

* **FR-25:** La Cloud Function `onFinalize` **no debe reprocesar su propia salida**: cada archivo procesado se marca (p. ej. `customMetadata.pipeline=done`) y el evento generado por ese mismo write no vuelve a disparar el pipeline. Sin esta protección, un segundo pasaría el recorte sobre el lienzo 4:3 ya relleno y deformaría el resultado *(protección derivada de la decisión de procesamiento en servidor del 2026-10-23)*.

## Invariantes (lo que el script no hace)

* No agranda nunca por encima de la resolución original.
* No estira ni deforma.
* No recorta por encima del contenido detectado.
* No comprime por debajo de q60.
* No descarta la imagen por exceso de peso.
* No escribe en disco: todo en RAM (`io.BytesIO`).

## Constantes de Referencia

| Constante | Valor |
| :--- | :--- |
| `CANVAS_W`, `CANVAS_H` | `2400`, `1800` |
| `EXT_SALIDA` / `MIME_SALIDA` | `".jpg"` / `"image/jpeg"` |
| `WHITE_BG` | `(255, 255, 255)` |
| `CROP_MARGIN_PX` | `100` |
| `CROP_TOLERANCE` | `18` |
| `CROP_MIN_GAIN` | `0.02` |
| `CALIDAD_INICIAL` | `90` |
| `CALIDAD_MINIMA` | `60` |
| `PASO_CALIDAD` | `5` |
| `PESO_MAX_KB` | `300` |
| `USAR_REMBG` | `false` (por defecto) |

## Criterios de Aceptación Adicionales

> ⚠️ **Aclaración de tamaños:** las cifras de "tamaño final" que circulan en el README dependen del recorte previo. La regla exacta es la de *Escala y lienzo* (FR-12 a FR-15); los ejemplos (531×398, 1519×1139, 2400×1800) son resultados de fotos concretas, no valores fijos.

## Fuera de Alcance

* Ejecución del pipeline dentro del navegador/complemento web: la normalización de subidas nuevas es responsabilidad del procesamiento en servidor (Cloud Function `onFinalize`), no del cliente. El componente solo valida, sube y refresca la vista.
* Instalación y despliegue del proceso batch (script Python, modelo `rembg`, variables de entorno) dentro de este repositorio.
* Escritura de archivos en disco: el proceso es íntegramente en memoria (`io.BytesIO`).
