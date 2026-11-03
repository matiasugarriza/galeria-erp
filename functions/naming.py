"""Nombres de archivo en el bucket (spec 006, FR-19 a FR-24).

Formato: ``{carpeta}/{código}[_N].jpg`` con la extensión siempre ``.jpg``.
"""
from __future__ import annotations

import unicodedata

from pipeline import EXT_SALIDA

SIN_CODIGO = "sin_codigo"


def sanitizar(texto: str) -> str:
    """FR-22: NFKD sin acentos, caracteres problemáticos → ``_``,
    extremos ``.``/``_``/``-`` limpiados y ``sin_codigo`` si queda vacío.

    El case original se conserva (FR-24: el agrupamiento es insensible a
    mayúsculas, pero el nombre no se loweriza).
    """
    descompuesto = unicodedata.normalize("NFKD", texto)
    sin_combinar = "".join(
        caracter for caracter in descompuesto if not unicodedata.combining(caracter)
    )
    salida: list[str] = []
    for caracter in sin_combinar:
        if caracter.isascii() and (caracter.isalnum() or caracter == "-"):
            salida.append(caracter)
        else:
            salida.append("_")
    return "".join(salida).strip("._-") or SIN_CODIGO


def misma_variedad(codigo_a: str, codigo_b: str) -> bool:
    """FR-24: agrupamiento de variantes insensible a mayúsculas."""
    return codigo_a.casefold() == codigo_b.casefold()


def calcular_destino(
    carpeta: str, nombre_original: str, existentes: set[str]
) -> str:
    """FR-19/FR-20: primera variante libre ``{carpeta}/{base}[_N].jpg``.

    ``existentes`` es el preconteo sobre TODOS los objetos de la carpeta
    (análogo servidor de FR-21): un reintento ve los archivos ya escritos y
    no renumera. FR-23: sin código se usa el nombre original sanitizado.
    FR-24: el matching es insensible a mayúsculas pero el nombre emitido
    conserva el case del archivo entrante.
    """
    nombre = nombre_original
    if "." in nombre:
        nombre = nombre[: nombre.rindex(".")]
    base = sanitizar(nombre)

    prefijo = f"{carpeta.rstrip('/')}/" if carpeta.strip("/") else ""
    existentes_cf = {ruta.casefold() for ruta in existentes}

    candidato = f"{prefijo}{base}{EXT_SALIDA}"
    variante = 1
    while candidato.casefold() in existentes_cf:
        variante += 1
        candidato = f"{prefijo}{base}_{variante}{EXT_SALIDA}"
    return candidato
