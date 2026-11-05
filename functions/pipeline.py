"""Pipeline de formato de imágenes (spec 006 + spec 007).

Ejecuta el orden exacto de FR-7 sobre bytes de entrada y devuelve bytes WebP
(FR-14 de la spec 007):
1. Orientación EXIF + borrado de EXIF
2. Conversión a sRGB (ICC embebido si lo hay, intento perceptual)
3. Recorte automático al contenido
4. Escala (sin agrandar)
5. Lienzo 4:3 con padding (blanco, o transparente si el origen tiene alfa)
6. WebP calidad 85 (preserva el canal alfa de los PNG)

Todo el proceso corre en RAM (`io.BytesIO`): nunca escribe en disco.

La spec 007 (FR-4) agrega `generar_miniatura`, que parte de la salida final
ya en memoria para producir la miniatura WebP 300×225 (q80) del subárbol
``thumbs/``, y los helpers de metadata/URL descargable (FR-6).

Los helpers JPEG de ``ajustar_calidad`` se conservan de la spec 006 como
utilidad aislada (con sus pruebas), pero la salida del pipeline ya no los usa.
"""
from __future__ import annotations

import io
import logging
import os
import uuid

from PIL import Image, ImageChops, ImageOps

try:  # FR-6: HEIC/HEIF nativo cuando pillow-heif está instalado
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

# --- Constantes de la spec (tabla "Constantes de Referencia") ---
CANVAS_W = 2400
CANVAS_H = 1800
# FR-14 (spec 007): la salida principal es WebP para todas las imágenes.
EXT_SALIDA = ".webp"
MIME_SALIDA = "image/webp"
CALIDAD_WEBP = 85
WHITE_BG = (255, 255, 255)
TRANSPARENTE = (0, 0, 0, 0)
CROP_MARGIN_PX = 100
CROP_TOLERANCE = 18
CROP_MIN_GAIN = 0.02
CALIDAD_INICIAL = 90
CALIDAD_MINIMA = 60
PASO_CALIDAD = 5
PESO_MAX_KB = 300
# Miniaturas (spec 007, FR-4): WebP 300×225 calidad 80.
MINIATURA_ANCHO = 300
MINIATURA_ALTO = 225
MINIATURA_CALIDAD = 80
# FR-6 (spec 007): cache de un año para principal y miniatura.
CACHE_CONTROL = "public, max-age=31536000"
USAR_REMBG = os.environ.get("USAR_REMBG", "false").strip().lower() == "true"

logger = logging.getLogger(__name__)


def ya_procesado(metadata: dict[str, str] | None) -> bool:
    """FR-25: protección anti-reprocesamiento (customMetadata.pipeline=done)."""
    return bool(metadata) and metadata.get("pipeline") == "done"


# ---------------------------------------------------------------------------
# 2. Conversión a sRGB
# ---------------------------------------------------------------------------


def _tiene_alfa(imagen: Image.Image) -> bool:
    """FR-14: detecta transparencia real (RGBA/LA o clave de transparencia)."""
    return imagen.mode in ("RGBA", "LA") or "transparency" in imagen.info


def _a_srgb(
    imagen: Image.Image, perfil_icc: bytes | None, conservar_alfa: bool = False
) -> Image.Image:
    """FR-2: sRGB respetando el ICC embebido si lo hay (intent perceptual).

    Con ``conservar_alfa`` la salida es RGBA (PNG de Corel con transparencia).
    """
    modo = "RGBA" if conservar_alfa else "RGB"
    if perfil_icc:
        try:
            from PIL import ImageCms

            origen = ImageCms.ImageCmsProfile(io.BytesIO(perfil_icc))
            destino = ImageCms.createProfile("sRGB")
            convertida = ImageCms.profileToProfile(
                imagen,
                origen,
                destino,
                outputMode=modo,
                renderingIntent=ImageCms.Intent.PERCEPTUAL,
            )
            if convertida is not None:
                return convertida
        except Exception as excepcion:  # noqa: BLE001 - caída a conversión simple
            logger.warning(
                "Perfil ICC ilegible (%s); se convierte a %s simple",
                excepcion,
                modo,
            )
    return imagen.convert(modo)


