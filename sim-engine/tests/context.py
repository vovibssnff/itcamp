"""Общие фикстуры тестов sim-worker."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from sim_engine.bootstrap import build_application
from sim_engine.config import Settings, reset_settings


def make_app() -> "object":
    reset_settings()
    settings = Settings(data_dir=str(ROOT / "data"))
    return build_application(settings)


def make_engine():
    return make_app().engine
