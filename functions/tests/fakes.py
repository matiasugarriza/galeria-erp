"""Fakes en memoria que espejan la API REAL de Google Cloud.

Los usan los tests del backend para no tocar red ni credenciales:

* ``Blob`` reproduce el comportamiento de google-cloud-storage 3.x: un objeto
  creado con ``bucket.blob()`` es LOCAL y trae ``metadata`` en ``None`` hasta
  que se le asigna; los metadatos (y el ``cache_control``) se congelan AL
  MOMENTO de ``upload_from_string`` — asignarlos después nunca llega al
  bucket. ``get_blob`` devuelve el objeto ya cargado o ``None``.
* ``DB`` reproduce lo mínimo de google-cloud-firestore que usa la unidad:
  ``collection().document().create()`` (falla con ``AlreadyExists`` si el
  documento ya existe), ``get()`` (``exists``) y ``delete()``.
"""
from __future__ import annotations

from datetime import datetime, timezone

from google.api_core.exceptions import AlreadyExists


class Blob:
    def __init__(
        self,
        name: str,
        data: bytes = b"",
        metadata: dict[str, str] | None = None,
        loaded: bool = True,
        bucket: "Bucket | None" = None,
        time_created: datetime | None = None,
        cache_control: str | None = None,
    ) -> None:
        self.name = name
        self._data = data
        self.upload = None
        self.metadata_subida = None  # metadatos congelados al subir (API real)
        self.cache_control_subida = None
        self.deleted = False
        self.patch_llamado = 0
        self._bucket = bucket
        self.time_created = time_created
        self.cache_control = cache_control
        # API real: un objeto local (bucket.blob()) trae metadata en None
        # hasta reload; get_blob() lo devuelve ya cargado.
        if not loaded:
            self.metadata = None
        elif metadata is not None:
            self.metadata = dict(metadata)
        else:
            self.metadata = {}

    @property
    def size(self) -> int:
        return len(self._data)

    def download_as_bytes(self) -> bytes:
        # API real: la descarga va por nombre y funciona desde cualquier
        # objeto con nombre, cargado o local.
        if self._bucket is not None:
            almacenado = self._bucket.blobs.get(self.name)
            if almacenado is not None:
                return almacenado._data
        return self._data

    def upload_from_string(self, data, content_type=None) -> None:
        # Firma real: sin kwarg de metadatos (se setea blob.metadata antes).
        # La API real congela los metadatos AL MOMENTO de subir: lo que se
        # asigne después nunca llega al bucket.
        self.upload = (data, content_type)
        self.metadata_subida = dict(self.metadata) if self.metadata else None
        self.cache_control_subida = self.cache_control
        self._data = data
        if self._bucket is not None:
            # API real: el upload crea/materializa el objeto en el bucket.
            self._bucket.blobs[self.name] = self

    def patch(self) -> None:
        # API real: patch actualiza las propiedades del objeto existente.
        self.patch_llamado += 1
        if self._bucket is not None:
            self._bucket.blobs[self.name] = self

    def exists(self) -> bool:
        if self._bucket is None:
            return False
        return self.name in self._bucket.blobs

    def delete(self) -> None:
        self.deleted = True
        if self._bucket is not None:
            self._bucket.blobs.pop(self.name, None)


class Bucket:
    def __init__(self, blobs=None) -> None:
        self.blobs: dict[str, Blob] = dict(blobs or {})
        for almacenado in self.blobs.values():
            almacenado._bucket = self

    def blob(self, name: str) -> Blob:
        # API real: objeto LOCAL nuevo, sin propiedades cargadas; no existe
        # en el bucket hasta que se sube.
        return Blob(name, loaded=False, bucket=self)

    def get_blob(self, name: str):
        # API real: devuelve el objeto ya cargado o None si no existe.
        return self.blobs.get(name)

    def list_blobs(self):
        return list(self.blobs.values())


class Client:
    def __init__(self, bucket: Bucket) -> None:
        self._bucket = bucket

    def bucket(self, name: str) -> Bucket:
        return self._bucket


class Snapshot:
    def __init__(self, doc_id: str, data: dict | None) -> None:
        self.id = doc_id
        self._data = data

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> dict | None:
        return None if self._data is None else dict(self._data)


class Document:
    def __init__(self, coleccion: "Collection", doc_id: str) -> None:
        self.coleccion = coleccion
        self.doc_id = doc_id

    def create(self, data: dict) -> None:
        # API real: create es atómico y falla si el documento ya existe.
        if self.doc_id in self.coleccion.documentos:
            raise AlreadyExists(f"Documento ya existe: {self.doc_id}")
        self.coleccion.documentos[self.doc_id] = dict(data)

    def set(self, data: dict, merge: bool = False) -> None:
        if merge and self.doc_id in self.coleccion.documentos:
            self.coleccion.documentos[self.doc_id].update(data)
        else:
            self.coleccion.documentos[self.doc_id] = dict(data)

    def get(self) -> Snapshot:
        return Snapshot(self.doc_id, self.coleccion.documentos.get(self.doc_id))

    def delete(self) -> None:
        self.coleccion.documentos.pop(self.doc_id, None)


class Collection:
    def __init__(self) -> None:
        self.documentos: dict[str, dict] = {}

    def document(self, doc_id: str) -> Document:
        return Document(self, doc_id)


class DB:
    def __init__(self) -> None:
        self.colecciones: dict[str, Collection] = {}

    def collection(self, nombre: str) -> Collection:
        return self.colecciones.setdefault(nombre, Collection())


def ahora() -> datetime:
    return datetime.now(timezone.utc)
