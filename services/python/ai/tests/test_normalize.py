import unittest

import context  # noqa: F401

from ai_service.analysis.normalize import normalize_tag, same_target


class TestNormalize(unittest.TestCase):
    def test_regulation_and_srd_notations_match(self):
        """«FRC 408» из регламента и «FRC-408» из SRD — один и тот же тег."""
        self.assertTrue(same_target("FRC 408", "FRC-408"))
        self.assertTrue(same_target("поз. LRCA 641", "LRCA-641"))
        self.assertTrue(same_target("lrcsa 603", "LRCSA-603"))

    def test_cyrillic_homoglyphs(self):
        """Кириллическая «Р» в позиции прибора не должна ломать сравнение."""
        self.assertTrue(same_target("РRC 221", "PRC-221"))

    def test_different_tags_do_not_match(self):
        self.assertFalse(same_target("FRC 408", "FRC 409"))
        self.assertFalse(same_target("LRCA 641", "LRCA 640"))

    def test_empty_is_not_a_match(self):
        self.assertFalse(same_target("", ""))
        self.assertEqual(normalize_tag(None), "")


if __name__ == "__main__":
    unittest.main()
