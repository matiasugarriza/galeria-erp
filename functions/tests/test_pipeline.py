"""Pruebas del pipeline de formato (spec 006, T009): invariantes en RAM."""
import io
import logging

from PIL import Image

import pipeline


def _png(imagen: Image.Image) -> bytes:
    buffer = io.BytesIO()
    imagen.save(buffer, format="PNG")
    return buffer.getvalue()


def _cerca(pixel, esperado, tolerancia=8) -> bool:
    return all(abs(a - b) <= tolerancia for a, b in zip(pixel, esperado))


def test_salida_jpeg_rgb_srgb_progresivo_sin_exif_y_orientada():
    """FR-1 a FR-5: JPEG/RGB/sRGB, progresivo, EXIF corregido y descartado."""
    entrada = Image.new("RGB", (400, 300), (255, 255, 255))
    entrada.paste((220, 30, 30), (0, 0, 40, 40))
    exif = Image.Exif()
    exif[0x0112] = 6  # orientación 6 → exif_transpose rota 90° CW
    buffer = io.BytesIO()
    entrada.save(buffer, format="JPEG", quality=95, exif=exif.tobytes())

    salida = pipeline.procesar_imagen(buffer.getvalue())

    assert salida[:2] == b"\xff\xd8"  # SOI JPEG
    assert b"\xff\xc2" in salida  # SOF2 = JPEG progresivo (FR-3)
    with Image.open(io.BytesIO(salida)) as resultado:
        assert resultado.format == "JPEG"  # FR-1
        assert resultado.mode == "RGB"  # FR-2
        assert resultado.info.get("icc_profile")  # FR-4: perfil sRGB embebido
        assert len(resultado.getexif()) == 0  # FR-5: sin metadatos
        # La orientación 6 colocó el cuadro rojo a la derecha (si no se
        # corrigiera quedaría a la izquierda del recorte).
        fila = [x for x in range(resultado.width)
                if (lambda p: p[0] > 180 and p[1] < 80 and p[2] < 80)(
                    resultado.getpixel((x, 10)))]
        assert fila, "debería haber píxeles rojos en la fila 10"
        assert min(fila) > resultado.width // 2


def test_rgba_se_convierte_a_rgb():
    """FR-2: imágenes RGBA terminan en RGB."""
    entrada = Image.new("RGBA", (60, 40), (10, 120, 200, 128))
    salida = pipeline.procesar_imagen(_png(entrada))
    with Image.open(io.BytesIO(salida)) as resultado:
        assert resultado.mode == "RGB"


def test_no_agrandar_foto_chica():
    """Invariante: nunca agranda por encima de la resolución original."""
    entrada = Image.new("RGB", (531, 398), (30, 90, 160))
    salida = pipeline.procesar_imagen(_png(entrada))
    with Image.open(io.BytesIO(salida)) as resultado:
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
