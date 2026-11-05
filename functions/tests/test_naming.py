"""Pruebas de nombres de archivo y documentos (spec 006 + spec 007)."""
from datetime import datetime, timezone

import pytest

import naming


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        # FR-22: NFKD quita acentos; el case original se conserva (FR-24)
        ("Código", "Codigo"),
        ("CÓDIGO", "CODIGO"),
        ("niño", "nino"),
        # Caracteres problemáticos → "_"; guiones intermedios se conservan
        ("CH-001/A B", "CH-001_A_B"),
        ("FOTO v2.png", "FOTO_v2_png"),
        # Extremos limpiados: ".", "_" y "-" al inicio y al fin
        ("._-abc-._", "abc"),
        # Si no queda nada → sin_codigo
        ("  ...  ", "sin_codigo"),
        ("", "sin_codigo"),
    ],
)
def test_sanitizar(entrada, esperado):
    assert naming.sanitizar(entrada) == esperado


@pytest.mark.parametrize(
    ("carpeta", "nombre", "existentes", "esperado"),
    [
        # FR-19/FR-20: primera variante sin sufijo, después _2, _3…
        ("productos", "foto.png", set(), "productos/foto.webp"),
        (
            "productos",
            "foto.png",
            {"productos/foto.webp"},
            "productos/foto_2.webp",
        ),
        (
            "productos",
            "foto.png",
            {"productos/foto.webp", "productos/foto_2.webp"},
            "productos/foto_3.webp",
        ),
        # FR-24: agrupamiento insensible a mayúsculas, el nombre conserva case
        (
            "productos",
            "foto.png",
            {"productos/Foto.webp"},
            "productos/foto_2.webp",
        ),
        (
            "productos",
            "FOTO.png",
            {"productos/Foto.webp"},
            "productos/FOTO_2.webp",
        ),
        # Sin carpeta en la raíz y sanitizado del nombre original (FR-23)
        ("", "a b.png", set(), "a_b.webp"),
        ("productos", "CH-001/A B.png", set(), "productos/CH-001_A_B.webp"),
    ],
)
def test_calcular_destino(carpeta, nombre, existentes, esperado):
    assert naming.calcular_destino(carpeta, nombre, existentes) == esperado


def test_ruta_miniatura_prefija_thumbs_y_usa_webp():
    """FR-4 (spec 007): ``thumbs/`` + ruta destino sin extensión + ``.webp``."""
    assert (
        naming.ruta_miniatura("migradas/01000001-87.jpg")
        == "thumbs/migradas/01000001-87.webp"
    )
    assert naming.ruta_miniatura("foto.webp") == "thumbs/foto.webp"
    assert naming.ruta_miniatura("foto") == "thumbs/foto.webp"


def test_ruta_miniatura_no_duplica_el_prefijo():
    """Anti-error: una ruta ya miniaturizada no se prefija dos veces."""
    assert (
        naming.ruta_miniatura("thumbs/migradas/foto.webp")
        == "thumbs/migradas/foto.webp"
    )


def test_numeracion_estable_entre_corridas():
    """FR-21 (análogo servidor): el preconteo es sobre TODOS los archivos de la
    carpeta, no sólo sobre los pendientes; un reintento no renumera ni pisa."""
    primera = naming.calcular_destino("productos", "foto.png", set())
    assert primera == "productos/foto.webp"

    # La primera salida ya quedó escrita: la siguiente subida del mismo nombre
    # toma _2 y jamás pisa la primera.
    existentes = {primera}
    segunda = naming.calcular_destino("productos", "foto.png", existentes)
    assert segunda == "productos/foto_2.webp"

    # Recalcular con el preconteo completo es determinista (misma respuesta).
    assert naming.calcular_destino("productos", "foto.png", existentes) == segunda


# ---------------------------------------------------------------------------
# Documentos de Firestore (spec 007, FR-1/FR-15)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("ruta", "esperado"),
    [
        ("migradas/CH-001.jpg", "migradas__CH-001.jpg"),
        ("migradas/CH-001.webp", "migradas__CH-001.webp"),
        ("foto.webp", "foto.webp"),
        ("a/b/c.webp", "a__b__c.webp"),
    ],
)
def test_doc_id_es_determinista_y_reemplaza_barras(ruta, esperado):
    """FR-1: docId = carpeta + '__' + nombre, con '/' → '__'."""
    assert naming.doc_id(ruta) == esperado


@pytest.mark.parametrize(
    ("nombre", "esperado"),
    [
        ("CH-001_2.jpg", "CH-001"),
        ("01000001-87.jpg", "01000001"),
        ("CH-001.webp", "CH-001"),
        ("foto.png", "foto"),
        ("sin_extension", "sin_extension"),
        ("foto_2.webp", "foto"),
        ("borrador.v2.png", "borrador.v2"),
    ],
)
def test_codigo_desde_nombre_quita_extension_y_variante(nombre, esperado):
    """FR-1: código de artículo sin extensión ni sufijo de variante."""
    assert naming.codigo_desde_nombre(nombre) == esperado


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("  PÁSTAÚnica ", "pastaunica"),
        ("ÑANDÚ", "nandu"),
        ("CH-001", "ch-001"),
        ("Código_Ñandú", "codigo_nandu"),
    ],
)
def test_normalizar_busqueda_igual_que_la_spec_003(texto, esperado):
    """FR-1/FR-3: NFKD, sin diacríticos, minúsculas y trim."""
    assert naming.normalizar_busqueda(texto) == esperado


def test_documento_foto_arma_el_payload_con_defaults():
    """FR-1/FR-15: payload completo con los defaults del esquema."""
    creado = datetime(2026, 11, 5, 12, 30, tzinfo=timezone.utc)

    documento = naming.documento_foto(
        "migradas/CH-001.webp",
        url="https://example.test/grande.webp",
        thumb_url="https://example.test/thumb.webp",
        creado_en=creado,
    )

    assert documento == {
        "codigo": "CH-001",
        "codigoBusqueda": "ch-001",
        "nombre": "CH-001.webp",
        "carpeta": "migradas",
        "fullPath": "migradas/CH-001.webp",
        "url": "https://example.test/grande.webp",
        "thumbUrl": "https://example.test/thumb.webp",
        "vista": "frente",
        "origen": "corel",
        "basadaEn": None,
        "estado": "aprobada",
        "creadoEn": creado,
    }


def test_documento_foto_acepta_el_esquema_preparado_para_ia():
    """FR-15: vista, origen, basadaEn y estado son parametrizables."""
    documento = naming.documento_foto(
        "migradas/CH-001_espalda.webp",
        url="u",
        thumb_url="t",
        creado_en=datetime(2026, 11, 5, tzinfo=timezone.utc),
        vista="espalda",
        origen="ia",
        basada_en="migradas__CH-001.webp",
        estado="para_revisar",
    )

    assert documento["vista"] == "espalda"
    assert documento["origen"] == "ia"
    assert documento["basadaEn"] == "migradas__CH-001.webp"
    assert documento["estado"] == "para_revisar"


def test_url_descarga_codifica_la_ruta_y_lleva_token():
    """FR-6: URL del contrato con la ruta codificada como encodeURIComponent."""
    url = naming.url_descarga(
        "migrador-drive-storage.firebasestorage.app",
        "migradas/CH 001.webp",
        "token-123",
    )

    assert (
        url
        == "https://firebasestorage.googleapis.com/v0/b/"
        "migrador-drive-storage.firebasestorage.app/o/"
        "migradas%2FCH%20001.webp?alt=media&token=token-123"
    )
