"""Pruebas del pipeline de formato (spec 006, T009): invariantes en RAM."""
import io
import logging
import uuid

from PIL import Image

import pipeline


def _png(imagen: Image.Image) -> bytes:
    buffer = io.BytesIO()
    imagen.save(buffer, format="PNG")
    return buffer.getvalue()


def _cerca(pixel, esperado, tolerancia=8) -> bool:
    return all(abs(a - b) <= tolerancia for a, b in zip(pixel, esperado))


def test_salida_webp_rgb_srgb_sin_exif_y_orientada():
    """FR-14 (spec 007): WebP/RGB/sRGB, EXIF corregido y descartado."""
    entrada = Image.new("RGB", (400, 300), (255, 255, 255))
    entrada.paste((220, 30, 30), (0, 0, 40, 40))
    exif = Image.Exif()
    exif[0x0112] = 6  # orientación 6 → exif_transpose rota 90° CW
    buffer = io.BytesIO()
    entrada.save(buffer, format="JPEG", quality=95, exif=exif.tobytes())

    salida = pipeline.procesar_imagen(buffer.getvalue())

    assert salida[:4] == b"RIFF"  # contenedor RIFF
    assert salida[8:12] == b"WEBP"  # marca WebP
    with Image.open(io.BytesIO(salida)) as resultado:
        assert resultado.format == "WEBP"  # FR-14
        assert resultado.mode == "RGB"  # FR-2 (spec 006)
        assert resultado.info.get("icc_profile")  # FR-4: perfil sRGB embebido
        assert len(resultado.getexif()) == 0  # FR-5: sin metadatos
        # La orientación 6 colocó el cuadro rojo a la derecha (si no se
        # corrigiera quedaría a la izquierda del recorte).
        fila = [x for x in range(resultado.width)
                if (lambda p: p[0] > 180 and p[1] < 80 and p[2] < 80)(
                    resultado.getpixel((x, 10)))]
        assert fila, "debería haber píxeles rojos en la fila 10"
        assert min(fila) > resultado.width // 2


def test_rgba_conserva_la_transparencia():
    """FR-14 (spec 007): un PNG con alfa sigue siendo RGBA y el relleno del
    lienzo 4:3 es transparente, no blanco."""
    entrada = Image.new("RGBA", (60, 40), (10, 120, 200, 128))
    salida = pipeline.procesar_imagen(_png(entrada))
    with Image.open(io.BytesIO(salida)) as resultado:
        assert resultado.format == "WEBP"
        assert resultado.mode == "RGBA"
        # Relleno del lienzo 4:3 (60×45) completamente transparente.
        assert resultado.getpixel((0, 0))[3] == 0
        centro = resultado.getpixel((30, 20))
        assert centro[3] == 128
        assert _cerca(centro[:3], (10, 120, 200), 10)


def test_procesar_imagen_usa_calidad_webp_85(monkeypatch):
    """FR-14 (spec 007): la salida principal se guarda en WebP calidad 85."""
    capturado: dict = {}

    def _guardar_falso(imagen, calidad):
        capturado["calidad"] = calidad
        return b"webp"

    monkeypatch.setattr(pipeline, "_guardar_webp", _guardar_falso)

    pipeline.procesar_imagen(_png(Image.new("RGB", (80, 60), (10, 20, 30))))

    assert capturado["calidad"] == 85
    assert pipeline.CALIDAD_WEBP == 85


def test_no_agrandar_foto_chica():
    """Invariante: nunca agranda por encima de la resolución original."""
    entrada = Image.new("RGB", (531, 398), (30, 90, 160))
    salida = pipeline.procesar_imagen(_png(entrada))
    with Image.open(io.BytesIO(salida)) as resultado:
        assert resultado.format == "WEBP"
        assert resultado.size == (531, 398)


