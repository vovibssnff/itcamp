import unittest

import context  # noqa: F401
from ai_service.validation.tag_guard import TagGuard
from ai_service.validation.explain_format import ExplainFormatError, parse_explain
from ai_service.validation.pdn import PdnViolation, assert_no_pdn_fields, scrub

KNOWN = ["PRSA 204", "FRC 408", "TRC 2", "PRC 221", "LRCA 602"]


class TestTagGuard(unittest.TestCase):
    def test_known_tags_pass(self):
        guard = TagGuard(KNOWN)
        result = guard.check("Давление PRSA 204 выросло из-за снижения FRC-408.")
        self.assertTrue(result.ok)
        self.assertEqual(len(result.known_tags), 2)

    def test_hallucinated_tag_rejects_whole_answer(self):
        """Выдуманная позиция прибора бракует ответ целиком, а не правится."""
        guard = TagGuard(KNOWN)
        result = guard.check("Проверьте регулятор FRC 999 и датчик PRSA 204.")
        self.assertFalse(result.ok)
        self.assertIn("FRC 999", result.unknown_tags)
        self.assertEqual(result.reason, "unknown_tag")

    def test_notation_variants_accepted(self):
        guard = TagGuard(["FRC-408"])
        self.assertTrue(guard.check("расход по FRC 408").ok)
        self.assertTrue(guard.check("расход по FRC-408").ok)

    def test_empty_dictionary_passes_but_reports(self):
        result = TagGuard([]).check("что угодно FRC 999")
        self.assertTrue(result.ok)
        self.assertEqual(result.reason, "tag_dictionary_empty")


class TestExplainFormat(unittest.TestCase):
    VALID = (
        "ПРИЧИНА: Снижен расход орошения FRC 408.\n"
        "СЛЕДСТВИЕ: Выросло давление PRSA 204 до уставки блокировки.\n"
        "РЕКОМЕНДАЦИЯ: Восстановить расход орошения до 42 м3/ч."
    )

    def test_parses_three_blocks(self):
        parsed = parse_explain(self.VALID)
        self.assertIn("FRC 408", parsed.cause)
        self.assertIn("PRSA 204", parsed.effect)
        self.assertTrue(parsed.recommendation)

    def test_rejects_freeform(self):
        with self.assertRaises(ExplainFormatError):
            parse_explain("Кажется, что-то пошло не так с колонной К-1.")

    def test_rejects_empty(self):
        with self.assertRaises(ExplainFormatError):
            parse_explain("")

    def test_rejects_too_long(self):
        long_text = (
            "ПРИЧИНА: " + "слово " * 100
            + "\nСЛЕДСТВИЕ: " + "слово " * 100
            + "\nРЕКОМЕНДАЦИЯ: " + "слово " * 100
        )
        with self.assertRaises(ExplainFormatError):
            parse_explain(long_text)


class TestPdn(unittest.TestCase):
    def test_forbidden_field_rejected(self):
        with self.assertRaises(PdnViolation):
            assert_no_pdn_fields({"session_id": "x", "operator": {"full_name": "Иванов И.И."}})

    def test_pseudo_id_allowed(self):
        assert_no_pdn_fields({"session_id": "x", "operator_pseudo_id": "op-7f3a"})

    def test_scrub_removes_contacts(self):
        cleaned = scrub("Напишите на operator@refinery.ru или +7 999 123-45-67")
        self.assertNotIn("@refinery.ru", cleaned)
        self.assertIn("[email]", cleaned)
        self.assertIn("[phone]", cleaned)


if __name__ == "__main__":
    unittest.main()
