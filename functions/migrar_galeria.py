"""Migración de las imágenes existentes a la colección ``fotos`` (spec 007).

Para cada objeto-imagen del bucket (excluyendo ``thumbs/``):

1. agrega el token de descarga si falta (operación **aditiva**: no re-sube ni
   modifica los bytes del original);
2. genera y sube la miniatura WebP 300×225 si todavía no existe (la misma
   función que usa el pipeline);
3. crea el documento ``fotos/{docId}`` con el esquema de FR-1/FR-15.

Principios del script:

* **Aditivo:** jamás borra ni pisa imágenes originales.
* **Idempotente:** re-correrlo no duplica tokens, miniaturas ni documentos.
* **No pisa documentos:** si el documento ya existe se conserva tal cual
  (una versión nueva — por ejemplo, generada por IA — nunca reemplaza la
  original, FR-15).
* **Credenciales:** únicamente por la variable de entorno
  ``GOOGLE_APPLICATION_CREDENTIALS`` o el argumento ``--credentials``; el
  script no contiene ninguna ruta hardcodeada.
* **Salida:** imprime un resumen (creadas/omitidas/errores) y termina con
  código distinto de cero si hubo errores duros.

Uso::

    python functions/migrar_galeria.py --credentials credenciales/servicio.json
"""
from __future__ import annotations

import argparse
import os
import sys

from google.api_core.exceptions import AlreadyExists
from google.cloud import firestore
from google.cloud import storage as gcs

from naming import (
    COLECCION_FOTOS,
    PREFIJO_MINIATURA,
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
)

# Debe coincidir con main.BUCKET (evita importar main y su SDK de Firebase).
BUCKET = "migrador-drive-storage.firebasestorage.app"

# Extensiones que el pipeline sabe abrir (Pillow + pillow-heif).
EXTENSIONES_IMAGEN = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
    ".heif",
    ".bmp",
    ".gif",
    ".tif",
    ".tiff",
}


def es_imagen(ruta: str) -> bool:
    """True si el objeto termina en una extensión de imagen soportada."""
    nombre = ruta.rsplit("/", 1)[-1]  # separador de GCS, igual en Windows
    extension = os.path.splitext(nombre)[1]
    return extension.lower() in EXTENSIONES_IMAGEN


def imagenes_del_bucket(nombres) -> list[str]:
    """FR-4: solo objetos-imagen, excluyendo ``thumbs/``, ordenados.

    Las miniaturas no se migran como fotos y los archivos ajenos a las
    imágenes quedan fuera del listado.
    """
    return sorted(
        nombre
        for nombre in nombres
        if not nombre.startswith(PREFIJO_MINIATURA) and es_imagen(nombre)
    )


def token_de_metadata(metadata: dict[str, str] | None) -> str | None:
    """Devuelve el primer token válido de ``firebaseStorageDownloadTokens``."""
    valor = (metadata or {}).get("firebaseStorageDownloadTokens")
    if not valor:
        return None
    primero = valor.split(",")[0].strip()
    return primero or None


def asegurar_token(blob) -> tuple[str, bool]:
    """Agrega un token de descarga si falta; devuelve ``(token, agregado)``."""
    token = token_de_metadata(blob.metadata)
    if token is not None:
        return token, False
    token = nuevo_token()
    metadata = dict(blob.metadata or {})
    metadata["firebaseStorageDownloadTokens"] = token
    blob.metadata = metadata
    # API real: patch actualiza el objeto existente sin re-subir sus bytes.
    blob.patch()
    return token, True


def asegurar_miniatura(
    bucket, nombre: str, datos_original: bytes | None
) -> tuple[str, str, bool]:
    """Crea la miniatura si falta; devuelve ``(ruta, token, creada)``.

    ``datos_original`` se usa sólo cuando hay que generar la miniatura; si ya
    existe no se descarga el original.
    """
    ruta = ruta_miniatura(nombre)
    existente = bucket.get_blob(ruta)
    if existente is not None:
        token, _ = asegurar_token(existente)
        return ruta, token, False

    if datos_original is None:
        raise RuntimeError("faltan los bytes del original para la miniatura")
    token = nuevo_token()
    miniatura = bucket.blob(ruta)
    miniatura.metadata = metadata_objeto(token)
    miniatura.cache_control = CACHE_CONTROL
    miniatura.upload_from_string(
        generar_miniatura(datos_original), content_type=MIME_SALIDA
    )
    return ruta, token, True


