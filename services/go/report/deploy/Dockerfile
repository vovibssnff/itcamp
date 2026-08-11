# build stage
# Контекст сборки = services/go (содержит report/ + shared/),
# поэтому replace ../shared резолвится корректно.
# go.mod требует go >= 1.25 (транзитивы minio-go/nats/crypto).
FROM golang:1.25-alpine AS builder
WORKDIR /src/report
COPY report/go.mod report/go.sum* ./
COPY shared/go.mod shared/go.sum* /src/shared/
RUN go mod download
COPY report/ .
COPY shared/ /src/shared/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/report ./cmd/report

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/report /app/report
COPY report/deploy/config.example.toml /app/config.toml
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/report", "-config", "/app/config.toml"]
