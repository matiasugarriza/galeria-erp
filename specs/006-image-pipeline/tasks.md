# Tasks — Feature 6: Procesamiento y Formato de Imágenes (`image-pipeline`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-10-26

> **Formato:** tareas con casilla. `[P]` = paralelizable. **Pista de backend (Python/Pillow)**: corre en paralelo a las features de frontend. El código vive en una ruta propia fuera de `src/` (p. ej. `functions/` o `scripts/`), autorizada por la ampliación de la Cláusula I. El pipeline de migración batch vive en el repositorio/entorno externo; aquí se implementa la pieza de **procesamiento en servidor**.

---

## Fase 1 — Preparación

* [ ] **T001** Crear la estructura del módulo backend (p. ej. `functions/`) con `requirements.txt` (Pillow; `rembg[cpu]` como dependencia opcional bajo `USAR_REMBG=true`).
* [ ] **T002** Definir las 10 constantes de la spec (`CANVAS_W/H`, `EXT_SALIDA`, `MIME_SALIDA`, `WHITE_BG`, `CROP_MARGIN_PX`, `CROP_TOLERANCE`, `CROP_MIN_GAIN`, `CALIDAD_INICIAL/MINIMA`, `PASO_CALIDAD`, `PESO_MAX_KB`, `USAR_REMBG`). **[FR constantes]**

## Fase 2 — Núcleo (criterios de aceptación)

* [ ] **T003** Pipeline de formato de salida: conversión a RGB, embebido de perfil sRGB, JPEG progresivo (`progressive=True`, `optimize=True`), orientación EXIF corregida con `ImageOps.exif_transpose` y todo EXIF descartado. **[FR-1 a FR-5]**
* [ ] **T004** Recorte automático: estimación de fondo por mediana de franja perimetral del 2%; bbox de píxeles que se alejan >18/255; margen de 100 px; sin recorte si el bbox cubre ≥98% del área. Detección con IA (`rembg`) solo con `USAR_REMBG=true`, con caída al método por color de fondo. **[FR-8 a FR-11]**
* [ ] **T005** Escala y lienzo: nunca agranda (`min(1.0, 2400/w, 1800/h)`, LANCZOS), nunca estira ni recorta a la fuerza, lienzo 4:3 adaptativo clampeado al tope, relleno blanco (255,255,255) centrado. **[FR-12 a FR-15]**
* [ ] **T006** Calidad y peso: q90 inicial, baja de a 5 hasta q60 solo si supera 300 KB; si con q60 no entra, sube igual y avisa por log. **[FR-16 a FR-18]**
* [ ] **T007** Nombres de archivo: `{carpeta}/{código}[_N].jpg`, sanitizado NFKD (Código→codigo, CH-001/A B→CH-001_A_B, limpieza de extremos, `sin_codigo` si queda vacío), sufijo `_N` estable entre corridas (preconteo sobre todas las filas del mismo código), nombre original para subidas sin fila de origen. **[FR-19 a FR-24]**
* [ ] **T008** Handler `onFinalize` de Cloud Functions (runtime Python) con protección anti-reprocesamiento: marca `customMetadata.pipeline=done` en la salida y el evento de ese write no re-dispara el pipeline. **[FR-25]**

## Fase 3 — Cierre

* [ ] **T009** `[P]` Pruebas del pipeline (pytest) contra fixtures en RAM: invariante de no-agrandado, no-deformación, no-recorte por encima del contenido, calidad mínima q60, no-descarte por peso, y numeración estable de variantes. **[Invariantes]**
* [ ] **T010** Despliegue y verificación: `firebase deploy` de la Cloud Function (requiere plan Blaze) y revisión/despliegue de [`storage.rules`](../../storage.rules); verificar que una subida nueva termina JPEG sRGB sin EXIF y con el nombre convencionado. **[Definition of Done backend]**
