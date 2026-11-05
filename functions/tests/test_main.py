"""Tests del handler ``main.procesar_subida`` y del trigger de borrado.

Cubren el pegamento del pipeline con Storage y Firestore de la spec 007:

1. Discovery de ``firebase deploy``: solo se despliegan funciones con
   ``__firebase_endpoint__`` (decorador de ``firebase_functions``).
2. Procesamiento: salida WebP, miniatura WebP 300×225, tokens descargables,
   ``cacheControl`` y documento en ``fotos`` con el esquema de FR-1/FR-15.
3. Anti-loop doble: metadata ``pipeline=done`` y subárbol ``thumbs/``.
4. Borrado coherente (FR-16): el trigger elimina documento y miniatura, pero
   ignora las miniaturas y el borrado que hace el propio pipeline.

Los fakes de ``fakes.py`` espejan la API REAL de google-cloud-storage 3.x y
google-cloud-firestore: ``bucket.blob()`` devuelve un objeto local con
``metadata`` en ``None`` hasta asignarla, ``upload_from_string`` materializa y
congela metadatos, y ``DocumentReference.create`` falla con ``AlreadyExists``.
Ningún test toca la red ni usa credenciales.
"""
from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone

from cloudevents.http import CloudEvent
from PIL import Image

import main  # conftest.py agrega functions/ al sys.path
from fakes import Blob, Bucket, Client, DB


