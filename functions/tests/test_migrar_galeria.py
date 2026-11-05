"""Pruebas de ``migrar_galeria.py`` (spec 007 — T001).

La migración alimenta la colección ``fotos`` con las imágenes existentes:

* agrega el token de descarga si falta (aditivo, sin re-subir el original);
* crea la miniatura WebP 300×225 si falta (misma función que el pipeline);
* hace upsert **sin pisar** documentos existentes;
* es idempotente y jamás borra ni modifica los originales.

Los fakes de ``fakes.py`` espejan la API real de Storage y Firestore; ningún
test toca la red ni usa credenciales reales.
"""
from __future__ import annotations

import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
from PIL import Image

import migrar_galeria
from fakes import Blob, Bucket, Client, DB


def _jpeg(ancho: int = 800, alto: int = 600, color=(10, 100, 200)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (ancho, alto), color).save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def _conectar(monkeypatch, bucket: Bucket, db: DB | None = None) -> DB:
    db = db if db is not None else DB()
    monkeypatch.setattr(migrar_galeria.gcs, "Client", lambda: Client(bucket))
    monkeypatch.setattr(migrar_galeria.firestore, "Client", lambda: db)
    return db


@pytest.mark.parametrize(
    ("ruta", "esperado"),
    [
        ("migradas/foto.jpg", True),
        ("migradas/foto.jpeg", True),
        ("migradas/foto.png", True),
        ("migradas/foto.webp", True),
        ("migradas/foto.heic", True),
        ("migradas/foto.HEIC", True),  # las extensiones no distinguen mayúsculas
        ("migradas/notas.txt", False),
        ("migradas/datos.pdf", False),
        ("migradas/sin_extension", False),
    ],
)
def test_es_imagen(ruta, esperado):
    """Solo los objetos con extensión de imagen entran a la migración."""
    assert migrar_galeria.es_imagen(ruta) is esperado


def test_imagenes_del_bucket_excluye_thumbs_y_no_imagenes():
    """FR-4: el listado excluye el subárbol thumbs/ y lo que no es imagen."""
    nombres = [
        "migradas/a.jpg",
        "thumbs/migradas/a.jpg",
        "notas.txt",
        "migradas/b.png",
    ]
    assert migrar_galeria.imagenes_del_bucket(nombres) == [
        "migradas/a.jpg",
        "migradas/b.png",
    ]


def test_sin_credenciales_no_conecta_y_sale_distinto_de_cero(monkeypatch, capsys):
    """Credenciales SOLO por entorno o --credentials: sin ellas no se crea
    ningún cliente y el proceso sale con código distinto de cero."""
    monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)

    def _no_conectar():
        raise AssertionError("no debe crearse un cliente sin credenciales")

    monkeypatch.setattr(migrar_galeria.gcs, "Client", _no_conectar)
    monkeypatch.setattr(migrar_galeria.firestore, "Client", _no_conectar)

    codigo = migrar_galeria.main([])

    assert codigo != 0
    salida = capsys.readouterr()
    assert "GOOGLE_APPLICATION_CREDENTIALS" in salida.err
    assert "--credentials" in salida.err


def test_argumento_credentials_define_el_entorno(monkeypatch, capsys):
    """--credentials se aplica al proceso (sin rutas hardcodeadas)."""
    monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)
    bucket = Bucket()
    _conectar(monkeypatch, bucket)

    codigo = migrar_galeria.main(["--credentials", "credenciales/prueba.json"])

    assert codigo == 0
    assert os.environ["GOOGLE_APPLICATION_CREDENTIALS"] == "credenciales/prueba.json"
    assert "creadas: 0" in capsys.readouterr().out


def test_migra_crea_documento_miniatura_y_token(monkeypatch, capsys):
    """Escenario completo: token aditivo, miniatura WebP y documento con el
    esquema de FR-1/FR-15, sin tocar el original."""
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "credenciales-de-prueba.json")
    creado = datetime(2026, 11, 4, 18, 0, tzinfo=timezone.utc)
    datos = _jpeg()
    original = Blob("migradas/foto.jpg", data=datos, time_created=creado)
    bucket = Bucket({"migradas/foto.jpg": original})
    db = _conectar(monkeypatch, bucket)

    codigo = migrar_galeria.main([])

    assert codigo == 0
    # Token agregado al original de forma aditiva, sin re-subir bytes.
    token = original.metadata["firebaseStorageDownloadTokens"]
    assert uuid.UUID(token).version == 4
    assert original.patch_llamado == 1
    assert original.upload is None, "el original no debe re-subirse"
    assert original._data == datos
    assert original.deleted is False

    # Miniatura WebP 300×225 en thumbs/{ruta sin extensión}.webp.
    ruta_thumb = "thumbs/migradas/foto.webp"
    assert ruta_thumb in bucket.blobs
    miniatura = bucket.blobs[ruta_thumb]
    datos_thumb, mime = miniatura.upload
    assert mime == "image/webp"
    with Image.open(io.BytesIO(datos_thumb)) as resultado:
        assert resultado.format == "WEBP"
        assert resultado.size == (300, 225)
    assert set(miniatura.metadata_subida) == {
        "pipeline",
        "firebaseStorageDownloadTokens",
        "cacheControl",
    }
    token_thumb = miniatura.metadata_subida["firebaseStorageDownloadTokens"]
    assert uuid.UUID(token_thumb).version == 4

    # Documento determinista con todos los campos del contrato.
    documento = db.collection("fotos").documentos["migradas__foto.jpg"]
    assert documento["codigo"] == "foto"
    assert documento["codigoBusqueda"] == "foto"
    assert documento["nombre"] == "foto.jpg"
    assert documento["carpeta"] == "migradas"
    assert documento["vista"] == "frente"
    assert documento["origen"] == "corel"
    assert documento["basadaEn"] is None
    assert documento["estado"] == "aprobada"
    assert documento["creadoEn"] == creado
    assert documento["url"] == (
        "https://firebasestorage.googleapis.com/v0/b/"
        "migrador-drive-storage.firebasestorage.app/o/"
        f"migradas%2Ffoto.jpg?alt=media&token={token}"
    )
    assert documento["thumbUrl"] == (
        "https://firebasestorage.googleapis.com/v0/b/"
        "migrador-drive-storage.firebasestorage.app/o/"
        f"thumbs%2Fmigradas%2Ffoto.webp?alt=media&token={token_thumb}"
    )

    resumen = capsys.readouterr().out
    assert "creadas: 1" in resumen
    assert "omitidas: 0" in resumen
    assert "errores: 0" in resumen


