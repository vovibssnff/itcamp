# Сборка одноразового мигратора для data-plane (infra/local).
# Контекст сборки — каталог tools/migrator (отдельный модуль Go).
FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/migrator .

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/migrator /app/migrator
ENTRYPOINT ["/app/migrator"]
