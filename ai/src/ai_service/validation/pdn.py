"""Контроль отсутствия персональных данных в промптах и ответах (FR-AI-07)."""
from __future__ import annotations

import re

#: Поля, которые запрещено передавать в ИИ-сервис.
FORBIDDEN_FIELDS = frozenset(
    {"full_name", "fio", "фио", "login", "email", "phone", "user_name", "snils"}
)

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+7|8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)")
#: ФИО вида «Иванов И.И.» или «Иванов Иван Иванович».
_FIO_RE = re.compile(
    r"\b[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]*\.?\s?[А-ЯЁ][а-яё]*\.?\b(?=\s|$|[,.;])"
)


class PdnViolation(ValueError):
    """В данных обнаружены персональные данные."""


def find_pdn(text: str) -> list[str]:
    """Возвращает найденные ПДн-паттерны."""
    found: list[str] = []
    found += _EMAIL_RE.findall(text or "")
    found += _PHONE_RE.findall(text or "")
    return found


def assert_no_pdn_fields(payload: dict) -> None:
    """Проверяет структуру запроса на наличие запрещённых полей."""
    def walk(node: object, path: str = "") -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if str(key).lower() in FORBIDDEN_FIELDS:
                    raise PdnViolation(f"Запрещённое поле с ПДн: {path}{key}")
                walk(value, f"{path}{key}.")
        elif isinstance(node, list):
            for item in node:
                walk(item, path)

    walk(payload)


def scrub(text: str) -> str:
    """Удаляет ПДн из текста перед логированием и сохранением в AIInsight."""
    text = _EMAIL_RE.sub("[email]", text or "")
    text = _PHONE_RE.sub("[phone]", text)
    return text
