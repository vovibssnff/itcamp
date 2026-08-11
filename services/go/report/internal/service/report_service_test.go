package service

import (
	"bytes"
	"compress/zlib"
	"io"
	"regexp"
	"testing"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/itcamp/ktc/services/report/internal/domain"
)

func TestGeneratePDF_BasicReport(t *testing.T) {
	data := domain.SessionData{
		SessionID:    "sess-test-001",
		Mode:         "training",
		ScenarioName: "Рост давления в К-1",
		ModelTime:    812.5,
		Score:        75,
		Verdict:      "pass",
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF")
	}
	if !bytes.HasPrefix(pdfBytes, []byte("%PDF")) {
		t.Error("expected PDF header")
	}
}

func TestGeneratePDF_WithPenalties(t *testing.T) {
	data := domain.SessionData{
		SessionID: "sess-002",
		Mode:      "exam",
		Score:     55,
		Verdict:   "fail",
		Penalties: []domain.PenaltyData{
			{Code: "LATE_STEP", Description: "шаг 1 просрочен", Points: 10, ModelTime: 150},
			{Code: "MISSED_STEP", Description: "шаг 2 пропущен", Points: 25, ModelTime: 200},
		},
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF")
	}
}

func TestGeneratePDF_WithCriticalErrors(t *testing.T) {
	data := domain.SessionData{
		SessionID: "sess-003",
		Score:     30,
		Verdict:   "fail",
		CriticalErrs: []domain.CriticalData{
			{Code: "esd_without_reason", Description: "необоснованный ESD", ModelTime: 500},
		},
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF")
	}
}

func TestGeneratePDF_WithActions(t *testing.T) {
	data := domain.SessionData{
		SessionID: "sess-004",
		Score:     90,
		Verdict:   "pass",
		Actions: []domain.ActionData{
			{Target: "TRC-3", Action: "decrease", ModelTime: 110},
			{Target: "FRC-408", Action: "increase", ModelTime: 120},
			{Target: "ESD-ATM", Action: "confirm", ModelTime: 200},
		},
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF")
	}
}

func TestGeneratePDF_EmptyData(t *testing.T) {
	data := domain.SessionData{}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF even for empty data")
	}
}

func TestGeneratePDF_AllSections(t *testing.T) {
	data := domain.SessionData{
		SessionID:    "sess-full",
		Mode:         "exam",
		ScenarioName: "Полный сценарий",
		ModelTime:    1000.0,
		Score:        65,
		Verdict:      "fail",
		Penalties: []domain.PenaltyData{
			{Code: "LATE_STEP", Description: "просрочка", Points: 10, ModelTime: 100},
		},
		CriticalErrs: []domain.CriticalData{
			{Code: "wrong_paz_override", Description: "неправильный обход ПАЗ", ModelTime: 300},
		},
		Actions: []domain.ActionData{
			{Target: "TRC-3", Action: "decrease", ModelTime: 50},
		},
		Alarms: []domain.AlarmData{
			{TagID: "PRSA-204", Priority: "H", ModelTime: 80},
		},
		Faults: []domain.FaultData{
			{FaultID: "pressure_rise_K1", ModelTime: 180},
		},
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) < 1000 {
		t.Errorf("expected substantial PDF, got %d bytes", len(pdfBytes))
	}
}

