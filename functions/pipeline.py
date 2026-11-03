"""Pipeline de formato de imágenes (spec 006, `image-pipeline`).

Ejecuta el orden exacto de FR-7 sobre bytes de entrada y devuelve bytes JPEG:
1. Orientación EXIF + borrado de EXIF
2. Conversión a sRGB (ICC embebido si lo hay, intento perceptual)
3. Recorte automático al contenido
4. Escala (sin agrandar)
5. Lienzo 4:3 con padding blanco
6. JPEG con calidad ajustada al peso

Todo el proceso corre en RAM (`io.BytesIO`): nunca escribe en disco.
"""
from __future__ import annotations

import io
import logging
import os

from PIL import Image, ImageChops, ImageOps

try:  # FR-6: HEIC/HEIF nativo cuando pillow-heif está instalado
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

# --- Constantes de la spec (tabla "Constantes de Referencia") ---
CANVAS_W = 2400
CANVAS_H = 1800
EXT_SALIDA = ".jpg"
MIME_SALIDA = "image/jpeg"
WHITE_BG = (255, 255, 255)
CROP_MARGIN_PX = 100
CROP_TOLERANCE = 18
CROP_MIN_GAIN = 0.02
CALIDAD_INICIAL = 90
CALIDAD_MINIMA = 60
PASO_CALIDAD = 5
PESO_MAX_KB = 300
USAR_REMBG = os.environ.get("USAR_REMBG", "false").strip().lower() == "true"

logger = logging.getLogger(__name__)


def ya_procesado(metadata: dict[str, str] | None) -> bool:
    """FR-25: protección anti-reprocesamiento (customMetadata.pipeline=done)."""
    return bool(metadata) and metadata.get("pipeline") == "done"


# ---------------------------------------------------------------------------
# 2. Conversión a sRGB
# ---------------------------------------------------------------------------


def _a_srgb(imagen: Image.Image, perfil_icc: bytes | None) -> Image.Image:
    """FR-2: RGB respetando el ICC embebido si lo hay (intent perceptual)."""
    if perfil_icc:
        try:
            from PIL import ImageCms

            origen = ImageCms.ImageCmsProfile(io.BytesIO(perfil_icc))
            destino = ImageCms.createProfile("sRGB")
            convertida = ImageCms.profileToProfile(
                imagen,
                origen,
                destino,
                outputMode="RGB",
                renderingIntent=ImageCms.Intent.PERCEPTUAL,
            )
            if convertida is not None:
                return convertida
        except Exception as excepcion:  # noqa: BLE001 - caída a conversión simple
            logger.warning(
                "Perfil ICC ilegible (%s); se convierte a RGB simple", excepcion
            )
    return imagen.convert("RGB")


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


def _lienzo_43(imagen: Image.Image) -> Image.Image:
    """FR-14/FR-15: lienzo 4:3 adaptativo clampeado al tope, centrado."""
    ancho, alto = imagen.size
    if ancho / alto >= 4 / 3:
        canvas_ancho, canvas_alto = ancho, round(ancho * 3 / 4)
    else:
        canvas_alto, canvas_ancho = alto, round(alto * 4 / 3)
    canvas_ancho = max(ancho, min(CANVAS_W, canvas_ancho))
    canvas_alto = max(alto, min(CANVAS_H, canvas_alto))

    lienzo = Image.new("RGB", (canvas_ancho, canvas_alto), WHITE_BG)
    lienzo.paste(
        imagen, ((canvas_ancho - ancho) // 2, (canvas_alto - alto) // 2)
    )
    return lienzo


# ---------------------------------------------------------------------------
# 6. JPEG con calidad ajustada al peso (FR-16 a FR-18)
# ---------------------------------------------------------------------------


def _perfil_srgb() -> bytes:
    from PIL import ImageCms

    return ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


def _guardar_jpeg(imagen: Image.Image, calidad: int) -> bytes:
    """FR-3/FR-4: JPEG progresivo con optimize y perfil sRGB embebido."""
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
    """Ejecuta el pipeline completo (FR-7) en RAM sobre los bytes de entrada."""
    with Image.open(io.BytesIO(data)) as original:
        perfil_icc = original.info.get("icc_profile")
        base = original.copy()

    imagen = ImageOps.exif_transpose(base)  # 1. orientación + EXIF descartado
    imagen = _a_srgb(imagen, perfil_icc)  # 2. sRGB

    bbox = detectar_bbox(imagen)  # 3. recorte al contenido
    if bbox is not None:
        imagen = _recortar(imagen, bbox)

    imagen = _escalar(imagen)  # 4. escala sin agrandar
    imagen = _lienzo_43(imagen)  # 5. lienzo 4:3 en blanco

    datos, _calidad, _excede = ajustar_calidad(imagen)  # 6. JPEG ajustado
    return datos
