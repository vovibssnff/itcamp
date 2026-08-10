# build stage
# Контекст сборки = services/go (содержит gw/ + shared/),
# поэтому replace ../shared резолвится корректно.
FROM golang:1.22-alpine AS builder
WORKDIR /src/gw

COPY gw/go.mod gw/go.sum* ./
COPY shared/go.mod shared/go.sum* /src/shared/
RUN go mod download

COPY gw/ .
COPY shared/ /src/shared/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/gw ./cmd/gw

# runtime stage
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/gw /app/gw
COPY gw/deploy/config.example.toml /app/config.toml

USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/gw", "-config", "/app/config.toml"]
