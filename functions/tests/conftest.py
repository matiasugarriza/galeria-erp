import sys
from pathlib import Path

# Los tests importan los módulos del backend como paquetes de primer nivel.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
