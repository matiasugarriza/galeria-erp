"""Compatibilidad del backfill JPEG (borrador) con ``migrar_galeria``.

La implementación parcial de miniaturas JPEG 400×300 fue reemplazada por la
migración definitiva de la spec 007: ``migrar_galeria.py`` genera WebP 300 y
escribe los documentos de Firestore. ``backfill_thumbs.py`` queda como shim
para no romper invocaciones viejas y delega en el script nuevo.
"""
from __future__ import annotations

import backfill_thumbs
import migrar_galeria


def test_backfill_delega_en_la_migracion():
    """El script viejo no conserva la lógica JPEG: delega en la migración."""
    assert backfill_thumbs.main is migrar_galeria.main
