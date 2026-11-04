"""Cloud Function de Firebase (runtime Python) — procesamiento en servidor.

Se dispara con ``onFinalize`` sobre el bucket y aplica el pipeline de la
spec 006 a cada subida nueva del complemento. La protección anti-reprocesamiento
(FR-25) garantiza que la salida marcada con ``customMetadata.pipeline=done``
no vuelve a entrar al pipeline: sin ella, un segundo pasaría el recorte sobre
el lienzo 4:3 ya relleno y deformaría el resultado.
"""
from __future__ import annotations

import logging

from firebase_functions import storage_fn
from google.cloud import storage as gcs

from naming import calcular_destino
from pipeline import MIME_SALIDA, procesar_imagen, ya_procesado

logger = logging.getLogger(__name__)

# StorageOptions exige nombre de bucket explicito durante el discovery:
# FIREBASE_CONFIG no esta garantizado ahi (options.py:902-912).
BUCKET = "migrador-drive-storage.firebasestorage.app"


@storage_fn.on_object_finalized(bucket=BUCKET)
def procesar_subida(event) -> None:
    datos = event.data
    nombre: str = datos.name
    bucket_name: str = datos.bucket

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
        logger.info("El objeto desaparecio antes de procesar: %s", nombre)
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

    destino = bucket.blob(destino_nombre)
    # google-cloud-storage 3.x: los metadatos se setean en el blob ANTES
    # del upload (upload_from_string no acepta kwarg de metadatos).
    destino.metadata = {"pipeline": "done"}
    destino.upload_from_string(salida, content_type=MIME_SALIDA)
    logger.info(
        "Procesado %s → %s (%d bytes)", nombre, destino_nombre, len(salida)
    )

    # Si el destino no es el origen (p. ej. foto.png → foto.jpg), se retira
    # el archivo original ya convertido.
    if destino_nombre != nombre:
        blob.delete()
