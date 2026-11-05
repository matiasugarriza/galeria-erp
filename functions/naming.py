"""Nombres de archivo y documentos de Firestore (spec 006 + spec 007).

* Nombres en el bucket: ``{carpeta}/{código}[_N].webp`` (la spec 007 cambia
  la salida principal de JPEG a WebP).
* Identidad de la colección ``fotos``: el ``docId`` es determinista,
  ``carpeta + '__' + nombre`` con las barras reemplazadas por ``__``.
* El código de artículo se deriva del nombre del archivo (sin extensión y
  sin sufijo de variante) y se normaliza para la búsqueda con el mismo
  criterio NFKD de la spec 003.

La spec 007 también agrega el subárbol de primer nivel ``thumbs/`` donde
viven las miniaturas WebP: al estar separadas no aparecen en los listados
de la galería y el pipeline las ignora (anti-loop).
"""
from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone
from urllib.parse import quote

from pipeline import EXT_SALIDA

SIN_CODIGO = "sin_codigo"

# FR-1 (spec 007): colección raíz de la galería.
COLECCION_FOTOS = "fotos"

# FR-4 (spec 007): prefijo y extensión de las miniaturas.
PREFIJO_MINIATURA = "thumbs/"
EXT_MINIATURA = ".webp"

# Sufijo de variante generado por ``calcular_destino`` (``_2``, ``_3``…).
# También cubre los nombres históricos con guion (``-87``). El grupo no
# admite ceros a la izquierda para no comerse códigos de artículo como
# ``CH-001``; la variante 1 nunca lleva sufijo (FR-19/FR-20).
_SUFIJO_VARIANTE = re.compile(r"[-_]([1-9]\d*)$")


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


def separar_ruta(ruta: str) -> tuple[str, str]:
    """Separa ``carpeta/nombre``; sin barra la carpeta es vacía."""
    if "/" in ruta:
        carpeta, nombre = ruta.rsplit("/", 1)
        return carpeta, nombre
    return "", ruta


def sin_extension(ruta: str) -> str:
    """Quita sólo la extensión del nombre, conservando la carpeta."""
    carpeta, nombre = separar_ruta(ruta)
    punto = nombre.rfind(".")
    if punto > 0:  # un punto inicial no cuenta como extensión
        nombre = nombre[:punto]
    return f"{carpeta}/{nombre}" if carpeta else nombre


def ruta_miniatura(ruta: str) -> str:
    """FR-4 (spec 007): ``thumbs/`` + ruta destino sin extensión + ``.webp``.

    Idempotente: una ruta ya perteneciente al subárbol ``thumbs/`` no se
    prefija dos veces (y su extensión se normaliza a WebP).
    """
    if ruta.startswith(PREFIJO_MINIATURA):
        ruta = ruta[len(PREFIJO_MINIATURA) :]
    return f"{PREFIJO_MINIATURA}{sin_extension(ruta)}{EXT_MINIATURA}"


def calcular_destino(
    carpeta: str, nombre_original: str, existentes: set[str]
) -> str:
    """FR-19/FR-20: primera variante libre ``{carpeta}/{base}[_N].webp``.

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


# ---------------------------------------------------------------------------
# Documentos de Firestore (spec 007, FR-1/FR-15)
# ---------------------------------------------------------------------------


def codigo_desde_nombre(nombre: str) -> str:
    """FR-1: código de artículo sin extensión ni sufijo de variante.

    ``CH-001_2.jpg`` → ``CH-001``; ``01000001-87.jpg`` → ``01000001``.
    Los códigos con guion y ceros a la izquierda (``CH-001``) se conservan:
    el sufijo de variante nunca empieza con cero.
    """
    base = sin_extension(nombre)
    coincidencia = _SUFIJO_VARIANTE.search(base)
    if coincidencia is not None and int(coincidencia.group(1)) >= 2:
        return base[: coincidencia.start()]
    return base


def normalizar_busqueda(texto: str) -> str:
    """FR-3: NFKD, sin diacríticos, minúsculas y trim (spec 003)."""
    descompuesto = unicodedata.normalize("NFKD", texto)
    sin_marcas = "".join(
        caracter for caracter in descompuesto if not unicodedata.combining(caracter)
    )
    return sin_marcas.strip().lower()


def doc_id(ruta: str) -> str:
    """FR-1: ``docId`` determinista con las barras convertidas en ``__``.

    ``migradas/CH-001.webp`` → ``migradas__CH-001.webp``.
    """
    return ruta.replace("/", "__")


def url_descarga(bucket: str, ruta: str, token: str) -> str:
    """FR-6: URL de descarga de Firebase Storage con la ruta codificada."""
    return (
        f"https://firebasestorage.googleapis.com/v0/b/{bucket}/o/"
        f"{quote(ruta, safe='')}?alt=media&token={token}"
    )


def timestamp_creado(valor) -> datetime:
    """Normaliza el ``timeCreated`` del objeto a un datetime UTC válido."""
    if valor is None:
        return datetime.now(timezone.utc)
    if isinstance(valor, str):
        texto = valor.replace("Z", "+00:00")
        return datetime.fromisoformat(texto)
    if isinstance(valor, datetime):
        if valor.tzinfo is None:
            return valor.replace(tzinfo=timezone.utc)
        return valor
    raise TypeError(f"timeCreated no soportado: {type(valor)!r}")


def documento_foto(
    ruta_destino: str,
    *,
    url: str,
    thumb_url: str,
    creado_en,
    vista: str = "frente",
    origen: str = "corel",
    basada_en: str | None = None,
    estado: str = "aprobada",
) -> dict:
    """FR-1/FR-15: documento ``fotos/{docId}`` con el esquema preparado para IA."""
    carpeta, nombre = separar_ruta(ruta_destino)
    codigo = codigo_desde_nombre(nombre)
    return {
        "codigo": codigo,
        "codigoBusqueda": normalizar_busqueda(codigo),
        "nombre": nombre,
        "carpeta": carpeta,
        # Ruta completa en Storage: el cliente la usa para borrar el objeto.
        "fullPath": ruta_destino,
        "url": url,
        "thumbUrl": thumb_url,
        "vista": vista,
        "origen": origen,
        "basadaEn": basada_en,
        "estado": estado,
        "creadoEn": timestamp_creado(creado_en),
    }
