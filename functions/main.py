"""Cloud Functions de Firebase (runtime Python) — Storage ↔ Firestore.

``procesar_subida`` se dispara con ``onFinalize`` sobre el bucket y aplica el
pipeline de la spec 006/007 a cada subida nueva del complemento:

* salida principal WebP calidad 85 (FR-14), con token de descarga y caché de
  un año (FR-6);
* miniatura WebP 300×225 en ``thumbs/`` generada desde los bytes en memoria
  (FR-4/FR-9), también con token y caché;
* documento en la colección raíz ``fotos`` con el esquema preparado para IA
  (FR-1/FR-15), escrito con ``create`` para no pisar uno existente.

La guarda anti-loop es DOBLE: además del marcador de metadata
``pipeline=done`` (FR-25 de la spec 006), cualquier objeto bajo ``thumbs/``
se descarta al inicio.

``on_object_deleted`` completa el borrado coherente (FR-16): al borrarse un
objeto fuera de ``thumbs/`` elimina su documento y su miniatura. El borrado
de la imagen temporal que hace el propio pipeline se marca con
``reemplazadoPor`` y el trigger lo ignora.
"""
from __future__ import annotations

import logging

from firebase_functions import storage_fn
from google.api_core.exceptions import AlreadyExists
from google.cloud import firestore
from google.cloud import storage as gcs

from naming import (
    COLECCION_FOTOS,
    PREFIJO_MINIATURA,
    calcular_destino,
    doc_id,
    documento_foto,
    ruta_miniatura,
    url_descarga,
)
from pipeline import (
    CACHE_CONTROL,
    MIME_SALIDA,
    generar_miniatura,
    metadata_objeto,
    nuevo_token,
    procesar_imagen,
    ya_procesado,
)

logger = logging.getLogger(__name__)

# StorageOptions exige nombre de bucket explicito durante el discovery:
# FIREBASE_CONFIG no esta garantizado ahi (options.py:902-912).
BUCKET = "migrador-drive-storage.firebasestorage.app"

# Marca aditiva que el pipeline deja en el origen justo antes de borrarlo,
# para que el trigger de borrado no confunda esa limpieza con una baja real.
MARCA_REEMPLAZO = "reemplazadoPor"


def _publicar_documento(
    bucket_name: str,
    destino_nombre: str,
    token: str,
    token_thumb: str,
    creado_en,
) -> None:
    """Crea el documento ``fotos/{docId}`` sin pisar uno existente (FR-1/FR-15)."""
    documento = documento_foto(
        destino_nombre,
        url=url_descarga(bucket_name, destino_nombre, token),
        thumb_url=url_descarga(
            bucket_name, ruta_miniatura(destino_nombre), token_thumb
        ),
        creado_en=creado_en,
    )
    referencia = firestore.Client().collection(COLECCION_FOTOS).document(
        doc_id(destino_nombre)
    )
    try:
        referencia.create(documento)
    except AlreadyExists:
        logger.info(
            "El documento %s ya existe; se conserva (FR-15)",
            doc_id(destino_nombre),
        )
        return
    logger.info("Documento %s creado", doc_id(destino_nombre))


@storage_fn.on_object_finalized(bucket=BUCKET)
def procesar_subida(event) -> None:
    datos = event.data
    nombre: str = datos.name
    bucket_name: str = datos.bucket

    # Guarda anti-loop (a): las miniaturas no se procesan, ni siquiera antes
    # de tocar GCS.
    if nombre.startswith(PREFIJO_MINIATURA):
        logger.info("Miniatura detectada, se omite: %s", nombre)
        return

    # FR-25: la propia salida no se reprocesa (metadatos del evento).
    if ya_procesado(datos.metadata):
        logger.info("Salida ya procesada, se omite: %s", nombre)
        return

    cliente = gcs.Client()
    bucket = cliente.bucket(bucket_name)

    # Doble verificación con los metadatos reales del objeto. get_blob trae
    # las propiedades cargadas; bucket.blob() crea solo un objeto local.
    blob = bucket.get_blob(nombre)
    if blob is None:
        logger.info("El objeto desapareció antes de procesar: %s", nombre)
        return
    if ya_procesado(blob.metadata):
        logger.info("Salida ya procesada (blob), se omite: %s", nombre)
        return

    entrada = blob.download_as_bytes()
    salida = procesar_imagen(entrada)

    carpeta = nombre.rsplit("/", 1)[0] if "/" in nombre else ""
    nombre_archivo = nombre.rsplit("/", 1)[-1]
    existentes = {elemento.name for elemento in bucket.list_blobs()}
    existentes.discard(nombre)  # el origen no cuenta consigo mismo
    destino_nombre = calcular_destino(carpeta, nombre_archivo, existentes)

    # Imagen principal: WebP + token descargable + cacheControl (FR-6/FR-14).
    token = nuevo_token()
    destino = bucket.blob(destino_nombre)
    # google-cloud-storage 3.x: los metadatos se setean en el blob ANTES
    # del upload (upload_from_string no acepta kwarg de metadatos).
    destino.metadata = metadata_objeto(token)
    destino.cache_control = CACHE_CONTROL
    destino.upload_from_string(salida, content_type=MIME_SALIDA)
    logger.info(
        "Procesado %s → %s (%d bytes)", nombre, destino_nombre, len(salida)
    )

    # FR-4/FR-9: la miniatura se genera desde la salida ya en memoria (sin
    # volver a descargar) y se sube en thumbs/{destino sin extensión}.webp.
    ruta_thumb = ruta_miniatura(destino_nombre)
    token_thumb = nuevo_token()
    thumb = bucket.blob(ruta_thumb)
    thumb.metadata = metadata_objeto(token_thumb)
    thumb.cache_control = CACHE_CONTROL
    thumb.upload_from_string(
        generar_miniatura(salida), content_type=MIME_SALIDA
    )
    logger.info("Miniatura %s subida", ruta_thumb)

    # Documento de Firestore (FR-1/FR-15) antes de retirar el temporal.
    _publicar_documento(
        bucket_name, destino_nombre, token, token_thumb, blob.time_created
    )

    # Si el destino no es el origen (p. ej. foto.png → foto.webp), se retira
    # el archivo original ya convertido. Se marca primero para que el trigger
    # de borrado no elimine el documento ni la miniatura recién creados.
    if destino_nombre != nombre:
        metadata = dict(blob.metadata or {})
        metadata[MARCA_REEMPLAZO] = destino_nombre
        blob.metadata = metadata
        blob.patch()
        blob.delete()


@storage_fn.on_object_deleted(bucket=BUCKET)
def on_object_deleted(event) -> None:
    """FR-16: al borrar una imagen se borran su documento y su miniatura."""
    datos = event.data
    nombre: str = datos.name

    # Las miniaturas no tienen documento propio; borrarlas no hace nada.
    if nombre.startswith(PREFIJO_MINIATURA):
        logger.info("Miniatura eliminada, se ignora: %s", nombre)
        return

    # El pipeline marca el temporal antes de borrarlo: no es una baja real.
    if MARCA_REEMPLAZO in (datos.metadata or {}):
        logger.info("Borrado interno del pipeline, se ignora: %s", nombre)
        return

    db = firestore.Client()
    referencia = db.collection(COLECCION_FOTOS).document(doc_id(nombre))
    referencia.delete()

    bucket = gcs.Client().bucket(datos.bucket)
    miniatura = bucket.blob(ruta_miniatura(nombre))
    if miniatura.exists():
        miniatura.delete()
    logger.info("Documento y miniatura eliminados para %s", nombre)