def test_migracion_es_idempotente(monkeypatch, capsys):
    """Re-correr la migración no duplica documentos, tokens ni miniaturas."""
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "credenciales-de-prueba.json")
    original = Blob("migradas/foto.jpg", data=_jpeg())
    bucket = Bucket({"migradas/foto.jpg": original})
    db = _conectar(monkeypatch, bucket)

    assert migrar_galeria.main([]) == 0
    documento = dict(db.collection("fotos").documentos["migradas__foto.jpg"])
    miniatura = bucket.blobs["thumbs/migradas/foto.webp"]
    upload_thumb = miniatura.upload
    capsys.readouterr()

    assert migrar_galeria.main([]) == 0

    assert db.collection("fotos").documentos["migradas__foto.jpg"] == documento
    assert bucket.blobs["thumbs/migradas/foto.webp"].upload == upload_thumb
    assert original.patch_llamado == 1, "el token no debe re-agregarse"
    resumen = capsys.readouterr().out
    assert "creadas: 0" in resumen
    assert "omitidas: 1" in resumen
    assert "errores: 0" in resumen


def test_migracion_no_pisa_un_documento_existente(monkeypatch, capsys):
    """FR-15: si el documento ya existe, se conserva tal cual."""
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "credenciales-de-prueba.json")
    original = Blob("migradas/foto.jpg", data=_jpeg())
    bucket = Bucket({"migradas/foto.jpg": original})
    db = _conectar(monkeypatch, bucket)
    existente = {"codigo": "OTRO", "origen": "ia", "estado": "para_revisar"}
    db.collection("fotos").document("migradas__foto.jpg").set(existente)

    assert migrar_galeria.main([]) == 0

    assert db.collection("fotos").documentos["migradas__foto.jpg"] == existente
    assert "creadas: 0" in capsys.readouterr().out


def test_migracion_crea_miniatura_faltante_aunque_exista_el_documento(
    monkeypatch, capsys
):
    """La miniatura faltante se genera igual; el documento no se reescribe."""
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "credenciales-de-prueba.json")
    original = Blob("migradas/foto.jpg", data=_jpeg())
    bucket = Bucket({"migradas/foto.jpg": original})
    db = _conectar(monkeypatch, bucket)
    existente = {"codigo": "foto"}
    db.collection("fotos").document("migradas__foto.jpg").set(existente)

    assert migrar_galeria.main([]) == 0

    assert "thumbs/migradas/foto.webp" in bucket.blobs
    assert db.collection("fotos").documentos["migradas__foto.jpg"] == existente
    resumen = capsys.readouterr().out
    assert "creadas: 0" in resumen
    assert "omitidas: 1" in resumen


def test_error_en_una_imagen_no_detiene_el_resto_y_sale_distinto_de_cero(
    monkeypatch, capsys
):
    """Los errores duros (imagen ilegible) se reportan, no frenan el lote
    y hacen salir con código distinto de cero."""
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "credenciales-de-prueba.json")
    rota = Blob("migradas/rota.jpg", data=b"esto no es una imagen")
    buena = Blob("migradas/buena.jpg", data=_jpeg())
    bucket = Bucket({"migradas/rota.jpg": rota, "migradas/buena.jpg": buena})
    db = _conectar(monkeypatch, bucket)

    codigo = migrar_galeria.main([])

    assert codigo != 0, "errores duros deben salir con código distinto de cero"
    assert "migradas__buena.jpg" in db.collection("fotos").documentos
    assert "thumbs/migradas/buena.webp" in bucket.blobs
    assert rota.upload is None and rota.deleted is False, (
        "el original con error tampoco se toca"
    )

    salida = capsys.readouterr()
    assert "creadas: 1" in salida.out
    assert "errores: 1" in salida.out
    assert "migradas/rota.jpg" in salida.err


def test_falla_al_listar_el_bucket_sale_distinto_de_cero(monkeypatch, capsys):
    """Sin acceso al bucket no hay resumen: error y código distinto de cero."""
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "credenciales-de-prueba.json")
    bucket = Bucket()

    def _list_falla():
        raise RuntimeError("sin acceso al bucket")

    bucket.list_blobs = _list_falla
    _conectar(monkeypatch, bucket)

    codigo = migrar_galeria.main([])

    assert codigo != 0
    assert "listar" in capsys.readouterr().err


def test_no_hardcodea_rutas_de_credenciales():
    """Contrato: prohibido hardcodear rutas de credenciales en el script."""
    codigo = Path(migrar_galeria.__file__).read_text(encoding="utf-8")
    for patron in ("C:\\", "/home/", "/Users/", "~/"):
        assert patron not in codigo, f"ruta absoluta hardcodeada en el script: {patron}"
