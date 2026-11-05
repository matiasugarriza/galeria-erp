# Tareas — Feature 7: Galería ERP sobre Firestore

**Objetivo:** reemplazar el listado de Storage por la colección `fotos` de Firestore (paginado de 24 + búsqueda por prefijo), miniaturas WebP de 300 px generadas en el pipeline, compresión y vista previa en el cliente, selección múltiple, eliminación del modo standalone y esquema preparado para IA.
**Rama:** `feature/007-gallery-performance` (basada en `feature/006-image-pipeline` @ `67e22d8`)
**Tests:** `npm.cmd run test` (frontend) · `python -m pytest functions/tests` (backend) · `npm.cmd run build` (build)

## Especificación

Requisitos, escenarios y criterios de aceptación en [`spec.md`](./spec.md) — FR-1 a FR-16.

## Tareas

* [x] **T001** `[delegado: writer B2 — unidad backend/datos]` Pipeline y datos: miniatura WebP 300 px (FR-4), `cacheControl` + `firebaseStorageDownloadTokens` en principal y miniatura (FR-6), escritura del documento `fotos` con esquema preparado para IA (FR-1, FR-15), salida principal WebP (FR-14), trigger de borrado (FR-16), `firestore.rules`, `firestore.indexes.json`, `firebase.json` (sección Firestore) y script de migración `functions/migrar_galeria.py` para las 200+ existentes; tests pytest. **FR-1, FR-4, FR-6, FR-9, FR-14, FR-15, FR-16** — Edit surfaces: `functions/`, `firestore.rules`, `firestore.indexes.json`, `firebase.json` — **✅ 2026-11-05** (87 pytest verdes; costura del padre corrigió `fullPath` en el documento)
* [x] **T002** `[delegado: writer A2 — unidad frontend]` Servicio Firestore paginado + búsqueda por prefijo (FR-2, FR-3), compresión en navegador y `cacheControl` (FR-6, FR-7), vista previa local (FR-8), grilla con miniaturas lazy (FR-4, FR-5), modal (FR-10), selección múltiple con `onSelect(fotosElegidas)` y bloqueo de "para revisar" (FR-11), prop de filtro inicial por código (FR-12), App sólo ERP (FR-13), formatos (FR-14); tests. **FR-2, FR-3, FR-5, FR-7, FR-8, FR-10, FR-11, FR-12, FR-13, FR-14** — Edit surfaces: `src/`, `package.json`, `package-lock.json` — **✅ 2026-11-05** (52 vitest verdes + build; costura del padre dejó `getDb()` perezoso)
* [x] **T003** `[padre]` Infraestructura: habilitar/crear Firestore (región `southamerica-east1`), `firebase deploy --only functions,firestore --project migrador-drive-storage`, correr la migración de las imágenes existentes y verificar E2E sin sesión (documentos + miniaturas WebP). **FR-1, FR-9** — **✅ 2026-11-05** (Firestore `default`/`southamerica-east1`; `procesar_subida` actualizada + `on_object_deleted` creada; **1.646 objetos migrados** —1.095 en la primera corrida + 551 en la segunda—, 0 errores; E2E público: documento 200 con todos los campos, miniatura `image/webp` cache 1 año, escritura cliente 403)
* [x] **T004** `[padre]` Costura: suites completas + build, README y notas de specs (006: salida WebP + miniatura), commits por unidad, assess RDD y push. **Todos** — **✅ 2026-11-05** (52 vitest + 87 pytest + build verdes; commits `bdb60a8` specs, `d959ea9` backend, `1e7b0a8` frontend, `d575807` README, `2fd9955` fix de índices; assess `707c9c0..HEAD`: medium / under_budget; rama pusheada)

## Log