def test_lienzo_43_sin_deformar():
    """FR-13/FR-14/FR-15: lienzo 4:3 con padding; el contenido ni se estira
    ni se recorta (conserva exactamente sus píxeles originales)."""
    azul = (20, 40, 200)
    entrada = Image.new("RGB", (1000, 500), azul)
    salida = pipeline.procesar_imagen(_png(entrada))
    with Image.open(io.BytesIO(salida)) as resultado:
        assert resultado.size == (1000, 750)  # 1000×750 es 4:3 exacto
        assert _cerca(resultado.getpixel((500, 10)), (255, 255, 255), 5)
        # Altura del contenido: exactamente 500 filas azules (±2 por ringing).
        filas_azules = sum(
            1
            for y in range(resultado.height)
            if resultado.getpixel((500, y))[2] - resultado.getpixel((500, y))[0] > 50
        )
        assert 498 <= filas_azules <= 502
        # Anchura del contenido: sin estirar (todo el ancho es azul).
        columnas_azules = sum(
            1
            for x in range(resultado.width)
            if resultado.getpixel((x, 400))[2] - resultado.getpixel((x, 400))[0] > 50
        )
        assert columnas_azules >= 995


def test_recorte_previo_a_escala():
    """FR-7: el recorte va ANTES de escalar; el contenido 1500×1125 se
    conserva completo (si la escala corriera primero serían 1200×900)."""
    entrada = Image.new("RGB", (3000, 2000), (255, 255, 255))
    entrada.paste((10, 10, 10), (750, 437, 2250, 1562))  # contenido 1500×1125
    salida = pipeline.procesar_imagen(_png(entrada))
    with Image.open(io.BytesIO(salida)) as resultado:
        oscura = resultado.convert("L").point(lambda v: 255 if v < 128 else 0)
        cantidad = oscura.histogram()[255]
    assert 1_600_000 < cantidad < 1_780_000  # ~1.687.500 esperados


def test_rembg_falla_y_cae_al_color_de_fondo():
    """FR-11: con USAR_REMBG=true pero sin modelo, cae al método por color."""
    def _falla(_imagen):
        raise RuntimeError("modelo no disponible")

    pipeline.USAR_REMBG = True
    pipeline._bbox_rembg_original = getattr(pipeline, "_bbox_rembg", None)
    pipeline._bbox_rembg = _falla
    try:
        entrada = Image.new("RGB", (600, 400), (255, 255, 255))
        entrada.paste((0, 0, 0), (250, 150, 350, 250))  # contenido 100×100
        salida = pipeline.procesar_imagen(_png(entrada))
        with Image.open(io.BytesIO(salida)) as resultado:
            # Recorte 300×300 + lienzo 4:3 → 400×300 (no 600×400).
            assert resultado.size == (400, 300)
    finally:
        pipeline.USAR_REMBG = False
        if pipeline._bbox_rembg_original is not None:
            pipeline._bbox_rembg = pipeline._bbox_rembg_original


def test_calidad_baja_hasta_el_piso_60(monkeypatch, caplog):
    """FR-16/FR-17: q90 baja de a 5 hasta q60 como piso; si aún excede el
    techo se sube igual y se avisa por log (no se descarta)."""
    monkeypatch.setattr(
        pipeline, "_guardar_jpeg", lambda _im, calidad: b"x" * (calidad * 10_000)
    )
    with caplog.at_level(logging.WARNING, logger="pipeline"):
        datos, calidad, excede = pipeline.ajustar_calidad(Image.new("RGB", (10, 10)))
    assert calidad == 60
    assert excede is True
    assert datos  # no se descarta
    assert any("q60" in registro.getMessage() for registro in caplog.records)


def test_calidad_inicial_90_si_entra_en_el_techo(monkeypatch):
    """FR-16: si el archivo ya entra con q90 no se degrada."""
    monkeypatch.setattr(
        pipeline, "_guardar_jpeg", lambda _im, calidad: b"x" * 10_000
    )
    _datos, calidad, excede = pipeline.ajustar_calidad(Image.new("RGB", (10, 10)))
    assert calidad == 90
    assert excede is False


def test_calidad_real_plana_en_q90():
    """Integración real: una imagen plana entra con q90 por debajo del techo."""
    imagen = Image.new("RGB", (800, 600), (120, 60, 200))
    datos, calidad, excede = pipeline.ajustar_calidad(imagen)
    assert calidad == 90
    assert excede is False
    assert len(datos) <= pipeline.PESO_MAX_KB * 1024