def _png(ancho: int = 400, alto: int = 300) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (ancho, alto), (255, 255, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


def _evento(
    nombre: str,
    bucket: str = "migrador-drive-storage.firebasestorage.app",
    metadata: dict[str, str] | None = None,
    tipo: str = "google.cloud.storage.object.v1.finalized",
) -> CloudEvent:
    """CloudEvent raw al estilo google.cloud.storage.object.v1.*."""
    data: dict = {
        "bucket": bucket,
        "name": nombre,
        "generation": "1234567890",
        "id": f"{bucket}/{nombre}/1234567890",
        "metageneration": "1",
        "size": "1024",
        "storageClass": "STANDARD",
        "contentType": "image/png",
    }
    if metadata is not None:
        data["metadata"] = metadata
    return CloudEvent(
        {
            "specversion": "1.0",
            "id": "event-1",
            "source": f"//storage.googleapis.com/projects/_/buckets/{bucket}",
            "type": tipo,
            "time": "2026-11-04T12:00:00.123456Z",
            "subject": f"objects/{nombre}",
        },
        data=data,
    )


def _evento_borrado(nombre: str, metadata: dict[str, str] | None = None):
    return _evento(
        nombre,
        metadata=metadata,
        tipo="google.cloud.storage.object.v1.deleted",
    )


def _conectar(monkeypatch, bucket: Bucket, db: DB | None = None):
    """Inyecta los clientes de Storage y Firestore sin tocar credenciales."""
    db = db if db is not None else DB()
    monkeypatch.setattr(main.gcs, "Client", lambda: Client(bucket))
    monkeypatch.setattr(main.firestore, "Client", lambda: db)
    return db


def _no_debe_tocar_gcs():
    raise AssertionError("el handler debió omitir antes de tocar GCS")


def _no_debe_tocar_firestore():
    raise AssertionError("el handler debió omitir antes de tocar Firestore")


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


def test_procesar_subida_es_descubrible_por_el_sdk_de_firebase():
    """Regla T010: firebase deploy solo despliega funciones con endpoint."""
    endpoint = getattr(main.procesar_subida, "__firebase_endpoint__", None)
    assert endpoint is not None, (
        "procesar_subida no tiene __firebase_endpoint__: "
        "el discovery de firebase deploy no la encontraría"
    )
    assert endpoint.entryPoint == "procesar_subida"


def test_on_object_deleted_es_descubrible_por_el_sdk_de_firebase():
    """FR-16: el trigger de borrado también debe ser descubierto al deployar."""
    endpoint = getattr(main.on_object_deleted, "__firebase_endpoint__", None)
    assert endpoint is not None, (
        "on_object_deleted no tiene __firebase_endpoint__: "
        "el discovery de firebase deploy no la encontraría"
    )
    assert endpoint.entryPoint == "on_object_deleted"


# ---------------------------------------------------------------------------
# Procesamiento y documento
# ---------------------------------------------------------------------------


def test_handler_procesa_la_subida_sube_webp_y_escribe_el_documento(monkeypatch):
    creado = datetime(2026, 11, 5, 9, 30, tzinfo=timezone.utc)
    origen = Blob("migradas/foto.png", data=_png(), time_created=creado)
    bucket = Bucket({"migradas/foto.png": origen})
    db = _conectar(monkeypatch, bucket)

    main.procesar_subida(_evento("migradas/foto.png"))

    # Salida principal: WebP con token, cacheControl y marcador anti-loop.
    destino = bucket.blobs["migradas/foto.webp"]
    assert destino.upload is not None, "la salida no fue subida al bucket"
    datos, mime = destino.upload
    assert datos[:4] == b"RIFF" and datos[8:12] == b"WEBP", "la salida no es WebP"
    assert mime == "image/webp"
    assert set(destino.metadata_subida) == {
        "pipeline",
        "firebaseStorageDownloadTokens",
        "cacheControl",
    }
    assert destino.metadata_subida["pipeline"] == "done"
    assert destino.metadata_subida["cacheControl"] == "public, max-age=31536000"
    token = destino.metadata_subida["firebaseStorageDownloadTokens"]
    assert uuid.UUID(token).version == 4
    assert destino.cache_control_subida == "public, max-age=31536000"

    # Documento determinista en la colección raíz ``fotos``.
    documentos = db.collection("fotos").documentos
    assert set(documentos) == {"migradas__foto.webp"}
    documento = documentos["migradas__foto.webp"]
    assert documento["codigo"] == "foto"
    assert documento["codigoBusqueda"] == "foto"
    assert documento["nombre"] == "foto.webp"
    assert documento["carpeta"] == "migradas"
    assert documento["vista"] == "frente"
    assert documento["origen"] == "corel"
    assert documento["basadaEn"] is None
    assert documento["estado"] == "aprobada"
    assert documento["creadoEn"] == creado
    assert documento["url"] == (
        "https://firebasestorage.googleapis.com/v0/b/"
        "migrador-drive-storage.firebasestorage.app/o/"
        f"migradas%2Ffoto.webp?alt=media&token={token}"
    )

    # El original convertido se retiró y el documento no se vio afectado.
    assert origen.deleted is True, "el original convertido debió retirarse"


def test_handler_omite_salida_marcada_en_el_evento(monkeypatch):
    monkeypatch.setattr(main.gcs, "Client", _no_debe_tocar_gcs)
    monkeypatch.setattr(main.firestore, "Client", _no_debe_tocar_firestore)

    main.procesar_subida(
        _evento("migradas/foto.webp", metadata={"pipeline": "done"})
    )


def test_handler_omite_salida_marcada_en_el_blob(monkeypatch):
    marcado = Blob(
        "migradas/foto.webp", data=b"x", metadata={"pipeline": "done"}
    )
    bucket = Bucket({"migradas/foto.webp": marcado})
    _conectar(monkeypatch, bucket)

    def _no_debe_procesar(_datos: bytes) -> bytes:
        raise AssertionError("una salida marcada no debe reprocesarse")

    monkeypatch.setattr(main, "procesar_imagen", _no_debe_procesar)
    monkeypatch.setattr(main.firestore, "Client", _no_debe_tocar_firestore)

    main.procesar_subida(_evento("migradas/foto.webp"))

    assert marcado.upload is None, "una salida marcada no debe reprocesarse"
    assert marcado.deleted is False


def test_handler_genera_la_miniatura_webp_en_thumbs(monkeypatch):
    """FR-4/FR-9: la miniatura se sube en thumbs/{destino sin ext}.webp,
    WebP 300×225, desde los bytes en memoria (sin re-descargar)."""
    origen = Blob("migradas/foto.png", data=_png())
    bucket = Bucket({"migradas/foto.png": origen})
    _conectar(monkeypatch, bucket)

    descargas: list[str] = []
    descarga_original = origen.download_as_bytes

    def _contando_descargas() -> bytes:
        descargas.append(origen.name)
        return descarga_original()

    origen.download_as_bytes = _contando_descargas

    main.procesar_subida(_evento("migradas/foto.png"))

    ruta_thumb = "thumbs/migradas/foto.webp"
    assert ruta_thumb in bucket.blobs, (
        "la miniatura no fue subida en thumbs/migradas/foto.webp"
    )
    miniatura = bucket.blobs[ruta_thumb]
    assert miniatura.upload is not None, "la miniatura no fue subida"
    datos, mime = miniatura.upload
    assert mime == "image/webp"
    with Image.open(io.BytesIO(datos)) as resultado:
        assert resultado.format == "WEBP"
        assert resultado.size == (300, 225), "la miniatura debe ser 300x225"

    # Metadata congelada ANTES de subir (la API real la exige así).
    assert set(miniatura.metadata_subida) == {
        "pipeline",
        "firebaseStorageDownloadTokens",
        "cacheControl",
    }
    assert miniatura.metadata_subida["pipeline"] == "done"
    assert miniatura.metadata_subida["cacheControl"] == "public, max-age=31536000"
    token = uuid.UUID(
        miniatura.metadata_subida["firebaseStorageDownloadTokens"]
    )
    assert token.version == 4
    assert miniatura.cache_control_subida == "public, max-age=31536000"

    # La miniatura sale de los bytes en memoria: una sola descarga (origen).
    assert descargas == ["migradas/foto.png"], (
        "no debe volver a descargarse ningún objeto para la miniatura"
    )


def test_documento_usa_el_token_de_la_miniatura(monkeypatch):
    origen = Blob("migradas/foto.png", data=_png())
    bucket = Bucket({"migradas/foto.png": origen})
    db = _conectar(monkeypatch, bucket)

    main.procesar_subida(_evento("migradas/foto.png"))

    documento = db.collection("fotos").documentos["migradas__foto.webp"]
    token_thumb = bucket.blobs["thumbs/migradas/foto.webp"].metadata_subida[
        "firebaseStorageDownloadTokens"
    ]
    assert documento["thumbUrl"] == (
        "https://firebasestorage.googleapis.com/v0/b/"
        "migrador-drive-storage.firebasestorage.app/o/"
        f"thumbs%2Fmigradas%2Ffoto.webp?alt=media&token={token_thumb}"
    )


def test_handler_no_pisa_un_documento_existente(monkeypatch):
    """FR-15: una versión nueva nunca pisa una foto existente."""
    origen = Blob("migradas/foto.png", data=_png())
    bucket = Bucket({"migradas/foto.png": origen})
    db = _conectar(monkeypatch, bucket)
    existente = {"codigo": "ORIGINAL", "origen": "corel"}
    db.collection("fotos").document("migradas__foto.webp").set(existente)

    main.procesar_subida(_evento("migradas/foto.png"))

    assert db.collection("fotos").documentos["migradas__foto.webp"] == existente
    assert origen.deleted is True


def test_handler_marca_el_origen_antes_de_borrarlo(monkeypatch):
    """FR-16: el borrado que hace el propio pipeline queda marcado para que
    el trigger no elimine documentos ni la miniatura recién creada."""
    origen = Blob("migradas/foto.png", data=_png())
    bucket = Bucket({"migradas/foto.png": origen})
    _conectar(monkeypatch, bucket)

    main.procesar_subida(_evento("migradas/foto.png"))

    assert origen.deleted is True
    assert origen.patch_llamado == 1, "el borrado propio debe marcarse con patch"
    assert origen.metadata[main.MARCA_REEMPLAZO] == "migradas/foto.webp"


# ---------------------------------------------------------------------------
# Anti-loop por subárbol thumbs/
# ---------------------------------------------------------------------------


def test_handler_omite_objetos_del_subarbol_thumbs(monkeypatch):
    """Anti-loop doble (a): un nombre bajo ``thumbs/`` jamás entra al
    pipeline, ni siquiera antes de tocar GCS."""
    monkeypatch.setattr(main.gcs, "Client", _no_debe_tocar_gcs)
    monkeypatch.setattr(main.firestore, "Client", _no_debe_tocar_firestore)

    main.procesar_subida(_evento("thumbs/migradas/foto.webp"))


# ---------------------------------------------------------------------------
# Trigger de borrado (FR-16)
# ---------------------------------------------------------------------------


def test_on_object_deleted_borra_documento_y_miniatura(monkeypatch):
    final = Blob("migradas/foto.webp", data=b"webp")
    thumb = Blob("thumbs/migradas/foto.webp", data=b"thumb")
    bucket = Bucket(
        {
            "migradas/foto.webp": final,
            "thumbs/migradas/foto.webp": thumb,
        }
    )
    db = _conectar(monkeypatch, bucket)
    db.collection("fotos").document("migradas__foto.webp").set(
        {"codigo": "foto"}
    )

    main.on_object_deleted(_evento_borrado("migradas/foto.webp"))

    assert db.collection("fotos").documentos == {}, "falta borrar el documento"
    assert "thumbs/migradas/foto.webp" not in bucket.blobs, (
        "falta borrar la miniatura"
    )


def test_on_object_deleted_ignora_objetos_bajo_thumbs(monkeypatch):
    """Borrar una miniatura no hace nada (FR-16)."""
    monkeypatch.setattr(main.gcs, "Client", _no_debe_tocar_gcs)
    monkeypatch.setattr(main.firestore, "Client", _no_debe_tocar_firestore)

    main.on_object_deleted(_evento_borrado("thumbs/migradas/foto.webp"))


def test_on_object_deleted_ignora_el_borrado_del_pipeline(monkeypatch):
    """El pipeline marca el origen antes de borrarlo: el trigger no debe
    tocar el documento ni la miniatura de la imagen final."""
    monkeypatch.setattr(main.gcs, "Client", _no_debe_tocar_gcs)
    monkeypatch.setattr(main.firestore, "Client", _no_debe_tocar_firestore)

    main.on_object_deleted(
        _evento_borrado(
            "migradas/foto.png",
            metadata={main.MARCA_REEMPLAZO: "migradas/foto.webp"},
        )
    )


def test_on_object_deleted_borra_la_miniatura_aunque_falte_el_documento(
    monkeypatch,
):
    """El contrato borra la miniatura para cualquier objeto fuera de thumbs/;
    el borrado interno del pipeline se distingue por la marca, no por el doc."""
    thumb = Blob("thumbs/migradas/foto.webp", data=b"thumb")
    bucket = Bucket({"thumbs/migradas/foto.webp": thumb})
    _conectar(monkeypatch, bucket)

    main.on_object_deleted(_evento_borrado("migradas/foto.png"))

    assert "thumbs/migradas/foto.webp" not in bucket.blobs
