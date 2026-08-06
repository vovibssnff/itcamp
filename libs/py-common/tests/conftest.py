"""Гарантирует, что py_common и ktk_contracts импортируются из корня пакета
без обязательной editable-установки (удобно для CI и локального прогона)."""
import sys
from pathlib import Path

PKG_ROOT = Path(__file__).resolve().parents[1]
if str(PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(PKG_ROOT))