# ---------------------------------------------------------------------------
# 3. Recorte automático (FR-8 a FR-11)
# ---------------------------------------------------------------------------


def _fondo_perimetral(imagen: Image.Image) -> tuple[int, int, int]:
    """FR-9: mediana de una franja perimetral del 2% del lado más corto."""
    ancho, alto = imagen.size
    borde = max(1, int(min(ancho, alto) * 0.02))
    tiras = [
        imagen.crop((0, 0, ancho, borde)),
        imagen.crop((0, alto - borde, ancho, alto)),
        imagen.crop((0, 0, borde, alto)),
        imagen.crop((ancho - borde, 0, ancho, alto)),
    ]
    crudos = b"".join(tira.tobytes() for tira in tiras)  # triples RGB
    tripletes = list(_triples(crudos))
    total = len(tripletes)

    def mediana(canal: int) -> int:
        valores = sorted(triple[canal] for triple in tripletes)
        mitad = total // 2
        if total % 2:
            return valores[mitad]
        return (valores[mitad - 1] + valores[mitad]) // 2

    return (mediana(0), mediana(1), mediana(2))


def _triples(crudos: bytes):
    for posicion in range(0, len(crudos), 3):
        yield (crudos[posicion], crudos[posicion + 1], crudos[posicion + 2])


def _bbox_rembg(imagen: Image.Image) -> tuple[int, int, int, int] | None:
    """FR-11: detección con IA (`rembg`), dependencia opcional."""
    from rembg import remove  # import tardío: sólo con USAR_REMBG=true

    recortada = remove(imagen)
    return recortada.getchannel("A").getbbox()


def _bbox_alfa(imagen: Image.Image) -> tuple[int, int, int, int] | None:
    """FR-14: para PNG con transparencia, el contenido es el alfa no nulo."""
    alfa = imagen.getchannel("A")
    mascara = alfa.point(lambda valor: 255 if valor > 0 else 0)
    bbox = mascara.getbbox()
    if bbox is None:
        return None
    return _ganancia_suficiente(bbox, imagen.size)


def _ganancia_suficiente(
    bbox: tuple[int, int, int, int], size: tuple[int, int]
) -> tuple[int, int, int, int] | None:
    """FR-10: sin recorte si el bbox cubre ≥ 98% del área total."""
    x0, y0, x1, y1 = bbox
    ancho, alto = size
    if (x1 - x0) * (y1 - y0) >= (1 - CROP_MIN_GAIN) * ancho * alto:
        return None
    return bbox


def detectar_bbox(imagen: Image.Image) -> tuple[int, int, int, int] | None:
    """FR-9/FR-10/FR-11: bbox de contenido; None si no hay recorte útil."""
    if USAR_REMBG:
        try:
            bbox = _bbox_rembg(imagen)
            if bbox is not None:
                return _ganancia_suficiente(bbox, imagen.size)
        except Exception as excepcion:  # noqa: BLE001 - caída a color de fondo
            logger.warning(
                "rembg no disponible o falló (%s); se usa color de fondo", excepcion
            )

    if imagen.mode == "RGBA":
        bbox_alfa = _bbox_alfa(imagen)
        if bbox_alfa is not None:
            return bbox_alfa
        # Alfa totalmente opaco (o cubriendo todo): se recorta por color.
        imagen = imagen.convert("RGB")

    fondo = _fondo_perimetral(imagen)
    diferencia = ImageChops.difference(imagen, Image.new("RGB", imagen.size, fondo))
    rojo, verde, azul = diferencia.split()
    mascara = ImageChops.lighter(ImageChops.lighter(rojo, verde), azul).point(
        lambda valor: 255 if valor > CROP_TOLERANCE else 0
    )
    bbox = mascara.getbbox()
    if bbox is None:
        return None
    return _ganancia_suficiente(bbox, imagen.size)


