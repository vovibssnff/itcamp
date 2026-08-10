# build stage
# Контекст сборки = services/go (содержит snapshot/ + shared/),
# поэтому replace ../shared резолвится корректно.
FROM golang:1.22-alpine AS builder
WORKDIR /src/snapshot
COPY snapshot/go.mod snapshot/go.sum* ./
COPY shared/go.mod shared/go.sum* /src/shared/
RUN go mod download
COPY snapshot/ .
COPY shared/ /src/shared/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/snapshot ./cmd/snapshot

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/snapshot /app/snapshot
COPY snapshot/deploy/config.example.toml /app/config.toml
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/snapshot", "-config", "/app/config.toml"]