def asegurar_documento(
    db,
    bucket_name: str,
    nombre: str,
    token: str,
    ruta_thumb: str,
    token_thumb: str,
    creado_en,
) -> bool:
    """Crea el documento si no existe; ``True`` si lo creó."""
    documento = documento_foto(
        nombre,
        url=url_descarga(bucket_name, nombre, token),
        thumb_url=url_descarga(bucket_name, ruta_thumb, token_thumb),
        creado_en=creado_en,
    )
    referencia = db.collection(COLECCION_FOTOS).document(doc_id(nombre))
    try:
        referencia.create(documento)
    except AlreadyExists:
        return False
    return True


def migrar_imagen(bucket, db, bucket_name: str, nombre: str) -> dict[str, bool]:
    """Migra un objeto y devuelve qué cambios se hicieron (para el resumen)."""
    blob = bucket.get_blob(nombre)
    if blob is None:
        raise RuntimeError("el objeto desapareció antes de migrarlo")

    token, token_agregado = asegurar_token(blob)

    ruta_thumb = ruta_miniatura(nombre)
    hay_thumb = bucket.get_blob(ruta_thumb) is not None
    datos = None if hay_thumb else blob.download_as_bytes()
    ruta_thumb, token_thumb, thumb_creada = asegurar_miniatura(
        bucket, nombre, datos
    )

    documento_creado = asegurar_documento(
        db,
        bucket_name,
        nombre,
        token,
        ruta_thumb,
        token_thumb,
        blob.time_created,
    )
    return {
        "documento_creado": documento_creado,
        "token_agregado": token_agregado,
        "thumb_creada": thumb_creada,
    }


def _parsear(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Migra las imágenes existentes del bucket a la colección fotos de "
            "Firestore: token de descarga, miniatura WebP 300x225 y documento, "
            "sin tocar ni borrar los originales."
        )
    )
    parser.add_argument(
        "--credentials",
        metavar="RUTA",
        help=(
            "ruta del archivo JSON de credenciales; si se omite se usan las de "
            "la variable de entorno GOOGLE_APPLICATION_CREDENTIALS"
        ),
    )
    parser.add_argument(
        "--bucket",
        default=BUCKET,
        help=f"bucket a migrar (por defecto: {BUCKET})",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """CLI de migración; devuelve el código de salida del proceso."""
    args = _parsear(argv)

    # Credenciales SOLO por variable de entorno o --credentials (sin rutas
    # hardcodeadas): sin ninguna de las dos no se crea ningún cliente.
    credenciales = args.credentials or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not credenciales:
        print(
            "Error: sin credenciales de Google Cloud. Definí la variable de "
            "entorno GOOGLE_APPLICATION_CREDENTIALS o pasá --credentials.",
            file=sys.stderr,
        )
        return 2
    if args.credentials:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = args.credentials

    try:
        bucket = gcs.Client().bucket(args.bucket)
        db = firestore.Client()
        nombres = {objeto.name for objeto in bucket.list_blobs()}
    except Exception as excepcion:  # noqa: BLE001 - error duro de arranque
        print(f"Error al listar el bucket: {excepcion}", file=sys.stderr)
        return 1

    imagenes = imagenes_del_bucket(nombres)

    creadas = 0
    omitidas = 0
    miniaturas = 0
    tokens = 0
    errores = 0

    for nombre in imagenes:
        try:
            resultado = migrar_imagen(bucket, db, args.bucket, nombre)
            if resultado["documento_creado"]:
                creadas += 1
                print(f"  + {doc_id(nombre)}")
            else:
                omitidas += 1
            if resultado["thumb_creada"]:
                miniaturas += 1
            if resultado["token_agregado"]:
                tokens += 1
        except Exception as excepcion:  # noqa: BLE001 - un fallo no frena el lote
            errores += 1
            print(f"  ! {nombre}: {excepcion}", file=sys.stderr)

    print(f"Resumen — creadas: {creadas}, omitidas: {omitidas}, errores: {errores}")
    print(f"  miniaturas creadas: {miniaturas}, tokens agregados: {tokens}")
    return 0 if errores == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
