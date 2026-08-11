 # Зависимости auth-сервиса (NFR-COMP-03 — реестр с обоснованием)

## Go-модули

| Модуль | Версия | Назначение | Обоснование / план замены |
|---|---|---|---|
| `github.com/jackc/pgx/v5` | v5.6.0 | Драйвер PostgreSQL-wire для Picodata | PG-совместимый протокол Picodata (§7.4). Альтернатив: отечественный драйвер — пока отсутствует. |
| `github.com/golang-jwt/jwt/v5` | v5.2.1 | Эмиссия/валидация JWT (FR-AUTH-01/06) | Де-факто стандарт Go. Чистая BSD-3 реализация RFC 7519. |
| `github.com/go-ldap/ldap/v3` | v3.4.8 | LDAP/AD bind, поиск пользователя (FR-AUTH-01) | Единственный зрелый LDAP-клиент Go. MIT. |
| `github.com/pquerna/otp` | v1.4.0 | TOTP RFC 6238 для 2FA (auth.md §2) | Apache-2.0. Замены не требует (криптостандарт). |
| `github.com/kelseyhightower/envconfig` | v1.4.0 | Конфиг из env | MIT, лёгкий. Можно заменить на stdlib `os.Getenv` при необходимости. |

## Стандартная библиотека (без зависимостей)

- `net/http` — сервер (Go 1.25+, новый pattern-mux)
- `log/slog` — структурированное логирование
- `crypto/aes`, `crypto/cipher`, `crypto/sha256`, `crypto/rand` — шифрование TOTP-секретов, хеширование токенов
- `encoding/json` — REST-сериализация

## Внешние системы (runtime)

| Система | Протокол | Назначение |
|---|---|---|
| Picodata | PostgreSQL-wire (TCP/mTLS) | Хранение пользователей, ролей, refresh-токенов, MFA, попыток входа |
| LDAP/AD | LDAPS (через Egress Gateway) | Аутентификация учётных данных (FR-AUTH-01/02) |
| PAM (опционально) | HTTPS | Привилегированный доступ |
| KUMA | логи (Fluent Bit) | Аудит ИБ-событий |

## Замечания по отечественности

Все Go-модули — OSS с permisssive-лицензиями (BSD/MIT/Apache), не входят в реестр ограничений.
Криптография (AES-256-GCM, SHA-256, TOTP) реализована stdlib Go — не требует внешних СКЗИ.
HMAC для протоколов экзамена — в `assessment`/`report`, не здесь.
