"""Compatibilidad del backfill de miniaturas JPEG (borrador de la spec 007).

La implementación parcial de miniaturas JPEG 400×300 fue reemplazada por la
migración definitiva: ``migrar_galeria.py`` genera miniaturas WebP 300×225 y
escribe los documentos de la colección ``fotos``.

Este módulo queda como shim para no romper invocaciones viejas y delega toda
la lógica en la migración nueva.

Uso::

    python functions/backfill_thumbs.py --credentials credenciales/servicio.json
"""
from __future__ import annotations

from migrar_galeria import main

if __name__ == "__main__":
    raise SystemExit(main())
