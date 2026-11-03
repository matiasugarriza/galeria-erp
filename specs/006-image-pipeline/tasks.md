# Tasks — Feature 6: Procesamiento y Formato de Imágenes (`image-pipeline`)

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](../../plan.md) · **Fecha:** 2026-11-03 · **Estado:** ✅ implementada salvo T010 (pendiente de despliegue)

> **Formato:** tareas con casilla. `[P]` = paralelizable. **Pista de backend (Python/Pillow)**: corre en paralelo a las features de frontend. El código vive en una ruta propia fuera de `src/` (`functions/`), autorizada por la ampliación de la Cláusula I. El pipeline de migración batch vive en el repositorio/entorno externo; aquí se implementa la pieza de **procesamiento en servidor**.

---

## Fase 1 — Preparación

* [x] **T001** Crear la estructura del módulo backend (`functions/`) con `requirements.txt` (Pillow; `rembg[cpu]` como dependencia opcional bajo `USAR_REMBG=true`). ✅ Estructura: `functions/{pipeline.py, naming.py, main.py, requirements.txt, tests/}`. `requirements.txt`: `functions-framework`, `google-cloud-storage`, `Pillow`, `pillow-heif` (FR-6); `rembg` documentado como opcional. Verificado en local: `import main` OK con esas dependencias.
* [x] **T002** Definir las constantes de la spec. ✅ Las 12 constantes en `pipeline.py` (`CANVAS_W/H`, `EXT_SALIDA`, `MIME_SALIDA`, `WHITE_BG`, `CROP_MARGIN_PX`, `CROP_TOLERANCE`, `CROP_MIN_GAIN`, `CALIDAD_INICIAL/MINIMA`, `PASO_CALIDAD`, `PESO_MAX_KB`, `USAR_REMBG` vía env). **[FR constantes]**

## Fase 2 — Núcleo (criterios de aceptación)

* [x] **T003** Pipeline de formato de salida: RGB, sRGB embebido, JPEG progresivo (`progressive=True`, `optimize=True`), `ImageOps.exif_transpose` y EXIF descartado. ✅ `procesar_imagen()` en `pipeline.py`; tests: salida JPEG/RGB/ICC/SOF2 sin EXIF y orientación corregida; RGBA→RGB. **[FR-1 a FR-5]**
* [x] **T004** Recorte automático: mediana de franja perimetral 2%, bbox >18/255, margen 100 px, sin recorte si ≥98% del área; `rembg` opcional con caída. ✅ `_fondo_perimetral`, `detectar_bbox` (`ImageChops`, C-level), `_recortar`, `_ganancia_suficiente`; `_bbox_rembg` con import tardío y caída al color de fondo testeada. **[FR-8 a FR-11]**
* [x] **T005** Escala y lienzo: `min(1.0, 2400/w, 1800/h)` LANCZOS, nunca estira ni recorta a la fuerza, lienzo 4:3 adaptativo clampeado, relleno blanco centrado. ✅ `_escalar`, `_lienzo_43`; tests: foto chica 531×398 sin agrandar, lienzo 1000×750 con contenido de 500 filas intacto. **[FR-12 a FR-15]**
* [x] **T006** Calidad y peso: q90 inicial, baja de a 5 hasta q60 sólo si >300 KB; si con q60 no entra, sube igual y avisa por log. ✅ `ajustar_calidad()` + `_guardar_jpeg()`; tests: piso q60 con log (vía monkeypatch determinista), q90 inicial, integración real por debajo del techo. **[FR-16 a FR-18]**
* [x] **T007** Nombres de archivo: `{carpeta}/{código}[_N].jpg`, NFKD, limpieza de extremos, `sin_codigo`, `_N` estable, nombre original sin fila. ✅ `naming.py` (`sanitizar`, `calcular_destino`, `misma_variedad`); 15 tests parametrizados + estabilidad entre corridas (preconteo sobre TODOS los archivos, análogo servidor de FR-21). **[FR-19 a FR-24]**
* [x] **T008** Handler `onFinalize` (runtime Python) con protección anti-reprocesamiento. ✅ `main.py::procesar_subida` (`functions_framework.cloud_event`): doble chequeo `ya_procesado` (evento + blob), escribe destino con `customMetadata.pipeline=done` y retira el original si el nombre cambia; `ya_procesado` testeado. **[FR-25]**

## Fase 3 — Cierre

* [x] **T009** `[P]` Pruebas del pipeline (pytest) contra fixtures en RAM: no-agrandado, no-deformación, no-recorte por encima del contenido, calidad mínima q60, no-descarte por peso, numeración estable. ✅ **26/26 tests** en `functions/tests/` (fixtures `io.BytesIO`, sin disco); incluye el orden recorte→escala (FR-7) con discriminación de 1,69M vs 1,08M píxeles oscuros. Runner: `python -m pytest functions/tests`.
* [ ] **T010** Despliegue y verificación: `firebase deploy` de la Cloud Function (requiere plan Blaze) y revisión/despliegue de `storage.rules`; verificar que una subida nueva termina JPEG sRGB sin EXIF y con el nombre convencionado. **⏳ PENDIENTE — requiere el proyecto Firebase del usuario (plan Blaze + credenciales); no ejecutable desde este entorno.**

---

## Decisiones autónomas registradas

1. **Case en el sanitizado (FR-22 vs FR-24):** el ejemplo `Código → codigo` de FR-22 contradice "el nombre conserva el case original" de FR-24; se resolvió **conservando el case** (FR-24 gobierna el nombre; FR-22 sólo exigía quitar acentos) → `sanitizar("Código") == "Codigo"`. Test parametrizado lo fija.
2. **`nombre_original` es el nombre de archivo, no la ruta:** los `/` del código (`CH-001/A B`) se sanitizan a `_`; el handler separa carpeta y basename antes de llamar a `calcular_destino`.
3. **Preconteo de variantes en el servidor:** el "preconteo sobre todas las filas" (FR-21, batch externo) se implementa como preconteo sobre TODOS los objetos existentes de la carpeta (el origen se descarta del set); un reintento no renumera ni pisa archivos ajenos.
4. **`pillow-heif` agregado a `requirements.txt`** para satisfacer FR-6 (HEIC/HEIF) que Pillow sólo soporta con ese plugin; registro guardado con `try/except ImportError` (si no está instalado, el resto del pipeline sigue funcionando). Verificado localmente: `.heic`/`.heif` registrados.
5. **Tests de calidad deterministas:** el bucle q90→q60 se prueba con `_guardar_jpeg` monkeypatcheado (tamaños sintéticos) en vez de depender del peso real de ruido JPEG, que varía entre versiones de Pillow.