def _recortar(imagen: Image.Image, bbox: tuple[int, int, int, int]) -> Image.Image:
    """FR-8: margen de aire de 100 px alrededor del contenido detectado."""
    x0, y0, x1, y1 = bbox
    ancho, alto = imagen.size
    return imagen.crop(
        (
            max(0, x0 - CROP_MARGIN_PX),
            max(0, y0 - CROP_MARGIN_PX),
            min(ancho, x1 + CROP_MARGIN_PX),
            min(alto, y1 + CROP_MARGIN_PX),
        )
    )


# ---------------------------------------------------------------------------
# 4 y 5. Escala y lienzo 4:3 (FR-12 a FR-15)
# ---------------------------------------------------------------------------


def _escalar(imagen: Image.Image) -> Image.Image:
    """FR-12/FR-13: nunca agranda; LANCZOS; respeta la proporción."""
    ancho, alto = imagen.size
    escala = min(1.0, CANVAS_W / ancho, CANVAS_H / alto)
    if escala >= 1.0:
        return imagen
    nuevo = (max(1, round(ancho * escala)), max(1, round(alto * escala)))
    return imagen.resize(nuevo, Image.Resampling.LANCZOS)


def _lienzo_43(
    imagen: Image.Image, conservar_alfa: bool = False
) -> Image.Image:
    """FR-14/FR-15: lienzo 4:3 adaptativo clampeado al tope, centrado.

    Con ``conservar_alfa`` el relleno es transparente (PNG de Corel) en lugar
    de blanco (FR-14 de la spec 007).
    """
    ancho, alto = imagen.size
    if ancho / alto >= 4 / 3:
        canvas_ancho, canvas_alto = ancho, round(ancho * 3 / 4)
    else:
        canvas_alto, canvas_ancho = alto, round(alto * 4 / 3)
    canvas_ancho = max(ancho, min(CANVAS_W, canvas_ancho))
    canvas_alto = max(alto, min(CANVAS_H, canvas_alto))

    modo = "RGBA" if conservar_alfa else "RGB"
    fondo = TRANSPARENTE if conservar_alfa else WHITE_BG
    lienzo = Image.new(modo, (canvas_ancho, canvas_alto), fondo)
    lienzo.paste(
        imagen, ((canvas_ancho - ancho) // 2, (canvas_alto - alto) // 2)
    )
    return lienzo


# ---------------------------------------------------------------------------
# 6. Guardado: WebP de salida y helper JPEG legado (FR-16 a FR-18)
# ---------------------------------------------------------------------------


def _perfil_srgb() -> bytes:
    from PIL import ImageCms

    return ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


def _guardar_jpeg(imagen: Image.Image, calidad: int) -> bytes:
    """FR-3/FR-4 (spec 006): JPEG progresivo con perfil sRGB embebido.

    Utilidad aislada que se conserva con sus pruebas; la salida del pipeline
    de la spec 007 usa ``_guardar_webp``.
    """
    buffer = io.BytesIO()
    imagen.save(
        buffer,
        format="JPEG",
        quality=calidad,
        progressive=True,
        optimize=True,
        icc_profile=_perfil_srgb(),
    )
    return buffer.getvalue()


def _guardar_webp(imagen: Image.Image, calidad: int) -> bytes:
    """FR-14 (spec 007): WebP con perfil sRGB; conserva RGBA si lo recibe."""
    buffer = io.BytesIO()
    opciones: dict = {"format": "WEBP", "quality": calidad, "method": 6}
    if imagen.mode in ("RGB", "RGBA"):
        opciones["icc_profile"] = _perfil_srgb()
    imagen.save(buffer, **opciones)
    return buffer.getvalue()


def ajustar_calidad(imagen: Image.Image) -> tuple[bytes, int, bool]:
    """FR-16/FR-17: q90 baja de a 5 hasta un mínimo de 60 sólo si excede el
    techo de 300 KB; si con q60 no entra se sube igual y se avisa por log.

    Retorna (bytes, calidad_usada, excede_el_techo).
    """
    calidad = CALIDAD_INICIAL
    while True:
        datos = _guardar_jpeg(imagen, calidad)
        if len(datos) <= PESO_MAX_KB * 1024:
            return datos, calidad, False
        if calidad <= CALIDAD_MINIMA:
            logger.warning(
                "Imagen %dx%d supera el techo de %d KB incluso con q%d; "
                "se sube igual (FR-17)",
                imagen.width,
                imagen.height,
                PESO_MAX_KB,
                calidad,
            )
            return datos, calidad, True
        calidad -= PASO_CALIDAD


# ---------------------------------------------------------------------------
# Orden completo del pipeline (FR-7)
# ---------------------------------------------------------------------------


def procesar_imagen(data: bytes) -> bytes:
    """Ejecuta el pipeline completo (FR-7) en RAM y devuelve WebP (FR-14)."""
    with Image.open(io.BytesIO(data)) as original:
        perfil_icc = original.info.get("icc_profile")
        conservar_alfa = _tiene_alfa(original)
        base = original.copy()

    imagen = ImageOps.exif_transpose(base)  # 1. orientación + EXIF descartado
    imagen = _a_srgb(imagen, perfil_icc, conservar_alfa)  # 2. sRGB

    bbox = detectar_bbox(imagen)  # 3. recorte al contenido
    if bbox is not None:
        imagen = _recortar(imagen, bbox)

    imagen = _escalar(imagen)  # 4. escala sin agrandar
    imagen = _lienzo_43(imagen, conservar_alfa)  # 5. lienzo 4:3

    return _guardar_webp(imagen, CALIDAD_WEBP)  # 6. WebP calidad 85


# ---------------------------------------------------------------------------
# Miniaturas (spec 007, FR-4) y metadata descargable (FR-6)
# ---------------------------------------------------------------------------


def nuevo_token() -> str:
    """FR-6: token de descarga (uuid4) para ``firebaseStorageDownloadTokens``."""
    return str(uuid.uuid4())


def metadata_objeto(token: str) -> dict[str, str]:
    """FR-6: metadata de la imagen principal y de la miniatura.

    ``pipeline=done`` cierra el anti-loop (FR-25), el token permite armar la
    URL de descarga y ``cacheControl`` fija la caché de un año. Además del
    custom metadata, el uploader asigna ``blob.cache_control`` (la propiedad
    real de GCS) con el mismo valor.
    """
    return {
        "pipeline": "done",
        "firebaseStorageDownloadTokens": token,
        "cacheControl": CACHE_CONTROL,
    }


def metadata_miniatura() -> dict[str, str]:
    """Compatibilidad: metadata de miniatura con un token nuevo."""
    return metadata_objeto(nuevo_token())


def generar_miniatura(datos: bytes) -> bytes:
    """FR-4 (spec 007): miniatura WebP de 300×225 exactos a calidad 80.

    Parte de los bytes finales ya presentes en memoria (la salida del
    pipeline es lienzo 4:3, así que basta un resize): no se vuelve a
    descargar el objeto del bucket. Conserva el alfa de los PNG.
    """
    with Image.open(io.BytesIO(datos)) as original:
        conservar_alfa = _tiene_alfa(original)
        lienzo = original.convert("RGBA" if conservar_alfa else "RGB")

    miniatura = lienzo.resize(
        (MINIATURA_ANCHO, MINIATURA_ALTO), Image.Resampling.LANCZOS
    )
    return _guardar_webp(miniatura, MINIATURA_CALIDAD)
