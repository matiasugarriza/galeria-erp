"""Tests del handler ``main.procesar_subida`` (spec 006 — T010).

Cubren dos contratos:
1. Discovery de ``firebase deploy``: solo se despliegan funciones con
   ``__firebase_endpoint__`` (decorador de ``firebase_functions``).
2. La lógica de pegamento del handler: anti-reprocesamiento FR-25 (en el
   evento y en el blob) y subida de la salida con ``pipeline=done``.

Los fakes espejan la API REAL de google-cloud-storage 3.x (``Blob.metadata``,
``upload_from_string`` sin kwarg de metadatos, ``Bucket.get_blob``) para que
una API imaginaria falle en estos tests y no en produccion.
"""
from __future__ import annotations

import io

from cloudevents.http import CloudEvent
from PIL import Image

import main  # conftest.py agrega functions/ al sys.path


def _png(ancho: int = 400, alto: int = 300) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (ancho, alto), (255, 255, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


def _evento(
    nombre: str,
    bucket: str = "migrador-drive-storage.firebasestorage.app",
    metadata: dict[str, str] | None = None,
) -> CloudEvent:
    """CloudEvent raw al estilo google.cloud.storage.object.v1.finalized."""
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
            "type": "google.cloud.storage.object.v1.finalized",
            "time": "2026-11-04T12:00:00.123456Z",
            "subject": f"objects/{nombre}",
        },
        data=data,
    )


class _Blob:
    def __init__(self, name: str, data: bytes = b"", metadata=None) -> None:
        self.name = name
        self._data = data
        self.metadata = dict(metadata) if metadata else {}
        self.upload = None
        self.deleted = False

    def download_as_bytes(self) -> bytes:
        return self._data

    def upload_from_string(self, data, content_type=None) -> None:
        # Firma real: sin kwarg de metadatos (se setea blob.metadata antes).
        self.upload = (data, content_type)

    def delete(self) -> None:
        self.deleted = True


class _Bucket:
    def __init__(self, blobs=None) -> None:
        self.blobs = dict(blobs or {})

    def blob(self, name: str) -> _Blob:
        if name not in self.blobs:
            self.blobs[name] = _Blob(name)
        return self.blobs[name]

    def get_blob(self, name: str):
        # API real: devuelve None si el objeto no existe.
        return self.blobs.get(name)

    def list_blobs(self):
        return list(self.blobs.values())


class _Client:
    def __init__(self, bucket: _Bucket) -> None:
        self._bucket = bucket

    def bucket(self, name: str) -> _Bucket:
        return self._bucket


def test_procesar_subida_es_descubrible_por_el_sdk_de_firebase():
    """Regla T010: firebase deploy solo desplega funciones con __firebase_endpoint__."""
    endpoint = getattr(main.procesar_subida, "__firebase_endpoint__", None)
    assert endpoint is not None, (
        "procesar_subida no tiene __firebase_endpoint__: "
        "el discovery de firebase deploy no la encontraria"
    )
    assert endpoint.entryPoint == "procesar_subida"


def test_handler_procesa_la_subida_y_sube_la_salida(monkeypatch):
    origen = _Blob("migradas/foto.png", data=_png())
    bucket = _Bucket({"migradas/foto.png": origen})
    monkeypatch.setattr(main.gcs, "Client", lambda: _Client(bucket))

    main.procesar_subida(_evento("migradas/foto.png"))

    destino_nombre = main.calcular_destino("migradas", "foto.png", set())
    destino = bucket.blobs[destino_nombre]
    assert destino.upload is not None, "la salida no fue subida al bucket"
    datos, mime = destino.upload
    assert datos[:2] == b"\xff\xd8", "la salida no es JPEG"
    assert mime == "image/jpeg"
    assert destino.metadata == {"pipeline": "done"}, "falta el marcador FR-25"
    assert origen.deleted is True, "el original convertido debio retirarse"


def test_handler_omite_salida_marcada_en_el_evento(monkeypatch):
    def _no_debe_tocar_gcs():
        raise AssertionError("el handler debio omitir antes de tocar GCS")

    monkeypatch.setattr(main.gcs, "Client", _no_debe_tocar_gcs)

    main.procesar_subida(_evento("migradas/foto.jpg", metadata={"pipeline": "done"}))


def test_handler_omite_salida_marcada_en_el_blob(monkeypatch):
    marcado = _Blob("migradas/foto.jpg", data=b"x", metadata={"pipeline": "done"})
    bucket = _Bucket({"migradas/foto.jpg": marcado})
    monkeypatch.setattr(main.gcs, "Client", lambda: _Client(bucket))

    main.procesar_subida(_evento("migradas/foto.jpg"))

    assert marcado.upload is None, "una salida marcada no debe reprocesarse"
    assert marcado.deleted is False
