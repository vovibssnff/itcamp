# build stage
# Docker SDK требует go >= 1.25 (otel-транзитивы).
FROM golang:1.25-alpine AS builder
WORKDIR /src/sim-manager

COPY sim-manager/go.mod sim-manager/go.sum* ./
COPY shared/go.mod shared/go.sum* /src/shared/
RUN go mod download

COPY sim-manager/ .
COPY shared/ /src/shared/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/sim-manager ./cmd/sim-manager

# runtime stage
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/sim-manager /app/sim-manager
COPY sim-manager/deploy/config.example.toml /app/config.toml

USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/sim-manager", "-config", "/app/config.toml"]
