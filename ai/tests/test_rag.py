import unittest

import context  # noqa: F401
from ai_service.rag.bm25 import Bm25Index, Chunk, tokenize
from ai_service.rag.chunker import chunk_document, dehyphenate

REG_TEXT = """3.5 Атмосферный блок
Давление в колонне К-1 регистрируется с помощью датчика давления
поз. PRSA 204. При подъеме давления в колонне до 4,5 кгс/см2 срабаты-
вает сигнализация, а до 4,8 кгс/см2 - срабатывает блокировка.

3.6 Блок ГДМ
К-12/4 эксплуатируется при следующих рабочих условиях: давление - от 1,0
до 7,0 кгс/см2, температура - в пределах 180 - 220 градусов.
Подача водорода - не менее 300 кг/ч.
"""


class TestTokenizer(unittest.TestCase):
    def test_equipment_position_is_atomic(self):
        """«К-1» должно давать один осмысленный токен, а не «к» + «1»."""
        tokens = tokenize("Давление в колонне К-1")
        self.assertIn("k1", tokens)
        self.assertNotIn("1", tokens)

    def test_instrument_position_normalized(self):
        self.assertEqual(tokenize("поз. PRSA 204"), tokenize("PRSA-204"))

    def test_word_forms_share_stem(self):
        """Без стемминга запрос не находит текст в другой словоформе."""
        for a, b in [
            ("давление", "давлению"),
            ("блокировка", "блокировки"),
            ("противогаз", "противогазом"),
            ("насоса", "насосов"),
            ("печь", "печей"),
        ]:
            self.assertEqual(tokenize(a), tokenize(b), f"{a} / {b}")

    def test_stopwords_removed(self):
        self.assertEqual(tokenize("и в на что"), [])


class TestChunker(unittest.TestCase):
    def test_dehyphenation(self):
        """Переносы из PDF должны склеиваться, иначе слово не найдётся."""
        self.assertIn("срабатывает", dehyphenate("срабаты-\nвает"))

    def test_sections_detected(self):
        chunks = chunk_document(REG_TEXT, source="reg.txt")
        sections = {c.section for c in chunks}
        self.assertTrue(any("3.5" in s for s in sections))
        self.assertTrue(any("3.6" in s for s in sections))

    def test_page_numbers_are_not_sections(self):
        text = "33\nПостоянство уровня раздела фаз в Е-1 поддерживается регулятором уровня."
        chunks = chunk_document(text * 3, source="reg.txt")
        for c in chunks:
            self.assertFalse(c.section.startswith("33 "), c.section)

    def test_metadata_extracted(self):
        chunks = chunk_document(REG_TEXT, source="reg.txt")
        equipment = {e for c in chunks for e in c.equipment}
        tags = {t for c in chunks for t in c.tags}
        self.assertIn("К-1", equipment)
        self.assertTrue(any("PRSA" in t for t in tags))


class TestSearch(unittest.TestCase):
    def setUp(self):
        self.index = Bm25Index(chunk_document(REG_TEXT, source="reg.txt"))

    def test_finds_by_meaning(self):
        hits = self.index.search("уставка блокировки по давлению К-1", top_k=1)
        self.assertTrue(hits)
        self.assertIn("4,8", hits[0][0].text)

    def test_finds_gdm_conditions(self):
        hits = self.index.search("сколько водорода подавать на реактор К-12/4", top_k=1)
        self.assertTrue(hits)
        self.assertIn("300 кг/ч", hits[0][0].text)

    def test_equipment_filter_excludes_foreign_units(self):
        hits = self.index.search("рабочие условия", equipment_filter={"К-9"}, top_k=5)
        self.assertEqual(hits, [])

    def test_empty_query(self):
        self.assertEqual(self.index.search("   "), [])


if __name__ == "__main__":
    unittest.main()
