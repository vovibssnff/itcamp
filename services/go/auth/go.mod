module github.com/itcamp/ktc/services/auth

go 1.22

require (
	github.com/BurntSushi/toml v1.4.0
	github.com/go-ldap/ldap/v3 v3.4.8
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/itcamp/ktc/shared/go v0.0.0
	github.com/jackc/pgx/v5 v5.6.0
	github.com/pquerna/otp v1.4.0
)

replace github.com/itcamp/ktc/shared/go => ../shared

require (
	github.com/Azure/go-ntlmssp v0.0.0-20221128193559-754e69321358 // indirect
	github.com/boombuler/barcode v1.0.1-0.20190219062509-6c824513bacc // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.5 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20221227161230-091c0ba34f0a // indirect
	github.com/jackc/puddle/v2 v2.2.1 // indirect
	golang.org/x/crypto v0.21.0 // indirect
	golang.org/x/sync v0.1.0 // indirect
	golang.org/x/text v0.14.0 // indirect
)
