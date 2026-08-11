// Package uid предоставляет генерацию UUID (версия 4) без внешних зависимостей.
package uid

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// New возвращает новый случайный UUID v4 в канонической строковой форме.
// Паникует при ошибке чтения из crypto/rand — это системная ошибка,
// продолжать после которой небезопасно (генерируемые ID будут невалидны).
func New() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Errorf("uid: crypto/rand failed: %w", err))
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}