def test_proteccion_anti_reprocesamiento():
    """FR-25: sólo customMetadata.pipeline=done bloquea el reproceso."""
    assert pipeline.ya_procesado({"pipeline": "done"}) is True
    assert pipeline.ya_procesado(None) is False
    assert pipeline.ya_procesado({}) is False
    assert pipeline.ya_procesado({"pipeline": "running"}) is False


# ---------------------------------------------------------------------------
# Miniaturas WebP (spec 007, FR-4)
# ---------------------------------------------------------------------------


def _webp(imagen: Image.Image, calidad: int = 85) -> bytes:
    buffer = io.BytesIO()
    imagen.save(buffer, format="WEBP", quality=calidad)
    return buffer.getvalue()


def test_generar_miniatura_es_webp_exactamente_300x225():
    """FR-4 (spec 007): la salida del pipeline (lienzo 4:3) se redimensiona
    a 300×225 exactos en WebP, sin volver a tocar el objeto."""
    fuente = _webp(Image.new("RGB", (2400, 1800), (30, 60, 90)))
    miniatura = pipeline.generar_miniatura(fuente)

    assert miniatura[:4] == b"RIFF"
    assert miniatura[8:12] == b"WEBP"
    with Image.open(io.BytesIO(miniatura)) as resultado:
        assert resultado.format == "WEBP"
        assert resultado.size == (300, 225)
        assert resultado.mode == "RGB"


def test_generar_miniatura_conserva_el_alfa():
    """FR-4/FR-14 (spec 007): la miniatura WebP de un PNG transparente
    conserva el canal alfa."""
    fuente = _webp(Image.new("RGBA", (1200, 900), (255, 0, 0, 0)))
    miniatura = pipeline.generar_miniatura(fuente)

    with Image.open(io.BytesIO(miniatura)) as resultado:
        assert resultado.mode == "RGBA"
        assert resultado.getpixel((0, 0))[3] == 0


def test_generar_miniatura_clampa_a_300x225_si_la_fuente_no_es_43():
    """La migración recorre imágenes existentes: el tamaño de salida es
    exacto 300×225 aunque la fuente no respete el lienzo 4:3."""
    fuente = _webp(Image.new("RGB", (640, 480), (200, 100, 10)))
    with Image.open(io.BytesIO(pipeline.generar_miniatura(fuente))) as resultado:
        assert resultado.size == (300, 225)


def test_generar_miniatura_usa_calidad_80(monkeypatch):
    """FR-4 (spec 007): WebP calidad 80 al guardar la miniatura."""
    capturado: dict = {}

    def _guardar_falso(imagen, calidad):
        capturado["calidad"] = calidad
        buffer = io.BytesIO()
        imagen.save(buffer, format="WEBP", quality=calidad)
        return buffer.getvalue()

    monkeypatch.setattr(pipeline, "_guardar_webp", _guardar_falso)

    pipeline.generar_miniatura(_webp(Image.new("RGB", (800, 600), (10, 100, 200))))

    assert capturado["calidad"] == 80
    assert pipeline.MINIATURA_CALIDAD == 80
    assert (pipeline.MINIATURA_ANCHO, pipeline.MINIATURA_ALTO) == (300, 225)


def test_metadata_objeto_lleva_token_cache_y_marca_anti_loop():
    """FR-6 (spec 007): token uuid4 descargable, cacheControl de un año y
    pipeline=done para cerrar el anti-loop."""
    metadata = pipeline.metadata_objeto("token-fijo")

    assert metadata == {
        "pipeline": "done",
        "firebaseStorageDownloadTokens": "token-fijo",
        "cacheControl": "public, max-age=31536000",
    }
    assert pipeline.CACHE_CONTROL == "public, max-age=31536000"


def test_nuevo_token_es_uuid4_y_cambia_en_cada_llamada():
    """FR-6: cada subida (principal y miniatura) usa su propio token uuid4."""
    primero = pipeline.nuevo_token()
    segundo = pipeline.nuevo_token()

    assert uuid.UUID(primero).version == 4
    assert uuid.UUID(segundo).version == 4
    assert primero != segundo