func TestGeneratePDF_Cyrillic(t *testing.T) {
	want := "Рост давления в колонне К-1 до блокировки"
	wantStr := "Штрафы"
	wantFooter := "Сгенерировано"
	data := domain.SessionData{
		SessionID:    "sess-ru",
		ScenarioName: want,
		Mode:         "training",
		Verdict:      "pass",
		Penalties: []domain.PenaltyData{
			{Code: "MISSED_STEP", Description: "шаг пропущен", Points: 10, ModelTime: 1},
		},
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if !bytes.HasPrefix(pdfBytes, []byte("%PDF")) {
		t.Fatal("expected valid PDF header")
	}

	// gofpdf in UTF-8 mode (AddUTF8FontFromBytes) embeds a subset TrueType font
	// and encodes content-stream text as 2-byte CID codes equal to the Unicode
	// code points (big-endian, no BOM), plus a ToUnicode CMap. The old WinAnsi
	// core font (the source of the mojibake) renders Cyrillic as single-byte
	// CP1252 garbage, so asserting on the decoded UTF-16BE text proves the
	// embedded Cyrillic TTF is actually used.
	decoded, err := inflatePDFStreams(pdfBytes)
	if err != nil {
		t.Fatalf("inflate streams: %v", err)
	}
	text, err := extractPDFText(decoded)
	if err != nil {
		t.Fatalf("extract pdf text: %v", err)
	}
	for _, s := range []string{want, wantStr, wantFooter} {
		if !bytes.Contains(text, utf16be(s)) {
			t.Fatalf("PDF content missing cyrillic %q", s)
		}
	}
}

// utf16be возвращает big-endian UTF-16 байты строки s (без BOM), как gofpdf
// кодирует Unicode-кодовые точки (CID) в потоке содержимого.
func utf16be(s string) []byte {
	u := utf16.Encode([]rune(s))
	b := make([]byte, 0, len(u)*2)
	for _, c := range u {
		b = append(b, byte(c>>8), byte(c))
	}
	return b
}

func TestUtf16be(t *testing.T) {
	if !utf8.ValidString("кириллица") {
		t.Fatal("expected valid utf8")
	}
	if !bytes.Equal(utf16be("Р"), []byte{0x04, 0x20}) {
		t.Fatalf("unexpected UTF-16BE for 'Р': % x", utf16be("Р"))
	}
}

// inflatePDFStreams разжимает все FlateDecode-потоки PDF-файла и возвращает
// только поток(и) содержимого (те, что содержат оператор "Tj"), чтобы
// исключить огромные бинарные потоки встроенного шрифта.
func inflatePDFStreams(pdf []byte) ([]byte, error) {
	var out []byte
	re := regexp.MustCompile(`stream\r?\n`)
	idxs := re.FindAllIndex(pdf, -1)
	for _, loc := range idxs {
		start := loc[1]
		end := bytes.Index(pdf[start:], []byte("endstream"))
		if end < 0 {
			continue
		}
		end += start
		data := bytes.TrimSpace(pdf[start:end])
		r, err := zlib.NewReader(bytes.NewReader(data))
		if err != nil {
			continue // не FlateDecode
		}
		dec, err := io.ReadAll(r)
		_ = r.Close()
		if err != nil {
			continue
		}
		if !bytes.Contains(dec, []byte("Tj")) {
			continue
		}
		out = append(out, dec...)
	}
	return out, nil
}

// extractPDFText извлекает текст-литералы "( ... )" из разжатого потока
// содержимого, снимает PDF-экранирование ( \\( , \\) , \\\\ и октальные
// последовательности) и склеивает их в один байтовый буфер.
func extractPDFText(decoded []byte) ([]byte, error) {
	var out []byte
	i := 0
	for {
		open := bytes.IndexByte(decoded[i:], '(')
		if open < 0 {
			break
		}
		start := i + open + 1
		k := start
		for k < len(decoded) {
			if decoded[k] == '\\' {
				k += 2
				continue
			}
			if decoded[k] == ')' {
				break
			}
			k++
		}
		if k >= len(decoded) {
			return nil, io.ErrUnexpectedEOF
		}
		out = append(out, unescapePDFLit(decoded[start:k])...)
		i = k + 1
	}
	return out, nil
}

func unescapePDFLit(b []byte) []byte {
	var out []byte
	for i := 0; i < len(b); i++ {
		if b[i] != '\\' || i+1 >= len(b) {
			out = append(out, b[i])
			continue
		}
		i++
		c := b[i]
		switch c {
		case 'n':
			out = append(out, '\n')
		case 'r':
			out = append(out, '\r')
		case 't':
			out = append(out, '\t')
		case 'b':
			out = append(out, '\b')
		case 'f':
			out = append(out, '\f')
		case '(', ')', '\\':
			out = append(out, c)
		default:
			if c >= '0' && c <= '7' {
				v := int(c - '0')
				for n := 0; n < 2 && i+1 < len(b) && b[i+1] >= '0' && b[i+1] <= '7'; n++ {
					i++
					v = v*8 + int(b[i]-'0')
				}
				out = append(out, byte(v))
			} else {
				out = append(out, c)
			}
		}
	}
	return out
}
