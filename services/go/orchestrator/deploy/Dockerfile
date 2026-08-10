# build stage
# Контекст сборки = services/go (содержит orchestrator/ + shared/),
# поэтому replace ../shared резолвится корректно.
FROM golang:1.22-alpine AS builder
WORKDIR /src/orchestrator

COPY orchestrator/go.mod orchestrator/go.sum* ./
COPY shared/go.mod shared/go.sum* /src/shared/
RUN go mod download

COPY orchestrator/ .
COPY shared/ /src/shared/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/orchestrator ./cmd/orchestrator

# runtime stage
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/orchestrator /app/orchestrator
COPY orchestrator/deploy/config.example.toml /app/config.toml

USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/orchestrator", "-config", "/app/config.toml"]