* **L1** (2026-11-04, usuario): "Funciona bien pero hago algunas observaciones. No entiendo bien la diferencia entre standalone y modo ERP. Por otro lado, la carga al entrar a la web se hacer super lenta, quizás porque trae todas las imágenes. Podría traer solamente algunas e ir cargando más a medida que se scrollea."
* **L2** (2026-11-04, usuario): "También la galería podría traer un thumbnail de la imagen que permita ampliar para ver el tamaño real."
* **L3** (2026-11-05, usuario — reemplaza la arquitectura del borrador 2026-11-04): "Velocidad
- No usar listAll del Storage: lista todo y es lento. Conviene que la grilla salga de una colección en Firestore con un documento por foto (código de artículo, URL y URL de la miniatura). Así se consulta filtrando por código y con limit.
- Paginado: traer de a 24 fotos con startAfter y cargar más al bajar (scroll infinito).
- Miniaturas: en la grilla, una versión chica (unos 300 px, WebP). La foto grande se baja sólo al tocarla.
- loading=\"lazy\" en las <img>, para que se descarguen recién cuando aparecen en pantalla.
- Caché: subir las fotos con cacheControl: 'public, max-age=31536000' para que el navegador no las baje de nuevo cada vez.
- Búsqueda: que busque en Firestore por código (con un prefijo, >= y <=), no filtrando en el navegador después de bajar todo.

Subida
- Achicar y comprimir la foto en el navegador antes de subirla (por ejemplo, con browser-image-compression).
- Mostrarla al instante en la grilla con una vista previa local, mientras termina de subir de fondo.
- Generar la miniatura al subir, para que esté lista desde el primer momento.

Para la ficha técnica
- Al tocar una foto, que se abra grande.
- Que se puedan tildar varias y que el plugin devuelva cuáles eligieron con onSelect(fotosElegidas).
- Que se pueda abrir ya filtrado por un código de artículo, pasándolo por props.

Sacar el modo standalone, como dijiste: queda sólo el modo ERP.

Una idea para más adelante
Hoy la imagen sale de Corel y se sube a mano. Estaría bueno que, con IA, se pueda mejorar la imagen o generar la espalda o algún detalle a partir de la foto del frente. No hace falta armarlo ahora, pero si lo dejás preparado, después encaja sin rehacer nada:
- Formatos: aceptar también PNG (Corel exporta con fondo transparente) y WebP, no sólo JPG.
- Tipo de vista: cada foto con un campo vista: frente, espalda o detalle.
- Origen: un campo origen: corel o ia, y si es de IA, de qué foto salió (basadaEn: idFotoOriginal).
- Nunca pisar la original: una versión mejorada o generada se guarda como foto nueva.
- Aprobación: las fotos hechas con IA quedan \"para revisar\" y no se pueden tildar para la ficha hasta que alguien las aprueba (si la espalda sale mal, el taller la cose así).
- Que la grilla lea la colección de Firestore, así cualquier foto que se agregue por otro lado aparece sola."
* **L4** (2026-11-05, decisión): se reescribe el borrador 007 (paginar Storage + miniaturas JPEG 400) para adoptar Firestore + WebP 300 + compresión cliente, según L3. Writer trigger activo: dos unidades independientes con superficies disjuntas (`src/` vs `functions/` + configuración) lanzadas en paralelo; el padre posee git, infraestructura (Firestore/deploy/migración) y cierre.
* **L5** (2026-11-05, evidencia): T001 y T002 completadas por los escritores en paralelo; costura del padre en verde — 87 pytest, 52 vitest y build sin errores. La costura detectó y corrigió dos defectos de contrato: el documento de Firestore no escribía `fullPath` (el borrado del cliente habría apuntado a la raíz) y `db` se exportaba de forma eager (rompía el arranque sin `VITE_FIREBASE_PROJECT_ID`).
* **L6** (2026-11-05, bloqueo de infraestructura): la sesión de Firebase CLI venció (`firebase login --reauth` pendiente) y la cuenta de servicio no tiene permiso para habilitar APIs, así que Firestore todavía no existía en el proyecto.
* **L7** (2026-11-05, despliegue): tras la re-autenticación se habilitó `firestore.googleapis.com` y se creó la base `default` en `southamerica-east1`; el deploy de `functions,firestore` quedó verde (el índice compuesto se quitó porque Firestore lo rechaza como innecesario — `2fd9955`). La migración se corrió en dos pasadas por timeout de la primera: **1.646 objetos** en total (el bucket tenía más imágenes que las "200+" estimadas), **1.646 miniaturas y 1.646 documentos, 0 errores**. Verificación E2E sin sesión: documento público completo, miniatura WebP con caché de un año, foto grande accesible, búsqueda por prefijo ordenada y escritura cliente denegada (403).
