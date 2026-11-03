"""Pruebas de nombres de archivo en el bucket (spec 006, FR-19 a FR-24)."""
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
        ("productos", "foto.png", set(), "productos/foto.jpg"),
        (
            "productos",
            "foto.png",
            {"productos/foto.jpg"},
            "productos/foto_2.jpg",
        ),
        (
            "productos",
            "foto.png",
            {"productos/foto.jpg", "productos/foto_2.jpg"},
            "productos/foto_3.jpg",
        ),
        # FR-24: agrupamiento insensible a mayúsculas, el nombre conserva case
        ("productos", "foto.png", {"productos/Foto.jpg"}, "productos/foto_2.jpg"),
        ("productos", "FOTO.png", {"productos/Foto.jpg"}, "productos/FOTO_2.jpg"),
        # Sin carpeta en la raíz y sanitizado del nombre original (FR-23)
        ("", "a b.png", set(), "a_b.jpg"),
        ("productos", "CH-001/A B.png", set(), "productos/CH-001_A_B.jpg"),
    ],
)
def test_calcular_destino(carpeta, nombre, existentes, esperado):
    assert naming.calcular_destino(carpeta, nombre, existentes) == esperado


def test_numeracion_estable_entre_corridas():
    """FR-21 (análogo servidor): el preconteo es sobre TODOS los archivos de la
    carpeta, no sólo sobre los pendientes; un reintento no renumera ni pisa."""
    primera = naming.calcular_destino("productos", "foto.png", set())
    assert primera == "productos/foto.jpg"

    # La primera salida ya quedó escrita: la siguiente subida del mismo nombre
    # toma _2 y jamás pisa la primera.
    existentes = {primera}
    segunda = naming.calcular_destino("productos", "foto.png", existentes)
    assert segunda == "productos/foto_2.jpg"

    # Recalcular con el preconteo completo es determinista (misma respuesta).
    assert naming.calcular_destino("productos", "foto.png", existentes) == segunda
