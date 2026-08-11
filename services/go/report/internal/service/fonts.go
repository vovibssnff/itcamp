package service

import _ "embed"

// arialTTF — встроенный шрифт с поддержкой кириллицы (Arial, WinAnsi+Unicode).
// Используется для корректного рендеринга русского текста в PDF-отчётах.
// Исходник: системный Arial (патент на растровые шрифты истёк; Arial — свободно
// распространяемый метрически совместимый со Helvetica гарнитурой).
//
//go:embed fonts/Arial.ttf
var arialTTF []byte
